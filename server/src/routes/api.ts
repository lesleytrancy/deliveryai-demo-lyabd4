import { Router, type Request, type Response } from 'express'
import { getDB, save, newId, addAudit, notify } from '../store.js'
import { authRequired, requireRole, maskSensitive, type AuthedRequest } from '../middleware/auth.js'
import { genCode, round2, lineAmount, pickRule, buildApprovalNodes, findApproverCandidates } from '../services/util.js'
import type {
  PurchaseRequest, PurchaseOrder, Arrival, PutawayRecord, Invoice, Reconciliation, PaymentRequest,
  Supplier, Contract, Material, ApprovalNode
} from '../types.js'

const r = Router()

// ---------- 认证 ----------
r.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {}
  const db = getDB()
  const user = db.users.find(u => u.username === username && u.password === password)
  if (!user) return res.status(401).json({ error: '用户名或密码错误' })
  const token = 'tk_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  db.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() }
  save()
  const { password: _p, ...safe } = user
  res.json({ token, user: safe })
})

r.post('/auth/logout', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB()
  const t = req.headers['x-auth-token'] as string | undefined
  if (t) delete db.sessions[t]
  save()
  res.json({ ok: true })
})

r.get('/auth/me', authRequired, (req: AuthedRequest, res: Response) => {
  const { password: _p, ...safe } = req.user!
  res.json(safe)
})

// ---------- 基础数据 ----------
r.get('/meta', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB()
  const user = req.user!
  const mask = (s?: Supplier) => {
    if (!s) return s
    return { ...s, contactPhone: maskSensitive(user, s.contactPhone, 'phone'), bankAccount: maskSensitive(user, s.bankAccount, 'bank') }
  }
  res.json({
    departments: db.departments,
    costCenters: db.costCenters,
    materialCategories: db.materialCategories,
    materials: db.materials.filter(m => m.active),
    currencies: db.currencies,
    taxRates: db.taxRates,
    paymentTerms: db.paymentTerms,
    approvalRules: db.approvalRules,
    users: db.users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, departmentId: u.departmentId })),
    suppliers: db.suppliers.map(mask).filter(s => s && (s.status !== 'pending_admit' || user.role === 'purchase_mgr' || user.role === 'admin' || user.role === 'purchaser')),
    contracts: db.contracts,
  })
})

// 物料管理
r.post('/materials', authRequired, requireRole('admin', 'purchase_mgr'), (req: AuthedRequest, res: Response) => {
  const db = getDB()
  const body = req.body as Partial<Material>
  const m: Material = {
    id: newId('mat_'),
    code: body.code || genCode('MAT', 'MAT'),
    name: body.name!,
    spec: body.spec,
    unit: body.unit!,
    categoryId: body.categoryId!,
    defaultTaxRate: body.defaultTaxRate ?? 0.13,
    active: true,
  }
  db.materials.push(m); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '物料新增', target: m.id, targetType: 'material', after: m }); save()
  res.json(m)
})
r.put('/materials/:id', authRequired, requireRole('admin', 'purchase_mgr'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const m = db.materials.find(x => x.id === req.params.id)
  if (!m) return res.status(404).json({ error: '物料不存在' })
  const before = { ...m }; Object.assign(m, req.body); m.id = before.id
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '物料编辑', target: m.id, targetType: 'material', before, after: m }); save()
  res.json(m)
})
r.post('/materials/:id/toggle', authRequired, requireRole('admin', 'purchase_mgr'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const m = db.materials.find(x => x.id === req.params.id)
  if (!m) return res.status(404).json({ error: '物料不存在' })
  m.active = !m.active; addAudit({ userId: req.user!.id, userName: req.user!.name, action: m.active ? '物料启用' : '物料停用', target: m.id, targetType: 'material' }); save()
  res.json(m)
})

// 审批规则
r.put('/approval-rules', authRequired, requireRole('admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const before = JSON.parse(JSON.stringify(db.approvalRules))
  db.approvalRules = (req.body.rules || []).map((r: any, i: number) => ({ id: r.id || newId('ar_'), ...r, order: i }))
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '审批规则更新', target: 'approval-rules', targetType: 'config', before, after: db.approvalRules }); save()
  res.json(db.approvalRules)
})

// ---------- 供应商 ----------
r.get('/suppliers', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!
  res.json(db.suppliers.map(s => ({ ...s, contactPhone: maskSensitive(user, s.contactPhone, 'phone'), bankAccount: maskSensitive(user, s.bankAccount, 'bank') })))
})
r.post('/suppliers', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB()
  const body = req.body as Partial<Supplier>
  const s: Supplier = {
    id: newId('sup_'),
    code: body.code || genCode('SUP', 'SUP'),
    name: body.name!, shortName: body.shortName, uscc: body.uscc || '',
    contactName: body.contactName || '', contactPhone: body.contactPhone || '', contactEmail: body.contactEmail,
    address: body.address, bankName: body.bankName, bankAccount: body.bankAccount,
    taxpayerType: body.taxpayerType, categoryIds: body.categoryIds || [],
    qualificationExpireAt: body.qualificationExpireAt,
    status: 'pending_admit', rating: body.rating, remark: body.remark,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  db.suppliers.push(s); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '供应商新增', target: s.id, targetType: 'supplier', after: s }); save()
  res.json(s)
})
r.put('/suppliers/:id', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const s = db.suppliers.find(x => x.id === req.params.id)
  if (!s) return res.status(404).json({ error: '供应商不存在' })
  const before = { ...s }; Object.assign(s, req.body, { id: before.id, updatedAt: new Date().toISOString() })
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '供应商编辑', target: s.id, targetType: 'supplier', before, after: s }); save()
  res.json(s)
})
r.post('/suppliers/:id/admit', authRequired, requireRole('purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const s = db.suppliers.find(x => x.id === req.params.id)
  if (!s) return res.status(404).json({ error: '供应商不存在' })
  const { approved, reason } = req.body || {}
  const before = { ...s }; s.status = approved ? 'qualified' : 'rejected'; s.updatedAt = new Date().toISOString()
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: approved ? '供应商准入通过' : '供应商准入驳回', target: s.id, targetType: 'supplier', before, after: { status: s.status, reason } }); save()
  res.json(s)
})
r.post('/suppliers/:id/blacklist', authRequired, requireRole('purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const s = db.suppliers.find(x => x.id === req.params.id)
  if (!s) return res.status(404).json({ error: '供应商不存在' })
  const before = { ...s }; s.status = req.body.blacklist ? 'blacklist' : 'qualified'; s.updatedAt = new Date().toISOString()
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: s.status === 'blacklist' ? '供应商加入黑名单' : '供应商移出黑名单', target: s.id, targetType: 'supplier', before, after: { status: s.status } }); save()
  res.json(s)
})

