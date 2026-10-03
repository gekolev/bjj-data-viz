import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import Papa from 'papaparse'
import ts from 'typescript'

const source = readFileSync(new URL('../gymdesk-scrape.js', import.meta.url), 'utf8')
const rankSource = readFileSync(new URL('../src/lib/rankHistory.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(rankSource, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { ranksFromCsvRows } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

function documentFor({ headers = [], rows = [] } = {}) {
  const cell = value => ({
    textContent: typeof value === 'string' ? value : value.text,
    querySelectorAll: () => [],
    getAttribute: name => typeof value === 'string' ? null : value[name] ?? null,
  })
  const table = { querySelectorAll: selector => selector === 'thead th' ? headers.map(cell) : selector === 'tbody tr' ? rows.map(values => ({ querySelectorAll: () => values.map(cell) })) : [] }
  return { querySelectorAll: selector => selector === 'table' ? [table] : [] }
}

async function runExport({ rankPages = [{ rows: [] }], failRanks = false } = {}) {
  const attendancePages = [
    { rows: [['Fundamentals - NoGi | Coach "A"', 'Oct 1, 2026 5:42 PM 1h 10m']] },
    { rows: [['Fundamentals - NoGi | Coach "A"', 'Oct 1, 2026 5:42 PM 1h 10m'], ['Advanced - Gi | Coach B', 'Sep 30, 2026 5:46 PM 1h 20m']] },
  ]
  const requests = [], logs = []
  let exportedBlob, downloadedName, clicked = false
  let attendanceIndex = 0, rankIndex = 0
  const documents = []
  class TestURL extends URL {
    static createObjectURL(blob) { exportedBlob = blob; return 'blob:attendance' }
    static revokeObjectURL() {}
  }
  const context = {
    window: { location: { origin: 'https://my-own-gym.gymdesk.com' } },
    console: { log: (...args) => logs.push(args.join(' ')) }, URL: TestURL, Blob,
    Date: class extends Date { constructor() { super(2026, 9, 3, 0, 15) } },
    fetch: async (url, options) => {
      requests.push({ url, options })
      const ranks = new URL(url).pathname === '/members/ranks'
      if (ranks && failRanks) return { ok: false, status: 403 }
      const page = ranks ? rankPages[Math.min(rankIndex++, rankPages.length - 1)] : attendancePages[Math.min(attendanceIndex++, 1)]
      documents.push(documentFor(page))
      return { ok: true, text: async () => String(documents.length - 1) }
    },
    DOMParser: class { parseFromString(index) { return documents[Number(index)] } },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ set download(value) { downloadedName = value }, click() { clicked = true }, remove() {} }),
    },
  }
  await vm.runInNewContext(source, context)
  const csv = await exportedBlob.text()
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  assert.equal(parsed.errors.length, 0)
  return { requests, logs, csv, rows: parsed.data, downloadedName, clicked }
}

test('exports from the current gym, deduplicates attendance, keeps a dated filename, and stops repeated pages', async () => {
  const result = await runExport()
  assert.equal(result.requests.filter(r => r.url.includes('/members/attendance')).length, 3)
  assert.ok(result.requests.every(r => r.url.startsWith('https://my-own-gym.gymdesk.com/members/') && r.options.credentials === 'include'))
  assert.equal(result.downloadedName, 'gymdesk-all-attendance-2026-10-03.csv')
  assert.ok(result.clicked)
  assert.equal(result.rows.length, 2)
  assert.ok(result.rows.every(row => row['Record Type'] === 'attendance'))
  assert.ok(result.csv.includes('Coach ""A""'))
  assert.ok(result.csv.includes('"Training","Date / Time / Duration"'))
})

test('exports the supplied Gymdesk rank-code history and imports day/month/year dates correctly', async () => {
  const history = [['B-2', '28/09/2026'], ['B-1', '23/01/2026'], ['B-0', '09/06/2025'], ['W-4', '20/09/2024'], ['W-3', '17/06/2024'], ['W-2', '03/01/2024'], ['W-1', '11/08/2023'], ['W-0', '11/05/2023']]
  const result = await runExport({ rankPages: [{ rows: history.map(([rank, date]) => ['BJJ', rank, date, 'Promoted']) }] })
  assert.equal(result.requests.filter(r => r.url.includes('/members/ranks')).length, 2)
  assert.equal(result.rows.filter(row => row['Record Type'] === 'attendance').length, 2)
  const rankRows = result.rows.filter(row => row['Record Type'] === 'rank')
  assert.equal(rankRows.length, 8)
  assert.ok(rankRows.every(row => row.Training === '' && row['Date / Time / Duration'] === '' && row.Discipline === 'BJJ'))
  assert.deepEqual(JSON.parse(rankRows[0]['Rank Details']).cells, ['BJJ', 'B-2', '28/09/2026', 'Promoted'])
  const { ranks, skipped } = ranksFromCsvRows(result.rows)
  assert.equal(skipped, 0)
  assert.deepEqual(ranks.map(rank => rank.rank), history.map(([rank]) => rank).reverse())
  assert.equal(ranks[0].date.getMonth(), 4)
  assert.equal(ranks[0].date.getDate(), 11)
  assert.equal(ranks[2].date.getMonth(), 0)
  assert.equal(ranks[2].date.getDate(), 3)
  assert.equal(ranks.at(-1).stripes, 2)
})

test('reads reordered headers and accessible rank labels, paginates and deduplicates rank history', async () => {
  const headers = ['Date', 'Rank', 'Stripes', 'Discipline', 'Status']
  const newest = ['28/09/2026', { text: '', title: 'B-2' }, '2', 'BJJ', 'Promoted']
  const result = await runExport({ rankPages: [
    { headers, rows: [newest] },
    { headers, rows: [newest, ['09/06/2025', 'B-0', '0', 'BJJ', 'Promoted']] },
    { rows: [] },
  ] })
  assert.equal(result.rows.filter(row => row['Record Type'] === 'rank').length, 2)
  assert.ok(result.requests.some(r => r.url.endsWith('/members/ranks?page=2')))
  assert.equal(ranksFromCsvRows(result.rows).ranks[0].stripes, 0)
})

test('a failed ranks request still exports attendance and reports the failure', async () => {
  const result = await runExport({ failRanks: true })
  assert.equal(result.rows.length, 2)
  assert.ok(result.logs.some(log => log.includes('Ranks request failed') && log.includes('403')))
})

test('cleans duplicate rank labels and embedded date/status text while retaining the raw row', async () => {
  const result = await runExport({ rankPages: [{ rows: [['BJJ Current Rank', 'B-2 B-2 - BJJ', '28/09/2026 Promoted']] }] })
  const row = result.rows.find(row => row['Record Type'] === 'rank')
  assert.equal(row.Rank, 'B-2')
  assert.equal(row.Discipline, 'BJJ')
  assert.equal(row['Promotion Date'], '28/09/2026')
  assert.equal(row['Rank Status'], 'Promoted')
  assert.deepEqual(JSON.parse(row['Rank Details']).cells, ['BJJ Current Rank', 'B-2 B-2 - BJJ', '28/09/2026 Promoted'])
})
