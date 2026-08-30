/**
 * Data-processing utility functions
 * Based on the React version's RecordHelper.tsx implementation
 */

import dayjs from 'dayjs'

/** Load record format */
export interface RecordFormat {
  client: string
  time: string
  cpu: number | null
  gpu: number | null
  gpu_usage: number | null
  gpu_memory: number | null
  gpu_detailed?: {
    [index: number]: {
      usage: number | null
      memory: number | null
      temperature: number | null
      device_index?: number
      device_name?: string
      mem_total?: number
      mem_used?: number
    }
  }
  ram: number | null
  ram_total: number | null
  swap: number | null
  swap_total: number | null
  load: number | null
  temp: number | null
  disk: number | null
  disk_total: number | null
  net_in: number | null
  net_out: number | null
  net_total_up: number | null
  net_total_down: number | null
  process: number | null
  connections: number | null
  connections_udp: number | null
}

type AnyRecord = Record<string, any>

/**
 * Create a null-value template
 * Recursively sets all numeric properties to null, used to fill in missing time points
 */
function createNullTemplate(obj: unknown): unknown {
  if (obj === null || obj === undefined)
    return null
  if (typeof obj === 'number')
    return null
  if (typeof obj === 'string' || typeof obj === 'boolean')
    return obj
  if (Array.isArray(obj))
    return obj.map(createNullTemplate)
  if (typeof obj === 'object') {
    const res: Record<string, unknown> = {}
    for (const k in obj as Record<string, unknown>) {
      if (k === 'updated_at' || k === 'time')
        continue
      res[k] = createNullTemplate((obj as Record<string, unknown>)[k])
    }
    return res
  }
  return null
}

/**
 * Fill in missing time points
 * Two modes:
 * 1. Fixed length: generate a time window of the specified length, ending at the last data point
 * 2. Variable length: if totalSeconds is null, fill from the first data point to the last
 *
 * @param data input data array, should have a time or updated_at property
 * @param intervalSec interval between time points (seconds)
 * @param totalSeconds total duration to display (seconds); set to null to start from the first data point
 * @param matchToleranceSec tolerance for matching time points (seconds), defaults to intervalSec
 */
export function fillMissingTimePoints<T extends { time?: string, updated_at?: string }>(
  data: T[],
  intervalSec: number,
  totalSeconds: number | null,
  matchToleranceSec?: number,
): T[] {
  if (!data.length)
    return []

  const getTime = (item: T) =>
    dayjs(item.time ?? item.updated_at ?? '').valueOf()

  // Precompute timestamps to avoid repeated parsing
  const timedData = data.map(item => ({ item, timeMs: getTime(item) }))
  timedData.sort((a, b) => a.timeMs - b.timeMs)

  const firstItem = timedData[0]
  const lastItem = timedData.at(-1)

  if (!firstItem || !lastItem)
    return []

  const end = lastItem.timeMs
  const interval = intervalSec * 1000

  // Determine the start time
  const start
    = totalSeconds !== null && totalSeconds > 0
      ? end - totalSeconds * 1000 + interval // fixed-length mode
      : firstItem.timeMs // variable-length mode

  // Generate the ideal time points
  const timePoints: number[] = []
  for (let t = start; t <= end; t += interval) {
    timePoints.push(t)
  }

  // Create the null-value template
  const nullTemplate = createNullTemplate(lastItem.item) as T

  let dataIdx = 0
  const matchToleranceMs = (matchToleranceSec ?? intervalSec) * 1000

  const filled: T[] = timePoints.map((t) => {
    let found: T | undefined

    // Skip data points that are too old
    while (
      dataIdx < timedData.length
      && timedData[dataIdx]!.timeMs < t - matchToleranceMs
    ) {
      dataIdx++
    }

    const currentData = timedData[dataIdx]
    // Check whether the current data point is within the tolerance range
    if (
      currentData
      && Math.abs(currentData.timeMs - t) <= matchToleranceMs
    ) {
      found = currentData.item
    }

    if (found) {
      // If found, use it but align the time to the grid
      return { ...found, time: dayjs(t).toISOString() }
    }

    // If not found, insert the null-value template
    return { ...nullTemplate, time: dayjs(t).toISOString() } as T
  })

  return filled
}

/**
 * Linear interpolation fill
 * Between two adjacent valid points, fill the intermediate null values with linear interpolation
 * - Only interpolates when "both endpoints exist and are numeric"
 * - Use maxGapMs to control the maximum interpolatable time span
 */
