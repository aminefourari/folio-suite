import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from './password.ts'

test('hash and verify passwords', async () => {
  const hash = await hashPassword('correct horse battery staple')
  assert.match(hash, /^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  assert.equal(await verifyPassword({ hash, password: 'correct horse battery staple' }), true)
  assert.equal(await verifyPassword({ hash, password: 'correct horse battery stapl' }), false)
  assert.notEqual(hash, await hashPassword('correct horse battery staple')) // salted
})

test('rejects malformed or tampered hashes', async () => {
  const hash = await hashPassword('pw-123456')
  const [s, i, salt, h] = hash.split('$')
  assert.equal(await verifyPassword({ hash: `${s}$${i}$${salt}$${h.slice(0, -4)}AAAA`, password: 'pw-123456' }), false)
  assert.equal(await verifyPassword({ hash: `scrypt$${i}$${salt}$${h}`, password: 'pw-123456' }), false)
  assert.equal(await verifyPassword({ hash: `pbkdf2$9999999$${salt}$${h}`, password: 'pw-123456' }), false) // cost cap
  assert.equal(await verifyPassword({ hash: '', password: 'x' }), false)
})

test('redirect guards only allow Folio origins and same-site paths', async () => {
  const { safeAppUrl, safePath, signInUrl } = await import('./urls.ts')
  assert.equal(safeAppUrl('https://folio-write.aminethewiz18.workers.dev/doc/1')?.pathname, '/doc/1')
  assert.equal(safeAppUrl('https://folio-write.aminethewiz18.workers.dev.evil.example/'), null)
  assert.equal(safeAppUrl('https://evil.example/?https://folio.aminethewiz18.workers.dev'), null)
  assert.equal(safeAppUrl('javascript:alert(1)'), null)
  assert.equal(safeAppUrl(''), null)
  assert.equal(safePath('/doc/2?x=1'), '/doc/2?x=1')
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'doc/1', null]) assert.equal(safePath(bad), '/')
  assert.match(signInUrl('https://folio-grid.aminethewiz18.workers.dev/doc/1'), /^https:\/\/folio\.aminethewiz18\.workers\.dev\/auth\/handoff\?to=https%3A%2F%2F/)
})
