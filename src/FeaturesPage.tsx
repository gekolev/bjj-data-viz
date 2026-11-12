import {
  Activity, ArrowLeft, BarChart3, Box, CalendarDays, Check, Cloud,
  Download, FileSpreadsheet, Filter, Moon, Share2, Sparkles, Upload,
} from 'lucide-react'
import './FeaturesPage.css'

const featureGroups = [
  {
    icon: Upload,
    eyebrow: 'Bring your history',
    title: 'Start with the data you already have.',
    description: 'Import a Gymdesk CSV by choosing a file or dropping it anywhere in the app. Mat Metrics reads sessions, times, durations, coaches, academies, training styles, and belt or stripe records in one pass.',
    points: [
      'Built-in Gymdesk export guide, copyable script, and CSV template',
      'Automatic handling for missing styles, durations, and older records',
      'Demo data for exploring the full app before adding your own history',
    ],
  },
  {
    icon: CalendarDays,
    eyebrow: 'Log every round',
    title: 'Record training in a few taps.',
    description: 'Add a session without Gymdesk, then edit or delete it whenever you need. Capture the date, time, Gi or No-Gi, duration, class, gym, coach, focus, sparring rounds, effort, and notes.',
    points: [
      'Quick date choices and remembered gym, coach, and session defaults',
      'Manual sessions combine with imported attendance across the app',
      'Clear save status for browser storage or your signed-in account',
    ],
  },
  {
    icon: BarChart3,
    eyebrow: 'See the work add up',
    title: 'Turn attendance into a complete training picture.',
    description: 'Track sessions, mat time, monthly momentum, favorite style, class mix, weekly rhythm, coaches, academies, training time of day, and year-over-year consistency.',
    points: [
      'Filter the overview by rolling period, training style, year, or search',
      'Calendar, monthly activity, cumulative journey, and full-history timeline',
      'Belt-colored rank tracks and promotion milestones in context',
    ],
  },
  {
    icon: Filter,
    eyebrow: 'Find any session',
    title: 'Explore the details behind the totals.',
    description: 'Browse your full session history and narrow it by text, style, class type, coach, academy, date range, or duration. Sort by newest, oldest, or longest to answer the questions that matter to you.',
    points: [
      'Session-level dates, start times, duration, style, coach, and venue',
      'Recent-session shortcuts from the overview',
      'Interactive chart details on hover, focus, or selection',
    ],
  },
  {
    icon: Box,
    eyebrow: 'A new angle on consistency',
    title: 'Walk through your year in 3D.',
    description: 'The 3D Data Lab turns every day into a tile and mat time into height. Orbit, pan, zoom, switch to a top view, color by training style or belt, and open any day to see its sessions.',
    points: [
      'Year and style controls, promotion markers, and day-level details',
      'Training atlas plus an interactive spiral of your history',
      'A flat-view fallback and accessible descriptions for the visualization',
    ],
  },
  {
    icon: Sparkles,
    eyebrow: 'Celebrate the year',
    title: 'Create a Wrapped story from your training.',
    description: 'Replay your year as nine animated cards covering arrival habits, hours, styles, peak month, weekly rhythm, favorite class, coaches, and the bigger story of showing up.',
    points: [
      'Play the full story or open cards one at a time',
      'Save individual PNGs or download the complete recap as a ZIP',
      'Share a card with supported apps or email all nine cards',
    ],
  },
]

const trustFeatures = [
  { icon: Cloud, title: 'Use it your way', text: 'Stay a guest with data stored only in this browser, or create a verified account to sync training across devices and import existing guest records.' },
  { icon: FileSpreadsheet, title: 'Stay in control', text: 'See which CSV is active, replace an import without losing manual sessions, remove browser data, refresh cloud history, or delete account records.' },
  { icon: Moon, title: 'Made for every screen', text: 'Use a responsive desktop or mobile workspace, switch between light and dark themes, and navigate charts and controls with accessible labels and focus states.' },
]

export default function FeaturesPage() {
  return <div className="features-page">
    <header className="features-header">
      <a className="features-brand" href="/" aria-label="Mat Metrics home"><span className="features-brand-mark"><Activity size={18} /></span>mat<strong>metrics</strong><i>.</i></a>
      <a className="features-back" href="/"><ArrowLeft size={15} /> Back to the app</a>
    </header>

    <main>
      <section className="features-hero">
        <span className="features-kicker"><Sparkles size={14} /> Everything your mat time can tell you</span>
        <h1>Your jiu-jitsu journey,<br /><em>made visible.</em></h1>
        <p>Mat Metrics brings scattered attendance records, training notes, and rank milestones into one clear, personal view of the work you put in.</p>
        <div className="features-hero-actions"><a href="/"><Activity size={17} /> Open your dashboard</a><a href="/log"><CalendarDays size={17} /> Log a session</a></div>
        <div className="features-proof" aria-label="Product highlights">
          <span><strong>1</strong> complete training history</span>
          <span><strong>3D</strong> calendar and journey views</span>
          <span><strong>9</strong> shareable Wrapped cards</span>
        </div>
      </section>

      <section className="features-grid" aria-labelledby="features-heading">
        <div className="features-section-heading"><span>THE FULL TOOLKIT</span><h2 id="features-heading">From raw check-ins to a story worth remembering.</h2></div>
        {featureGroups.map(({ icon: Icon, eyebrow, title, description, points }, index) => <article className="features-card" key={title}>
          <div className="features-card-number">0{index + 1}</div>
          <div className="features-card-icon"><Icon size={22} /></div>
          <span className="features-card-eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
          <ul>{points.map(point => <li key={point}><Check size={14} /> <span>{point}</span></li>)}</ul>
        </article>)}
      </section>

      <section className="features-trust" aria-labelledby="trust-heading">
        <div className="features-section-heading"><span>YOUR DATA, YOUR CHOICE</span><h2 id="trust-heading">Personal by design.</h2><p>Explore freely as a guest, then take your history with you when you are ready.</p></div>
        <div className="features-trust-grid">{trustFeatures.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22} /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="features-cta">
        <div><span>YOUR YEAR. YOUR MAT. YOUR STORY.</span><h2>See what all those rounds add up to.</h2></div>
        <a href="/"><span>Explore Mat Metrics</span><Share2 size={18} /></a>
      </section>
    </main>

    <footer className="features-footer"><span>mat<strong>metrics</strong><i>.</i></span><span>Built for the journey on your mats.</span><a href="/instructions"><Download size={14} /> Get your Gymdesk data</a></footer>
  </div>
}
