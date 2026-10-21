import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardBody } from '@/components/ui/Card'

export function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [username, setU] = useState('zhangsan')
  const [password, setP] = useState('123456')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setLoading(true)
    try { await login(username, password); nav('/') }
    catch (e: any) { setErr(e.message || '登录失败') }
    finally { setLoading(false) }
  }

  const accounts = [
    ['zhangsan', '申请人 张三'], ['lisi', '部门负责人 李四'], ['wangwu', '采购专员 王五'],
    ['zhaoliu', '采购经理 赵六'], ['sunqi', '仓储 孙七'], ['zhouba', '财务 周八'],
    ['wujiu', '财务主管 吴九'], ['qinshi', '分管领导 钱十'], ['admin', '管理员'],
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 items-center">
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold text-xl">盐</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">久大蓬盐采购管理系统</h1>
              <p className="text-sm text-slate-500">Purchase Management System · MVP</p>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed">覆盖采购申请、多级审批、订单管理、供应商协同、到货验收、入库、发票对账结算全流程线上化闭环。</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>✓ 采购申请 → 审批 → 下单 → 到货 → 验收入库 → 对账付款 主流程端到端跑通</li>
            <li>✓ 供应商准入/评级/黑名单、基础数据、合同台账</li>
            <li>✓ 金额分级可配置审批流、SLA 通知、RBAC 权限隔离、审计日志</li>
            <li>✓ 入库预留 API、报表看板、敏感字段脱敏</li>
          </ul>
        </div>
        <Card>
          <CardBody className="p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-1">登录</h2>
            <p className="text-sm text-slate-500 mb-6">请使用分配的账号进入系统（演示账号密码均为 123456）</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">用户名</label>
                <Input value={username} onChange={e => setU(e.target.value)} placeholder="用户名" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">密码</label>
                <Input type="password" value={password} onChange={e => setP(e.target.value)} placeholder="密码" />
              </div>
              {err && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>}
              <Button className="w-full" size="md" disabled={loading}>{loading ? '登录中…' : '登 录'}</Button>
            </form>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400 mb-2">快速登录演示账号：</div>
              <div className="grid grid-cols-2 gap-1">
                {accounts.map(([u, label]) => (
                  <button key={u} type="button" className="text-xs text-left text-indigo-600 hover:underline" onClick={() => setU(u)}>
                    · {label} <span className="text-slate-400">({u})</span>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
