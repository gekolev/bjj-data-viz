import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const code = readFileSync(new URL('../src/lib/rankHistory.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { parseRankDate, ranksFromCsvRows, describeRank, normalizeRankHistory, bjjRankHistory, rankAtDate, promotionsOnDate } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('parses day-first dates without UTC shifts or silent date rollover', () => {
  for (const text of ['03/01/2024', '2024-01-03', 'Jan 3, 2024']) {
    const date = parseRankDate(text)
    assert.equal(date.getFullYear(), 2024)
    assert.equal(date.getMonth(), 0)
    assert.equal(date.getDate(), 3)
  }
  assert.ok(parseRankDate('29/02/2024'))
  for (const text of ['29/02/2023', '31/04/2024', '03/14/2024', '', 'not a date', '2024-02-30']) assert.equal(parseRankDate(text), null)
})

test('skips invalid promotions, ignores attendance, deduplicates ranks, and preserves unknown stripe counts', () => {
  const row = { 'Record Type': 'rank', Rank: 'W-0', 'Promotion Date': '11/05/2023', Discipline: 'BJJ' }
  const { ranks, skipped } = ranksFromCsvRows([row, row, { ...row, Rank: '' }, { ...row, 'Promotion Date': '31/02/2024' }, { ...row, 'Record Type': 'attendance' }, { ...row, Rank: 'Custom rank', 'Promotion Date': '12/05/2023' }])
  assert.equal(skipped, 2)
  assert.equal(ranks.length, 2)
  assert.equal(ranks[0].stripes, 0)
  assert.equal(ranks[1].stripes, null)
  assert.equal(describeRank(ranks[1]).label, 'Custom rank')
})

test('describes white and blue belt codes while preserving the original code', () => {
  const ranks = ranksFromCsvRows(['W-4', 'B-0', 'B-2'].map((rank, index) => ({ 'Record Type': 'rank', Rank: rank, 'Promotion Date': `0${index + 1}/01/2026` }))).ranks
  assert.deepEqual(ranks.map(rank => describeRank(rank).label), ['White belt · 4 stripes', 'Blue belt · 0 stripes', 'Blue belt · 2 stripes'])
  assert.equal(ranks.at(-1).rank, 'B-2')
})

test('normalizes the actual exported rows, including the current rank with missing discipline and embedded status', () => {
  const values = [['B-2', '28/09/2026'], ['B-1', '23/01/2026'], ['B-0', '09/06/2025'], ['W-4', '20/09/2024'], ['W-3', '17/06/2024'], ['W-2', '03/01/2024'], ['W-1', '11/08/2023'], ['W-0', '11/05/2023']]
  const rows = values.map(([rank, date], index) => ({
    'Record Type': 'rank', Rank: `${rank} ${rank} - BJJ`, 'Promotion Date': `${date} Promoted`, Stripes: rank.split('-')[1], Discipline: index ? 'BJJ' : '',
    'Rank Details': JSON.stringify({ headers: [], cells: [index ? 'BJJ' : 'BJJ Current Rank', `${rank} ${rank} - BJJ`, `${date} Promoted`] }),
  }))
  const { ranks, skipped } = ranksFromCsvRows(rows)
  assert.equal(skipped, 0)
  assert.equal(ranks.length, 8)
  assert.ok(ranks.every(rank => rank.discipline === 'BJJ' && rank.status === 'Promoted'))
  assert.equal(ranks.at(-1).rank, 'B-2')
  assert.equal(describeRank(ranks.at(-1)).label, 'Blue belt · 2 stripes')
  assert.deepEqual(normalizeRankHistory([...ranks, { ...ranks.at(-1), rank: 'B-2 B-2 - BJJ', discipline: '' }]), ranks)
})

test('assigns rank on the promotion calendar day and never backfills before the first recorded rank', () => {
  const rows = [['W-0', '11/05/2023'], ['W-4', '20/09/2024'], ['B-0', '09/06/2025'], ['B-2', '28/09/2026']].map(([rank, date]) => ({ 'Record Type': 'rank', Rank: rank, 'Promotion Date': date, Discipline: 'BJJ' }))
  const history = bjjRankHistory(ranksFromCsvRows(rows).ranks)
  assert.equal(rankAtDate(new Date(2023, 4, 10, 23, 59), history), null)
  assert.equal(rankAtDate(new Date(2023, 4, 11, 0, 1), history).rank, 'W-0')
  assert.equal(rankAtDate(new Date(2025, 5, 8, 23, 59), history).rank, 'W-4')
  assert.equal(rankAtDate(new Date(2025, 5, 9, 0, 1), history).rank, 'B-0')
  assert.equal(rankAtDate(new Date(2026, 8, 28, 8), history).stripes, 2)
  assert.equal(promotionsOnDate(new Date(2025, 5, 9, 19), history).length, 1)
  assert.equal(promotionsOnDate(new Date(2025, 5, 10), history).length, 0)
  assert.equal(bjjRankHistory([{ ...history[0], discipline: 'Judo' }]).length, 0)
})
