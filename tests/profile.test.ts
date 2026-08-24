import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { avatarSrc, updateDisplayName, updateEmail, changePassword, uploadAvatar, removeAvatar, AVATAR_MAX_BYTES } from '../src/lib/profile.ts'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

test('avatarSrc: null/undefined/empty avatar_url all mean no picture', () => {
  assert.equal(avatarSrc(null), null)
  assert.equal(avatarSrc(undefined), null)
  assert.equal(avatarSrc(''), null)
})

test('avatarSrc: resolves a relative avatar_url against the API origin, not /api', () => {
  // API_BASE defaults to http://localhost:8080/api outside Vite -- the
  // avatar route lives at the origin, not under /api, since a browser <img>
  // can't attach the Authorization header apiFetch normally sends.
  assert.equal(avatarSrc('/avatars/3-abc123.png'), 'http://localhost:8080/avatars/3-abc123.png')
})

test('updateDisplayName: PATCHes /me with the trimmed value as JSON', async () => {
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url
    seenInit = init
    return new Response(JSON.stringify({ success: true, data: { id: 1, username: 'bob', display_name: 'Bob', created_at: '' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const r = await updateDisplayName('tok', 'Bob')

  assert.equal(seenUrl, 'http://localhost:8080/api/me')
  assert.equal(seenInit?.method, 'PATCH')
  assert.equal((seenInit?.headers as Record<string, string>).Authorization, 'Bearer tok')
  assert.equal(seenInit?.body, JSON.stringify({ display_name: 'Bob' }))
  assert.equal(r.kind, 'ok')
  assert.equal(r.kind === 'ok' && r.data.display_name, 'Bob')
})

test('updateEmail: PATCHes /me/email with the trimmed value as JSON', async () => {
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url
    seenInit = init
    return new Response(JSON.stringify({ success: true, data: { id: 1, username: 'bob', email: 'bob@example.com', created_at: '' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const r = await updateEmail('tok', 'bob@example.com')

  assert.equal(seenUrl, 'http://localhost:8080/api/me/email')
  assert.equal(seenInit?.method, 'PATCH')
  assert.equal((seenInit?.headers as Record<string, string>).Authorization, 'Bearer tok')
  assert.equal(seenInit?.body, JSON.stringify({ email: 'bob@example.com' }))
  assert.equal(r.kind, 'ok')
  assert.equal(r.kind === 'ok' && r.data.email, 'bob@example.com')
})

test('changePassword: POSTs /me/password with current and new password as JSON', async () => {
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url
    seenInit = init
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  const r = await changePassword('tok', 'oldpw', 'newpw123')

  assert.equal(seenUrl, 'http://localhost:8080/api/me/password')
  assert.equal(seenInit?.method, 'POST')
  assert.equal((seenInit?.headers as Record<string, string>).Authorization, 'Bearer tok')
  assert.equal(seenInit?.body, JSON.stringify({ current_password: 'oldpw', new_password: 'newpw123' }))
  assert.equal(r.kind, 'ok')
})

test('uploadAvatar: POSTs multipart form data without forcing a Content-Type', async () => {
  let seenInit: RequestInit | undefined
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    seenInit = init
    return new Response(JSON.stringify({ success: true, data: { id: 1, username: 'bob', avatar_url: '/avatars/1-x.png', created_at: '' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })
  const r = await uploadAvatar('tok', file)

  assert.equal(seenInit?.method, 'POST')
  assert.ok(seenInit?.body instanceof FormData)
  assert.equal((seenInit?.body as FormData).get('avatar'), file)
  // Setting Content-Type here would strip the multipart boundary the browser
  // adds automatically, breaking the upload server-side.
  assert.equal((seenInit?.headers as Record<string, string>)['Content-Type'], undefined)
  assert.equal(r.kind, 'ok')
})

test('removeAvatar: DELETEs /me/avatar', async () => {
  let seenUrl = ''
  let seenMethod = ''
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenUrl = url
    seenMethod = init?.method ?? ''
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  const r = await removeAvatar('tok')

  assert.equal(seenUrl, 'http://localhost:8080/api/me/avatar')
  assert.equal(seenMethod, 'DELETE')
  assert.equal(r.kind, 'ok')
})

test('AVATAR_MAX_BYTES matches the backend limit (5MB)', () => {
  assert.equal(AVATAR_MAX_BYTES, 5 * 1024 * 1024)
})
