// Parse player chat out of raw console lines, entirely client-side, so the
// player panel can show a live conversation with no new backend endpoint —
// the console log already streams over the /api/console WebSocket. Vanilla
// logs a player's chat as e.g. "[12:34:56] [Server thread/INFO]: <Notch> hi".

export interface ChatMessage {
  /** Stable key: the source log-line index. */
  id: number
  /** "HH:MM:SS" when the line carried a timestamp. */
  time?: string
  text: string
}

// The sender is in angle brackets; the message is the rest of the line. The
// name pattern matches Java usernames and won't match the app's own "> cmd"
// echoes, join/leave lines, `/say` ([Server] …) or `/me` (* name …) output.
const CHAT_LINE = /<([A-Za-z0-9_]{1,16})>\s+(.+)$/
const TIMESTAMP = /\[(\d{1,2}:\d{2}:\d{2})/

/** Recent chat messages sent by `playerName`, oldest first, capped to `limit`. */
export function parsePlayerChat(logs: string[], playerName: string, limit = 60): ChatMessage[] {
  const out: ChatMessage[] = []
  for (let i = 0; i < logs.length; i++) {
    const line = logs[i]
    const m = CHAT_LINE.exec(line)
    if (m && m[1] === playerName) {
      out.push({ id: i, time: TIMESTAMP.exec(line)?.[1], text: m[2] })
    }
  }
  return out.length > limit ? out.slice(out.length - limit) : out
}
