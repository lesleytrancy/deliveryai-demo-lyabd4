import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken, onAuthChange } from '@/lib/api'
import type { User, Meta } from '@/types'

interface AuthCtx {
  user: User | null
  meta: Meta | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => Promise<void>
  reloadMeta: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ user: null, meta: null, loading: true, login: async () => {}, logout: async () => {}, reloadMeta: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadMeta = useCallback(async () => {
    try { const m = await api.meta(); setMeta(m) } catch { setMeta(null) }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!getToken()) { setLoading(false); return }
      try {
        const u = await api.me()
        const m = await api.meta()
        if (cancelled) return
        setUser(u); setMeta(m)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    const off = onAuthChange(() => { if (!getToken()) { setUser(null); setMeta(null) } })
    return () => { cancelled = true; off() }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password)
    setToken(res.token); setUser(res.user)
    const m = await api.meta(); setMeta(m)
  }
  const logout = async () => { try { await api.logout() } catch {}; setToken(null); setUser(null); setMeta(null) }

  return <Ctx.Provider value={{ user, meta, loading, login, logout, reloadMeta }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
