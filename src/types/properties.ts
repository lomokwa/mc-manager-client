export interface ServerProperties {
  'enable-jmx-monitoring': boolean
  'rcon.port': number
  'level-seed': string
  gamemode: string
  'enable-command-block': boolean
  'enable-query': boolean
  'generator-settings': string
  'enforce-secure-profile': boolean
  'level-name': string
  motd: string
  'query.port': number
  pvp: boolean
  'generate-structures': boolean
  'max-chained-neighbor-updates': number
  difficulty: string
  'network-compression-threshold': number
  'max-tick-time': number
  'require-resource-pack': boolean
  'use-native-transport': boolean
  'max-players': number
  'online-mode': boolean
  'enable-status': boolean
  'allow-flight': boolean
  'initial-disabled-packs': string
  'broadcast-rcon-to-ops': boolean
  'view-distance': number
  'server-ip': string
  'resource-pack-prompt': string
  'allow-nether': boolean
  'server-port': number
  'enable-rcon': boolean
  'sync-chunk-writes': boolean
  'op-permission-level': number
  'prevent-proxy-connections': boolean
  'hide-online-players': boolean
  'resource-pack': string
  'entity-broadcast-range-percentage': number
  'simulation-distance': number
  'rcon.password': string
  'player-idle-timeout': number
  'force-gamemode': boolean
  'rate-limit': number
  hardcore: boolean
  'white-list': boolean
  'broadcast-console-to-ops': boolean
  'spawn-npcs': boolean
  'spawn-animals': boolean
  'log-ips': boolean
  'function-permission-level': number
  'initial-enabled-packs': string
  'level-type': string
  'text-filtering-config': string
  'spawn-monsters': boolean
  'enforce-whitelist': boolean
  'spawn-protection': number
  'resource-pack-sha1': string
  'max-world-size': number
}

export type PropertyField = {
  key: keyof ServerProperties
  label: string
  type: 'boolean' | 'number' | 'string' | 'select'
  options?: { value: string; label: string }[]
}

export const defaultProperties: ServerProperties = {
  'enable-jmx-monitoring': false,
  'rcon.port': 25575,
  'level-seed': '',
  gamemode: 'survival',
  'enable-command-block': false,
  'enable-query': false,
  'generator-settings': '{}',
  'enforce-secure-profile': true,
  'level-name': 'world',
  motd: 'A Minecraft Server',
  'query.port': 25565,
  pvp: true,
  'generate-structures': true,
  'max-chained-neighbor-updates': 1000000,
  difficulty: 'easy',
  'network-compression-threshold': 256,
  'max-tick-time': 60000,
  'require-resource-pack': false,
  'use-native-transport': true,
  'max-players': 20,
  'online-mode': true,
  'enable-status': true,
  'allow-flight': false,
  'initial-disabled-packs': '',
  'broadcast-rcon-to-ops': true,
  'view-distance': 10,
  'server-ip': '',
  'resource-pack-prompt': '',
  'allow-nether': true,
  'server-port': 25565,
  'enable-rcon': false,
  'sync-chunk-writes': true,
  'op-permission-level': 4,
  'prevent-proxy-connections': false,
  'hide-online-players': false,
  'resource-pack': '',
  'entity-broadcast-range-percentage': 100,
  'simulation-distance': 10,
  'rcon.password': '',
  'player-idle-timeout': 0,
  'force-gamemode': false,
  'rate-limit': 0,
  hardcore: false,
  'white-list': false,
  'broadcast-console-to-ops': true,
  'spawn-npcs': true,
  'spawn-animals': true,
  'log-ips': true,
  'function-permission-level': 2,
  'initial-enabled-packs': 'vanilla',
  'level-type': 'minecraft\\:normal',
  'text-filtering-config': '',
  'spawn-monsters': true,
  'enforce-whitelist': false,
  'spawn-protection': 16,
  'resource-pack-sha1': '',
  'max-world-size': 29999984,
}

