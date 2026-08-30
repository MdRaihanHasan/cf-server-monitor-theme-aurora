export interface ChartTimeRange {
  label: string
  hours: number
}

export const DEFAULT_CHART_TIME_RANGE: ChartTimeRange = { label: '1H', hours: 1 }

export const CHART_TIME_RANGES: readonly ChartTimeRange[] = [
  DEFAULT_CHART_TIME_RANGE,
  { label: '6H', hours: 6 },
  { label: '12H', hours: 12 },
  { label: '24H', hours: 24 },
  // Multi-day views are only available when logged in and show_long_history is enabled (gated by record retention duration)
  { label: '2D', hours: 48 },
  { label: '4D', hours: 96 },
  { label: '7D', hours: 168 },
]

export function getAvailableChartTimeRanges(maxHours: number): ChartTimeRange[] {
  return CHART_TIME_RANGES.filter(range => range.hours <= maxHours)
}
