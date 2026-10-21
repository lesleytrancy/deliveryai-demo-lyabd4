import { NavLink, useNavigate } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
import {
  LayoutDashboard, FileText, ShoppingCart, Truck, Package, Receipt, Users, Briefcase,
  Database, BarChart3, ShieldCheck, Bell, LogOut, Menu as MenuIcon, X, RotateCcw
} from 'lucide-react'
import { useAuth } from './AuthProvider'
import { Button } from './ui/Button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Notification } from '@/types'
import { Badge } from './ui/Badge'

interface NavItem { to: string; label: string; icon: ReactNode; roles: string[] }

const NAV: NavItem[] = [
  { to: '/', label: '工作台', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['applicant','dept_manager','purchaser','purchase_mgr','warehouse','finance','finance_mgr','leader','admin'] },
  { to: '/requests', label: '采购申请', icon: <FileText className="w-4 h-4" />, roles: ['applicant','dept_manager','purchaser','purchase_mgr','finance','finance_mgr','leader','admin'] },
  { to: '/approvals', label: '待我审批', icon: <ShieldCheck className="w-4 h-4" />, roles: ['dept_manager','purchaser','purchase_mgr','finance','finance_mgr','leader','admin'] },
  { to: '/orders', label: '采购订单', icon: <ShoppingCart className="w-4 h-4" />, roles: ['purchaser','purchase_mgr','warehouse','finance','finance_mgr','leader','admin'] },
  { to: '/arrivals', label: '到货验收', icon: <Truck className="w-4 h-4" />, roles: ['warehouse','purchaser','purchase_mgr','admin'] },
  { to: '/putaways', label: '入库', icon: <Package className="w-4 h-4" />, roles: ['warehouse','finance','admin'] },
  { to: '/invoices', label: '发票/对账', icon: <Receipt className="w-4 h-4" />, roles: ['finance','finance_mgr','purchaser','admin'] },
  { to: '/payments', label: '付款申请', icon: <Briefcase className="w-4 h-4" />, roles: ['finance','finance_mgr','purchase_mgr','leader','admin'] },
  { to: '/suppliers', label: '供应商', icon: <Users className="w-4 h-4" />, roles: ['purchaser','purchase_mgr','admin','finance'] },
  { to: '/contracts', label: '合同', icon: <FileText className="w-4 h-4" />, roles: ['purchaser','purchase_mgr','admin','finance'] },
  { to: '/master-data', label: '基础数据', icon: <Database className="w-4 h-4" />, roles: ['admin','purchase_mgr'] },
  { to: '/audit', label: '审计日志', icon: <ShieldCheck className="w-4 h-4" />, roles: ['admin','purchase_mgr','finance_mgr'] },
  { to: '/reports', label: '报表看板', icon: <BarChart3 className="w-4 h-4" />, roles: ['purchase_mgr','finance_mgr','leader','admin','purchaser'] },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, meta } = useAuth()
  const nav = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unread = notifications.filter(n => !n.read).length

  const loadNotif = async () => { try { setNotifications(await api.listNotifications()) } catch {} }
  useEffect(() => { if (user) { loadNotif(); const t = setInterval(loadNotif, 15000); return () => clearInterval(t) } }, [user])

  const readAll = async () => { await api.readAllNotifications(); await loadNotif() }
  const openNotif = async (n: Notification) => {
    if (!n.read) { await api.readNotification(n.id); await loadNotif() }
    setNotifOpen(false)
    if (n.refType === 'purchase_request') nav(`/requests/${n.refId}`)
    else if (n.refType === 'purchase_order') nav(`/orders/${n.refId}`)
    else if (n.refType === 'arrival') nav('/arrivals')
    else if (n.refType === 'putaway') nav('/putaways')
    else if (n.refType === 'invoice') nav('/invoices')
    else if (n.refType === 'payment_request') nav('/payments')
  }

  const resetDemo = async () => {
    if (!confirm('确认重置全部演示数据？此操作不可恢复。')) return
    await api.resetDemo()
    location.reload()
  }

  const items = NAV.filter(n => !user || n.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded hover:bg-slate-100" onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold text-sm">盐</div>
              <div>
                <div className="text-sm font-semibold leading-tight">久大蓬盐采购管理系统</div>
                <div className="text-xs text-slate-400 leading-tight">Purchase Management · MVP</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setNotifOpen(o => !o)}>
                <Bell className="w-4 h-4" />
                {unread > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}
              </Button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-lg border border-slate-200 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <span className="text-sm font-medium">通知</span>
                    <button className="text-xs text-indigo-600 hover:underline" onClick={readAll}>全部已读</button>
                  </div>
                  {notifications.length === 0 ? <div className="text-center text-slate-400 py-8 text-xs">暂无通知</div> :
                    notifications.map(n => (
                      <button key={n.id} onClick={() => openNotif(n)} className={cn('w-full text-left px-3 py-2 border-b border-slate-50 hover:bg-slate-50 flex items-start gap-2', !n.read && 'bg-indigo-50/50')}>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800">{n.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{n.content}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{new Date(n.at).toLocaleString('zh-CN')}</div>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />}
                      </button>
                    ))}
                </div>
              )}
            </div>
            {user?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={resetDemo}><RotateCcw className="w-4 h-4" />重置演示</Button>
            )}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right">
                <div className="text-sm font-medium leading-tight">{user?.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{user?.role}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={async () => { await logout(); nav('/login') }}><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          'fixed md:static z-30 md:z-auto w-56 bg-white border-r border-slate-200 h-[calc(100vh-3.5rem)] overflow-y-auto transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}>
          <nav className="p-2 space-y-0.5">
            {items.map(item => (
              <NavLink
                key={item.to} to={item.to} end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {item.icon}<span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          {meta && (
            <div className="p-3 border-t border-slate-100 mt-4">
              <div className="text-[11px] text-slate-400">审批规则</div>
              {meta.approvalRules.map(r => (
                <div key={r.id} className="text-[11px] text-slate-500 mt-1">
                  <Badge tone="indigo">¥{r.minAmount}–{r.maxAmount >= 999999999 ? '∞' : r.maxAmount}</Badge>
                  <span className="ml-1">{r.chain.map(c => c.name).join('→')}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
        {mobileOpen && <div className="fixed inset-0 z-20 bg-slate-900/20 md:hidden" onClick={() => setMobileOpen(false)} />}

        <main className="flex-1 min-w-0 p-4 md:p-6 max-w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
