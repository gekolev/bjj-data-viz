import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('exports from the current gym, reads fetched cells, deduplicates, and stops repeated pages', async () => {
  const source = readFileSync(new URL('../gymdesk-scrape.js', import.meta.url), 'utf8')
  const pages = [
    [['Fundamentals - NoGi | Coach "A"', 'Oct 1, 2026 5:42 PM 1h 10m']],
    [['Fundamentals - NoGi | Coach "A"', 'Oct 1, 2026 5:42 PM 1h 10m'], ['Advanced - Gi | Coach B', 'Sep 30, 2026 5:46 PM 1h 20m']],
  ]
  const requests = []
  let exportedBlob
  let downloadedName
  let clicked = false
  class TestURL extends URL {
    static createObjectURL(blob) { exportedBlob = blob; return 'blob:attendance' }
    static revokeObjectURL() {}
  }
  const context = {
    window: { location: { origin: 'https://my-own-gym.gymdesk.com' } },
    console: { log() {} }, URL: TestURL, Blob,
    Date: class extends Date {
      constructor() { super(2026, 9, 3, 0, 15) }
    },
    fetch: async (url, options) => {
      requests.push({ url, options })
      return { ok: true, text: async () => String(Math.min(requests.length - 1, 1)) }
    },
    DOMParser: class {
      parseFromString(page) {
        const rows = pages[Number(page)].map(cells => ({ querySelectorAll: () => cells.map(textContent => ({ textContent })) }))
        const table = { querySelectorAll: () => rows }
        return { querySelectorAll: () => [table] }
      }
    },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ set download(value) { downloadedName = value }, click() { clicked = true }, remove() {} }),
    },
  }
  await vm.runInNewContext(source, context)
  assert.equal(requests.length, 3)
  assert.ok(requests.every(request => request.url.startsWith('https://my-own-gym.gymdesk.com/members/attendance?') && request.options.credentials === 'include'))
  assert.equal(downloadedName, 'gymdesk-all-attendance-2026-10-03.csv')
  assert.ok(clicked)
  const csv = await exportedBlob.text()
  assert.equal(csv.trim().split('\n').length, 3)
  assert.ok(csv.includes('Coach ""A""'))
  assert.ok(csv.includes('"Training","Date / Time / Duration"'))
})
