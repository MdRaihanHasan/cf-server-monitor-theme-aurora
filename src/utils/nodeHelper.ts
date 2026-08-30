import type { NodeData } from '@/stores/nodes'
import { formatDateTime } from '@/utils/helper'
import { parseTags } from '@/utils/tagHelper'

/** Ping provider config */
export const PING_PROVIDERS = [
  { key: 'ct', label: 'CT' },
  { key: 'cu', label: 'CU' },
  { key: 'cm', label: 'CM' },
  { key: 'bd', label: 'BD' },
] as const

/**
 * Check whether region information is valid.
 */
export function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

/**
 * Check whether the traffic progress bar should be shown.
 */
export function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

/**
 * Return the ping tone CSS class based on latency.
 */
export function getPingToneClass(latency: number, available: boolean): string {
  if (!available)
    return 'text-muted-foreground'
  if (latency <= 100)
    return 'text-teal-600 dark:text-teal-400'
  if (latency <= 180)
    return 'text-lime-600 dark:text-lime-400'
  if (latency <= 260)
    return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

/**
 * Compute used traffic based on the traffic limit type.
 */
export function getTrafficUsed(node: NodeData): number {
  const { net_monthly_up = 0, net_monthly_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up': return net_monthly_up
    case 'down': return net_monthly_down
    case 'min': return Math.min(net_monthly_up, net_monthly_down)
    case 'max': return Math.max(net_monthly_up, net_monthly_down)
    case 'sum':
    default: return net_monthly_up + net_monthly_down
  }
}

/**
 * Compute the traffic usage percentage.
 */
export function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0
  return Math.min((getTrafficUsed(node) / node.traffic_limit) * 100, 100)
}

/** Traffic progress warning thresholds: >= 80% yellow, >= 95% red */
export const TRAFFIC_WARNING_PERCENT = 80
export const TRAFFIC_DANGER_PERCENT = 95

export type TrafficLevel = 'success' | 'warning' | 'error'

export function getTrafficLevel(percentage: number): TrafficLevel {
  if (percentage >= TRAFFIC_DANGER_PERCENT)
    return 'error'
  if (percentage >= TRAFFIC_WARNING_PERCENT)
    return 'warning'
  return 'success'
}

/**
 * Format the offline time.
 */
export function formatOfflineTime(node: NodeData): string {
  return formatDateTime(node.time)
}

/**
 * Parse the list of custom tag texts.
 */
export function getCustomTags(node: NodeData): string[] {
  return parseTags(node.tags).map(t => t.text)
}
