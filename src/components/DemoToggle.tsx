import { useId, useLayoutEffect, useRef } from 'react'
import { ArrowUpLeft, FileSpreadsheet } from 'lucide-react'
import { gsap } from 'gsap'

export default function DemoToggle({ enabled, prompt, onToggle }: { enabled: boolean; prompt: boolean; onToggle: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const hintId = useId()

  useLayoutEffect(() => {
    const root = host.current
    if (!root) return
    const hint = root.querySelector('.demo-nudge')
    const arrows = root.querySelectorAll<SVGElement>('.demo-nudge-arrow svg')
    const ring = root.querySelector('.demo-nudge-ring ellipse')
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation: ReturnType<typeof gsap.context> | undefined
    const animate = () => {
      animation?.kill()
      animation = gsap.context(() => {
        gsap.to(hint, { autoAlpha: prompt ? 1 : 0, duration: media.matches ? 0 : .3, overwrite: true })
        if (!prompt) return
        gsap.set(arrows, { x: 0, y: 0 })
        gsap.set(ring, { strokeDashoffset: 0 })
        if (!media.matches) {
          gsap.fromTo(arrows, {
            x: 24, y: 24,
          }, { x: 0, y: 0, duration: .9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
          gsap.to(ring, { strokeDashoffset: -100, duration: 8, repeat: -1, ease: 'none' })
        }
      }, root)
    }
    animate()
    media.addEventListener('change', animate)
    return () => { media.removeEventListener('change', animate); animation?.kill() }
  }, [prompt])

  return <div ref={host} className="demo-toggle-wrap">
    <button className="screen-toggle demo-toggle" aria-pressed={enabled} aria-describedby={prompt ? hintId : undefined} title="Preview the demo CSV without changing your saved training" onClick={onToggle}>
      <FileSpreadsheet size={15} /><span>Demo data</span><span className="screen-toggle-track" aria-hidden="true"><span /></span>
    </button>
    <div className="demo-nudge" aria-hidden={!prompt}>
      <svg className="demo-nudge-ring" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="100" cy="40" rx="98" ry="38" pathLength="100" /></svg>
      <span className="demo-nudge-arrow" aria-hidden="true"><ArrowUpLeft size={42} /></span>
      <span className="demo-nudge-label" id={hintId}>Try demo data</span>
    </div>
  </div>
}
