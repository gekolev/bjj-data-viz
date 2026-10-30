import { finishWrappedAnimation } from './wrappedAnimation'
import { completeEmailOperation, emailOperation } from './emailOperation'

// Freeze the rendered styles so the downloaded cards match the visible layout.
function snapshot(element: Element): Element {
  const clone = element.cloneNode(false) as Element
  const style = getComputedStyle(element)
  const inline = Array.from(style).map(key => `${key}:${style.getPropertyValue(key)};`).join('')
  clone.setAttribute('style', `${inline}animation:none;transition:none;transform:${element.classList.contains('wrap-card') ? 'none' : style.transform};`)
  for (const child of element.childNodes) {
    clone.appendChild(child instanceof Element ? snapshot(child) : child.cloneNode(true))
  }
  return clone
}

function cardSource(card: HTMLElement, email = false) {
  finishWrappedAnimation(card)
  const width = card.offsetWidth
  const height = card.offsetHeight
  const clone = snapshot(card)
  clone.setAttribute('style', `${clone.getAttribute('style')}opacity:1;width:${width}px;height:${height}px;margin:0;`)
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`
  // A data URL keeps the self-contained SVG origin-clean when drawn to canvas.
  const story = window.matchMedia('(max-width: 820px)').matches
  return { svg, width: story ? (email ? 720 : 1080) : width * (email ? 2 : 3), height: story ? (email ? 1280 : 1920) : height * (email ? 2 : 3) }
}

async function cardPng(source: ReturnType<typeof cardSource>): Promise<Uint8Array> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source.svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image export is unavailable in this browser.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create card image.')), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function exportRecapCard(card: HTMLElement, year: number, index: number) {
  await document.fonts.ready
  const png = await cardPng(cardSource(card))
  downloadBlob(new Blob([new Uint8Array(png)], { type: 'image/png' }), cardFilename(card, year, index))
}

function cardFilename(card: HTMLElement, year: number, index: number) {
  const name = card.classList[1].replace(/^wrap-/, '')
  return `${String(index + 1).padStart(2, '0')}-${name}-${year}.png`
}

export async function exportRecap(grid: HTMLElement, year: number, onProgress: (count: number, total: number) => void) {
  const files = await recapImages(grid, year, onProgress)
  const { zipSync } = await import('fflate')
  const archive = zipSync(files, { level: 0 })
  downloadBlob(new Blob([new Uint8Array(archive)], { type: 'application/zip' }), `my-training-wrapped-${year}.zip`)
}

// A single bounded entry per mounted grid; unmounting releases the weak key.
const imageCache = new WeakMap<HTMLElement, { key: string; files: Record<string, Uint8Array> }>()
async function recapImages(grid: HTMLElement, year: number, onProgress: (count: number, total: number) => void, email = false) {
  await document.fonts.ready
  const cards = [...grid.querySelectorAll<HTMLElement>('.wrap-card')]
  if (!cards.length) throw new Error('No recap cards are available.')
  // Frozen computed styles include theme, palette, fonts, content, and layout.
  const sources = cards.map(card => cardSource(card, email))
  const filenames = cards.map((card, index) => cardFilename(card, year, index))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ sources, filenames })))
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const cached = imageCache.get(grid)
  if (cached?.key === key) { onProgress(cards.length, cards.length); return cached.files }
  const files: Record<string, Uint8Array> = {}
  for (const [index, card] of cards.entries()) {
    files[cardFilename(card, year, index)] = await cardPng(sources[index])
    onProgress(index + 1, cards.length)
  }
  imageCache.delete(grid)
  if (Object.values(files).reduce((size, bytes) => size + bytes.byteLength, 0) <= 24_000_000) imageCache.set(grid, { key, files })
  return files
}

export type RecapEmailSummary = { latestTraining: string; sessions: number; minutes: number; trainingDays: number; sample: boolean; estimated: boolean }

async function emailBody(grid: HTMLElement, year: number, email: string, summary: RecapEmailSummary, onProgress: (count: number, total: number) => void) {
  const files = await recapImages(grid, year, onProgress, true)
  const attachments = Object.entries(files).map(([filename, bytes]) => {
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    }
    return { filename, content: btoa(binary) }
  })
  const body = JSON.stringify({ email, year, summary, attachments })
  if (new Blob([body]).size > 24_000_000) throw new Error('These images are too large to email. Please download the ZIP instead.')
  return body
}

const pendingEmails = new WeakMap<HTMLElement, { intent: string; body: string; operation: string; createdAt: number }>()
export async function emailRecap(grid: HTMLElement, year: number, email: string, summary: RecapEmailSummary, contentKey: string, onProgress: (count: number, total: number) => void) {
  await document.fonts.ready
  const cards = [...grid.querySelectorAll<HTMLElement>('.wrap-card')]
  const intent = JSON.stringify({ year, email, summary, contentKey,
    theme: document.documentElement.dataset.theme,
    viewport: [window.innerWidth, window.innerHeight],
    layout: cards.map(card => [card.offsetWidth, card.offsetHeight, getComputedStyle(card).fontFamily]),
  })
  let prepared = pendingEmails.get(grid)
  if (!prepared || prepared.intent !== intent || Date.now() - prepared.createdAt >= 24 * 60 * 60_000) {
    pendingEmails.delete(grid)
    const body = await emailBody(grid, year, email, summary, onProgress)
    prepared = { intent, body, operation: await emailOperation(body), createdAt: Date.now() }
    pendingEmails.set(grid, prepared)
  } else onProgress(cards.length, cards.length)
  const { body, operation } = prepared
  let response: Response
  try {
    response = await fetch('/api/wrapped/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operation }, body,
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error('Could not reach the email service. Check that the app server is running, then try again.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.error || 'Email could not be sent. Please try again later.')
  pendingEmails.delete(grid)
  completeEmailOperation(operation)
}