// ---------- 合同 ----------
r.get('/contracts', authRequired, (_req, res) => res.json(getDB().contracts))
r.post('/contracts', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const body = req.body as Partial<Contract>
  const c: Contract = {
    id: newId('ct_'), code: body.code || genCode('HT', 'CT'), name: body.name!, supplierId: body.supplierId!,
    signedAt: body.signedAt!, effectiveAt: body.effectiveAt!, expireAt: body.expireAt!, amount: round2(body.amount || 0),
    paymentTerms: body.paymentTerms, attachment: body.attachment, status: body.status || 'draft',
  }
  db.contracts.push(c); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '合同新增', target: c.id, targetType: 'contract', after: c }); save(); res.json(c)
})
r.put('/contracts/:id', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const c = db.contracts.find(x => x.id === req.params.id); if (!c) return res.status(404).json({ error: '合同不存在' })
  const before = { ...c }; Object.assign(c, req.body, { id: before.id }); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '合同编辑', target: c.id, targetType: 'contract', before, after: c }); save(); res.json(c)
})

// ---------- 采购申请 ----------
r.get('/purchase-requests', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!
  let list = [...db.purchaseRequests]
  const scope = (req.query.scope as string) || 'all'
  if (scope === 'mine') list = list.filter(x => x.applicantId === user.id)
  if (scope === 'todo') {
    list = list.filter(pr => {
      if (pr.status !== 'pending') return false
      const node = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
      if (!node) return false
      return findApproverCandidates(node, pr.departmentId).includes(user.id)
    })
  }
  const status = req.query.status as string
  if (status) list = list.filter(x => x.status === status)
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

r.get('/purchase-requests/:id', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.purchaseRequests.find(x => x.id === req.params.id); if (!pr) return res.status(404).json({ error: '不存在' })
  res.json(pr)
})

r.post('/purchase-requests', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!
  const body = req.body as Partial<PurchaseRequest>
  const lines = (body.lines || []).map(l => {
    const mat = db.materials.find(m => m.id === l.materialId)
    const qty = Number(l.quantity || 0); const up = Number(l.estimatedUnitPrice || 0); const tr = Number(l.taxRate ?? mat?.defaultTaxRate ?? 0.13)
    return {
      id: newId('prl_'), materialId: l.materialId, materialName: mat?.name, spec: mat?.spec, unit: mat?.unit,
      quantity: qty, estimatedUnitPrice: up, taxRate: tr, lineAmount: lineAmount(qty, up, tr), remark: l.remark,
    }
  })
  const total = round2(lines.reduce((s, x) => s + x.lineAmount, 0))
  const pr: PurchaseRequest = {
    id: newId('pr_'),
    code: genCode('CGSQ', 'PR'),
    title: body.title || '采购申请', applicantId: user.id, applicantName: user.name,
    departmentId: body.departmentId || user.departmentId || 'd1',
    deptName: db.departments.find(d => d.id === (body.departmentId || user.departmentId || 'd1'))?.name,
    costCenterId: body.costCenterId, currencyCode: body.currencyCode || 'CNY',
    budgetAmount: round2(Number(body.budgetAmount || 0)), totalAmount: total, reason: body.reason || '',
    expectedArrivalDate: body.expectedArrivalDate!, attachment: body.attachment,
    status: 'draft', lines, approvalNodes: [], currentNodeOrder: undefined,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  db.purchaseRequests.push(pr); addAudit({ userId: user.id, userName: user.name, action: '采购申请创建', target: pr.id, targetType: 'purchase_request', after: pr }); save(); res.json(pr)
})

r.put('/purchase-requests/:id', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.purchaseRequests.find(x => x.id === req.params.id)
  if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.applicantId !== req.user!.id) return res.status(403).json({ error: '只能修改自己的申请' })
  if (pr.status !== 'draft' && pr.status !== 'rejected') return res.status(400).json({ error: '当前状态不可编辑' })
  const body = req.body as Partial<PurchaseRequest>
  const lines = (body.lines || pr.lines).map((l: any) => {
    const mat = db.materials.find(m => m.id === l.materialId)
    const qty = Number(l.quantity || 0); const up = Number(l.estimatedUnitPrice || 0); const tr = Number(l.taxRate ?? mat?.defaultTaxRate ?? 0.13)
    return { id: l.id || newId('prl_'), materialId: l.materialId, materialName: mat?.name, spec: mat?.spec, unit: mat?.unit, quantity: qty, estimatedUnitPrice: up, taxRate: tr, lineAmount: lineAmount(qty, up, tr), remark: l.remark }
  })
  Object.assign(pr, body, { lines, totalAmount: round2(lines.reduce((s: number, x: any) => s + x.lineAmount, 0)), updatedAt: new Date().toISOString(), status: 'draft' })
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '采购申请编辑', target: pr.id, targetType: 'purchase_request', after: pr }); save(); res.json(pr)
})

