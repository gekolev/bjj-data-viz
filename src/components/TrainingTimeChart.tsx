import { useMemo } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'
import { BarChart, CartesianGrid, LabelList, Tooltip } from 'recharts'
import ResponsiveContainer from './ResponsiveChart'
import ChartFrame from './ChartFrame'
import { ChartXAxis as XAxis, ChartYAxis as YAxis } from './ChartAxes'
import { AnimatedBar as Bar } from './AnimatedChartSeries'
import { buildTrainingTimeDistribution, type JourneySession } from '../lib/trainingJourney'

export default function TrainingTimeChart({ sessions, period }: { sessions: JourneySession[]; period: string }) {
  const { bins, recorded, unknown } = useMemo(() => buildTrainingTimeDistribution(sessions), [sessions])
  const peak = Math.max(0, ...bins.map(bin => bin.sessions))
  const busiest = bins.filter(bin => bin.sessions === peak).map(bin => bin.label)

  return <ChartFrame title="Training time of day">
    <section className="panel insight-panel training-time-panel">
      <div className="panel-heading">
        <div><h2>Training time of day</h2><span className="chart-period-label"><CalendarDays size={12} />Period: {period}</span><p>Sessions by class start time</p><p className="chart-explanation">Check-ins are matched to the nearest class start: 07:30, 09:00, 12:00, 18:00 or 19:10.</p></div>
        <span className="chart-type-label">BY TIME</span>
      </div>
      {recorded ? <div className="training-time-chart" style={{ minHeight: Math.max(220, bins.length * 30 + 40) }} role="img" aria-label={`Sessions by time of day: ${bins.map(bin => `${bin.label}: ${bin.sessions}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} layout="vertical" margin={{ top: 8, right: 36, left: 0, bottom: 4 }} barCategoryGap="20%">
            <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="4 5" />
            <XAxis type="number" allowDecimals={false} domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={60} interval={0} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-text)', fontSize: 14 }} />
            <Tooltip labelFormatter={label => `${label} class`} cursor={{ fill: 'var(--chart-hover)' }} contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 14 }} />
            <Bar dataKey="sessions" name="Sessions" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={30}>
              <LabelList dataKey="sessions" position="right" fill="var(--chart-secondary)" fontSize={14} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div> : <div className="training-time-empty"><Clock3 size={24} /><strong>No recorded training times</strong><span>Import sessions with a time or add a time when logging training.</span></div>}
      <div className="insight-foot training-time-summary"><Clock3 size={14} /><span>{recorded ? <>{busiest.length === 1 ? 'Most attended class: ' : 'Most attended classes: '}<strong>{busiest.join(', ')}</strong> · {peak} {peak === 1 ? 'session' : 'sessions'}{busiest.length > 1 ? ' each' : ''}</> : 'Times will appear as you record them.'}</span></div>
      <p className="training-time-note">{recorded} {recorded === 1 ? 'session with a recorded time' : 'sessions with recorded times'}.{unknown > 0 && ` ${unknown} ${unknown === 1 ? 'session without a known time is' : 'sessions without known times are'} excluded.`}</p>
    </section>
  </ChartFrame>
}
