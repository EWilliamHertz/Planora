import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import AuthCallback from "@/pages/AuthCallback";
import DashboardPage from "@/pages/DashboardPage";
import AvailabilityPage from "@/pages/AvailabilityPage";
import BookingPage from "@/pages/BookingPage";
import SettingsPage from "@/pages/SettingsPage";
import SharePage from "@/pages/SharePage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SharedCalendarPage from "@/pages/SharedCalendarPage";
import TeamsPage from "@/pages/TeamsPage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";

// The White-Screen Catcher
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#fff', color: '#ff0000', height: '100vh' }}>
          <h2>A Fatal React Error Occurred (Caught by ErrorBoundary)</h2>
          <pre style={{ background: '#fee', padding: '1rem', overflow: 'auto' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <p>Please copy this error text to fix the Private Window bug.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/book/:userId" element={<BookingPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/shared/:userId" element={<SharedCalendarPage />} />
          <Route path="/teams" element={<TeamsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;