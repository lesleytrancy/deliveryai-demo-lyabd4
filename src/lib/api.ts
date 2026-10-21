const BASE = '/api'
type Listener = () => void
const listeners = new Set<Listener>()

let token: string | null = localStorage.getItem('pms_token')

export function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('pms_token', t)
  else localStorage.removeItem('pms_token')
  listeners.forEach(l => l())
}
export function getToken() { return token }
export function onAuthChange(l: Listener) { listeners.add(l); return () => listeners.delete(l) }

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (token) headers['X-Auth-Token'] = token
  const res = await fetch(BASE + path, { ...opts, headers })
  if (res.status === 401) { setToken(null); throw new Error('未登录或会话已过期') }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || `请求失败(${res.status})`)
  return data as T
}

export const api = {
  login: (username: string, password: string) => request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<any>('/auth/me'),
  meta: () => request<any>('/meta'),

  // 物料
  createMaterial: (body: any) => request('/materials', { method: 'POST', body: JSON.stringify(body) }),
  updateMaterial: (id: string, body: any) => request(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleMaterial: (id: string) => request(`/materials/${id}/toggle`, { method: 'POST' }),
  updateApprovalRules: (rules: any[]) => request('/approval-rules', { method: 'PUT', body: JSON.stringify({ rules }) }),

  // 供应商
  listSuppliers: () => request<any[]>('/suppliers'),
  createSupplier: (body: any) => request('/suppliers', { method: 'POST', body: JSON.stringify(body) }),
  updateSupplier: (id: string, body: any) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  admitSupplier: (id: string, approved: boolean, reason?: string) => request(`/suppliers/${id}/admit`, { method: 'POST', body: JSON.stringify({ approved, reason }) }),
  blacklistSupplier: (id: string, blacklist: boolean) => request(`/suppliers/${id}/blacklist`, { method: 'POST', body: JSON.stringify({ blacklist }) }),

  // 合同
  createContract: (body: any) => request('/contracts', { method: 'POST', body: JSON.stringify(body) }),
  updateContract: (id: string, body: any) => request(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // 采购申请
  listPRs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<any[]>(`/purchase-requests${qs ? '?' + qs : ''}`)
  },
  getPR: (id: string) => request<any>(`/purchase-requests/${id}`),
  createPR: (body: any) => request('/purchase-requests', { method: 'POST', body: JSON.stringify(body) }),
  updatePR: (id: string, body: any) => request(`/purchase-requests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  submitPR: (id: string) => request(`/purchase-requests/${id}/submit`, { method: 'POST' }),
  withdrawPR: (id: string) => request(`/purchase-requests/${id}/withdraw`, { method: 'POST' }),
  approvePR: (id: string, action: string, comment?: string, transferTo?: string) =>
    request(`/purchase-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ action, comment, transferTo }) }),

  // 采购订单
  listPOs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<any[]>(`/purchase-orders${qs ? '?' + qs : ''}`)
  },
  getPO: (id: string) => request<any>(`/purchase-orders/${id}`),
  createPOFromPR: (prId: string) => request(`/purchase-orders/from-request/${prId}`, { method: 'POST' }),
  updatePO: (id: string, body: any) => request(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  releasePO: (id: string) => request(`/purchase-orders/${id}/release`, { method: 'POST' }),
  closePO: (id: string, reason: string) => request(`/purchase-orders/${id}/close`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // 到货验收
  listArrivals: () => request<any[]>('/arrivals'),
  getArrival: (id: string) => request<any>(`/arrivals/${id}`),
  createArrival: (body: any) => request('/arrivals', { method: 'POST', body: JSON.stringify(body) }),
  inspectArrival: (id: string, lines: any[], comment?: string) => request(`/arrivals/${id}/inspect`, { method: 'POST', body: JSON.stringify({ lines, comment }) }),

  // 入库
  listPutaways: () => request<any[]>('/putaways'),
  createPutaway: (body: any) => request('/putaways', { method: 'POST', body: JSON.stringify(body) }),

  // 发票
  listInvoices: () => request<any[]>('/invoices'),
  createInvoice: (body: any) => request('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  resolveInvoiceMismatch: (id: string, note: string) => request(`/invoices/${id}/resolve-mismatch`, { method: 'POST', body: JSON.stringify({ note }) }),

  // 对账
  listReconciliations: () => request<any[]>('/reconciliations'),
  createReconciliation: (supplierId: string, period: string) => request('/reconciliations', { method: 'POST', body: JSON.stringify({ supplierId, period }) }),
  confirmReconciliation: (id: string) => request(`/reconciliations/${id}/confirm`, { method: 'POST' }),

  // 付款
  listPayments: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<any[]>(`/payment-requests${qs ? '?' + qs : ''}`)
  },
  createPayment: (body: any) => request('/payment-requests', { method: 'POST', body: JSON.stringify(body) }),
  approvePayment: (id: string, action: string, comment?: string) => request(`/payment-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ action, comment }) }),
  markPaymentPaid: (id: string) => request(`/payment-requests/${id}/mark-paid`, { method: 'POST' }),

  // 通知/审计/看板
  listNotifications: () => request<any[]>('/notifications'),
  readNotification: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request('/notifications/read-all', { method: 'POST' }),
  listAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<any[]>(`/audit-logs${qs ? '?' + qs : ''}`)
  },
  dashboard: () => request<any>('/dashboard/stats'),
  resetDemo: () => request('/dev/reset', { method: 'POST' }),
}
