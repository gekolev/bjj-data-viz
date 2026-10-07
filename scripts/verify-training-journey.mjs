import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import Papa from 'papaparse'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Run the actual TypeScript helpers on Node 20 without another test dependency.
const require = createRequire(import.meta.url)
const loadedModules = new Map()
function load(relative) {
  const filename = path.resolve(relative)
  if (loadedModules.has(filename)) return loadedModules.get(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (!name.startsWith('.')) return require(name)
    const target = path.resolve(path.dirname(filename), name)
    return load(['.ts', '.tsx'].map(extension => target + extension).find(candidate => fs.existsSync(candidate)))
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports)
  loadedModules.set(filename, module.exports)
  return module.exports
}
const { parseSession } = load('src/lib/sessionParser.ts')
const { buildTrainingJourney, sessionHasRecordedTime } = load('src/lib/trainingJourney.ts')
const { allocateTrainingStyles } = load('src/lib/allocateTrainingStyles.ts')
const { ranksFromCsvRows, parseRankDate } = load('src/lib/rankHistory.ts')
const { saveCsvImport, loadCsvImport } = load('src/lib/importStorage.ts')
const session = (style, date, duration, id = 0) => parseSession(`Fundamentals - ${style} - Academy | Coach (Black Belt)`, date, id, duration)
const rank = (date, id = 0) => ({ id, date: parseRankDate(date), rank: 'B-2', stripes: 2, discipline: 'BJJ', status: 'Promoted', details: '' })

