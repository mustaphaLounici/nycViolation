import {createRoot} from 'react-dom/client';
import {Map as MapGL} from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { useEffect, useState, useMemo } from 'react';
import RangeInput from './components/RangeInput';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {styled} from '@mui/material/styles';
import { startOfDay, format } from 'date-fns';
import Slider from '@mui/material/Slider';

import type {MapViewState} from '@deck.gl/core';
import type { ViolationFeature} from './layers/ViolationLayer';
import ViolationLayer from './layers/ViolationLayer';

// Initial view centered on NYC
const INITIAL_VIEW_STATE: MapViewState = {
  latitude: 40.7128,
  longitude: -74.0060,
  zoom: 11,
  pitch: 0,
  bearing: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#ffffff'
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)'
    }
  }
});

// Add a styled component for the legend
const LegendContainer = styled(Box)({
  position: 'absolute',
  top: '20px',
  right: '20px',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  zIndex: 1,
  minWidth: '200px',
  color: 'rgba(0, 0, 0, 0.87)'
});



// Add this new styled component for the gradient bar
const GradientBar = styled(Box)({
  width: '100%',
  height: '20px',
  background: 'linear-gradient(to right, rgba(220, 20, 60, 0.2), rgba(220, 20, 60, 1))',
  borderRadius: '4px',
  marginBottom: '8px',
  border: '1px solid rgba(0,0,0,0.1)'
});

function getTooltip(info: any) {
  if (!info.object) {
    return null;
  }

  console.log(info.object);
  // Import types needed
  const object = info.object;
  // Handle tooltip for both cluster and single point cases

    return {
      html: `
        <div>
          <b>Date:</b> ${object?.ViolationDate}<br/>
          <b>Time:</b> ${object?.ViolationTime}<br/>
          <b>Location:</b> ${object?.Address?.houseNumber} ${object?.Address?.street}, ${object?.Address?.borough}<br/>
          ${object?.Respondent ? `<b>Respondent:</b> ${object?.Respondent}<br/>` : ''}
        </div>
      `
    };
  
}

function getTopViolators(data: ViolationFeature[], limit: number = 3): Array<{name: string, count: number}> {
  const counts = data.reduce((acc: Map<string, number>, feature) => {
    const respondent = feature.properties.Respondent;
    if (respondent) {
      acc.set(respondent, (acc.get(respondent) || 0) + 1);
    }
    return acc;
  }, new Map<string, number>([]));

  return Array.from(counts.entries())
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]: [string, number]) => ({ name, count }));
}

export default function App({
  mapStyle = MAP_STYLE
}: {
  mapStyle?: string;
}) {
  const [data, setData] = useState<ViolationFeature[]>([]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [speed, setSpeed] = useState(7);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Fetching data...');
        const response = await fetch('/data/output-corrected.geojson');
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        console.log('Fetched data:', jsonData);
        setData(jsonData.features);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
    fetchData();
  }, []);

  const timeRange = useMemo(() => {
    if (!data.length) return null;
    return data.reduce(
      (range, feature) => {
        const timestamp = startOfDay(new Date(feature.properties.ViolationDate)).getTime();
        range[0] = Math.min(range[0], timestamp);
        range[1] = Math.max(range[1], timestamp);
        return range;
      },
      [Infinity, -Infinity] as [number, number]
    );
  }, [data]);

  // Set initial current time when data is loaded
  useEffect(() => {
    if (timeRange && currentTime === null) {
      setCurrentTime(timeRange[0]);
    }
  }, [timeRange, currentTime]);

  const topViolators = useMemo(() => {
    return getTopViolators(data);
  }, [data]);

  const layers = [
 
    new ViolationLayer({
      id: 'violations-cluster',
      data,
      currentTime,
      radiusScale: 6
    })
  ];

  return (
    <ThemeProvider theme={theme}>
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={({viewState}) => setViewState(viewState as MapViewState)}
        controller={true}
        getTooltip={getTooltip}
      >
        <MapGL reuseMaps mapStyle={mapStyle}>
    
        </MapGL>
        <LegendContainer>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            Idling Violations
          </Typography>
          
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {currentTime ? format(currentTime, 'EEEE, MMMM d, yyyy') : ''}
            </Typography>
          </Box>

          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            How to Read the Map
          </Typography>
          
          <GradientBar />
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="body2">Previous violations</Typography>
            <Typography variant="body2">Current day violations</Typography>
          </Box>

          <Box mt={2} pt={2} sx={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="body2" color="text.secondary">
              • Violations are shown in varying opacity to indicate timing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Use the slider below to explore different dates
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Click on any point to see violation details
            </Typography>
          </Box>

          <Box mt={2} pt={2} sx={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Top Violating Companies
            </Typography>
            {topViolators.map((violator, index) => (
              <Box 
                key={violator.name} 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                mb={1}
              >
                <Typography variant="body2" sx={{ 
                  color: 'text.primary',
                  maxWidth: '70%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {index + 1}. {violator.name}
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: 'text.secondary',
                  fontWeight: 'bold'
                }}>
                  {violator.count}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box mt={2} pt={2} sx={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Animation Speed
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Slow
              </Typography>
              <Slider
                min={1}
                max={30}
                value={speed}
                onChange={(_, newValue) => setSpeed(newValue as number)}
                sx={{ 
                  width: '100px',
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                  }
                }}
              />
              <Typography variant="body2" color="text.secondary">
                Fast
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {speed === 1 ? '1 day/sec' : 
               speed === 7 ? '1 week/sec' :
               speed === 14 ? '2 weeks/sec' :
               speed === 30 ? '1 month/sec' :
               `${speed} days/sec`}
            </Typography>
          </Box>
        </LegendContainer>
      </DeckGL>

      {timeRange && currentTime !== null && (
        <RangeInput
          min={timeRange[0]}
          max={timeRange[1]}
          value={currentTime}
          onChange={setCurrentTime}
          speed={speed}
          setSpeed={setSpeed}
        />
      )}
    </ThemeProvider>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}