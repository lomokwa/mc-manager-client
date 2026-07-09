// Dependency-free syntax highlighting for the file editor. Returns an HTML
// string of <span>-wrapped tokens to render behind a transparent <textarea>
// (the classic highlighted-overlay technique). No third-party editor needed.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Above this size, skip tokenizing and render plain escaped text — keeps typing
// responsive on very large files (the regex + innerHTML cost would otherwise
// grow with the file).
export const HIGHLIGHT_LIMIT = 100_000

const JSON_TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g

/** Highlight JSON. `code` must be raw text (this escapes it). */
export function highlightJson(code: string): string {
  if (code.length > HIGHLIGHT_LIMIT) return escapeHtml(code)
  return escapeHtml(code).replace(JSON_TOKEN, (m, str, bool, nul, num, punc) => {
    if (str !== undefined) {
      // A string ending in ':' (optionally with spaces) is an object key.
      return /:\s*$/.test(str)
        ? `<span class="j-key">${str}</span>`
        : `<span class="j-str">${str}</span>`
    }
    if (bool !== undefined) return `<span class="j-bool">${bool}</span>`
    if (nul !== undefined) return `<span class="j-null">${nul}</span>`
    if (num !== undefined) return `<span class="j-num">${num}</span>`
    if (punc !== undefined) return `<span class="j-punc">${punc}</span>`
    return m
  })
}

/** Escape-only "highlight" for plain text files. */
export function highlightPlain(code: string): string {
  return escapeHtml(code)
}

export type Language = 'json' | 'text'

/** Pick a language from a file name. */
export function languageFor(name: string): Language {
  return /\.json$/i.test(name) ? 'json' : 'text'
}

export interface JsonCheck {
  ok: boolean
  error?: string
  line?: number
}

/** Validate JSON, returning a friendly error with a line number when possible. */
export function checkJson(code: string): JsonCheck {
  if (!code.trim()) return { ok: true }
  try {
    JSON.parse(code)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON'
    // Some engines include "at position N" — turn it into a line number.
    const posMatch = /position (\d+)/.exec(msg)
    let line: number | undefined
    if (posMatch) {
      const pos = Number(posMatch[1])
      line = code.slice(0, pos).split('\n').length
    }
    return { ok: false, error: msg.replace(/^JSON\.parse: /, ''), line }
  }
}
