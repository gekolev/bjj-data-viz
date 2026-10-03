import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Load real TSX components without a browser; verify rendered chart semantics.
const modules = new Map()
function compiledUrl(file) {
  if (modules.has(file.href)) return modules.get(file.href)
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  })
  const code = outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    if (!specifier.startsWith('.')) return `from ${quote}${import.meta.resolve(specifier)}${quote}`
    const target = ['.tsx', '.ts'].map(extension => new URL(`${specifier}${extension}`, file)).find(existsSync)
    if (!target) throw new Error(`Unresolved component dependency: ${specifier}`)
    return `from ${quote}${compiledUrl(target)}${quote}`
  })
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  modules.set(file.href, url)
  return url
}
const load = async path => import(compiledUrl(new URL(path, import.meta.url)))
const { ranksFromCsvRows } = await load('../src/lib/rankHistory.ts')
const { default: TrainingTimeline } = await load('../src/components/TrainingTimeline.tsx')
const { default: TrainingCalendar } = await load('../src/TrainingCalendar.tsx')
const { default: RankTimeline } = await load('../src/components/RankTimeline.tsx')
const ranks = ranksFromCsvRows([
  { 'Record Type': 'rank', Rank: 'W-4 W-4 - BJJ', 'Promotion Date': '20/09/2024 Promoted', Discipline: 'BJJ' },
  { 'Record Type': 'rank', Rank: 'B-0 B-0 - BJJ', 'Promotion Date': '09/06/2025 Promoted', Discipline: 'BJJ' },
]).ranks
const sessions = [{ id: 1, date: new Date(2025, 5, 10, 18), duration: 60, style: 'NoGi', classType: 'Beginners', instructor: 'Coach', venue: 'Gym' }]

test('the training timeline includes promotion-only years and milestones without adding attendance dots', () => {
  const html = renderToStaticMarkup(createElement(TrainingTimeline, { ranks, sessions, styleFilter: 'All styles', query: '' }))
  assert.equal((html.match(/<circle /g) ?? []).length, 1)
  assert.equal((html.match(/<path [^>]*role="button"/g) ?? []).length, 2)
  assert.ok(html.includes('2024'))
  assert.ok(html.includes('Promotion B-0, Blue belt · 0 stripes, 09/06/2025'))
  assert.ok(html.includes('White belt · 4 stripes'))
  assert.ok(html.includes('1 of 1 sessions'))
})

test('the calendar marks a promotion day with zero training while preserving practice totals', () => {
  const html = renderToStaticMarkup(createElement(TrainingCalendar, { ranks, sessions, year: 2025, years: [2025], onYearChange() {}, styleFilter: 'All styles', query: '' }))
  assert.equal((html.match(/class="contribution-day /g) ?? []).length, 365)
  assert.ok(html.includes('rank-promotion-day'))
  assert.ok(html.includes('Monday, June 9, 2025: 0 practices, 0 minutes, promotion: Blue belt · 0 stripes'))
  assert.ok(html.includes('1 practice in 2025'))
})

test('rank milestones display decoded belt names, stripes, and their exact dates', () => {
  const html = renderToStaticMarkup(createElement(RankTimeline, { ranks }))
  assert.ok(html.includes('White belt · 4 stripes'))
  assert.ok(html.includes('Blue belt · 0 stripes'))
  assert.ok(html.includes('dateTime="2025-06-09"') || html.includes('datetime="2025-06-09"'))
  assert.ok(!html.includes('W-4 W-4 - BJJ'))
})
