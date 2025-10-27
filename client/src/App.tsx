import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import SetupWizard from "@/pages/setup-wizard";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import LeaveManagement from "@/pages/leave-management";
import PayslipsEnhanced from "@/pages/payslips-enhanced";
import PayslipMobile from "@/pages/payslip-mobile";
import SalaryComputation from "@/pages/salary-computation";
import Schedules from "@/pages/schedules";
import ShiftManagement from "@/pages/shift-management";
import TeamManagement from "@/pages/team-management";
import ReportsAnalytics from "@/pages/reports-analytics";
import Announcements from "@/pages/announcements";
import Reports from "@/pages/reports";
import LaborCostAnalytics from "@/pages/labor-cost-analytics";
import UserManagement from "@/pages/user-management";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout/main-layout";

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
      <ProtectedRoute path="/payslip-mobile" component={() => (
        <PayslipMobile />
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
      <ProtectedRoute path="/reports-analytics" component={() => (
        <MainLayout>
          <ReportsAnalytics />
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