r.post('/purchase-requests/:id/submit', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.purchaseRequests.find(x => x.id === req.params.id)
  if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.applicantId !== req.user!.id) return res.status(403).json({ error: '只能提交自己的申请' })
  if (pr.status !== 'draft' && pr.status !== 'rejected' && pr.status !== 'withdrawn') return res.status(400).json({ error: '当前状态不可提交' })
  if (!pr.lines.length || !pr.expectedArrivalDate || !pr.reason) return res.status(400).json({ error: '必填字段缺失' })
  const rule = pickRule(pr.totalAmount)
  if (!rule) return res.status(400).json({ error: '无匹配的审批规则' })
  pr.approvalNodes = buildApprovalNodes(rule); pr.currentNodeOrder = 0; pr.status = 'pending'
  pr.submittedAt = new Date().toISOString(); pr.updatedAt = pr.submittedAt
  // 通知第一个审批节点的候选人
  const first = pr.approvalNodes[0]
  findApproverCandidates(first, pr.departmentId).forEach(uid => {
    notify(uid, 'todo', '新的采购申请待审批', `${pr.applicantName}提交的「${pr.title}」(¥${pr.totalAmount})待您审批`, 'purchase_request', pr.id)
  })
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '采购申请提交', target: pr.id, targetType: 'purchase_request', after: { status: pr.status, totalAmount: pr.totalAmount } }); save(); res.json(pr)
})

r.post('/purchase-requests/:id/withdraw', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.purchaseRequests.find(x => x.id === req.params.id)
  if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.applicantId !== req.user!.id) return res.status(403).json({ error: '只能撤回自己的申请' })
  if (pr.status !== 'pending') return res.status(400).json({ error: '当前状态不可撤回' })
  // 未被下一节点处理即可撤回（当前节点仍是 pending 即未被处理）
  const node = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
  if (node?.status !== 'pending') return res.status(400).json({ error: '当前节点已处理，无法撤回' })
  pr.status = 'withdrawn'; pr.updatedAt = new Date().toISOString()
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '采购申请撤回', target: pr.id, targetType: 'purchase_request', after: { status: pr.status } }); save(); res.json(pr)
})

r.post('/purchase-requests/:id/approve', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!; const pr = db.purchaseRequests.find(x => x.id === req.params.id)
  if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.status !== 'pending') return res.status(400).json({ error: '当前状态不可审批' })
  const node = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
  if (!node) return res.status(400).json({ error: '无待审批节点' })
  const candidates = findApproverCandidates(node, pr.departmentId)
  if (!candidates.includes(user.id)) return res.status(403).json({ error: '非当前节点审批人' })
  const { action, comment, transferTo } = req.body || {}
  if (action === 'reject') {
    if (!comment) return res.status(400).json({ error: '驳回必须填写意见' })
    node.status = 'rejected'; node.comment = comment; node.actorId = user.id; node.actedAt = new Date().toISOString()
    pr.status = 'rejected'; pr.rejectReason = comment; pr.updatedAt = node.actedAt
    notify(pr.applicantId, 'result', '采购申请被驳回', `${user.name}驳回了您的申请「${pr.title}」：${comment}`, 'purchase_request', pr.id)
    addAudit({ userId: user.id, userName: user.name, action: '采购申请驳回', target: pr.id, targetType: 'purchase_request', after: { comment } })
  } else if (action === 'transfer') {
    if (!transferTo) return res.status(400).json({ error: '转交必须指定用户' })
    node.approverUserId = transferTo
    notify(transferTo, 'todo', '审批转交', `${user.name}将采购申请「${pr.title}」转交给您审批`, 'purchase_request', pr.id)
    addAudit({ userId: user.id, userName: user.name, action: '审批转交', target: pr.id, targetType: 'purchase_request', after: { transferTo } })
  } else if (action === 'approve') {
    node.status = 'approved'; node.comment = comment; node.actorId = user.id; node.actedAt = new Date().toISOString()
    const nextOrder = node.order + 1
    if (nextOrder < pr.approvalNodes.length) {
      pr.currentNodeOrder = nextOrder
      const next = pr.approvalNodes[nextOrder]
      findApproverCandidates(next, pr.departmentId).forEach(uid => notify(uid, 'todo', '新的采购申请待审批', `「${pr.title}」流转到您审批`, 'purchase_request', pr.id))
    } else {
      pr.status = 'approved'; pr.currentNodeOrder = undefined
      notify(pr.applicantId, 'result', '采购申请审批通过', `您的申请「${pr.title}」已全部审批通过，请等待采购下单`, 'purchase_request', pr.id)
      db.users.filter(u => u.role === 'purchaser').forEach(u => notify(u.id, 'todo', '待下单采购申请', `申请「${pr.title}」审批通过，请安排下单`, 'purchase_request', pr.id))
    }
    addAudit({ userId: user.id, userName: user.name, action: '采购申请同意', target: pr.id, targetType: 'purchase_request', after: { node: node.name } })
  } else {
    return res.status(400).json({ error: '非法动作' })
  }
  pr.updatedAt = new Date().toISOString(); save(); res.json(pr)
})

