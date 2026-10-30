import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/lib/emailOperation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const fresh = () => import('data:text/javascript;base64,' + Buffer.from(source + `\n// ${crypto.randomUUID()}`).toString('base64'))

test('identical failed operations reuse IDs across reloads; successful or changed sends get fresh IDs', async () => {
  const previous = globalThis.sessionStorage, saved = new Map()
  globalThis.sessionStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
  try {
    let operation = await fresh()
    const body = JSON.stringify({ email: 'athlete@example.com', year: 2026, content: 'images' })
    const first = await operation.emailOperation(body)
    assert.equal(await operation.emailOperation(body), first)
    assert.ok(![...saved.values()].join('').includes('athlete@example.com'))
    operation = await fresh()
    assert.equal(await operation.emailOperation(body), first)
    operation.completeEmailOperation('unrelated-operation')
    assert.equal(await operation.emailOperation(body), first)
    operation.completeEmailOperation(first)
    const intentionalSend = await operation.emailOperation(body)
    assert.notEqual(intentionalSend, first)
    assert.notEqual(await operation.emailOperation(body + 'changed'), intentionalSend)
  } finally { globalThis.sessionStorage = previous }
})

test('unavailable storage preserves retry IDs in memory', async () => {
  const previous = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem() { throw Error('Blocked') }, setItem() { throw Error('Blocked') }, removeItem() { throw Error('Blocked') } }
  try {
    const operation = await fresh()
    const first = await operation.emailOperation('payload')
    assert.equal(await operation.emailOperation('payload'), first)
    operation.completeEmailOperation(first)
    assert.notEqual(await operation.emailOperation('payload'), first)
  } finally { globalThis.sessionStorage = previous }
})

test('expired, malformed, and future operation metadata cannot reuse an invalid ID', async t => {
  const previous = globalThis.sessionStorage
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
  let saved
  globalThis.sessionStorage = { getItem: () => saved, setItem: (_, value) => { saved = value }, removeItem: () => { saved = null } }
  try {
    let operation = await fresh()
    const first = await operation.emailOperation('payload')
    t.mock.timers.tick(24 * 60 * 60_000)
    operation = await fresh()
    const renewed = await operation.emailOperation('payload')
    assert.notEqual(renewed, first)
    saved = JSON.stringify({ ...JSON.parse(saved), createdAt: Date.now() + 100_000 })
    operation = await fresh()
    assert.notEqual(await operation.emailOperation('payload'), renewed)
    saved = '{invalid'
    operation = await fresh()
    assert.match(await operation.emailOperation('payload'), /^[0-9a-f-]{36}$/)
  } finally { globalThis.sessionStorage = previous }
})
