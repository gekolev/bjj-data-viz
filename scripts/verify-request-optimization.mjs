// Optional browser integration checks. Uses an installed Playwright package and Chrome.
// See docs/request-optimization-validation.md for setup and invocation.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer, preview } from 'vite'
import { unzipSync } from 'fflate'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) })
const production = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
const development = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } })
await development.listen()
const productionUrl = production.resolvedUrls.local[0]
const developmentUrl = development.resolvedUrls.local[0]
const artifactDirectory = 'node_modules/.tmp/request-optimization'
await mkdir(artifactDirectory, { recursive: true })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = [], requests = [], emails = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  // No real email or cloud writes are made by these checks.
  await page.route('**/api/wrapped/email', async route => {
    emails.push({ headers: route.request().headers(), body: route.request().postDataJSON() })
    await route.fulfill({ status: emails.length === 1 ? 504 : 200, contentType: 'application/json', body: JSON.stringify(emails.length === 1 ? { error: 'Test timeout; retry this recap.' } : { success: true }) })
  })
  await page.goto(productionUrl)
  await page.getByRole('button', { name: 'Demo data', exact: true }).waitFor()
  assert.ok(!requests.some(url => /\/assets\/(DevPage-|YearWrapped-|exportRecap-|gymdesk-all-attendance-)/.test(url)), 'optional features must not load on the initial overview')
  assert.ok(!requests.some(url => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)))
  await page.getByRole('button', { name: 'Demo data', exact: true }).click()
  await page.locator('.overview-period-count').filter({ hasText: '541' }).waitFor({ state: 'attached' })
  assert.ok(requests.some(url => /gymdesk-all-attendance-/.test(url)))
  await page.getByRole('button', { name: 'Year Wrapped', exact: true }).click()
  await page.locator('.wrap-card').first().waitFor()
  assert.ok(!requests.some(url => /\/assets\/exportRecap-/.test(url)), 'export code must wait for an export action')
  await page.locator('#wrapped-email').fill('athlete@example.com')
  await page.getByRole('button', { name: 'Email my Wrapped', exact: true }).click()
  await page.getByText('Test timeout; retry this recap.').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Email my Wrapped', exact: true }).click()
  await page.getByText(/has been submitted for delivery/).waitFor({ timeout: 60_000 })
  assert.equal(emails.length, 2)
  assert.equal(emails[0].headers['idempotency-key'], emails[1].headers['idempotency-key'])
  assert.deepEqual(emails[0].body, emails[1].body)
  const desktopCard = Buffer.from(emails[0].body.attachments[0].content, 'base64')
  await writeFile(`${artifactDirectory}/email-card-desktop.png`, desktopCard)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save recap', exact: true }).click()
  const zip = await download
  assert.match(zip.suggestedFilename(), /\.zip$/)
  await zip.saveAs(`${artifactDirectory}/recap.zip`)
  const highResolutionBytes = Object.values(unzipSync(await readFile(`${artifactDirectory}/recap.zip`))).reduce((total, bytes) => total + bytes.length, 0)
  const emailImageBytes = emails[0].body.attachments.reduce((total, file) => total + Buffer.from(file.content, 'base64').length, 0)
  console.log(`Desktop email PNG bytes: ${emailImageBytes}; high-resolution download PNG bytes: ${highResolutionBytes}`)
  await page.getByText(/Your ZIP download is ready/).waitFor()
  await page.getByRole('button', { name: '3D Data Lab', exact: true }).click()
  await page.locator('.calendar-stage').waitFor()
  await page.getByRole('button', { name: 'Get your CSV', exact: true }).click()
  await page.locator('.instructions-page').waitFor()
  await page.goto(`${productionUrl}welcome`)
  await page.getByRole('button', { name: /explore/i }).first().waitFor()
  for (const path of ['wrapped', 'instructions', 'dev']) {
    await page.goto(productionUrl + path)
    await page.getByRole('button', { name: 'Demo data', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Reload app', exact: true }).count(), 0)
  }
  // Mobile email uses a smaller render while downloads retain their original size.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(productionUrl)
  await page.getByRole('button', { name: 'Demo data', exact: true }).click()
  await page.locator('.overview-period-count').filter({ hasText: '541' }).waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Wrapped', exact: true }).click()
  await page.locator('#wrapped-email').fill('athlete@example.com')
  await page.getByRole('button', { name: 'Email my Wrapped', exact: true }).click()
  await page.getByText(/has been submitted for delivery/).waitFor({ timeout: 60_000 })
  const mobileCard = Buffer.from(emails.at(-1).body.attachments[0].content, 'base64')
  assert.equal(mobileCard.readUInt32BE(16), 720)
  assert.equal(mobileCard.readUInt32BE(20), 1280)
  await writeFile(`${artifactDirectory}/email-card-mobile.png`, mobileCard)
  assert.deepEqual(errors, [])
  console.log('Production browser checks passed: lazy chunks, local fonts, desktop/mobile email PNGs, identical retry payloads, ZIP export, optional pages.')
  console.log(`Mocked desktop email payload: ${JSON.stringify(emails[0].body).length} bytes`)

  // Use the real hook and React, with transport and account seams mocked at HTTP
  // module boundaries. Cloud-model and Firestore merge behavior have Node tests.
  const warm = await browser.newPage()
  await warm.goto(developmentUrl)
  await warm.getByRole('button', { name: 'Demo data', exact: true }).waitFor()
  await warm.close()
  const sync = await browser.newPage()
  sync.on('pageerror', error => console.error('Hook fixture:', error.message))
  await sync.route('**/src/components/AccountContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useAccount = () => ({user: window.harness.user});' }))
  await sync.route('**/src/lib/firebase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const auth = { currentUser: null };' }))
  await sync.route('**/src/lib/cloudStorage.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const loadCloudCache = uid => window.harness.cache[uid] ?? {};
    export function createCloudCacheWriter(uid) {
      let pending;
      return {schedule: records => { pending = records; }, flush: () => { if (pending) { window.harness.cache[uid] = pending; window.harness.cacheWrites++; pending = null; } }};
    }
    export function subscribeRecords(uid, cached, next, fail) {
      const listener = {uid, cached, next, fail, stopped:false};
      window.harness.listeners.push(listener);
      return () => { listener.stopped = true; };
    }
    export const commitChanges = () => new Promise(resolve => { window.harness.resolveSave = resolve; });
  ` }))
  const html = `<!doctype html><div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import {useTrainingWorkspace} from '/src/lib/useTrainingWorkspace.ts';
    const record = {kind:'manual', data:{id:1,date:'2026-10-08T12:00:00.000Z',training:'Training',duration:60,style:'Gi',classType:'Training',venue:'',instructor:'',notes:''}, revision:1,deleted:false,fileName:'',updatedAt:{seconds:100,nanoseconds:1}};
    window.harness = {user:{uid:'alice',emailVerified:true},cache:{alice:{a:record},bob:{}},listeners:[],cacheWrites:0};
    function View() { window.workspace = useTrainingWorkspace(); return React.createElement('p',null,window.workspace.manualData.sessions.length); }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.mount = uid => { window.harness.user = {uid,emailVerified:true}; root.render(React.createElement(View,{key:uid})); };
    window.mount('alice');
  </script>`
  // Warm the dev dependency optimizer before serving the isolated hook fixture.
  await sync.route('**/sync-test', route => route.fulfill({ contentType: 'text/html', body: html }))
  await sync.goto(developmentUrl + 'sync-test')
  await sync.waitForFunction(() => window.harness?.listeners.length === 1)
  assert.equal(await sync.evaluate(() => window.workspace.manualData.sessions.length), 1, 'cache hydrates before any network response')
  assert.equal(await sync.evaluate(() => window.workspace.ready), false)
  await sync.evaluate(() => { const listener = window.harness.listeners.at(-1); listener.next(listener.cached, false, false) })
  await sync.waitForFunction(() => window.workspace.ready)
  const oldSessions = await sync.evaluate(() => { window.previousSessions = window.workspace.manualData.sessions; return window.workspace.manualData.sessions.length })
  assert.equal(oldSessions, 1)
  await sync.evaluate(() => { const listener = window.harness.listeners.at(-1); listener.next(listener.cached, false, false) })
  assert.equal(await sync.evaluate(() => window.previousSessions === window.workspace.manualData.sessions), true)
  await sync.evaluate(() => {
    const listener = window.harness.listeners.at(-1)
    const a = {...listener.cached.a, revision:2, updatedAt:{seconds:200,nanoseconds:7}}
    listener.next({a}, false, true)
    // A newer SDK-only row must not become the reconnect checkpoint.
    listener.next({a, sdkOnly:{...a,updatedAt:{seconds:900,nanoseconds:1}}}, true, true)
  })
  // A long hidden interval rebases from the latest server-confirmed records.
  await sync.evaluate(() => {
    window.testNow = Date.now(); Date.now = () => window.testNow;
    Object.defineProperty(document, 'hidden', {configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));
    window.testNow += 300_001;
    Object.defineProperty(document, 'hidden', {configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange'));
  })
  await sync.waitForFunction(() => window.harness.listeners.length === 2)
  assert.equal(await sync.evaluate(() => window.harness.listeners.at(-1).cached.a.updatedAt.seconds), 200)
  assert.equal(await sync.evaluate(() => window.harness.listeners.at(-1).cached.sdkOnly), undefined)
  assert.equal(await sync.evaluate(() => window.harness.listeners.filter(listener => !listener.stopped).length), 1)
  await sync.evaluate(() => window.harness.listeners[0].next({}, false, true))
  assert.equal(await sync.evaluate(() => window.workspace.manualData.sessions.length), 1, 'obsolete callbacks must be ignored')
  await sync.evaluate(() => { const listener = window.harness.listeners.at(-1); listener.next(listener.cached, false, false) })
  await sync.waitForFunction(() => window.workspace.ready)
  // A reconnect while a save is pending waits for that save to settle.
  await sync.evaluate(() => {
    void window.workspace.updateManual(window.workspace.manualData.sessions.map(row => ({...row,duration:90})));
    window.workspace.retry(); window.workspace.resync();
    Object.defineProperty(navigator, 'onLine', {configurable:true,value:false}); window.dispatchEvent(new Event('offline'));
    Object.defineProperty(navigator, 'onLine', {configurable:true,value:true}); window.dispatchEvent(new Event('online'));
  })
  assert.equal(await sync.evaluate(() => window.harness.listeners.length), 2)
  await sync.evaluate(() => window.harness.resolveSave())
  await sync.waitForFunction(() => window.harness.listeners.length === 3)
  // An empty full resync replaces a stale durable cache, including its cursor.
  await sync.evaluate(() => window.workspace.resync())
  await sync.waitForFunction(() => window.harness.listeners.length === 4)
  assert.deepEqual(await sync.evaluate(() => window.harness.listeners.at(-1).cached), {})
  await sync.evaluate(() => { window.harness.listeners.at(-1).next({}, false, false); window.dispatchEvent(new Event('pagehide')) })
  assert.deepEqual(await sync.evaluate(() => window.harness.cache.alice), {})
  await sync.evaluate(() => window.mount('bob'))
  await sync.waitForFunction(() => window.harness.listeners.at(-1).uid === 'bob')
  assert.equal(await sync.evaluate(() => window.workspace.manualData.sessions.length), 0)
  assert.equal(await sync.evaluate(() => window.harness.listeners.filter(listener => !listener.stopped).length), 1)
  const beforeHiddenReconnect = await sync.evaluate(() => window.harness.listeners.length)
  await sync.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(navigator, 'onLine', {configurable:true,value:false}); window.dispatchEvent(new Event('offline'));
    Object.defineProperty(navigator, 'onLine', {configurable:true,value:true}); window.dispatchEvent(new Event('online'));
  })
  assert.equal(await sync.evaluate(() => window.harness.listeners.length), beforeHiddenReconnect)
  await sync.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange'));
  })
  await sync.waitForFunction(count => window.harness.listeners.length === count + 1, beforeHiddenReconnect)
  console.log('React hook integration checks passed: immediate hydration, metadata identity, listener rebasing, stale callbacks, pending saves, full resync, and account isolation.')
} finally {
  await browser.close()
  await development.close()
  await new Promise(resolve => production.httpServer.close(resolve))
}