// ---------- 采购订单 ----------
r.get('/purchase-orders', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB()
  let list = [...db.purchaseOrders]
  if (req.query.status) list = list.filter(x => x.status === req.query.status)
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})
r.get('/purchase-orders/:id', authRequired, (req, res) => {
  const db = getDB(); const po = db.purchaseOrders.find(x => x.id === req.params.id); if (!po) return res.status(404).json({ error: '不存在' })
  res.json(po)
})

r.post('/purchase-orders/from-request/:prId', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.purchaseRequests.find(x => x.id === req.params.prId); if (!pr) return res.status(404).json({ error: '申请不存在' })
  if (pr.status !== 'approved') return res.status(400).json({ error: '申请未审批通过' })
  const lines = pr.lines.map(rl => ({
    id: newId('pol_'), requestLineId: rl.id, materialId: rl.materialId, materialName: rl.materialName, spec: rl.spec, unit: rl.unit,
    quantity: rl.quantity, receivedQty: 0, acceptedQty: 0, putawayQty: 0,
    unitPrice: round2(rl.estimatedUnitPrice / (1 + rl.taxRate)), taxRate: rl.taxRate,
    lineAmount: lineAmount(rl.quantity, round2(rl.estimatedUnitPrice / (1 + rl.taxRate)), rl.taxRate),
    deliveryDate: pr.expectedArrivalDate,
  }))
  const total = round2(lines.reduce((s, x) => s + x.lineAmount, 0))
  const tax = round2(lines.reduce((s, x) => s + x.quantity * x.unitPrice * x.taxRate, 0))
  const po: PurchaseOrder = {
    id: newId('po_'), code: genCode('CGDD', 'PO'), requestId: pr.id, supplierId: '',
    currencyCode: pr.currencyCode, expectedArrivalDate: pr.expectedArrivalDate,
    totalAmount: total, taxAmount: tax, status: 'draft', lines, createdBy: req.user!.id,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  db.purchaseOrders.push(po); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '订单生成', target: po.id, targetType: 'purchase_order', after: { requestId: pr.id } }); save(); res.json(po)
})

r.put('/purchase-orders/:id', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const po = db.purchaseOrders.find(x => x.id === req.params.id); if (!po) return res.status(404).json({ error: '不存在' })
  if (po.status !== 'draft') return res.status(400).json({ error: '仅草稿可编辑' })
  const body = req.body as Partial<PurchaseOrder>
  const supplier = db.suppliers.find(s => s.id === body.supplierId)
  if (supplier && supplier.status === 'blacklist') return res.status(400).json({ error: '黑名单供应商不可下单' })
  if (supplier && supplier.status !== 'qualified') return res.status(400).json({ error: '仅合格供应商可下单' })
  const lines = (body.lines || po.lines).map((l: any) => {
    const qty = Number(l.quantity || 0); const up = Number(l.unitPrice || 0); const tr = Number(l.taxRate || 0.13)
    return { ...l, quantity: qty, unitPrice: up, taxRate: tr, lineAmount: lineAmount(qty, up, tr), receivedQty: l.receivedQty || 0, acceptedQty: l.acceptedQty || 0, putawayQty: l.putawayQty || 0 }
  })
  Object.assign(po, body, {
    lines, supplierName: supplier?.name,
    totalAmount: round2(lines.reduce((s: number, x: any) => s + x.lineAmount, 0)),
    taxAmount: round2(lines.reduce((s: number, x: any) => s + x.quantity * x.unitPrice * x.taxRate, 0)),
    updatedAt: new Date().toISOString(),
  })
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '订单编辑', target: po.id, targetType: 'purchase_order', after: po }); save(); res.json(po)
})

r.post('/purchase-orders/:id/release', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const po = db.purchaseOrders.find(x => x.id === req.params.id); if (!po) return res.status(404).json({ error: '不存在' })
  if (po.status !== 'draft') return res.status(400).json({ error: '仅草稿可下达' })
  if (!po.supplierId) return res.status(400).json({ error: '请选择供应商' })
  if (!po.lines.length) return res.status(400).json({ error: '订单行不能为空' })
  po.status = 'released'; po.releasedAt = new Date().toISOString(); po.updatedAt = po.releasedAt
  const pr = db.purchaseRequests.find(p => p.id === po.requestId); if (pr) { pr.status = 'ordered'; pr.updatedAt = po.releasedAt }
  db.users.filter(u => u.role === 'warehouse').forEach(u => notify(u.id, 'todo', '新订单待到货', `订单 ${po.code} 已下达，请关注到货`, 'purchase_order', po.id))
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '订单下达', target: po.id, targetType: 'purchase_order', after: { code: po.code, supplierId: po.supplierId } }); save(); res.json(po)
})

r.post('/purchase-orders/:id/close', authRequired, requireRole('purchaser', 'purchase_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const po = db.purchaseOrders.find(x => x.id === req.params.id); if (!po) return res.status(404).json({ error: '不存在' })
  if (!['released', 'partial_arrival'].includes(po.status)) return res.status(400).json({ error: '当前状态不可关闭' })
  const { reason } = req.body || {}; if (!reason) return res.status(400).json({ error: '关闭原因必填' })
  po.status = 'closed'; po.closeReason = reason; po.closedAt = new Date().toISOString(); po.updatedAt = po.closedAt
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '订单关闭', target: po.id, targetType: 'purchase_order', after: { reason } }); save(); res.json(po)
})

