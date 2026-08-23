// Imports `./api.ts` WITH the extension, unlike the rest of src/ -- this file
// is imported directly by tests/profile.test.ts under plain `node --test`,
// not Vite, so the specifier has to resolve without bundler help (see the
// same note in lib/servers.ts).
import { API_ORIGIN, apiFetch, type ApiResult } from './api.ts'
import type { User } from '../types/user.ts'

// Keep in sync with services.AvatarMaxBytes on the backend -- this only lets
// the UI reject an oversized file before spending a round trip on it; the
// server enforces the real limit regardless.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

/** Builds the <img> src for a user's avatar_url, or null if they have none. */
export function avatarSrc(avatarUrl: string | null | undefined): string | null {
  return avatarUrl ? `${API_ORIGIN}${avatarUrl}` : null
}

export function updateDisplayName(token: string | null, displayName: string): Promise<ApiResult<User>> {
  return apiFetch<User>('/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ display_name: displayName }),
  })
}

export function uploadAvatar(token: string | null, file: File): Promise<ApiResult<User>> {
  const body = new FormData()
  body.append('avatar', file)
  return apiFetch<User>('/me/avatar', {
    method: 'POST',
    // No Content-Type here: the browser sets multipart/form-data with the
    // right boundary itself, which it can only do if this doesn't override it.
    headers: { 'Authorization': `Bearer ${token}` },
    body,
  })
}

export function removeAvatar(token: string | null): Promise<ApiResult<null>> {
  return apiFetch<null>('/me/avatar', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })
}
