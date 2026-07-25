import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './store/store'
import { AuthProvider } from './lib/auth'
import { LoginGate } from './components/LoginGate'
import { Shell } from './components/Shell'
import { canView, type Section } from './lib/derive'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import EventsPage from './pages/EventsPage'
import EventDetail from './pages/EventDetail'
import SponsorsPage from './pages/SponsorsPage'
import SponsorDetail from './pages/SponsorDetail'
import TeamsPage, { TeamDetail } from './pages/TeamsPage'
import OpponentsPage from './pages/OpponentsPage'
import RequestsPage, { RequestDetail } from './pages/RequestsPage'
import AssetsPage from './pages/AssetsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

/** Redirect to the dashboard if the current user's role can't see this section. */
function Guard({ section, children }: { section: Section; children: React.ReactNode }) {
  const { state } = useStore()
  const me = state.users.find(u => u.id === state.currentUserId)!
  return canView(me.role, section) ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
      <BrowserRouter>
        <LoginGate>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Guard section="calendar"><CalendarPage /></Guard>} />
            <Route path="/events" element={<Guard section="events"><EventsPage /></Guard>} />
            <Route path="/events/:id" element={<Guard section="events"><EventDetail /></Guard>} />
            <Route path="/opponents" element={<Guard section="opponents"><OpponentsPage /></Guard>} />
            <Route path="/sponsors" element={<Guard section="sponsors"><SponsorsPage /></Guard>} />
            <Route path="/sponsors/:id" element={<Guard section="sponsors"><SponsorDetail /></Guard>} />
            <Route path="/teams" element={<Guard section="teams"><TeamsPage /></Guard>} />
            <Route path="/teams/:id" element={<Guard section="teams"><TeamDetail /></Guard>} />
            <Route path="/requests" element={<Guard section="requests"><RequestsPage /></Guard>} />
            <Route path="/requests/:id" element={<Guard section="requests"><RequestDetail /></Guard>} />
            <Route path="/assets" element={<Guard section="assets"><AssetsPage /></Guard>} />
            <Route path="/reports" element={<Guard section="reports"><ReportsPage /></Guard>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Shell>
        </LoginGate>
      </BrowserRouter>
      </AuthProvider>
    </StoreProvider>
  )
}
