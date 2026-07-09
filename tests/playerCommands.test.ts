import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidName, opCommand, whitelistCommand, teleportToPlayerCommand, teleportToCoordsCommand,
  kickCommand, banCommand, ipBanCommand, pardonCommand, runAsCommand, directMessageCommand,
} from '../src/lib/playerCommands.ts'

test('isValidName accepts valid Java names and rejects the rest', () => {
  assert.equal(isValidName('Notch'), true)
  assert.equal(isValidName('a'), true)
  assert.equal(isValidName('x'.repeat(16)), true)
  assert.equal(isValidName(''), false)
  assert.equal(isValidName('x'.repeat(17)), false)
  assert.equal(isValidName('bad name'), false)
  assert.equal(isValidName('bad-name'), false)
  assert.equal(isValidName('bad\nname'), false)
})

test('every builder returns null for an invalid player name', () => {
  const bad = 'bad name'
  assert.equal(opCommand(bad, true), null)
  assert.equal(whitelistCommand(bad, true), null)
  assert.equal(teleportToPlayerCommand(bad, 'Steve'), null)
  assert.equal(teleportToCoordsCommand(bad, 0, 0, 0), null)
  assert.equal(kickCommand(bad), null)
  assert.equal(banCommand(bad), null)
  assert.equal(ipBanCommand(bad), null)
  assert.equal(pardonCommand(bad), null)
  assert.equal(runAsCommand(bad, 'say hi'), null)
  assert.equal(directMessageCommand(bad, 'hi'), null)
})

test('op and whitelist builders produce the right commands', () => {
  assert.equal(opCommand('Notch', true), 'op Notch')
  assert.equal(opCommand('Notch', false), 'deop Notch')
  assert.equal(whitelistCommand('Notch', true), 'whitelist add Notch')
  assert.equal(whitelistCommand('Notch', false), 'whitelist remove Notch')
})

test('kick neutralizes newline smuggling', () => {
  const cmd = kickCommand('Notch', 'grief\nstop all')
  assert.ok(cmd && !/[\r\n]/.test(cmd))
  assert.equal(cmd, 'kick Notch grief stop all')
})

test('runAs strips leading slashes and rejects an empty command', () => {
  assert.equal(runAsCommand('Notch', '/say hi'), 'execute as Notch at Notch run say hi')
  assert.equal(runAsCommand('Notch', '//say hi'), 'execute as Notch at Notch run say hi')
  assert.equal(runAsCommand('Notch', '   '), null)
})

test('teleport-to-coords validates finiteness', () => {
  assert.equal(teleportToCoordsCommand('Notch', NaN, 0, 0), null)
  assert.equal(teleportToCoordsCommand('Notch', 0, Infinity, 0), null)
  assert.equal(teleportToCoordsCommand('Notch', -5, 64, 0), 'tp Notch -5 64 0')
})

test('directMessage produces injection-safe JSON', () => {
  const cmd = directMessageCommand('Notch', 'hi <there> "quoted"', 'gold')
  assert.ok(cmd && cmd.startsWith('tellraw Notch '))
  const parsed = JSON.parse(cmd.slice('tellraw Notch '.length))
  assert.ok(Array.isArray(parsed))
  const last = parsed[parsed.length - 1]
  assert.equal(last.text, 'hi <there> "quoted"')
  assert.equal(last.color, 'gold')
  assert.equal(last.italic, true)
  assert.ok(parsed.some((p) => p.text === 'Server'))
})

test('directMessage collapses newlines and rejects an empty message', () => {
  const cmd = directMessageCommand('Notch', 'line1\nline2', 'white')
  assert.ok(cmd)
  const parsed = JSON.parse(cmd.slice('tellraw Notch '.length))
  assert.equal(parsed[parsed.length - 1].text, 'line1 line2')
  assert.equal(directMessageCommand('Notch', '   '), null)
})
