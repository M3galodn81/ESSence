import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission"; 
import { Permission } from "@/lib/permissions";         
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home, User, Calendar, FileText, Clock, Users,
  Megaphone, LogOut, Settings, AlertTriangle,
  PhilippinePeso, UserPlus, Timer, Briefcase
} from "lucide-react";
import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Accept the state from MainLayout
interface SidebarProps {
  className?: string;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/announcements", label: "Announcements", icon: Megaphone, permission: Permission.VIEW_ANNOUNCEMENTS },
  { path: "/time-clock", label: "Time Clock", icon: Timer, permission: Permission.SUBMIT_ATTENDANCE },
  { path: "/attendance", label: "Attendance Logs", icon: FileText, permission: Permission.VIEW_OWN_ATTENDANCE },
  { path: "/leave-management", label: "Leave Requests", icon: Calendar, permission: Permission.VIEW_OWN_LEAVES },
  { path: "/payslips", label: "My Payslips", icon: PhilippinePeso, permission: Permission.VIEW_OWN_PAYSLIP },
  { path: "/schedules", label: "My Schedule", icon: Clock, permission: Permission.VIEW_OWN_SCHEDULE },
  { path: "/reports", label: "Reports", icon: AlertTriangle, permission: Permission.VIEW_OWN_REPORTS },
  { path: "/profile", label: "My Profile", icon: User, permission: Permission.VIEW_OWN_PROFILE },
  { path: "/qr-attendance", label: "QR Attendance", icon: FileText, permission: Permission.MANAGE_ATTENDANCE },
];

const managementItems = [
  { path: "/user-management", label: "User Management", icon: UserPlus, permission: Permission.MANAGE_USERS },
  { path: "/team-management", label: "Team Management", icon: Users, permission: Permission.VIEW_TEAM_ATTENDANCE },
  { path: "/shift-management", label: "Shift Management", icon: Calendar, permission: Permission.MANAGE_SCHEDULES },
  { path: "/labor-cost-analytics", label: "Labor Analytics", icon: Briefcase, permission: Permission.VIEW_LABOR_COST },
];

const payrollItems = [
  { path: "/payslip-history", label: "Payslip Management", icon: FileText, permission: Permission.VIEW_ALL_PAYSLIPS },
  { path: "/payroll-management", label: "Payroll Generator", icon: PhilippinePeso, permission: Permission.MANAGE_PAYROLL },
  { path: "/admin-attendance", label: "Employee Attendance", icon: FileText, permission: Permission.VIEW_ALL_ATTENDANCE },
  { path: "/holiday-calendar", label: "Holiday Calendar", icon: Calendar, permission: Permission.MANAGE_HOLIDAYS },
];

export default function Sidebar({ className, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const { hasPermission } = usePermission(); 
  
  const [location, navigate] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedPosition = sessionStorage.getItem("sidebar-scroll-pos");
    if (scrollRef.current && savedPosition) {
      scrollRef.current.scrollTop = parseInt(savedPosition, 10);
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      sessionStorage.setItem("sidebar-scroll-pos", scrollRef.current.scrollTop.toString());
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileOpen(false); // Close sidebar on navigation
  };

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path) && path !== "/";
  };

  const visibleNavItems = navigationItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  const visibleManagementItems = managementItems.filter(item => 
    hasPermission(item.permission)
  );

  const visiblePayrollItems = payrollItems.filter(item => 
    hasPermission(item.permission)
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Logo Section */}
      <div className="p-6 flex flex-col items-center border-b border-slate-800/50 shrink-0">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-primary rounded-full blur opacity-25"></div>
          <img
            src="/images/logo.jpeg"
            alt="ESSence Logo"
            className="relative w-20 h-20 object-cover rounded-full border-2 border-slate-700/50 shadow-xl"
          />
        </div>
        <div className="mt-4 text-center">
          <h1 className="font-bold text-lg text-white tracking-tight">ESSENCE</h1>
        </div>
      </div>

      {/* Navigation */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 px-3 py-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
      >
        <div className="space-y-1">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
          {visibleNavItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                "w-full justify-start h-11 mb-1 transition-all duration-200 ease-in-out rounded-lg group",
                isActive(item.path)
                  ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-md shadow-primary/20 font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              )}
              onClick={() => handleNavigation(item.path)}
              data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
            >
              <item.icon className={cn("w-5 h-5 mr-3", isActive(item.path) ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
              {item.label}
            </Button>
          ))}
        </div>

        {visibleManagementItems.length > 0 && (
          <div className="mt-8 space-y-1">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Admin & Management
            </p>
            {visibleManagementItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-11 mb-1 transition-all duration-200 ease-in-out rounded-lg group",
                  isActive(item.path)
                    ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-md shadow-primary/20 font-medium"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                )}
                onClick={() => handleNavigation(item.path)}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <item.icon className={cn("w-5 h-5 mr-3", isActive(item.path) ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                {item.label}
              </Button>
            ))}
          </div>
        )}

        {visiblePayrollItems.length > 0 && (
          <div className="mt-8 space-y-1">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Payslips
            </p>
            {visiblePayrollItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-11 mb-1 transition-all duration-200 ease-in-out rounded-lg group",
                  isActive(item.path)
                    ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-md shadow-primary/20 font-medium"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                )}
                onClick={() => handleNavigation(item.path)}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <item.icon className={cn("w-5 h-5 mr-3", isActive(item.path) ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-3 mb-3 px-2">
          <Avatar className="h-9 w-9 border border-slate-700/50">
            <AvatarImage src={user?.profilePicture || ""} />
            <AvatarFallback className="bg-primary text-white text-xs">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-slate-200 truncate">
              {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
            </p>
            <p className="text-xs text-slate-500 truncate capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800/50 h-8 w-8"
            onClick={() => handleNavigation("/profile")}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full border-slate-700/50 bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 hover:border-slate-600 transition-colors h-9 text-xs"
          onClick={handleLogout}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Reverted floating button, relies entirely on MainLayout/Header state now */}
      
      <aside
        className={cn(
          "w-64 fixed inset-y-0 left-0 z-50 bg-slate-900 shadow-2xl lg:translate-x-0 transition-transform duration-300 ease-in-out border-r border-slate-800/50 will-change-transform transform-gpu",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
        data-testid="sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}