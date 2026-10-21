import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Select } from '@/components/ui/Input'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import { date } from '@/lib/utils'

export function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [type, setType] = useState('')
  useEffect(() => { api.listAuditLogs(type ? { targetType: type } : {}).then(setLogs) }, [type])
  return (
    <div>
      <PageHeader title="审计日志" subtitle="关键操作留痕，支持按对象类型检索" actions={
        <Select value={type} onChange={e => setType(e.target.value)} className="w-40">
          <option value="">全部类型</option>
          <option value="purchase_request">采购申请</option><option value="purchase_order">采购订单</option>
          <option value="arrival">到货</option><option value="putaway">入库</option><option value="invoice">发票</option>
          <option value="reconciliation">对账</option><option value="payment_request">付款</option>
          <option value="supplier">供应商</option><option value="material">物料</option><option value="contract">合同</option>
          <option value="config">配置</option><option value="system">系统</option>
        </Select>
      }/>
      <Card><CardBody className="p-0">
        {logs.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>时间</Th><Th>操作人</Th><Th>动作</Th><Th>对象类型</Th><Th>对象ID</Th></tr></THead>
            <TBody>
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td className="text-xs text-slate-500 whitespace-nowrap">{date(l.at)}</Td>
                  <Td>{l.userName}</Td><Td>{l.action}</Td><Td className="text-xs">{l.targetType}</Td>
                  <Td className="font-mono text-xs text-slate-500">{l.target}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody></Card>
    </div>
  )
}
