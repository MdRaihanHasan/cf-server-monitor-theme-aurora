/**
 * Iconify collection pre-registration (optional)
 *
 * Default behavior: when a collection is not registered, `<Icon icon="icon-park-outline:sun" />`
 * fetches individual icon SVGs on demand from https://api.iconify.design (with browser caching).
 *
 * This function is kept as a hook for future expansion; currently it does no pre-registration,
 * to avoid bundling entire icon collections (1MB+ each) into the initial bundle.
 */
export async function setupIconify(): Promise<void> {
  // no-op: defer to the default CDN loading strategy of @iconify/vue
}
