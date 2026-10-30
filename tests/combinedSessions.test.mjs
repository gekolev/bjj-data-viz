import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const combine = app.match(/const sourceSessions = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[csvImport, manualSessions\]\)/)?.[1]
assert.ok(combine, 'The shared session list must update for imported and manual changes')
const row = (id, duration) => ({ id, duration, date: new Date(2026, 9, 30), style: 'Gi', rounds: 5 })
const merged = (csvImport, manualSessions, demoEnabled) => runInNewContext(`(() => {${combine}})()`, { csvImport, manualSessions, demoEnabled })

for (const demoEnabled of [false, true]) {
  test(`manual saves, edits and deletes update combined totals with ${demoEnabled ? 'demo' : 'imported CSV'} sessions`, () => {
    const csvImport = { sessions: [row(0, 60), row(1, 90)] }
    const manual = row(0, 45)
    const saved = merged(csvImport, [manual], demoEnabled)
    assert.equal(saved.length, 3)
    assert.equal(saved.reduce((sum, session) => sum + session.duration, 0), 195)
    assert.equal(new Set(saved.map(session => session.id)).size, 3)
    assert.equal(saved[2].rounds, 5)
    const edited = merged(csvImport, [{ ...manual, duration: 120 }], demoEnabled)
    assert.equal(edited.reduce((sum, session) => sum + session.duration, 0), 270)
    assert.equal(merged(csvImport, [], demoEnabled).length, 2)
    assert.equal(csvImport.sessions[0].id, 0)
    assert.equal(manual.id, 0)
  })
}

test('manual sessions remain when the import or demo is removed', () => {
  const result = merged(null, [row(10, 45)], false)
  assert.equal(result.length, 1)
  assert.equal(result[0].duration, 45)
})
