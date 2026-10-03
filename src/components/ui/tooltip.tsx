import type { ComponentProps } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useContext } from 'react'
import { ChartModalContext } from '../ChartModalContext'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({ children, className = '', sideOffset = 6, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  const modal = useContext(ChartModalContext)
  return <TooltipPrimitive.Portal container={modal ?? undefined}><TooltipPrimitive.Content data-slot="tooltip-content" className={`ui-tooltip ${className}`} sideOffset={sideOffset} {...props}>{children}<TooltipPrimitive.Arrow className="ui-tooltip-arrow" /></TooltipPrimitive.Content></TooltipPrimitive.Portal>
}
