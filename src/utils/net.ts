/**
 * Fetch with an abort-based timeout. Generic network helper shared by
 * modules that need a bounded request (e.g. the world map GeoJSON loader).
 */
export async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  }
  finally {
    window.clearTimeout(timeoutId)
  }
}
