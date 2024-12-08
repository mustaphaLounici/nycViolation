// src/layers/ClusterViolationLayer.tsx
import { CompositeLayer } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import Supercluster from "supercluster";
import { startOfDay, parseISO, isAfter, isSameDay } from "date-fns";
import type { ViolationFeature } from "./ViolationLayer";
import type { Feature, Point } from "geojson";
import type { Color } from "@deck.gl/core";

const MIN_RADIUS = 5;
const MAX_RADIUS = 100;
const BASE_COLOR: [number, number, number] = [65, 105, 225];
const CLUSTER_RADIUS = 20;
const ZOOM_THRESHOLD = 17; // Zoom level at which clustering stops

type Cluster = Feature<Point> & {
  properties: {
    cluster: boolean;
    cluster_id?: number;
    point_count: number;
    points: ViolationFeature[];
  };
};

export type ClusterViolationLayerProps = {
  data: ViolationFeature[];
  currentTime: number | null;
  zoom: number;
  radiusScale?: number;
};

export default class ClusterViolationLayer extends CompositeLayer<
  Required<ClusterViolationLayerProps>
> {
  static layerName = "ClusterViolationLayer";
  static defaultProps = { radiusScale: 6 };

  // Cache for daily totals
  private filteredData: ViolationFeature[] | null = null;
  private maxDailyPoints: number = 1;

  updateFilteredData() {
    const { data, currentTime } = this.props;
    const selectedDate = currentTime ? startOfDay(currentTime) : null;

    // Create a map to count violations per day
    const dailyCounts = new Map<string, number>();

    this.filteredData = selectedDate
      ? data.filter((feature) => {
          const violationDate = parseISO(feature.properties.ViolationDate);
          if (!isAfter(violationDate, selectedDate)) {
            // Count violations per day
            const dateKey = startOfDay(violationDate).toISOString();
            dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
            return true;
          }
          return false;
        })
      : data;

    // Update maxDailyPoints
    this.maxDailyPoints = Math.max(1, ...dailyCounts.values());
  }

  getScaledRadius(pointCount: number, dailyTotal: number): number {
    const minRadius = MIN_RADIUS;
    const maxRadius = MAX_RADIUS;

    if (dailyTotal === 0 || !this.filteredData?.length) {
      return minRadius;
    }

    // Scale based on the maximum daily points instead of total filtered data
    const scaledRadius =
      minRadius + (pointCount / this.maxDailyPoints) * (maxRadius - minRadius);

    return scaledRadius;
  }

  createClusters() {
    const { currentTime, zoom } = this.props;
    const selectedDate = currentTime ? startOfDay(currentTime) : null;

    // Update filtered data
    this.updateFilteredData();

    // Filter data and get daily total in one pass
    let dailyTotal = 0;
    if (selectedDate && this.filteredData) {
      this.filteredData.forEach((feature) => {
        const violationDate = parseISO(feature.properties.ViolationDate);
        if (isSameDay(violationDate, selectedDate)) {
          dailyTotal++;
        }
      });
    }

    // If zoomed in enough, return individual points
    if (zoom >= ZOOM_THRESHOLD) {
      return {
        clusters: (this.filteredData || []).map((feature) => ({
          type: "Feature",
          geometry: feature.geometry,
          properties: {
            cluster: false,
            point_count: 1,
            points: [feature],
            ...feature.properties,
          },
        })) as unknown as Cluster[],
        dailyTotal: Math.max(dailyTotal, 1),
      };
    }

    // Otherwise, use clustering
    const index = new Supercluster({
      radius: CLUSTER_RADIUS,
      maxZoom: ZOOM_THRESHOLD - 1,
      minPoints: 2,
      map: (props) => ({ ViolationDate: props.ViolationDate }),
    });

    // Load and cluster data
    index.load(this.filteredData || []);
    const clusters = index.getClusters([-180, -85, 180, 85], Math.floor(zoom));

    return {
      clusters: clusters.map((cluster) => ({
        ...cluster,
        properties: {
          ...cluster.properties,
          points: cluster.properties.cluster
            ? index.getLeaves(cluster.properties.cluster_id, Infinity)
            : [cluster as unknown as ViolationFeature],
        },
      })) as unknown as Cluster[],
      dailyTotal: Math.max(dailyTotal, 1),
    };
  }

  renderLayers() {
    const { currentTime, radiusScale } = this.props;

    const { clusters, dailyTotal } = this.createClusters();

    return new ScatterplotLayer({
      id: `${this.props.id}-cluster`,
      data: clusters,
      pickable: true,
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusScale,
      radiusMinPixels: MIN_RADIUS,
      radiusMaxPixels: MAX_RADIUS,
      lineWidthMinPixels: 2,
      getPosition: (d) => d.geometry.coordinates,
      getRadius: (d) =>
        d.properties.cluster
          ? this.getScaledRadius(d.properties.point_count || 1, dailyTotal)
          : MIN_RADIUS,
      getLineColor: [255, 255, 255, 200],
      getLineWidth: 1,
      getFillColor: (d) => {
        const opacity = ((d.properties.point_count || 1) / dailyTotal) * 255;
        return [...BASE_COLOR, Math.min(opacity + 200, 255)] as Color;
      },
      updateTriggers: {
        getRadius: [currentTime, dailyTotal],
        getFillColor: [currentTime, dailyTotal],
      },
    });
  }
}
