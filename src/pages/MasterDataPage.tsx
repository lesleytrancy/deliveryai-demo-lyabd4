import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TBody, Th, Td } from '@/components/ui/Table'
import { Input, Select, Field } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { money } from '@/lib/utils'
import { Plus } from 'lucide-react'

export function MasterDataPage() {
  const { meta, reloadMeta } = useAuth()
  const [matOpen, setMatOpen] = useState(false)
  const [matForm, setMatForm] = useState<any>({ name: '', code: '', spec: '', unit: '个', categoryId: '', defaultTaxRate: 0.13 })
  const [rules, setRules] = useState<any[]>([])

  useEffect(() => { if (meta) setRules(meta.approvalRules.map(r => ({ ...r }))) }, [meta])

  const addMaterial = async () => {
    if (!matForm.name || !matForm.categoryId) return alert('请填写名称和品类')
    await api.createMaterial(matForm); await reloadMeta(); setMatOpen(false)
  }
  const toggleMat = async (id: string) => { await api.toggleMaterial(id); await reloadMeta() }
  const saveRules = async () => {
    // 排序并规范化金额
    const sorted = [...rules].sort((a, b) => a.minAmount - b.minAmount)
    sorted.forEach((r, i) => { r.maxAmount = i === sorted.length - 1 ? 999999999 : sorted[i+1].minAmount })
    if (sorted[0].minAmount !== 0) return alert('最低金额区间必须从 0 开始')
    await api.updateApprovalRules(sorted); await reloadMeta(); alert('审批规则已保存')
  }
  const addRule = () => setRules(rs => [...rs, { minAmount: 0, maxAmount: 10000, chain: [{ name: '部门负责人', approverRole: 'dept_manager' }] }])
  const updateRule = (i: number, patch: any) => setRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRule = (i: number) => setRules(rs => rs.filter((_, idx) => idx !== i))
  const addNode = (i: number) => setRules(rs => rs.map((r, idx) => idx === i ? { ...r, chain: [...r.chain, { name: '新节点', approverRole: 'dept_manager' }] } : r))
  const updateNode = (i: number, j: number, patch: any) => setRules(rs => rs.map((r, idx) => idx === i ? { ...r, chain: r.chain.map((n: any, k: number) => k === j ? { ...n, ...patch } : n) } : r))
  const removeNode = (i: number, j: number) => setRules(rs => rs.map((r, idx) => idx === i ? { ...r, chain: r.chain.filter((_: any, k: number) => k !== j) } : r))

  if (!meta) return null

  return (
    <div>
      <PageHeader title="基础数据" subtitle="物料、字典、审批规则等配置" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>物料目录</CardTitle>
            <Button size="sm" onClick={() => setMatOpen(true)}><Plus className="w-4 h-4" />新增物料</Button>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <THead><tr><Th>编码</Th><Th>名称</Th><Th>规格</Th><Th>单位</Th><Th>品类</Th><Th>税率</Th><Th>状态</Th><Th></Th></tr></THead>
              <TBody>
                {meta.materials.map(m => {
                  const cat = meta.materialCategories.find(c => c.id === m.categoryId)
                  return (
                    <tr key={m.id}>
                      <Td className="font-mono text-xs">{m.code}</Td><Td>{m.name}</Td><Td>{m.spec}</Td><Td>{m.unit}</Td>
                      <Td>{cat?.name}</Td><Td>{(m.defaultTaxRate*100).toFixed(0)}%</Td>
                      <Td>{m.active ? <Badge tone="green">启用</Badge> : <Badge tone="slate">停用</Badge>}</Td>
                      <Td><Button size="sm" variant="ghost" onClick={() => toggleMat(m.id)}>{m.active ? '停用' : '启用'}</Button></Td>
                    </tr>
                  )
                })}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>审批规则（按金额分级）</CardTitle>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={addRule}>新增区间</Button><Button size="sm" onClick={saveRules}>保存规则</Button></div>
          </CardHeader>
          <CardBody className="space-y-3">
            {rules.map((r, i) => (
              <div key={i} className="border border-slate-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">金额区间：¥</span>
                  <Input type="number" className="w-24" value={r.minAmount} onChange={e => updateRule(i, { minAmount: Number(e.target.value) })} />
                  <span className="text-slate-400">—</span>
                  <span className="text-sm">¥{i === rules.length - 1 ? '∞' : r.maxAmount}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeRule(i)}>删除</Button>
                </div>
                <div className="space-y-1">
                  {r.chain.map((n: any, j: number) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-16">节点{j+1}</span>
                      <Input className="flex-1" value={n.name} onChange={e => updateNode(i, j, { name: e.target.value })} placeholder="节点名称" />
                      <Select className="w-36" value={n.approverRole} onChange={e => updateNode(i, j, { approverRole: e.target.value })}>
                        <option value="dept_manager">部门负责人</option><option value="purchase_mgr">采购经理</option>
                        <option value="finance">财务</option><option value="finance_mgr">财务主管</option><option value="leader">分管领导</option>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => removeNode(i, j)}>×</Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addNode(i)}>+ 添加节点</Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>部门/成本中心/字典</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">部门</div>
                <ul>{meta.departments.map(d => <li key={d.id}>· {d.name}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">成本中心</div>
                <ul>{meta.costCenters.map(c => <li key={c.id}>· {c.name} ({c.code})</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">税率</div>
                <ul>{meta.taxRates.map(t => <li key={t.id}>· {t.name}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">付款条件</div>
                <ul>{meta.paymentTerms.map(t => <li key={t.id}>· {t.name}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">币种</div>
                <ul>{meta.currencies.map(c => <li key={c.id}>· {c.code} {c.name}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">用户账号</div>
                <ul className="text-xs">{meta.users.map(u => <li key={u.id}>· {u.name} ({u.username})</li>)}</ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal open={matOpen} onClose={() => setMatOpen(false)} title="新增物料">
        <div className="grid grid-cols-2 gap-3">
          <Field label="物料名称" required><Input value={matForm.name} onChange={e => setMatForm((f:any) => ({...f, name: e.target.value}))} /></Field>
          <Field label="物料编码"><Input value={matForm.code} onChange={e => setMatForm((f:any) => ({...f, code: e.target.value}))} placeholder="留空自动生成" /></Field>
          <Field label="规格"><Input value={matForm.spec} onChange={e => setMatForm((f:any) => ({...f, spec: e.target.value}))} /></Field>
          <Field label="单位"><Input value={matForm.unit} onChange={e => setMatForm((f:any) => ({...f, unit: e.target.value}))} /></Field>
          <Field label="品类" required>
            <Select value={matForm.categoryId} onChange={e => setMatForm((f:any) => ({...f, categoryId: e.target.value}))}>
              <option value="">请选择</option>
              {meta.materialCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="默认税率">
            <Select value={String(matForm.defaultTaxRate)} onChange={e => setMatForm((f:any) => ({...f, defaultTaxRate: Number(e.target.value)}))}>
              {meta.taxRates.map(t => <option key={t.id} value={t.rate}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setMatOpen(false)}>取消</Button><Button onClick={addMaterial}>保存</Button></div>
      </Modal>
    </div>
  )
}
