/**
 * OS Image Helper - returns an OS image path by matching against a string
 */

import { getApiAssetUrl } from '@/utils/api'

// OS matching config
interface OSConfig {
  name: string
  image: string
  keywords: string[]
}

const OS_NAME_SPLIT_REGEX = /[\s/]+/

// OS matching groups
const osConfigs: OSConfig[] = [
  {
    name: 'AlmaLinux',
    image: 'os-icons/os-alma.svg',
    keywords: ['alma', 'almalinux'],
  },
  {
    name: 'Alpine Linux',
    image: 'os-icons/os-alpine.webp',
    keywords: ['alpine', 'alpine linux'],
  },
  {
    name: 'Armbian',
    image: 'os-icons/os-armbian.png',
    keywords: ['armbox', 'armbian'],
  },
  {
    name: 'CentOS',
    image: 'os-icons/os-centos.svg',
    keywords: ['centos', 'cent os'],
  },
  {
    name: 'Debian',
    image: 'os-icons/os-debian.svg',
    keywords: ['debian', 'debian gnu/linux', 'deb'],
  },
  {
    name: 'Ubuntu',
    image: 'os-icons/os-ubuntu.svg',
    keywords: ['ubuntu', 'elementary'],
  },
  {
    name: 'Windows',
    image: 'os-icons/os-windows.svg',
    keywords: ['windows', 'win32', 'win64', 'win10', 'win11', 'win server', 'microsoft'],
  },
  {
    name: 'Arch Linux',
    image: 'os-icons/os-arch.svg',
    keywords: ['arch', 'archlinux', 'arch linux'],
  },
  {
    name: 'Kali Linux',
    image: 'os-icons/os-kail.svg',
    keywords: ['kail', 'kali', 'kali linux'],
  },
  {
    name: 'iStoreOS',
    image: 'os-icons/os-istore.png',
    keywords: ['istore', 'istoreos', 'istore os'],
  },
  {
    name: 'OpenWrt',
    image: 'os-icons/os-openwrt.svg',
    keywords: ['openwrt', 'open wrt', 'open-wrt', 'qwrt', 'kwrt'],
  },
  {
    name: 'ImmortalWrt',
    image: 'os-icons/os-openwrt.svg',
    keywords: ['immortalwrt', 'immortal', 'emmortal'],
  },
  {
    name: 'NixOS',
    image: 'os-icons/os-nix.svg',
    keywords: ['nixos', 'nix os', 'nix'],
  },
  {
    name: 'Rocky Linux',
    image: 'os-icons/os-rocky.svg',
    keywords: ['rocky', 'rocky linux'],
  },
  {
    name: 'Fedora',
    image: 'os-icons/os-fedora.svg',
    keywords: ['fedora'],
  },
  {
    name: 'openSUSE',
    image: 'os-icons/os-openSUSE.svg',
    keywords: ['opensuse', 'suse'],
  },
  {
    name: 'Gentoo',
    image: 'os-icons/os-gentoo.svg',
    keywords: ['gentoo'],
  },
  {
    name: 'Red Hat',
    image: 'os-icons/os-redhat.svg',
    keywords: ['redhat', 'rhel', 'red hat'],
  },
  {
    name: 'Linux Mint',
    image: 'os-icons/os-mint.svg',
    keywords: ['mint', 'linux mint'],
  },
  {
    name: 'Manjaro',
    image: 'os-icons/os-manjaro-.svg',
    keywords: ['manjaro'],
  },
  {
    name: 'Synology DSM',
    image: 'os-icons/os-synology.ico',
    keywords: ['synology', 'dsm', 'synology dsm'],
  },
  {
    name: 'Proxmox VE',
    image: 'os-icons/os-proxmox.ico',
    keywords: ['proxmox', 'proxmox ve', 'pve'],
  },
  {
    name: 'macOS',
    image: 'os-icons/os-macos.svg',
    keywords: ['macos', 'mac os', 'darwin', 'os x'],
  },
  {
    name: 'Alibaba Cloud Linux',
    image: 'os-icons/os-alibaba.svg',
    keywords: ['alibaba', 'aliyun', 'alinux', 'anolis', 'openanolis', '阿里', '龙蜥'],
  },
  {
    name: 'OpenCloudOS',
    image: 'os-icons/os-opencloud.svg',
    keywords: ['opencloud', 'opencloudos', 'opencloud os'],
  },
]

// Default config
const defaultOSConfig: OSConfig = {
  name: 'Unknown',
  image: 'os-icons/os-unknown.svg',
  keywords: ['unknown'],
}

/**
 * Find the matching OS config for an input string
 * @param osString - OS-related string
 * @returns The matching OS config, or the default config if none matches
 */
function findOSConfig(osString: string): OSConfig {
  if (!osString) {
    return defaultOSConfig
  }

  const normalizedInput = osString.toLowerCase().trim()

  // Iterate over the matching configs
  for (const config of osConfigs) {
    for (const keyword of config.keywords) {
      if (normalizedInput.includes(keyword)) {
        return config
      }
    }
  }

  // Return the default config if nothing matched
  return defaultOSConfig
}

/**
 * Return the OS image path matching an input string
 * @param osString - OS-related string
 * @returns The matching OS image path, or the default image if none matches
 */
export function getOSImage(osString: string, apiIndex = 0): string {
  return getApiAssetUrl(findOSConfig(osString).image, apiIndex)
}

/**
 * Get all available OS images
 * @returns A map of all OS images
 */
export function getAllOSImages(apiIndex = 0): Record<string, string> {
  const imageMap: Record<string, string> = {}

  osConfigs.forEach((config) => {
    const key = config.keywords[0] // Use the first keyword as the key
    if (key)
      imageMap[key] = getApiAssetUrl(config.image, apiIndex)
  })

  imageMap.unknown = getApiAssetUrl(defaultOSConfig.image, apiIndex)

  return imageMap
}

/**
 * Return the OS name matching an input string
 * @param osString - OS-related string
 * @returns The matching OS name
 */
export function getOSName(osString: string): string {
  const config = findOSConfig(osString)

  // If a specific OS matched, return its name
  if (config !== defaultOSConfig) {
    return config.name
  }

  // If nothing matched, extract a name from the input string
  if (!osString) {
    return 'Unknown'
  }

  // Split on whitespace or slash and take the first part
  const parts = osString.trim().split(OS_NAME_SPLIT_REGEX)
  return parts[0] || 'Unknown'
}

/**
 * Check whether the OS is supported
 * @param osString - OS-related string
 * @returns Whether the OS is supported
 */
export function isSupportedOS(osString: string): boolean {
  if (!osString)
    return false

  const config = findOSConfig(osString)
  return config !== defaultOSConfig
}