test('hours split is duration-weighted; session split is count-weighted', () => {
  const records = [session('Gi', 'Jan 1, 2024 7:00 AM', '90m'), session('NoGi', 'Jan 2, 2024 6:00 PM', '30m')]
  const hours = buildTrainingJourney(records, [], 'hours')[0]
  const counts = buildTrainingJourney(records, [], 'sessions')[0]
  assert.deepEqual(hours.values, [1.5, .5, 0])
  assert.equal(hours.values[0] / hours.total, .75)
  assert.deepEqual(counts.values, [1, 1, 0])
  assert.equal(counts.values[0] / counts.total, .5)
})
test('month boundaries, year rollover, leap day, missing month, unsorted input', () => {
  const records = [session('NoGi', 'Feb 29, 2024 11:59 PM', '20m', 2), session('Gi', 'Dec 31, 2023 11:59 PM', '40m', 0), session('Gi', 'Mar 1, 2024 12:00 AM', '60m', 3)]
  const months = buildTrainingJourney(records, [], 'sessions')
  assert.deepEqual(months.map(month => month.key), ['2023-11', '2024-0', '2024-1', '2024-2'])
  assert.deepEqual(months.map(month => month.total), [1, 0, 1, 1])
  assert.deepEqual(months.map(month => month.cumulative), [1, 1, 2, 3])
  assert.equal(buildTrainingJourney(records, [], 'hours').at(-1).cumulative, 2)
})
test('numeric attendance and rank dates use day/month/year, ISO date-only stays local', () => {
  for (const value of ['03/01/2024', '2024-01-03']) {
    const parsed = session('Gi', value, '60m')
    assert.equal(parsed.date.getMonth(), 0)
    assert.equal(parsed.date.getDate(), 3)
    assert.equal(parsed.timeRecorded, false)
    assert.equal(parseRankDate(value).getTime(), parsed.date.getTime())
  }
  assert.equal(session('Gi', '29/02/2024 11:59 PM 60m', '').date.getHours(), 23)
  assert.equal(session('Gi', '01/03/2024 12:00 AM', '30m').date.getHours(), 0)
  assert.equal(session('Gi', '01/03/2024 12:00 PM', '30m').date.getHours(), 12)
  assert.equal(session('Gi', 'Mar 1, 2024 17:30 60m', '').date.getHours(), 17)
})
test('invalid dates and negative durations are excluded', () => {
  for (const value of ['31/02/2024', '29/02/2023', '2024-13-01', 'Feb 30, 2024', 'nonsense', '01/03/2024 25:00', '01/03/2024 6:75']) assert.equal(session('Gi', value, '60m'), null, value)
  assert.equal(session('Gi', 'Jan 1, 2024', '-30m'), null)
})
test('duration units, decimals, plain minutes, zero and fallback metadata', () => {
  for (const [input, expected] of [['1h 10m', 70], ['1h10m', 70], ['1.5 hours', 90], ['90 minutes', 90], ['30.5m', 30.5], ['75', 75], ['0m', 0]]) {
    const parsed = session('Gi', 'Jan 1, 2024', input)
    assert.equal(parsed.duration, expected, input)
    assert.equal(parsed.durationEstimated, false)
  }
  const fallback = session('Gi', 'Jan 1, 2024', '')
  assert.equal(fallback.duration, 60)
  assert.equal(fallback.durationEstimated, true)
  assert.equal(session('Gi', 'Jan 1, 2024 7:30 AM 1h 10m', '').duration, 70)
})
test('No-Gi variants, class, coach and venue parsing', () => {
  for (const style of ['NoGi', 'No-Gi', 'No Gi', 'no-gi']) assert.equal(session(style, 'Jan 1, 2024', '60m').style, 'NoGi')
  const parsed = session('Gi', 'Jan 1, 2024', '60m')
  assert.equal(parsed.classType, 'Fundamentals')
  assert.equal(parsed.instructor, 'Coach')
  assert.equal(parsed.venue, 'Academy')
})
test('estimated styles conserve counts and duration and use rounded known session ratio', () => {
  const records = [session('Gi', 'Jan 1, 2024', '90m', 0), session('NoGi', 'Jan 2, 2024', '30m', 1), session('Gi', 'Jan 3, 2024', '60m', 2), ...Array.from({ length: 7 }, (_, index) => session('', `Feb ${index + 1}, 2024`, `${20 + index}m`, index + 3))]
  const allocated = allocateTrainingStyles(records)
  assert.equal(allocated.giShare, 2 / 3)
  assert.equal(allocated.sessions.filter(record => record.styleEstimated && record.style === 'Gi').length, 5)
  assert.equal(allocated.sessions.filter(record => record.styleEstimated && record.style === 'NoGi').length, 2)
  assert.equal(allocated.sessions.length, records.length)
  assert.equal(allocated.sessions.reduce((sum, record) => sum + record.duration, 0), records.reduce((sum, record) => sum + record.duration, 0))
  assert.equal(records.filter(record => record.style === 'Other').length, 7)
})
test('unknown styles without a known ratio stay Other', () => {
  const records = [session('', 'Jan 1, 2024', '60m')]
  assert.deepEqual(buildTrainingJourney(allocateTrainingStyles(records).sessions, [], 'sessions')[0].values, [0, 0, 1])
})
test('rank-only months extend the calendar without adding training, ranks sort within month', () => {
  const records = [session('Gi', 'Feb 1, 2024', '60m')]
  const ranks = [rank('15/03/2024', 3), rank('03/01/2024', 1), rank('01/03/2024', 2)]
  const months = buildTrainingJourney(records, ranks, 'sessions')
  assert.deepEqual(months.map(month => month.total), [0, 1, 0])
  assert.deepEqual(months.map(month => month.cumulative), [0, 1, 1])
  assert.deepEqual(months[2].ranks.map(record => record.id), [2, 3])
})
test('empty and rank-only datasets', () => {
  assert.deepEqual(buildTrainingJourney([], [], 'hours'), [])
  assert.equal(buildTrainingJourney([], [rank('03/01/2024')], 'hours')[0].total, 0)
})
test('independent multi-year reconciliation of every monthly style subtotal and running total', () => {
  const records = Array.from({ length: 250 }, (_, index) => ({ id: index, date: new Date(2020 + index % 5, index % 12, 1 + index % 27, index % 24), duration: 20 + index % 100, style: ['Gi', 'NoGi', 'Other'][index % 3], classType: 'Class', instructor: 'Coach', venue: 'Gym' })).reverse()
  for (const metric of ['hours', 'sessions']) {
    let running = 0
    for (const month of buildTrainingJourney(records, [], metric)) {
      const reference = records.filter(record => record.date.getFullYear() === month.date.getFullYear() && record.date.getMonth() === month.date.getMonth())
      const units = reference.reduce((sum, record) => sum + (metric === 'hours' ? record.duration : 1), 0)
      running += units
      assert.equal(month.total, units / (metric === 'hours' ? 60 : 1))
      assert.equal(month.cumulative, running / (metric === 'hours' ? 60 : 1))
      for (const [index, style] of ['Gi', 'NoGi', 'Other'].entries()) assert.equal(month.values[index], reference.filter(record => record.style === style).reduce((sum, record) => sum + (metric === 'hours' ? record.duration : 1), 0) / (metric === 'hours' ? 60 : 1))
    }
  }
})
test('Gymdesk CSV header layout reconciles attendance and rank rows separately', () => {
  const csv = Papa.unparse([
    { Training: 'Fundamentals - Gi - Academy | Coach', 'Date / Time / Duration': 'Dec 31, 2023 11:59 PM 1h 30m', 'Record Type': 'attendance', Rank: '', 'Promotion Date': '' },
    { Training: 'Fundamentals - NoGi - Academy | Coach', 'Date / Time / Duration': 'Jan 1, 2024 12:00 AM 30m', 'Record Type': 'attendance', Rank: '', 'Promotion Date': '' },
    { Training: '', 'Date / Time / Duration': '', 'Record Type': 'rank', Rank: 'B-2', 'Promotion Date': '03/01/2024' },
  ])
  const rows = Papa.parse(csv, { header: true }).data
  const records = rows.filter(row => row['Record Type'] !== 'rank').map((row, index) => parseSession(row.Training, row['Date / Time / Duration'], index, row['Date / Time / Duration']))
  const { ranks } = ranksFromCsvRows(rows)
  assert.equal(ranks.length, 1)
  assert.equal(ranks[0].date.getMonth(), 0)
  assert.equal(ranks[0].date.getDate(), 3)
  assert.deepEqual(buildTrainingJourney(records, ranks, 'hours').map(month => month.total), [1.5, .5])
  assert.equal(buildTrainingJourney(records, ranks, 'sessions').at(-1).cumulative, 2)
})
test('local storage round trip preserves calendar dates and uncertainty metadata', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const records = [session('Gi', '31/12/2023 11:59 PM', '60m'), session('NoGi', '01/01/2024', '')]
  assert.equal(saveCsvImport({ fileName: 'fixture.csv', sessions: records, ranks: [rank('03/01/2024')] }, storage), true)
  const loaded = loadCsvImport(storage)
  assert.equal(loaded.sessions[0].date.getDate(), 31)
  assert.equal(loaded.sessions[1].timeRecorded, false)
  assert.equal(loaded.sessions[1].durationEstimated, true)
  assert.equal(loaded.ranks[0].date.getDate(), 3)
})
test('rendered month details conserve classes, coaches, venues, days, hours and time counts', () => {
  const Journey = load('src/components/TrainingJourney.tsx').default
  const records = [session('Gi', 'Jan 3, 2024 7:00 AM', '90m', 1), session('NoGi', 'Jan 3, 2024 6:00 PM', '30m', 2), session('Gi', 'Jan 4, 2024', '60m', 3), session('Gi', 'Jan 5, 2024 12:00 PM', '30m', 4)]
  const markup = renderToStaticMarkup(createElement(Journey, { sessions: records, ranks: [rank('03/01/2024')] }))
  assert.match(markup, /4 sessions · 3.5 hours · 3 training days · 3.5 hours to date/)
  for (const name of ['Fundamentals', 'Coach', 'Academy']) assert.ok(markup.includes(`<span>${name}</span><strong>4</strong>`))
  for (const label of ['Morning (before 12)', 'Afternoon (12–17)', 'Evening (17 onwards)', 'Time not recorded / unverified']) assert.ok(markup.includes(`<span>${label}</span><strong>1</strong>`))
  assert.match(markup, /03\/01\/2024/)
  assert.match(markup, /running total 3.5 hours/)
})
test('rendered uncertainty notes identify style allocation and missing duration defaults', () => {
  const Journey = load('src/components/TrainingJourney.tsx').default
  const records = allocateTrainingStyles([session('Gi', 'Jan 1, 2024', '90m', 1), session('NoGi', 'Jan 2, 2024', '30m', 2), session('', 'Jan 3, 2024', '', 3)]).sessions
  const markup = renderToStaticMarkup(createElement(Journey, { sessions: records, ranks: [] }))
  assert.match(markup, /1 unlabeled sessions have estimated styles/)
  assert.match(markup, /1 sessions have no recorded duration/)
  assert.match(markup, /Time not recorded \/ unverified<\/span><strong>3<\/strong>/)
})
test('older saved imports use their retained timestamps without needing reimport', () => {
  const Journey = load('src/components/TrainingJourney.tsx').default
  const records = [session('Gi', 'Jan 3, 2024 7:19 AM', '60m', 1), session('Gi', 'Jan 4, 2024 12:30 PM', '60m', 2), session('NoGi', 'Jan 5, 2024 5:41 PM', '60m', 3)].map(({ timeRecorded, ...record }) => record)
  assert.ok(records.every(sessionHasRecordedTime))
  const markup = renderToStaticMarkup(createElement(Journey, { sessions: records, ranks: [] }))
  for (const label of ['Morning (before 12)', 'Afternoon (12–17)', 'Evening (17 onwards)']) assert.ok(markup.includes(`<span>${label}</span><strong>1</strong>`))
  assert.match(markup, /Time not recorded \/ unverified<\/span><strong>0<\/strong>/)
  assert.equal(sessionHasRecordedTime({ date: new Date(2024, 0, 1), timeRecorded: true }), true)
  assert.equal(sessionHasRecordedTime({ date: new Date(2024, 0, 1), timeRecorded: false }), false)
  assert.equal(sessionHasRecordedTime({ date: new Date(2024, 0, 1) }), false)
  assert.equal(sessionHasRecordedTime({ date: new Date(2024, 0, 1, 7), timeRecorded: false }), false)
})

