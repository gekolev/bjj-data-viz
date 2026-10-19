const MAX_BODY = 24_000_000
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

const CARD_TITLES = ['You kept showing up', 'Your sessions', 'Your mat time', 'Your training DNA', 'Your peak chapter', 'Your training rhythm', 'Your go-to class', 'In your corner', 'Your big mat day']
const cardContentId = (year, index) => `wrapped-${year}-card-${index + 1}`

function providerFailure(status, detail) {
  const message = typeof detail?.message === 'string' ? detail.message.toLowerCase() : ''
  const name = typeof detail?.name === 'string' ? detail.name : ''
  if (status === 401 || /api key is (invalid|not active|suspended)|missing api key/.test(message)) return { status: 503, code: 'email_credentials', error: 'The production email API key is invalid or inactive. Update RESEND_API_KEY in Cloudflare Worker secrets.' }
  if (/only send testing emails|resend\.dev/.test(message)) return { status: 503, code: 'email_test_sender', error: 'Resend’s test sender can only email the Resend account owner. Set WRAPPED_EMAIL_FROM in Cloudflare to an address on your verified Resend domain to email other recipients.' }
  if (/domain.*(not verified|not.*verified)|verify.*domain/.test(message)) return { status: 503, code: 'email_sender_domain', error: 'The production sender domain is not verified in Resend. Verify it and update WRAPPED_EMAIL_FROM in Cloudflare.' }
  if (status === 413 || /size|too large|40mb|40 mb/.test(message)) return { status: 413, code: 'email_size', error: 'The email images exceed the delivery service size limit. Download the ZIP instead.' }
  if (status === 429 || /quota|rate.limit/.test(name)) return { status: 429, code: 'email_provider_limit', error: 'The email service rate limit or sending quota was reached. Check Resend usage before trying again.' }
  if (status === 403) return { status: 502, code: 'email_permission', error: 'Resend denied this send. Check the production API key’s sending permissions, sender domain, and account status.' }
  if (status === 400 || status === 422) return { status: 502, code: 'email_validation', error: 'Resend rejected the email format or attachments. Check the failed send in the Resend API logs.' }
  return { status: 502, code: 'email_provider_unavailable', error: 'The email service could not send your recap. Please try again later.' }
}

const CARD_DESCRIPTIONS = ['A celebration of the work you put in, one session at a time.', 'How often you showed up and invested in your training.', 'The hours and minutes you dedicated to learning on the mat.', 'Your balance of Gi, No-Gi, and other training styles.', 'The month when you logged the most sessions.', 'Your most-trained weekday and longest consecutive-day streak.', 'The class you returned to most often.', 'The coaches who guided your training.', 'Your highest number of sessions in a single day.']
const SECTIONS = { 0: '01 / The work you put in', 3: '02 / How you trained', 6: '03 / Your training highlights' }

