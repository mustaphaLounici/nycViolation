import { CompositeLayer } from "@deck.gl/core";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { startOfDay, parseISO, isAfter } from "date-fns";
import type { ViolationFeature } from "./ViolationLayer";

export type ViolationHeatmapLayerProps = {
  data: ViolationFeature[];
  currentTime: number | null;
  intensity?: number;
  threshold?: number;
  radiusPixels?: number;
};

export default class ViolationHeatmapLayer extends CompositeLayer<
  Required<ViolationHeatmapLayerProps>
> {
  static layerName = "ViolationHeatmapLayer";

  static defaultProps = {
    intensity: 2,
    threshold: 0.1,
    radiusPixels: 30,
  };

  renderLayers() {
    const { data, currentTime, intensity, threshold, radiusPixels } =
      this.props;

    const selectedDate = currentTime ? startOfDay(currentTime) : null;
    const filteredData = selectedDate
      ? data.filter((feature) => {
          const violationDate = parseISO(feature.properties.ViolationDate);
          return !isAfter(violationDate, selectedDate);
        })
      : data;

    return new HeatmapLayer({
      id: `${this.props.id}-heatmap`,
      data: filteredData,
      getPosition: (d: ViolationFeature) => d.geometry.coordinates,
      getWeight: 1,
      intensity,
      threshold,
      radiusPixels,
      colorRange: [
        [220, 20, 60, 150],  // Light crimson
        [220, 20, 60, 170],  // Crimson
        [220, 20, 60, 190],  // Medium crimson
        [220, 20, 60, 210],  // Deep crimson
        [220, 20, 60, 230],  // Deeper crimson
        [220, 20, 60, 255],  // Full crimson
      ],
    });
  }
}
