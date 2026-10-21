import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import type { PutawayRecord, Arrival } from '@/types'
import { date } from '@/lib/utils'
import { PackagePlus } from 'lucide-react'

export function PutawaysPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState<PutawayRecord[]>([])
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [open, setOpen] = useState(false)
  const [selArr, setSelArr] = useState('')
  const [warehouse, setWarehouse] = useState('主仓库')
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const canPutaway = !!user && ['warehouse','admin'].includes(user.role)

  const load = async () => {
    setRecords(await api.listPutaways())
    const all = await api.listArrivals()
    setArrivals(all.filter(a => a.status === 'pending_putaway'))
  }
  useEffect(() => { load() }, [])

  const openDlg = (aid?: string) => {
    const id = aid || arrivals[0]?.id || ''; setSelArr(id)
    const a = arrivals.find(x => x.id === id)
    const map: Record<string, number> = {}
    a?.lines.forEach(l => { map[l.id] = l.acceptedQty })
    setQtyMap(map); setWarehouse('主仓库'); setOpen(true)
  }
  const submit = async () => {
    const a = arrivals.find(x => x.id === selArr); if (!a) return
    const lines = a.lines.map(l => ({ arrivalLineId: l.id, qty: qtyMap[l.id] ?? l.acceptedQty, warehouse }))
    try { await api.createPutaway({ arrivalId: selArr, lines, remark: '入库确认' }); setOpen(false); await load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <PageHeader title="入库管理" subtitle="验收合格后登记入库，完成订单闭环（含外部仓储系统预留 API）" actions={
        canPutaway && arrivals.length > 0 ? <Button onClick={() => openDlg()}><PackagePlus className="w-4 h-4" />确认入库</Button> : null
      }/>
      <Card className="mb-4"><CardBody>
        <div className="text-sm text-slate-600">待入库到货单：<span className="font-semibold text-amber-600">{arrivals.length}</span> 张</div>
        {arrivals.length === 0 ? <Empty text="暂无待入库单据" /> : (
          <div className="mt-3 flex flex-wrap gap-2">
            {arrivals.map(a => (
              <button key={a.id} onClick={() => openDlg(a.id)} className="px-3 py-2 border border-amber-200 bg-amber-50 rounded-md text-sm hover:bg-amber-100">
                {a.code} <span className="text-xs text-slate-500">({date(a.arrivalDate)})</span>
              </button>
            ))}
          </div>
        )}
      </CardBody></Card>
      <Card><CardBody className="p-0">
        <div className="px-4 py-2 text-sm font-medium border-b border-slate-100">已入库记录</div>
        {records.length === 0 ? <Empty text="暂无入库记录" /> : (
          <Table>
            <THead><tr><Th>入库单号</Th><Th>到货单</Th><Th>订单</Th><Th>仓库</Th><Th>入库时间</Th><Th>明细数</Th><Th>状态</Th></tr></THead>
            <TBody>
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{r.code}</Td>
                  <Td className="text-xs">{r.arrivalId.slice(0,8)}</Td>
                  <Td className="text-xs">{r.orderId.slice(0,8)}</Td>
                  <Td>{r.lines[0]?.warehouse}</Td>
                  <Td>{date(r.putawayAt)}</Td>
                  <Td>{r.lines.length}</Td>
                  <Td><Badge tone={statusTone('putaway')}>已入库</Badge></Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Modal open={open} onClose={() => setOpen(false)} title="确认入库" width="max-w-2xl">
        <Field label="仓库"><Input value={warehouse} onChange={e => setWarehouse(e.target.value)} /></Field>
        <div className="mt-3 text-sm font-medium">入库明细</div>
        <Table>
          <THead><tr><Th>物料</Th><Th>合格数量</Th><Th>入库数量</Th></tr></THead>
          <TBody>
            {(arrivals.find(a => a.id === selArr)?.lines || []).map(l => (
              <tr key={l.id}>
                <Td>{l.materialName}</Td><Td>{l.acceptedQty}</Td>
                <Td><Input type="number" className="w-24" value={qtyMap[l.id] ?? l.acceptedQty} onChange={e => setQtyMap(m => ({ ...m, [l.id]: Number(e.target.value) }))} /></Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={submit}>确认入库</Button></div>
      </Modal>
    </div>
  )
}
