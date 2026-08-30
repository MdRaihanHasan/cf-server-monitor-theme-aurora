import type { Client, NodeStatus, NodeStatusPing } from '@/utils/rpc'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { parseNodeGroups } from '@/utils/groupHelper'

/** Traffic-limit type */
export type TrafficLimitType = 'up' | 'down' | 'min' | 'max' | 'sum'

export interface PingHistoryPoint {
  time: string
  latency: number | null
  loss: number | null
}

/** Complete node information (Client and Status merged) */
export interface NodeData {
  uuid: string
  source_id?: string
  source_index?: number
  // Client information
  name: string
  cpu_name: string
  virtualization: string
  kernel_version: string
  arch: string
  cpu_cores: number
  os: string
  boot_time: string
  gpu_name?: string
  gpu_info?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  price_configured?: boolean
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: TrafficLimitType
  created_at: string
  updated_at: string
  // Status information
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  net_monthly_up: number
  net_monthly_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
}

/** WebSocket connection state */
export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/** Status data (used for updates) */
interface StatusData {
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  net_monthly_up: number
  net_monthly_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
}

const EARTH_SNAPSHOT_INTERVAL_MS = 60_000

/** Home-page ping/loss history ingestion config (delivered by the backend's /api/config and /api/servers; falls back to the old behavior when absent) */
interface PingHistoryConfig {
  /** Backend show_three_net_details: whether to show/consume three-network latency and loss details (when false, cards/list hide the related info) */
  showThreeNetDetails: boolean
  /** latency_window.points: number of buckets to retain */
  points: number
  /** latency_window.hours: window duration (hours); bucket length = hours / points */
  hours: number
}

const PING_HISTORY_DEFAULTS: PingHistoryConfig = {
  // Old backend has no latency_window / show_three_net_details: 30 buckets x 2 minutes = 1 hour
  showThreeNetDetails: true,
  points: 30,
  hours: 1,
}

