import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import type { ManualSession } from '../lib/manualStorage'
import './ManualLog.css'

const today = () => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
const currentHour = () => String(new Date().getHours()).padStart(2, '0') + ':00'
const dateDaysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
const focusOptions = ['Guard passing', 'Guard retention', 'Escapes', 'Submissions', 'Takedowns', 'Positional sparring', 'Drilling', 'Live rounds']
type Props = { sessions: ManualSession[]; error: string; cloud?: boolean; onSave: (session: ManualSession) => boolean | Promise<boolean>; onDelete: (session: ManualSession) => boolean | Promise<boolean> }

export default function ManualLog({ sessions, error, cloud = false, onSave, onDelete }: Props) {
  const latest = [...sessions].sort((a, b) => b.id - a.id)[0]
  const [date, setDate] = useState(today)
  const dateInput = useRef<HTMLInputElement>(null)
  const openCalendar = () => {
    const input = dateInput.current
    if (!input) return
    input.focus()
    try { input.showPicker?.() } catch { /* The focused date field remains available if the browser cannot open it programmatically. */ }
  }
  const [time, setTime] = useState(currentHour)
  const [rounds, setRounds] = useState<number | undefined>()
  const [effort, setEffort] = useState('')
  const [focus, setFocus] = useState<string[]>([])
  const gyms = [...new Set(sessions.map(row => row.venue).filter(Boolean))].slice(-8)
  const instructors = [...new Set(sessions.map(row => row.instructor).filter(Boolean))].slice(-8)
  const [style, setStyle] = useState<'Gi' | 'NoGi'>(latest?.style === 'NoGi' ? 'NoGi' : 'Gi')
  const [duration, setDuration] = useState(String(latest?.duration ?? 60))
  const [classType, setClassType] = useState(latest?.classType ?? 'Training')
  const [venue, setVenue] = useState(latest?.venue ?? '')
  const [instructor, setInstructor] = useState(latest?.instructor ?? '')
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<ManualSession | null>(null)
  const [editingRecord, setEditingRecord] = useState<ManualSession | null>(null)
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const minutes = Number(duration)
    const parsed = new Date(date + 'T' + time + ':00')
    if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(parsed.getTime()) || date > today() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) { setMessage('Choose a valid date and time up to today and a duration from 1 to 1440 minutes.'); return }
    if (rounds !== undefined && (!Number.isInteger(rounds) || rounds < 0 || rounds > 100)) { setMessage('Choose between 0 and 100 sparring rounds.'); return }
    const type = classType.trim() || 'Training'
    const record: ManualSession = { cloudId: editingRecord?.cloudId, cloudRevision: editingRecord?.cloudRevision, id: editing ?? Math.max(Date.now(), ...sessions.map(row => row.id + 1)), date: parsed, duration: minutes, style, classType: type, venue: venue.trim(), instructor: instructor.trim(), notes: notes.trim(), training: type + ' - ' + (style === 'NoGi' ? 'No-Gi' : 'Gi') + (venue.trim() ? ' - ' + venue.trim() : ''), timeRecorded: true, rounds, effort, focus }
    setSaving(true)
    try {
    if (await onSave(record)) { setMessage(editing === null ? cloud ? 'Training saved to your account. Your dashboard is updated.' : 'Training saved on this device. Your dashboard is updated.' : 'Training updated.'); setEditing(null); setEditingRecord(null); setNotes(''); setRounds(undefined); setEffort(''); setFocus([]); setDate(today()); setTime(currentHour()) }
    } finally { setSaving(false) }
  }
  const edit = (row: ManualSession) => {
    setEditingRecord(row); setEditing(row.id); setTime(row.timeRecorded ? String(row.date.getHours()).padStart(2, '0') + ':' + String(row.date.getMinutes()).padStart(2, '0') : currentHour()); setRounds(row.rounds); setEffort(row.effort ?? ''); setFocus(row.focus ?? []); setDate([row.date.getFullYear(), String(row.date.getMonth() + 1).padStart(2, '0'), String(row.date.getDate()).padStart(2, '0')].join('-')); setStyle(row.style === 'NoGi' ? 'NoGi' : 'Gi'); setDuration(String(row.duration)); setClassType(row.classType); setVenue(row.venue); setInstructor(row.instructor); setNotes(row.notes); setDetails(true); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return <section className="manual-log">
    <div className="manual-intro"><h2>Log your mat time</h2><p>No Gymdesk needed. Pick your session and save in a few taps.</p><small>{cloud ? 'Saved to your account after each successful save. Available when you log in on another device.' : 'Stored only in this browser on this device. Clearing site data removes your log.'}</small></div>
    {error && <p className="manual-error" role="alert">{error}</p>}
    <form className="manual-form" onSubmit={submit}>
      <fieldset className="manual-save-fields" disabled={saving}>
      <h3>{editing === null ? 'New training session' : 'Edit training session'}</h3>
      <div className="manual-options manual-date-presets">{[0, 1, 2].map(days => <button key={days} type="button" aria-pressed={date === dateDaysAgo(days)} onClick={() => setDate(dateDaysAgo(days))}>{days === 0 ? 'Today' : days === 1 ? 'Yesterday' : '2 days ago'}</button>)}</div>
      <div className="manual-date-row"><label htmlFor="manual-training-date">Training date<input ref={dateInput} id="manual-training-date" type="date" required max={today()} value={date} onChange={event => setDate(event.target.value)} aria-describedby="manual-date-hint" /></label><button type="button" className="manual-calendar-button" onClick={openCalendar} aria-label="Open calendar to log an older training session" title="Choose an older training date"><CalendarDays size={22} aria-hidden="true" /></button></div>
      <p id="manual-date-hint" className="manual-date-hint">Logging an older session? Tap the calendar to choose its date.</p>
      <fieldset><legend>Start time</legend><div className="manual-time"><label>Hour<select value={time.slice(0, 2)} onChange={event => setTime(event.target.value + time.slice(2))}>{Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map(hour => <option key={hour} value={hour}>{hour}:00</option>)}</select></label><label>Minute<select value={time.slice(3)} onChange={event => setTime(time.slice(0, 3) + event.target.value)}>{Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map(minute => <option key={minute}>{minute}</option>)}</select></label><button type="button" onClick={() => setTime(currentHour())}>Current hour</button></div><small>Defaults to the current hour on your device. Tap to change it.</small></fieldset>
      <fieldset><legend>Training style</legend><div className="manual-options">{(['Gi', 'NoGi'] as const).map(value => <button key={value} type="button" aria-pressed={style === value} onClick={() => setStyle(value)}>{value === 'NoGi' ? 'No-Gi' : value}</button>)}</div></fieldset>
      <fieldset><legend>Duration</legend><div className="manual-options">{[45, 60, 90, 120].map(value => <button key={value} type="button" aria-pressed={duration === String(value)} onClick={() => setDuration(String(value))}>{value} min</button>)}</div></fieldset>
      <label>Minutes<input type="number" inputMode="numeric" min="1" max="1440" step="1" required value={duration} onChange={event => setDuration(event.target.value)} /></label>
      <fieldset><legend>Session type</legend><div className="manual-options manual-wrap">{[...new Set(['Training', 'Fundamentals', 'Advanced', 'Open mat', 'Private lesson', classType])].map(value => <button key={value} type="button" aria-pressed={classType === value} onClick={() => setClassType(value)}>{value}</button>)}</div></fieldset>
      <fieldset><legend>Training focus (optional · choose several)</legend><div className="manual-options manual-wrap">{focusOptions.map(value => <button key={value} type="button" aria-pressed={focus.includes(value)} onClick={() => setFocus(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value])}>{value}</button>)}</div></fieldset>
      <fieldset><legend>Sparring rounds (optional)</legend><div className="manual-options manual-wrap">{[undefined, 0, 1, 2, 3, 4, 5, 6, 8, 10, 12].map(value => <button key={value ?? 'unset'} type="button" aria-pressed={rounds === value} onClick={() => setRounds(value)}>{value === undefined ? 'Not recorded' : value}</button>)}</div><label className="manual-custom-rounds">Custom rounds<input type="number" inputMode="numeric" min="0" max="100" step="1" value={rounds ?? ''} onChange={event => setRounds(event.target.value === '' ? undefined : Number(event.target.value))} /></label></fieldset>
      <fieldset><legend>Effort (optional)</legend><div className="manual-options manual-wrap">{['', 'Light', 'Moderate', 'Hard'].map(value => <button key={value} type="button" aria-pressed={effort === value} onClick={() => setEffort(value)}>{value || 'Not recorded'}</button>)}</div></fieldset>
      <button className="manual-details" type="button" aria-expanded={details} onClick={() => setDetails(!details)}>{details ? 'Hide details' : 'Add gym, instructor or notes (optional)'}</button>
      {details && <div className="manual-extra"><fieldset><legend>Recent gyms</legend><div className="manual-options manual-wrap">{['', ...gyms].map(value => <button key={value} type="button" aria-pressed={venue === value} onClick={() => setVenue(value)}>{value || 'Not recorded'}</button>)}</div></fieldset><label>Gym<input maxLength={160} autoComplete="organization" value={venue} onChange={event => setVenue(event.target.value)} placeholder="Your gym" /></label><fieldset><legend>Recent instructors</legend><div className="manual-options manual-wrap">{['', ...instructors].map(value => <button key={value} type="button" aria-pressed={instructor === value} onClick={() => setInstructor(value)}>{value || 'Not recorded'}</button>)}</div></fieldset><label>Instructor<input maxLength={160} value={instructor} onChange={event => setInstructor(event.target.value)} placeholder="Instructor name" /></label><label>Notes<textarea maxLength={2000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Techniques, rounds, or something to work on" /></label></div>}
      <div className="manual-save"><button type="submit" className="button button-primary">{editing === null ? 'Save training' : 'Save changes'}</button>{editing !== null && <button type="button" onClick={() => { setEditing(null); setNotes(''); setRounds(undefined); setEffort(''); setFocus([]); setDate(today()); setTime(currentHour()); setMessage('') }}>Cancel edit</button>}</div>
      <p className="manual-status" role="status">{message}</p>
      </fieldset>
    </form>
    <div className="manual-history"><h3>Your manual sessions <span>({sessions.length})</span></h3>{!sessions.length && <p>Your first session starts here. Save a training above to see your progress.</p>}
      {[...sessions].sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id).map(row => <article key={row.id}><div><strong>{row.classType} · {row.style === 'NoGi' ? 'No-Gi' : row.style}</strong><p>{row.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{row.timeRecorded && ' · ' + row.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {row.duration} min</p>{row.venue && <p>{row.venue}{row.instructor ? ' · ' + row.instructor : ''}</p>}{!row.venue && row.instructor && <p>{row.instructor}</p>}{row.focus?.length ? <p>Focus: {row.focus.join(', ')}</p> : null}{row.rounds !== undefined && <p>{row.rounds} sparring rounds</p>}{row.effort && <p>Effort: {row.effort}</p>}{row.notes && <p className="manual-notes">{row.notes}</p>}</div><div className="manual-record-actions"><button type="button" onClick={() => edit(row)}>Edit</button>{deleting && (deleting.cloudId ? deleting.cloudId === row.cloudId : deleting.id === row.id) ? <><button type="button" disabled={saving} onClick={async () => { if (saving) return; setSaving(true); try { if (await onDelete(deleting)) { setDeleting(null); if (editing === row.id) { setEditing(null); setNotes(''); setRounds(undefined); setEffort(''); setFocus([]); setDate(today()); setTime(currentHour()) } setMessage('Training deleted.'); } } finally { setSaving(false) } }}>Confirm delete</button><button type="button" onClick={() => setDeleting(null)}>Keep</button></> : <button type="button" onClick={() => setDeleting(row)}>Delete</button>}</div></article>)}
    </div>
  </section>
}
