import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'

const integer = (value: number) => String(value)

export const countHours = (minutes: number) => String(Math.floor(minutes / 60))
export const countMinutes = (minutes: number) => String(minutes % 60)

export default function CountUp({ value, format = integer, minDigits = 0 }: {
  value: number
  format?: (value: number) => string
  minDigits?: number
}) {
  const output = useRef<HTMLSpanElement>(null)
  const target = Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
  const finalText = format(target)

  useLayoutEffect(() => {
    const element = output.current
    if (!element) return
    const motion = gsap.matchMedia()
    motion.add({ reduce: '(prefers-reduced-motion: reduce)', animate: '(prefers-reduced-motion: no-preference)' }, context => {
      const render = (value: number) => { element.textContent = format(Math.round(value)) }
      if (context.conditions?.reduce || target === 0) { render(target); return }
      const counter = { value: 0 }
      render(0)
      // Update this text node directly; the dashboard does not re-render per tick.
      gsap.to(counter, {
        value: target, duration: 1.1, delay: .08, ease: 'power2.out',
        onUpdate: () => render(counter.value), onComplete: () => render(target),
      })
    })
    return () => motion.revert()
  }, [target, format])

  return <span className="count-up" style={minDigits ? { minWidth: `${minDigits}ch` } : undefined}>
    <span className="visually-hidden">{finalText}</span>
    <span className="count-up-sizing" aria-hidden="true">{finalText}</span>
    <span ref={output} className="count-up-display" aria-hidden="true">{finalText}</span>
  </span>
}