const useNodesStore = defineStore('nodes', () => {
  // ===== State =====
  const nodes = ref<NodeData[]>([])
  const earthNodes = ref<NodeData[]>([])
  const pingHistoryByUuid = ref<Record<string, PingHistoryPoint[]>>({})
  const wsConnectionState = ref<WsConnectionState>('disconnected')
  const wsReconnectAttempts = ref<number>(0)
  const pingHistoryConfig = ref<PingHistoryConfig>({ ...PING_HISTORY_DEFAULTS })
  let lastEarthSnapshotAt = 0

  // ===== Computed =====
  /** Number of online nodes */
  const onlineCount = computed(() => nodes.value.filter(n => n.online).length)

  /** Total number of nodes */
  const totalCount = computed(() => nodes.value.length)

  /** All groups */
  const groups = computed(() => {
    const groupSet = new Set<string>()
    nodes.value.forEach((n) => {
      parseNodeGroups(n.group).forEach(group => groupSet.add(group))
    })
    return Array.from(groupSet)
  })

  /** Node map indexed by UUID */
  const nodesByUuid = computed(() => {
    const map = new Map<string, NodeData>()
    nodes.value.forEach((n) => {
      map.set(n.uuid, n)
    })
    return map
  })

  /** Backend show_three_net_details: when false, cards/list hide three-network latency and loss info */
  const showThreeNetDetails = computed(() => pingHistoryConfig.value.showThreeNetDetails)

  // ===== Methods =====

  /**
   * Create node data from a Client object
   */
  function createNodeFromClient(client: Client): NodeData {
    return {
      uuid: client.uuid,
      source_id: client.source_id,
      source_index: client.source_index,
      name: client.name,
      cpu_name: client.cpu_name,
      virtualization: client.virtualization,
      kernel_version: client.kernel_version,
      arch: client.arch,
      cpu_cores: client.cpu_cores,
      os: client.os,
      boot_time: client.boot_time,
      gpu_name: client.gpu_name,
      gpu_info: client.gpu_info,
      ipv4: client.ipv4,
      ipv6: client.ipv6,
      region: client.region,
      remark: client.remark,
      public_remark: client.public_remark,
      mem_total: client.mem_total,
      swap_total: client.swap_total,
      disk_total: client.disk_total,
      version: client.version,
      weight: client.weight,
      price: client.price,
      price_configured: client.price_configured,
      billing_cycle: client.billing_cycle,
      auto_renewal: client.auto_renewal,
      currency: client.currency,
      expired_at: client.expired_at,
      group: client.group,
      tags: client.tags,
      hidden: client.hidden,
      traffic_limit: client.traffic_limit,
      traffic_limit_type: client.traffic_limit_type as TrafficLimitType,
      created_at: client.created_at,
      updated_at: client.updated_at,
      // Status defaults
      online: false,
      time: '',
      cpu: 0,
      gpu: 0,
      ram: 0,
      swap: 0,
      load: 0,
      load5: 0,
      load15: 0,
      temp: 0,
      disk: 0,
      net_in: 0,
      net_out: 0,
      net_total_up: 0,
      net_total_down: 0,
      net_monthly_up: 0,
      net_monthly_down: 0,
      process: 0,
      connections: 0,
      connections_udp: 0,
      uptime: 0,
      ping: undefined,
    }
  }

  /**
   * Update a node's status data
   */
  function updateNodeStatus(node: NodeData, status: StatusData): NodeData {
    return {
      ...node,
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      net_monthly_up: status.net_monthly_up,
      net_monthly_down: status.net_monthly_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
      ping: status.ping,
    }
  }

  /**
   * Extract status data from a NodeStatus
   */
  function extractStatusData(status: NodeStatus): StatusData {
    return {
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      net_monthly_up: status.net_monthly_up,
      net_monthly_down: status.net_monthly_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
      ping: status.ping,
    }
  }

  /** Window bucket length (milliseconds) under the current config; falls back to defaults when points/hours are invalid */
  function pingHistoryBucketMs(): number {
    const { points, hours } = pingHistoryConfig.value
    return Math.max(1, Math.round(hours * 3_600_000 / points))
  }

  /**
   * Adjust the ping-history ingestion strategy per backend config: showThreeNetDetails decides whether to consume the window, while points/hours decide the bucket length and number of retained entries.
   * Missing fields keep their default values (backward compatible with older backends).
   */
  function configurePingHistory(config: Partial<PingHistoryConfig>): void {
    const points = Number.isFinite(config.points) && (config.points ?? 0) > 0
      ? Math.round(config.points!)
      : PING_HISTORY_DEFAULTS.points
    const hours = Number.isFinite(config.hours) && (config.hours ?? 0) > 0
      ? config.hours!
      : PING_HISTORY_DEFAULTS.hours
    pingHistoryConfig.value = {
      showThreeNetDetails: config.showThreeNetDetails ?? PING_HISTORY_DEFAULTS.showThreeNetDetails,
      points,
      hours,
    }
  }

  /**
   * Record a single ping sample. Align status.time to the configured window bucket length, then upsert per bucket:
   * when a point for the same bucket exists, merge it (a valid new sample overwrites, an invalid one keeps the old value); otherwise insert the new bucket in time order and truncate to the configured bucket count.
   */
  function recordPingSample(uuid: string, status: NodeStatus): void {
    const sampleTime = Date.parse(status.time)
    if (!Number.isFinite(sampleTime))
      return

    const pingEntries = Object.values(status.ping ?? {})
    const latencyValues = pingEntries
      .map(entry => entry.latest)
      .filter(value => Number.isFinite(value) && value > 0)
    const lossValues = pingEntries
      .map(entry => entry.loss)
      .filter(value => Number.isFinite(value) && value >= 0)

    if (!latencyValues.length && !lossValues.length)
      return

    const bucketTs = Math.floor(sampleTime / pingHistoryBucketMs()) * pingHistoryBucketMs()
    const latency = latencyValues.length
      ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
      : null
    const loss = lossValues.length
      ? lossValues.reduce((sum, value) => sum + value, 0) / lossValues.length
      : null
    const bucketTime = new Date(bucketTs).toISOString()

    const history = pingHistoryByUuid.value[uuid] ?? []
    const point = history.find(item => item.time === bucketTime)
    if (point) {
      const nextLatency = latency ?? point.latency
      const nextLoss = loss ?? point.loss
      if (nextLatency === point.latency && nextLoss === point.loss)
        return
      pingHistoryByUuid.value = {
        ...pingHistoryByUuid.value,
        [uuid]: history.map(item => item === point
          ? { time: point.time, latency: nextLatency, loss: nextLoss }
          : item),
      }
      return
    }

    pingHistoryByUuid.value = {
      ...pingHistoryByUuid.value,
      [uuid]: [...history, { time: bucketTime, latency, loss }]
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .slice(-pingHistoryConfig.value.points),
    }
  }

  /**
   * Shared sampling snapshot for the Earth view, so globe / maps don't each maintain their own timer.
   */
  function refreshEarthNodes(force = false): void {
    const now = Date.now()
    if (!force && now - lastEarthSnapshotAt < EARTH_SNAPSHOT_INTERVAL_MS)
      return

    earthNodes.value = [...nodes.value]
    lastEarthSnapshotAt = now
  }

  /**
   * Initialize node data (first load)
   */
  function initNodes(clients: Record<string, Client>, statuses: Record<string, NodeStatus>): void {
    const uuids = Object.keys(clients)
    const existingUuids = new Set(nodes.value.map(n => n.uuid))

    // Update existing nodes or add new ones
    uuids.forEach((uuid) => {
      const client = clients[uuid]
      if (!client)
        return

      const status = statuses[uuid]
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (existingUuids.has(uuid) && index !== -1) {
        // Update an existing node
        const baseNode = createNodeFromClient(client)
        nodes.value[index] = status
          ? updateNodeStatus(baseNode, extractStatusData(status))
          : baseNode
      }
      else {
        // Add a new node
        const newNode = createNodeFromClient(client)
        nodes.value.push(status
          ? updateNodeStatus(newNode, extractStatusData(status))
          : newNode,
        )
      }

      if (status) {
        // When the switch is on and the backend returns a window, use it directly as history (it already includes the latest bucket);
        // otherwise (switch off / window missing) accumulate gradually from real-time samples using individual ping values
        if (pingHistoryConfig.value.showThreeNetDetails && status.pingWindow?.length) {
          pingHistoryByUuid.value = {
            ...pingHistoryByUuid.value,
            [uuid]: status.pingWindow.slice(-pingHistoryConfig.value.points),
          }
        }
        else {
          recordPingSample(uuid, status)
        }
      }
    })

    // Remove nodes that no longer exist
    const newUuids = new Set(uuids)
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // Sort by weight descending (larger weight comes first)
    sortNodesByWeight()
    refreshEarthNodes(true)
  }

  /**
   * Sort nodes by weight ascending (smaller weight comes first)
   */
  function sortNodesByWeight(): void {
    nodes.value.sort((a, b) => a.weight - b.weight)
  }

  /**
   * Update node status (real-time update)
   */
  function updateNodeStatuses(statuses: Record<string, NodeStatus>, trackPing = true): void {
    let hasChanges = false

    Object.entries(statuses).forEach(([uuid, status]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)
      if (index === -1)
        return

      const node = nodes.value[index]
      if (!node)
        return

      nodes.value[index] = updateNodeStatus(node, extractStatusData(status))
      if (trackPing)
        recordPingSample(uuid, status)
      hasChanges = true
    })

    if (hasChanges)
      refreshEarthNodes()
  }

  /**
   * Update nodes' basic information
   */
  function updateNodeClients(clients: Record<string, Client>): void {
    const newUuids = new Set(Object.keys(clients))

    // Update existing node info or add new nodes
    Object.entries(clients).forEach(([uuid, client]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (index !== -1) {
        // Update the existing node while preserving its status info
        const currentNode = nodes.value[index]
        if (!currentNode)
          return

        const baseNode = createNodeFromClient(client)
        nodes.value[index] = updateNodeStatus(baseNode, {
          online: currentNode.online,
          time: currentNode.time,
          cpu: currentNode.cpu,
          gpu: currentNode.gpu,
          ram: currentNode.ram,
          swap: currentNode.swap,
          load: currentNode.load,
          load5: currentNode.load5,
          load15: currentNode.load15,
          temp: currentNode.temp,
          disk: currentNode.disk,
          net_in: currentNode.net_in,
          net_out: currentNode.net_out,
          net_total_up: currentNode.net_total_up,
          net_total_down: currentNode.net_total_down,
          net_monthly_up: currentNode.net_monthly_up,
          net_monthly_down: currentNode.net_monthly_down,
          process: currentNode.process,
          connections: currentNode.connections,
          connections_udp: currentNode.connections_udp,
          uptime: currentNode.uptime,
          ping: currentNode.ping,
        })
      }
      else {
        // Add a new node (without status)
        nodes.value.push(createNodeFromClient(client))
      }
    })

    // Remove nodes that no longer exist
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // Sort by weight descending
    sortNodesByWeight()
    refreshEarthNodes(true)
  }

  /**
   * Update the WebSocket connection state
   */
  function updateWsState(state: WsConnectionState, attempts?: number): void {
    wsConnectionState.value = state
    if (attempts !== undefined) {
      wsReconnectAttempts.value = attempts
    }
  }

  /**
   * Clear all node data
   */
  function clearNodes(): void {
    nodes.value = []
    pingHistoryByUuid.value = {}
    refreshEarthNodes(true)
  }

  return {
    // State
    nodes,
    earthNodes,
    pingHistoryByUuid,
    wsConnectionState,
    wsReconnectAttempts,
    // Computed
    onlineCount,
    totalCount,
    groups,
    nodesByUuid,
    showThreeNetDetails,
    // Methods
    initNodes,
    updateNodeStatuses,
    recordPingSample,
    configurePingHistory,
    updateNodeClients,
    sortNodesByWeight,
    updateWsState,
    clearNodes,
  }
})

export { useNodesStore }
