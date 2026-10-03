import { useContext, type ComponentProps } from 'react'
import { Area, Bar, Line, Pie } from 'recharts'
import { ChartAnimationContext } from './ChartAnimationContext'

// Remount only the plotted series, preserving chart controls and selected data.
export function AnimatedBar(props: ComponentProps<typeof Bar>) {
  const replay = useContext(ChartAnimationContext)
  return <Bar key={replay} {...props} />
}
export function AnimatedArea(props: ComponentProps<typeof Area>) {
  const replay = useContext(ChartAnimationContext)
  return <Area key={replay} {...props} />
}
export function AnimatedLine(props: ComponentProps<typeof Line>) {
  const replay = useContext(ChartAnimationContext)
  return <Line key={replay} {...props} />
}
export function AnimatedPie(props: ComponentProps<typeof Pie>) {
  const replay = useContext(ChartAnimationContext)
  return <Pie key={replay} {...props} />
}
