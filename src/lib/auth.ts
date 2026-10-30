import { apiFetch, type ApiResult } from './api'

export interface ForgotPassword {
  success: string
  message: string
}

export function sendForgotPassword(email: string): Promise<ApiResult<ForgotPassword>> {
  return apiFetch<ForgotPassword>('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function sendResetPassword(token: string, password: string): Promise<ApiResult<unknown>> {
  return apiFetch<unknown>('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}
