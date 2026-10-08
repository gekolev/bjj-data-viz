import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code = readFileSync(new URL('../src/lib/manualStorage.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { loadManualSessions, saveManualSessions, MANUAL_STORAGE_KEY } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
const record = { id: 10, training: 'Training - Gi', date: new Date(2026, 9, 8, 12), duration: 60, style: 'Gi', classType: 'Training', venue: '', instructor: '', notes: 'Guard retention', timeRecorded: false }
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }
test('round-trips manual sessions and supports edits and deleting the last record', () => {
  const store = storage()
  assert.equal(saveManualSessions([record], store), true)
  assert.deepEqual(loadManualSessions(store), { sessions: [record], error: '', initialized: true })
  const edited = { ...record, duration: 90 }
  saveManualSessions([edited], store)
  assert.deepEqual(loadManualSessions(store).sessions, [edited])
  saveManualSessions([], store)
  assert.deepEqual(loadManualSessions(store), { sessions: [], error: '', initialized: true })
})
test('reports corruption without overwriting saved records', () => {
  const store = storage()
  for (const value of ['broken', 'null', JSON.stringify({ version: 1, sessions: [{ ...record, date: 'invalid' }] }), JSON.stringify({ version: 1, sessions: [record, record] })]) {
    store.setItem(MANUAL_STORAGE_KEY, value)
    assert.ok(loadManualSessions(store).error)
    assert.equal(store.getItem(MANUAL_STORAGE_KEY), value)
  }
})
test('reports storage failures and leaves CSV storage untouched', () => {
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') } }
  assert.ok(loadManualSessions(blocked).error)
  assert.equal(saveManualSessions([record], blocked), false)
  const store = storage()
  store.setItem('matmetrics-imported-csv-v1', 'existing CSV')
  saveManualSessions([record], store)
  assert.equal(store.getItem('matmetrics-imported-csv-v1'), 'existing CSV')
})

test('preserves the chosen start time and detailed training fields after reload', () => {
  const store = storage()
  const detailed = { ...record, date: new Date(2026, 9, 8, 18, 45), timeRecorded: true, rounds: 5, effort: 'Hard', focus: ['Guard passing', 'Escapes'] }
  assert.equal(saveManualSessions([detailed], store), true)
  assert.deepEqual(loadManualSessions(store).sessions, [detailed])
})
test('continues to load old manual entries without optional detail fields', () => {
  const store = storage()
  saveManualSessions([record], store)
  assert.equal(loadManualSessions(store).error, '')
  assert.equal(loadManualSessions(store).sessions[0].rounds, undefined)
})
test('rejects invalid detailed fields', () => {
  const store = storage()
  for (const fields of [{ rounds: -1 }, { rounds: 1.5 }, { effort: 'invalid' }, { focus: [42] }]) {
    saveManualSessions([{ ...record, ...fields }], store)
    assert.ok(loadManualSessions(store).error)
  }
})
