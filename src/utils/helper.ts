import dayjs from 'dayjs'

/** Byte unit constants */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const
const LAST_BYTE_UNIT = BYTE_UNITS.at(-1)

/** Time unit configuration (in seconds) */
const TIME_UNITS = [
  { value: 86400, label: 'd' },
  { value: 3600, label: 'h' },
  { value: 60, label: 'min' },
  { value: 1, label: 's' },
] as const

/** Uptime formatting precision type */
export type UptimeFormat = 'day' | 'hour' | 'minute' | 'second'

/** Byte formatting precision configuration */
export interface ByteDecimalsConfig {
  /** B decimal places, -1 to hide this unit */
  B?: number
  /** KB decimal places, -1 to hide this unit */
  KB?: number
  /** MB decimal places, -1 to hide this unit */
  MB?: number
  /** GB decimal places, -1 to hide this unit */
  GB?: number
  /** TB and above decimal places, -1 to hide this unit */
  TB?: number
}

/** Default byte precision configuration */
const DEFAULT_BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 1,
}

/**
 * Format a byte count into a human-readable unit
 * @param bytes byte count
 * @param decimals number of decimal places
 * @returns formatted string, e.g. "1.5 GB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0)
    return '0 B'

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`
}

/**
 * Format a byte count into a human-readable unit (supports custom precision config)
 * @param bytes byte count
 * @param config precision configuration
 * @returns formatted string, e.g. "1.5 GB"
 */
export function formatBytesWithConfig(bytes: number, config?: ByteDecimalsConfig): string {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config }

  if (bytes === 0) {
    // For 0 bytes, check whether B is disabled
    if (mergedConfig.B === -1)
      return '0 KB'
    return '0 B'
  }

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  // Get the precision config for the matching unit
  const unitKey = BYTE_UNITS[i]
  // PB and above use the TB precision config
  const decimals = (unitKey === 'TB' || unitKey === 'PB') ? mergedConfig.TB : mergedConfig[unitKey as keyof ByteDecimalsConfig]

  // If the current unit is disabled, look upward for an available unit
  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j]
      const nextDecimals = (nextUnitKey === 'TB' || nextUnitKey === 'PB') ? mergedConfig.TB : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig]
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j]
        return `${(bytes / k ** j).toFixed(nextDecimals)} ${unit}`
      }
    }
    // All units are disabled, fall back to default behavior
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
    return `${(bytes / k ** i).toFixed(1)} ${unit}`
  }

  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return `${(bytes / k ** i).toFixed(decimals)} ${unit}`
}

/**
 * Format a byte count into separate value and unit (supports custom precision config)
 * @param bytes byte count
 * @param config precision configuration
 * @returns separated value and unit, e.g. { value: "1.5", unit: "GB" }
 */
export function formatBytesSplit(bytes: number, config?: ByteDecimalsConfig): { value: string, unit: string } {
  const mergedConfig = { ...DEFAULT_BYTE_DECIMALS, ...config }

  if (bytes === 0) {
    if (mergedConfig.B === -1)
      return { value: '0', unit: 'KB' }
    return { value: '0', unit: 'B' }
  }

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const unitKey = BYTE_UNITS[i]
  const decimals = (unitKey === 'TB' || unitKey === 'PB') ? mergedConfig.TB : mergedConfig[unitKey as keyof ByteDecimalsConfig]

  if (decimals === -1) {
    for (let j = i + 1; j < BYTE_UNITS.length; j++) {
      const nextUnitKey = BYTE_UNITS[j]
      const nextDecimals = (nextUnitKey === 'TB' || nextUnitKey === 'PB') ? mergedConfig.TB : mergedConfig[nextUnitKey as keyof ByteDecimalsConfig]
      if (nextDecimals !== -1) {
        const unit = BYTE_UNITS[j]
        return { value: (bytes / k ** j).toFixed(nextDecimals), unit: `${unit}` }
      }
    }
    const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
    return { value: (bytes / k ** i).toFixed(1), unit: `${unit}` }
  }

  const unit = BYTE_UNITS[i] ?? LAST_BYTE_UNIT
  return { value: (bytes / k ** i).toFixed(decimals), unit: `${unit}` }
}

/**
 * Format a byte rate into separate value and unit (supports custom precision config)
 * @param bytes byte rate
 * @param config precision configuration
 * @returns separated value and unit, e.g. { value: "1.5", unit: "GB/s" }
 */
