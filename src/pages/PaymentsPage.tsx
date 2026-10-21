import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { PaymentRequest } from '@/types'
import { PayStatusLabels } from '@/types'
import { money, date } from '@/lib/utils'
import { Plus, Check, X } from 'lucide-react'

export function PaymentsPage() {
  const { user, meta } = useAuth()
  const [list, setList] = useState<PaymentRequest[]>([])
  const [recons, setRecons] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [actOpen, setActOpen] = useState<{ p: PaymentRequest; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')

  const canCreate = !!user && ['finance','finance_mgr','admin'].includes(user.role)

  const load = async () => {
    setList(await api.listPayments())
    try { setRecons(await api.listReconciliations()) } catch { setRecons([]) }
  }
  useEffect(() => { load() }, [])

  const [selSup, setSelSup] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('银行转账')
  const [account, setAccount] = useState('')
  const [bank, setBank] = useState('')
  const [remark, setRemark] = useState('')
  const submit = async () => {
    if (!selSup || !amount) return alert('供应商与金额必填')
    const sup = meta?.suppliers.find(s => s.id === selSup)
    try {
      await api.createPayment({ supplierId: selSup, amount: Number(amount), paymentMethod: method, payeeAccount: account || sup?.bankAccount, payeeBank: bank || sup?.bankName, remark })
      setOpen(false); setAmount(''); setRemark(''); await load()
    } catch (e: any) { alert(e.message) }
  }

  const act = async () => {
    if (!actOpen) return
    if (actOpen.action === 'reject' && !comment) return alert('驳回必填意见')
    await api.approvePayment(actOpen.p.id, actOpen.action, comment)
    setActOpen(null); setComment(''); await load()
  }
  const markPaid = async (id: string) => {
    if (!confirm('确认已完成线下付款并登记？')) return
    await api.markPaymentPaid(id); await load()
  }

  return (
    <div>
      <PageHeader title="付款申请" subtitle="对账单付款申请、付款审批、付款登记" actions={
        canCreate ? <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" />发起付款申请</Button> : null
      }/>

      <Card className="mb-4"><CardBody className="p-0">
        <div className="px-4 py-2 text-sm font-medium border-b border-slate-100">付款申请单</div>
        {list.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>单号</Th><Th>供应商</Th><Th>金额</Th><Th>方式</Th><Th>当前节点</Th><Th>状态</Th><Th>申请时间</Th><Th>操作</Th></tr></THead>
            <TBody>
              {list.map(p => {
                const node = p.approvalNodes.find(n => n.order === p.currentNodeOrder)
                const canApprove = p.status === 'pending' && node && node.approverRole === user?.role
                const canPay = p.status === 'approved' && canCreate
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{p.code}</Td><Td>{p.supplierName}</Td>
                    <Td className="text-indigo-700 font-medium">{money(p.amount)}</Td>
                    <Td>{p.paymentMethod}</Td>
                    <Td>{node ? <Badge tone="indigo">{node.name}</Badge> : '-'}</Td>
                    <Td><Badge tone={statusTone(p.status)}>{PayStatusLabels[p.status]}</Badge></Td>
                    <Td className="text-xs text-slate-500">{date(p.createdAt)}</Td>
                    <Td>
                      {canApprove && <>
                        <Button size="sm" variant="danger" onClick={() => setActOpen({ p, action: 'reject' })}><X className="w-3 h-3" />驳回</Button>
                        <Button size="sm" className="ml-1" onClick={() => setActOpen({ p, action: 'approve' })}><Check className="w-3 h-3" />同意</Button>
                      </>}
                      {canPay && <Button size="sm" variant="secondary" onClick={() => markPaid(p.id)}>登记付款</Button>}
                    </Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Card><CardBody className="p-0">
        <div className="px-4 py-2 text-sm font-medium border-b border-slate-100">对账单</div>
        {recons.length === 0 ? <Empty text="暂无对账单，请到「发票/对账」生成" /> : (
          <Table>
            <THead><tr><Th>对账单号</Th><Th>供应商</Th><Th>期间</Th><Th>订单金额</Th><Th>入库金额</Th><Th>已开票</Th><Th>已付款</Th><Th>应付余额</Th><Th>状态</Th></tr></THead>
            <TBody>
              {recons.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{r.code}</Td><Td>{r.supplierName}</Td><Td>{r.period}</Td>
                  <Td>{money(r.orderAmount)}</Td><Td>{money(r.putawayAmount)}</Td><Td>{money(r.invoicedAmount)}</Td><Td>{money(r.paidAmount)}</Td>
                  <Td className="text-rose-600 font-medium">{money(r.payableAmount)}</Td>
                  <Td><Badge tone={r.status === 'confirmed' ? 'green' : 'amber'}>{r.status === 'confirmed' ? '已确认' : '草稿'}</Badge></Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Modal open={open} onClose={() => setOpen(false)} title="发起付款申请" width="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <Field label="供应商" required>
            <Select value={selSup} onChange={e => { setSelSup(e.target.value); const s = meta?.suppliers.find(x => x.id === e.target.value); setAccount(s?.bankAccount || ''); setBank(s?.bankName || '') }}>
              <option value="">请选择</option>
              {meta?.suppliers.filter(s => s.status === 'qualified').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="付款金额" required><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="付款方式"><Select value={method} onChange={e => setMethod(e.target.value)}><option>银行转账</option><option>承兑汇票</option><option>现金</option></Select></Field>
          <Field label="收款账户"><Input value={account} onChange={e => setAccount(e.target.value)} /></Field>
          <Field label="开户行"><Input value={bank} onChange={e => setBank(e.target.value)} /></Field>
          <Field label="备注" className="col-span-2"><Textarea rows={2} value={remark} onChange={e => setRemark(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button>提交付款审批</Button></div>
        <div className="mt-2 flex justify-end"><div onClick={submit}></div></div>
        <div className="mt-0 flex justify-end"></div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={submit}>提交</Button></div>
      </Modal>

      <Modal open={!!actOpen} onClose={() => setActOpen(null)} title={actOpen?.action === 'approve' ? '同意付款' : '驳回付款'}>
        <Field label="审批意见"><Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setActOpen(null)}>取消</Button>
          {actOpen?.action === 'reject' ? <Button variant="danger" onClick={act}>确认驳回</Button> : <Button onClick={act}>确认同意</Button>}
        </div>
      </Modal>
    </div>
  )
}
