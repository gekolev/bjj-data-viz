import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Share2, X } from 'lucide-react'
import { animateWrappedCard, finishWrappedAnimation } from '../lib/wrappedAnimation'

export default function WrappedViewer({ cards, index, year, onChange, onClose, onShare }: {
  cards: HTMLElement[]; index: number; year: number; onChange: (index: number) => void; onClose: () => void
  onShare: (index: number, file: File) => Promise<string>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [shareFile, setShareFile] = useState<File | null>(null)
  useLayoutEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    element.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  useLayoutEffect(() => {
    const host = stage.current!
    const source = cards[index]
    if (!source) return
    finishWrappedAnimation(source)
    const card = source.cloneNode(true) as HTMLElement
    card.removeAttribute('role'); card.removeAttribute('tabindex'); card.removeAttribute('aria-label')
    host.replaceChildren(card)
    const cleanup = animateWrappedCard(card)
    return () => { cleanup(); host.replaceChildren() }
  }, [cards, index])
  useEffect(() => {
    let current = true
    import('../lib/exportRecap').then(({ recapCardFile }) => recapCardFile(cards[index], year, index)).then(file => { if (current) setShareFile(file) }).catch(() => { if (current) setShareMessage('Sharing is unavailable for this card.') })
    return () => { current = false }
  }, [cards, index, year])
  const changeCard = (next: number) => { setShareMessage(''); setShareFile(null); onChange(next) }
  const share = async () => {
    if (sharing) return
    setSharing(true)
    setShareMessage('Preparing image...')
    if (!shareFile) return
    try { setShareMessage(await onShare(index, shareFile)) }
    catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setShareMessage('Could not share this card. Please try again.')
      else setShareMessage('')
    } finally { setSharing(false) }
  }
  return createPortal(<dialog ref={dialog} className="wrapped-viewer" aria-label="Animated Wrapped cards" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDown={event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); changeCard(Math.max(0, index - 1)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); changeCard(Math.min(cards.length - 1, index + 1)) }
  }}>
    <div className="wrapped-viewer-shell">
      <div className="wrapped-viewer-toolbar"><span>Card {index + 1} of {cards.length}</span><button className="wrapped-viewer-share" onClick={() => void share()} disabled={sharing || !shareFile} aria-label={`Share card ${index + 1} to social media or messaging apps`}><Share2 size={18} /><span>{sharing ? 'Sharing...' : shareFile ? 'Share' : 'Preparing...'}</span></button><button onClick={onClose} aria-label="Close Wrapped viewer" autoFocus><X size={22} /></button></div>
      <p className="wrapped-viewer-status" role="status" aria-live="polite">{shareMessage}</p>
      <div ref={stage} className="wrapped-viewer-stage wrap-card-item" />
      <div className="wrapped-viewer-navigation"><button disabled={index === 0} onClick={() => changeCard(index - 1)}><ChevronLeft size={22} /> Previous</button><span>{String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span><button disabled={index === cards.length - 1} onClick={() => changeCard(index + 1)}>Next <ChevronRight size={22} /></button></div>
    </div>
  </dialog>, document.body)
}
