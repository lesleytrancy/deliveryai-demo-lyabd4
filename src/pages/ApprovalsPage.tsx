import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import type { PurchaseRequest, PaymentRequest } from '@/types'
import { PRStatusLabels, PayStatusLabels } from '@/types'
import { money, date } from '@/lib/utils'

export function ApprovalsPage() {
  const [prs, setPrs] = useState<PurchaseRequest[]>([])
  const [pays, setPays] = useState<PaymentRequest[]>([])
  useEffect(() => {
    api.listPRs({ scope: 'todo' }).then(setPrs).catch(() => {})
    api.listPayments({ scope: 'todo' }).then(setPays).catch(() => {})
  }, [])
  return (
    <div>
      <PageHeader title="待我审批" subtitle="采购申请与付款申请待审批事项" />
      <Card className="mb-4"><CardBody className="p-0">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b border-slate-100">采购申请待审批（{prs.length}）</div>
        {prs.length === 0 ? <Empty text="暂无待审批采购申请" /> : (
          <Table>
            <THead><tr><Th>单号</Th><Th>标题</Th><Th>申请人</Th><Th>金额</Th><Th>当前节点</Th><Th>提交时间</Th><Th>状态</Th><Th></Th></tr></THead>
            <TBody>
              {prs.map(pr => {
                const node = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
                return (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{pr.code}</Td><Td>{pr.title}</Td><Td>{pr.applicantName}</Td>
                    <Td className="text-indigo-700 font-medium">{money(pr.totalAmount)}</Td>
                    <Td><Badge tone="indigo">{node?.name}</Badge></Td>
                    <Td>{date(pr.submittedAt)}</Td>
                    <Td><Badge tone={statusTone(pr.status)}>{PRStatusLabels[pr.status]}</Badge></Td>
                    <Td><Link to={`/requests/${pr.id}`} className="text-indigo-600 text-sm hover:underline">去审批</Link></Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>
      <Card><CardBody className="p-0">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b border-slate-100">付款申请待审批（{pays.length}）</div>
        {pays.length === 0 ? <Empty text="暂无待审批付款申请" /> : (
          <Table>
            <THead><tr><Th>付款单号</Th><Th>供应商</Th><Th>金额</Th><Th>当前节点</Th><Th>提交时间</Th><Th>状态</Th><Th></Th></tr></THead>
            <TBody>
              {pays.map(p => {
                const node = p.approvalNodes.find(n => n.order === p.currentNodeOrder)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{p.code}</Td><Td>{p.supplierName}</Td>
                    <Td className="text-indigo-700 font-medium">{money(p.amount)}</Td>
                    <Td><Badge tone="indigo">{node?.name}</Badge></Td><Td>{date(p.createdAt)}</Td>
                    <Td><Badge tone={statusTone(p.status)}>{PayStatusLabels[p.status]}</Badge></Td>
                    <Td><Link to={`/payments/${p.id}`} className="text-indigo-600 text-sm hover:underline">去审批</Link></Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>
    </div>
  )
}
