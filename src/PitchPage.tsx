import { useEffect } from 'react'
import { ArrowRight, CalendarDays, ChartNoAxesCombined, Clock3, Medal, Upload, Users, Sparkles } from 'lucide-react'
import './PitchPage.css'

function TrainingPreview() {
  return <figure className="pitch-preview" aria-label="Illustrative member dashboard: 128 sessions, 164 training hours, monthly attendance, and a training calendar">
    <figcaption><span><span className="pitch-live-dot" /> A MEMBER’S MAT STORY</span><small>Illustrative data</small></figcaption>
    <div className="pitch-preview-stats"><div><CalendarDays size={18} /><strong>128</strong><span>sessions logged</span></div><div><Clock3 size={18} /><strong>164<span>h</span></strong><span>on the mat</span></div></div>
    <div className="pitch-mini-heading"><span>Showing up adds up</span><ChartNoAxesCombined size={17} /></div>
    <div className="pitch-bars" aria-hidden="true">{[42, 57, 48, 72, 64, 89].map((height, i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'][i]}</span></div>)}</div>
    <div className="pitch-mini-heading"><span>Every square, a session</span><CalendarDays size={16} /></div>
    <div className="pitch-heatmap" aria-hidden="true">{Array.from({ length: 84 }, (_, i) => <i key={i} className={`pitch-heat-${(i * 7 + Math.floor(i / 5)) % 4}`} />)}</div>
    <div className="pitch-preview-milestone"><Medal size={22} /><div><strong>A milestone worth remembering</strong><span>Your effort. Your next chapter.</span></div><Sparkles size={17} /></div>
  </figure>
}

const benefits = [
  { icon: CalendarDays, title: 'Build the habit.', text: 'Make consistency something members can see.', visual: 'calendar' },
  { icon: ChartNoAxesCombined, title: 'Give coaching context.', text: 'Turn training patterns into better conversations.', visual: 'mix' },
  { icon: Medal, title: 'Celebrate the journey.', text: 'Keep the effort between promotions in view.', visual: 'milestone' },
]

export default function PitchPage({ onExplore, onLog }: { onExplore: () => void; onLog: () => void }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Mat Metrics for your academy'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => { document.title = previousTitle; robots.remove() }
  }, [])

  return <main className="pitch-page">
    <header className="pitch-masthead"><a href="/" onClick={(event) => { event.preventDefault(); onExplore() }}>mat<span>metrics</span><span className="pitch-brand-dot">.</span></a><span>Built for the journey on your mats.</span></header>
    <section className="pitch-hero" aria-labelledby="pitch-title">
      <div className="pitch-hero-copy"><span className="pitch-eyebrow">FOR JIU-JITSU ACADEMIES</span><h1 id="pitch-title">More than check-ins.<br /><em>A reason to keep showing up.</em></h1><p>Turn your members’ training history into visible progress, proud moments, and their next goal.</p><div className="pitch-actions"><button className="button button-primary" onClick={onExplore}>See the member experience <ArrowRight size={16} aria-hidden="true" /></button></div><span className="pitch-caption">Explore the dashboard with sample data.</span></div>
      <TrainingPreview />
    </section>
    <section className="pitch-value-strip" aria-label="Value for your academy"><span><Users size={21} /> Engaged members</span><span><ChartNoAxesCombined size={21} /> Better conversations</span><span><Sparkles size={21} /> Shared celebrations</span></section>
    <section className="pitch-benefits" aria-labelledby="pitch-benefits-title"><span className="pitch-eyebrow">YOUR ATTENDANCE DATA. MORE MEANING.</span><h2 id="pitch-benefits-title">Help them see what you see.</h2><div className="pitch-grid">{benefits.map(({ icon: Icon, title, text, visual }) => <article key={title}>
      <div className={`pitch-card-visual pitch-visual-${visual}`} aria-hidden="true">
        {visual === 'calendar' ? <div className="pitch-card-calendar">{Array.from({ length: 28 }, (_, i) => <i key={i} className={i % 3 === 0 || i % 5 === 0 ? 'filled' : ''} />)}</div> : visual === 'mix' ? <div className="pitch-mix"><div className="pitch-donut" /><div><span><i />Gi</span><span><i />No-Gi</span></div></div> : <div className="pitch-belt-story"><span /><Medal size={42} /><span /><Sparkles size={25} /></div>}
      </div><div className="pitch-card-title"><Icon size={19} aria-hidden="true" /><h3>{title}</h3></div><p>{text}</p>
    </article>)}</div></section>
    <section className="pitch-pilot" aria-labelledby="pitch-pilot-title"><div><span className="pitch-eyebrow">START SMALL</span><h2 id="pitch-pilot-title">A few members.<br />Their training. A fresh perspective.</h2></div><ol><li><span className="pitch-step-icon"><Users size={23} /></span><div><strong>Invite a few members</strong><span>Beginners. Regulars. Long-timers.</span></div></li><li><span className="pitch-step-icon"><Upload size={23} /></span><div><strong>Bring in their history</strong><span>CSV import or manual logging.</span></div></li><li><span className="pitch-step-icon"><ChartNoAxesCombined size={23} /></span><div><strong>Explore it together</strong><span>Spot habits. Celebrate effort. Set goals.</span></div></li></ol></section>
    <footer className="pitch-closing"><span className="pitch-eyebrow">MAKE THEIR COMMITMENT VISIBLE</span><h2>A story your members<br />want to keep building.</h2><div className="pitch-actions"><button className="button button-primary" onClick={onExplore}>Explore Mat Metrics <ArrowRight size={16} aria-hidden="true" /></button><button className="button button-outline" onClick={onLog}>Try logging a session</button></div><p className="pitch-footnote">Individual member dashboards today. Gym-wide reporting and automatic sync are future possibilities.</p></footer>
  </main>
}
