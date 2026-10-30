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
        window.transitionFrames.push({ time: performance.now() - start, height: host.getBoundingClientRect().height, active: host.dataset.transitioning === 'true', scroll: scrollY })
        if (performance.now() - start < 2500) window.transitionFrame = requestAnimationFrame(sample)
      }
      window.transitionFrame = requestAnimationFrame(sample)
    })
    const buttonBefore = await demo.boundingBox()
    await demo.click()
    await page.waitForFunction(() => document.querySelector('.overview-setup-region').dataset.transitioning === 'true')
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.transitionFrame); return window.transitionFrames })
    const finalHeight = await page.locator('.overview-setup-region').evaluate(element => element.getBoundingClientRect().height)
    assert.ok(initialHeight - finalHeight > 100)
    const intermediate = frames.filter(frame => frame.active && frame.height > finalHeight + 5 && frame.height < initialHeight - 5)
    assert.ok(new Set(intermediate.map(frame => frame.height)).size >= 4, `${width}px must animate intermediate layout heights`)
    assert.ok(frames.every(frame => frame.scroll === 0), `${width}px must not move the viewport`)
    const buttonAfter = await demo.boundingBox()
    assert.ok(Math.abs(buttonBefore.x - buttonAfter.x) <= 1, `${width}px demo toggle must stay anchored`)
    assert.equal(await page.evaluate(() => window.originalControls === document.querySelector('.overview-setup-content') && window.originalInput === document.querySelector('input[type=file]') && window.originalCard === document.querySelector('.stat-card')), true, 'controls and cards must not remount')
    assert.equal(await settings.getAttribute('aria-expanded'), 'false')
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden && element.inert), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `${artifacts}/overview-${width}.png` })

    // Opening and closing settings keeps the same controls and native keyboard access.
    await settings.click()
    await page.waitForFunction(() => !document.querySelector('.overview-setup-region').dataset.transitioning)
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
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), true)
    await settings.click()
    assert.equal(await page.locator('.overview-setup-content').evaluate(element => element.hidden), false)
    assert.equal(await page.locator('.overview-setup-region').evaluate(element => element.style.height), '')
    assert.deepEqual(errors, [])
    console.log(`${width}px passed: continuous height animation, anchored toggle, preserved DOM, keyboard settings, reversal, resize, reduced motion, and no horizontal overflow.`)
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
