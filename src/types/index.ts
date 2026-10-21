export type Role = 'applicant' | 'dept_manager' | 'purchaser' | 'purchase_mgr' | 'warehouse' | 'finance' | 'finance_mgr' | 'leader' | 'admin'

export interface User {
  id: string
  username: string
  name: string
  role: Role
  departmentId?: string
  email?: string
  phone?: string
}

export interface Department { id: string; name: string; managerUserId?: string }
export interface CostCenter { id: string; code: string; name: string }
export interface MaterialCategory { id: string; code: string; name: string }
export interface Material { id: string; code: string; name: string; spec?: string; unit: string; categoryId: string; defaultTaxRate: number; active: boolean }
export interface Currency { id: string; code: string; name: string }
export interface TaxRate { id: string; name: string; rate: number }
export interface PaymentTerm { id: string; code: string; name: string; days: number }

export type SupplierStatus = 'potential' | 'pending_admit' | 'qualified' | 'rejected' | 'paused' | 'blacklist'
export interface Supplier {
  id: string; code: string; name: string; shortName?: string; uscc: string; contactName: string; contactPhone: string
  contactEmail?: string; address?: string; bankName?: string; bankAccount?: string
  categoryIds: string[]; qualificationExpireAt?: string
  status: SupplierStatus; rating?: string; remark?: string
  createdAt: string; updatedAt: string
}

export interface Contract {
  id: string; code: string; name: string; supplierId: string
  signedAt: string; effectiveAt: string; expireAt: string; amount: number
  paymentTerms?: string; attachment?: string
  status: 'draft' | 'effective' | 'expired' | 'terminated'
}

export interface ApprovalNode {
  id: string; order: number; name: string; approverRole: Role; approverUserId?: string
  status: 'pending' | 'approved' | 'rejected'; comment?: string; actedAt?: string; actorId?: string
}

export type PRStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'ordered'
export interface PRLine {
  id: string; materialId: string; materialName?: string; spec?: string; unit?: string
  quantity: number; estimatedUnitPrice: number; taxRate: number; lineAmount: number; remark?: string
}
export interface PurchaseRequest {
  id: string; code: string; title: string; applicantId: string; applicantName?: string
  departmentId: string; deptName?: string; costCenterId?: string
  currencyCode: string; budgetAmount: number; totalAmount: number; reason: string
  expectedArrivalDate: string; attachment?: string
  status: PRStatus; lines: PRLine[]; approvalNodes: ApprovalNode[]; currentNodeOrder?: number
  rejectReason?: string; createdAt: string; updatedAt: string; submittedAt?: string
}

export type POStatus = 'draft' | 'released' | 'partial_arrival' | 'all_arrived' | 'completed' | 'closed'
export interface POLine {
  id: string; requestLineId: string; materialId: string; materialName?: string; spec?: string; unit?: string
  quantity: number; receivedQty: number; acceptedQty: number; putawayQty: number
  unitPrice: number; taxRate: number; lineAmount: number; deliveryDate?: string; remark?: string
}
export interface PurchaseOrder {
  id: string; code: string; requestId: string; supplierId: string; supplierName?: string
  contractId?: string; currencyCode: string; paymentTermId?: string; deliveryAddress?: string
  expectedArrivalDate: string; totalAmount: number; taxAmount: number; status: POStatus
  lines: POLine[]; closeReason?: string; createdBy: string; createdAt: string; updatedAt: string
  releasedAt?: string; closedAt?: string
}

export interface ArrivalLine {
  id: string; orderLineId: string; materialId: string; materialName?: string
  arrivedQty: number; acceptedQty: number; rejectedQty: number
  rejectReason?: string; packageCondition?: string
}
export type ArrivalStatus = 'draft' | 'registered' | 'inspecting' | 'accepted' | 'rejected' | 'pending_putaway' | 'putaway'
export interface Arrival {
  id: string; code: string; orderId: string; arrivalDate: string; carrier?: string
  attachment?: string; remark?: string; status: ArrivalStatus
  lines: ArrivalLine[]; inspectorId?: string; inspectedAt?: string; inspectionComment?: string
  createdAt: string; updatedAt: string
}

export interface PutawayLine {
  id: string; arrivalLineId: string; materialId: string; materialName?: string
  qty: number; warehouse: string; location?: string
}
export interface PutawayRecord {
  id: string; code: string; arrivalId: string; orderId: string; status: 'pending' | 'done'
  lines: PutawayLine[]; putawayBy: string; putawayAt: string; remark?: string
}

