import { useLayoutEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'

export function useOverviewReveal(host: RefObject<HTMLDivElement | null>, enabled: boolean, demo: boolean) {
  const previous = useRef(demo)
  useLayoutEffect(() => {
    const changed = previous.current !== demo
    previous.current = demo
    if (!enabled || !changed || !host.current) return
    const motion = gsap.matchMedia()
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = Array.from(host.current!.querySelectorAll<HTMLElement>('.overview-dashboard-heading, .stat-card, .charts-grid > .chart-frame'))
        .filter(element => {
          const rect = element.getBoundingClientRect()
          return rect.bottom >= 0 && rect.top < window.innerHeight + 160
        })
      if (!targets.length) return
      gsap.fromTo(targets, { opacity: .35, y: 12 }, {
        opacity: 1, y: 0, duration: .46, stagger: .035, ease: 'power2.out', clearProps: 'opacity,transform',
      })
    }, host)
    return () => motion.revert()
  }, [enabled, demo, host])
}
