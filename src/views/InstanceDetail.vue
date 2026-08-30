<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { useBackgroundSurface } from '@/composables/useBackgroundSurface'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getApiAssetUrl } from '@/utils/api'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat } from '@/utils/helper'
import { subscribeNodeLive } from '@/utils/init'
import { getTrafficUsed, getTrafficUsedPercentage, showTrafficProgress } from '@/utils/nodeHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { hasIPv4, hasIPv6 } from '@/utils/tagHelper'
import { message } from '@/utils/message'

interface GpuInfo {
  id?: number | string
  name?: string
  info?: string
}

function parseGpuInfo(raw: string | undefined): GpuInfo[] {
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))

const route = useRoute()
const router = useRouter()

const appStore = useAppStore()
const { pickSurfaceClass } = useBackgroundSurface()
const nodesStore = useNodesStore()

let unsubscribeLive: (() => void) | null = null

function subscribeDetailLive(): void {
  unsubscribeLive?.()
  unsubscribeLive = null
  const uuid = String(route.params.id ?? '')
  if (uuid)
    unsubscribeLive = subscribeNodeLive(uuid)
}

onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'instant' })
  subscribeDetailLive()
})

onBeforeUnmount(() => {
  unsubscribeLive?.()
  unsubscribeLive = null
})

watch(() => route.params.id, subscribeDetailLive)

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute')

const data = computed(() => nodesStore.nodes.find(node => node.uuid === route.params.id))

interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}

interface MetricCard {
  label: string
  value: string
  unit?: string
  icon: string
  valueClass?: string
}

const metricCards = computed<MetricCard[]>(() => {
  if (!data.value)
    return []

  return [
    {
      label: 'CPU',
      value: `${(data.value.cpu ?? 0).toFixed(1)}`,
      unit: '%',
      icon: 'tabler:cpu',
    },
    {
      label: 'Memory',
      value: `${((data.value.ram ?? 0) / (data.value.mem_total || 1) * 100).toFixed(1)}`,
      unit: '%',
      icon: 'tabler:server-2',
    },
    {
      label: 'Disk',
      value: `${((data.value.disk ?? 0) / (data.value.disk_total || 1) * 100).toFixed(1)}`,
      unit: '%',
      icon: 'tabler:database',
    },
    {
      label: 'Processes',
      value: `${data.value.process ?? 0}`,
      unit: 'procs',
      icon: 'tabler:list-details',
    },
  ]
})

const gpuInfoList = computed(() => parseGpuInfo(data.value?.gpu_info))

const gpuDisplayText = computed(() => {
  const list = gpuInfoList.value
  if (list.length === 0)
    return data.value?.gpu_name || '-'
  return list.map((g) => {
    let text = g.name || `GPU #${g.id ?? ''}`
    if (g.info !== undefined && g.info !== null && g.info !== '') {
      const pct = Number.parseFloat(String(g.info))
      text += ` (${Number.isFinite(pct) ? `${pct.toFixed(1)}%` : g.info})`
    }
    return text
  }).join(' | ')
})

const hardwareInfo = computed<InfoItem[]>(() => [
  { label: 'CPU', value: data.value ? `${data.value.cpu_name} (x${data.value.cpu_cores})` : '-', icon: 'icon-park-outline:cpu' },
  { label: 'Architecture', value: data.value?.arch ?? '-', icon: 'icon-park-outline:application-two' },
  { label: 'Kernel', value: data.value?.kernel_version ?? '-', icon: 'icon-park-outline:server' },
  { label: 'GPU', value: gpuDisplayText.value, icon: 'icon-park-outline:video-one' },
])

const systemInfo = computed<InfoItem[]>(() => [
  { label: 'OS', value: data.value?.os ?? '-', icon: 'icon-park-outline:computer' },
  { label: 'Boot Time', value: formatDateTime(data.value?.boot_time), icon: 'icon-park-outline:time' },
  { label: 'Uptime', value: formatUptime(data.value?.uptime ?? 0), icon: 'icon-park-outline:timer' },
  { label: 'Last Report', value: formatDateTime(data.value?.time), icon: 'icon-park-outline:time' },
])