function summaryText(year, summary) {
  if (!summary) return `These are the highlights of your logged training in ${year}. This recap reflects the records available when you requested it.`
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${summary.latestTraining}T00:00:00Z`))
  return `Training highlights as of ${date}, your latest logged session in ${year}.\n${summary.sessions} sessions | ${Math.round(summary.minutes / 60 * 10) / 10} mat hours | ${summary.trainingDays} training days.\nCoverage: 1 January ${year} through ${date}. Based on ${summary.sample ? 'sample training data' : 'your imported and manually logged sessions'}; sessions not recorded in the app are not included.${summary.estimated ? ' Includes estimated durations or training styles where indicated on the cards.' : ''}`
}

function emailHtml(year, summary) {
  const overview = summaryText(year, summary).split('\n').map(line => `<p style="margin:0 0 12px;">${line}</p>`).join('')
  const cards = CARD_TITLES.map((title, index) => `${SECTIONS[index] ? `<tr><td style="padding:12px 24px 20px;"><h2 style="margin:0;border-top:1px solid #e4e4e7;padding-top:24px;font-size:20px;">${SECTIONS[index]}</h2></td></tr>` : ''}<tr><td style="padding:0 24px 24px;">
    <p style="margin:0 0 8px;color:#71717a;font-size:12px;">${String(index + 1).padStart(2, '0')} / 09 &nbsp; ${title}</p>
    <p style="margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6;">${CARD_DESCRIPTIONS[index]}</p>
    <img src="cid:${cardContentId(year, index)}" alt="${title} — your ${year} training recap" width="512" style="display:block;width:100%;max-width:512px;height:auto;border:0;border-radius:12px;" />
  </td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your ${year} MatMetrics Wrapped</title></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:24px 8px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;">
      <tr><td style="padding:32px 24px;background:#111113;color:#ffffff;"><p style="margin:0 0 14px;font-size:11px;letter-spacing:2px;color:#fca5a5;">MATMETRICS / YEAR WRAPPED</p><h1 style="margin:0;font-size:32px;line-height:1.15;">Your ${year} on the mat.</h1><p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#d4d4d8;">Every session adds up. Here are your nine chapters.</p></td></tr>
      <tr><td style="padding:24px;font-size:14px;line-height:1.7;"><h2 style="margin:0 0 14px;font-size:22px;">Your training, in perspective</h2><p style="margin:0 0 16px;">From showing up consistently to finding your favorite classes, these are the highlights of your year on the mat. Take a moment to look back at the time, effort, and people that shaped your journey.</p>${overview}<h3 style="font-size:16px;margin:22px 0 10px;">Inside your Wrapped</h3><p style="margin:0;">Nine cards capture your training volume, style and rhythm, and standout moments. Explore them below, then save the separate PNG attachments to keep or share your highlights.</p><p style="margin:12px 0 0;color:#71717a;font-size:12px;">If images are hidden, enable images in your email app or open the attachments.</p></td></tr>
      ${cards}
      <tr><td style="padding:8px 24px 32px;font-size:14px;line-height:1.7;"><strong>Keep showing up. See you on the mat.</strong><p style="margin:16px 0 0;color:#71717a;font-size:11px;">You received this one-time email because someone requested a training recap at MatMetrics.</p></td></tr>
    </table>
  </td></tr></table></body></html>`
}

export async function handleEmail(request, env, send = fetch) {
  if (request.method !== 'POST') return json({ error: 'Use POST to send a recap.' }, 405)
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Request origin is not allowed.' }, 403)
  if (!env.RESEND_API_KEY || !env.WRAPPED_EMAIL_FROM) return json({ error: 'Email sending is not configured yet. You can still download your cards.' }, 503)
  if (!env.WRAPPED_EMAIL_LIMITER) return json({ error: 'Email sending is temporarily unavailable.' }, 503)
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const allowed = await env.WRAPPED_EMAIL_LIMITER.limit({ key: `ip:${ip}` })
  if (!allowed.success) return json({ error: 'Please wait a minute before sending another recap.' }, 429)
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Expected a JSON request.' }, 415)
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return json({ error: 'Images are too large to email. Download the ZIP instead.' }, 413)
  let data
  try {
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'Missing recap.' }, 400)
    const chunks = []
    let length = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BODY) { await reader.cancel(); return json({ error: 'Images are too large to email. Download the ZIP instead.' }, 413) }
      chunks.push(value)
    }
    data = JSON.parse(await new Blob(chunks).text())
  } catch { return json({ error: 'Could not read your recap.' }, 400) }
  const { email, year, attachments, summary } = data ?? {}
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return json({ error: 'Invalid recap year.' }, 400)
  if (summary !== undefined) {
    const date = typeof summary?.latestTraining === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(summary.latestTraining) ? new Date(`${summary.latestTraining}T00:00:00Z`) : null
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== summary.latestTraining || date.getUTCFullYear() !== year
      || !Number.isInteger(summary.sessions) || summary.sessions < 1 || summary.sessions > 1_000_000
      || !Number.isFinite(summary.minutes) || summary.minutes < 0 || summary.minutes > 100_000_000
      || !Number.isInteger(summary.trainingDays) || summary.trainingDays < 1 || summary.trainingDays > 366 || summary.trainingDays > summary.sessions
      || typeof summary.sample !== 'boolean' || typeof summary.estimated !== 'boolean') return json({ error: 'Invalid training summary or latest training date.' }, 400)
  }
  if (!Array.isArray(attachments) || attachments.length !== 9 || attachments.some((file, index) =>
    !file || typeof file.filename !== 'string' || !new RegExp(`^${String(index + 1).padStart(2, '0')}-[a-z]+-${year}\\.png$`).test(file.filename)
    || typeof file.content !== 'string' || !file.content.startsWith('iVBORw0KGgo') || file.content.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.content)
  )) return json({ error: 'Include all nine recap cards as PNG images.' }, 400)
  // Inline copies plus downloadable attachments must fit within the email size limit.
  if (attachments.reduce((sum, file) => sum + file.content.length, 0) > 18_000_000) return json({ error: 'These images are too large to include in the email body and attachments. Download the ZIP instead.' }, 413)
  const recipientAllowed = await env.WRAPPED_EMAIL_LIMITER.limit({ key: `email:${email.toLowerCase()}` })
  if (!recipientAllowed.success) return json({ error: 'A recap was recently requested for this address. Please wait a minute.' }, 429)
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.WRAPPED_EMAIL_FROM.trim(), to: [email], subject: `Your ${year} year on the mat`,
        text: `Your ${year} MatMetrics Wrapped is here!\n\nThese are the highlights of your training: the time you put in, how you trained, and your standout moments.\n\n${summaryText(year, summary)}\n\nTHE WORK YOU PUT IN\nYour sessions, training days, and mat time.\n\nHOW YOU TRAINED\nYour training styles, busiest month, weekly rhythm, and streak.\n\nYOUR TRAINING HIGHLIGHTS\nYour go-to class, coaches, and biggest training day.\n\nAll nine recap cards are attached as PNG images to save and share.\n\nKeep showing up. See you on the mat.\n\nYou received this one-time email because someone requested a training recap at MatMetrics.`,
        html: emailHtml(year, summary),
        attachments: [
          ...attachments.map(({ filename, content }, index) => ({ filename: `inline-${filename}`, content, content_type: 'image/png', content_id: cardContentId(year, index) })),
          ...attachments.map(({ filename, content }) => ({ filename, content, content_type: 'image/png' })),
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      const failure = providerFailure(response.status, detail)
      // Log diagnostic categories, never keys, recipient addresses, or image payloads.
      console.error('Wrapped email provider rejected request', { providerStatus: response.status, code: failure.code })
      return json({ error: failure.error, code: failure.code }, failure.status)
    }
    return json({ success: true })
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    console.error('Wrapped email provider connection failed', { code: timeout ? 'email_timeout' : 'email_connection' })
    return json({ error: timeout ? 'Email delivery timed out. Check Resend’s email history before retrying to avoid duplicates.' : 'Could not connect to the email service from the server. Please try again later.', code: timeout ? 'email_timeout' : 'email_connection' }, timeout ? 504 : 502)
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/wrapped/email') return handleEmail(request, env)
    return env.ASSETS.fetch(request)
  },
}
