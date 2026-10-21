// 久大蓬盐采购管理系统 - 核心领域类型
export type ID = string

export interface User {
  id: ID
  username: string
  name: string
  password: string
  role: Role
  departmentId?: ID
  email?: string
  phone?: string
}

export type Role =
  | 'applicant'       // 申请人
  | 'dept_manager'    // 部门负责人
  | 'purchaser'       // 采购专员
  | 'purchase_mgr'    // 采购经理
  | 'warehouse'       // 仓储
  | 'finance'         // 财务
  | 'finance_mgr'     // 财务主管
  | 'leader'          // 分管领导
  | 'admin'           // 系统管理员

export interface Department { id: ID; name: string; managerUserId?: ID }
export interface CostCenter { id: ID; code: string; name: string }
export interface Material { id: ID; code: string; name: string; spec?: string; unit: string; categoryId: ID; defaultTaxRate: number; active: boolean }
export interface MaterialCategory { id: ID; code: string; name: string }
export interface Currency { id: ID; code: string; name: string; rate: number } // 汇率以CNY为基准
export interface TaxRate { id: ID; name: string; rate: number }
export interface PaymentTerm { id: ID; code: string; name: string; days: number }

export type SupplierStatus = 'potential' | 'pending_admit' | 'qualified' | 'rejected' | 'paused' | 'blacklist'
export type SupplierRating = 'A' | 'B' | 'C' | 'D'
export interface Supplier {
  id: ID
  code: string
  name: string
  shortName?: string
  uscc: string // 统一社会信用代码
  contactName: string
  contactPhone: string
  contactEmail?: string
  address?: string
  bankName?: string
  bankAccount?: string
  taxpayerType?: string
  categoryIds: ID[]
  qualificationExpireAt?: string
  status: SupplierStatus
  rating?: SupplierRating
  remark?: string
  createdAt: string
  updatedAt: string
}

export interface Contract {
  id: ID
  code: string
  name: string
  supplierId: ID
  signedAt: string
  effectiveAt: string
  expireAt: string
  amount: number
  paymentTerms?: string
  attachment?: string
  status: 'draft' | 'effective' | 'expired' | 'terminated'
}

export type ApprovalNodeStatus = 'pending' | 'approved' | 'rejected'
export interface ApprovalNode {
  id: ID
  order: number
  name: string
  approverRole: Role
  approverUserId?: ID
  status: ApprovalNodeStatus
  comment?: string
  actedAt?: string
  actorId?: ID
}

export type PurchaseRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'ordered'
export interface PurchaseRequestLine {
  id: ID
  materialId: ID
  materialName?: string
  spec?: string
  unit?: string
  quantity: number
  estimatedUnitPrice: number
  taxRate: number
  lineAmount: number // 含税
  remark?: string
}
export interface PurchaseRequest {
  id: ID
  code: string
  title: string
  applicantId: ID
  departmentId: ID
  deptName?: string
  applicantName?: string
  costCenterId?: ID
  currencyCode: string
  budgetAmount: number
  totalAmount: number
  reason: string
  expectedArrivalDate: string
  attachment?: string
  status: PurchaseRequestStatus
  lines: PurchaseRequestLine[]
  approvalNodes: ApprovalNode[]
  currentNodeOrder?: number
  rejectReason?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
}

export type PurchaseOrderStatus = 'draft' | 'released' | 'partial_arrival' | 'all_arrived' | 'completed' | 'closed'
export interface PurchaseOrderLine {
  id: ID
  requestLineId: ID
  materialId: ID
  materialName?: string
  spec?: string
  unit?: string
  quantity: number
  receivedQty: number       // 累计到货合格
  acceptedQty: number       // 累计验收合格
  putawayQty: number        // 累计入库
  unitPrice: number         // 未税
  taxRate: number
  lineAmount: number        // 含税
  deliveryDate?: string
  remark?: string
}
export interface PurchaseOrder {
  id: ID
  code: string
  requestId: ID
  supplierId: ID
  supplierName?: string
  contractId?: ID
  currencyCode: string
  paymentTermId?: ID
  deliveryAddress?: string
  expectedArrivalDate: string
  totalAmount: number
  taxAmount: number
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
  closeReason?: string
  createdBy: ID
  createdAt: string
  updatedAt: string
  releasedAt?: string
  closedAt?: string
}

