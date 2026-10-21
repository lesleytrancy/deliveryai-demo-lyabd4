import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function money(n: number | undefined | null): string {
  const v = Number(n || 0)
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function date(s: string | undefined): string {
  if (!s) return ''
  return s.length >= 10 ? s.slice(0, 10) : s
}

export function pct(n: number): string { return `${Math.round((n || 0) * 100)}%` }

export function genId() { return Math.random().toString(36).slice(2, 10) }

export function round2(n: number): number { return Math.round(n * 100) / 100 }