test('supplied CSV time groups match independently parsed source times, including older imports', { skip: !process.env.JOURNEY_VERIFY_CSV }, () => {
  const rows = Papa.parse(fs.readFileSync(process.env.JOURNEY_VERIFY_CSV, 'utf8'), { header: true, skipEmptyLines: 'greedy' }).data.filter(row => row['Record Type'] !== 'rank')
  const reference = new Map()
  const records = rows.map((row, index) => {
    const raw = row['Date / Time / Duration']
    const time = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
    assert.ok(time, `Attendance row ${index} must have a source time`)
    const hour = Number(time[1]) % 12 + (time[3] === 'PM' ? 12 : 0)
    const parsed = parseSession(row.Training, raw, index, raw)
    assert.ok(parsed, `Attendance row ${index} must parse`)
    assert.equal(parsed.date.getHours(), hour)
    assert.equal(parsed.date.getMinutes(), Number(time[2]))
    const key = raw.match(/^([A-Za-z]+) \d+, (\d{4})/).slice(1).join(' ')
    const counts = reference.get(key) ?? [0, 0, 0]
    counts[hour < 12 ? 0 : hour < 17 ? 1 : 2]++
    reference.set(key, counts)
    return parsed
  })
  const legacy = records.map(({ timeRecorded, ...record }) => record)
  for (const input of [records, legacy]) {
    for (const month of buildTrainingJourney(input, [], 'sessions')) {
      const key = month.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const expected = reference.get(key) ?? [0, 0, 0]
      assert.ok(month.records.every(sessionHasRecordedTime))
      const actual = [0, 0, 0]
      month.records.forEach(record => { const hour = record.date.getHours(); actual[hour < 12 ? 0 : hour < 17 ? 1 : 2]++ })
      assert.deepEqual(actual, expected, key)
    }
  }
  console.log(`Verified source times for ${records.length} attendance rows across ${reference.size} active months; ${legacy.filter(record => !sessionHasRecordedTime(record)).length} legacy times unverified.`)
  const september = reference.get('Sep 2026')
  if (september) console.log(`September 2026: morning ${september[0]}, afternoon ${september[1]}, evening ${september[2]}.`)
})
