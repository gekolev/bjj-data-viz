import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const sourceCode = readFileSync(new URL('../src/lib/allocateTrainingStyles.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(sourceCode, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { allocateTrainingStyles } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const records = (styles) => styles.map((style, id) => ({ id, date: new Date(2026, 0, id + 1), duration: 60 + id, style }))

test('allocates unknowns at the known ratio while preserving source records and totals', () => {
  const source = records(['Gi', 'Gi', 'Gi', 'NoGi', ...Array(8).fill('Other')])
  const result = allocateTrainingStyles(source)
  assert.equal(result.giShare, 0.75)
  assert.equal(result.estimatedCount, 8)
  assert.equal(result.sessions.filter(row => row.style === 'Gi').length, 9)
  assert.equal(result.sessions.filter(row => row.style === 'NoGi').length, 3)
  assert.equal(result.sessions.length, source.length)
  assert.deepEqual(result.sessions.map(row => [row.id, row.date, row.duration]), source.map(row => [row.id, row.date, row.duration]))
  assert.ok(source.slice(4).every(row => row.style === 'Other'))
  assert.ok(result.sessions.slice(4).every(row => row.styleEstimated))
  assert.ok(result.sessions.slice(0, 4).every((row, index) => row === source[index]))
})

test('rounds fractional counts and does not depend on source ordering', () => {
  const source = records(['Gi', 'NoGi', 'NoGi', ...Array(5).fill('Other')])
  const result = allocateTrainingStyles(source)
  assert.equal(result.sessions.filter(row => row.styleEstimated && row.style === 'Gi').length, 2)
  const reversed = allocateTrainingStyles([...source].reverse())
  assert.deepEqual(new Map(result.sessions.map(row => [row.id, row.style])), new Map(reversed.sessions.map(row => [row.id, row.style])))
})

test('keeps unknowns when no known ratio exists and handles empty data', () => {
  const source = records(['Other', 'Other'])
  const result = allocateTrainingStyles(source)
  assert.equal(result.sessions, source)
  assert.equal(result.estimatedCount, 0)
  assert.equal(result.unknownCount, 2)
  assert.equal(result.giShare, null)
  assert.deepEqual(allocateTrainingStyles([]).sessions, [])
})

test('handles one-sided known styles and leaves fully classified data unchanged', () => {
  for (const style of ['Gi', 'NoGi']) {
    const result = allocateTrainingStyles(records([style, 'Other', 'Other']))
    assert.ok(result.sessions.every(row => row.style === style))
  }
  const source = records(['Gi', 'NoGi'])
  assert.equal(allocateTrainingStyles(source).sessions, source)
})
