export interface Player {
  uuid: string
  name: string
  online: boolean
  is_op: boolean
  is_banned: boolean
  is_whitelisted: boolean
  // Optional, populated by a stats-aware backend; the UI degrades gracefully
  // when they're absent (see the player detail panel).
  total_playtime_ticks?: number
  deaths?: number
  online_since?: string // ISO-8601 timestamp the player came online this session
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
