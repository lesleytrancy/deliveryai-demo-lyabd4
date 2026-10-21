import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'

import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Select, Input } from '@/components/ui/Input'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import type { PurchaseOrder } from '@/types'
import { POStatusLabels } from '@/types'
import { money, date } from '@/lib/utils'

export function PurchaseOrdersPage() {
  
  const [list, setList] = useState<PurchaseOrder[]>([])
  const [status, setStatus] = useState('')
  const load = async () => { setList(await api.listPOs(status ? { status } : {})) }
  useEffect(() => { load() }, [status])
  return (
    <div>
      <PageHeader title="采购订单" subtitle="采购订单下达、跟踪与关闭" actions={
        <>
          <Select value={status} onChange={e => setStatus(e.target.value)} className="w-32">
            <option value="">全部状态</option>
            {Object.entries(POStatusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </>
      }/>
      <Card><CardBody className="p-0">
        {list.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>订单号</Th><Th>关联申请</Th><Th>供应商</Th><Th>总金额</Th><Th>期望到货</Th><Th>状态</Th><Th>创建时间</Th><Th></Th></tr></THead>
            <TBody>
              {list.map(po => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{po.code}</Td>
                  <Td className="text-xs text-slate-500">{po.requestId?.slice(0,8)}</Td>
                  <Td>{po.supplierName || <span className="text-amber-600 text-xs">待选择供应商</span>}</Td>
                  <Td className="text-indigo-700 font-medium">{money(po.totalAmount)}</Td>
                  <Td>{date(po.expectedArrivalDate)}</Td>
                  <Td><Badge tone={statusTone(po.status)}>{POStatusLabels[po.status]}</Badge></Td>
                  <Td className="text-xs text-slate-500">{date(po.createdAt)}</Td>
                  <Td><Link to={`/orders/${po.id}`} className="text-indigo-600 text-sm hover:underline">查看/处理</Link></Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody></Card>
    </div>
  )
}
