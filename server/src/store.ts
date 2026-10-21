import type {
  User, Department, CostCenter, Material, MaterialCategory, Currency, TaxRate, PaymentTerm,
  Supplier, Contract, PurchaseRequest, PurchaseOrder, Arrival, PutawayRecord, Invoice,
  Reconciliation, PaymentRequest, ApprovalRule, AuditLog, Notification
} from './types.js'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.PMS_DATA_DIR || (__dirname + '/../../.pms-data')
const DB_FILE = DATA_DIR + '/db.json'

export interface DB {
  users: User[]
  departments: Department[]
  costCenters: CostCenter[]
  materialCategories: MaterialCategory[]
  materials: Material[]
  currencies: Currency[]
  taxRates: TaxRate[]
  paymentTerms: PaymentTerm[]
  suppliers: Supplier[]
  contracts: Contract[]
  purchaseRequests: PurchaseRequest[]
  purchaseOrders: PurchaseOrder[]
  arrivals: Arrival[]
  putaways: PutawayRecord[]
  invoices: Invoice[]
  reconciliations: Reconciliation[]
  paymentRequests: PaymentRequest[]
  approvalRules: ApprovalRule[]
  auditLogs: AuditLog[]
  notifications: Notification[]
  seq: Record<string, number>
  sessions: Record<string, { userId: string; createdAt: string }>
}

let db: DB

function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function seqNo(type: string): string {
  db.seq[type] = (db.seq[type] || 0) + 1
  return String(db.seq[type]).padStart(4, '0')
}

function persist() {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  } catch (e) {
    console.warn('[pms] persist failed:', e)
  }
}

