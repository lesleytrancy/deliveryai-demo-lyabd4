import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, TableHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, children, ...p }: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="overflow-x-auto"><table className={cn('w-full text-sm', className)} {...p}>{children}</table></div>
}
export function THead({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-slate-50 text-slate-600', className)} {...p} />
}
export function TBody({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...p} />
}
export function Th({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('text-left font-medium px-4 py-2 whitespace-nowrap', className)} {...p} />
}
export function Td({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-2.5 text-slate-700', className)} {...p} />
}
