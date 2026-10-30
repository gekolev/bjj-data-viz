// Uses the same optional Playwright/browser setup as verify-request-optimization.mjs.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { preview } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) })
const artifacts = 'node_modules/.tmp/overview-transition'
await mkdir(artifacts, { recursive: true })

try {
  for (const width of [1440, 1024, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    const demo = page.getByRole('button', { name: 'Demo data', exact: true })
    const settings = page.getByRole('button', { name: 'Overview settings & training data', exact: true })
    await demo.waitFor()
    await settings.waitFor()
    assert.equal(await settings.getAttribute('aria-expanded'), 'true', 'empty overview must use the same expanded settings panel')
    const panelClass = await page.locator('.overview-setup-region').getAttribute('class')
    assert.ok(panelClass.includes('overview-setup'))
    await page.evaluate(() => document.fonts.ready)
    const initialHeight = await page.locator('.overview-setup-region').evaluate(element => element.getBoundingClientRect().height)
    await page.evaluate(() => {
      window.originalControls = document.querySelector('.overview-setup-content')
      window.originalInput = document.querySelector('input[type=file]')
      window.originalCard = document.querySelector('.stat-card')
      window.transitionFrames = []
      const start = performance.now()
      function sample() {
        const host = document.querySelector('.overview-setup-region')
        window.transitionFrames.push({ time: performance.now() - start, height: host.getBoundingClientRect().height, active: host.dataset.transitioning === 'true', scroll: scrollY,
          values: Array.from(document.querySelectorAll('.stat-card .count-up-display'), element => element.textContent),
          targets: Array.from(document.querySelectorAll('.stat-card .count-up .visually-hidden'), element => element.textContent),
          widths: Array.from(document.querySelectorAll('.stat-card .count-up'), element => element.getBoundingClientRect().width),
        })
        if (performance.now() - start < 4000) window.transitionFrame = requestAnimationFrame(sample)
      }
      window.transitionFrame = requestAnimationFrame(sample)
    })
    const buttonBefore = await demo.boundingBox()
    await demo.click()
    await page.waitForFunction(() => document.querySelector('.overview-setup-region').dataset.transitioning === 'true')
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.stat-card .count-up')).every(element => element.querySelector('.count-up-display').textContent === element.querySelector('.visually-hidden').textContent))
    assert.deepEqual(await page.locator('.stat-card .count-up-display').allTextContents(), ['541', '577', '50', '1h 4m', '3', '326', '215'])
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.transitionFrame); return window.transitionFrames })
    const finalHeight = await page.locator('.overview-setup-region').evaluate(element => element.getBoundingClientRect().height)
    assert.ok(initialHeight - finalHeight > 100)
    const intermediate = frames.filter(frame => frame.active && frame.height > finalHeight + 5 && frame.height < initialHeight - 5)
    assert.ok(new Set(intermediate.map(frame => frame.height)).size >= 4, `${width}px must animate intermediate layout heights`)
    assert.ok(frames.every(frame => frame.scroll === 0), `${width}px must not move the viewport`)
    const dataFrames = frames.filter(frame => frame.targets[0] === '541')
    assert.ok(dataFrames.some(frame => frame.values[0] === '0'), 'loaded session count must start at zero')
    for (const index of [0, 1, 2, 4, 5, 6]) {
      const values = dataFrames.map(frame => Number(frame.values[index]))
      const target = Number(dataFrames.at(-1).targets[index])
      assert.ok(values.some(value => value > 0 && value < target), `metric ${index} must show intermediate values`)
      assert.ok(values.every((value, i) => value >= 0 && value <= target && (i === 0 || value >= values[i - 1])), 'count-ups must be monotonic and bounded')
    }
    for (let index = 0; index < 7; index++) {
      const widths = dataFrames.map(frame => frame.widths[index])
      assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, 'number widths must be reserved while counting')
    }
    const buttonAfter = await demo.boundingBox()
    assert.ok(Math.abs(buttonBefore.x - buttonAfter.x) <= 1, `${width}px demo toggle must stay anchored`)
    assert.equal(await page.evaluate(() => window.originalControls === document.querySelector('.overview-setup-content') && window.originalInput === document.querySelector('input[type=file]') && window.originalCard === document.querySelector('.stat-card')), true, 'controls and cards must not remount')
    assert.equal(await settings.getAttribute('aria-expanded'), 'false')
    assert.equal(await page.locator('.overview-setup-region').getAttribute('class'), panelClass, 'loading data must retain the same panel styling')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden && element.inert), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (width <= 820) {
      const navigation = await page.locator('.mobile-navigation button').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect(), label = element.querySelector('span')
        return { x: box.x, y: box.y, width: box.width, height: box.height, labelFits: label.scrollWidth <= label.clientWidth + 1 }
      }))
      assert.equal(navigation.length, 6)
      assert.ok(navigation.every(item => Math.abs(item.y - navigation[0].y) < 1 && item.width >= 44 && item.height >= 44 && item.labelFits), 'all six navigation items must fit on one accessible row')
      assert.ok(navigation.every(item => item.x >= 0 && item.x + item.width <= width + 1))
      assert.ok((await page.locator('.mobile-navigation').boundingBox()).height <= 70)
    }
    await page.screenshot({ path: `${artifacts}/overview-${width}.png` })

    // Opening and closing settings keeps the same controls and native keyboard access.
    await settings.click()
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    assert.deepEqual(await page.locator('.stat-card .count-up-display').allTextContents(), ['541', '577', '50', '1h 4m', '3', '326', '215'], 'unrelated settings changes must not restart counters')
    assert.equal(await settings.getAttribute('aria-expanded'), 'true')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden || element.inert), false)
    await settings.press('Space')
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    assert.equal(await settings.getAttribute('aria-expanded'), 'false')

    // Reverse an in-flight demo transition, then resize during another one.
    await demo.click()
    await page.waitForFunction(() => document.querySelector('.overview-setup-region').dataset.transitioning === 'true')
    await demo.click()
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    assert.equal(await demo.getAttribute('aria-pressed'), 'true')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), true)
    await demo.click()
    await page.waitForFunction(() => document.querySelector('.overview-setup-region').dataset.transitioning === 'true')
    await page.setViewportSize({ width: width + 10, height: 1000 })
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    assert.equal(await page.locator('.overview-setup-region').evaluate(element => element.style.height), '')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), false)

    // Model data arriving after the user has focused a setup control.
    await page.locator('.overview-period-select select').focus()
    await demo.evaluate(element => element.click())
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning && document.querySelector('.overview-setup-content').hidden)
    assert.equal(await settings.evaluate(element => document.activeElement === element), true, 'automatic collapse must retain keyboard focus')
    await demo.click()
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)

    // Reduced motion changes states immediately, without clipping or stale transforms.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demo.click()
    await settings.waitFor()
    assert.equal(await page.locator('.overview-setup-region').getAttribute('data-transitioning'), null)
    assert.deepEqual(await page.locator('.stat-card .count-up-display').allTextContents(), ['541', '577', '50', '1h 4m', '3', '326', '215'], 'reduced motion must show final counts immediately')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), true)
    await settings.click()
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), false)
    assert.equal(await page.locator('.overview-setup-region').evaluate(element => element.style.height), '')
    if (width === 1440) {
      // Import real CSV data while a previous count-up may still be running.
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.locator('input[type=file]').setInputFiles({ name: 'counter-check.csv', mimeType: 'text/csv', buffer: Buffer.from('Training,Date / Time / Duration\n"Fundamentals - Gi - Gym | Coach","Oct 1, 2026 8:00 AM 1h 30m"\n"Fundamentals - NoGi - Gym | Coach","Oct 2, 2026 8:00 AM 1h"\n') })
      await page.waitForFunction(() => document.querySelector('.stat-card .count-up .visually-hidden')?.textContent === '2')
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.stat-card .count-up')).every(element => element.querySelector('.count-up-display').textContent === element.querySelector('.visually-hidden').textContent))
      assert.deepEqual(await page.locator('.stat-card .count-up-display').allTextContents(), ['2', '2', '30', '1h 15m', '2', '1', '1'])
      assert.equal(await settings.getAttribute('aria-expanded'), 'false', 'uploading CSV must collapse an already-open demo settings panel')
      await settings.click()
      await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
      // Re-uploading with the same totals must still auto-collapse the panel.
      await page.locator('input[type=file]').setInputFiles({ name: 'counter-check.csv', mimeType: 'text/csv', buffer: Buffer.from('Training,Date / Time / Duration\n"Fundamentals - Gi - Gym | Coach","Oct 1, 2026 8:00 AM 1h 30m"\n"Fundamentals - NoGi - Gym | Coach","Oct 2, 2026 8:00 AM 1h"\n') })
      await page.waitForFunction(() => document.querySelector('.overview-setup-toggle').getAttribute('aria-expanded') === 'false' && !document.querySelector('.overview-setup-region').dataset.transitioning)
      assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), true)
    }
    assert.deepEqual(errors, [])
    console.log(`${width}px passed: smooth layout, count-up targets/widths, keyboard settings, reversal, resize, reduced motion, and single-row mobile navigation.`)
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
