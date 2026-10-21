import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Select, Field, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import type { PurchaseOrder, POLine } from '@/types'
import { POStatusLabels } from '@/types'
import { money, date, round2 } from '@/lib/utils'
import { ArrowLeft, Send, Ban, Truck } from 'lucide-react'

export function PurchaseOrderDetailPage() {
  const { id } = useParams(); const nav = useNavigate(); const { user, meta } = useAuth()
  const [po, setPO] = useState<PurchaseOrder | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeReason, setCloseReason] = useState('')

  const load = async () => { if (id) setPO(await api.getPO(id)) }
  useEffect(() => { load() }, [id])
  if (!po || !meta || !user) return <div>加载中…</div>

  const canEdit = po.status === 'draft' && ['purchaser','purchase_mgr','admin'].includes(user.role)
  const canRelease = canEdit && !!po.supplierId && po.lines.length > 0
  const canClose = ['released','partial_arrival'].includes(po.status) && ['purchaser','purchase_mgr','admin'].includes(user.role)

  const update = async (patch: Partial<PurchaseOrder>) => {
    if (!id) return
    const updated = await api.updatePO(id, { ...po, ...patch } as any) as PurchaseOrder
    setPO(updated)
  }
  const updateLine = (lineId: string, patch: Partial<POLine>) => {
    const lines = po.lines.map(l => {
      if (l.id !== lineId) return l
      const nl = { ...l, ...patch }
      nl.lineAmount = round2(nl.quantity * nl.unitPrice * (1 + nl.taxRate))
      return nl
    })
    update({ lines } as any)
  }
  const release = async () => {
    if (!id) return
    if (!confirm('确认下达采购订单？下达后将通知仓储关注到货。')) return
    await api.releasePO(id); await load()
  }
  const close = async () => {
    if (!id || !closeReason) return alert('关闭原因必填')
    await api.closePO(id, closeReason); setCloseOpen(false); setCloseReason(''); await load()
  }

  return (
    <div>
      <PageHeader title={
        <button onClick={() => nav(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" />{po.code}
        </button> as any
      } subtitle={`供应商: ${po.supplierName || '（待选择）'}`}
      actions={
        <>
          <Badge tone={statusTone(po.status)}>{POStatusLabels[po.status]}</Badge>
          {canEdit && <Button onClick={release} disabled={!canRelease}><Send className="w-4 h-4" />下达订单</Button>}
          {canClose && <Button variant="danger" onClick={() => setCloseOpen(true)}><Ban className="w-4 h-4" />关闭订单</Button>}
          {po.status === 'released' && ['warehouse','purchaser','admin'].includes(user.role) && (
            <Link to="/arrivals"><Button variant="secondary"><Truck className="w-4 h-4" />到货登记</Button></Link>
          )}
        </>
      }/>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardBody>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="供应商">
                <Select value={po.supplierId} disabled={!canEdit} onChange={e => update({ supplierId: e.target.value })}>
                  <option value="">请选择</option>
                  {meta.suppliers.filter(s => s.status === 'qualified').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="关联合同">
                <Select value={po.contractId || ''} disabled={!canEdit} onChange={e => update({ contractId: e.target.value })}>
                  <option value="">无</option>
                  {meta.contracts.filter(c => c.status === 'effective' && c.supplierId === po.supplierId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="币种"><div className="h-9 flex items-center">{po.currencyCode}</div></Field>
              <Field label="付款条件">
                <Select value={po.paymentTermId || ''} disabled={!canEdit} onChange={e => update({ paymentTermId: e.target.value })}>
                  <option value="">请选择</option>
                  {meta.paymentTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="期望到货日期">
                <Input type="date" value={po.expectedArrivalDate?.slice(0,10)} disabled={!canEdit} onChange={e => update({ expectedArrivalDate: e.target.value })} />
              </Field>
              <Field label="交货地址"><Input value={po.deliveryAddress || ''} disabled={!canEdit} onChange={e => update({ deliveryAddress: e.target.value })} placeholder="默认仓库" /></Field>
              <div className="col-span-2"><div className="text-xs text-slate-500">总金额（含税）</div><div className="text-xl font-semibold text-indigo-700 mt-0.5">{money(po.totalAmount)}</div></div>
              {po.closeReason && <div className="col-span-3 text-rose-700 text-sm">关闭原因：{po.closeReason}</div>}
            </div>
          </CardBody></Card>

          <Card><CardBody>
            <h3 className="text-base font-semibold mb-3">订单明细</h3>
            <Table>
              <THead><tr><Th>#</Th><Th>物料</Th><Th>规格</Th><Th>单位</Th><Th>数量</Th><Th>单价(未税)</Th><Th>税率</Th><Th>行金额(含税)</Th><Th>已到货</Th><Th>已入库</Th><Th>交货日期</Th></tr></THead>
              <TBody>
                {po.lines.map((l, i) => (
                  <tr key={l.id}>
                    <Td>{i+1}</Td><Td>{l.materialName}</Td><Td>{l.spec}</Td><Td>{l.unit}</Td>
                    <Td>{canEdit ? <Input type="number" className="w-20" value={l.quantity} onChange={e => updateLine(l.id, { quantity: Number(e.target.value) })} /> : l.quantity}</Td>
                    <Td>{canEdit ? <Input type="number" className="w-24" value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: Number(e.target.value) })} /> : money(l.unitPrice)}</Td>
                    <Td>{(l.taxRate*100).toFixed(0)}%</Td>
                    <Td className="text-indigo-700 font-medium">{money(l.lineAmount)}</Td>
                    <Td>{l.acceptedQty} / {l.quantity}</Td>
                    <Td>{l.putawayQty} / {l.quantity}</Td>
                    <Td>{canEdit ? <Input type="date" className="w-36" value={(l.deliveryDate || po.expectedArrivalDate || '').slice(0,10)} onChange={e => updateLine(l.id, { deliveryDate: e.target.value })} /> : date(l.deliveryDate)}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </CardBody></Card>
        </div>

        <div className="space-y-4">
          <Card><CardBody>
            <h3 className="text-base font-semibold mb-2">单据流转</h3>
            <div className="text-xs text-slate-500 space-y-1">
              <div>创建时间：{date(po.createdAt)}</div>
              {po.releasedAt && <div>下达时间：{date(po.releasedAt)}</div>}
              {po.closedAt && <div>关闭时间：{date(po.closedAt)}</div>}
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <h3 className="text-base font-semibold mb-2">操作提示</h3>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
              <li>草稿状态下可修改供应商、价格、数量、交期。</li>
              <li>必须选择「合格」供应商，黑名单/待准入供应商不可下单。</li>
              <li>下达后由仓储人员进行到货登记和验收。</li>
              <li>订单变更通过「关闭原订单 + 新建订单」处理。</li>
            </ul>
          </CardBody></Card>
        </div>
      </div>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="关闭订单">
        <div className="space-y-3">
          <div className="text-sm text-slate-600">关闭后订单不可再进行到货验收，需填写原因（审计留痕）。</div>
          <Field label="关闭原因" required><Textarea rows={3} value={closeReason} onChange={e => setCloseReason(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCloseOpen(false)}>取消</Button><Button variant="danger" onClick={close}>确认关闭</Button></div>
        </div>
      </Modal>
    </div>
  )
}
