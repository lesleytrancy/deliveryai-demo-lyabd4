import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Select, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Empty } from '@/components/ui/Empty'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { money, date } from '@/lib/utils'
import { Plus } from 'lucide-react'

export function ContractsPage() {
  const { user, meta } = useAuth()
  const [list, setList] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const canEdit = !!user && ['purchaser','purchase_mgr','admin'].includes(user.role)
  const load = async () => setList(await meta ? [] : []) // will set below
  const realLoad = async () => setList(await (await fetch('/api/contracts', { headers: { 'X-Auth-Token': localStorage.getItem('pms_token') || '' } })).json())
  useEffect(() => { realLoad() }, [])

  const [form, setForm] = useState<any>({ name: '', supplierId: '', signedAt: '', effectiveAt: '', expireAt: '', amount: 0, status: 'draft' })
  const submit = async () => {
    if (!form.name || !form.supplierId) return alert('请填写合同名称与供应商')
    await api.createContract(form); setOpen(false); realLoad()
  }
  const activate = async (c: any) => {
    await api.updateContract(c.id, { ...c, status: 'effective' }); realLoad()
  }

  return (
    <div>
      <PageHeader title="合同台账" subtitle="采购合同登记与状态管理" actions={
        canEdit ? <Button onClick={() => { setForm({ name: '', supplierId: '', signedAt: new Date().toISOString().slice(0,10), effectiveAt: new Date().toISOString().slice(0,10), expireAt: '', amount: 0, status: 'draft' }); setOpen(true) }}><Plus className="w-4 h-4" />新增合同</Button> : null
      }/>
      <Card><CardBody className="p-0">
        {list.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>合同编号</Th><Th>名称</Th><Th>供应商</Th><Th>签订日期</Th><Th>有效期</Th><Th>金额</Th><Th>状态</Th><Th></Th></tr></THead>
            <TBody>
              {list.map(c => {
                const sup = meta?.suppliers.find(s => s.id === c.supplierId)
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{c.code}</Td><Td>{c.name}</Td><Td>{sup?.name}</Td><Td>{date(c.signedAt)}</Td><Td>{date(c.effectiveAt)} ~ {date(c.expireAt)}</Td>
                    <Td className="text-indigo-700 font-medium">{money(c.amount)}</Td>
                    <Td><Badge tone={statusTone(c.status)}>{({draft:'草稿',effective:'生效',expired:'到期',terminated:'终止'} as any)[c.status]}</Badge></Td>
                    <Td>{c.status === 'draft' && canEdit && <Button size="sm" onClick={() => activate(c)}>生效</Button>}</Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>
      <Modal open={open} onClose={() => setOpen(false)} title="新增合同">
        <div className="grid grid-cols-2 gap-3">
          <Field label="合同名称" required className="col-span-2"><Input value={form.name} onChange={e => setForm((f: any) => ({...f, name: e.target.value}))} /></Field>
          <Field label="供应商" required>
            <Select value={form.supplierId} onChange={e => setForm((f: any) => ({...f, supplierId: e.target.value}))}>
              <option value="">请选择</option>
              {meta?.suppliers.filter(s => s.status === 'qualified').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="合同金额"><Input type="number" value={form.amount} onChange={e => setForm((f: any) => ({...f, amount: Number(e.target.value)}))} /></Field>
          <Field label="签订日期"><Input type="date" value={form.signedAt} onChange={e => setForm((f: any) => ({...f, signedAt: e.target.value}))} /></Field>
          <Field label="生效日期"><Input type="date" value={form.effectiveAt} onChange={e => setForm((f: any) => ({...f, effectiveAt: e.target.value}))} /></Field>
          <Field label="到期日期" className="col-span-2"><Input type="date" value={form.expireAt} onChange={e => setForm((f: any) => ({...f, expireAt: e.target.value}))} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={submit}>保存</Button></div>
      </Modal>
    </div>
  )
}
