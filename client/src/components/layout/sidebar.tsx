import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission"; 
import { Permission } from "@/lib/permissions";         
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home, User, Calendar, FileText, Clock, Users,
  Megaphone, LogOut, Settings, AlertTriangle,
  PhilippinePeso, UserPlus, Timer, Briefcase, Shield
} from "lucide-react";
import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Accept the state from MainLayout
interface SidebarProps {
  className?: string;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

// --- SEPARATED STYLES ---
const styles = {
  // Overlays & Wrappers
  mobileOverlay: "fixed inset-0 bg-slate-900/80 z-40 lg:hidden animate-in fade-in duration-200",
  sidebarWrapper: "w-64 fixed inset-y-0 left-0 z-50 bg-slate-900 shadow-2xl lg:translate-x-0 transition-transform duration-300 ease-in-out border-r border-slate-800/50 will-change-transform transform-gpu",
  sidebarContent: "flex flex-col h-full bg-slate-900 text-slate-300",

  // Logo Section (Side-by-Side Layout)
  logoSection: "p-5 flex flex-row items-center gap-3 border-b border-slate-800/50 shrink-0",
  logoRelative: "relative shrink-0",
  logoGlow: "absolute -inset-1 bg-gradient-to-r from-red-600 to-primary rounded-full blur opacity-25",
  logoImage: "relative w-10 h-10 object-cover rounded-full border-2 border-slate-700/50 shadow-xl",
  logoTextContainer: "flex-1 min-w-0",
  logoText: "font-bold text-xl text-white tracking-tight truncate",

  // Navigation Area
  navScrollArea: "flex-1 px-3 py-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']",
  navGroupContainer: "space-y-1",
  navGroupHeader: "px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2",
  navGroupMargin: "mt-8 space-y-1",
  
  // Navigation Buttons
  btnBase: "w-full justify-start h-11 mb-1 transition-all duration-200 ease-in-out rounded-lg group",
  btnActive: "bg-gradient-to-r from-primary to-red-700 text-white shadow-md shadow-primary/20 font-medium",
  btnInactive: "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
  iconBase: "w-5 h-5 mr-3",
  iconActive: "text-white",
  iconInactive: "text-slate-500 group-hover:text-slate-300",

  // Footer Section
  footerSection: "p-4 border-t border-slate-800/50 bg-slate-900/50 shrink-0",
  profileRow: "flex items-center gap-3 mb-3 px-2",
  avatarBox: "h-9 w-9 border border-slate-700/50",
  avatarFallback: "bg-primary text-white text-xs",
  profileInfoBox: "flex-1 min-w-0 overflow-hidden",
  profileName: "text-sm font-medium text-slate-200 truncate",
  profileRole: "text-xs text-slate-500 truncate capitalize",
  settingsBtn: "text-slate-400 hover:text-white hover:bg-slate-800/50 h-8 w-8",
  
  signOutBtn: "w-full border-slate-700/50 bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 hover:border-slate-600 transition-colors h-9 text-xs",
  signOutIcon: "w-3.5 h-3.5 mr-2",
};

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/announcements", label: "Announcements", icon: Megaphone, permission: Permission.VIEW_ANNOUNCEMENTS },
  // { path: "/time-clock", label: "Time Clock", icon: Timer, permission: Permission.SUBMIT_ATTENDANCE},
  { path: "/attendance", label: "Attendance Logs", icon: FileText, permission: Permission.VIEW_OWN_ATTENDANCE },
  { path: "/leave-management", label: "Leave Requests", icon: Calendar, permission: Permission.VIEW_OWN_LEAVES },
  { path: "/payslips", label: "My Payslips", icon: PhilippinePeso, permission: Permission.VIEW_OWN_PAYSLIP},
  { path: "/schedules", label: "My Schedule", icon: Clock, permission: Permission.VIEW_OWN_SCHEDULE},
  { path: "/reports", label: "Reports", icon: AlertTriangle, permission: Permission.VIEW_OWN_REPORTS },
  { path: "/profile", label: "My Profile", icon: User, permission: Permission.VIEW_OWN_PROFILE },
  // { path: "/qr-attendance", label: "QR Attendance", icon: FileText, permission: Permission.MANAGE_ATTENDANCE },
];

