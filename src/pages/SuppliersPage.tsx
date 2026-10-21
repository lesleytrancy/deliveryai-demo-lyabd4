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
import type { Supplier } from '@/types'
import { SupplierStatusLabels } from '@/types'
import { date } from '@/lib/utils'
import { Plus, UserCheck, Ban } from 'lucide-react'

export function SuppliersPage() {
  const { user, meta } = useAuth()
  const [list, setList] = useState<Supplier[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const canEdit = !!user && ['purchaser','purchase_mgr','admin'].includes(user.role)
  const canAdmit = !!user && ['purchase_mgr','admin'].includes(user.role)
  const load = async () => setList(await api.listSuppliers())
  useEffect(() => { load() }, [])

  const empty: Partial<Supplier> = { name: '', shortName: '', uscc: '', contactName: '', contactPhone: '', contactEmail: '', address: '', bankName: '', bankAccount: '', categoryIds: [], status: 'pending_admit', rating: 'B' }
  const [form, setForm] = useState<Partial<Supplier>>(empty)
  const openCreate = () => { setEditing(null); setForm({ ...empty, categoryIds: [] }); setOpen(true) }
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ ...s }); setOpen(true) }
  const submit = async () => {
    if (!form.name) return alert('请填写供应商名称')
    try {
      if (editing) await api.updateSupplier(editing.id, form)
      else await api.createSupplier(form)
      setOpen(false); await load()
    } catch (e: any) { alert(e.message) }
  }

  const admit = async (s: Supplier, approved: boolean) => {
    const reason = approved ? undefined : prompt('请输入驳回原因') || ''
    await api.admitSupplier(s.id, approved, reason); await load()
  }
  const toggleBlacklist = async (s: Supplier) => {
    await api.blacklistSupplier(s.id, s.status !== 'blacklist'); await load()
  }

  return (
    <div>
      <PageHeader title="供应商管理" subtitle="供应商准入、资质、评级、黑名单" actions={
        canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" />新增供应商</Button> : null
      }/>
      <Card><CardBody className="p-0">
        {list.length === 0 ? <Empty /> : (
          <Table>
            <THead><tr><Th>编码</Th><Th>名称</Th><Th>联系人/电话</Th><Th>供应品类</Th><Th>评级</Th><Th>资质到期</Th><Th>状态</Th><Th>更新时间</Th><Th>操作</Th></tr></THead>
            <TBody>
              {list.map(s => {
                const cats = (s.categoryIds || []).map(id => meta?.materialCategories.find(c => c.id === id)?.name).filter(Boolean).join('、')
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{s.code}</Td><Td className="font-medium">{s.name}</Td>
                    <Td className="text-xs">{s.contactName} / {s.contactPhone}</Td>
                    <Td className="text-xs">{cats}</Td>
                    <Td>{s.rating || '-'}</Td>
                    <Td className="text-xs">{date(s.qualificationExpireAt) || '-'}</Td>
                    <Td><Badge tone={statusTone(s.status)}>{SupplierStatusLabels[s.status]}</Badge></Td>
                    <Td className="text-xs text-slate-500">{date(s.updatedAt)}</Td>
                    <Td>
                      <div className="flex gap-1">
                        {canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>编辑</Button>}
                        {s.status === 'pending_admit' && canAdmit && <>
                          <Button size="sm" onClick={() => admit(s, true)}><UserCheck className="w-3 h-3" />准入</Button>
                          <Button size="sm" variant="danger" onClick={() => admit(s, false)}>驳回</Button>
                        </>}
                        {canAdmit && ['qualified','blacklist'].includes(s.status) && (
                          <Button size="sm" variant={s.status === 'blacklist' ? 'secondary' : 'danger'} onClick={() => toggleBlacklist(s)}>
                            <Ban className="w-3 h-3" />{s.status === 'blacklist' ? '移出黑名单' : '加入黑名单'}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardBody></Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? '编辑供应商' : '新增供应商'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          <Field label="供应商名称" required><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="简称"><Input value={form.shortName || ''} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} /></Field>
          <Field label="统一社会信用代码"><Input value={form.uscc || ''} onChange={e => setForm(f => ({ ...f, uscc: e.target.value }))} /></Field>
          <Field label="联系人"><Input value={form.contactName || ''} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} /></Field>
          <Field label="联系电话"><Input value={form.contactPhone || ''} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} /></Field>
          <Field label="联系邮箱"><Input value={form.contactEmail || ''} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></Field>
          <Field label="开户行"><Input value={form.bankName || ''} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></Field>
          <Field label="银行账号"><Input value={form.bankAccount || ''} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} /></Field>
          <Field label="地址" className="col-span-2"><Input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="资质有效期"><Input type="date" value={(form.qualificationExpireAt || '').slice(0,10)} onChange={e => setForm(f => ({ ...f, qualificationExpireAt: e.target.value }))} /></Field>
          <Field label="评级">
            <Select value={form.rating || 'B'} onChange={e => setForm(f => ({ ...f, rating: e.target.value as any }))}>
              <option value="A">A（优秀）</option><option value="B">B（合格）</option><option value="C">C（关注）</option><option value="D">D（淘汰）</option>
            </Select>
          </Field>
          <Field label="供应品类" className="col-span-2">
            <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-md min-h-[40px]">
              {meta?.materialCategories.map(c => {
                const checked = (form.categoryIds || []).includes(c.id)
                return (
                  <label key={c.id} className={`px-2 py-1 rounded border text-xs cursor-pointer ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                    <input type="checkbox" className="hidden" checked={checked} onChange={e => {
                      const set = new Set(form.categoryIds || [])
                      if (e.target.checked) set.add(c.id); else set.delete(c.id)
                      setForm(f => ({ ...f, categoryIds: Array.from(set) }))
                    }} />{c.name}
                  </label>
                )
              })}
            </div>
          </Field>
          <Field label="备注" className="col-span-2"><Input value={form.remark || ''} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={submit}>保存</Button></div>
      </Modal>
    </div>
  )
}
