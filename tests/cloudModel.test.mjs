import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function moduleUrl(path, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
}
const imports = moduleUrl('../src/lib/importStorage.ts')
const manual = moduleUrl('../src/lib/manualStorage.ts')
const model = await import(moduleUrl('../src/lib/cloudModel.ts', { "'./importStorage'": JSON.stringify(imports), "'./manualStorage'": JSON.stringify(manual) }))
const session = { id: 10, training: 'Training - Gi', date: new Date('2026-10-08T12:00:00Z'), duration: 60, style: 'Gi', classType: 'Training', venue: 'Gym', instructor: 'Coach', notes: 'Escapes' }
const record = (data = session, fields = {}) => ({ kind: 'manual', data: model.serializeRecord(data), revision: 3, deleted: false, fileName: '', updatedAt: { seconds: 100, nanoseconds: 0 }, ...fields })

test('content IDs ignore CSV order and UI metadata, but retain distinct records', async () => {
  const id = await model.contentId('imported', session)
  assert.equal(await model.contentId('imported', { ...session, id: 999, cloudId: 'old', cloudRevision: 8 }), id)
  assert.notEqual(await model.contentId('imported', { ...session, duration: 90 }), id)
  assert.notEqual(await model.contentId('manual', session), id)
})
test('guest import is additive, deduplicated, and never resurrects deleted records', async () => {
  const id = await model.contentId('manual', session)
  assert.equal((await model.importChanges(null, [session, { ...session, id: 999 }], {})).length, 1)
  assert.deepEqual(await model.importChanges(null, [session], { [id]: record() }), [])
  assert.deepEqual(await model.importChanges(null, [session], { [id]: record(session, { deleted: true }) }), [])
})
test('restores dates, detailed fields and ranks while excluding tombstones', () => {
  const rank = { id: 0, date: session.date, rank: 'B-1', stripes: 1, discipline: 'BJJ', status: 'Promoted', details: '' }
  const workspace = model.workspaceFromRecords({ a: record({ ...session, rounds: 5, focus: ['Escapes'] }), b: record(session, { deleted: true }), r: record(rank, { kind: 'rank', fileName: 'history.csv' }) })
  assert.equal(workspace.manualData.sessions.length, 1)
  assert.ok(workspace.manualData.sessions[0].date instanceof Date)
  assert.equal(workspace.manualData.sessions[0].rounds, 5)
  assert.equal(workspace.manualData.sessions[0].cloudRevision, 3)
  assert.equal(workspace.csvImport.ranks[0].rank, 'B-1')
  assert.equal(workspace.manualData.initialized, true)
})
test('manual edit plans retain the revision from when the edit started', () => {
  const previous = model.workspaceFromRecords({ a: record() }).manualData.sessions
  assert.deepEqual(model.manualChanges(previous, previous, { a: record() }), [])
  const edited = { ...previous[0], duration: 90 }
  const change = model.manualChanges(previous, [edited], { a: record({ ...session, notes: 'Changed elsewhere' }, { revision: 4 }) })[0]
  assert.equal(change.id, 'a')
  assert.equal(change.expectedRevision, 3)
  assert.equal(change.data.duration, 90)
  assert.equal('cloudId' in change.data, false)
  assert.equal('cloudRevision' in change.data, false)
})
test('manual numeric ID collisions do not create writes to untouched rows', () => {
  const records = { a: record(), b: record({ ...session, notes: 'Another device' }) }
  const previous = model.workspaceFromRecords(records).manualData.sessions
  assert.notEqual(previous[0].id, previous[1].id)
  assert.deepEqual(model.manualChanges(previous, previous, records), [])
  const changes = model.manualChanges(previous, [previous[1]], records)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].id, 'a')
  assert.equal(changes[0].deleted, true)
})
test('invalid cloud data is rejected before it reaches the dashboard', () => {
  assert.throws(() => model.decodeRecord(record({ ...session, date: 'invalid' })))
  assert.throws(() => model.decodeRecord(record(session, { revision: 0 })))
  assert.throws(() => model.decodeRecord(record(session, { updatedAt: null })))
  assert.throws(() => model.decodeRecord(record({ ...session, effort: 'Bogus' })))
  assert.equal(model.decodeRecord(record()).revision, 3)
})