const managementItems = [
  { path: "/user-management", label: "User Management", icon: UserPlus, permission: Permission.ACCESS_USER_MANAGEMENT },
  { path: "/team-management", label: "Team Management", icon: Users, permission: Permission.VIEW_TEAM_ATTENDANCE },
  { path: "/shift-management", label: "Shift Management", icon: Calendar, permission: Permission.MANAGE_SCHEDULES },
  { path: "/labor-cost-analytics", label: "Labor Analytics", icon: Briefcase, permission: Permission.VIEW_LABOR_COST },
  { path: "/manager-attendance", label: "Manager Attendance", icon: FileText, permission: Permission.MANAGE_ATTENDANCE },
  { path: "/admin-logs", label: "System Audit Logs", icon: Shield, permission: Permission.VIEW_AUDIT_LOGS },
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
    <div className={styles.sidebarContent}>
      {/* Logo Section - SIDE BY SIDE */}
      <div className={styles.logoSection}>
        <div className={styles.logoRelative}>
          <div className={styles.logoGlow}></div>
          <img
            src="/images/logo.jpeg"
            alt="ESSence Logo"
            className={styles.logoImage}
          />
        </div>
        <div className={styles.logoTextContainer}>
          <h1 className={styles.logoText}>ESSENCE</h1>
        </div>
      </div>

      {/* Navigation */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={styles.navScrollArea}
      >
        <div className={styles.navGroupContainer}>
          <p className={styles.navGroupHeader}>Menu</p>
          {visibleNavItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                styles.btnBase,
                isActive(item.path) ? styles.btnActive : styles.btnInactive
              )}
              onClick={() => handleNavigation(item.path)}
              data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
            >
              <item.icon className={cn(styles.iconBase, isActive(item.path) ? styles.iconActive : styles.iconInactive)} />
              {item.label}
            </Button>
          ))}
        </div>

        {visibleManagementItems.length > 0 && (
          <div className={styles.navGroupMargin}>
            <p className={styles.navGroupHeader}>
              Admin & Management
            </p>
            {visibleManagementItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  styles.btnBase,
                  isActive(item.path) ? styles.btnActive : styles.btnInactive
                )}
                onClick={() => handleNavigation(item.path)}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <item.icon className={cn(styles.iconBase, isActive(item.path) ? styles.iconActive : styles.iconInactive)} />
                {item.label}
              </Button>
            ))}
          </div>
        )}

        {visiblePayrollItems.length > 0 && (
          <div className={styles.navGroupMargin}>
            <p className={styles.navGroupHeader}>
              Payslips
            </p>
            {visiblePayrollItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  styles.btnBase,
                  isActive(item.path) ? styles.btnActive : styles.btnInactive
                )}
                onClick={() => handleNavigation(item.path)}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <item.icon className={cn(styles.iconBase, isActive(item.path) ? styles.iconActive : styles.iconInactive)} />
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      <div className={styles.footerSection}>
        <div className={styles.profileRow}>
          <Avatar className={styles.avatarBox}>
            <AvatarImage src={user?.profilePicture || ""} />
            <AvatarFallback className={styles.avatarFallback}>
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className={styles.profileInfoBox}>
            <p className={styles.profileName}>
              {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
            </p>
            <p className={styles.profileRole}>
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={styles.settingsBtn}
            onClick={() => handleNavigation("/profile")}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className={styles.signOutBtn}
          onClick={handleLogout}
        >
          <LogOut className={styles.signOutIcon} />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isMobileOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={() => setIsMobileOpen(false)}
          data-testid="mobile-overlay"
        />
      )}
      
      <aside
        className={cn(
          styles.sidebarWrapper,
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