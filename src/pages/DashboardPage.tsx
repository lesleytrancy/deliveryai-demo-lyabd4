import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { api } from '@/lib/api'
import type { DashboardStats, PurchaseRequest, PurchaseOrder } from '@/types'
import { PRStatusLabels, POStatusLabels, RoleLabels } from '@/types'
import { Badge, statusTone } from '@/components/ui/Badge'
import { money, pct, date } from '@/lib/utils'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [todos, setTodos] = useState<PurchaseRequest[]>([])
  const [recentPos, setRecentPos] = useState<PurchaseOrder[]>([])
  useEffect(() => {
    api.dashboard().then(setStats).catch(() => {})
    api.listPRs({ scope: 'todo' }).then(setTodos).catch(() => {})
    api.listPOs().then(pos => setRecentPos(pos.slice(0, 5))).catch(() => {})
  }, [])

  const cards = [
    { label: '采购申请总金额', value: money(stats?.totalPRAmount), tone: 'bg-indigo-50 text-indigo-700' },
    { label: '采购订单总金额', value: money(stats?.totalPOAmount), tone: 'bg-sky-50 text-sky-700' },
    { label: '待我审批', value: stats?.pendingApprovalCount ?? 0, tone: 'bg-amber-50 text-amber-700' },
    { label: '待入库', value: stats?.pendingPutawayCount ?? 0, tone: 'bg-rose-50 text-rose-700' },
    { label: '合格供应商', value: stats?.supplierCount ?? 0, tone: 'bg-emerald-50 text-emerald-700' },
    { label: '审批及时率', value: pct(stats?.approvalOnTimeRate ?? 0), tone: 'bg-violet-50 text-violet-700' },
  ]

  return (
    <div>
      <PageHeader title="工作台" subtitle="欢迎回来，今天也要高效采购" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {cards.map(c => (
          <Card key={c.label}>
            <CardBody className="p-4">
              <div className="text-xs text-slate-500">{c.label}</div>
              <div className={`text-xl font-semibold mt-2 rounded px-2 py-1 inline-block ${c.tone}`}>{c.value}</div>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold mb-3">待我审批</h3>
            {todos.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">暂无待审批</div> : (
              <div className="space-y-2">
                {todos.slice(0, 6).map(pr => (
                  <Link key={pr.id} to={`/requests/${pr.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-sm font-medium">{pr.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{pr.code} · {pr.applicantName} · {date(pr.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-indigo-600">{money(pr.totalAmount)}</div>
                      <Badge tone={statusTone(pr.status)}>{PRStatusLabels[pr.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold mb-3">最近订单</h3>
            {recentPos.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">暂无订单</div> : (
              <div className="space-y-2">
                {recentPos.map(po => (
                  <Link key={po.id} to={`/orders/${po.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-sm font-medium">{po.code}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{po.supplierName || '未选供应商'} · {date(po.expectedArrivalDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-sky-600">{money(po.totalAmount)}</div>
                      <Badge tone={statusTone(po.status)}>{POStatusLabels[po.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardBody>
          <h3 className="text-base font-semibold mb-2">角色权限说明</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
            {Object.entries(RoleLabels).map(([k, v]) => <div key={k}>· <b>{v}</b> ({k})</div>)}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
