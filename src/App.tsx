import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, DashboardThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';

// Public pages — HomePage is loaded eagerly for instant first paint
import HomePage from './pages/public/HomePage';
const ActivitiesPage = lazy(() => import('./pages/public/ActivitiesPage'));
const ApplyPage = lazy(() => import('./pages/public/ApplyPage'));
const AuthPage = lazy(() => import('./pages/public/AuthPage'));
const EventRegisterPage = lazy(() => import('./pages/public/EventRegisterPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const PublicEventsPage = lazy(() => import('./pages/public/PublicEventsPage'));
const PublicSupportPage = lazy(() => import('./pages/public/PublicSupportPage'));
const GalleryPage = lazy(() => import('./pages/public/GalleryPage'));

// Auth flow pages
const ProfileSetupPage = lazy(() => import('./pages/auth/ProfileSetupPage'));
const PendingApprovalPage = lazy(() => import('./pages/auth/PendingApprovalPage'));

// Participant pages
import ParticipantRoute from './components/ParticipantRoute';
const ParticipantAuthPage = lazy(() => import('./pages/participant/ParticipantAuthPage'));
const ParticipantDashboardPage = lazy(() => import('./pages/participant/ParticipantDashboardPage'));

// Dashboard pages
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage'));
const EventsPage = lazy(() => import('./pages/dashboard/EventsPage'));
const EventDetailsPage = lazy(() => import('./pages/dashboard/EventDetailsPage'));
const CalendarPage = lazy(() => import('./pages/dashboard/CalendarPage'));
const AgendaPage = lazy(() => import('./pages/dashboard/AgendaPage'));
const TasksPage = lazy(() => import('./pages/dashboard/TasksPage'));
const ExplorePage = lazy(() => import('./pages/dashboard/ExplorePage'));
const QRScannerPage = lazy(() => import('./pages/dashboard/QRScannerPage'));
const SponsorsPage = lazy(() => import('./pages/dashboard/SponsorsPage'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const ManageParticipantsPage = lazy(() => import('./pages/dashboard/ManageParticipantsPage'));
const TeamsPage = lazy(() => import('./pages/dashboard/TeamsPage'));
const FilesPage = lazy(() => import('./pages/dashboard/FilesPage'));
const DocumentationPage = lazy(() => import('./pages/dashboard/DocumentationPage'));
const FinancePage = lazy(() => import('./pages/dashboard/FinancePage'));
const FinancialAnalyticsPage = lazy(() => import('./pages/dashboard/FinancialAnalyticsPage'));
const SupportPage = lazy(() => import('./pages/dashboard/SupportPage'));
const ControlCentrePage = lazy(() => import('./pages/dashboard/ControlCentrePage'));
const PositionsPage = lazy(() => import('./pages/dashboard/PositionsPage'));
const UserApprovalsPage = lazy(() => import('./pages/dashboard/UserApprovalsPage'));
const AccessControlPage = lazy(() => import('./pages/dashboard/AccessControlPage'));
const UserActivityPage = lazy(() => import('./pages/dashboard/UserActivityPage'));
const ManageApplicationsPage = lazy(() => import('./pages/dashboard/ManageApplicationsPage'));
const ArchivedApplicationsPage = lazy(() => import('./pages/dashboard/ArchivedApplicationsPage'));
const InterviewPanelsPage = lazy(() => import('./pages/dashboard/InterviewPanelsPage'));
const InterviewAllocationsPage = lazy(() => import('./pages/dashboard/InterviewAllocationsPage'));
const GDPanelsPage = lazy(() => import('./pages/dashboard/GDPanelsPage'));
const WinnersPage = lazy(() => import('./pages/dashboard/WinnersPage'));
const HomeImagesPage = lazy(() => import('./pages/dashboard/HomeImagesPage'));
const GalleryManagementPage = lazy(() => import('./pages/dashboard/GalleryPage'));
const SystemStatsPage = lazy(() => import('./pages/dashboard/SystemStatsPage'));
const DeploymentStatsPage = lazy(() => import('./pages/dashboard/DeploymentStatsPage'));
const UserInteractionsPage = lazy(() => import('./pages/dashboard/UserInteractionsPage'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
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
                <Route path="/gallery" element={<GalleryPage />} />
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
              <Route path="/participant-auth" element={<ParticipantAuthPage />} />
              <Route
                path="/participant"
                element={
                  <ParticipantRoute>
                    <ParticipantDashboardPage />
                  </ParticipantRoute>
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
                <Route path="sponsors" element={<SponsorsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="participants" element={<ManageParticipantsPage />} />
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
                <Route path="gallery" element={<GalleryManagementPage />} />
                <Route path="system-stats" element={<SystemStatsPage />} />
                <Route path="deployment-stats" element={<DeploymentStatsPage />} />
                <Route path="user-interactions" element={<UserInteractionsPage />} />
              </Route>

              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
