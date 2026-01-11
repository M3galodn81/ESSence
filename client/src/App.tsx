import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import SetupWizard from "@/pages/setup-wizard";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import LeaveManagement from "@/pages/leave-management";
import PayslipsEnhanced from "@/pages/payslips-enhanced";
import PayslipManagement from "./pages/payslip-management";
import SalaryComputation from "@/pages/salary-computation";
import Schedules from "@/pages/schedules";
import ShiftManagement from "@/pages/shift-management";
import TeamManagement from "@/pages/team-management";
import Announcements from "@/pages/announcements";
import Reports from "@/pages/reports";
import LaborCostAnalytics from "@/pages/labor-cost-analytics";
import UserManagement from "@/pages/user-management";
import TimeClock from "@/pages/time-clock";
import Attendance from "@/pages/attendances";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout/main-layout";
import PayslipHistory from "@/pages/payslip-history";
import AdminAttendance from "@/pages/admin-attendance";
import HolidayCalendar from "@/pages/holiday-calendar";

function Router() {
  const { needsSetup, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupWizard />;
  }

  return (
    <Switch>
      <Route path="/setup" component={SetupWizard} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={() => (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      )} />
      <ProtectedRoute path="/profile" component={() => (
        <MainLayout>
          <Profile />
        </MainLayout>
      )} />
      <ProtectedRoute path="/leave-management" component={() => (
        <MainLayout>
          <LeaveManagement />
        </MainLayout>
      )} />
      <ProtectedRoute path="/payslips" component={() => (
        <MainLayout>
          <PayslipsEnhanced />
        </MainLayout>
      )} />

      <ProtectedRoute path="/payslip-history" component={() => (
        <MainLayout>
          <PayslipHistory />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/salary-computation" component={() => (
        <MainLayout>
          <SalaryComputation />
        </MainLayout>
      )} />
      <ProtectedRoute path="/schedules" component={() => (
        <MainLayout>
          <Schedules />
        </MainLayout>
      )} />
      <ProtectedRoute path="/time-clock" component={() => (
        <MainLayout>
          <TimeClock />
        </MainLayout>
      )} />
      <ProtectedRoute path="/attendance" component={() => (
        <MainLayout>
          <Attendance />
        </MainLayout>
      )} />
      <ProtectedRoute path="/shift-management" component={() => (
        <MainLayout>
          <ShiftManagement />
        </MainLayout>
      )} />
      <ProtectedRoute path="/team-management" component={() => (
        <MainLayout>
          <TeamManagement />
        </MainLayout>
      )} />
      <ProtectedRoute path="/reports" component={() => (
        <MainLayout>
          <Reports />
        </MainLayout>
      )} />
      <ProtectedRoute path="/payroll-management" component={() => (
        <MainLayout>
          <PayslipManagement />
        </MainLayout>
      )} />
      <ProtectedRoute path="/labor-cost-analytics" component={() => (
        <MainLayout>
          <LaborCostAnalytics />
        </MainLayout>
      )} />
      <ProtectedRoute path="/announcements" component={() => (
        <MainLayout>
          <Announcements />
        </MainLayout>
      )} />
      <ProtectedRoute path="/user-management" component={() => (
        <MainLayout>
          <UserManagement />
        </MainLayout>
      )} />

      <ProtectedRoute path="/admin-attendance" component={() => (
        <MainLayout>
          <AdminAttendance />
        </MainLayout>
      )} />
      <ProtectedRoute path="/holiday-calendar" component={() => (
        <MainLayout>
          <HolidayCalendar />
        </MainLayout>
      )} />

      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
