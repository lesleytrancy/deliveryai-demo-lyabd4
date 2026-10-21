import type { ApprovalNode, ApprovalRule, Role } from '../types.js'
import { getDB, newId } from '../store.js'

export function genCode(prefix: string, seqType: string): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const db = getDB()
  db.seq[seqType] = (db.seq[seqType] || 0) + 1
  const seq = String(db.seq[seqType]).padStart(4, '0')
  return `${prefix}-${ymd}-${seq}`
}

export function round2(n: number): number { return Math.round(n * 100) / 100 }

export function lineAmount(qty: number, unitPrice: number, taxRate: number): number {
  return round2(qty * unitPrice * (1 + taxRate))
}

export function pickRule(amount: number): ApprovalRule | undefined {
  const db = getDB()
  return db.approvalRules.find(r => amount >= r.minAmount && amount < r.maxAmount)
}

export function buildApprovalNodes(rule: ApprovalRule): ApprovalNode[] {
  return rule.chain.map((c, i) => ({
    id: newId('an_'),
    order: i,
    name: c.name,
    approverRole: c.approverRole as Role,
    status: 'pending' as const,
  }))
}

// 基于角色从部门/用户中找审批人（简化：任一该角色的用户即可审批；部门负责人匹配当前申请部门）
export function findApproverCandidates(node: ApprovalNode, departmentId?: string): string[] {
  const db = getDB()
  if (node.approverRole === 'dept_manager' && departmentId) {
    const dept = db.departments.find(d => d.id === departmentId)
    if (dept?.managerUserId) return [dept.managerUserId]
  }
  return db.users.filter(u => u.role === node.approverRole).map(u => u.id)
}
