import dayjs from 'dayjs'

/** Billing cycle type */
export type BillingCycleType = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'triennial' | 'quadrennial' | 'quinquennial' | 'once' | 'custom'

/** Expiry status type */
export type ExpireStatus = 'expired' | 'critical' | 'warning' | 'normal' | 'long_term'

/** Supported tag colors */
export type TagColor
  = | 'ruby'
    | 'gray'
    | 'gold'
    | 'bronze'
    | 'brown'
    | 'yellow'
    | 'amber'
    | 'orange'
    | 'tomato'
    | 'red'
    | 'crimson'
    | 'pink'
    | 'plum'
    | 'purple'
    | 'violet'
    | 'iris'
    | 'indigo'
    | 'blue'
    | 'cyan'
    | 'teal'
    | 'jade'
    | 'green'
    | 'grass'
    | 'lime'
    | 'mint'
    | 'sky'

/** List of all supported tag colors */
export const TAG_COLORS = [
  'ruby',
  'gray',
  'gold',
  'bronze',
  'brown',
  'yellow',
  'amber',
  'orange',
  'tomato',
  'red',
  'crimson',
  'pink',
  'plum',
  'purple',
  'violet',
  'iris',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'jade',
  'green',
  'grass',
  'lime',
  'mint',
  'sky',
] as const

/** Radix Themes color-to-HEX map (based on the light-mode step-9 palette) */
export const TAG_COLOR_HEX_MAP: Record<TagColor, string> = {
  ruby: '#E5484D',
  gray: '#8D8D8D',
  gold: '#E5C00D',
  bronze: '#C2853C',
  brown: '#AA6A38',
  yellow: '#F9D400',
  amber: '#F5B21A',
  orange: '#F97316',
  tomato: '#E54D2E',
  red: '#E5484D',
  crimson: '#E93D82',
  pink: '#E24D8C',
  plum: '#A855C2',
  purple: '#8E4EC6',
  violet: '#7C5DFA',
  iris: '#5B5BD6',
  indigo: '#6366F1',
  blue: '#0090FF',
  cyan: '#00A2C7',
  teal: '#12A594',
  jade: '#29A383',
  green: '#30A46C',
  grass: '#46A358',
  lime: '#84CC16',
  mint: '#4FD1C5',
  sky: '#00A6ED',
}

/** Billing cycle range config (in days) */
const BILLING_CYCLE_RANGES: Array<{ type: BillingCycleType, min: number, max: number }> = [
  { type: 'monthly', min: 27, max: 32 },
  { type: 'quarterly', min: 87, max: 95 },
  { type: 'semi_annual', min: 175, max: 185 },
  { type: 'annual', min: 360, max: 370 },
  { type: 'biennial', min: 720, max: 750 },
  { type: 'triennial', min: 1080, max: 1150 },
  { type: 'quadrennial', min: 1440, max: 1500 },
  { type: 'quinquennial', min: 1800, max: 1850 },
]

/** Expiry status threshold config (in days) */
const EXPIRE_THRESHOLDS = {
  critical: 7, // expiring within 7 days shows red
  warning: 15, // expiring within 15 days shows orange
  long_term: 36500, // about 100 years is treated as long-term
} as const

const TAG_COLOR_SUFFIX_REGEX = /<(\w+)>$/
const TAG_COLOR_SUFFIX_REMOVE_REGEX = /<\w+>$/
const TAG_SEPARATOR_REGEX = /[,;]/

/**
 * Parse the billing cycle type.
 * @param billingCycle Billing cycle in days
 * @returns Billing cycle type
 */
export function parseBillingCycleType(billingCycle: number): BillingCycleType {
  if (billingCycle === -1)
    return 'once'

  for (const range of BILLING_CYCLE_RANGES) {
    if (billingCycle >= range.min && billingCycle <= range.max) {
      return range.type
    }
  }

  return 'custom'
}

/**
 * Get the display text for a billing cycle.
 * @param billingCycle Billing cycle in days
 * @param lang Language
 * @returns Display text
 */
export function getBillingCycleText(billingCycle: number, lang: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const type = parseBillingCycleType(billingCycle)

  const texts: Record<BillingCycleType, Record<'zh-CN' | 'en-US', string>> = {
    monthly: { 'zh-CN': '月', 'en-US': 'Month' },
    quarterly: { 'zh-CN': '季', 'en-US': 'Quarter' },
    semi_annual: { 'zh-CN': '半年', 'en-US': 'Semi-Annual' },
    annual: { 'zh-CN': '年', 'en-US': 'Year' },
    biennial: { 'zh-CN': '两年', 'en-US': 'Biennial' },
    triennial: { 'zh-CN': '三年', 'en-US': 'Triennial' },
    quadrennial: { 'zh-CN': '四年', 'en-US': 'Quadrennial' },
    quinquennial: { 'zh-CN': '五年', 'en-US': 'Quinquennial' },
    once: { 'zh-CN': '一次性', 'en-US': 'Once' },
    custom: { 'zh-CN': `${billingCycle} 天`, 'en-US': `${billingCycle} Days` },
  }

  return texts[type][lang]
}

/**
 * Calculate the number of days until expiry.
 * @param expiredAt Expiry time (string or timestamp)
 * @returns Days until expiry; negative means already expired
 */
