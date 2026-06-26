// Maps player-management actions to the Minecraft server console commands that
// perform them. The commands are sent over the same console WebSocket the
// terminal uses, so no extra API surface is required.

export type PlayerAction =
  | 'op'
  | 'deop'
  | 'kick'
  | 'ban'
  | 'pardon'
  | 'whitelist-add'
  | 'whitelist-remove'

// Java-edition usernames are 3–16 chars of [A-Za-z0-9_]. Validating here keeps
// a name read from the API from ever turning into a multi-token command.
const VALID_NAME = /^\w{1,16}$/

const TEMPLATES: Record<PlayerAction, (name: string) => string> = {
  op: (n) => `op ${n}`,
  deop: (n) => `deop ${n}`,
  kick: (n) => `kick ${n}`,
  ban: (n) => `ban ${n}`,
  pardon: (n) => `pardon ${n}`,
  'whitelist-add': (n) => `whitelist add ${n}`,
  'whitelist-remove': (n) => `whitelist remove ${n}`,
}

/**
 * Build the console command for a player action, or return null when the name
 * isn't a valid Minecraft username (so the caller can refuse to send it).
 */
export function playerActionCommand(action: PlayerAction, name: string): string | null {
  if (!VALID_NAME.test(name)) return null
  return TEMPLATES[action](name)
}

// Human-readable confirmation shown after dispatching an action.
export const ACTION_LABELS: Record<PlayerAction, string> = {
  op: 'Opped',
  deop: 'De-opped',
  kick: 'Kicked',
  ban: 'Banned',
  pardon: 'Unbanned',
  'whitelist-add': 'Whitelisted',
  'whitelist-remove': 'Removed from whitelist',
}

// Actions worth a confirmation prompt before dispatching.
export const DESTRUCTIVE_ACTIONS: ReadonlySet<PlayerAction> = new Set<PlayerAction>(['ban', 'kick'])

// Collapse newlines/returns so a single free-text field can never smuggle a
// second console command onto its own line.
function sanitizeText(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').trim()
}

// --- Richer actions for the player detail panel ---------------------------
// Each returns null when an argument is invalid, so the caller can refuse to
// send a malformed command.

export function teleportToPlayerCommand(player: string, target: string): string | null {
  if (!VALID_NAME.test(player) || !VALID_NAME.test(target)) return null
  return `tp ${player} ${target}`
}

export function teleportToCoordsCommand(player: string, x: number, y: number, z: number): string | null {
  if (!VALID_NAME.test(player)) return null
  if (![x, y, z].every((n) => Number.isFinite(n))) return null
  return `tp ${player} ${x} ${y} ${z}`
}

export function kickCommand(player: string, reason?: string): string | null {
  if (!VALID_NAME.test(player)) return null
  const r = reason ? sanitizeText(reason) : ''
  return r ? `kick ${player} ${r}` : `kick ${player}`
}

export function banCommand(player: string, reason?: string): string | null {
  if (!VALID_NAME.test(player)) return null
  const r = reason ? sanitizeText(reason) : ''
  return r ? `ban ${player} ${r}` : `ban ${player}`
}

export function ipBanCommand(player: string, reason?: string): string | null {
  if (!VALID_NAME.test(player)) return null
  const r = reason ? sanitizeText(reason) : ''
  return r ? `ban-ip ${player} ${r}` : `ban-ip ${player}`
}

export function runAsCommand(player: string, command: string): string | null {
  if (!VALID_NAME.test(player)) return null
  // Drop a leading slash so both "say hi" and "/say hi" work.
  const cmd = sanitizeText(command).replace(/^\/+/, '')
  if (!cmd) return null
  return `execute as ${player} at ${player} run ${cmd}`
}

export const TELLRAW_COLORS = ['white', 'yellow', 'gold', 'green', 'aqua', 'red', 'light_purple', 'gray'] as const
export type TellrawColor = (typeof TELLRAW_COLORS)[number]

export function directMessageCommand(player: string, message: string, color: TellrawColor = 'white'): string | null {
  if (!VALID_NAME.test(player)) return null
  const msg = sanitizeText(message)
  if (!msg) return null
  // A styled "[Server]" prefix followed by the message, as a JSON text
  // component. JSON.stringify escapes the message safely.
  const component = ['', { text: '[Server] ', color: 'gold', bold: true }, { text: msg, color }]
  return `tellraw ${player} ${JSON.stringify(component)}`
}
