import { trackEvent } from '../lib/firebase'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Play, X } from 'lucide-react'
import { chartCoordinates } from '../lib/chartCoordinates'
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
  const [sideways, setSideways] = useState(false)
  const ownsFullscreen = useRef(false)
  const orientationLocked = useRef(false)
  const openRequest = useRef(0)
  const overviewScroll = useRef({ x: 0, y: 0 })
  const titleId = useId()

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse) and (max-width: 1000px) and (orientation: portrait)')
    const update = () => setSideways(expanded && media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [expanded])

  useEffect(() => {
    const modal = dialog.current
    if (!sideways || !modal) return
    // Recharts handles scale but not rotation. Normalize only its pointer input.
    const normalize = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const chart = event.target.closest<HTMLElement>('.recharts-wrapper')
      if (!chart) return
      const rect = chart.getBoundingClientRect()
      const point = (clientX: number, clientY: number) => {
        const local = chartCoordinates(chart, clientX, clientY)
        return { clientX: rect.left + local.x * rect.width / chart.offsetWidth, clientY: rect.top + local.y * rect.height / chart.offsetHeight }
      }
      if (event instanceof MouseEvent) {
        const adjusted = point(event.clientX, event.clientY)
        Object.defineProperties(event, { clientX: { value: adjusted.clientX, configurable: true }, clientY: { value: adjusted.clientY, configurable: true } })
      } else if ('touches' in event) {
        const touches = Array.from((event as TouchEvent).touches).map(touch => ({ identifier: touch.identifier, target: touch.target, ...point(touch.clientX, touch.clientY) }))
        Object.defineProperty(event, 'touches', { value: touches, configurable: true })
      }
    }
    const events = ['mousemove', 'mouseover', 'click', 'touchstart', 'touchmove']
    events.forEach(name => modal.addEventListener(name, normalize, true))
    return () => events.forEach(name => modal.removeEventListener(name, normalize, true))
  }, [sideways])

  const releaseLandscape = useCallback(() => {
    openRequest.current += 1
    if (orientationLocked.current) {
      screen.orientation?.unlock()
      orientationLocked.current = false
    }
    if (ownsFullscreen.current) {
      ownsFullscreen.current = false
      if (document.fullscreenElement === document.documentElement) {
        return document.exitFullscreen().catch(() => {})
      }
    }
    return Promise.resolve()
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      // The phone's Back button / browser exit should also dismiss the chart.
      if (ownsFullscreen.current && !document.fullscreenElement) dialog.current?.close()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      releaseLandscape()
    }
  }, [releaseLandscape])

  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [expanded])

  const open = async () => {
    trackEvent('chart_expand', { chart_name: title })
    setHeight(frame.current?.offsetHeight ?? 0)
    overviewScroll.current = { x: window.scrollX, y: window.scrollY }
    const request = ++openRequest.current
    const mobile = window.matchMedia('(pointer: coarse) and (max-width: 1000px)').matches
    // Prefer native rotation; the sideways layout covers unsupported browsers.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> }
    const canRotate = mobile && typeof orientation?.lock === 'function' && typeof document.documentElement.requestFullscreen === 'function'
    if (canRotate && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
        ownsFullscreen.current = true
      } catch {
        // Fall back to the regular modal when fullscreen is denied.
      }
    }
    if (request !== openRequest.current || !dialog.current) { releaseLandscape(); return }
    // Add the modal after fullscreen so it stays above the fullscreen top layer.
    dialog.current.showModal()
    setModalContainer(dialog.current)
    setExpanded(true)
    if (!canRotate) return
    try {
      await orientation.lock('landscape')
      orientationLocked.current = true
      if (request !== openRequest.current || !dialog.current?.open) releaseLandscape()
    } catch {
      // Unsupported or denied fullscreen/rotation leaves the normal modal usable.
    }
  }

  const close = async () => {
    // Clear layout state together: a closed dialog must never retain sideways
    // tooltip positioning while the overview is being measured again.
    setSideways(false)
    setExpanded(false)
    setModalContainer(null)
    dialog.current?.querySelectorAll('canvas').forEach(canvas => {
      canvas.dispatchEvent(new PointerEvent('pointerleave'))
    })
    if (dialog.current) dialog.current.scrollTop = 0
    const content = dialog.current?.querySelector('.chart-frame-content')
    if (content) { content.scrollTop = 0; content.scrollLeft = 0 }
    const releasing = releaseLandscape()
    const request = openRequest.current
    await releasing
    requestAnimationFrame(() => {
      if (request !== openRequest.current || dialog.current?.open) return
      trigger.current?.focus({ preventScroll: true })
      window.scrollTo(overviewScroll.current.x, overviewScroll.current.y)
    })
  }

  const replayAnimation = () => {
    trackEvent('chart_replay', { chart_name: title })
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
    <dialog ref={dialog} className="chart-dialog" data-sideways={sideways || undefined} role={expanded ? 'dialog' : 'group'} aria-modal={expanded || undefined} aria-label={expanded ? undefined : title} aria-labelledby={expanded ? titleId : undefined} onClose={() => void close()}>
      <div className="chart-modal-toolbar"><h2 id={titleId}>{title}</h2><div className="chart-modal-actions"><button className="chart-replay" aria-label={`Replay ${title} animation`} onClick={replayAnimation}><Play size={18} /><span>Replay animation</span></button><button className="chart-close" aria-label={`Close ${title}`} onClick={() => dialog.current?.close()}><X size={20} /><span>Close</span></button></div></div>
      <button ref={trigger} className="chart-expand" aria-label={`Expand ${title}`} title="Open full screen" onClick={open}><Maximize2 size={15} /></button>
      <ChartModalContext.Provider value={expanded ? modalContainer : null}><ChartAnimationContext.Provider value={replay}><div className="chart-frame-content" onClickCapture={() => trackEvent('chart_interaction', { chart_name: title, interaction_type: 'click' })} onChangeCapture={() => trackEvent('chart_interaction', { chart_name: title, interaction_type: 'change' })}>{children}</div></ChartAnimationContext.Provider></ChartModalContext.Provider>
    </dialog>
  </div>
}
