import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white rounded-lg border border-slate-200 shadow-sm', className)} {...p} />
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-slate-100 flex items-center justify-between', className)} {...p} />
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <h3 className={cn('text-base font-semibold text-slate-800', className)} {...p} />
}
export function CardBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...p} />
}
