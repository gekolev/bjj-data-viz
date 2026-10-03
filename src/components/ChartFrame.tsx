import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Play, X } from 'lucide-react'
import { ChartModalContext } from './ChartModalContext'
import { ChartAnimationContext } from './ChartAnimationContext'

/** Keep the same interactive chart mounted when moving into the browser's top layer. */
export default function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [modalContainer, setModalContainer] = useState<HTMLDialogElement | null>(null)
  const [height, setHeight] = useState(0)
  const [replay, setReplay] = useState(0)
  const titleId = useId()

  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [expanded])

  const open = () => {
    setHeight(frame.current?.offsetHeight ?? 0)
    dialog.current?.showModal()
    setModalContainer(dialog.current)
    setExpanded(true)
  }

  const replayAnimation = () => {
    setReplay(value => value + 1)
    // Custom SVG and calendar plots use a staggered reveal instead of Recharts.
    const marks = dialog.current?.querySelectorAll('.training-timeline-svg circle, .contribution-day, .three-canvas')
    marks?.forEach((mark, index) => {
      mark.getAnimations().forEach(animation => animation.cancel())
      mark.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 650,
        delay: marks.length > 1 ? index / (marks.length - 1) * 700 : 0,
        easing: 'ease-out',
        fill: 'backwards',
      })
    })
  }

  return <div className="chart-frame" ref={frame} style={expanded ? { minHeight: height } : undefined}>
    <dialog ref={dialog} className="chart-dialog" role={expanded ? 'dialog' : 'group'} aria-modal={expanded || undefined} aria-label={expanded ? undefined : title} aria-labelledby={expanded ? titleId : undefined} onClose={() => { setExpanded(false); trigger.current?.focus() }}>
      <div className="chart-modal-toolbar"><h2 id={titleId}>{title}</h2><div className="chart-modal-actions"><button className="chart-replay" aria-label={`Replay ${title} animation`} onClick={replayAnimation}><Play size={18} /><span>Replay animation</span></button><button className="chart-close" aria-label={`Close ${title}`} onClick={() => dialog.current?.close()}><X size={20} /><span>Close</span></button></div></div>
      <button ref={trigger} className="chart-expand" aria-label={`Expand ${title}`} title="Open full screen" onClick={open}><Maximize2 size={15} /></button>
      <ChartModalContext.Provider value={expanded ? modalContainer : null}><ChartAnimationContext.Provider value={replay}><div className="chart-frame-content">{children}</div></ChartAnimationContext.Provider></ChartModalContext.Provider>
    </dialog>
  </div>
}
