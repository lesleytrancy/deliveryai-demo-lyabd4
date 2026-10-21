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
import type { Invoice, PutawayRecord, Arrival, PurchaseOrder } from '@/types'
import { InvoiceStatusLabels } from '@/types'
import { money, date } from '@/lib/utils'
import { Plus, AlertCircle } from 'lucide-react'

export function InvoicesPage() {
  const { user, meta } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [putaways, setPutaways] = useState<PutawayRecord[]>([])
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [open, setOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState<Invoice | null>(null)
  const [reconOpen, setReconOpen] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const [reconSup, setReconSup] = useState('')
  const [reconPeriod, setReconPeriod] = useState(new Date().toISOString().slice(0,7))
  const canRegister = !!user && ['finance','finance_mgr','admin'].includes(user.role)
  const canResolve = !!user && ['finance_mgr','admin'].includes(user.role)

  const load = async () => {
    setInvoices(await api.listInvoices())
    setPutaways(await api.listPutaways())
    setArrivals(await api.listArrivals())
    setPos(await api.listPOs())
  }
  useEffect(() => { load() }, [])

  // 登记发票
  const [selSup, setSelSup] = useState('')
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0,10))
  const [selLines, setSelLines] = useState<Record<string, { qty: number; unitPrice: number; taxRate: number }>>({})
  const openDlg = () => {
    const sup = meta?.suppliers.find(s => s.status === 'qualified')?.id || ''
    setSelSup(sup); setInvNo(''); setInvDate(new Date().toISOString().slice(0,10)); setSelLines({})
    setOpen(true)
  }
  const submit = async () => {
    if (!selSup || !invNo) return alert('供应商与发票号必填')
    const lines = Object.entries(selLines).filter(([,v]) => v.qty > 0).map(([putawayLineId, v]) => ({ putawayLineId, ...v }))
    if (lines.length === 0) return alert('请选择至少一条开票明细')
    try {
      await api.createInvoice({ supplierId: selSup, invoiceNo: invNo, invoiceDate: invDate, lines })
      setOpen(false); await load()
    } catch (e: any) { alert(e.message) }
  }
  const resolve = async () => {
    if (!resolveOpen || !resolveNote) return alert('请填写差异说明')
    await api.resolveInvoiceMismatch(resolveOpen.id, resolveNote); setResolveOpen(null); setResolveNote(''); await load()
  }

  // 供应商已入库明细
  const supLines = selSup ? putaways.flatMap(pw => {
    const po = pos.find(pp => pp.id === pw.orderId); if (po?.supplierId !== selSup) return []
    return pw.lines.map(pl => {
      const ar = arrivals.find(a => a.id === pw.arrivalId)
      const al = ar?.lines.find(x => x.id === pl.arrivalLineId)
      const pol = po.lines.find(l => l.id === al?.orderLineId)
      return { pw, pl, pol }
    })
  }) : []

  // 默认单价
  useEffect(() => {
    if (!open) return
    const map: Record<string, { qty: number; unitPrice: number; taxRate: number }> = {}
    supLines.forEach(({ pl, pol }) => {
      map[pl.id] = { qty: pl.qty, unitPrice: pol?.unitPrice || 0, taxRate: pol?.taxRate || 0.13 }
    })
    setSelLines(map)
  }, [selSup, open])

  const doRecon = async () => {
    if (!reconSup) return alert('请选择供应商')
    try { await api.createReconciliation(reconSup, reconPeriod); setReconOpen(false); alert('对账单已生成') }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <PageHeader title="发票登记与三单匹配" subtitle="采购发票登记 → 订单-入库-发票三单匹配 → 对账" actions={<>
        <Button variant="outline" onClick={() => setReconOpen(true)}>生成对账</Button>
        {canRegister && <Button onClick={openDlg}><Plus className="w-4 h-4" />登记发票</Button>}
      </>}/>
      <Card><CardBody className="p-0">
        {invoices.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>发票号</Th><Th>供应商</Th><Th>开票日期</Th><Th>含税金额</Th><Th>匹配结果</Th><Th>状态</Th><Th>登记时间</Th><Th></Th></tr></THead>
            <TBody>
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{inv.invoiceNo}</Td>
                  <Td>{inv.supplierName}</Td><Td>{date(inv.invoiceDate)}</Td>
                  <Td className="text-indigo-700 font-medium">{money(inv.totalAmount)}</Td>
                  <Td>
                    {inv.matchResult === 'full' && <Badge tone="green">完全匹配</Badge>}
                    {inv.matchResult === 'qty_diff' && <Badge tone="amber">数量差异</Badge>}
                    {inv.matchResult === 'amount_diff' && <Badge tone="red">金额差异</Badge>}
                  </Td>
                  <Td><Badge tone={statusTone(inv.status)}>{InvoiceStatusLabels[inv.status]}</Badge></Td>
                  <Td className="text-xs text-slate-500">{date(inv.registeredAt)}</Td>
                  <Td>
                    {inv.status === 'mismatch' && canResolve && (
                      <Button size="sm" variant="secondary" onClick={() => { setResolveOpen(inv); setResolveNote(inv.mismatchNote || '') }}><AlertCircle className="w-4 h-4" />差异确认</Button>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Modal open={open} onClose={() => setOpen(false)} title="登记发票" width="max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="供应商" required>
            <Select value={selSup} onChange={e => setSelSup(e.target.value)}>
              <option value="">请选择</option>
              {meta?.suppliers.filter(s => s.status === 'qualified').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="发票号" required><Input value={invNo} onChange={e => setInvNo(e.target.value)} /></Field>
          <Field label="开票日期" required><Input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} /></Field>
        </div>
        <div className="mt-4 text-sm font-medium">开票明细（按入库单明细核对）</div>
        {supLines.length === 0 ? <div className="text-sm text-slate-400 text-center py-6 border border-dashed rounded-md">该供应商暂无已入库明细</div> : (
          <Table>
            <THead><tr><Th>入库单</Th><Th>物料</Th><Th>入库数</Th><Th>订单单价</Th><Th>开票数量</Th><Th>开票单价(未税)</Th><Th>税率</Th></tr></THead>
            <TBody>
              {supLines.map(({ pw, pl, pol }) => {
                const sel = selLines[pl.id] || { qty: pl.qty, unitPrice: pol?.unitPrice || 0, taxRate: pol?.taxRate || 0.13 }
                return (
                  <tr key={pl.id}>
                    <Td className="text-xs">{pw.code}</Td><Td>{pl.materialName}</Td><Td>{pl.qty}</Td><Td>{money(pol?.unitPrice || 0)}</Td>
                    <Td><Input type="number" className="w-24" value={sel.qty} onChange={e => setSelLines(m => ({ ...m, [pl.id]: { ...sel, qty: Number(e.target.value) } }))} /></Td>
                    <Td><Input type="number" className="w-28" value={sel.unitPrice} onChange={e => setSelLines(m => ({ ...m, [pl.id]: { ...sel, unitPrice: Number(e.target.value) } }))} /></Td>
                    <Td>
                      <select className="h-9 rounded-md border border-slate-300 px-2 text-sm w-20" value={sel.taxRate} onChange={e => setSelLines(m => ({ ...m, [pl.id]: { ...sel, taxRate: Number(e.target.value) } }))}>
                        {meta?.taxRates.map(t => <option key={t.id} value={t.rate}>{(t.rate*100).toFixed(0)}%</option>)}
                      </select>
                    </Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={submit}>登记并匹配</Button></div>
      </Modal>

      <Modal open={!!resolveOpen} onClose={() => setResolveOpen(null)} title="三单匹配差异处理">
        <div className="text-sm text-slate-600 mb-3">发票 {resolveOpen?.invoiceNo} 存在差异，请财务主管填写差异处理说明后确认放行。</div>
        <Field label="差异处理说明" required><Textarea rows={4} value={resolveNote} onChange={e => setResolveNote(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setResolveOpen(null)}>取消</Button><Button onClick={resolve}>确认放行</Button></div>
      </Modal>

      <Modal open={reconOpen} onClose={() => setReconOpen(false)} title="生成对账单">
        <div className="grid grid-cols-2 gap-3">
          <Field label="供应商" required>
            <Select value={reconSup} onChange={e => setReconSup(e.target.value)}>
              <option value="">请选择</option>
              {meta?.suppliers.filter(s => s.status === 'qualified').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="对账月份" required><Input type="month" value={reconPeriod} onChange={e => setReconPeriod(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setReconOpen(false)}>取消</Button><Button onClick={doRecon}>生成</Button></div>
      </Modal>
    </div>
  )
}
