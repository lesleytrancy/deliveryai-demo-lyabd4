import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PurchaseRequestsPage } from '@/pages/PurchaseRequestsPage'
import { PurchaseRequestDetailPage } from '@/pages/PurchaseRequestDetailPage'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { PurchaseOrderDetailPage } from '@/pages/PurchaseOrderDetailPage'
import { ArrivalsPage } from '@/pages/ArrivalsPage'
import { PutawaysPage } from '@/pages/PutawaysPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ContractsPage } from '@/pages/ContractsPage'
import { MasterDataPage } from '@/pages/MasterDataPage'
import { AuditPage } from '@/pages/AuditPage'
import { ReportsPage } from '@/pages/ReportsPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-10 text-center text-slate-400">加载中…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
      <Route path="/requests" element={<RequireAuth><Layout><PurchaseRequestsPage /></Layout></RequireAuth>} />
      <Route path="/requests/:id" element={<RequireAuth><Layout><PurchaseRequestDetailPage /></Layout></RequireAuth>} />
      <Route path="/approvals" element={<RequireAuth><Layout><ApprovalsPage /></Layout></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><Layout><PurchaseOrdersPage /></Layout></RequireAuth>} />
      <Route path="/orders/:id" element={<RequireAuth><Layout><PurchaseOrderDetailPage /></Layout></RequireAuth>} />
      <Route path="/arrivals" element={<RequireAuth><Layout><ArrivalsPage /></Layout></RequireAuth>} />
      <Route path="/putaways" element={<RequireAuth><Layout><PutawaysPage /></Layout></RequireAuth>} />
      <Route path="/invoices" element={<RequireAuth><Layout><InvoicesPage /></Layout></RequireAuth>} />
      <Route path="/payments" element={<RequireAuth><Layout><PaymentsPage /></Layout></RequireAuth>} />
      <Route path="/suppliers" element={<RequireAuth><Layout><SuppliersPage /></Layout></RequireAuth>} />
      <Route path="/contracts" element={<RequireAuth><Layout><ContractsPage /></Layout></RequireAuth>} />
      <Route path="/master-data" element={<RequireAuth><Layout><MasterDataPage /></Layout></RequireAuth>} />
      <Route path="/audit" element={<RequireAuth><Layout><AuditPage /></Layout></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><Layout><ReportsPage /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// 使用 HashRouter 以兼容 GitHub Pages/base './' 部署
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  )
}
