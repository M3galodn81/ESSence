import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building,
  Home,
  User,
  Calendar,
  FileText,
  Clock,
  Users,
  BarChart,
  Megaphone,
  LogOut,
  Settings,
  Menu,
  X,
  AlertTriangle,
  DollarSign,
  UserPlus
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home, roles: ["employee", "manager", "admin"] },
  { path: "/profile", label: "My Profile", icon: User, roles: ["employee", "manager", "admin"] },
  { path: "/leave-management", label: "Leave Management", icon: Calendar, roles: ["employee", "manager", "admin"] },
  { path: "/payslips", label: "Payslips", icon: FileText, roles: ["employee", "manager", "admin"] },
  { path: "/salary-computation", label: "Salary Calculator", icon: DollarSign, roles: ["employee", "manager", "admin"] },
  { path: "/schedules", label: "Schedules", icon: Clock, roles: ["employee", "manager", "admin"] },
  { path: "/reports", label: "Reports", icon: AlertTriangle, roles: ["employee", "manager", "admin"] },
];

const managementItems = [
  { path: "/user-management", label: "User Management", icon: UserPlus, roles: ["manager", "admin"] },
  { path: "/team-management", label: "Team Management", icon: Users, roles: ["manager", "admin"] },
  { path: "/shift-management", label: "Shift Management", icon: Calendar, roles: ["manager", "admin"] },
  { path: "/reports-analytics", label: "Reports & Analytics", icon: BarChart, roles: ["manager", "admin"] },
  { path: "/labor-cost-analytics", label: "Labor Cost Analytics", icon: DollarSign, roles: ["manager", "admin"] },
  { path: "/announcements", label: "Announcements", icon: Megaphone, roles: ["manager", "admin"] },
];

export default function Sidebar({ className }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  const canAccessManagement = user?.role === "manager" || user?.role === "admin";

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const sidebarContent = (
    <>
      {}
      <div className="p-6 border-b border-gray-800">
        <div className="flex flex-col items-center space-y-2">
          <img
            src="/images/logo.jpeg"
            alt="ESSence Self Service"
            className="w-32 h-32 object-cover rounded-full border-4 border-red-600"
          />
        </div>
      </div>

      {}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground" data-testid="user-name">
              {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
            </p>
            <p className="text-xs text-sidebar-foreground/70 capitalize" data-testid="user-role">
              {user?.position || user?.role || "Employee"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {navigationItems
          .filter(item => item.roles.includes(user?.role || "employee"))
          .map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive(item.path)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-red-700"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
              onClick={() => handleNavigation(item.path)}
              data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </Button>
          ))}

        {}
        {canAccessManagement && (
          <div className="pt-4 mt-4 border-t border-gray-800">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Management
            </p>
            {managementItems
              .filter(item => item.roles.includes(user?.role || "employee"))
              .map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive(item.path)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-red-700"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                  onClick={() => handleNavigation(item.path)}
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              ))}
          </div>
        )}
      </nav>

      {}
      <div className="p-4 border-t border-gray-800">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {}
      <aside
        className={cn(
          "w-64 bg-sidebar border-r border-sidebar-border sidebar-transition fixed z-50 h-screen flex flex-col",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className
        )}
        data-testid="sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