const storageInfo = computed<InfoItem[]>(() => [
  { label: 'Memory', value: formatBytes(data.value?.mem_total ?? 0), icon: 'icon-park-outline:memory' },
  { label: 'Swap', value: formatBytes(data.value?.swap_total ?? 0), icon: 'icon-park-outline:switch' },
  { label: 'Disk', value: formatBytes(data.value?.disk_total ?? 0), icon: 'icon-park-outline:hard-disk' },
])

const trafficUsed = computed(() => data.value ? getTrafficUsed(data.value) : 0)
const hasTrafficLimit = computed(() => data.value ? showTrafficProgress(data.value) : false)
const trafficUsedPercentage = computed(() => data.value ? getTrafficUsedPercentage(data.value) : 0)

const trafficUsageText = computed(() => {
  if (!hasTrafficLimit.value)
    return 'Unlimited'

  return `${formatBytes(trafficUsed.value)} / ${formatBytes(data.value?.traffic_limit ?? 0)}`
})

const trafficProgressStyle = computed(() => ({
  width: `${trafficUsedPercentage.value}%`,
}))

const runtimeStats = computed(() => {
  const node = data.value
  if (!node)
    return []
  const stats = [
    { label: 'Load (1m / 5m / 15m)', value: `${(node.load ?? 0).toFixed(2)} / ${(node.load5 ?? 0).toFixed(2)} / ${(node.load15 ?? 0).toFixed(2)}` },
    { label: 'TCP Connections', value: String(node.connections ?? 0) },
    { label: 'UDP Connections', value: String(node.connections_udp ?? 0) },
    { label: 'Processes', value: String(node.process ?? 0) },
  ]
  if ((node.temp ?? 0) > 0)
    stats.push({ label: 'Temperature', value: `${node.temp.toFixed(1)} °C` })
  return stats
})

const ipAddresses = computed(() => {
  const node = data.value
  const list: Array<{ label: string, value: string }> = []
  if (node && hasIPv4(node.ipv4))
    list.push({ label: 'IPv4', value: node.ipv4 as string })
  if (node && hasIPv6(node.ipv6))
    list.push({ label: 'IPv6', value: node.ipv6 as string })
  return list
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('Copied to clipboard')
  }
  catch {
    message.error('Copy failed')
  }
}
</script>