test('explicit CSV upload can restore removed imports without resurrecting guest data', async () => {
  const id = await model.contentId('imported', session)
  const records = { [id]: record(session, { kind: 'imported', deleted: true }) }
  const csv = { fileName: 'training.csv', sessions: [session] }
  assert.deepEqual(await model.importChanges(csv, [], records), [])
  const changes = await model.importChanges(csv, [], records, true)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].expectedRevision, 3)
  assert.equal(changes[0].onlyIfMissing, false)
})
test('guest imports recognize matching manual records created with UUIDs', async () => {
  assert.deepEqual(await model.importChanges(null, [session], { 'manual-uuid': record(session) }), [])
})

test('stale edits of a remotely deleted row still require revision validation', () => {
  const previous = model.workspaceFromRecords({ a: record() }).manualData.sessions
  const changes = model.manualChanges(previous, previous, { a: record(session, { revision: 4, deleted: true }) })
  assert.equal(changes.length, 1)
  assert.equal(changes[0].expectedRevision, 3)
})

const applyChanges = (records, changes) => ({ ...records, ...Object.fromEntries(changes.map(change => [change.id, record(change.data, { kind: change.kind, deleted: change.deleted, fileName: change.fileName, revision: change.expectedRevision + 1 })])) })
const rank = { id: 0, date: session.date, rank: 'B-1', stripes: 1, discipline: 'BJJ', status: 'Promoted', details: '' }

test('a second 1000-session CSV replaces the first and cleans up already accumulated imports', async () => {
  const first = { fileName: 'first.csv', sessions: Array.from({ length: 1000 }, (_, id) => ({ ...session, id, date: new Date(Date.UTC(2020, 0, 1 + id)) })), ranks: [rank] }
  const second = { fileName: 'second.csv', sessions: Array.from({ length: 1000 }, (_, id) => ({ ...session, id, date: new Date(Date.UTC(2023, 0, 1 + id)) })), ranks: [] }
  let records = { manual: record() }
  records = applyChanges(records, await model.importChanges(first, [], records))
  records = applyChanges(records, await model.importChanges(second, [], records))
  assert.equal(model.workspaceFromRecords(records).csvImport.sessions.length, 2000)
  records = applyChanges(records, await model.replaceCsvChanges(second, records))
  const workspace = model.workspaceFromRecords(records)
  assert.equal(workspace.csvImport.sessions.length, 1000)
  assert.equal(workspace.csvImport.ranks.length, 0)
  assert.equal(workspace.csvImport.fileName, 'second.csv')
  assert.equal(workspace.manualData.sessions.length, 1)
  assert.deepEqual(await model.replaceCsvChanges(second, records), [])
})

test('CSV replacement retains shared rows, updates filenames, replaces ranks and can restore an older CSV', async () => {
  const first = { fileName: 'first.csv', sessions: [session], ranks: [rank] }
  let records = applyChanges({}, await model.replaceCsvChanges(first, {}))
  const second = { fileName: 'second.csv', sessions: [session, { ...session, duration: 90 }], ranks: [{ ...rank, rank: 'BK-0', stripes: 0 }] }
  records = applyChanges(records, await model.replaceCsvChanges(second, records))
  let workspace = model.workspaceFromRecords(records)
  assert.equal(workspace.csvImport.sessions.length, 2)
  assert.equal(workspace.csvImport.ranks.length, 1)
  assert.equal(workspace.csvImport.ranks[0].rank, 'BK-0')
  assert.equal(workspace.csvImport.fileName, 'second.csv')
  records = applyChanges(records, await model.replaceCsvChanges(first, records))
  workspace = model.workspaceFromRecords(records)
  assert.equal(workspace.csvImport.sessions.length, 1)
  assert.equal(workspace.csvImport.ranks[0].rank, 'B-1')
  assert.equal(workspace.csvImport.fileName, 'first.csv')
})
