# AGENTS.md

久大蓬盐采购管理系统（Purchase Management System · MVP）。React SPA + Express/TS 后端的全栈中后台，JSON 持久化，演示用。

## 技术栈

React 18 · TypeScript ~5.6 · Vite 6 · Tailwind 3.4 · React Router (Hash 模式) · lucide-react · class-variance-authority。后端 Node 22 + Express 4 + TypeScript，数据落地到 `.pms-data/db.json`（首次启动自动 seed）。

## 目录

```
src/                     前端
├── api/                 fetch 封装、X-Auth-Token 注入
├── components/          通用布局 + 页面 + ui 基础件
│   ├── ui/              Button/Card/Badge/Input/Modal/Table/Empty
│   ├── AuthProvider.tsx 登录态、meta 缓存与自动刷新
│   ├── Layout.tsx       顶栏、侧边菜单、通知铃铛
│   └── PageHeader.tsx
├── pages/               业务页面
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── PurchaseRequestsPage.tsx / PurchaseRequestDetailPage.tsx
│   ├── ApprovalsPage.tsx
│   ├── PurchaseOrdersPage.tsx / PurchaseOrderDetailPage.tsx
│   ├── ArrivalsPage.tsx
│   ├── PutawaysPage.tsx
│   ├── InvoicesPage.tsx
│   ├── PaymentsPage.tsx        （含对账汇总）
│   ├── SuppliersPage.tsx
│   ├── ContractsPage.tsx
│   ├── MasterDataPage.tsx      （物料、审批规则配置）
│   ├── AuditPage.tsx
│   └── ReportsPage.tsx
├── lib/                 cn/money/date/pct/round2/genId 工具
└── types/index.ts       前后端共享的领域类型（与 server/src/types.ts 对齐）

server/                  Express API
├── src/
│   ├── index.ts         入口：CORS、/api 路由、生产静态托管 dist/
│   ├── types.ts         领域类型
│   ├── store.ts         JSON 持久化、审计、通知、seed 数据
│   ├── middleware/auth.ts 认证、RBAC、字段脱敏
│   ├── services/util.ts 单号生成、审批链构建、金额计算
│   └── routes/api.ts    全部 REST 接口（认证/元数据/申请/审批/订单/到货/入库/发票/对账/付款/预留集成/通知/审计/看板/重置）
└── dist/                tsc 编译产物
```

## 路由（前端 Hash 路由）

`/login`、`/` 工作台、`/requests`、`/requests/:id`、`/approvals`、`/orders`、`/orders/:id`、`/arrivals`、`/putaways`、`/invoices`、`/payments`、`/suppliers`、`/contracts`、`/master-data`、`/audit`、`/reports`。

## 权限（RBAC 角色）

`applicant` 申请人、`dept_manager` 部门负责人、`purchaser` 采购专员、`purchase_mgr` 采购经理、`warehouse` 仓储、`finance` 财务、`finance_mgr` 财务主管、`leader` 分管领导、`admin` 系统管理员。

## 关键业务规则

- 单据编号 `{前缀}-yyyyMMdd-4位流水`，前缀：CGSQ 申请 / CGDD 订单 / DHDJ 到货 / RKD 入库 / FP 发票 / DZ 对账 / FK 付款 / SUP 供应商 / HT 合同。
- 审批链按金额匹配 `approvalRules`，节点角色为 dept_manager 时优先使用申请部门的 managerUserId，否则取该角色的任意用户。
- 供应商银行账号、联系人手机号对非财务/采购经理/管理员角色脱敏（仅后 4 位可见）。
- 发票三单匹配：按入库明细比对订单单价与数量；差异需财务主管填写说明后放行。
- 黑名单供应商禁止新订单选择；合格/有效合同才可选。
- 入库预留 API：`POST /api/integration/putaway-instruction`（admin）与 `POST /api/integration/putaway-callback`（公开，对接时加鉴权）。

## 验证命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` 或 `npx tsc -b --noEmit` | 前端类型检查 |
| `npm run lint` | ESLint（警告允许） |
| `npm run build` | 构建前端（dist/）+ 后端（server/dist/） |
| `npm --prefix server run build` | 后端 tsc 编译 |
| `npm run dev` | 并行启动前后端（前端 5173 代理 `/api` 到 3001） |

E2E 冒烟：启动后端后依次登录 zhangsan → 创建并提交申请 → lisi 审批同意 → wangwu 生成并下达订单（选供应商 s1）→ sunqi 登记到货、验收、入库 → zhouba 登记发票（全匹配）→ 对账 → 付款申请 → lisi 审批付款 → zhouba 登记付款，dashboard 总金额应等于订单含税金额。

## 不要做

- 不要引入额外的 UI 库或状态管理库（当前保持「React 内置 + fetch + lucide」组合）。
- 不要把 `.pms-data/` 纳入版本控制（重置入口由管理员页面提供）。
- 不要在前端硬编码业务规则/阈值（审批金额、税率、敏感字段规则在后端判定，前端只做友好校验与展示）。
- 不要改变 Hash 路由（兼容 `base: './'` 与 GitHub Pages 子路径部署/任意静态托管）。
