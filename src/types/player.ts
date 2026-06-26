export interface Player {
  uuid: string
  name: string
  online: boolean
  is_op: boolean
  is_banned: boolean
  is_whitelisted: boolean
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
