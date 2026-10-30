import { useContext, type ComponentProps } from 'react'
import { ResponsiveContainer } from 'recharts'
import { ChartModalContext } from './ChartModalContext'

/** Reset chart measurements and transient interaction state at modal boundaries.
 * Keep controls and data selection outside this container mounted unchanged.
 */
export default function ResponsiveChart(props: ComponentProps<typeof ResponsiveContainer>) {
  const expanded = Boolean(useContext(ChartModalContext))
  return <ResponsiveContainer key={expanded ? 'fullscreen' : 'overview'} {...props} />
}
