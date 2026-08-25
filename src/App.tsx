import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, DashboardThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';

// Public pages
import HomePage from './pages/public/HomePage';
import ActivitiesPage from './pages/public/ActivitiesPage';
import ApplyPage from './pages/public/ApplyPage';
import AuthPage from './pages/public/AuthPage';
import EventRegisterPage from './pages/public/EventRegisterPage';
import AboutPage from './pages/public/AboutPage';

// Auth flow pages
import ProfileSetupPage from './pages/auth/ProfileSetupPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';

// Dashboard pages
import DashboardHome from './pages/dashboard/DashboardHome';
import ProfilePage from './pages/dashboard/ProfilePage';
import EventsPage from './pages/dashboard/EventsPage';
import EventDetailsPage from './pages/dashboard/EventDetailsPage';
import CalendarPage from './pages/dashboard/CalendarPage';
import AgendaPage from './pages/dashboard/AgendaPage';
import TasksPage from './pages/dashboard/TasksPage';
import ExplorePage from './pages/dashboard/ExplorePage';
import QRScannerPage from './pages/dashboard/QRScannerPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import TeamsPage from './pages/dashboard/TeamsPage';
import FilesPage from './pages/dashboard/FilesPage';
import DocumentationPage from './pages/dashboard/DocumentationPage';
import FinancePage from './pages/dashboard/FinancePage';
import FinancialAnalyticsPage from './pages/dashboard/FinancialAnalyticsPage';
import ControlCentrePage from './pages/dashboard/ControlCentrePage';
import PositionsPage from './pages/dashboard/PositionsPage';
import UserApprovalsPage from './pages/dashboard/UserApprovalsPage';
import AccessControlPage from './pages/dashboard/AccessControlPage';
import UserActivityPage from './pages/dashboard/UserActivityPage';
import ManageApplicationsPage from './pages/dashboard/ManageApplicationsPage';
import ArchivedApplicationsPage from './pages/dashboard/ArchivedApplicationsPage';
import InterviewPanelsPage from './pages/dashboard/InterviewPanelsPage';
import InterviewAllocationsPage from './pages/dashboard/InterviewAllocationsPage';
import GDPanelsPage from './pages/dashboard/GDPanelsPage';
import HomeImagesPage from './pages/dashboard/HomeImagesPage';
import WinnersPage from './pages/dashboard/WinnersPage';
import PublicEventsPage from './pages/public/PublicEventsPage';
import PublicSupportPage from './pages/public/PublicSupportPage';
import DeploymentStatsPage from './pages/dashboard/DeploymentStatsPage';
import UserInteractionsPage from './pages/dashboard/UserInteractionsPage';
import SystemStatsPage from './pages/dashboard/SystemStatsPage';
import SupportPage from './pages/dashboard/SupportPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Public Pages with standard Light/Dark Theme */}
          <Route
            element={
              <ThemeProvider>
                <PublicLayout />
              </ThemeProvider>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/events" element={<PublicEventsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/support" element={<PublicSupportPage />} />
            <Route path="/events/:eventId/register" element={<EventRegisterPage />} />
          </Route>

          {/* Authentication Pages (Standalone) */}
          <Route
            path="/login"
            element={
              <ThemeProvider>
                <AuthPage />
              </ThemeProvider>
            }
          />
          <Route
            path="/pending-approval"
            element={
              <ThemeProvider>
                <PendingApprovalPage />
              </ThemeProvider>
            }
          />
          
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute requireApproved={false}>
                <ThemeProvider>
                  <ProfileSetupPage />
                </ThemeProvider>
              </ProtectedRoute>
            }
          />

          {/* Protected Dashboard Pages with Dark-focused Dashboard Theme */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireApproved={true}>
                <DashboardThemeProvider>
                  <DashboardLayout />
                </DashboardThemeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:eventId" element={<EventDetailsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="qr-scanner" element={<QRScannerPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="documentation" element={<DocumentationPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="financial-analytics" element={<FinancialAnalyticsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="control-centre" element={<ControlCentrePage />} />
            <Route path="positions" element={<PositionsPage />} />
            <Route path="user-approvals" element={<UserApprovalsPage />} />
            <Route path="access-control" element={<AccessControlPage />} />
            <Route path="monitor-activity" element={<UserActivityPage />} />
            <Route path="manage-applications" element={<ManageApplicationsPage />} />
            <Route path="archived-applications" element={<ArchivedApplicationsPage />} />
            <Route path="interview-panels" element={<InterviewPanelsPage />} />
            <Route path="gd-panels" element={<GDPanelsPage />} />
            <Route path="interview-allocations" element={<InterviewAllocationsPage />} />
            <Route path="winners" element={<WinnersPage />} />
            <Route path="home-images" element={<HomeImagesPage />} />
            <Route path="system-stats" element={<SystemStatsPage />} />
            <Route path="deployment-stats" element={<DeploymentStatsPage />} />
            <Route path="user-interactions" element={<UserInteractionsPage />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