export type ArrivalStatus = 'draft' | 'registered' | 'inspecting' | 'accepted' | 'rejected' | 'pending_putaway' | 'putaway'
export interface ArrivalLine {
  id: ID
  orderLineId: ID
  materialId: ID
  materialName?: string
  arrivedQty: number
  acceptedQty: number
  rejectedQty: number
  rejectReason?: string
  packageCondition?: string
}
export interface Arrival {
  id: ID
  code: string
  orderId: ID
  arrivalDate: string
  carrier?: string
  attachment?: string
  remark?: string
  status: ArrivalStatus
  lines: ArrivalLine[]
  inspectorId?: ID
  inspectedAt?: string
  inspectionComment?: string
  createdAt: string
  updatedAt: string
}

export type PutawayStatus = 'pending' | 'done'
export interface PutawayLine {
  id: ID
  arrivalLineId: ID
  materialId: ID
  materialName?: string
  qty: number
  warehouse: string
  location?: string
}
export interface PutawayRecord {
  id: ID
  code: string
  arrivalId: ID
  orderId: ID
  status: PutawayStatus
  lines: PutawayLine[]
  putawayBy: ID
  putawayAt: string
  remark?: string
}

export type InvoiceStatus = 'draft' | 'registered' | 'matching' | 'matched' | 'mismatch' | 'reconciled' | 'payment_requested'
export interface InvoiceLine {
  id: ID
  putawayLineId: ID
  materialId: ID
  materialName?: string
  qty: number
  unitPrice: number
  taxRate: number
  lineAmount: number
}
export interface Invoice {
  id: ID
  code: string
  invoiceNo: string
  invoiceCode?: string
  invoiceDate: string
  supplierId: ID
  supplierName?: string
  totalAmount: number
  taxAmount: number
  attachment?: string
  status: InvoiceStatus
  lines: InvoiceLine[]
  matchResult?: 'full' | 'qty_diff' | 'amount_diff' | 'unmatched'
  mismatchNote?: string
  mismatchApprovedBy?: ID
  registeredBy: ID
  registeredAt: string
}

export type ReconciliationStatus = 'draft' | 'confirmed'
export interface Reconciliation {
  id: ID
  code: string
  supplierId: ID
  supplierName?: string
  period: string // YYYY-MM
  orderAmount: number
  putawayAmount: number
  invoicedAmount: number
  paidAmount: number
  payableAmount: number
  status: ReconciliationStatus
  createdAt: string
}

export type PaymentRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
export interface PaymentRequest {
  id: ID
  code: string
  supplierId: ID
  supplierName?: string
  reconciliationId?: ID
  invoiceIds: ID[]
  payeeAccount: string
  payeeBank: string
  amount: number
  paymentMethod: string
  remark?: string
  status: PaymentRequestStatus
  approvalNodes: ApprovalNode[]
  currentNodeOrder?: number
  createdBy: ID
  createdAt: string
  paidAt?: string
}

export interface ApprovalRule {
  id: ID
  minAmount: number
  maxAmount: number
  chain: { name: string; approverRole: Role }[]
}

export interface AuditLog {
  id: ID
  at: string
  userId: ID
  userName: string
  action: string
  target: string
  targetType: string
  before?: unknown
  after?: unknown
  ip?: string
}

export interface Notification {
  id: ID
  at: string
  toUserId: ID
  type: 'todo' | 'result' | 'remind' | 'alert'
  title: string
  content: string
  refType?: string
  refId?: ID
  read: boolean
}

export interface DashboardStats {
  totalPRAmount: number
  totalPOAmount: number
  pendingApprovalCount: number
  pendingPutawayCount: number
  approvalOnTimeRate: number
  arrivalOnTimeRate: number
  supplierCount: number
  activePRCount: number
}