<template>
  <div class="instance-detail space-y-4">
    <div v-if="!data" class="p-4">
      <CardX
        class="border-none transition-all rounded-md"
        :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
      >
        <Empty description="Server not found or has been removed">
          <template #extra>
            <Button @click="router.push('/')">
              Back to Home
            </Button>
          </template>
        </Empty>
      </CardX>
    </div>

    <template v-else>
      <div class="px-4 flex gap-4 items-center">
        <Button variant="ghost" size="icon-sm" class="bg-background/50 hover:bg-background" @click="router.push('/')">
          <Icon icon="tabler:arrow-left" :width="16" :height="16" />
        </Button>
        <div class="text-lg font-bold flex gap-2 items-center">
          <img
            :src="getApiAssetUrl(`flags/${getRegionCode(data.region).toLowerCase()}.svg`, data.source_index)" :alt="getRegionDisplayName(data.region)"
            class="size-6 rounded-sm"
          >
          <span>{{ data.name }}</span>
        </div>
        <Badge :variant="data.online ? 'default' : 'destructive'" class="text-xs !rounded">
          {{ data.online ? 'Online' : 'Offline' }}
        </Badge>
      </div>

      <div class="px-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardX
          v-for="item in metricCards" :key="item.label" hoverable size="small"
          class="group h-full border-none transition-all rounded-md"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
          content-class="h-full !p-3"
        >
          <div class="flex h-full min-h-10 md:min-h-18 flex-col justify-between gap-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium tracking-wider text-muted-foreground">{{ item.label }}</span>
              <Icon
                :icon="item.icon" :width="20" :height="20"
                class="text-slate-500/25 transition-colors group-hover:text-slate-500"
              />
            </div>
            <div class="min-w-0 space-y-1">
              <div
                class="flex min-w-0 items-baseline gap-1 truncate font-semibold leading-none"
                :class="item.valueClass"
              >
                <span class="truncate text-base sm:text-2xl">{{ item.value }}</span>
                <span v-if="item.unit" class="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {{ item.unit }}
                </span>
              </div>
            </div>
          </div>
        </CardX>
      </div>

      <div class="px-4 gap-4 grid grid-cols-1 lg:grid-cols-2">
        <CardX
          title="Hardware" size="small"
          class="group h-full border-none transition-all rounded-md"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
        >
          <div class="gap-3 grid grid-cols-3">
            <div
              v-for="(item, index) in hardwareInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2" :class="!index && 'col-span-3'"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <span class="text-xs sm:text-sm break-all">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX
          title="System" size="small"
          class="group h-full border-none transition-all rounded-md"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
        >
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
            <div
              v-for="item in systemInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <div class="flex min-w-0 gap-2 items-center">
                <img
                  v-if="item.label === 'OS'" :src="getOSImage(data.os, data.source_index)" :alt="getOSName(data.os)"
                  class="size-5 shrink-0"
                >
                <span class="text-xs sm:text-sm break-all">
                  {{ item.value }}
                </span>
              </div>
            </div>
          </div>
        </CardX>

        <CardX
          title="Storage" size="small"
          class="group h-full border-none transition-all rounded-md"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
        >
          <div class="gap-3 grid grid-cols-3">
            <div
              v-for="item in storageInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <span class="text-xs sm:text-sm break-all">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX
          title="Network" size="small"
          class="group h-full border-none transition-all rounded-md"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
          content-class="pt-0"
        >
          <div class="gap-3 grid grid-cols-2">
            <div class="relative min-w-0 overflow-hidden rounded-sm bg-slate-500/5 p-2">
              <div
                v-if="hasTrafficLimit"
                class="absolute inset-y-0 left-0 rounded-sm bg-primary/10 pointer-events-none transition-[width] duration-300 ease-out"
                :style="trafficProgressStyle"
              />
              <div class="relative flex flex-col gap-1.5">
                <div class="flex gap-1 items-center text-muted-foreground">
                  <Icon icon="icon-park-outline:transfer-data" :width="14" :height="14" />
                  <span class="text-xs sm:text-sm">Total Traffic</span>
                  <div class="flex-1" />
                  <span class="hidden sm:block text-[11px] font-medium text-foreground/70">{{
                    formatBytes(data?.net_monthly_up ?? 0) }} / {{ formatBytes(data?.net_monthly_down ?? 0) }}</span>
                </div>
                <span class="text-xs sm:text-sm break-all">
                  {{ trafficUsageText }}
                </span>
              </div>
            </div>
            <div class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">Network Speed</span>
              </div>
              <span class="text-xs sm:text-sm break-all flex flex-row flex-wrap items-center gap-1">
                <Icon icon="tabler:chevron-up" width="12" height="12" />
                {{ formatBytesPerSecond(data?.net_out ?? 0) }}
                <span class="px-0.5" />
                <Icon icon="tabler:chevron-down" width="12" height="12" />
                {{ formatBytesPerSecond(data?.net_in ?? 0) }}
              </span>
            </div>
          </div>
        </CardX>

        <CardX
          title="Runtime" size="small"
          class="group h-full border-none transition-all rounded-md lg:col-span-2"
          :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xs')"
        >
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div
              v-for="stat in runtimeStats" :key="stat.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
            >
              <span class="text-xs text-muted-foreground">{{ stat.label }}</span>
              <span class="text-xs sm:text-sm break-all font-medium">{{ stat.value }}</span>
            </div>
            <button
              v-for="ip in ipAddresses" :key="ip.label" type="button"
              class="group/ip min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2 text-left transition-colors hover:bg-slate-500/10"
              @click="copyText(ip.value)"
            >
              <span class="flex items-center gap-1 text-xs text-muted-foreground">
                {{ ip.label }}
                <Icon icon="tabler:copy" :width="12" :height="12" class="opacity-0 transition-opacity group-hover/ip:opacity-70" />
              </span>
              <span class="text-xs sm:text-sm break-all font-medium">{{ ip.value }}</span>
            </button>
          </div>
        </CardX>
      </div>

      <LoadChart :uuid="data.uuid" class="px-4" />
      <PingChart :uuid="data.uuid" class="px-4" />
    </template>
  </div>
</template>