export function getDaysUntilExpired(expiredAt: string | number | undefined): number {
  if (!expiredAt)
    return 0

  const expiredDate = dayjs(expiredAt)
  const now = dayjs()

  if (!expiredDate.isValid())
    return 0

  return Math.round(expiredDate.diff(now, 'day', true))
}

/**
 * Get the expiry status.
 * @param expiredAt Expiry time
 * @returns Expiry status
 */
export function getExpireStatus(expiredAt: string | number | undefined): ExpireStatus {
  const days = getDaysUntilExpired(expiredAt)

  if (days <= 0)
    return 'expired'
  if (days < EXPIRE_THRESHOLDS.critical)
    return 'critical'
  if (days < EXPIRE_THRESHOLDS.warning)
    return 'warning'
  if (days > EXPIRE_THRESHOLDS.long_term)
    return 'long_term'
  return 'normal'
}

/**
 * Get the text color class for an expiry time.
 * @param expiredAt Expiry time
 * @returns Tailwind text color class
 */
export function getExpireTextClass(expiredAt: string | number | undefined): string {
  const status = getExpireStatus(expiredAt)

  if (status === 'expired' || status === 'critical')
    return 'text-destructive'
  if (status === 'warning')
    return 'text-yellow-600 dark:text-yellow-400'
  if (status === 'long_term')
    return 'text-muted-foreground'
  return 'text-teal-600 dark:text-teal-400'
}

/**
 * Format a node's remaining days using the native theme's signed short format.
 */
export function formatRemainingDays(expiredAt: string | number | undefined): string {
  const days = getDaysUntilExpired(expiredAt)
  if (getExpireStatus(expiredAt) === 'long_term')
    return 'Long-term'
  return `${days > 0 ? '+' : ''}${days} days`
}

/**
 * Get the display color for an expiry status (Naive UI color type).
 * @param status Expiry status
 * @returns Naive UI color type
 */
export function getExpireStatusColor(status: ExpireStatus): 'error' | 'warning' | 'success' | 'default' {
  switch (status) {
    case 'expired':
    case 'critical':
      return 'error'
    case 'warning':
      return 'warning'
    case 'normal':
    case 'long_term':
      return 'success'
    default:
      return 'default'
  }
}

/**
 * Get the HEX color value for an expiry status.
 * @param status Expiry status
 * @returns HEX color value
 */
export function getExpireStatusHexColor(status: ExpireStatus): string {
  switch (status) {
    case 'expired':
    case 'critical':
      return TAG_COLOR_HEX_MAP.tomato
    case 'warning':
      return TAG_COLOR_HEX_MAP.orange
    case 'normal':
      return TAG_COLOR_HEX_MAP.green
    case 'long_term':
      return TAG_COLOR_HEX_MAP.gray
    default:
      return TAG_COLOR_HEX_MAP.gray
  }
}

/**
 * Get the display text for an expiry time.
 * @param expiredAt Expiry time
 * @param lang Language
 * @returns Display text
 */
export function getExpireText(expiredAt: string | number | undefined, lang: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const days = getDaysUntilExpired(expiredAt)
  const status = getExpireStatus(expiredAt)

  if (status === 'expired') {
    return lang === 'zh-CN' ? '已过期' : 'Expired'
  }

  if (status === 'long_term') {
    return lang === 'zh-CN' ? '长期' : 'Long-term'
  }

  if (lang === 'zh-CN') {
    return `${days} 天`
  }
  return `${days} days`
}

/**
 * Parse a tag with an optional color suffix.
 * @param tag Tag string, supporting the format "text<color>"
 * @returns Parsed tag object
 */
export function parseTagWithColor(tag: string): { text: string, color: TagColor | null } {
  const colorMatch = tag.match(TAG_COLOR_SUFFIX_REGEX)
  if (colorMatch && colorMatch[1]) {
    const colorCandidate = colorMatch[1].toLowerCase()
    const text = tag.replace(TAG_COLOR_SUFFIX_REMOVE_REGEX, '')
    if ((TAG_COLORS as readonly string[]).includes(colorCandidate)) {
      return { text, color: colorCandidate as TagColor }
    }
  }
  return { text: tag, color: null }
}

/**
 * Get the HEX value for a tag color.
 * @param color Tag color
 * @returns HEX color value
 */
export function getTagColorHex(color: TagColor): string {
  return TAG_COLOR_HEX_MAP[color]
}

/**
 * Parse a tag string into a list of tags.
 * @param tags Tag string separated by commas or semicolons
 * @returns Array of tags
 */
export function parseTags(tags: string | undefined): Array<{ text: string, color: TagColor, hex: string }> {
  if (!tags || tags.trim() === '')
    return []

  const tagList = tags
    .split(TAG_SEPARATOR_REGEX)
    .map(tag => tag.trim())
    .filter(Boolean)

  return tagList.map((tag, index) => {
    const { text, color } = parseTagWithColor(tag)
    const defaultColor = TAG_COLORS[index % TAG_COLORS.length] ?? 'blue'
    const resolvedColor = color ?? defaultColor
    return {
      text,
      color: resolvedColor,
      hex: getTagColorHex(resolvedColor),
    }
  })
}

/**
 * Check whether an IPv4 address is present.
 */
export function hasIPv4(ipv4: string | undefined | null): boolean {
  return !!ipv4 && ipv4.trim() !== ''
}

/**
 * Check whether an IPv6 address is present.
 */
export function hasIPv6(ipv6: string | undefined | null): boolean {
  return !!ipv6 && ipv6.trim() !== ''
}
