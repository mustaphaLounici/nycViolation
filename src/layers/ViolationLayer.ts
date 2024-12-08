import { CompositeLayer } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { startOfDay, parseISO, isSameDay, isAfter } from "date-fns";
import type { PickingInfo } from "@deck.gl/core";
import type { Color } from "@deck.gl/core";

export type ViolationFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    ViolationDate: string;
    ViolationTime: string;
    Respondent: string;
    Address: {
      borough: string;
      street: string;
      houseNumber: string;
      zipCode: string;
    };
  };
};

// Color scheme for boroughs
const BASE_COLOR: [number, number, number] = [220, 20, 60]; // Crimson red color
const TRANSITION_DURATION = 600; // Animation duration in milliseconds

export type ViolationLayerProps = {
  data: ViolationFeature[];
  currentTime: number | null;
  radiusScale?: number;
};

// Add a function to calculate violation counts per respondent
function getViolationCounts(data: ViolationFeature[]): Map<string, number> {
  const counts = new Map<string, number>();

  data.forEach((feature) => {
    const respondent = feature.properties.Respondent;
    if (respondent) {
      counts.set(respondent, (counts.get(respondent) || 0) + 1);
    }
  });

  return counts;
}

export type ViolationInfo = {
  ViolationDate: string;
  ViolationTime: string;
  Respondent: string;
  Address: {
    houseNumber: string;
    street: string;
    borough: string;
  };
  totalViolations: number;
};

export default class ViolationLayer extends CompositeLayer<
  Required<ViolationLayerProps>
> {
  static layerName = "ViolationLayer";

  static defaultProps = {
    radiusScale: 6,
  };

  getPickingInfo({ info }: { info: PickingInfo }): PickingInfo {
    if (info.object) {
      const feature = info.object as ViolationFeature;
      const violationCounts = getViolationCounts(this.props.data);

      return {
        ...info,
        object: {
          ...feature.properties,
          totalViolations:
            violationCounts.get(feature.properties.Respondent) || 1,
        } as ViolationInfo,
      };
    }
    return info;
  }

  renderLayers() {
    const { data, currentTime, radiusScale } = this.props;

    const selectedDate = currentTime ? startOfDay(currentTime) : null;
    const filteredData = selectedDate
      ? data.filter((feature) => {
          const violationDate = parseISO(feature.properties.ViolationDate);
          return !isAfter(violationDate, selectedDate);
        })
      : data;

    // Calculate violation counts for the filtered data
    const violationCounts = getViolationCounts(filteredData);
    const maxViolations = Math.max(...violationCounts.values());

    return new ScatterplotLayer({
      id: `${this.props.id}-scatter`,
      data: filteredData,
      pickable: true,
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusScale,
      radiusMinPixels: 5,
      radiusMaxPixels: 100,
      lineWidthMinPixels: 0,
      getPosition: (d: ViolationFeature) => d.geometry.coordinates,
      getRadius: (d: ViolationFeature) => {
        const MIN_SIZE = 5;
        const MAX_SIZE = 50;
        
        if (!selectedDate) return MIN_SIZE;

        const violationDate = parseISO(d.properties.ViolationDate);
        const isCurrentDay = selectedDate && isSameDay(violationDate, selectedDate);
        const daysDifference = Math.floor((selectedDate.getTime() - violationDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Size based on how recent the violation is
        if (isCurrentDay) {
          return MAX_SIZE; // Current day: maximum size
        } else if (daysDifference < 0) {
          return 0; // Future dates should not be visible
        } else if (daysDifference <= 7) {
          // Linear decrease from MAX_SIZE to MIN_SIZE over the week
          const ratio = (7 - daysDifference) / 7;
          return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * ratio;
        } else {
          return MIN_SIZE; // Older than a week: minimum size
        }
      },
      getLineColor: [255, 255, 255, 200],
      getLineWidth: 1,
      getFillColor: (d: ViolationFeature) => {
        if (!selectedDate) return [...BASE_COLOR, 200] as Color;
        const violationDate = parseISO(d.properties.ViolationDate);
        const isCurrentDay = isSameDay(violationDate, selectedDate);

        // Adjust opacity range to start from a higher value
        const count = violationCounts.get(d.properties.Respondent) || 1;
        const opacityMultiplier = Math.sqrt(count / maxViolations) * 0.3 + 0.7;

        return isCurrentDay
          ? ([...BASE_COLOR, 255 * opacityMultiplier] as Color)
          : ([...BASE_COLOR, 180 * opacityMultiplier] as Color);
      },
      transitions: {
        getFillColor: TRANSITION_DURATION,
      },
      updateTriggers: {
        getRadius: [currentTime],
        getFillColor: [currentTime, violationCounts],
      },
    });
  }
}
