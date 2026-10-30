import { Component, createRef, useId, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { gsap } from 'gsap'

type Props = { panel: boolean; hasData: boolean; loadRevision: number; children: ReactNode; contentId: string }
type State = { panel: boolean; hasData: boolean; loadRevision: number; expanded: boolean }
type Layout = { height: number; marginBottom: number; containedFocus: boolean } | null

// Measure before React changes the DOM, including any interrupted animation.
class AnimatedOverviewSetup extends Component<Props, State> {
  state: State = { panel: this.props.panel, hasData: this.props.hasData, loadRevision: this.props.loadRevision, expanded: !this.props.panel || !this.props.hasData }
  private host = createRef<HTMLElement>()
  private content = createRef<HTMLDivElement>()
  private toggle = createRef<HTMLButtonElement>()
  private animationContext?: gsap.Context
  private timeline?: gsap.core.Timeline
  private motion?: MediaQueryList

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.panel === state.panel && props.hasData === state.hasData && props.loadRevision === state.loadRevision) return null
    return { panel: props.panel, hasData: props.hasData, loadRevision: props.loadRevision, expanded: !props.panel || !props.hasData }
  }

  componentDidMount() {
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.motion.addEventListener('change', this.finish)
    window.addEventListener('resize', this.finish)
  }

  componentWillUnmount() {
    this.motion?.removeEventListener('change', this.finish)
    window.removeEventListener('resize', this.finish)
    this.animationContext?.revert()
  }

  getSnapshotBeforeUpdate(previous: Props, state: State): Layout {
    if (previous.panel === this.props.panel && state.expanded === this.state.expanded) return null
    const host = this.host.current
    if (!host) return null
    return { height: host.getBoundingClientRect().height, marginBottom: parseFloat(getComputedStyle(host).marginBottom) || 0, containedFocus: !!this.content.current?.contains(document.activeElement) }
  }

  componentDidUpdate(_previous: Props, _state: State, layout: Layout) {
    if (!layout) return
    const host = this.host.current, content = this.content.current, toggle = this.toggle.current
    if (!host || !content || !toggle) return
    this.animationContext?.revert()
    this.timeline = undefined
    const expanded = this.state.expanded
    content.hidden = !expanded
    if (!expanded && layout.containedFocus) toggle.focus({ preventScroll: true })
    if (this.motion?.matches) { delete host.dataset.transitioning; return }

    const targetHeight = host.getBoundingClientRect().height
    const targetMargin = parseFloat(getComputedStyle(host).marginBottom) || 0
    // Closing content remains visible for its fade, but is immediately inert.
    content.hidden = false
    host.dataset.transitioning = 'true'
    this.animationContext = gsap.context(() => {
      this.timeline = gsap.timeline({ onComplete: () => {
        content.hidden = !expanded
        gsap.set(host, { clearProps: 'height,overflow,marginBottom' })
        gsap.set([content, toggle], { clearProps: 'opacity,transform' })
        delete host.dataset.transitioning
      } })
      this.timeline.fromTo(host, { height: layout.height, marginBottom: layout.marginBottom, overflow: 'clip' }, {
        height: targetHeight, marginBottom: targetMargin, duration: .62, ease: 'power3.inOut',
      }, 0)
      if (expanded) {
        this.timeline.fromTo(content, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .36, ease: 'power2.out' }, .14)
      } else {
        this.timeline.to(content, { opacity: 0, y: -6, duration: .16, ease: 'power1.out' }, 0)
      }
    }, host)
  }

  private finish = () => { this.timeline?.progress(1) }

  render() {
    const { panel, children, contentId } = this.props
    const { expanded } = this.state
    return <section ref={this.host} className={`overview-setup-region${panel ? ' overview-setup' : ''}`} data-expanded={expanded}>
      <button ref={this.toggle} type="button" className="overview-setup-toggle" hidden={!panel} aria-expanded={expanded} aria-controls={contentId} onClick={() => this.setState({ expanded: !expanded })}>
        <span>Overview settings &amp; training data</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      <div ref={this.content} id={contentId} className="overview-setup-content" hidden={!expanded} inert={!expanded} aria-hidden={!expanded}>{children}</div>
    </section>
  }
}

export default function OverviewSetup(props: Omit<Props, 'contentId'>) {
  const contentId = useId()
  return <AnimatedOverviewSetup {...props} contentId={contentId} />
}
