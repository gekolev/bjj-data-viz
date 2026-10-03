import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const code = readFileSync(new URL('../src/lib/importStorage.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { loadCsvImport, saveCsvImport, removeCsvImport, IMPORT_STORAGE_KEY } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const data = { fileName: 'my-trainings.csv', sessions: [{ id: 0, training: 'Fundamentals', date: new Date('2026-10-01T14:42:00Z'), duration: 70, style: 'Other', classType: 'Fundamentals', venue: 'My gym', instructor: 'Coach' }] }
function storage() {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('restores filename, dates, and raw classifications after a reload', () => {
  const store = storage()
  assert.equal(saveCsvImport(data, store), true)
  const restored = loadCsvImport(store)
  assert.deepEqual(restored, data)
  assert.ok(restored.sessions[0].date instanceof Date)
  assert.equal(restored.sessions[0].style, 'Other')
})

test('replaces the previous CSV and removes only its own saved data', () => {
  const store = storage()
  store.setItem('matmetrics-fill-screen', 'true')
  saveCsvImport(data, store)
  saveCsvImport({ ...data, fileName: 'replacement.csv' }, store)
  assert.equal(loadCsvImport(store).fileName, 'replacement.csv')
  assert.equal(removeCsvImport(store), true)
  assert.equal(loadCsvImport(store), null)
  assert.equal(store.getItem('matmetrics-fill-screen'), 'true')
})

test('ignores corrupt or incompatible saved data instead of breaking startup', () => {
  const store = storage()
  for (const value of ['{invalid', 'null', JSON.stringify({ version: 2, ...data }), JSON.stringify({ version: 1, ...data, sessions: [{ ...data.sessions[0], date: 'invalid' }] }), JSON.stringify({ version: 1, ...data, sessions: [{ ...data.sessions[0], duration: '70' }] })]) {
    store.setItem(IMPORT_STORAGE_KEY, value)
    assert.equal(loadCsvImport(store), null)
  }
})

test('reports unavailable storage and quota failures without throwing', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('blocked') } }
  assert.equal(loadCsvImport(blocked), null)
  assert.equal(saveCsvImport(data, blocked), false)
  assert.equal(removeCsvImport(blocked), false)
})

test('persists rank history and restores promotion dates, including rank-only imports', () => {
  const store = storage()
  const ranks = [{ id: 1, rank: 'B-2', date: new Date(2026, 8, 28), stripes: 2, discipline: 'BJJ', status: 'Promoted', details: '{}' }]
  for (const sessions of [data.sessions, []]) {
    const imported = { ...data, sessions, ranks }
    assert.equal(saveCsvImport(imported, store), true)
    assert.deepEqual(loadCsvImport(store), imported)
    assert.ok(loadCsvImport(store).ranks[0].date instanceof Date)
  }
  saveCsvImport({ ...data, ranks: [{ ...ranks[0], date: 'invalid' }] }, store)
  assert.equal(loadCsvImport(store), null)
})
