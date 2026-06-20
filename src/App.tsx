import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { authStore } from './store'
import { useStore } from './hooks/useStore'

// Lazy-load pages for better performance
const SignIn          = lazy(() => import('./pages/SignIn'))
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const RequestList     = lazy(() => import('./pages/RequestList'))
const WizardStepType  = lazy(() => import('./pages/wizard/WizardStepType'))
const Wizard          = lazy(() => import('./pages/wizard/Wizard'))
const TicketWorkspace = lazy(() => import('./pages/TicketWorkspace'))
const ReturnedResponse = lazy(() => import('./pages/ReturnedResponse'))
const ReviewerQueue   = lazy(() => import('./pages/ReviewerQueue'))
const PolicyLibrary   = lazy(() => import('./pages/PolicyLibrary'))
const PolicyViewer    = lazy(() => import('./pages/PolicyViewer'))
const VendorLibrary   = lazy(() => import('./pages/VendorLibrary'))
const VendorProfile   = lazy(() => import('./pages/VendorProfile'))
const ProjectLibrary  = lazy(() => import('./pages/ProjectLibrary'))
const ProjectProfile  = lazy(() => import('./pages/ProjectProfile'))
const AuditLedger     = lazy(() => import('./pages/AuditLedger'))
const NotifCenter     = lazy(() => import('./pages/NotificationCenter'))
const Admin           = lazy(() => import('./pages/Admin'))
const ExternalRedeem  = lazy(() => import('./pages/ExternalRedeem'))
const ExternalApproval = lazy(() => import('./pages/ExternalApproval'))
const Architecture    = lazy(() => import('./pages/Architecture'))
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))
const DocumentLibrary = lazy(() => import('./pages/DocumentLibrary'))
const TemplatesLibrary = lazy(() => import('./pages/TemplatesLibrary'))
const ChangePassword  = lazy(() => import('./pages/ChangePassword'))
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'))
const Settings = lazy(() => import('./pages/Settings'))
const ExternalDashboard = lazy(() => import('./pages/ExternalDashboard'))
const NotFound        = lazy(() => import('./pages/NotFound'))
const Profile         = lazy(() => import('./pages/Profile'))

function PageSkeleton() {
  return (
    <div style={{ padding: 40 }}>
      {[200, 120, 80, 160, 100].map((w, i) => (
        <div key={i} className="skel" style={{ height: 14, width: w, marginBottom: 12 }} aria-hidden="true" />
      ))}
    </div>
  )
}

function RootRedirect() {
  const { user, isSignedIn } = useStore(authStore)
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  if (user.role === 'external_recipient') return <Navigate to="/external-portal" replace />
  if (user.role === 'data_management' || user.role === 'legal' || user.role === 'security') {
    return <Navigate to={`/queue/${user.role}`} replace />
  }
  return <Navigate to="/dashboard" replace />
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useStore(authStore)
  const location = useLocation()
  if (!isSignedIn) return <Navigate to="/sign-in" state={{ from: location }} replace />
  return <>{children}</>
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { document.querySelector('#main-content')?.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <Layout>
      <ScrollTop />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/external/redeem/:token" element={<ExternalRedeem />} />
          <Route path="/external/approval/:token" element={<ExternalApproval />} />

          {/* Auth-gated */}
          <Route path="/" element={<RequireAuth><RootRedirect /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

          {/* Requests */}
          <Route path="/requests" element={<RequireAuth><RequestList /></RequireAuth>} />
          <Route path="/requests/new" element={<RequireAuth><WizardStepType /></RequireAuth>} />
          <Route path="/requests/new/:type/:method" element={<RequireAuth><Wizard /></RequireAuth>} />
          <Route path="/requests/:id" element={<RequireAuth><TicketWorkspace /></RequireAuth>} />
          <Route path="/requests/:id/respond" element={<RequireAuth><ReturnedResponse /></RequireAuth>} />

          {/* Queues */}
          <Route path="/queue" element={<RequireAuth><Navigate to="/queue/data_management" replace /></RequireAuth>} />
          <Route path="/queue/:role" element={<RequireAuth><ReviewerQueue /></RequireAuth>} />

          {/* Libraries */}
          <Route path="/policies" element={<RequireAuth><PolicyLibrary /></RequireAuth>} />
          <Route path="/policies/:id" element={<RequireAuth><PolicyViewer /></RequireAuth>} />
          <Route path="/vendors" element={<RequireAuth><VendorLibrary /></RequireAuth>} />
          <Route path="/vendors/:id" element={<RequireAuth><VendorProfile /></RequireAuth>} />
          <Route path="/projects" element={<RequireAuth><ProjectLibrary /></RequireAuth>} />
          <Route path="/projects/:id" element={<RequireAuth><ProjectProfile /></RequireAuth>} />

          {/* Audit + Notifs */}
          <Route path="/audit" element={<RequireAuth><AuditLedger /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotifCenter /></RequireAuth>} />

          {/* Libraries */}
          <Route path="/documents" element={<RequireAuth><DocumentLibrary /></RequireAuth>} />
          <Route path="/templates" element={<RequireAuth><TemplatesLibrary /></RequireAuth>} />

          {/* User account */}
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/notifications/preferences" element={<RequireAuth><NotificationPreferences /></RequireAuth>} />
          <Route path="/external-portal" element={<RequireAuth><ExternalDashboard /></RequireAuth>} />

          {/* Admin */}
          <Route path="/admin" element={<RequireAuth><Admin tab="home" /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth><Admin tab="users" /></RequireAuth>} />
          <Route path="/admin/roles" element={<RequireAuth><Admin tab="roles" /></RequireAuth>} />
          <Route path="/admin/policies" element={<RequireAuth><Admin tab="policies" /></RequireAuth>} />
          <Route path="/admin/tickets" element={<RequireAuth><Admin tab="tickets" /></RequireAuth>} />
          <Route path="/admin/retention" element={<RequireAuth><Admin tab="retention" /></RequireAuth>} />
          <Route path="/admin/ai" element={<RequireAuth><Admin tab="ai" /></RequireAuth>} />
          <Route path="/admin/audit-access" element={<RequireAuth><Admin tab="audit" /></RequireAuth>} />
          <Route path="/admin/settings" element={<RequireAuth><Admin tab="settings" /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

          {/* Architecture deliverable */}
          <Route path="/architecture" element={<RequireAuth><Architecture /></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
