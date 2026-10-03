import { useContext, type ComponentProps } from 'react'
import { XAxis, YAxis } from 'recharts'
import { ChartModalContext } from './ChartModalContext'

export function ChartXAxis(props: ComponentProps<typeof XAxis>) {
  const expanded = Boolean(useContext(ChartModalContext))
  return <XAxis {...props} height={expanded ? 52 : props.height} tickMargin={expanded ? 12 : props.tickMargin} tick={expanded ? { fill: '#656c5b', fontSize: 18 } : props.tick} />
}

export function ChartYAxis(props: ComponentProps<typeof YAxis>) {
  const expanded = Boolean(useContext(ChartModalContext))
  return <YAxis {...props} width={expanded ? (props.type === 'category' ? 230 : 90) : props.width} tickMargin={expanded ? 12 : props.tickMargin} tick={expanded ? { fill: '#656c5b', fontSize: 18 } : props.tick} />
}
