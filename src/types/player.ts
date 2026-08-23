export interface Player {
  uuid: string
  name: string
  online: boolean
  is_op: boolean
  is_banned: boolean
  is_whitelisted: boolean
  // Enrichment from the player-insights backend. Optional: the panel stays
  // fully usable when the server doesn't provide them.
  total_playtime_ticks?: number
  deaths?: number
  online_since?: string
}

/** Response shape of DELETE /players/:uuid — which sub-actions actually took effect. */
export interface PlayerDeletionResult {
  kicked: boolean
  deopped: boolean
  unwhitelisted: boolean
  usercache_removed: boolean
}

export interface WorldInfo {
  level_name: string
  spawn?: { x: number; y: number; z: number }
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
