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
  GraduationCap, 
  Folder, 
  Users, 
  BarChart, 
  Megaphone, 
  LogOut,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home, roles: ["employee", "manager", "hr"] },
  { path: "/profile", label: "My Profile", icon: User, roles: ["employee", "manager", "hr"] },
  { path: "/leave-management", label: "Leave Management", icon: Calendar, roles: ["employee", "manager", "hr"] },
  { path: "/payslips", label: "Payslips", icon: FileText, roles: ["employee", "manager", "hr"] },
  { path: "/schedules", label: "Schedules", icon: Clock, roles: ["employee", "manager", "hr"] },
  { path: "/training", label: "Training", icon: GraduationCap, roles: ["employee", "manager", "hr"] },
  { path: "/documents", label: "Documents", icon: Folder, roles: ["employee", "manager", "hr"] },
];

const managementItems = [
  { path: "/team-management", label: "Team Management", icon: Users, roles: ["manager", "hr"] },
  { path: "/reports-analytics", label: "Reports & Analytics", icon: BarChart, roles: ["manager", "hr"] },
  { path: "/announcements", label: "Announcements", icon: Megaphone, roles: ["manager", "hr"] },
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

  const canAccessManagement = user?.role === "manager" || user?.role === "hr";

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const sidebarContent = (
    <>
      {/* Logo and Company Name */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Building className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground" data-testid="company-name">ESS Portal</h1>
            <p className="text-xs text-sidebar-foreground/70">TechCorp Inc.</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
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
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation Menu */}
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
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              onClick={() => handleNavigation(item.path)}
              data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </Button>
          ))}

        {/* Management Section */}
        {canAccessManagement && (
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
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
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <aside 
        className={cn(
          "w-64 bg-sidebar border-r border-sidebar-border sidebar-transition fixed lg:relative z-50 h-full flex flex-col",
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
