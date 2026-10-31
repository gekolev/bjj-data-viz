import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import WrappedViewer from './components/WrappedViewer'
import { animateWrappedCard } from './lib/wrappedAnimation'
import { ArrowUpRight, Flame, Sparkles, Download, GraduationCap, Trophy, Layers, Play } from 'lucide-react'
import './YearWrapped.css'
import { buildArrivalSummary } from './lib/trainingJourney'
import { chooseWrappedPalettes, emailWrappedPalettes, wrappedPaletteStyle } from './lib/wrappedPalettes'
import { trackEvent } from './lib/firebase'

type RecapSession = { date: Date; duration: number; style: string; instructor: string; classType: string; durationEstimated?: boolean; styleEstimated?: boolean; timeRecorded?: boolean }

function rankNames(names: string[]) {
  const counts = new Map<string, number>()
  names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export default function YearWrapped({ sessions, sample, profileEmail }: { sessions: RecapSession[]; sample: boolean; profileEmail?: string | null }) {
  const [guestPalettes] = useState(() => {
    let previous: unknown
    try { previous = JSON.parse(sessionStorage.getItem('matmetrics-wrapped-palettes') ?? 'null') } catch { /* Storage is optional. */ }
    return chooseWrappedPalettes(previous)
  })
  const palettes = useMemo(() => profileEmail ? emailWrappedPalettes(profileEmail) : guestPalettes, [profileEmail, guestPalettes])
  useEffect(() => {
    if (profileEmail) return
    try { sessionStorage.setItem('matmetrics-wrapped-palettes', JSON.stringify(guestPalettes)) } catch { /* Cards still work without storage. */ }
  }, [profileEmail, guestPalettes])
  const years = [...new Set(sessions.map(row => row.date.getFullYear()))].sort((a, b) => b - a)
  const [chosenYear, setChosenYear] = useState<number | null>(null)
  const year = chosenYear !== null && years.includes(chosenYear) ? chosenYear : years[0] ?? new Date().getFullYear()
  const rows = sessions.filter(row => row.date.getFullYear() === year)
  const arrival = buildArrivalSummary(rows)
  const averageArrival = arrival.averageMinutes === null ? null : Math.round(arrival.averageMinutes * 10) / 10
  const arrivalDirection = averageArrival === null ? '' : averageArrival < 0 ? 'early' : averageArrival > 0 ? 'late' : 'on time'
  const minutes = rows.reduce((sum, row) => sum + row.duration, 0)
  const months = Array.from({ length: 12 }, (_, month) => rows.filter(row => row.date.getMonth() === month).length)
  const peak = months.indexOf(Math.max(...months))
  const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, peak, 1))
  const weekdays = Array.from({ length: 7 }, (_, day) => rows.filter(row => row.date.getDay() === day).length)
  const weekday = weekdays.indexOf(Math.max(...weekdays))
  const dayName = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(2024, 0, 7 + weekday))
  const gi = rows.filter(row => row.style === 'Gi').length
  const noGi = rows.filter(row => row.style === 'NoGi').length
  const other = rows.length - gi - noGi
  const dates = [...new Set(rows.map(row => Date.UTC(row.date.getFullYear(), row.date.getMonth(), row.date.getDate()) / 86400000))].sort((a, b) => a - b)
  let streak = 0, current = 0
  dates.forEach((day, index) => { current = index && day === dates[index - 1] + 1 ? current + 1 : 1; streak = Math.max(streak, current) })
  const classes = rankNames(rows.map(row => row.classType.trim()).filter(Boolean))
  const coaches = rankNames(rows.map(row => row.instructor.trim()).filter(name => name && name !== 'Instructor not listed'))
  const topClass = classes[0]
  const topCoach = coaches[0]
  const tiedClasses = classes.filter(([, count]) => count === topClass?.[1]).length
  const tiedCoaches = coaches.filter(([, count]) => count === topCoach?.[1]).length
  const trainingDays = rankNames(rows.map(row => String(Date.UTC(row.date.getFullYear(), row.date.getMonth(), row.date.getDate()))))
  const biggestDay = trainingDays[0]
  const biggestDayLabel = biggestDay ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Number(biggestDay[0]))) : ''
  const tiedDays = trainingDays.filter(([, count]) => count === biggestDay?.[1]).length
  const gridRef = useRef<HTMLDivElement>(null)
  const [viewingCard, setViewingCard] = useState<number | null>(null)
  const [viewerCards, setViewerCards] = useState<HTMLElement[]>([])
  const openViewer = (index: number) => {
    trackEvent('select_content', { content_type: 'wrapped_card', item_id: String(index + 1), data_source: sample ? 'demo' : 'user' })
    setViewerCards(Array.from(gridRef.current?.querySelectorAll<HTMLElement>('.wrap-card') ?? []))
    setViewingCard(index)
  }
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.wrap-card')
    if (!cards) return
    const cleanup: (() => void)[] = []
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        cleanup.push(animateWrappedCard(entry.target as HTMLElement))
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.15 })
    cards.forEach(card => observer.observe(card))
    return () => { observer.disconnect(); cleanup.forEach(stop => stop()) }
  }, [year, sessions, palettes])
  const [saving, setSaving] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [savingCard, setSavingCard] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gridRef.current || saving) return
    setSaving(true)
    setSendingEmail(true)
    setEmailMessage('Preparing your cards...')
    setExportMessage('')
    trackEvent('wrapped_email_started', { data_source: sample ? 'demo' : 'user' })
    try {
      const latest = rows.reduce((last, row) => row.date > last ? row.date : last, rows[0].date)
      const latestTraining = `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}-${String(latest.getDate()).padStart(2, '0')}`
      const { emailRecap } = await import('./lib/exportRecap')
      await emailRecap(gridRef.current, year, email.trim(), {
        latestTraining, sessions: rows.length, minutes, trainingDays: dates.length, sample,
        estimated: rows.some(row => row.durationEstimated || row.styleEstimated),
      }, JSON.stringify({ rows, palettes }), (count, total) => setEmailMessage(`Preparing card ${count} of ${total}...`))
      setEmailMessage(`Your ${year} Wrapped has been submitted for delivery to ${email.trim()}. Check your inbox and spam folder.`)
      trackEvent('wrapped_email_succeeded', { data_source: sample ? 'demo' : 'user' })
    } catch (error) {
      trackEvent('wrapped_email_failed', { reason: 'request_failed', data_source: sample ? 'demo' : 'user' })
      setEmailMessage(error instanceof Error ? error.message : 'Email could not be sent. Please try again.')
    } finally {
      setSaving(false)
      setSendingEmail(false)
    }
  }
  async function downloadCard(index: number) {
    const card = gridRef.current?.querySelectorAll<HTMLElement>('.wrap-card')[index]
    if (!card || saving) return
    setSaving(true)
    setSavingCard(index)
    setExportMessage(`Preparing card ${index + 1}...`)
    try {
      const { exportRecapCard } = await import('./lib/exportRecap')
      await exportRecapCard(card, year, index)
      trackEvent('wrapped_export_succeeded', { export_type: 'card', card_number: index + 1, data_source: sample ? 'demo' : 'user' })
      setExportMessage(`Card ${index + 1} is ready as a PNG image.`)
    } catch (error) {
      trackEvent('wrapped_export_failed', { export_type: 'card', reason: 'render_failed', data_source: sample ? 'demo' : 'user' })
      console.error('Card export failed', error)
      setExportMessage('Could not save this card. Please try again.')
    } finally {
      setSaving(false)
      setSavingCard(null)
    }
  }
  async function downloadRecap() {
    if (!gridRef.current || saving) return
    setSaving(true)
    setExportMessage('Preparing your card images...')
    try {
      const { exportRecap } = await import('./lib/exportRecap')
      await exportRecap(gridRef.current, year, (count, total) => setExportMessage(`Creating card ${count} of ${total}...`))
      trackEvent('wrapped_export_succeeded', { export_type: 'recap', data_source: sample ? 'demo' : 'user' })
      setExportMessage('Your ZIP download is ready, with one PNG image per card.')
    } catch (error) {
      trackEvent('wrapped_export_failed', { export_type: 'recap', reason: 'render_failed', data_source: sample ? 'demo' : 'user' })
      console.error('Recap export failed', error)
      setExportMessage('Could not save your images. Please try again in a browser that supports SVG image export.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="wrapped" aria-label="Your annual training recap">
    <form className="wrapped-email" onSubmit={event => void sendEmail(event)}>
      <div><label htmlFor="wrapped-email">Your year, straight to your inbox</label><p>Send all nine cards as PNG attachments. Your email is used only to deliver this recap.</p></div>
      <div className="wrapped-email-controls"><input id="wrapped-email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setEmailMessage('') }} disabled={saving} /><button className="button wrapped-email-send" type="submit" disabled={!rows.length || saving}>{sendingEmail ? 'Sending cards...' : 'Email my Wrapped'}</button></div>
      <p className="wrapped-email-status" role="status" aria-live="polite">{emailMessage}</p>
    </form>
    <div className="wrapped-toolbar"><span><Sparkles size={15} /> YOUR YEAR. YOUR MAT. YOUR STORY.</span><div><label className="wrapped-year-filter"><span>Year</span><select aria-label="Wrapped year" value={year} disabled={!years.length || saving} onChange={event => { setChosenYear(Number(event.target.value)); setExportMessage('') }}>{(years.length ? years : [year]).map(value => <option key={value}>{value}</option>)}</select></label><button className="wrapped-play" onClick={() => openViewer(0)} disabled={!rows.length}><span className="wrapped-play-icon" aria-hidden="true"><Play size={18} fill="currentColor" /></span>Play Wrapped</button><button onClick={downloadRecap} disabled={!rows.length || saving}><Download size={15} /> {saving ? 'Saving images...' : 'Save recap'}</button></div></div>
    <p className="wrapped-note" role="status">{exportMessage || (sample ? 'A taste of your Wrapped, using sample data. Import your sessions or log training to make it yours.' : `Your ${year} training, based on all logged sessions for this calendar year.`)}</p>
    {!rows.length ? <div className="wrapped-empty"><Sparkles size={36} /><h2>Your story starts with showing up.</h2><p>Log your first session or import your training CSV to unlock your year on the mat.</p></div> : <>
      <div className="wrapped-grid" key={year} ref={gridRef} aria-busy={saving} onClick={event => { const card = (event.target as HTMLElement).closest('.wrap-card'); if (card) openViewer(Array.from(gridRef.current!.querySelectorAll('.wrap-card')).indexOf(card)) }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.target as HTMLElement).matches('.wrap-card')) { event.preventDefault(); (event.target as HTMLElement).click() } }}>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-hero" data-palette={palettes[0]} style={wrappedPaletteStyle(0, palettes[0]) as CSSProperties}><div className="wrap-card-top"><span>MATMETRICS / YEAR WRAPPED</span><ArrowUpRight size={22} /></div><div className="wrap-hero-art" aria-hidden="true"><i /><i /><i /></div><div className="wrap-hero-copy"><span className="wrap-edition">THE {year} EDITION</span><h2>You kept<br />showing<br /><em>up.</em></h2><p>Every tap. Every round. Every little win.<br />This is your year on the mat.</p></div><div className="wrap-card-bottom"><span>THE WORK ADDS UP.</span><span>01 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(0)} aria-label="Download card 1 as PNG"><Download size={16} /> {savingCard === 0 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-sessions" data-palette={palettes[1]} style={wrappedPaletteStyle(1, palettes[1]) as CSSProperties}><div className="wrap-card-top"><span>YOUR ARRIVAL RHYTHM</span><Sparkles size={22} /></div><div className="wrap-main">{averageArrival === null ? <><h2>Your timing story<br />starts here.</h2><p>Add check-in times to see how early or late you arrive.</p></> : <><strong className="wrap-number">{Math.abs(averageArrival)}<small>min</small></strong><h2>{arrivalDirection}<br />on average.</h2><p>Across {arrival.recorded} timed {arrival.recorded === 1 ? 'check-in' : 'check-ins'} in {year}.<br />Compared with the nearest scheduled class start.{arrival.unknown > 0 && ` ${arrival.unknown} ${arrival.unknown === 1 ? 'session without a time was' : 'sessions without times were'} excluded.`}</p></>}</div><div className="wrap-ticket">{arrivalDirection === 'early' ? 'A LITTLE TIME TO FIND YOUR FOCUS.' : arrivalDirection === 'late' ? 'YOU STILL SHOWED UP.' : 'READY WHEN THE ROUND BEGINS.'}</div><div className="wrap-card-bottom"><span>ESTIMATED FROM YOUR CLASS TIMETABLE</span><span>02 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(1)} aria-label="Download card 2 as PNG"><Download size={16} /> {savingCard === 1 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-hours" data-palette={palettes[2]} style={wrappedPaletteStyle(2, palettes[2]) as CSSProperties}><div className="wrap-card-top"><span>TIME WELL SPENT</span><ArrowUpRight size={22} /></div><div className="wrap-orbit" aria-hidden="true"><i /><i /><i /></div><div className="wrap-main"><strong className="wrap-number">{Math.round(minutes / 60 * 10) / 10}<small>hrs</small></strong><h2>Less scrolling.<br />More rolling.</h2><p>{minutes.toLocaleString()} minutes on the mat.<br />All of them part of your journey.</p></div><div className="wrap-card-bottom"><span>{rows.some(row => row.durationEstimated) ? 'INCLUDES ESTIMATED DURATIONS' : 'YOUR LOGGED MAT TIME'}</span><span>03 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(2)} aria-label="Download card 3 as PNG"><Download size={16} /> {savingCard === 2 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-style" data-palette={palettes[3]} style={wrappedPaletteStyle(3, palettes[3]) as CSSProperties}><div className="wrap-card-top"><span>YOUR TRAINING DNA</span><span>Gi / No-Gi</span></div><div className="wrap-main"><h2>{gi === noGi && gi > 0 ? 'A little of both.' : gi > noGi ? 'In your Gi era.' : noGi > gi ? 'No grips. All grit.' : 'Your own style.'}</h2><div className="wrap-style-bars">{[{ name: 'Gi', count: gi }, { name: 'No-Gi', count: noGi }, ...(other ? [{ name: 'Other', count: other }] : [])].map(item => <div key={item.name}><div><span>{item.name}</span><strong>{Math.round(item.count / rows.length * 100)}% <small> / {item.count} sessions</small></strong></div><span className="wrap-bar"><i style={{ width: `${item.count / rows.length * 100}%` }} /></span></div>)}</div><p>Different styles. Same obsession.</p></div><div className="wrap-card-bottom"><span>{rows.some(row => row.styleEstimated) ? 'INCLUDES ESTIMATED STYLES' : 'THIS IS HOW YOU ROLL'}</span><span>04 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(3)} aria-label="Download card 4 as PNG"><Download size={16} /> {savingCard === 3 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-month" data-palette={palettes[4]} style={wrappedPaletteStyle(4, palettes[4]) as CSSProperties}><div className="wrap-card-top"><span>YOUR PEAK CHAPTER</span><ArrowUpRight size={22} /></div><div className="wrap-main"><span className="wrap-overline">YOU WENT ALL IN DURING</span><h2>{monthName}.</h2><p>{months[peak]} sessions. Your busiest month of {year}.</p><div className="wrap-month-chart" aria-label={`Monthly sessions: ${months.join(', ')}`}>{months.map((count, index) => <div key={index}><i className={index === peak ? 'peak' : ''} style={{ height: `${Math.max(3, count / Math.max(...months) * 100)}%` }} /><span>{'JFMAMJJASOND'[index]}</span></div>)}</div></div><div className="wrap-card-bottom"><span>A CHAPTER WORTH REPEATING</span><span>05 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(4)} aria-label="Download card 5 as PNG"><Download size={16} /> {savingCard === 4 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-rhythm" data-palette={palettes[5]} style={wrappedPaletteStyle(5, palettes[5]) as CSSProperties}><div className="wrap-card-top"><span>YOU FOUND YOUR RHYTHM</span><Flame size={23} /></div><div className="wrap-main"><span className="wrap-overline">YOUR MOST-TRAINED DAY</span><h2>{dayName}<br />energy.</h2><p>{weekdays[weekday]} sessions landed on a {dayName}.</p><div className="wrap-streak"><Flame size={32} /><div><strong>{streak}-day streak</strong><span>Your longest run of consecutive training days.</span></div></div></div><div className="wrap-card-bottom"><span>KEEP THE STORY GOING ↗</span><span>06 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(5)} aria-label="Download card 6 as PNG"><Download size={16} /> {savingCard === 5 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-class" data-palette={palettes[6]} style={wrappedPaletteStyle(6, palettes[6]) as CSSProperties}><div className="wrap-card-top"><span>YOUR GO-TO CLASS</span><Layers size={23} /></div><div className="wrap-class-art" aria-hidden="true"><i /><i /><i /></div><div className="wrap-main"><span className="wrap-overline">SOME THINGS STAY ON REPEAT</span><h2>{topClass?.[0] ?? 'Training'}.</h2><p>{topClass ? `${topClass[1]} sessions in your ${tiedClasses > 1 ? 'joint ' : ''}most-trained class.` : 'Every class adds something to your game.'}</p><div className="wrap-pill">{classes.length} {classes.length === 1 ? 'class type explored' : 'class types explored'}</div></div><div className="wrap-card-bottom"><span>REPETITION BUILDS YOUR GAME</span><span>07 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(6)} aria-label="Download card 7 as PNG"><Download size={16} /> {savingCard === 6 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-coach" data-palette={palettes[7]} style={wrappedPaletteStyle(7, palettes[7]) as CSSProperties}><div className="wrap-card-top"><span>IN YOUR CORNER</span><GraduationCap size={25} /></div><div className="wrap-main"><span className="wrap-overline">{topCoach ? 'YOUR MOST-TRAINED-WITH COACH' : 'EVERY JOURNEY HAS ITS GUIDES'}</span><h2>{topCoach?.[0] ?? 'Who’s in your corner?'}</h2><p>{topCoach ? `${topCoach[1]} sessions. A lot of lessons along the way.${tiedCoaches > 1 ? ' Joint top coach this year.' : ''}` : 'Add an instructor to your training logs to discover your top coach.'}</p>{topCoach && <div className="wrap-coach-count"><strong>{coaches.length}</strong><span>{coaches.length === 1 ? 'coach in your training story' : 'coaches in your training story'}</span></div>}</div><div className="wrap-card-bottom"><span>GOOD COACHING STAYS WITH YOU</span><span>08 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(7)} aria-label="Download card 8 as PNG"><Download size={16} /> {savingCard === 7 ? 'Saving card...' : 'Save card as image'}</button></div>
        <div className="wrap-card-item"><article role="button" tabIndex={0} aria-label="View animated card" className="wrap-card wrap-bigday" data-palette={palettes[8]} style={wrappedPaletteStyle(8, palettes[8]) as CSSProperties}><div className="wrap-card-top"><span>YOUR BIG MAT DAY</span><Trophy size={23} /></div><div className="wrap-main"><div className="wrap-day-stamp">{biggestDayLabel}</div><strong className="wrap-number">{biggestDay?.[1] ?? 0}</strong><h2>{biggestDay?.[1] === 1 ? 'One session.\nStill a win.' : 'Back for more.'}</h2><p>{biggestDay?.[1] === 1 ? 'One session was your daily high this year.' : 'Sessions in a single day. Your biggest daily session count this year.'}{tiedDays > 1 ? ` You hit that high on ${tiedDays} different days.` : ''}</p></div><div className="wrap-card-bottom"><span>MAKE EVERY SESSION COUNT</span><span>09 / 09</span></div></article><button className="wrap-download" disabled={saving} onClick={() => void downloadCard(8)} aria-label="Download card 9 as PNG"><Download size={16} /> {savingCard === 8 ? 'Saving card...' : 'Save card as image'}</button></div>
      </div><div className="wrapped-footer"><Sparkles size={18} /><p>The best part? Your next chapter is still unwritten.</p><span>See you on the mat.</span></div>
    </>}
    {viewingCard !== null && viewerCards.length > 0 && <WrappedViewer key={palettes.join('-')} cards={viewerCards} index={viewingCard} onChange={setViewingCard} onClose={() => setViewingCard(null)} />}
  </section>
}
