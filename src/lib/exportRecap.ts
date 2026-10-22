import { zipSync } from 'fflate'
import { finishWrappedAnimation } from './wrappedAnimation'

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

async function cardPng(card: HTMLElement): Promise<Uint8Array> {
  finishWrappedAnimation(card)
  const width = card.offsetWidth
  const height = card.offsetHeight
  const clone = snapshot(card)
  clone.setAttribute('style', `${clone.getAttribute('style')}opacity:1;width:${width}px;height:${height}px;margin:0;`)
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`
  // A data URL keeps the self-contained SVG origin-clean when drawn to canvas.
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  const story = window.matchMedia('(max-width: 820px)').matches
  canvas.width = story ? 1080 : width * 3
  canvas.height = story ? 1920 : height * 3
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
  const png = await cardPng(card)
  downloadBlob(new Blob([new Uint8Array(png)], { type: 'image/png' }), cardFilename(card, year, index))
}

function cardFilename(card: HTMLElement, year: number, index: number) {
  const name = card.classList[1].replace(/^wrap-/, '')
  return `${String(index + 1).padStart(2, '0')}-${name}-${year}.png`
}

export async function exportRecap(grid: HTMLElement, year: number, onProgress: (count: number, total: number) => void) {
  const files = await recapImages(grid, year, onProgress)
  const archive = zipSync(files, { level: 0 })
  downloadBlob(new Blob([new Uint8Array(archive)], { type: 'application/zip' }), `my-training-wrapped-${year}.zip`)
}

async function recapImages(grid: HTMLElement, year: number, onProgress: (count: number, total: number) => void) {
  await document.fonts.ready
  const cards = [...grid.querySelectorAll<HTMLElement>('.wrap-card')]
  if (!cards.length) throw new Error('No recap cards are available.')
  const files: Record<string, Uint8Array> = {}
  for (const [index, card] of cards.entries()) {
    files[cardFilename(card, year, index)] = await cardPng(card)
    onProgress(index + 1, cards.length)
  }
  return files
}

export type RecapEmailSummary = { latestTraining: string; sessions: number; minutes: number; trainingDays: number; sample: boolean; estimated: boolean }

export async function emailRecap(grid: HTMLElement, year: number, email: string, summary: RecapEmailSummary, onProgress: (count: number, total: number) => void) {
  const files = await recapImages(grid, year, onProgress)
  const attachments = Object.entries(files).map(([filename, bytes]) => {
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    }
    return { filename, content: btoa(binary) }
  })
  const body = JSON.stringify({ email, year, summary, attachments })
  if (new Blob([body]).size > 24_000_000) throw new Error('These images are too large to email. Please download the ZIP instead.')
  let response: Response
  try {
    response = await fetch('/api/wrapped/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error('Could not reach the email service. Check that the app server is running, then try again.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.error || 'Email could not be sent. Please try again later.')
}