export function interpolateNullsLinear(
  rows: AnyRecord[],
  keys: string[],
  options?:
    | number
    | {
      /** Uniform maximum interpolation span */
      maxGapMs?: number
      /** If maxGapMs is not provided, use typical interval * this multiplier as the max interpolation span */
      maxGapMultiplier?: number
      /** Uniform lower and upper bounds (used for clamping) */
      minCapMs?: number
      maxCapMs?: number
    },
): AnyRecord[] {
  if (!rows || rows.length === 0 || !keys.length)
    return rows

  const times = rows.map(r =>
    dayjs(r.time ?? r.updated_at ?? '').valueOf(),
  )
  const out: AnyRecord[] = rows.map(r => ({ ...r }))

  // Parse the config
  const opts
    = typeof options === 'number'
      ? { maxGapMs: options }
      : options || {}
  const maxGapMsUnified = opts.maxGapMs
  const multiplier = opts.maxGapMultiplier ?? 6
  const minCap = opts.minCapMs ?? 2 * 60_000 // 2min
  const maxCap = opts.maxCapMs ?? 30 * 60_000 // 30min

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v))

  for (const key of keys) {
    // Collect the indices of valid points in this column
    const validIdx: number[] = []
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i]?.[key]
      if (typeof v === 'number' && Number.isFinite(v))
        validIdx.push(i)
    }

    if (validIdx.length < 2)
      continue

    // Compute this column's "typical interval" (using the median)
    let perKeyMaxGap = maxGapMsUnified
    if (perKeyMaxGap === undefined) {
      const gaps: number[] = []
      for (let s = 0; s < validIdx.length - 1; s++) {
        const i0 = validIdx[s]
        const i1 = validIdx[s + 1]
        if (i0 === undefined || i1 === undefined)
          continue
        const t0 = times[i0]
        const t1 = times[i1]
        if (t0 !== undefined && t1 !== undefined && Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) {
          gaps.push(t1 - t0)
        }
      }
      if (gaps.length === 0)
        continue
      gaps.sort((a, b) => a - b)
      const median = gaps[Math.floor(gaps.length / 2)]
      if (median === undefined)
        continue
      perKeyMaxGap = clamp(median * multiplier, minCap, maxCap)
    }

    // Do linear interpolation between adjacent valid points
    for (let s = 0; s < validIdx.length - 1; s++) {
      const i0 = validIdx[s]
      const i1 = validIdx[s + 1]
      if (i0 === undefined || i1 === undefined)
        continue

      const t0 = times[i0]
      const t1 = times[i1]
      if (t0 === undefined || t1 === undefined)
        continue

      const row0 = rows[i0]
      const row1 = rows[i1]
      if (!row0 || !row1)
        continue

      const v0 = row0[key]
      const v1 = row1[key]

      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0)
        continue
      if (typeof v0 !== 'number' || typeof v1 !== 'number')
        continue
      if (perKeyMaxGap && t1 - t0 > perKeyMaxGap)
        continue // Gap too large, keep the hole

      for (let j = i0 + 1; j < i1; j++) {
        const tj = times[j]
        if (tj === undefined)
          continue
        const ratio = (tj - t0) / (t1 - t0)
        const outRow = out[j]
        if (outRow) {
          outRow[key] = v0 + (v1 - v0) * ratio
        }
      }
    }
  }

  return out
}

/**
 * EWMA (Exponentially Weighted Moving Average) peak clipping
 * Smooths data using the exponentially weighted moving average algorithm, while detecting and
 * filtering out spike values and filling null/undefined values
 *
 * @param data input data array
 * @param keys array of numeric property names to process
 * @param alpha smoothing factor
 * @param windowSize spike-detection window size
 * @param spikeThreshold spike threshold
 */
export function cutPeakValues(
  data: AnyRecord[],
  keys: string[],
  alpha: number = 0.3,
  windowSize: number = 15,
  spikeThreshold: number = 0.3,
): AnyRecord[] {
  if (!data || data.length === 0)
    return data

  const result: AnyRecord[] = [...data]
  const halfWindow = Math.floor(windowSize / 2)

  for (const key of keys) {
    // Step 1: detect and remove spike values
    for (let i = 0; i < result.length; i++) {
      const currentRow = result[i]
      if (!currentRow)
        continue
      const currentValue = currentRow[key]

      if (currentValue != null && typeof currentValue === 'number') {
        const neighborValues: number[] = []

        // Collect valid neighbor values within the window range
        for (
          let j = Math.max(0, i - halfWindow);
          j <= Math.min(result.length - 1, i + halfWindow);
          j++
        ) {
          if (j === i)
            continue
          const neighborRow = result[j]
          if (!neighborRow)
            continue
          const neighbor = neighborRow[key]
          if (neighbor != null && typeof neighbor === 'number') {
            neighborValues.push(neighbor)
          }
        }

        // If there are enough neighbor values for spike detection
        if (neighborValues.length >= 2) {
          const neighborSum = neighborValues.reduce((sum, val) => sum + val, 0)
          const neighborMean = neighborValues.length > 0 ? neighborSum / neighborValues.length : 0

          // Detect spikes
          if (neighborMean > 0) {
            const relativeChange = Math.abs(currentValue - neighborMean) / neighborMean
            if (relativeChange > spikeThreshold) {
              result[i] = { ...currentRow, [key]: null }
            }
          }
          else if (Math.abs(currentValue) > 10) {
            result[i] = { ...currentRow, [key]: null }
          }
        }
      }
    }

    // Step 2: smooth and fill using EWMA
    let ewma: number | null = null

    for (let i = 0; i < result.length; i++) {
      const row = result[i]
      if (!row)
        continue
      const currentValue = row[key]

      if (currentValue != null && typeof currentValue === 'number') {
        if (ewma === null) {
          ewma = currentValue
        }
        else {
          ewma = alpha * currentValue + (1 - alpha) * ewma
        }
        result[i] = { ...row, [key]: ewma }
      }
      else if (ewma !== null) {
        result[i] = { ...row, [key]: ewma }
      }
    }
  }

  return result
}
