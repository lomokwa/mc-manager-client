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