export const propertyFields: PropertyField[] = [
  { key: 'server-port', label: 'Server Port', type: 'number' },
  { key: 'server-ip', label: 'Server IP', type: 'string' },
  { key: 'max-players', label: 'Max Players', type: 'number' },
  { key: 'motd', label: 'Message of the Day', type: 'string' },
  { key: 'level-name', label: 'Level Name', type: 'string' },
  { key: 'level-seed', label: 'Level Seed', type: 'string' },
  { key: 'level-type', label: 'Level Type', type: 'select', options: [
    { value: 'minecraft\\:normal', label: 'Normal' },
    { value: 'minecraft\\:flat', label: 'Flat' },
    { value: 'minecraft\\:large_biomes', label: 'Large Biomes' },
    { value: 'minecraft\\:amplified', label: 'Amplified' },
    { value: 'minecraft\\:single_biome_surface', label: 'Single Biome' },
  ] },
  { key: 'gamemode', label: 'Gamemode', type: 'select', options: [
    { value: 'survival', label: 'Survival' },
    { value: 'creative', label: 'Creative' },
    { value: 'adventure', label: 'Adventure' },
    { value: 'spectator', label: 'Spectator' },
  ] },
  { key: 'difficulty', label: 'Difficulty', type: 'select', options: [
    { value: 'peaceful', label: 'Peaceful' },
    { value: 'easy', label: 'Easy' },
    { value: 'normal', label: 'Normal' },
    { value: 'hard', label: 'Hard' },
  ] },
  { key: 'hardcore', label: 'Hardcore', type: 'boolean' },
  { key: 'force-gamemode', label: 'Force Gamemode', type: 'boolean' },
  { key: 'pvp', label: 'PvP', type: 'boolean' },
  { key: 'online-mode', label: 'Online Mode', type: 'boolean' },
  { key: 'allow-flight', label: 'Allow Flight', type: 'boolean' },
  { key: 'allow-nether', label: 'Allow Nether', type: 'boolean' },
  { key: 'generate-structures', label: 'Generate Structures', type: 'boolean' },
  { key: 'spawn-npcs', label: 'Spawn NPCs', type: 'boolean' },
  { key: 'spawn-animals', label: 'Spawn Animals', type: 'boolean' },
  { key: 'spawn-monsters', label: 'Spawn Monsters', type: 'boolean' },
  { key: 'spawn-protection', label: 'Spawn Protection Radius', type: 'number' },
  { key: 'view-distance', label: 'View Distance', type: 'number' },
  { key: 'simulation-distance', label: 'Simulation Distance', type: 'number' },
  { key: 'max-world-size', label: 'Max World Size', type: 'number' },
  { key: 'max-tick-time', label: 'Max Tick Time (ms)', type: 'number' },
  { key: 'max-chained-neighbor-updates', label: 'Max Chained Neighbor Updates', type: 'number' },
  { key: 'network-compression-threshold', label: 'Network Compression Threshold', type: 'number' },
  { key: 'entity-broadcast-range-percentage', label: 'Entity Broadcast Range %', type: 'number' },
  { key: 'player-idle-timeout', label: 'Player Idle Timeout (min)', type: 'number' },
  { key: 'rate-limit', label: 'Rate Limit', type: 'number' },
  { key: 'op-permission-level', label: 'OP Permission Level', type: 'number' },
  { key: 'function-permission-level', label: 'Function Permission Level', type: 'number' },
  { key: 'white-list', label: 'Whitelist', type: 'boolean' },
  { key: 'enforce-whitelist', label: 'Enforce Whitelist', type: 'boolean' },
  { key: 'enable-command-block', label: 'Enable Command Blocks', type: 'boolean' },
  { key: 'enable-status', label: 'Enable Status', type: 'boolean' },
  { key: 'enable-query', label: 'Enable Query', type: 'boolean' },
  { key: 'query.port', label: 'Query Port', type: 'number' },
  { key: 'enable-rcon', label: 'Enable RCON', type: 'boolean' },
  { key: 'rcon.port', label: 'RCON Port', type: 'number' },
  { key: 'rcon.password', label: 'RCON Password', type: 'string' },
  { key: 'broadcast-rcon-to-ops', label: 'Broadcast RCON to OPs', type: 'boolean' },
  { key: 'broadcast-console-to-ops', label: 'Broadcast Console to OPs', type: 'boolean' },
  { key: 'enable-jmx-monitoring', label: 'Enable JMX Monitoring', type: 'boolean' },
  { key: 'enforce-secure-profile', label: 'Enforce Secure Profile', type: 'boolean' },
  { key: 'use-native-transport', label: 'Use Native Transport', type: 'boolean' },
  { key: 'sync-chunk-writes', label: 'Sync Chunk Writes', type: 'boolean' },
  { key: 'prevent-proxy-connections', label: 'Prevent Proxy Connections', type: 'boolean' },
  { key: 'hide-online-players', label: 'Hide Online Players', type: 'boolean' },
  { key: 'log-ips', label: 'Log IPs', type: 'boolean' },
  { key: 'require-resource-pack', label: 'Require Resource Pack', type: 'boolean' },
  { key: 'resource-pack', label: 'Resource Pack URL', type: 'string' },
  { key: 'resource-pack-sha1', label: 'Resource Pack SHA1', type: 'string' },
  { key: 'resource-pack-prompt', label: 'Resource Pack Prompt', type: 'string' },
  { key: 'generator-settings', label: 'Generator Settings', type: 'string' },
  { key: 'initial-enabled-packs', label: 'Initial Enabled Packs', type: 'string' },
  { key: 'initial-disabled-packs', label: 'Initial Disabled Packs', type: 'string' },
  { key: 'text-filtering-config', label: 'Text Filtering Config', type: 'string' },
]
