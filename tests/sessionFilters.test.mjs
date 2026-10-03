import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const code = readFileSync(new URL('../src/lib/sessionFilters.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { sessionTimeOfDay, filterSessions, emptySessionFilters } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const rows = [
  { id: 1, date: new Date(2026, 8, 28, 7), style: 'Gi', classType: 'Fundamentals', instructor: 'Coach A', venue: 'Gym A' },
  { id: 2, date: new Date(2026, 8, 28, 18), style: 'NoGi', classType: 'Fundamentals', instructor: 'Coach B', venue: 'Gym B' },
  { id: 3, date: new Date(2026, 8, 27, 12), style: 'Gi', classType: 'Advanced', instructor: 'Coach A', venue: 'Gym A' },
  { id: 4, date: new Date(2025, 8, 29, 18), style: 'NoGi', classType: 'Advanced', instructor: 'Coach B', venue: 'Gym B' },
]

test('time-of-day boundaries cover all hours without gaps', () => {
  const expected = ['night', 'night', 'night', 'night', 'night', 'morning', 'morning', 'morning', 'morning', 'morning', 'morning', 'lunch', 'lunch', 'lunch', 'afternoon', 'afternoon', 'afternoon', 'evening', 'evening', 'evening', 'evening', 'evening', 'night', 'night']
  expected.forEach((period, hour) => assert.equal(sessionTimeOfDay(new Date(2026, 0, 1, hour, 59)), period))
})

test('combines all filters and handles Sunday value zero', () => {
  assert.deepEqual(filterSessions(rows, { ...emptySessionFilters, style: 'NoGi', weekday: '1', classType: 'Fundamentals', timeOfDay: 'evening', instructor: 'Coach B', venue: 'Gym B', year: '2026' }).map(row => row.id), [2])
  assert.deepEqual(filterSessions(rows, { ...emptySessionFilters, weekday: '0' }).map(row => row.id), [3])
})

test('search is case-insensitive, reset returns all rows, and source is unchanged', () => {
  assert.deepEqual(filterSessions(rows, { ...emptySessionFilters, query: '  GYM b  ' }).map(row => row.id), [2, 4])
  assert.equal(filterSessions(rows, { ...emptySessionFilters, timeOfDay: 'night' }).length, 0)
  assert.deepEqual(filterSessions(rows, emptySessionFilters), rows)
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3, 4])
})
