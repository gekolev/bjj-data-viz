import type { HTMLAttributes } from 'react'

// Shadcn-style composable card primitives, styled to match this application's theme.
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card" className={`ui-card ${className}`} {...props} />
}
export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-header" className={`ui-card-header ${className}`} {...props} />
}
export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 data-slot="card-title" className={`ui-card-title ${className}`} {...props} />
}
export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="card-description" className={`ui-card-description ${className}`} {...props} />
}
export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={`ui-card-content ${className}`} {...props} />
}
