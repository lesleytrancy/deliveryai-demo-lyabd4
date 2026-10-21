import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Textarea, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import type { PurchaseRequest } from '@/types'
import { PRStatusLabels, RoleLabels } from '@/types'
import { money, date } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, XCircle, Send, Undo2, ShoppingCart } from 'lucide-react'

export function PurchaseRequestDetailPage() {
  const { id } = useParams(); const nav = useNavigate(); const { user, meta } = useAuth()
  const [pr, setPR] = useState<PurchaseRequest | null>(null)
  const [comment, setComment] = useState('')
  const [confirmOpen, setConfirmOpen] = useState<'' | 'approve' | 'reject' | 'withdraw' | 'createPO' | 'transfer'>('')
  const [transferTo, setTransferTo] = useState('')

  const load = async () => { if (id) setPR(await api.getPR(id)) }
  useEffect(() => { load() }, [id])

  if (!pr || !meta || !user) return <div className="text-slate-500">加载中…</div>

  const currentNode = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
  const canApprove = pr.status === 'pending' && currentNode &&
    (currentNode.approverRole === user.role || meta.users.filter(u=>u.role===currentNode.approverRole).some(u=>u.id===user.id)) &&
    meta.users.filter(u => u.role === currentNode.approverRole || (currentNode.approverRole === 'dept_manager' && meta.departments.find(d=>d.id===pr.departmentId)?.managerUserId === u.id)).some(u => u.id === user.id)
  const canWithdraw = pr.status === 'pending' && pr.applicantId === user.id && currentNode?.status === 'pending'
  const canCreatePO = pr.status === 'approved' && ['purchaser','purchase_mgr','admin'].includes(user.role)
  const canEdit = (pr.status === 'draft' || pr.status === 'rejected' || pr.status === 'withdrawn') && pr.applicantId === user.id

  const doApprove = async (action: 'approve' | 'reject' | 'transfer') => {
    if (!id) return
    if (action === 'reject' && !comment) return alert('驳回必须填写意见')
    await api.approvePR(id, action, comment, action === 'transfer' ? transferTo : undefined)
    setConfirmOpen(''); setComment(''); await load()
  }
  const doWithdraw = async () => { if (!id) return; await api.withdrawPR(id); setConfirmOpen(''); await load() }
  const doCreatePO = async () => {
    if (!id) return
    const po = await api.createPOFromPR(id) as { id: string }
    nav(`/orders/${po.id}`)
  }

  return (
    <div>
      <PageHeader
        title={
          <button onClick={() => nav(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" />{pr.code}
          </button> as any
        }
        subtitle={pr.title}
        actions={
          <>
            <Badge tone={statusTone(pr.status)}>{PRStatusLabels[pr.status]}</Badge>
            {canEdit && <Link to={`/requests/${pr.id}/edit`}><Button variant="outline">编辑</Button></Link>}
            {canWithdraw && <Button variant="outline" onClick={() => setConfirmOpen('withdraw')}><Undo2 className="w-4 h-4" />撤回</Button>}
            {canApprove && <>
              <Button variant="danger" onClick={() => setConfirmOpen('reject')}><XCircle className="w-4 h-4" />驳回</Button>
              <Button variant="secondary" onClick={() => setConfirmOpen('transfer')}><Send className="w-4 h-4" />转交</Button>
              <Button onClick={() => setConfirmOpen('approve')}><CheckCircle2 className="w-4 h-4" />同意</Button>
            </>}
            {canCreatePO && <Button onClick={() => setConfirmOpen('createPO')}><ShoppingCart className="w-4 h-4" />生成采购订单</Button>}
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-slate-500">申请人</div><div className="font-medium mt-0.5">{pr.applicantName}</div></div>
              <div><div className="text-xs text-slate-500">申请部门</div><div className="font-medium mt-0.5">{pr.deptName}</div></div>
              <div><div className="text-xs text-slate-500">申请日期</div><div className="font-medium mt-0.5">{date(pr.createdAt)}</div></div>
              <div><div className="text-xs text-slate-500">期望到货</div><div className="font-medium mt-0.5">{date(pr.expectedArrivalDate)}</div></div>
              <div><div className="text-xs text-slate-500">币种</div><div className="font-medium mt-0.5">{pr.currencyCode}</div></div>
              <div><div className="text-xs text-slate-500">预算金额</div><div className="font-medium mt-0.5">{money(pr.budgetAmount)}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-500">合计金额（含税）</div><div className="text-xl font-semibold text-indigo-700 mt-0.5">{money(pr.totalAmount)}</div></div>
              <div className="col-span-4"><div className="text-xs text-slate-500">事由</div><div className="mt-1 whitespace-pre-wrap">{pr.reason}</div></div>
              {pr.rejectReason && <div className="col-span-4"><div className="text-xs text-rose-500">驳回原因</div><div className="mt-1 text-rose-700 whitespace-pre-wrap">{pr.rejectReason}</div></div>}
            </div>
          </CardBody></Card>

          <Card>
            <CardBody>
              <h3 className="text-base font-semibold mb-3">申请明细</h3>
              <Table>
                <THead><tr><Th>#</Th><Th>物料</Th><Th>规格</Th><Th>单位</Th><Th>数量</Th><Th>单价(未税)</Th><Th>税率</Th><Th>行金额(含税)</Th><Th>备注</Th></tr></THead>
                <TBody>
                  {pr.lines.map((l, i) => (
                    <tr key={l.id}><Td>{i+1}</Td><Td>{l.materialName}</Td><Td>{l.spec}</Td><Td>{l.unit}</Td><Td>{l.quantity}</Td><Td>{money(l.estimatedUnitPrice)}</Td><Td>{(l.taxRate*100).toFixed(0)}%</Td><Td className="text-indigo-700 font-medium">{money(l.lineAmount)}</Td><Td className="text-xs text-slate-500">{l.remark}</Td></tr>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card><CardBody>
            <h3 className="text-base font-semibold mb-3">审批流程</h3>
            <ol className="space-y-3">
              {pr.approvalNodes.length === 0 && <div className="text-sm text-slate-400">未提交，暂无审批流程</div>}
              {pr.approvalNodes.map((n, i) => {
                const isCurrent = n.order === pr.currentNodeOrder
                const actor = n.actorId ? meta.users.find(u => u.id === n.actorId)?.name : null
                return (
                  <li key={n.id} className="flex gap-3">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      n.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : n.status === 'rejected' ? 'bg-rose-100 text-rose-700' : isCurrent ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-slate-100 text-slate-500'
                    }`}>{i+1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{n.name}</span>
                        <Badge tone={n.status === 'approved' ? 'green' : n.status === 'rejected' ? 'red' : isCurrent ? 'blue' : 'slate'}>
                          {n.status === 'approved' ? '已同意' : n.status === 'rejected' ? '已驳回' : isCurrent ? '待审批' : '待发起'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">角色：{RoleLabels[n.approverRole]}{actor && ` · ${actor}`}</div>
                      {n.comment && <div className="mt-1 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">意见：{n.comment}</div>}
                      {n.actedAt && <div className="text-[11px] text-slate-400 mt-0.5">{date(n.actedAt)}</div>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardBody></Card>
        </div>
      </div>

      <Modal open={!!confirmOpen} onClose={() => setConfirmOpen('')} title={
        confirmOpen === 'approve' ? '审批同意' : confirmOpen === 'reject' ? '审批驳回' : confirmOpen === 'withdraw' ? '撤回申请' : confirmOpen === 'createPO' ? '生成采购订单' : '转交审批'
      }>
        {confirmOpen === 'approve' && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">确认同意本采购申请？可填写审批意见。</div>
            <Field label="审批意见"><Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen('')}>取消</Button><Button onClick={() => doApprove('approve')}>确认同意</Button></div>
          </div>
        )}
        {confirmOpen === 'reject' && (
          <div className="space-y-3">
            <div className="text-sm text-rose-600">驳回将退回申请人，需填写驳回原因。</div>
            <Field label="驳回意见" required><Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="请说明驳回原因" /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen('')}>取消</Button><Button variant="danger" onClick={() => doApprove('reject')}>确认驳回</Button></div>
          </div>
        )}
        {confirmOpen === 'transfer' && (
          <div className="space-y-3">
            <Field label="转交对象" required>
              <select className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                <option value="">请选择</option>
                {currentNode && meta.users.filter(u => u.role === currentNode.approverRole && u.id !== user.id).map(u => <option key={u.id} value={u.id}>{u.name}（{RoleLabels[u.role]}）</option>)}
              </select>
            </Field>
            <Field label="备注"><Textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen('')}>取消</Button><Button onClick={() => doApprove('transfer')}>确认转交</Button></div>
          </div>
        )}
        {confirmOpen === 'withdraw' && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">撤回后申请单将回到草稿状态，可修改后重新提交。当前节点未被审批人处理。</div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen('')}>取消</Button><Button variant="danger" onClick={doWithdraw}>确认撤回</Button></div>
          </div>
        )}
        {confirmOpen === 'createPO' && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">将根据本申请单生成采购订单草稿，生成后您可补充供应商、价格并下达。</div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen('')}>取消</Button><Button onClick={doCreatePO}>生成订单</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
