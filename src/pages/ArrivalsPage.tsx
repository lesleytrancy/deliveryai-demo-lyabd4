import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Select, Field, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import type { Arrival, PurchaseOrder } from '@/types'
import { ArrivalStatusLabels, POStatusLabels } from '@/types'
import { date } from '@/lib/utils'
import { Plus, CheckCheck } from 'lucide-react'

export function ArrivalsPage() {
  const { user, meta } = useAuth()
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [regOpen, setRegOpen] = useState(false)
  const [inspOpen, setInspOpen] = useState<Arrival | null>(null)
  const canRegister = !!user && ['warehouse','purchaser','admin'].includes(user.role)

  const load = async () => {
    setArrivals(await api.listArrivals())
    setPos(await api.listPOs({ status: 'released' }))
    const partial = await api.listPOs({ status: 'partial_arrival' })
    setPos(p => [...p, ...partial])
  }
  useEffect(() => { load() }, [])

  // 登记表单
  const [selPO, setSelPO] = useState('')
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0,10))
  const [carrier, setCarrier] = useState('')
  const [lines, setLines] = useState<{ orderLineId: string; arrivedQty: number; packageCondition: string }[]>([])
  const openReg = (poId?: string) => {
    const id = poId || (pos[0]?.id ?? '')
    setSelPO(id)
    const po = pos.find(p => p.id === id)
    setLines(po ? po.lines.filter(l => l.acceptedQty < l.quantity - 0.001).map(l => ({ orderLineId: l.id, arrivedQty: +(l.quantity - l.acceptedQty).toFixed(2), packageCondition: '完好' })) : [])
    setArrivalDate(new Date().toISOString().slice(0,10)); setCarrier('')
    setRegOpen(true)
  }
  const submitReg = async () => {
    if (!selPO) return alert('请选择订单')
    const po = pos.find(p => p.id === selPO); if (!po) return
    if (lines.some(l => !l.arrivedQty || l.arrivedQty <= 0)) return alert('请填写到货数量')
    try {
      await api.createArrival({ orderId: selPO, arrivalDate, carrier, lines })
      setRegOpen(false); await load()
    } catch (e: any) { alert(e.message) }
  }

  // 验收表单
  const [inspLines, setInspLines] = useState<Record<string, { acceptedQty: number; rejectedQty: number; rejectReason: string }>>({})
  const [inspComment, setInspComment] = useState('')
  const openInsp = (a: Arrival) => {
    setInspOpen(a); setInspComment('')
    const map: typeof inspLines = {}
    a.lines.forEach(l => { map[l.id] = { acceptedQty: l.arrivedQty, rejectedQty: 0, rejectReason: '' } })
    setInspLines(map)
  }
  const submitInsp = async () => {
    if (!inspOpen) return
    const payload = inspOpen.lines.map(l => ({ id: l.id, ...inspLines[l.id] }))
    try {
      await api.inspectArrival(inspOpen.id, payload, inspComment)
      setInspOpen(null); await load()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <PageHeader title="到货验收" subtitle="到货登记、数量/质量验收与异常处理" actions={
        canRegister ? <Button onClick={() => openReg()}><Plus className="w-4 h-4" />到货登记</Button> : null
      }/>
      <Card><CardBody className="p-0">
        {arrivals.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>到货单号</Th><Th>订单</Th><Th>到货日期</Th><Th>承运人</Th><Th>状态</Th><Th>验收人</Th><Th>创建时间</Th><Th></Th></tr></THead>
            <TBody>
              {arrivals.map(a => {
                const po = pos.concat().find(p => p.id === a.orderId) // may not be in released
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{a.code}</Td>
                    <Td className="text-xs">{po?.code || a.orderId.slice(0,8)}</Td>
                    <Td>{date(a.arrivalDate)}</Td>
                    <Td>{a.carrier}</Td>
                    <Td><Badge tone={statusTone(a.status)}>{ArrivalStatusLabels[a.status]}</Badge></Td>
                    <Td className="text-xs">{a.inspectorId ? meta?.users.find(u=>u.id===a.inspectorId)?.name : '-'}</Td>
                    <Td className="text-xs text-slate-500">{date(a.createdAt)}</Td>
                    <Td>
                      {['registered','inspecting'].includes(a.status) && canRegister ? (
                        <Button size="sm" onClick={() => openInsp(a)}><CheckCheck className="w-4 h-4" />验收</Button>
                      ) : a.status === 'pending_putaway' ? <Badge tone="amber">待入库</Badge> : null}
                    </Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Modal open={regOpen} onClose={() => setRegOpen(false)} title="到货登记" width="max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="采购订单" required>
            <Select value={selPO} onChange={e => openReg(e.target.value)}>
              {pos.length === 0 && <option value="">无已下达订单</option>}
              {pos.map(p => <option key={p.id} value={p.id}>{p.code} - {p.supplierName} ({POStatusLabels[p.status]})</option>)}
            </Select>
          </Field>
          <Field label="到货日期" required><Input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} /></Field>
          <Field label="承运人/物流"><Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="自提/快递/司机" /></Field>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">到货明细</div>
          <Table>
            <THead><tr><Th>物料</Th><Th>单位</Th><Th>订单数量</Th><Th>已到货</Th><Th>本次到货</Th><Th>包装情况</Th></tr></THead>
            <TBody>
              {lines.map((l, i) => {
                const po = pos.find(p => p.id === selPO); const pol = po?.lines.find(x => x.id === l.orderLineId)
                return (
                  <tr key={i}>
                    <Td>{pol?.materialName}</Td><Td>{pol?.unit}</Td><Td>{pol?.quantity}</Td><Td>{pol?.acceptedQty || 0}</Td>
                    <Td><Input type="number" value={l.arrivedQty} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, arrivedQty: Number(e.target.value) } : x))} className="w-24" /></Td>
                    <Td><Input value={l.packageCondition} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, packageCondition: e.target.value } : x))} /></Td>
                  </tr>
                )
              })}
              {lines.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-4">该订单无可到货明细</td></tr>}
            </TBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRegOpen(false)}>取消</Button><Button onClick={submitReg}>登记到货</Button></div>
      </Modal>

      <Modal open={!!inspOpen} onClose={() => setInspOpen(null)} title="到货验收" width="max-w-3xl">
        {inspOpen && (
          <>
            <div className="text-sm text-slate-600 mb-3">到货单：{inspOpen.code}</div>
            <Table>
              <THead><tr><Th>物料</Th><Th>到货数量</Th><Th>合格数量</Th><Th>不合格数量</Th><Th>不合格原因</Th></tr></THead>
              <TBody>
                {inspOpen.lines.map(l => {
                  const s = inspLines[l.id] || { acceptedQty: l.arrivedQty, rejectedQty: 0, rejectReason: '' }
                  return (
                    <tr key={l.id}>
                      <Td>{l.materialName}</Td><Td>{l.arrivedQty}</Td>
                      <Td><Input type="number" className="w-24" value={s.acceptedQty} onChange={e => setInspLines(m => ({ ...m, [l.id]: { ...s, acceptedQty: Number(e.target.value) } }))} /></Td>
                      <Td><Input type="number" className="w-24" value={s.rejectedQty} onChange={e => setInspLines(m => ({ ...m, [l.id]: { ...s, rejectedQty: Number(e.target.value) } }))} /></Td>
                      <Td><Input value={s.rejectReason} placeholder="若有不合格，请填写原因" onChange={e => setInspLines(m => ({ ...m, [l.id]: { ...s, rejectReason: e.target.value } }))} /></Td>
                    </tr>
                  )
                })}
              </TBody>
            </Table>
            <div className="mt-3"><Field label="验收意见"><Textarea rows={2} value={inspComment} onChange={e => setInspComment(e.target.value)} /></Field></div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setInspOpen(null)}>取消</Button><Button onClick={submitInsp}>提交验收</Button></div>
          </>
        )}
      </Modal>
    </div>
  )
}