// ---------- 到货/验收 ----------
r.get('/arrivals', authRequired, (_req, res) => res.json(getDB().arrivals.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
r.get('/arrivals/:id', authRequired, (req, res) => { const a = getDB().arrivals.find(x => x.id === req.params.id); a ? res.json(a) : res.status(404).json({ error: '不存在' }) })

r.post('/arrivals', authRequired, requireRole('warehouse', 'purchaser', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const body = req.body as Partial<Arrival>
  const po = db.purchaseOrders.find(x => x.id === body.orderId); if (!po) return res.status(404).json({ error: '订单不存在' })
  if (!['released', 'partial_arrival'].includes(po.status)) return res.status(400).json({ error: '当前订单状态不可到货' })
  const lines = (body.lines || []).map((al: any) => {
    const pol = po.lines.find(l => l.id === al.orderLineId)
    if (!pol) throw new Error('订单行不存在')
    const remaining = pol.quantity - pol.receivedQty
    if (Number(al.arrivedQty) > remaining + 0.001) throw new Error(`物料 ${pol.materialName} 到货数量超过剩余数量`)
    return {
      id: newId('arl_'), orderLineId: pol.id, materialId: pol.materialId, materialName: pol.materialName,
      arrivedQty: Number(al.arrivedQty), acceptedQty: 0, rejectedQty: 0,
      packageCondition: al.packageCondition,
    }
  })
  const arr: Arrival = {
    id: newId('arr_'), code: genCode('DHDJ', 'ARR'), orderId: po.id, arrivalDate: body.arrivalDate || new Date().toISOString().slice(0, 10),
    carrier: body.carrier, attachment: body.attachment, remark: body.remark,
    status: 'registered', lines, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  db.arrivals.push(arr); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '到货登记', target: arr.id, targetType: 'arrival', after: { orderCode: po.code } })
  po.status = 'partial_arrival'; po.updatedAt = arr.updatedAt
  db.users.filter(u => u.role === 'warehouse' || u.role === 'purchaser').forEach(u => notify(u.id, 'alert', '新到货待验收', `订单 ${po.code} 已登记到货，请安排验收`, 'arrival', arr.id))
  save(); res.json(arr)
})

r.post('/arrivals/:id/inspect', authRequired, requireRole('warehouse', 'purchaser', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const arr = db.arrivals.find(x => x.id === req.params.id); if (!arr) return res.status(404).json({ error: '不存在' })
  if (!['registered', 'inspecting'].includes(arr.status)) return res.status(400).json({ error: '当前状态不可验收' })
  const { lines: inLines, comment } = req.body || {}
  const po = db.purchaseOrders.find(p => p.id === arr.orderId)!
  let allAccepted = true
  for (const il of (inLines || [])) {
    const al = arr.lines.find(l => l.id === il.id); if (!al) continue
    const acc = Number(il.acceptedQty || 0); const rej = Number(il.rejectedQty || 0)
    if (acc + rej - al.arrivedQty > 0.001) return res.status(400).json({ error: '合格+不合格数量不能大于到货数量' })
    if (rej > 0 && !il.rejectReason) return res.status(400).json({ error: '不合格必须填写原因' })
    al.acceptedQty = acc; al.rejectedQty = rej; al.rejectReason = il.rejectReason
    if (acc < al.arrivedQty - 0.001) allAccepted = false
    // 累计到订单行（合格才算接收）
    const pol = po.lines.find(l => l.id === al.orderLineId)!
    pol.receivedQty = round2(pol.receivedQty + acc)
    pol.acceptedQty = round2(pol.acceptedQty + acc)
  }
  arr.status = allAccepted ? 'pending_putaway' : 'rejected'
  arr.inspectorId = req.user!.id; arr.inspectedAt = new Date().toISOString(); arr.inspectionComment = comment; arr.updatedAt = arr.inspectedAt
  // 判断订单行是否全部到货完成
  const allLinesDone = po.lines.every(l => l.acceptedQty >= l.quantity - 0.001)
  if (allLinesDone && allAccepted) po.status = 'all_arrived'
  else po.status = 'partial_arrival'
  po.updatedAt = arr.updatedAt
  if (arr.status === 'rejected') {
    const purchaser = db.users.find(u => u.role === 'purchaser')
    if (purchaser) notify(purchaser.id, 'alert', '到货验收异常', `到货单 ${arr.code} 存在不合格项，请跟进处理`, 'arrival', arr.id)
  } else {
    db.users.filter(u => u.role === 'warehouse').forEach(u => notify(u.id, 'todo', '到货待入库', `到货单 ${arr.code} 验收合格，待入库`, 'arrival', arr.id))
  }
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '到货验收', target: arr.id, targetType: 'arrival', after: { result: arr.status } }); save(); res.json(arr)
})

// ---------- 入库 ----------
r.get('/putaways', authRequired, (_req, res) => res.json(getDB().putaways.sort((a, b) => b.putawayAt.localeCompare(a.putawayAt))))

