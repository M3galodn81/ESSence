import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import LeaveManagement from "@/pages/leave-management";
import Payslips from "@/pages/payslips";
import Schedules from "@/pages/schedules";
import Training from "@/pages/training";
import Documents from "@/pages/documents";
import TeamManagement from "@/pages/team-management";
import ReportsAnalytics from "@/pages/reports-analytics";
import Announcements from "@/pages/announcements";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout/main-layout";

function Router() {
  return (
    <Switch>
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
          <Payslips />
        </MainLayout>
      )} />
      <ProtectedRoute path="/schedules" component={() => (
        <MainLayout>
          <Schedules />
        </MainLayout>
      )} />
      <ProtectedRoute path="/training" component={() => (
        <MainLayout>
          <Training />
        </MainLayout>
      )} />
      <ProtectedRoute path="/documents" component={() => (
        <MainLayout>
          <Documents />
        </MainLayout>
      )} />
      <ProtectedRoute path="/team-management" component={() => (
        <MainLayout>
          <TeamManagement />
        </MainLayout>
      )} />
      <ProtectedRoute path="/reports-analytics" component={() => (
        <MainLayout>
          <ReportsAnalytics />
        </MainLayout>
      )} />
      <ProtectedRoute path="/announcements" component={() => (
        <MainLayout>
          <Announcements />
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
