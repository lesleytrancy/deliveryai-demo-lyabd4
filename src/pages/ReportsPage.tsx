import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { money, pct } from '@/lib/utils'

export function ReportsPage() {
  const [stats, setStats] = useState<any>(null)
  const [prs, setPRs] = useState<any[]>([])
  const [pos, setPOs] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  useEffect(() => {
    api.dashboard().then(setStats)
    api.listPRs().then(setPRs)
    api.listPOs().then(setPOs)
    api.listSuppliers().then(setSuppliers)
  }, [])
  if (!stats) return null

  const byStatusPR: Record<string, number> = {}; prs.forEach(p => { byStatusPR[p.status] = (byStatusPR[p.status]||0)+1 })
  const byStatusPO: Record<string, number> = {}; pos.forEach(p => { byStatusPO[p.status] = (byStatusPO[p.status]||0)+1 })
  const bySupplier: Record<string, { name: string; count: number; amount: number }> = {}
  pos.forEach(p => {
    if (!p.supplierId) return
    const s = bySupplier[p.supplierId] || { name: p.supplierName || '未指定', count: 0, amount: 0 }
    s.count++; s.amount += p.totalAmount; bySupplier[p.supplierId] = s
  })
  const topSuppliers = Object.values(bySupplier).sort((a, b) => b.amount - a.amount).slice(0, 5)
  const maxSupAmt = topSuppliers[0]?.amount || 1

  return (
    <div>
      <PageHeader title="报表看板" subtitle="采购金额、及时率、供应商绩效等核心指标" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardBody><div className="text-xs text-slate-500">采购申请金额</div><div className="text-2xl font-semibold mt-2 text-indigo-700">{money(stats.totalPRAmount)}</div></CardBody></Card>
        <Card><CardBody><div className="text-xs text-slate-500">采购订单金额</div><div className="text-2xl font-semibold mt-2 text-sky-700">{money(stats.totalPOAmount)}</div></CardBody></Card>
        <Card><CardBody><div className="text-xs text-slate-500">审批及时率</div><div className="text-2xl font-semibold mt-2 text-emerald-700">{pct(stats.approvalOnTimeRate)}</div></CardBody></Card>
        <Card><CardBody><div className="text-xs text-slate-500">到货完成率</div><div className="text-2xl font-semibold mt-2 text-amber-700">{pct(stats.arrivalOnTimeRate)}</div></CardBody></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardBody>
          <h3 className="text-base font-semibold mb-3">申请单状态分布</h3>
          <div className="space-y-2">
            {Object.entries(byStatusPR).map(([k, v]: [string, number]) => {
              const total = prs.length || 1
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs text-slate-600 mb-0.5"><span>{k}</span><span>{v}</span></div>
                  <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-indigo-500 rounded" style={{ width: `${v/total*100}%` }} /></div>
                </div>
              )
            })}
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="text-base font-semibold mb-3">订单状态分布</h3>
          <div className="space-y-2">
            {Object.entries(byStatusPO).map(([k, v]: [string, number]) => {
              const total = pos.length || 1
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs text-slate-600 mb-0.5"><span>{k}</span><span>{v}</span></div>
                  <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-sky-500 rounded" style={{ width: `${v/total*100}%` }} /></div>
                </div>
              )
            })}
            {pos.length === 0 && <div className="text-sm text-slate-400 text-center py-4">暂无订单数据</div>}
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="text-base font-semibold mb-3">供应商采购金额 TOP5</h3>
          <div className="space-y-2">
            {topSuppliers.map(s => (
              <div key={s.name}>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5"><span>{s.name}（{s.count} 单）</span><span className="font-medium text-indigo-700">{money(s.amount)}</span></div>
                <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-emerald-500 rounded" style={{ width: `${s.amount/maxSupAmt*100}%` }} /></div>
              </div>
            ))}
            {topSuppliers.length === 0 && <div className="text-sm text-slate-400 text-center py-4">暂无数据</div>}
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="text-base font-semibold mb-3">供应商概览</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-slate-500">合格供应商</div><div className="text-xl font-semibold mt-1">{suppliers.filter(s=>s.status==='qualified').length}</div></div>
            <div><div className="text-xs text-slate-500">待准入</div><div className="text-xl font-semibold mt-1 text-amber-600">{suppliers.filter(s=>s.status==='pending_admit').length}</div></div>
            <div><div className="text-xs text-slate-500">黑名单</div><div className="text-xl font-semibold mt-1 text-rose-600">{suppliers.filter(s=>s.status==='blacklist').length}</div></div>
            <div><div className="text-xs text-slate-500">活跃申请/订单</div><div className="text-xl font-semibold mt-1">{stats.activePRCount}</div></div>
          </div>
        </CardBody></Card>
      </div>
    </div>
  )
}