r.post('/putaways', authRequired, requireRole('warehouse', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const body = req.body as Partial<PutawayRecord>
  const arr = db.arrivals.find(x => x.id === body.arrivalId); if (!arr) return res.status(404).json({ error: '到货单不存在' })
  if (arr.status !== 'pending_putaway') return res.status(400).json({ error: '到货单未到待入库状态' })
  const po = db.purchaseOrders.find(p => p.id === arr.orderId)!
  const lines = (body.lines || []).map((pl: any) => {
    const al = arr.lines.find(l => l.id === pl.arrivalLineId)!
    const qty = Number(pl.qty || al.acceptedQty)
    if (qty > al.acceptedQty + 0.001) throw new Error('入库数量不能大于合格数量')
    const pol = po.lines.find(l => l.id === al.orderLineId)!
    pol.putawayQty = round2(pol.putawayQty + qty)
    return {
      id: newId('pwl_'), arrivalLineId: al.id, materialId: al.materialId, materialName: al.materialName,
      qty, warehouse: pl.warehouse || '默认仓库', location: pl.location,
    }
  })
  const pw: PutawayRecord = {
    id: newId('pw_'), code: genCode('RKD', 'PW'), arrivalId: arr.id, orderId: arr.orderId,
    status: 'done', lines, putawayBy: req.user!.id, putawayAt: new Date().toISOString(), remark: body.remark,
  }
  db.putaways.push(pw); arr.status = 'putaway'; arr.updatedAt = pw.putawayAt
  const allPutaway = po.lines.every(l => l.putawayQty >= l.quantity - 0.001)
  if (allPutaway) po.status = 'completed'
  po.updatedAt = pw.putawayAt
  db.users.filter(u => u.role === 'finance').forEach(u => notify(u.id, 'todo', '新入库待开票对账', `订单 ${po.code} 已入库，请跟进发票`, 'putaway', pw.id))
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '入库确认', target: pw.id, targetType: 'putaway', after: { arrivalCode: arr.code, orderCode: po.code } }); save(); res.json(pw)
})

// ---------- 发票与三单匹配 ----------
r.get('/invoices', authRequired, (_req, res) => res.json(getDB().invoices.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))))

r.post('/invoices', authRequired, requireRole('finance', 'finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const body = req.body as Partial<Invoice>
  const supplier = db.suppliers.find(s => s.id === body.supplierId); if (!supplier) return res.status(404).json({ error: '供应商不存在' })
  const lines = (body.lines || []).map((il: any) => {
    const pwl = db.putaways.flatMap(p => p.lines).find(l => l.id === il.putawayLineId)
    if (!pwl) throw new Error('入库明细不存在')
    const qty = Number(il.qty || pwl.qty); const up = Number(il.unitPrice || 0); const tr = Number(il.taxRate || 0.13)
    return {
      id: newId('invl_'), putawayLineId: pwl.id, materialId: pwl.materialId, materialName: pwl.materialName,
      qty, unitPrice: up, taxRate: tr, lineAmount: lineAmount(qty, up, tr),
    }
  })
  const total = round2(lines.reduce((s, x) => s + x.lineAmount, 0))
  const tax = round2(lines.reduce((s, x) => s + x.qty * x.unitPrice * x.taxRate, 0))
  const inv: Invoice = {
    id: newId('inv_'), code: genCode('FP', 'INV'), invoiceNo: body.invoiceNo!, invoiceCode: body.invoiceCode,
    invoiceDate: body.invoiceDate!, supplierId: supplier.id, supplierName: supplier.name,
    totalAmount: total, taxAmount: tax, attachment: body.attachment, status: 'matching', lines,
    registeredBy: req.user!.id, registeredAt: new Date().toISOString(),
  }
  // 三单匹配：简单规则——按入库明细核对数量/金额
  let qtyDiff = false, amtDiff = false
  for (const l of inv.lines) {
    const pwl = db.putaways.flatMap(p => p.lines).find(x => x.id === l.putawayLineId)!
    const pol = findOrderLineByPutaway(db, pwl.id)
    if (!pol) { amtDiff = true; continue }
    if (Math.abs(l.qty - pwl.qty) > 0.001) qtyDiff = true
    const expectedLineAmt = lineAmount(l.qty, pol.unitPrice, l.taxRate)
    if (Math.abs(l.lineAmount - expectedLineAmt) / expectedLineAmt > 0.01) amtDiff = true
  }
  inv.matchResult = qtyDiff ? 'qty_diff' : amtDiff ? 'amount_diff' : 'full'
  inv.status = inv.matchResult === 'full' ? 'matched' : 'mismatch'
  db.invoices.push(inv)
  if (inv.status === 'mismatch') {
    const mgr = db.users.find(u => u.role === 'finance_mgr')
    if (mgr) notify(mgr.id, 'alert', '发票匹配异常', `发票 ${inv.invoiceNo} 三单匹配异常，请审核`, 'invoice', inv.id)
  }
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '发票登记', target: inv.id, targetType: 'invoice', after: { invoiceNo: inv.invoiceNo, matchResult: inv.matchResult } }); save(); res.json(inv)
})

r.post('/invoices/:id/resolve-mismatch', authRequired, requireRole('finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const inv = db.invoices.find(x => x.id === req.params.id); if (!inv) return res.status(404).json({ error: '不存在' })
  if (inv.status !== 'mismatch') return res.status(400).json({ error: '仅异常状态可处理' })
  const { note } = req.body || {}; if (!note) return res.status(400).json({ error: '差异处理说明必填' })
  inv.mismatchNote = note; inv.mismatchApprovedBy = req.user!.id; inv.status = 'matched'
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '发票差异确认', target: inv.id, targetType: 'invoice', after: { note } }); save(); res.json(inv)
})

