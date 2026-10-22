import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react'
import { animateWrappedCard, finishWrappedAnimation } from '../lib/wrappedAnimation'

export default function WrappedViewer({ cards, index, onChange, onClose }: {
  cards: HTMLElement[]; index: number; onChange: (index: number) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const replay = useRef<(() => void) | null>(null)
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
    let cleanup = animateWrappedCard(card)
    replay.current = () => { cleanup(); cleanup = animateWrappedCard(card) }
    return () => { cleanup(); host.replaceChildren(); replay.current = null }
  }, [cards, index])
  return createPortal(<dialog ref={dialog} className="wrapped-viewer" aria-label="Animated Wrapped cards" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDown={event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); onChange(Math.max(0, index - 1)) }
    if (event.key === 'ArrowRight') { event.preventDefault(); onChange(Math.min(cards.length - 1, index + 1)) }
  }}>
    <div className="wrapped-viewer-shell">
      <div className="wrapped-viewer-toolbar"><span aria-live="polite">Card {index + 1} of {cards.length}</span><button onClick={() => replay.current?.()} aria-label="Replay card animation"><RotateCcw size={18} /></button><button onClick={onClose} aria-label="Close Wrapped viewer" autoFocus><X size={22} /></button></div>
      <div ref={stage} className="wrapped-viewer-stage wrap-card-item" />
      <div className="wrapped-viewer-navigation"><button disabled={index === 0} onClick={() => onChange(index - 1)}><ChevronLeft size={22} /> Previous</button><span>{String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span><button disabled={index === cards.length - 1} onClick={() => onChange(index + 1)}>Next <ChevronRight size={22} /></button></div>
    </div>
  </dialog>, document.body)
}
