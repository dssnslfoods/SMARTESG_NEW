import React from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Wraps a recharts chart in a horizontally scrollable container when
 * there are many data points (e.g. multi-year All Time mode).
 *
 * When dataLength <= threshold: renders a normal 100%-wide ResponsiveContainer.
 * When dataLength > threshold: renders a fixed-width container inside a
 * scrollable div so the user can scroll horizontally.
 */

interface ChartScrollWrapperProps {
  /** Number of data points in the chart */
  dataLength: number;
  /** Minimum pixel width per bar/point before scrolling kicks in (default 48) */
  minBarWidth?: number;
  /** Number of points that fit comfortably without scroll (default 14) */
  threshold?: number;
  /** Chart height in px (default 300) */
  height?: number;
  children: React.ReactElement;
}

export function ChartScrollWrapper({
  dataLength,
  minBarWidth = 48,
  threshold = 14,
  height = 300,
  children,
}: ChartScrollWrapperProps) {
  const needsScroll = dataLength > threshold;
  const minWidth = needsScroll ? Math.max(dataLength * minBarWidth, 600) : 600;

  if (!needsScroll) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    );
  }

  return (
    <div className="w-full">
      <div
        className="overflow-x-auto w-full rounded-lg"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ width: minWidth, height }}>
          <ResponsiveContainer width={minWidth} height={height}>
            {children}
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-1.5 opacity-50 select-none">
        ⟵ เลื่อนดูข้อมูลเพิ่มเติม · Scroll for more ⟶
      </p>
    </div>
  );
}
