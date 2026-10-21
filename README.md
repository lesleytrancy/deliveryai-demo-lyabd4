# 久大蓬盐采购管理系统（初版 MVP）

覆盖采购申请、多级审批、采购订单、供应商管理、到货验收、入库、发票对账结算的端到端采购业务闭环。

## 技术栈

- **前端**：React 18 + TypeScript + Vite 6 + Tailwind CSS 3.4 + React Router（Hash 模式）+ lucide-react
- **后端**：Node.js + Express + TypeScript（JSON 文件持久化到 `.pms-data/db.json`，便于演示与快速启动；生产可替换为数据库）
- **认证**：账号密码登录，Token 会话，RBAC 角色权限
- **演示模式**：预置 9 个角色账号、2 家合格供应商、5 个物料、3 级金额审批规则

## 目录结构

```
src/            # 前端 SPA（登录、工作台、各业务页面、通用组件、API 封装）
server/         # Express 后端（路由、服务、内存+JSON持久化、权限中间件）
server/src/routes/api.ts   # 全部业务 REST API
.pms-data/      # 运行时数据（自动生成，.gitignore）
dist/           # 前端构建产物，由后端在生产模式直接托管
```

## 快速启动

```bash
npm install
npm install --prefix server
npm run dev   # 同时启动后端（:3001）与前端 Vite 开发服务器（:5173，已配置代理 /api）
```

访问 http://localhost:5173 （Vite dev）或构建后 `npm run build && npm --prefix server run start` 访问 http://localhost:3001。

## 演示账号（密码均为 `123456`）

| 用户名 | 角色 |
| --- | --- |
| admin | 系统管理员（含「重置演示」入口） |
| zhangsan | 申请人 张三 |
| lisi | 部门负责人 李四 |
| wangwu | 采购专员 王五 |
| zhaoliu | 采购经理 赵六 |
| sunqi | 仓储 孙七 |
| zhouba | 财务 周八 |
| wujiu | 财务主管 吴九 |
| qinshi | 分管领导 钱十 |

## 主流程（端到端可跑通）

申请人创建申请单 → 提交审批（按金额分级自动匹配审批链）→ 各级审批人同意 → 采购专员从申请单生成订单、选择供应商并下达 → 仓储登记到货 → 仓储验收（合格/不合格可登记异常）→ 仓储确认入库（并保留外部仓储系统 `POST /api/integration/putaway-instruction` 与 callback 占位接口）→ 财务登记发票触发三单匹配 → （可选）差异经财务主管确认 → 生成对账单 → 发起付款申请 → 付款审批 → 登记付款。

## 预置审批规则（可在「基础数据」页面修改，无需改代码）

- ¥0 – ¥10,000：部门负责人
- ¥10,000 – ¥100,000：部门负责人 → 采购经理 → 财务
- ¥100,000 以上：部门负责人 → 采购经理 → 财务 → 分管领导

## 核心功能清单（对照 Spec REQ）

- REQ-001 采购申请创建/提交/草稿/撤回：✅
- REQ-002 多级审批流（金额分级可配置，同意/驳回/转交/意见/审计）：✅
- REQ-003 采购订单（生成/编辑/下达/关闭，金额/税额/状态机）：✅
- REQ-004 供应商管理（准入/评级/黑名单，敏感字段脱敏）：✅
- REQ-005 合同台账：✅
- REQ-006 到货登记/验收/异常（不合格原因、超量校验）：✅
- REQ-007 入库（模式A：系统内确认入库；模式B：预留 REST API `/api/integration/putaway-instruction` 与 callback）：✅
- REQ-008 发票登记、三单匹配（数量/金额差异提示+主管确认）、对账、付款申请+付款审批流：✅
- REQ-009 基础数据（物料/品类/部门/成本中心/币种/税率/付款条件/用户/审批规则）：✅
- REQ-010 通知（站内信 bell、实时轮询刷新、按事件触发）：✅
- REQ-011 RBAC 权限隔离、审计日志、敏感字段脱敏（手机号/银行账号）：✅
- 报表看板（采购金额、订单/申请状态分布、供应商 TOP、及时率）：✅

## 预留接口

- `POST /api/integration/putaway-instruction`：向外部仓储推送入库指令（需 admin token）
- `POST /api/integration/putaway-callback`：外部仓储回传入库结果（当前仅回显，对接时可补业务逻辑）

## 开发脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 并行启动前后端开发服务 |
| `npm run build` | 同时构建前端（`dist/`）与后端（`server/dist/`） |
| `npm run build:web` / `build:server` | 分别构建前后端 |
| `npm run lint` | ESLint（仅前端，允许警告） |
| `npm run typecheck` | `tsc -b --noEmit` 类型检查 |
| `npm --prefix server run dev` | 后端热更新开发 |
| `npm --prefix server run start` | 生产模式启动（托管前端 `dist/`） |