function seed(): DB {
  const now = new Date().toISOString()
  const users: User[] = [
    { id: 'u_admin', username: 'admin', name: '系统管理员', password: '123456', role: 'admin' },
    { id: 'u_zhang', username: 'zhangsan', name: '张三', password: '123456', role: 'applicant', departmentId: 'd1' },
    { id: 'u_lisi', username: 'lisi', name: '李四（部门负责人）', password: '123456', role: 'dept_manager', departmentId: 'd1' },
    { id: 'u_wang', username: 'wangwu', name: '王五（采购专员）', password: '123456', role: 'purchaser' },
    { id: 'u_zhao', username: 'zhaoliu', name: '赵六（采购经理）', password: '123456', role: 'purchase_mgr' },
    { id: 'u_sun', username: 'sunqi', name: '孙七（仓储）', password: '123456', role: 'warehouse' },
    { id: 'u_zhou', username: 'zhouba', name: '周八（财务）', password: '123456', role: 'finance' },
    { id: 'u_wu', username: 'wujiu', name: '吴九（财务主管）', password: '123456', role: 'finance_mgr' },
    { id: 'u_qian', username: 'qinshi', name: '钱十（分管领导）', password: '123456', role: 'leader' },
  ]
  return {
    users,
    departments: [
      { id: 'd1', name: '生产部', managerUserId: 'u_lisi' },
      { id: 'd2', name: '行政部' },
      { id: 'd3', name: '采购部' },
    ],
    costCenters: [
      { id: 'cc1', code: 'CC-001', name: '生产一车间' },
      { id: 'cc2', code: 'CC-002', name: '行政综合' },
    ],
    materialCategories: [
      { id: 'mc1', code: 'RAW', name: '生产原料' },
      { id: 'mc2', code: 'PACK', name: '包装材料' },
      { id: 'mc3', code: 'LABOR', name: '劳保用品' },
      { id: 'mc4', code: 'EQUIP', name: '设备配件' },
      { id: 'mc5', code: 'OFFICE', name: '办公用品' },
    ],
    materials: [
      { id: 'm1', code: 'MAT-0001', name: '工业盐（原料）', spec: '一等品 50kg/袋', unit: '吨', categoryId: 'mc1', defaultTaxRate: 0.13, active: true },
      { id: 'm2', code: 'MAT-0002', name: '碘酸钾添加剂', spec: '食品级', unit: 'kg', categoryId: 'mc1', defaultTaxRate: 0.13, active: true },
      { id: 'm3', code: 'MAT-0003', name: '编织包装袋', spec: '50kg', unit: '个', categoryId: 'mc2', defaultTaxRate: 0.13, active: true },
      { id: 'm4', code: 'MAT-0004', name: '劳保手套', spec: '防滑', unit: '副', categoryId: 'mc3', defaultTaxRate: 0.13, active: true },
      { id: 'm5', code: 'MAT-0005', name: '打印纸A4', spec: '70g', unit: '包', categoryId: 'mc5', defaultTaxRate: 0.13, active: true },
    ],
    currencies: [{ id: 'c1', code: 'CNY', name: '人民币', rate: 1 }],
    taxRates: [
      { id: 't1', name: '13% 增值税', rate: 0.13 },
      { id: 't2', name: '9% 增值税', rate: 0.09 },
      { id: 't3', name: '6% 增值税', rate: 0.06 },
    ],
    paymentTerms: [
      { id: 'pt1', code: 'PRE', name: '预付', days: 0 },
      { id: 'pt2', code: 'NET30', name: '月结30天', days: 30 },
      { id: 'pt3', code: 'NET60', name: '月结60天', days: 60 },
    ],
    suppliers: [
      {
        id: 's1', code: 'SUP-0001', name: '四川久大盐业原料供应有限公司', shortName: '久大原料',
        uscc: '91510300MA00000001', contactName: '陈经理', contactPhone: '13800000001',
        categoryIds: ['mc1'], bankName: '工商银行自贡分行', bankAccount: '6222020000000000001',
        taxpayerType: '一般纳税人', status: 'qualified', rating: 'A',
        qualificationExpireAt: '2027-12-31', createdAt: now, updatedAt: now, address: '四川省自贡市'
      },
      {
        id: 's2', code: 'SUP-0002', name: '自贡包装材料厂', shortName: '自贡包装',
        uscc: '91510300MA00000002', contactName: '刘主任', contactPhone: '13800000002',
        categoryIds: ['mc2'], status: 'qualified', rating: 'B',
        createdAt: now, updatedAt: now
      },
    ],
    contracts: [],
    purchaseRequests: [],
    purchaseOrders: [],
    arrivals: [],
    putaways: [],
    invoices: [],
    reconciliations: [],
    paymentRequests: [],
    approvalRules: [
      { id: 'r1', minAmount: 0, maxAmount: 10000, chain: [
        { name: '部门负责人', approverRole: 'dept_manager' }
      ]},
      { id: 'r2', minAmount: 10000, maxAmount: 100000, chain: [
        { name: '部门负责人', approverRole: 'dept_manager' },
        { name: '采购经理', approverRole: 'purchase_mgr' },
        { name: '财务', approverRole: 'finance' }
      ]},
      { id: 'r3', minAmount: 100000, maxAmount: 999999999, chain: [
        { name: '部门负责人', approverRole: 'dept_manager' },
        { name: '采购经理', approverRole: 'purchase_mgr' },
        { name: '财务', approverRole: 'finance' },
        { name: '分管领导', approverRole: 'leader' }
      ]},
    ],
    auditLogs: [],
    notifications: [],
    seq: { PR: 0, PO: 0, ARR: 0, PW: 0, INV: 0, REC: 0, PAY: 0, SUP: 0, MAT: 0, CT: 0 },
    sessions: {},
  }
}

export function initStore() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(DB_FILE)) {
    try {
      db = JSON.parse(readFileSync(DB_FILE, 'utf-8'))
      return db
    } catch (e) {
      console.warn('[pms] db parse failed, re-seeding:', e)
    }
  }
  db = seed()
  persist()
  return db
}

export function getDB(): DB { return db }
export function save() { persist() }
export function newId(prefix = ''): string { return uid(prefix) }
export function nextSeq(type: string): string { return seqNo(type) }

export function resetDB() {
  db = seed()
  persist()
}

export function addAudit(entry: Omit<AuditLog, 'id' | 'at'>) {
  db.auditLogs.unshift({ id: newId('log_'), at: new Date().toISOString(), ...entry })
  if (db.auditLogs.length > 2000) db.auditLogs.length = 2000
}

export function notify(userId: string, type: Notification['type'], title: string, content: string, refType?: string, refId?: string) {
  db.notifications.unshift({
    id: newId('n_'), at: new Date().toISOString(), toUserId: userId, type, title, content, refType, refId, read: false,
  })
  if (db.notifications.length > 1000) db.notifications.length = 1000
}
