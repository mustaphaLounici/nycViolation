import {styled} from '@mui/material/styles';
import Slider from '@mui/material/Slider';

import { format } from 'date-fns';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { useState, useEffect, useCallback, useRef } from 'react';

const PositionContainer = styled('div')({
  position: 'absolute',
  zIndex: 1,
  bottom: '40px',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
});

const StyledSlider = styled(Slider)({
  width: '40%',
  '& .MuiSlider-valueLabel': {
    background: 'none',
    color: '#000'
  }
});

const StyledLabel = styled('div')({
  background: 'rgba(255, 255, 255, 0.9)',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#000',
  textAlign: 'center'
});

const ControlsContainer = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '16px'
});

const PlayButton = styled(IconButton)({
  background: 'rgba(255, 255, 255, 0.9)',
  '&:hover': {
    background: 'rgba(255, 255, 255, 1)',
  }
});

type RangeInputProps = {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  speed: number;
  setSpeed: (speed: number) => void;
};

export default function RangeInput({
  min,
  max,
  value,
  onChange,
  speed,
}: RangeInputProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef<number>(0);
  
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  
  const animate = useCallback((timestamp: number) => {
    if (!lastUpdateTime.current) {
      lastUpdateTime.current = timestamp;
    }
    
    const deltaTime = timestamp - lastUpdateTime.current;
    const daysToAdd = (deltaTime / 1000) * speed; // Use speed state instead of constant
    const increment = daysToAdd * MS_PER_DAY;
    
    const nextValue = value + increment;
    
    if (nextValue >= max) {
      onChange(min);
      lastUpdateTime.current = timestamp;
    } else {
      onChange(nextValue);
      lastUpdateTime.current = timestamp;
    }
    
    animationFrameId.current = requestAnimationFrame(animate);
  }, [value, max, min, onChange, speed]); // Add speed to dependencies

  useEffect(() => {
    if (isPlaying) {
      lastUpdateTime.current = 0;
      animationFrameId.current = requestAnimationFrame(animate);
    } else if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      lastUpdateTime.current = 0;
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, animate]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formattedDate = (value: number) => {
    const date = new Date(value);
    return `${format(date, 'EEE, MMM d, yyyy')}`;
  };

  return (
    <PositionContainer>
      <ControlsContainer>
        <PlayButton 
          onClick={handlePlayPause}
          size="small"
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </PlayButton>
        <StyledLabel style={{
          minWidth:'150px'
        }}>
          {formattedDate(value)}
        </StyledLabel>
      </ControlsContainer>
      <StyledSlider
        min={min}
        max={max}
        value={value}
        onChange={(_, newValue) => {
          onChange(newValue as number);
          setIsPlaying(false);
        }}
        valueLabelDisplay="off"
      />
    </PositionContainer>
  );
} 