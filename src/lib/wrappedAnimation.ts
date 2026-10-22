import { gsap } from 'gsap'

const active = new WeakMap<HTMLElement, gsap.core.Timeline>()

export function finishWrappedAnimation(card: HTMLElement) {
  active.get(card)?.progress(1)
}

export function animateWrappedCard(card: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const context = gsap.context(() => {
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    active.set(card, timeline)
    timeline.from(card, { opacity: 0, y: 28, scale: 0.96, duration: 0.65, clearProps: 'transform,opacity' })
    const copy = card.querySelectorAll('.wrap-card-top, .wrap-edition, .wrap-overline, h2, p, .wrap-number, .wrap-streak, .wrap-pill, .wrap-coach-count, .wrap-card-bottom')
    if (copy.length) timeline.from(copy, { opacity: 0, y: 22, duration: 0.65, stagger: 0.07, clearProps: 'transform,opacity' }, 0.12)
    const bars = card.querySelectorAll('.wrap-bar i, .wrap-month-chart i')
    if (bars.length) timeline.from(bars, { scaleY: 0, transformOrigin: 'bottom', duration: 0.9, stagger: 0.045, clearProps: 'transform,transformOrigin' }, 0.35)
    const art = card.querySelectorAll('.wrap-hero-art i, .wrap-orbit i, .wrap-class-art i')
    if (art.length) timeline.from(art, { scale: 0.5, opacity: 0, rotation: -35, duration: 1.1, stagger: 0.1, clearProps: 'transform,opacity' }, 0.1)
    const stamps = card.querySelectorAll('.wrap-ticket, .wrap-day-stamp')
    if (stamps.length) timeline.from(stamps, { x: -80, opacity: 0, duration: 0.8, ease: 'back.out(1.4)', clearProps: 'transform,opacity' }, 0.4)
  }, card)
  return () => { context.revert(); active.delete(card) }
}
