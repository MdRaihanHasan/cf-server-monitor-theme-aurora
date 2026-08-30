<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, defineAsyncComponent, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackgroundSurface } from '@/composables/useBackgroundSurface'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { isNodeInGroup, parseNodeGroups } from '@/utils/groupHelper'
import { isRegionMatch } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const NodeCard = defineAsyncComponent(() => import('@/components/NodeCard.vue'))
const NodeGeneralCards = defineAsyncComponent(() => import('@/components/NodeGeneralCards.vue'))
const NodeList = defineAsyncComponent(() => import('@/components/NodeList.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))

const nodeItemStaggerMs = 35
const nodeItemStaggerLimit = 12

const appStore = useAppStore()
const { pickSurfaceClass } = useBackgroundSurface()
const nodesStore = useNodesStore()
const router = useRouter()

onActivated(() => {
  if (appStore.homeScrollPosition > 0) {
    nextTick(() => {
      window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' })
    })
  }
})

onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})

const searchText = ref('')
const debouncedSearchText = ref('')
const selectedPingNodeUuid = ref<string | null>(null)

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchText.value = value
}, 300)

watch(searchText, (value) => {
  updateDebouncedSearch(value)
})

const groups = computed(() => [
  { tab: 'All Nodes', name: 'all', count: nodesStore.nodes.length },
  ...nodesStore.groups.map(g => ({
    tab: g,
    name: g,
    count: nodesStore.nodes.filter(n => isNodeInGroup(n.group, g)).length,
  })),
])

const SORT_OPTIONS = [
  { key: 'default', label: 'Default' },
  { key: 'name', label: 'Name' },
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
  { key: 'network', label: 'Network' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'status', label: 'Status' },
] as const

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
] as const

function nodeSortValue(node: NodeData, key: string): number | string {
  switch (key) {
    case 'name': return node.name?.toLowerCase() ?? ''
    case 'cpu': return node.cpu ?? 0
    case 'memory': return (node.ram ?? 0) / (node.mem_total || 1)
    case 'disk': return (node.disk ?? 0) / (node.disk_total || 1)
    case 'network': return (node.net_out ?? 0) + (node.net_in ?? 0)
    case 'uptime': return node.uptime ?? 0
    case 'status': return node.online ? 1 : 0
    default: return 0
  }
}

function toggleSortDir() {
  appStore.nodeSortDir = appStore.nodeSortDir === 'asc' ? 'desc' : 'asc'
}

watch(
  () => nodesStore.groups,
  (gs) => {
    const cur = appStore.nodeSelectedGroup
    if (cur !== 'all' && !gs.includes(cur)) {
      appStore.nodeSelectedGroup = 'all'
    }
  },
  { immediate: true },
)

function isNodeMatchSearch(node: typeof nodesStore.nodes[number], search: string): boolean {
  if (!search.trim())
    return true
  const lowerSearch = search.toLowerCase().trim()
  if (node.name.toLowerCase().includes(lowerSearch))
    return true
  if (node.region && isRegionMatch(node.region, search))
    return true
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true
  if (parseNodeGroups(node.group).some(group => group.toLowerCase().includes(lowerSearch)))
    return true
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true
  return false
}

const groupNodeList = computed(() => {
  return nodesStore.nodes.filter(node => isNodeInGroup(node.group, appStore.nodeSelectedGroup))
})

const sampledGroupNodeList = computed(() => {
  return nodesStore.earthNodes.filter(node => isNodeInGroup(node.group, appStore.nodeSelectedGroup))
})

const nodeList = computed(() => {
  let filtered = groupNodeList.value
  if (debouncedSearchText.value.trim()) {
    filtered = filtered.filter(n => isNodeMatchSearch(n, debouncedSearchText.value))
  }
  if (appStore.nodeStatusFilter === 'online')
    filtered = filtered.filter(n => n.online)
  else if (appStore.nodeStatusFilter === 'offline')
    filtered = filtered.filter(n => !n.online)

  const key = appStore.nodeSortKey
  if (key !== 'default') {
    const dir = appStore.nodeSortDir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const va = nodeSortValue(a, key)
      const vb = nodeSortValue(b, key)
      if (typeof va === 'string' || typeof vb === 'string')
        return dir * String(va).localeCompare(String(vb), 'en-US')
      return dir * ((va as number) - (vb as number))
    })
  }
  if (!appStore.offlineNodesLast)
    return filtered
  // Default order: online nodes first, offline nodes last, preserving original order within each group
  return [...filtered].sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1))
})

const selectedPingNode = computed(() => {
  if (!selectedPingNodeUuid.value)
    return null
  return nodesStore.nodes.find(node => node.uuid === selectedPingNodeUuid.value) ?? null
})

const pingDialogOpen = computed({
  get: () => selectedPingNode.value !== null,
  set: (open: boolean) => {
    if (!open)
      selectedPingNodeUuid.value = null
  },
})

function handleNodeClick(node: typeof nodesStore.nodes[number]) {
  router.push({
    name: 'instance-detail',
    params: { id: node.uuid },
    query: node.source_index === undefined ? undefined : { apiIndex: node.source_index },
  })
}

