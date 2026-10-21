import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'indigo'
const tones: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
  blue: 'bg-sky-100 text-sky-700',
  indigo: 'bg-indigo-100 text-indigo-700',
}
export function Badge({ className, tone = 'slate', ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)} {...p} />
}

export function statusTone(status?: string): Tone {
  if (!status) return 'slate'
  if (['approved', 'qualified', 'completed', 'matched', 'effective', 'confirmed', 'paid', 'putaway', 'accepted'].includes(status)) return 'green'
  if (['pending', 'draft', 'registered', 'inspecting', 'partial_arrival', 'matching', 'pending_putaway', 'pending_admit', 'released', 'all_arrived'].includes(status)) return 'blue'
  if (['rejected', 'blacklist', 'mismatch', 'closed', 'expired', 'terminated'].includes(status)) return 'red'
  if (['withdrawn', 'paused', 'potential'].includes(status)) return 'slate'
  return 'amber'
}