export function formatBytesPerSecondSplit(bytes: number, config?: ByteDecimalsConfig): { value: string, unit: string } {
  const result = formatBytesSplit(bytes, config)
  return { value: result.value, unit: `${result.unit}/s` }
}

/**
 * Format a byte rate into a human-readable unit
 * @param bytes byte rate
 * @returns formatted string, e.g. "1.5 GB/s"
 */
export function formatBytesPerSecond(bytes: number): string {
  return `${formatBytes(bytes)}/s`
}

/**
 * Format a byte rate into a human-readable unit (supports custom precision config)
 * @param bytes byte rate
 * @param config precision configuration
 * @returns formatted string, e.g. "1.5 GB/s"
 */
export function formatBytesPerSecondWithConfig(bytes: number, config?: ByteDecimalsConfig): string {
  return `${formatBytesWithConfig(bytes, config)}/s`
}

/**
 * Format an uptime duration
 * @param seconds number of seconds
 * @returns formatted string, e.g. "2 d 3 h 15 min"
 */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0)
    return '0 s'

  const parts: string[] = []
  let remaining = seconds

  for (const { value, label } of TIME_UNITS) {
    const amount = Math.floor(remaining / value)
    if (amount > 0) {
      parts.push(`${amount} ${label}`)
      remaining %= value
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0 s'
}

/**
 * Format an uptime duration (supports custom precision)
 * @param seconds number of seconds
 * @param format precision format: 'day' | 'hour' | 'minute' | 'second'
 * - 'day': show days only (e.g. "2 d"); shows "less than 1 d" when under a day
 * - 'hour': show days and hours (e.g. "2 d 3 h"); shows "less than 1 h" when under an hour
 * - 'minute': show days, hours and minutes (e.g. "2 d 3 h 15 min"); shows "less than 1 min" when under a minute
 * - 'second': show days, hours, minutes and seconds (e.g. "2 d 3 h 15 min 30 s")
 * @returns formatted string
 */
export function formatUptimeWithFormat(seconds: number, format: UptimeFormat = 'day'): string {
  if (!seconds || seconds <= 0)
    return '0 s'

  // Determine the max unit index based on the format (starting from days)
  const formatMaxUnitIndexMap: Record<UptimeFormat, number> = {
    day: 0, // up to days only
    hour: 1, // up to hours
    minute: 2, // up to minutes
    second: 3, // up to seconds
  }

  const maxUnitIndex = formatMaxUnitIndexMap[format]
  const parts: string[] = []
  let remaining = seconds

  for (let i = 0; i < TIME_UNITS.length; i++) {
    const unit = TIME_UNITS[i]
    if (!unit)
      continue
    const { value, label } = unit
    const amount = Math.floor(remaining / value)
    if (amount > 0) {
      parts.push(`${amount} ${label}`)
      remaining %= value
    }
    // Stop once the max unit index is reached
    if (i >= maxUnitIndex) {
      break
    }
  }

  // If no unit has a value, show "less than 1 X"
  if (parts.length === 0) {
    const fallbackUnit = TIME_UNITS[maxUnitIndex]
    const fallbackLabel = fallbackUnit?.label ?? 's'
    return `less than 1 ${fallbackLabel}`
  }

  return parts.join(' ')
}

/**
 * Calculate usage percentage
 * @param used amount used
 * @param total total amount
 * @returns percentage (0-100)
 */
export function calcPercentage(used: number, total: number): number {
  if (total === 0)
    return 0
  return (used / total) * 100
}

/** Status threshold configuration */
const STATUS_THRESHOLDS = {
  success: 60,
  warning: 80,
} as const

/**
 * Return a status based on the usage percentage
 * @param percentage percentage
 * @returns status type
 */
export function getStatus(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage < STATUS_THRESHOLDS.success)
    return 'success'
  if (percentage < STATUS_THRESHOLDS.warning)
    return 'warning'
  return 'error'
}

/**
 * Format a timestamp into a human-readable date-time
 * @param timestamp timestamp string or Date object
 * @returns formatted string, e.g. "2024-01-15 14:30:00"
 */
export function formatDateTime(timestamp: string | Date | undefined, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!timestamp)
    return '-'

  const date = dayjs(timestamp)

  if (!date.isValid())
    return '-'

  return date.format(format)
}