function handlePingClick(node: NodeData) {
  selectedPingNodeUuid.value = node.uuid
}

function getNodeItemTransitionKey(node: typeof nodesStore.nodes[number]): string {
  return `${appStore.nodeSelectedGroup}-${node.uuid}`
}

function getNodeItemTransitionStyle(index: number): Record<string, string> {
  return {
    '--node-item-delay': `${Math.min(index, nodeItemStaggerLimit) * nodeItemStaggerMs}ms`,
  }
}
</script>

<template>
  <div class="home-view">
    <div v-if="appStore.connectionError" class="alert px-4">
      <Alert
        variant="destructive"
        :class="pickSurfaceClass('border-none bg-red-400/10 rounded-md', 'border-none bg-red-400/10 backdrop-blur-xs rounded-md')"
      >
        <AlertTitle>Monitor Error</AlertTitle>
        <AlertDescription>Failed to connect to the server. Check your network or refresh the page and try again.</AlertDescription>
      </Alert>
    </div>

    <div v-if="appStore.alertEnabled && appStore.alertContent" class="alert px-4">
      <Alert :class="pickSurfaceClass('border-none bg-background rounded-md', 'border-none bg-background/60 backdrop-blur-xs rounded-md')">
        <AlertTitle v-if="appStore.alertTitle">
          {{ appStore.alertTitle }}
        </AlertTitle>
        <AlertDescription>
          <MarkdownRenderer :content="appStore.alertContent" />
        </AlertDescription>
      </Alert>
    </div>

    <NodeGeneralCards
      v-if="appStore.earthViewMode !== 'hide'"
      :nodes="groupNodeList"
      :globe-nodes="sampledGroupNodeList"
      :transition-key="appStore.nodeSelectedGroup"
    />

    <div class="node-info p-4 pt-0 flex flex-col gap-4 relative z-1 md:pointer-events-none" :class="appStore.earthViewMode === 'hide' && 'pt-4'">
      <div class="nodes">
        <Tabs v-model="appStore.nodeSelectedGroup" class="w-full flex-col gap-4">
          <div class="flex gap-2 items-start flex-nowrap">
            <div class="overflow-x-auto rounded-sm md:pointer-events-auto">
              <TabsList :class="pickSurfaceClass('w-max h-8 bg-background/60 rounded-md', 'w-max h-8 bg-background/50 backdrop-blur-xl rounded-md')">
                <TabsTrigger
                  v-for="g in groups" :key="g.name" :value="g.name"
                  class="h-6.5 flex-none shrink-0 text-xs border-none data-[state=active]:text-teal-600 shadow-none rounded-sm"
                >
                  {{ g.tab }}
                  <span class="ml-1 text-[10px] tabular-nums opacity-60">{{ g.count }}</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <div class="ml-auto search flex gap-2 items-center pointer-events-auto">
              <Button
                variant="outline" size="icon" aria-label="Card view"
                class="h-8 w-8 border-none shadow-none rounded-md"
                :class="[pickSurfaceClass('bg-background hover:bg-background/95', 'bg-background/50 hover:bg-background/60 backdrop-blur-xs'), appStore.nodeViewMode === 'card' ? '!text-teal-600 !bg-background' : '']"
                @click="appStore.nodeViewMode = 'card'"
              >
                <Icon icon="tabler:layout-grid" :width="14" :height="14" />
              </Button>
              <Button
                variant="outline" size="icon" aria-label="List view"
                class="h-8 w-8 border-none shadow-none rounded-md"
                :class="[pickSurfaceClass('bg-background hover:bg-background/95', 'bg-background/50 hover:bg-background/60 backdrop-blur-xs'), appStore.nodeViewMode === 'list' ? '!text-teal-600 !bg-background' : '']"
                @click="appStore.nodeViewMode = 'list'"
              >
                <Icon icon="tabler:table" :width="14" :height="14" />
              </Button>
              <div class="relative z-1 w-8 h-8">
                <div class="absolute top-0 right-0 ">
                  <Input
                    v-model="searchText" placeholder="Search by name, region, or OS"
                    class="h-8 w-8 rounded-md border-none shadow-none transition-all placeholder:text-transparent focus:!w-60 focus:!pl-7.5 focus:placeholder:!text-muted-foreground focus:!ring-teal-500/10"
                    :class="pickSurfaceClass('bg-background hover:!bg-background/95 focus:!bg-background', 'bg-background/50 hover:!bg-background/60 focus:!bg-background/80 backdrop-blur-xs')"
                  />
                  <Icon
                    icon="tabler:search" :width="14" :height="14"
                    class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 pointer-events-auto">
            <div
              class="inline-flex items-center gap-0.5 rounded-md p-0.5"
              :class="pickSurfaceClass('bg-background/60', 'bg-background/50 backdrop-blur-xs')"
            >
              <button
                v-for="opt in STATUS_OPTIONS" :key="opt.key" type="button"
                class="h-6 rounded-sm px-2.5 text-xs font-medium transition-colors"
                :class="appStore.nodeStatusFilter === opt.key ? 'bg-background text-teal-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="appStore.nodeStatusFilter = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="ml-auto flex items-center gap-1.5">
              <Icon icon="tabler:arrows-sort" :width="14" :height="14" class="text-muted-foreground" />
              <select
                v-model="appStore.nodeSortKey"
                aria-label="Sort nodes by"
                class="h-7 cursor-pointer rounded-md border-none px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:text-foreground"
                :class="pickSurfaceClass('bg-background/60', 'bg-background/50 backdrop-blur-xs')"
              >
                <option v-for="opt in SORT_OPTIONS" :key="opt.key" :value="opt.key">
                  {{ opt.label }}
                </option>
              </select>
              <Button
                variant="outline" size="icon" aria-label="Toggle sort direction"
                class="h-7 w-7 border-none shadow-none rounded-md"
                :class="pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background/60 backdrop-blur-xs')"
                :disabled="appStore.nodeSortKey === 'default'"
                @click="toggleSortDir"
              >
                <Icon :icon="appStore.nodeSortDir === 'asc' ? 'tabler:sort-ascending' : 'tabler:sort-descending'" :width="14" :height="14" />
              </Button>
            </div>
          </div>
          <TabsContent :key="appStore.nodeSelectedGroup" :value="appStore.nodeSelectedGroup" class="pointer-events-auto">
            <TransitionGroup
              v-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'"
              :appear="!appStore.disablePageAnimation"
              :css="!appStore.disablePageAnimation"
              name="node-card-switch"
              tag="div"
              class="gap-3 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]"
            >
              <div
                v-for="(node, index) in nodeList"
                :key="getNodeItemTransitionKey(node)"
                class="min-w-0"
                :style="getNodeItemTransitionStyle(index)"
              >
                <NodeCard :node="node" @click="handleNodeClick(node)" @ping-click="handlePingClick" />
              </div>
            </TransitionGroup>
            <NodeList
              v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'"
              :nodes="nodeList"
              :transition-key="appStore.nodeSelectedGroup"
              @click="handleNodeClick"
              @ping-click="handlePingClick"
            />
            <div v-else class="text-muted-foreground text-center py-8">
              <Empty description="No servers" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>

    <Dialog v-model:open="pingDialogOpen">
      <DialogContent
        v-if="selectedPingNode"
        class="max-w-6xl gap-0 overflow-hidden border-teal-600/10 p-0 shadow-[0_0_2rem] shadow-teal-800/10 transition-all"
        :class="pickSurfaceClass('bg-background', 'bg-background/60')"
      >
        <DialogHeader class="flex h-13 flex-row items-center px-4">
          <DialogTitle class="truncate">
            {{ selectedPingNode.name }} Latency / Loss
          </DialogTitle>
          <div class="absolute inset-0 mx-0 max-w-none overflow-hidden bg-slate-50 dark:bg-slate-900/50 -z-9 zoom-90">
            <div class="absolute top-0 left-1/2 -ml-152 h-100 w-325 dark:mask-[linear-gradient(white,transparent)]">
              <div
                class="absolute inset-0 bg-linear-to-r from-teal-500 to-cyan-300 mask-[radial-gradient(farthest-side_at_top,white,transparent)] opacity-40 dark:from-teal-500/30 dark:to-cyan-300/30 dark:opacity-100"
              >
                <svg
                  aria-hidden="true"
                  class="absolute inset-x-0 inset-y-[-50%] h-[200%] w-full skew-y-[-18deg] fill-black/40 stroke-black/50 mix-blend-overlay dark:fill-white/2.5 dark:stroke-white/5"
                >
                  <defs>
                    <pattern id="_S_1_" width="72" height="56" patternUnits="userSpaceOnUse" x="-12" y="4">
                      <path d="M.5 56V.5H72" fill="none" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" stroke-width="0" fill="url(#_S_1_)" /><svg
                    x="-12" y="4"
                    class="overflow-visible"
                  >
                    <rect stroke-width="0" width="73" height="57" x="288" y="168" />
                    <rect stroke-width="0" width="73" height="57" x="144" y="56" />
                    <rect stroke-width="0" width="73" height="57" x="504" y="168" />
                    <rect stroke-width="0" width="73" height="57" x="720" y="336" />
                  </svg>
                </svg>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div class="max-h-[calc(90vh-4rem)] overflow-y-auto p-4 pt-0">
          <PingChart :uuid="selectedPingNode.uuid" />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.node-card-switch-enter-active,
.node-card-switch-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms ease;
}

.node-card-switch-enter-active {
  transition-delay: var(--node-item-delay, 0ms);
}

.node-card-switch-move {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.node-card-switch-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(3px);
}

.node-card-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .node-card-switch-enter-active,
  .node-card-switch-leave-active,
  .node-card-switch-move {
    transition: none;
    transition-delay: 0ms;
  }

  .node-card-switch-enter-from,
  .node-card-switch-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
