// Maps player-management actions to the Minecraft server console commands that
// perform them. The commands are sent over the same console WebSocket the
// terminal uses, so no extra API surface is required.

// Java-edition usernames are up to 16 chars of [A-Za-z0-9_]. Validating here
// keeps a name read from the API from ever turning into a multi-token command.
const VALID_NAME = /^\w{1,16}$/

export function isValidName(name: string): boolean {
  return VALID_NAME.test(name)
}

// Collapse newlines/returns so a single free-text field can never smuggle a
// second console command onto its own line.
function sanitizeText(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').trim()
}

export function opCommand(name: string, op: boolean): string | null {
  if (!VALID_NAME.test(name)) return null
  return op ? `op ${name}` : `deop ${name}`
}

export function whitelistCommand(name: string, add: boolean): string | null {
  if (!VALID_NAME.test(name)) return null
  return add ? `whitelist add ${name}` : `whitelist remove ${name}`
}

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

export function pardonCommand(player: string): string | null {
  if (!VALID_NAME.test(player)) return null
  return `pardon ${player}`
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
  // A private whisper only <player> sees (tellraw is addressed to their name):
  // a "[Server → you]" prefix — grey brackets, bold gold sender — then the
  // message in the chosen colour, italicised like a vanilla /msg. JSON.stringify
  // escapes the message content safely.
  const component = [
    '',
    { text: '[', color: 'gray' },
    { text: 'Server', color: 'gold', bold: true },
    { text: ' → ', color: 'gray' },
    { text: 'you', color: 'yellow' },
    { text: '] ', color: 'gray' },
    { text: msg, color, italic: true },
  ]
  return `tellraw ${player} ${JSON.stringify(component)}`
}