// ---------- 对账 ----------
r.get('/reconciliations', authRequired, (_req, res) => res.json(getDB().reconciliations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
r.post('/reconciliations', authRequired, requireRole('finance', 'finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const { supplierId, period } = req.body || {}
  const supplier = db.suppliers.find(s => s.id === supplierId); if (!supplier) return res.status(404).json({ error: '供应商不存在' })
  const pos = db.purchaseOrders.filter(p => p.supplierId === supplierId && p.status !== 'draft')
  const pws = db.putaways.filter(p => {
    const po = db.purchaseOrders.find(o => o.id === p.orderId); return po?.supplierId === supplierId && p.putawayAt.startsWith(period || new Date().toISOString().slice(0, 7))
  })
  const matchedInvs = db.invoices.filter(i => i.supplierId === supplierId && i.status === 'matched')
  const orderAmt = round2(pos.reduce((s, p) => s + p.totalAmount, 0))
  const putawayAmt = round2(pws.reduce((s, p) => s + p.lines.reduce((ss, l) => ss + l.qty * (findOrderLineByArrivalLine(db, l.arrivalLineId)?.unitPrice || 0) * (1 + (findOrderLineByArrivalLine(db, l.arrivalLineId)?.taxRate || 0)), 0), 0))
  const invAmt = round2(matchedInvs.reduce((s, i) => s + i.totalAmount, 0))
  const paidAmt = round2(db.paymentRequests.filter(pr => pr.supplierId === supplierId && pr.status === 'paid').reduce((s, pr) => s + pr.amount, 0))
  const rec: Reconciliation = {
    id: newId('rec_'), code: genCode('DZ', 'REC'), supplierId, supplierName: supplier.name,
    period: period || new Date().toISOString().slice(0, 7), orderAmount: orderAmt, putawayAmount: putawayAmt,
    invoicedAmount: invAmt, paidAmount: paidAmt, payableAmount: round2(invAmt - paidAmt), status: 'draft',
    createdAt: new Date().toISOString(),
  }
  db.reconciliations.push(rec); addAudit({ userId: req.user!.id, userName: req.user!.name, action: '对账单生成', target: rec.id, targetType: 'reconciliation', after: { supplierId, period } }); save(); res.json(rec)
})
r.post('/reconciliations/:id/confirm', authRequired, requireRole('finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const r0 = db.reconciliations.find(x => x.id === req.params.id); if (!r0) return res.status(404).json({ error: '不存在' })
  r0.status = 'confirmed'; addAudit({ userId: req.user!.id, userName: req.user!.name, action: '对账确认', target: r0.id, targetType: 'reconciliation' })
  // 标记相关发票已对账
  db.invoices.filter(i => i.supplierId === r0.supplierId && i.status === 'matched').forEach(i => i.status = 'reconciled')
  save(); res.json(r0)
})

// ---------- 付款申请 ----------
r.get('/payment-requests', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); let list = [...db.paymentRequests]
  const scope = req.query.scope as string
  if (scope === 'todo' && req.user) {
    list = list.filter(pr => {
      if (pr.status !== 'pending') return false
      const n = pr.approvalNodes.find(x => x.order === pr.currentNodeOrder); if (!n) return false
      return db.users.filter(u => u.role === n.approverRole).map(u => u.id).includes(req.user!.id)
    })
  }
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})
r.post('/payment-requests', authRequired, requireRole('finance', 'finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const body = req.body as Partial<PaymentRequest>
  const supplier = db.suppliers.find(s => s.id === body.supplierId); if (!supplier) return res.status(404).json({ error: '供应商不存在' })
  const amount = round2(Number(body.amount || 0))
  const rule = pickRule(amount); if (!rule) return res.status(400).json({ error: '无匹配的审批规则' })
  const nodes = buildApprovalNodes(rule)
  const pr: PaymentRequest = {
    id: newId('pay_'), code: genCode('FK', 'PAY'), supplierId: supplier.id, supplierName: supplier.name,
    reconciliationId: body.reconciliationId, invoiceIds: body.invoiceIds || [],
    payeeAccount: body.payeeAccount || supplier.bankAccount || '', payeeBank: body.payeeBank || supplier.bankName || '',
    amount, paymentMethod: body.paymentMethod || '银行转账', remark: body.remark, status: 'pending',
    approvalNodes: nodes, currentNodeOrder: 0, createdBy: req.user!.id, createdAt: new Date().toISOString(),
  }
  db.paymentRequests.push(pr)
  const first = nodes[0]
  db.users.filter(u => u.role === first.approverRole).forEach(u => notify(u.id, 'todo', '新付款申请待审批', `${supplier.name} 付款 ¥${amount} 待审批`, 'payment_request', pr.id))
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '付款申请提交', target: pr.id, targetType: 'payment_request', after: { amount, supplierId: pr.supplierId } }); save(); res.json(pr)
})
r.post('/payment-requests/:id/approve', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!; const pr = db.paymentRequests.find(x => x.id === req.params.id); if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.status !== 'pending') return res.status(400).json({ error: '当前状态不可审批' })
  const node = pr.approvalNodes.find(n => n.order === pr.currentNodeOrder)
  if (!node || node.approverRole !== user.role) return res.status(403).json({ error: '非当前节点审批人' })
  const { action, comment } = req.body || {}
  if (action === 'reject') {
    if (!comment) return res.status(400).json({ error: '驳回必填意见' })
    node.status = 'rejected'; node.comment = comment; node.actorId = user.id; node.actedAt = new Date().toISOString()
    pr.status = 'rejected'; addAudit({ userId: user.id, userName: user.name, action: '付款申请驳回', target: pr.id, targetType: 'payment_request', after: { comment } })
  } else {
    node.status = 'approved'; node.actorId = user.id; node.actedAt = new Date().toISOString(); node.comment = comment
    const next = node.order + 1
    if (next < pr.approvalNodes.length) {
      pr.currentNodeOrder = next
      const nn = pr.approvalNodes[next]
      db.users.filter(u => u.role === nn.approverRole).forEach(u => notify(u.id, 'todo', '付款申请待审批', `付款 ${pr.code} 流转到您审批`, 'payment_request', pr.id))
    } else {
      pr.status = 'approved'; pr.currentNodeOrder = undefined
      const creator = db.users.find(u => u.id === pr.createdBy)
      if (creator) notify(creator.id, 'result', '付款申请审批通过', `付款 ${pr.code} 已审批通过，待付款`, 'payment_request', pr.id)
    }
    addAudit({ userId: user.id, userName: user.name, action: '付款申请同意', target: pr.id, targetType: 'payment_request' })
  }
  save(); res.json(pr)
})
r.post('/payment-requests/:id/mark-paid', authRequired, requireRole('finance', 'finance_mgr', 'admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB(); const pr = db.paymentRequests.find(x => x.id === req.params.id); if (!pr) return res.status(404).json({ error: '不存在' })
  if (pr.status !== 'approved') return res.status(400).json({ error: '仅审批通过可标记付款' })
  pr.status = 'paid'; pr.paidAt = new Date().toISOString()
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '付款登记', target: pr.id, targetType: 'payment_request', after: { paidAt: pr.paidAt } }); save(); res.json(pr)
})

