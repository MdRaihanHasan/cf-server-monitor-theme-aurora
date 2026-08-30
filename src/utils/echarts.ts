/**
 * Shared ECharts configuration
 *
 * Registers all chart components in one place to avoid repeating registration in each component.
 */
import { LineChart, MapChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

// Register all required ECharts components at once
use([
  LineChart,
  MapChart,
  ScatterChart,
  GridComponent,
  GeoComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
])
