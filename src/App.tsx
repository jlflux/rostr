import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store/store'
import { Shell } from './components/Shell'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import EventsPage from './pages/EventsPage'
import EventDetail from './pages/EventDetail'
import SponsorsPage from './pages/SponsorsPage'
import SponsorDetail from './pages/SponsorDetail'
import TeamsPage, { TeamDetail } from './pages/TeamsPage'
import RequestsPage, { RequestDetail } from './pages/RequestsPage'
import AssetsPage from './pages/AssetsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/sponsors/:id" element={<SponsorDetail />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </StoreProvider>
  )
}
