import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { handleEmail } from '../worker/index.mjs'

const origin = 'https://matmetrics.example'
const payload = () => ({ email: 'athlete@example.com', year: 2026, attachments: Array.from({ length: 9 }, (_, i) => ({ filename: `${String(i + 1).padStart(2, '0')}-card-2026.png`, content: 'iVBORw0KGgo=' })) })
const request = (data = payload(), headers = {}) => new Request(`${origin}/api/wrapped/email`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) })
const env = { RESEND_API_KEY: 'test-server-secret', WRAPPED_EMAIL_FROM: 'Training <wrapped@example.com>', WRAPPED_EMAIL_LIMITER: { limit: async () => ({ success: true }) } }

test('embeds nine cards in the email body and keeps nine downloadable PNG attachments', async () => {
  const response = await handleEmail(request(), env, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options.headers.Authorization, 'Bearer test-server-secret')
    const body = JSON.parse(options.body)
    assert.deepEqual(body.to, ['athlete@example.com'])
    assert.equal(body.attachments.length, 18)
    const inline = body.attachments.filter(file => file.content_id)
    const downloads = body.attachments.filter(file => !file.content_id)
    assert.equal(inline.length, 9)
    assert.equal(downloads.length, 9)
    assert.equal((body.html.match(/<img /g) ?? []).length, 9)
    assert.ok(body.html.includes('Your 2026 on the mat.'))
    assert.ok(body.text.includes('attached as PNG images'))
    inline.forEach((file, index) => {
      assert.ok(body.html.includes(`src="cid:${file.content_id}"`))
      assert.equal(file.content, downloads[index].content)
      assert.equal(downloads[index].filename, payload().attachments[index].filename)
    })
    assert.equal(new Set(inline.map(file => file.content_id)).size, 9)
    assert.equal(body.attachments[0].content_type, 'image/png')
    assert.equal(body.from, env.WRAPPED_EMAIL_FROM)
    return Response.json({ id: 'sent' })
  })
  assert.deepEqual(await response.json(), { success: true })
})
test('does not send when configuration is missing', async () => {
  assert.equal((await handleEmail(request(), {})).status, 503)
})

test('includes dated training totals, coverage, and data caveats in HTML and text', async () => {
  const summary = { latestTraining: '2026-09-30', sessions: 123, minutes: 7380, trainingDays: 100, sample: true, estimated: true }
  const response = await handleEmail(request({ ...payload(), summary }), env, async (_, options) => {
    const body = JSON.parse(options.body)
    for (const content of [body.html, body.text]) {
      assert.ok(content.includes('as of 30 September 2026'))
      assert.ok(content.includes('123 sessions | 123 mat hours | 100 training days'))
      assert.ok(content.includes('1 January 2026 through 30 September 2026'))
      assert.ok(content.includes('sample training data'))
      assert.ok(content.includes('Includes estimated'))
    }
    assert.ok(body.html.includes('01 / The work you put in'))
    assert.ok(body.html.includes('02 / How you trained'))
    assert.ok(body.html.includes('03 / Your training highlights'))
    return Response.json({ id: 'sent' })
  })
  assert.equal(response.status, 200)
})

test('rejects malformed, impossible, or wrong-year summary dates and HTML injection', async () => {
  const summary = { latestTraining: '2026-09-30', sessions: 123, minutes: 7380, trainingDays: 100, sample: false, estimated: false }
  for (const latestTraining of ['2026-02-30', '2025-09-30', '<img src=x>', 'invalid']) {
    assert.equal((await handleEmail(request({ ...payload(), summary: { ...summary, latestTraining } }), env)).status, 400)
  }
  assert.equal((await handleEmail(request({ ...payload(), summary: { ...summary, sessions: '<script>' } }), env)).status, 400)
})
test('rejects foreign origins and non-POST methods', async () => {
  assert.equal((await handleEmail(request(payload(), { Origin: 'https://elsewhere.example' }), env)).status, 403)
  assert.equal((await handleEmail(new Request(`${origin}/api/wrapped/email`), env)).status, 405)
})
test('rejects invalid recipients, years, attachment counts, and non-PNG content', async () => {
  for (const value of [{ ...payload(), email: 'bad\r\naddress' }, { ...payload(), year: '2026' }, { ...payload(), attachments: [] }, { ...payload(), attachments: payload().attachments.map(file => ({ ...file, content: 'invalid' })) }]) {
    assert.equal((await handleEmail(request(value), env)).status, 400)
  }
})
test('rejects oversized requests before reading the payload', async () => {
  assert.equal((await handleEmail(request(payload(), { 'Content-Length': '25000000' }), env)).status, 413)
})
test('enforces rate limiting without contacting the provider', async () => {
  assert.equal((await handleEmail(request(), { ...env, WRAPPED_EMAIL_LIMITER: { limit: async () => ({ success: false }) } })).status, 429)
})
test('reports provider failures without leaking credentials or provider details', async () => {
  const response = await handleEmail(request(), env, async () => new Response('secret details', { status: 403 }))
  assert.equal(response.status, 502)
  assert.ok(!(await response.text()).includes('secret'))
})
test('non-API requests continue to the static app', async () => {
  const response = await worker.fetch(new Request(`${origin}/wrapped`), { ASSETS: { fetch: async () => new Response('app') } })
  assert.equal(await response.text(), 'app')
})

test('distinguishes production credentials, test-sender restrictions, domain setup, and size failures', async () => {
  for (const [status, message, expectedCode, expectedStatus] of [
    [401, 'API key is invalid', 'email_credentials', 503],
    [403, 'You can only send testing emails to your own email address', 'email_test_sender', 503],
    [403, 'The example.com domain is not verified', 'email_sender_domain', 503],
    [413, 'Request too large', 'email_size', 413],
    [429, 'Too many requests', 'email_provider_limit', 429],
    [422, 'Invalid attachment', 'email_validation', 502],
  ]) {
    const response = await handleEmail(request(), env, async () => Response.json({ name: 'validation_error', message }, { status }))
    assert.equal(response.status, expectedStatus)
    assert.equal((await response.json()).code, expectedCode)
  }
})

test('distinguishes provider connection failures from timeouts', async () => {
  const response = await handleEmail(request(), env, async () => { throw new DOMException('timed out', 'TimeoutError') })
  assert.equal(response.status, 504)
  assert.equal((await response.json()).code, 'email_timeout')
})