export interface InvoiceLine {
  id: string; putawayLineId: string; materialId: string; materialName?: string
  qty: number; unitPrice: number; taxRate: number; lineAmount: number
}
export type InvoiceStatus = 'draft' | 'registered' | 'matching' | 'matched' | 'mismatch' | 'reconciled' | 'payment_requested'
export interface Invoice {
  id: string; code: string; invoiceNo: string; invoiceCode?: string; invoiceDate: string
  supplierId: string; supplierName?: string; totalAmount: number; taxAmount: number
  attachment?: string; status: InvoiceStatus; lines: InvoiceLine[]
  matchResult?: 'full' | 'qty_diff' | 'amount_diff' | 'unmatched'
  mismatchNote?: string; mismatchApprovedBy?: string
  registeredBy: string; registeredAt: string
}

export interface Reconciliation {
  id: string; code: string; supplierId: string; supplierName?: string; period: string
  orderAmount: number; putawayAmount: number; invoicedAmount: number
  paidAmount: number; payableAmount: number; status: 'draft' | 'confirmed'; createdAt: string
}

export type PayStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
export interface PaymentRequest {
  id: string; code: string; supplierId: string; supplierName?: string
  reconciliationId?: string; invoiceIds: string[]
  payeeAccount: string; payeeBank: string
  amount: number; paymentMethod: string; remark?: string
  status: PayStatus; approvalNodes: ApprovalNode[]; currentNodeOrder?: number
  createdBy: string; createdAt: string; paidAt?: string
}

export interface ApprovalRule { id: string; minAmount: number; maxAmount: number; chain: { name: string; approverRole: Role }[] }

export interface Notification {
  id: string; at: string; toUserId: string; type: 'todo' | 'result' | 'remind' | 'alert'
  title: string; content: string; refType?: string; refId?: string; read: boolean
}

export interface AuditLog {
  id: string; at: string; userId: string; userName: string; action: string
  target: string; targetType: string; before?: unknown; after?: unknown; ip?: string
}

export interface Meta {
  departments: Department[]
  costCenters: CostCenter[]
  materialCategories: MaterialCategory[]
  materials: Material[]
  currencies: Currency[]
  taxRates: TaxRate[]
  paymentTerms: PaymentTerm[]
  approvalRules: ApprovalRule[]
  users: Pick<User, 'id' | 'username' | 'name' | 'role' | 'departmentId'>[]
  suppliers: Supplier[]
  contracts: Contract[]
}

export interface DashboardStats {
  totalPRAmount: number; totalPOAmount: number
  pendingApprovalCount: number; pendingPutawayCount: number
  approvalOnTimeRate: number; arrivalOnTimeRate: number
  supplierCount: number; activePRCount: number; myTodoCount: number
}

export const RoleLabels: Record<Role, string> = {
  applicant: '申请人', dept_manager: '部门负责人', purchaser: '采购专员', purchase_mgr: '采购经理',
  warehouse: '仓储', finance: '财务', finance_mgr: '财务主管', leader: '分管领导', admin: '系统管理员'
}

export const PRStatusLabels: Record<PRStatus, string> = {
  draft: '草稿', pending: '审批中', approved: '审批通过', rejected: '已驳回', withdrawn: '已撤回', ordered: '已下单'
}
export const POStatusLabels: Record<POStatus, string> = {
  draft: '草稿', released: '已下达', partial_arrival: '部分到货', all_arrived: '全部到货', completed: '已完成', closed: '已关闭'
}
export const ArrivalStatusLabels: Record<ArrivalStatus, string> = {
  draft: '草稿', registered: '已登记', inspecting: '验收中', accepted: '验收合格', rejected: '验收异常', pending_putaway: '待入库', putaway: '已入库'
}
export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: '草稿', registered: '已登记', matching: '匹配中', matched: '匹配通过', mismatch: '匹配异常', reconciled: '已对账', payment_requested: '已申请付款'
}
export const PayStatusLabels: Record<PayStatus, string> = {
  draft: '草稿', pending: '审批中', approved: '待付款', rejected: '已驳回', paid: '已付款'
}
export const SupplierStatusLabels: Record<SupplierStatus, string> = {
  potential: '潜在', pending_admit: '待准入', qualified: '合格', rejected: '准入驳回', paused: '暂停', blacklist: '黑名单'
}
