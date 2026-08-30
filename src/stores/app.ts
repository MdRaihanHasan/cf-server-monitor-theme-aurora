import type { EarthViewMode, NodeViewMode, PublicSettings, ThemeMode } from '@/utils/api'
import type { ByteDecimalsConfig } from '@/utils/helper'
import { usePreferredDark, useStorageAsync } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type { ThemeMode }
type Lang = 'zh-CN' | 'en-US'

/** Fixed byte-precision configuration */
const BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
}

function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

const useAppStore = defineStore('app', () => {
  const loading = ref<boolean>(true)

  // Uses VueUse's useStorageAsync for automatic persistence; null means the user has not chosen manually, so fall back to the server's default theme mode
  const storedThemeMode = useStorageAsync<ThemeMode | null>('themeMode', null, localStorage)
  const lang = ref<Lang>('en-US')
  const publicSettings = ref<PublicSettings>()
  const nodeSelectedGroup = useStorageAsync<string>('nodeSelectedGroup', 'all', localStorage)
  const isLoggedIn = ref<boolean>(false)
  const connectionError = ref<boolean>(false)

  // Remembered home-page scroll position
  const homeScrollPosition = ref<number>(0)

  // null means not set; wait for the theme config to load before deciding
  const storedViewMode = useStorageAsync<NodeViewMode | null>('nodeViewMode', null, localStorage)

  // Computed: default view mode from the theme config
  const defaultViewMode = computed<NodeViewMode>(() => {
    return publicSettings.value?.themeSettings.defaultViewMode ?? 'card'
  })

  // Computed: default theme mode from the theme config
  const defaultThemeMode = computed<ThemeMode>(() => {
    return publicSettings.value?.themeSettings.defaultThemeMode ?? 'auto'
  })

  // Validate whether the view mode is a legal value
  function isValidViewMode(value: string | null): value is NodeViewMode {
    return value === 'card' || value === 'list'
  }

  // The view mode actually in use
  const nodeViewMode = computed<NodeViewMode>({
    get: () => {
      // Validate storedViewMode; fall back to the default when it is not a legal value
      if (storedViewMode.value !== null && isValidViewMode(storedViewMode.value)) {
        return storedViewMode.value
      }
      return defaultViewMode.value
    },
    set: (val) => {
      storedViewMode.value = val
    },
  })

  // Byte-formatting precision (fixed configuration)
  const byteDecimals: ByteDecimalsConfig = { ...BYTE_DECIMALS }

  // Computed: announcement configuration
  const alertEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.alertEnabled ?? false
  })

  const alertTitle = computed<string>(() => {
    return publicSettings.value?.themeSettings.alertTitle ?? ''
  })

  const alertContent = computed<string>(() => {
    return publicSettings.value?.themeSettings.alertContent ?? ''
  })

  const visitorCountryCode = ref<string | null>(null)

  const earthViewMode = computed<EarthViewMode>(() => {
    return publicSettings.value?.themeSettings.earthViewMode ?? 'earth'
  })

  const visitorInfoCardEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.visitorInfoCardEnabled ?? true
  })

  const hideAdminEntryWhenLoggedOut = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.hideAdminEntryWhenLoggedOut ?? false
  })

  const disablePageAnimation = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.disablePageAnimation ?? false
  })

  // Computed: offline nodes last (in the default order, offline nodes sort to the end of all nodes)
  const offlineNodesLast = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.offlineNodesLast ?? false
  })

  // Computed: ICP filing configuration
  const icpEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.icpEnabled ?? false
  })

  const icpNumber = computed<string>(() => {
    return publicSettings.value?.themeSettings.icpNumber ?? ''
  })

  const icpUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.icpUrl || 'https://beian.miit.gov.cn/'
  })

  // Computed: public-security filing configuration
  const policeEnabled = computed<boolean>(() => {
    return publicSettings.value?.themeSettings.policeEnabled ?? false
  })

  const policeNumber = computed<string>(() => {
    return publicSettings.value?.themeSettings.policeNumber ?? ''
  })

  const policeUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.policeUrl ?? ''
  })

  /**
   * The newer backend injects the site background directly as the body's background-image (or body::after in the iOS special case).
   * Detect it once on page load; if the injection is present, treat the background as enabled.
   */
  const injectedBodyBackground = ref((() => {
    if (typeof document === 'undefined')
      return false
    const body = getComputedStyle(document.body)
    if (body.backgroundImage && body.backgroundImage !== 'none')
      return true
    const after = getComputedStyle(document.body, '::after')
    return !!(after.backgroundImage && after.backgroundImage !== 'none')
  })())

  // Computed: custom background configuration
  const backgroundEnabled = computed<boolean>(() => {
    return (publicSettings.value?.themeSettings.backgroundEnabled ?? false) || injectedBodyBackground.value
  })

  const backgroundType = computed<'image' | 'video'>(() => {
    return publicSettings.value?.themeSettings.backgroundType ?? 'image'
  })

  const lightBackgroundUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.lightBackgroundUrl ?? ''
  })

  const darkBackgroundUrl = computed<string>(() => {
    return publicSettings.value?.themeSettings.darkBackgroundUrl ?? ''
  })

  const backgroundBlur = computed<number>(() => {
    return publicSettings.value?.themeSettings.backgroundBlur ?? 0
  })

  const backgroundOverlay = computed<number>(() => {
    return publicSettings.value?.themeSettings.backgroundOverlay ?? 0
  })

  // After publicSettings loads, use the default when localStorage has no saved view mode or holds an illegal value
  watch(publicSettings, (settings) => {
    if (settings && !isValidViewMode(storedViewMode.value)) {
      // Triggering the computed setter automatically saves to localStorage
      storedViewMode.value = defaultViewMode.value
    }
  }, { immediate: true })

  // Use VueUse's usePreferredDark to detect the system theme preference
  const prefersDark = usePreferredDark()

  // Validate the stored theme mode; clear it on an illegal value and fall back to the default theme mode
  watch(storedThemeMode, (mode) => {
    if (mode !== null && !isValidThemeMode(mode)) {
      storedThemeMode.value = null
    }
  }, { immediate: true })

  // The theme mode actually in use: a manual user choice takes priority, otherwise the server's default theme mode
  const themeMode = computed<ThemeMode>({
    get: () => {
      if (storedThemeMode.value !== null && isValidThemeMode(storedThemeMode.value)) {
        return storedThemeMode.value
      }
      return defaultThemeMode.value
    },
    set: (val) => {
      storedThemeMode.value = val
    },
  })

  // Compute whether dark mode is currently active
  const isDark = computed(() => {
    if (themeMode.value === 'auto') {
      return prefersDark.value
    }
    return themeMode.value === 'dark'
  })

  const resolvedThemeMode = computed<'light' | 'dark'>(() => isDark.value ? 'dark' : 'light')

  // Computed: background URL for the current theme mode
  const currentBackgroundUrl = computed<string>(() => {
    if (!backgroundEnabled.value) {
      return ''
    }

    if (resolvedThemeMode.value === 'dark') {
      return darkBackgroundUrl.value
    }
    return lightBackgroundUrl.value
  })

  function updateThemeMode(mode?: ThemeMode) {
    if (mode) {
      themeMode.value = isValidThemeMode(mode) ? mode : 'auto'
      return
    }

    const nextMode: Record<ThemeMode, ThemeMode> = {
      auto: 'light',
      light: 'dark',
      dark: 'auto',
    }

    const currentMode = isValidThemeMode(themeMode.value) ? themeMode.value : 'auto'
    themeMode.value = nextMode[currentMode]
  }

  function updateLoginState(loggedIn: boolean) {
    isLoggedIn.value = loggedIn
  }

  return {
    loading,
    themeMode,
    isDark,
    resolvedThemeMode,
    lang,
    nodeSelectedGroup,
    nodeViewMode,
    defaultViewMode,
    defaultThemeMode,
    byteDecimals,
    alertEnabled,
    alertTitle,
    alertContent,
    earthViewMode,
    visitorInfoCardEnabled,
    visitorCountryCode,
    hideAdminEntryWhenLoggedOut,
    disablePageAnimation,
    offlineNodesLast,
    icpEnabled,
    icpNumber,
    icpUrl,
    policeEnabled,
    policeNumber,
    policeUrl,
    backgroundEnabled,
    injectedBodyBackground,
    backgroundType,
    lightBackgroundUrl,
    darkBackgroundUrl,
    currentBackgroundUrl,
    backgroundBlur,
    backgroundOverlay,
    isLoggedIn,
    publicSettings,
    connectionError,
    homeScrollPosition,
    updateThemeMode,
    updateLoginState,
  }
})

export { useAppStore }
