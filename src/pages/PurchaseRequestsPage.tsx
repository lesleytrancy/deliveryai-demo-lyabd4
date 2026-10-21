import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Select, Textarea, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import type { PurchaseRequest, PRLine } from '@/types'
import { PRStatusLabels } from '@/types'
import { money, date, genId } from '@/lib/utils'
import { Plus, FilePlus } from 'lucide-react'

export function PurchaseRequestsPage() {
  const { user, meta } = useAuth()
  const nav = useNavigate()
  const [list, setList] = useState<PurchaseRequest[]>([])
  const [scope, setScope] = useState<'all' | 'mine' | 'todo'>('all')
  const [status, setStatus] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const canCreate = !!user && ['applicant','dept_manager','purchaser','purchase_mgr','admin','leader','finance','finance_mgr'].includes(user.role)

  const load = async () => {
    const params: Record<string, string> = { scope }
    if (status) params.status = status
    setList(await api.listPRs(params))
  }
  useEffect(() => { load() }, [scope, status])

  // 申请单表单状态
  const [form, setForm] = useState<{ title: string; reason: string; expectedArrivalDate: string; budgetAmount: string; costCenterId: string; lines: PRLine[] }>({
    title: '', reason: '', expectedArrivalDate: '', budgetAmount: '', costCenterId: '', lines: []
  })
  const resetForm = () => setForm({ title: '', reason: '', expectedArrivalDate: new Date(Date.now()+7*86400000).toISOString().slice(0,10), budgetAmount: '', costCenterId: '', lines: [] })
  const addLine = () => {
    if (!meta) return
    const firstMat = meta.materials[0]
    setForm(f => ({ ...f, lines: [...f.lines, {
      id: genId(), materialId: firstMat?.id || '', quantity: 1, estimatedUnitPrice: 0, taxRate: firstMat?.defaultTaxRate ?? 0.13, lineAmount: 0
    }]}))
  }
  const updateLine = (id: string, patch: Partial<PRLine>) => {
    setForm(f => ({ ...f, lines: f.lines.map(l => {
      if (l.id !== id) return l
      const nl = { ...l, ...patch }
      if (patch.materialId) {
        const mat = meta?.materials.find(m => m.id === patch.materialId)
        if (mat) { nl.materialName = mat.name; nl.spec = mat.spec; nl.unit = mat.unit; nl.taxRate = mat.defaultTaxRate }
      }
      nl.lineAmount = Math.round(nl.quantity * nl.estimatedUnitPrice * (1 + nl.taxRate) * 100) / 100
      return nl
    }) }))
  }
  const removeLine = (id: string) => setForm(f => ({ ...f, lines: f.lines.filter(l => l.id !== id) }))
  const totalAmount = useMemo(() => Math.round(form.lines.reduce((s,l)=>s+l.lineAmount,0)*100)/100, [form.lines])

  const submit = async (action: 'draft' | 'submit') => {
    if (!meta || !user) return
    if (!form.title) return alert('请填写标题')
    if (!form.reason && action === 'submit') return alert('请填写事由')
    if (!form.expectedArrivalDate && action === 'submit') return alert('请填写期望到货日期')
    if (form.lines.length === 0) return alert('请至少添加一条明细')
    setLoading(true)
    try {
      const body = {
        ...form, budgetAmount: Number(form.budgetAmount || totalAmount), departmentId: user.departmentId || meta.departments[0]?.id,
        currencyCode: 'CNY',
      }
      const pr = await api.createPR(body) as { id: string }
      if (action === 'submit') await api.submitPR(pr.id)
      setOpen(false); resetForm(); await load()
      if (action === 'submit') nav(`/requests/${pr.id}`)
    } catch (e: any) { alert(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="采购申请" subtitle="发起、查看、跟进采购申请单" actions={
        <>
          <Select value={scope} onChange={e => setScope(e.target.value as any)} className="w-32">
            <option value="all">全部申请</option>
            <option value="mine">我的申请</option>
            <option value="todo">待我审批</option>
          </Select>
          <Select value={status} onChange={e => setStatus(e.target.value)} className="w-32">
            <option value="">全部状态</option>
            {Object.entries(PRStatusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {canCreate && <Button onClick={() => { resetForm(); setOpen(true) }}><Plus className="w-4 h-4" />新建申请</Button>}
        </>
      }/>
      <Card>
        <CardBody className="p-0">
          {list.length === 0 ? <Empty /> : (
            <Table>
              <THead><tr><Th>单号</Th><Th>标题</Th><Th>申请人</Th><Th>总金额</Th><Th>期望到货</Th><Th>状态</Th><Th>创建时间</Th><Th></Th></tr></THead>
              <TBody>
                {list.map(pr => (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{pr.code}</Td>
                    <Td>{pr.title}</Td>
                    <Td>{pr.applicantName}</Td>
                    <Td className="text-indigo-700 font-medium">{money(pr.totalAmount)}</Td>
                    <Td>{date(pr.expectedArrivalDate)}</Td>
                    <Td><Badge tone={statusTone(pr.status)}>{PRStatusLabels[pr.status]}</Badge></Td>
                    <Td className="text-xs text-slate-500">{date(pr.createdAt)}</Td>
                    <Td><Link to={`/requests/${pr.id}`} className="text-indigo-600 text-sm hover:underline">查看</Link></Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="新建采购申请" width="max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="标题" required><Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="例如：10月生产原料采购" /></Field>
          <Field label="期望到货日期" required><Input type="date" value={form.expectedArrivalDate} onChange={e => setForm(f => ({...f, expectedArrivalDate: e.target.value}))} /></Field>
          <Field label="事由" required className="md:col-span-2"><Textarea rows={2} value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="简要说明采购原因与用途" /></Field>
          <Field label="预算金额（元）"><Input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({...f, budgetAmount: e.target.value}))} placeholder="留空则按明细合计" /></Field>
          <Field label="成本中心">
            <Select value={form.costCenterId} onChange={e => setForm(f => ({...f, costCenterId: e.target.value}))}>
              <option value="">请选择</option>
              {meta?.costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">明细行</div>
            <Button variant="secondary" size="sm" onClick={addLine}><Plus className="w-4 h-4" />添加明细</Button>
          </div>
          {form.lines.length === 0 ? <div className="text-sm text-slate-400 text-center py-6 border border-dashed rounded-md">暂无明细，点击「添加明细」</div> : (
            <div className="space-y-2">
              {form.lines.map((l, idx) => {
                const mat = meta?.materials.find(m => m.id === l.materialId)
                return (
                  <div key={l.id} className="border border-slate-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>第 {idx+1} 行 · {mat?.name || '未选物料'}</span>
                      <button className="text-rose-600 hover:underline" onClick={() => removeLine(l.id)}>删除</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      <Field label="物料">
                        <Select value={l.materialId} onChange={e => updateLine(l.id, { materialId: e.target.value })}>
                          {meta?.materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                        </Select>
                      </Field>
                      <Field label="数量"><Input type="number" value={l.quantity} onChange={e => updateLine(l.id, { quantity: Number(e.target.value) })} /></Field>
                      <Field label="预估单价(未税)"><Input type="number" value={l.estimatedUnitPrice} onChange={e => updateLine(l.id, { estimatedUnitPrice: Number(e.target.value) })} /></Field>
                      <Field label="税率">
                        <Select value={String(l.taxRate)} onChange={e => updateLine(l.id, { taxRate: Number(e.target.value) })}>
                          {meta?.taxRates.map(t => <option key={t.id} value={t.rate}>{t.name}</option>)}
                        </Select>
                      </Field>
                      <Field label="行金额(含税)"><div className="h-9 flex items-center font-medium text-indigo-700">{money(l.lineAmount)}</div></Field>
                      <Field label="备注"><Input value={l.remark || ''} onChange={e => updateLine(l.id, { remark: e.target.value })} /></Field>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-slate-500">合计（含税）：<span className="text-lg font-semibold text-indigo-700">{money(totalAmount)}</span></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => submit('draft')} disabled={loading}><FilePlus className="w-4 h-4" />存草稿</Button>
              <Button onClick={() => submit('submit')} disabled={loading}>提交审批</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
