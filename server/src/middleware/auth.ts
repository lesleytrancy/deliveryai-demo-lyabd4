import type { Request, Response, NextFunction } from 'express'
import { getDB } from '../store.js'
import type { Role, User } from '../types.js'

export interface AuthedRequest extends Request {
  user?: User
}

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-auth-token'] as string | undefined
  const db = getDB()
  if (!token) return res.status(401).json({ error: '未登录或会话已过期' })
  const sess = db.sessions[token]
  if (!sess) return res.status(401).json({ error: '会话已过期' })
  const user = db.users.find(u => u.id === sess.userId)
  if (!user) return res.status(401).json({ error: '用户不存在' })
  req.user = user
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: '未登录' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '无权限执行该操作' })
    }
    next()
  }
}

export function maskSensitive(user: User | undefined, value: string | undefined, type: 'phone' | 'bank'): string | undefined {
  if (!value) return value
  if (user && ['finance', 'finance_mgr', 'purchase_mgr', 'admin'].includes(user.role)) return value
  if (type === 'phone' && value.length >= 7) return value.slice(0, 3) + '****' + value.slice(-4)
  if (type === 'bank' && value.length >= 4) return '****' + value.slice(-4)
  return value
}