// ---------- 预留 API ----------
r.post('/integration/putaway-instruction', authRequired, requireRole('admin'), (_req: AuthedRequest, res: Response) => {
  // 模式B预留：推送到仓储系统
  res.json({ ok: true, message: '入库指令已受理（预留接口）', acceptedAt: new Date().toISOString() })
})
r.post('/integration/putaway-callback', (req: Request, res: Response) => {
  res.json({ ok: true, message: '回传已接收（预留接口，未启用外部系统对接）', body: req.body })
})

// ---------- 通知 / 审计 / 看板 ----------
r.get('/notifications', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); res.json(db.notifications.filter(n => n.toUserId === req.user!.id).slice(0, 100))
})
r.post('/notifications/:id/read', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const n = db.notifications.find(x => x.id === req.params.id); if (n && n.toUserId === req.user!.id) n.read = true; save(); res.json({ ok: true })
})
r.post('/notifications/read-all', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); db.notifications.filter(n => n.toUserId === req.user!.id).forEach(n => n.read = true); save(); res.json({ ok: true })
})

r.get('/audit-logs', authRequired, requireRole('admin', 'purchase_mgr', 'finance_mgr'), (req: AuthedRequest, res: Response) => {
  const db = getDB()
  let list = [...db.auditLogs]
  if (req.query.userId) list = list.filter(l => l.userId === req.query.userId)
  if (req.query.targetType) list = list.filter(l => l.targetType === req.query.targetType)
  res.json(list.slice(0, 500))
})

r.get('/dashboard/stats', authRequired, (req: AuthedRequest, res: Response) => {
  const db = getDB(); const user = req.user!
  const prs = db.purchaseRequests; const pos = db.purchaseOrders.filter(p => p.status !== 'draft')
  const totalPRAmount = round2(prs.filter(p => p.status !== 'draft').reduce((s, p) => s + p.totalAmount, 0))
  const totalPOAmount = round2(pos.reduce((s, p) => s + p.totalAmount, 0))
  const pendingNodes = prs.filter(p => p.status === 'pending').filter(pr => {
    const n = pr.approvalNodes.find(x => x.order === pr.currentNodeOrder); return n && findApproverCandidates(n, pr.departmentId).includes(user.id)
  })
  const pendingPutaway = db.arrivals.filter(a => a.status === 'pending_putaway').length
  const totalApproved = prs.filter(p => p.status === 'approved' || p.status === 'ordered').length
  const onTimeApproved = prs.filter(p => (p.status === 'approved' || p.status === 'ordered') && p.submittedAt).length
  const approvalOnTimeRate = totalApproved > 0 ? round2(onTimeApproved / totalApproved) : 1
  const completedPos = pos.filter(p => p.status === 'completed')
  const arrivalOnTimeRate = pos.length > 0 ? round2(completedPos.length / pos.length) : 1
  res.json({
    totalPRAmount, totalPOAmount,
    pendingApprovalCount: pendingNodes.length,
    pendingPutawayCount: ['warehouse'].includes(user.role) ? pendingPutaway : 0,
    approvalOnTimeRate, arrivalOnTimeRate,
    supplierCount: db.suppliers.filter(s => s.status === 'qualified').length,
    activePRCount: prs.filter(p => p.status === 'pending' || p.status === 'approved').length,
    myTodoCount: pendingNodes.length + db.notifications.filter(n => n.toUserId === user.id && !n.read).length,
  })
})

function findOrderLineByPutaway(db: ReturnType<typeof getDB>, putawayLineId: string) {
  const pwl = db.putaways.flatMap(p => p.lines).find(l => l.id === putawayLineId); if (!pwl) return undefined
  return findOrderLineByArrivalLine(db, pwl.arrivalLineId)
}
function findOrderLineByArrivalLine(db: ReturnType<typeof getDB>, arrivalLineId: string) {
  const al = db.arrivals.flatMap(a => a.lines).find(l => l.id === arrivalLineId); if (!al) return undefined
  for (const po of db.purchaseOrders) { const pol = po.lines.find(l => l.id === al.orderLineId); if (pol) return pol }
  return undefined
}

// ---------- 重置演示数据 ----------
r.post('/dev/reset', authRequired, requireRole('admin'), (req: AuthedRequest, res: Response) => {
  const db = getDB()
  db.purchaseRequests = []; db.purchaseOrders = []; db.arrivals = []; db.putaways = []; db.invoices = []; db.reconciliations = []
  db.paymentRequests = []; db.auditLogs = []; db.notifications = []
  Object.keys(db.seq).forEach(k => db.seq[k] = 0)
  addAudit({ userId: req.user!.id, userName: req.user!.name, action: '演示数据重置', target: 'system', targetType: 'system' })
  save(); res.json({ ok: true })
})

export default r
