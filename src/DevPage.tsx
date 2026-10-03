import ChartFrame from './components/ChartFrame'
import SessionSpiral from './SessionSpiral'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ArrowUpRight, CalendarDays, RotateCcw, X } from 'lucide-react'

export type Session = {
  id: number
  training: string
  date: Date
  duration: number
  style: 'Gi' | 'NoGi' | 'Other'
  classType: string
  venue: string
  instructor: string
}
type Day = { date: Date; sessions: Session[]; minutes: number; week: number; weekday: number }
const COLORS = { Gi: '#cbf36b', NoGi: '#b7a0ff', Other: '#ffa987' }
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const dateLabel = (date: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
const hours = (minutes: number) => `${Number((minutes / 60).toFixed(1))}h`

function label(text: string, color = '#8594a9', width = 1.5) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext('2d')!
  context.font = '600 36px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, 256, 48)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.scale.set(width, width * 96 / 512, 1)
  return sprite
}

export default function DevPage({ sessions }: { sessions: Session[] }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const years = useMemo(() => [...new Set(sessions.map(s => s.date.getFullYear()))].sort((a, b) => b - a), [sessions])
  const [yearChoice, setYearChoice] = useState<number | null>(null)
  const year = yearChoice !== null && years.includes(yearChoice) ? yearChoice : years[0]
  const [style, setStyle] = useState('All styles')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hover, setHover] = useState<{ day: Day; x: number; y: number } | null>(null)
  const [webglError, setWebglError] = useState(false)
  const [flat, setFlat] = useState(false)
  const visible = useMemo(() => sessions.filter(s => s.date.getFullYear() === year && (style === 'All styles' || s.style === style)), [sessions, year, style])
  const days = useMemo(() => {
    if (year === undefined) return []
    const first = new Date(year, 0, 1)
    const offset = (first.getDay() + 6) % 7
    const byDay = new Map<string, Session[]>()
    visible.forEach(s => byDay.set(dayKey(s.date), [...(byDay.get(dayKey(s.date)) ?? []), s]))
    const result: Day[] = []
    for (const date = new Date(first); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
      const items = byDay.get(dayKey(date)) ?? []
      const index = result.length + offset
      result.push({ date: new Date(date), sessions: items, minutes: items.reduce((sum, s) => sum + s.duration, 0), week: Math.floor(index / 7), weekday: index % 7 })
    }
    return result
  }, [visible, year])
  const selected = days.find(day => dayKey(day.date) === selectedKey)
  const minutes = visible.reduce((sum, s) => sum + s.duration, 0)
  const activeDays = days.filter(d => d.sessions.length).length
  const busiest = days.reduce<Day | null>((best, day) => day.minutes > (best?.minutes ?? 0) ? day : best, null)

  useEffect(() => {
    const host = mountRef.current
    if (!host || !days.length) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setWebglError(true)
      return
    }
    setWebglError(false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25
    host.replaceChildren(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b101b')
    const gap = 0.68
    const weekCount = days.at(-1)!.week + 1
    const width = weekCount * gap
    const center = (weekCount - 1) * gap / 2
    // Orthographic projection keeps all calendar tiles comparable in size.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    const fitCamera = () => {
      const aspect = host.clientWidth / host.clientHeight
      const halfWidth = (width + 6) / 2
      const halfHeight = Math.max(7, halfWidth / aspect)
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
    }
    fitCamera()
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = true
    controls.minZoom = 0.7
    controls.maxZoom = 6
    controls.minPolarAngle = 0.05
    controls.maxPolarAngle = Math.PI / 2.3
    controls.enableRotate = !flat
    const reset = () => {
      camera.position.set(center + (flat ? 0 : 3), flat ? 35 : 24, flat ? 0.01 : 19)
      controls.target.set(center, 0, 2)
      camera.zoom = 1
      camera.updateProjectionMatrix()
      controls.update()
    }
    reset()
    resetRef.current = reset
    scene.add(new THREE.HemisphereLight(0xdbe7ff, 0x172039, 2.7))
    const key = new THREE.DirectionalLight(0xffffff, 3)
    key.position.set(center - 10, 20, 10)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9f8aff, 2)
    rim.position.set(center, 6, -12)
    scene.add(rim)

    const platform = new THREE.Mesh(new RoundedBoxGeometry(width + 4, 0.22, 8.4, 2, 0.1), new THREE.MeshStandardMaterial({ color: '#141d2c', roughness: 0.8, metalness: 0.25 }))
    platform.position.set(center, -0.25, 2)
    scene.add(platform)
    const geometry = new RoundedBoxGeometry(0.55, 1, 0.55, 2, 0.045)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.12, emissive: '#394155', emissiveIntensity: 0.22 })
    const mesh = new THREE.InstancedMesh(geometry, material, days.length)
    const dummy = new THREE.Object3D()
    days.forEach((day, index) => {
      const height = day.sessions.length ? 0.12 + day.minutes / 120 * 0.42 : 0.065
      dummy.position.set(day.week * gap, height / 2 - 0.1, day.weekday * gap)
      dummy.scale.set(1, height, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      const styleMinutes = new Map<Session['style'], number>()
      day.sessions.forEach(session => styleMinutes.set(session.style, (styleMinutes.get(session.style) ?? 0) + session.duration))
      const dominant = [...styleMinutes].sort((a, b) => b[1] - a[1])[0]?.[0]
      mesh.setColorAt(index, new THREE.Color(dominant ? COLORS[dominant] : '#263246'))
    })
    scene.add(mesh)
    WEEKDAYS.forEach((name, i) => {
      const sprite = label(name, '#92a2b9', 1.2)
      sprite.position.set(-1.35, 0, i * gap)
      scene.add(sprite)
    })
    days.filter(day => day.date.getDate() === 1).forEach(day => {
      const sprite = label(new Intl.DateTimeFormat('en', { month: 'short' }).format(day.date).toUpperCase(), '#c8d3e4', 1.3)
      sprite.position.set(day.week * gap + 0.7, 0, -0.85)
      scene.add(sprite)
    })
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.025, 0.64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 }))
    ring.visible = false
    scene.add(ring)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hitAt = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObject(mesh)[0]?.instanceId
    }
    const move = (event: PointerEvent) => {
      const index = hitAt(event)
      if (index === undefined) {
        ring.visible = false
        setHover(null)
        renderer.domElement.style.cursor = 'grab'
        return
      }
      const day = days[index]
      const height = day.sessions.length ? 0.12 + day.minutes / 120 * 0.42 : 0.065
      ring.position.set(day.week * gap, height - 0.08, day.weekday * gap)
      ring.visible = true
      const rect = host.getBoundingClientRect()
      const scaleX = rect.width / host.clientWidth
      const scaleY = rect.height / host.clientHeight
      const expanded = host.closest('dialog')?.open
      setHover({ day, x: Math.min((event.clientX - rect.left) / scaleX + 16, Math.max(8, host.clientWidth - (expanded ? 310 : 210))), y: Math.max(8, (event.clientY - rect.top) / scaleY - (expanded ? 140 : 85)) })
      renderer.domElement.style.cursor = 'pointer'
    }
    let down = { x: 0, y: 0 }
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY } }
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return
      const index = hitAt(event)
      if (index !== undefined) setSelectedKey(dayKey(days[index].date))
    }
    const leave = () => { ring.visible = false; setHover(null) }
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointerleave', leave)
    let frame = 0
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()
    const observer = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return
      fitCamera()
      renderer.setSize(host.clientWidth, host.clientHeight)
    })
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      resetRef.current = null
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.domElement.removeEventListener('pointerleave', leave)
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(m => m.dispose())
        }
        if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose() }
      })
      mesh.dispose()
      renderer.dispose()
      host.replaceChildren()
    }
  }, [days, flat])

  return <div className="calendar-lab">
    <div className="calendar-intro"><div><span className="calendar-kicker">A YEAR ON THE MAT</span><h2>Your training, in rhythm.</h2><p>One tile for every day. Every session leaves its mark.</p></div><span className="calendar-year-stamp">{year ?? '—'}</span></div>
    <div className="calendar-metrics"><div><span>SESSIONS</span><strong>{visible.length}</strong></div><div><span>MAT TIME</span><strong>{hours(minutes)}</strong></div><div><span>ACTIVE DAYS</span><strong>{activeDays}</strong></div><div><span>BIGGEST DAY</span><strong>{busiest ? hours(busiest.minutes) : '—'}</strong><small>{busiest ? dateLabel(busiest.date) : 'No sessions yet'}</small></div></div>
    <ChartFrame title="Training atlas"><section className="calendar-explorer">
      <div className="calendar-controls"><span className="calendar-scene-title"><CalendarDays size={15} /> TRAINING ATLAS</span><div className="calendar-control-group"><select aria-label="Training year" value={year ?? ''} onChange={e => { setYearChoice(Number(e.target.value)); setSelectedKey(null); setHover(null) }}>{years.length ? years.map(y => <option key={y}>{y}</option>) : <option value="">No data</option>}</select><div className="calendar-segments" role="group" aria-label="Training style">{['All styles', 'Gi', 'NoGi', 'Other'].map(s => <button key={s} className={style === s ? 'active' : ''} onClick={() => { setStyle(s); setSelectedKey(null); setHover(null) }}>{s === 'NoGi' ? 'No-Gi' : s}</button>)}</div><button className="calendar-view" onClick={() => { setFlat(!flat); setHover(null) }}>{flat ? '3D view' : 'Top view'}</button><button className="calendar-view" aria-label="Reset camera" onClick={() => resetRef.current?.()}><RotateCcw size={14} /></button></div></div>
      <div className="calendar-stage"><div ref={mountRef} className="three-canvas" aria-label="Interactive training calendar. Columns are weeks, rows are Monday through Sunday. Colored tiles mark training days and taller tiles show more mat time." /><div className="calendar-stage-note"><span>ONE YEAR. YOUR STORY.</span><small>Weeks → &nbsp; / &nbsp; weekdays ↓</small></div>{hover && <div className="calendar-tooltip" style={{ left: hover.x, top: hover.y }}><strong>{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(hover.day.date)}</strong><span>{hover.day.sessions.length ? `${hover.day.sessions.length} sessions · ${hover.day.minutes} min` : 'No training logged'}</span><small>Click to explore this day <ArrowUpRight size={11} /></small></div>}{(webglError || !days.length) && <div className="calendar-empty"><CalendarDays size={30} /><strong>{webglError ? '3D graphics are unavailable' : 'Your calendar starts here'}</strong><span>{webglError ? 'Try a browser with WebGL enabled.' : 'Import your training CSV to fill your atlas.'}</span></div>}<div className="calendar-gestures">{flat ? 'DRAG TO PAN' : 'DRAG TO ORBIT'} <span>·</span> SCROLL TO ZOOM <span>·</span> CLICK A DAY</div></div>
      <div className="calendar-legend"><div>{Object.entries(COLORS).map(([name, color]) => <span key={name}><i style={{ background: color }} />{name === 'NoGi' ? 'No-Gi' : name}</span>)}<span><i style={{ background: '#263246' }} />No training</span></div><span>Height = mat time · Color = style with most minutes that day</span></div>
    </section></ChartFrame>
    <section className="calendar-detail"><div className="calendar-detail-title"><div><span className="calendar-kicker">DAY EXPLORER</span><h3>{selected ? new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selected.date) : 'Every tile has a story.'}</h3></div>{selected && <button aria-label="Close day details" onClick={() => setSelectedKey(null)}><X size={16} /></button>}</div>{selected ? <><p>{selected.sessions.length} sessions · {selected.minutes} minutes on the mat</p>{selected.sessions.length ? <div className="calendar-session-list">{[...selected.sessions].sort((a, b) => a.date.getTime() - b.date.getTime()).map(s => <article key={s.id}><i style={{ background: COLORS[s.style] }} /><div><strong>{s.classType} <span>{s.style === 'NoGi' ? 'No-Gi' : s.style}</span></strong><small>{s.instructor} · {s.venue}</small></div><time>{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(s.date)}</time><b>{s.duration} min</b></article>)}</div> : <p className="calendar-detail-hint">No sessions logged on this day.</p>}</> : <p className="calendar-detail-hint">Select a day in the atlas to see its classes, coaches, and mat time.</p>}</section>
    <SessionSpiral sessions={sessions} />
  </div>
}

