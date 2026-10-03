import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RotateCcw } from 'lucide-react'
import ChartFrame from './components/ChartFrame'
import type { Session } from './DevPage'
import { bjjRankHistory, describeRank, rankAtDate, type RankPromotion } from './lib/rankHistory'
import { RankBadge, RankColorControls, RankColorLegend } from './components/RankContext'

const COLORS = { Gi: '#cbf36b', NoGi: '#b7a0ff', Other: '#ffa987' }
const dateLabel = (date: Date) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
// Equal month sectors align seasons across years, including leap years.
const dateAngle = (date: Date) => -Math.PI / 2 + (date.getMonth() + (date.getDate() - 1 + 0.5) / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 12 * Math.PI * 2

export default function SessionSpiral({ sessions, ranks = [] }: { sessions: Session[]; ranks?: RankPromotion[] }) {
  const history = useMemo(() => bjjRankHistory(ranks), [ranks])
  const [colorByBelt, setColorByBelt] = useState(true)
  const beltMode = colorByBelt && history.length > 0
  const ordered = useMemo(() => [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id), [sessions])
  const mount = useRef<HTMLDivElement>(null)
  const reset = useRef<(() => void) | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [topView, setTopView] = useState(true)
  const detail = ordered[selected ?? hovered ?? -1]
  const activePoint = useRef<number | null>(null)
  useEffect(() => { activePoint.current = selected ?? hovered }, [selected, hovered])

  useEffect(() => { setSelected(null); setHovered(null) }, [ordered])

  useEffect(() => {
    const host = mount.current
    if (!host || !ordered.length) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setError(true); return }
    setError(false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.replaceChildren(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b101b')
    const firstYear = ordered[0].date.getFullYear()
    const lastYear = ordered.at(-1)!.date.getFullYear()
    const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
    const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const dayCounts = new Map<string, number>()
    ordered.forEach(session => {
      const key = dayKey(session.date)
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1)
    })
    const yearSpacing = 2 + [...dayCounts.values()].reduce((max, count) => Math.max(max, count), 1) * 0.25
    const lanes = new Map<string, number>()
    const yearRadius = (year: number) => 12 + (year - firstYear) * yearSpacing
    const positions = ordered.map(session => {
      const key = dayKey(session.date)
      const lane = lanes.get(key) ?? 0
      lanes.set(key, lane + 1)
      const radius = yearRadius(session.date.getFullYear()) + lane * 0.25
      const angle = dateAngle(session.date)
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    })
    const outerRadius = yearRadius(lastYear) + yearSpacing + 1.5
    const maxDuration = ordered.reduce((max, session) => Math.max(max, session.duration), 1)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, outerRadius * 12 + 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enableRotate = !topView
    controls.minZoom = 0.65
    controls.maxZoom = 12
    controls.maxPolarAngle = Math.PI / 2.1
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return
      const aspect = host.clientWidth / host.clientHeight
      const half = Math.max(outerRadius * 1.08, outerRadius * 1.08 / aspect)
      camera.left = -half * aspect; camera.right = half * aspect
      camera.top = half; camera.bottom = -half
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight)
    }
    reset.current = () => {
      camera.position.set(0, outerRadius * 3, topView ? 0.001 : outerRadius * 1.5)
      controls.target.set(0, 0, 0)
      camera.zoom = 1
      camera.updateProjectionMatrix()
      controls.update()
    }
    resize(); reset.current()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x172039, 3))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(-5, 15, 8)
    scene.add(light)
    const guides: THREE.Line[] = []
    const bands: THREE.Mesh[] = []
    const addGuide = (points: THREE.Vector3[], color: string) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }))
      guides.push(line); scene.add(line)
    }
    years.forEach((year, index) => {
      const radius = yearRadius(year)
      const band = new THREE.Mesh(new THREE.RingGeometry(radius - 0.35, radius + yearSpacing - 0.55, 180), new THREE.MeshBasicMaterial({ color: index % 2 ? '#182337' : '#121c2d', side: THREE.DoubleSide }))
      band.rotation.x = -Math.PI / 2
      band.position.y = -0.03
      bands.push(band); scene.add(band)
      addGuide(Array.from({ length: 361 }, (_, i) => new THREE.Vector3(Math.cos(i / 360 * Math.PI * 2) * radius, 0, Math.sin(i / 360 * Math.PI * 2) * radius)), '#63758f')
    })
    for (let month = 0; month < 12; month++) {
      const angle = -Math.PI / 2 + month / 12 * Math.PI * 2
      addGuide([new THREE.Vector3(Math.cos(angle) * 11.5, 0, Math.sin(angle) * 11.5), new THREE.Vector3(Math.cos(angle) * (outerRadius - 1), 0, Math.sin(angle) * (outerRadius - 1))], month % 3 === 0 ? '#718098' : '#38465e')
    }
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.095, 12, 8), new THREE.MeshBasicMaterial(), ordered.length)
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 5), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4 }), ordered.length)
    const dummy = new THREE.Object3D()
    ordered.forEach((session, index) => {
      const height = topView ? 0.12 : 0.12 + Math.max(0, session.duration) / maxDuration * 2.3
      const point = positions[index]
      dummy.position.set(point.x, height, point.z)
      dummy.updateMatrix()
      beads.setMatrixAt(index, dummy.matrix)
      const rank = rankAtDate(session.date, history)
      const color = beltMode ? (rank ? describeRank(rank).color : '#8190a7') : COLORS[session.style]
      beads.setColorAt(index, new THREE.Color(color))
      dummy.position.y = height / 2
      dummy.scale.set(1, height, 1)
      dummy.updateMatrix()
      stems.setMatrixAt(index, dummy.matrix)
      stems.setColorAt(index, new THREE.Color(color))
      dummy.scale.set(1, 1, 1)
    })
    scene.add(beads, stems)
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, depthTest: false }))
    highlight.visible = false
    scene.add(highlight)
    const addLabel = (text: string, position: THREE.Vector3, width = 1) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 80
      const context = canvas.getContext('2d')
      if (!context) return
      context.font = '700 48px sans-serif'
      context.textAlign = 'center'; context.textBaseline = 'middle'
      context.fillStyle = '#f0f5ff'
      context.fillText(text, 128, 40)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
      marker.position.copy(position)
      marker.scale.set(width, width * 80 / 256, 1)
      scene.add(marker)
    }
    years.forEach(year => addLabel(String(year), new THREE.Vector3(-1.5, 0.03, -yearRadius(year) - yearSpacing / 2), outerRadius * 0.12))
    Array.from({ length: 12 }, (_, month) => {
      const angle = -Math.PI / 2 + (month + 0.5) / 12 * Math.PI * 2
      addLabel(new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, month, 1)).toUpperCase(), new THREE.Vector3(Math.cos(angle) * (outerRadius - 0.1), 0, Math.sin(angle) * (outerRadius - 0.1)), outerRadius * 0.15)
    })
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObject(beads)[0]?.instanceId ?? null
    }
    const move = (event: PointerEvent) => { const index = hit(event); setHovered(index); renderer.domElement.style.cursor = index === null ? 'grab' : 'pointer' }
    const leave = () => setHovered(null)
    let down = { x: 0, y: 0 }
    const start = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY } }
    const end = (event: PointerEvent) => { if (Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5) setSelected(hit(event)) }
    const canvas = renderer.domElement
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointerup', end)
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      const index = activePoint.current
      highlight.visible = index !== null && index < ordered.length
      if (highlight.visible && index !== null) {
        beads.getMatrixAt(index, dummy.matrix)
        highlight.position.setFromMatrixPosition(dummy.matrix)
      }
      controls.update(); renderer.render(scene, camera)
    }
    animate()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect(); controls.dispose(); reset.current = null
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerdown', start)
      canvas.removeEventListener('pointerup', end)
      for (const object of [beads, stems, highlight, ...guides, ...bands]) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(material => material.dispose())
      }
      scene.traverse(object => {
        if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose() }
      })
      beads.dispose(); stems.dispose(); renderer.dispose(); host.replaceChildren()
    }
  }, [ordered, topView, history, beltMode])

  return <ChartFrame title="Seasonal training wheel"><section className="session-spiral calendar-explorer">
    <div className="spiral-heading"><span className="calendar-kicker">CONSISTENCY THROUGH THE SEASONS</span><h3>Compare your training, year by year.</h3><p>One ring per year, oldest inside. Compare the same month across rings to spot busy periods and breaks. Every dot is one session.</p></div>
    <div className="calendar-controls"><span className="calendar-scene-title">{ordered.length.toLocaleString()} SESSION POINTS</span><div className="calendar-control-group">{history.length > 0 && <RankColorControls belt={beltMode} onChange={setColorByBelt} />}<button className="calendar-view" onClick={() => { setTopView(v => !v); setHovered(null) }}>{topView ? '3D duration view' : 'Top view'}</button><button className="calendar-view" aria-label="Reset training wheel camera" onClick={() => reset.current?.()}><RotateCcw size={14} /></button></div></div>
    <div className="spiral-stage">{detail && <div className="wheel-tooltip"><strong>{detail.training}</strong><span>{dateLabel(detail.date)}</span><span>{detail.duration} min · {detail.style === 'NoGi' ? 'No-Gi' : detail.style}</span>{history.length > 0 && <RankBadge rank={rankAtDate(detail.date, history)} />}</div>}<div ref={mount} className="three-canvas" role="img" aria-label={`Calendar wheel of all ${ordered.length} training sessions. Each ring represents a year and angle represents calendar date. In 3D view height represents duration; color represents ${beltMode ? 'the recorded belt' : 'training style'}. Use the session selector below for individual details.`} /><div className="calendar-stage-note"><span>ONE RING PER YEAR</span><small>January to December, clockwise</small></div>{(error || !ordered.length) && <div className="calendar-empty"><strong>{error ? '3D graphics are unavailable' : 'Your journey starts here'}</strong><span>{error ? 'Enable WebGL to explore the wheel. Session details remain available below.' : 'Import a training CSV to see every session.'}</span></div>}<div className="calendar-gestures">DRAG TO {topView ? 'PAN' : 'ORBIT'} · SCROLL TO ZOOM · CLICK A DOT</div></div>
    <div className="calendar-legend"><div>{beltMode ? <RankColorLegend history={history} /> : Object.entries(COLORS).map(([style, color]) => <span key={style}><i style={{ background: color }} />{style === 'NoGi' ? 'No-Gi' : style}</span>)}</div><span>{topView ? 'Position = calendar date · Switch to 3D to compare duration' : 'Height = duration · Position = calendar date'}</span></div>
    <div className="spiral-details"><label>Explore a session<select aria-label="Explore a calendar wheel session" value={selected ?? ''} onChange={e => setSelected(e.target.value === '' ? null : Number(e.target.value))}><option value="">Hover or click a dot, or select a session</option>{ordered.map((s, index) => <option key={`${s.id}-${index}`} value={index}>{index + 1}. {dateLabel(s.date)} · {s.training}</option>)}</select></label><div className="spiral-readout" aria-live="polite">{detail ? <><strong>{detail.training}</strong><span>{dateLabel(detail.date)} · {detail.duration} min · {detail.style === 'NoGi' ? 'No-Gi' : detail.style}</span><small>{[detail.instructor, detail.venue].filter(Boolean).join(' · ')}</small>{history.length > 0 && <RankBadge rank={rankAtDate(detail.date, history)} />}</> : <><strong>{ordered.length ? `${dateLabel(ordered[0].date)} — ${dateLabel(ordered.at(-1)!.date)}` : 'No sessions yet'}</strong><span>Zoom in to inspect the dots. Click to keep a session’s details here.</span></>}</div></div>
  </section></ChartFrame>
}
