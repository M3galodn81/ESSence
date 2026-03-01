import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Megaphone, FileCheck, Banknote, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void; // <-- Added prop
}

type Notification = {
  id: string;
  type: 'announcement' | 'leave' | 'payslip';
  title: string;
  message: string;
  timestamp: string;
  link?: string;
};

export default function Header({ title, subtitle, onMenuToggle }: HeaderProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60000,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone className="w-4 h-4 text-purple-600" />;
      case 'leave': return <FileCheck className="w-4 h-4 text-blue-600" />;
      case 'payslip': return <Banknote className="w-4 h-4 text-green-600" />;
      default: return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
        case 'announcement': return "bg-purple-100";
        case 'leave': return "bg-blue-100";
        case 'payslip': return "bg-green-100";
        default: return "bg-slate-100";
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full px-4 py-3 md:px-6 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60 transition-all duration-200" data-testid="header">
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
        
        {/* Title Section Container */}
        <div className="flex items-center flex-1 min-w-0 gap-3">
          
          {/* INLINE MOBILE MENU BUTTON */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0 -ml-2 h-9 w-9 text-slate-600 hover:bg-slate-100"
            onClick={onMenuToggle}
            data-testid="mobile-menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Title block */}
          <div className="space-y-0.5 md:space-y-1 min-w-0">
            <h2 className="header-title text-lg md:text-2xl font-bold text-slate-900 truncate" data-testid="page-title">
              {title}
            </h2>
            <p className="header-subtitle text-xs md:text-sm text-slate-500 truncate" data-testid="page-subtitle">
              {subtitle || `${getGreeting()}, ${user?.firstName || "User"}!`}
            </p>
          </div>
        </div>
        
        {/* Actions Section */}
        <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full h-9 w-9 md:h-10 md:w-10 text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5 md:w-5 md:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-[320px] p-0 border-none shadow-xl rounded-2xl overflow-hidden mr-4" align="end" sideOffset={8}>
              <div className="bg-white">
                <div className="px-4 py-3 border-b bg-slate-50/80 backdrop-blur-sm flex justify-between items-center">
                  <h4 className="font-semibold text-sm text-slate-800">Notifications</h4>
                  {notifications.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-primary/10 text-primary hover:bg-primary/20">{notifications.length} New</Badge>}
                </div>
                <div className="max-h-[300px] overflow-y-auto py-1">
                  {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">No new notifications</div>
                  ) : (
                      notifications.map(n => (
                        <div 
                            key={n.id} 
                            className="text-sm p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex gap-3 items-start group"
                            onClick={() => n.link && navigate(n.link)}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getBgColor(n.type)} group-hover:scale-110 transition-transform`}>
                                {getIcon(n.type)}
                            </div>
                            <div>
                                <p className="font-medium text-slate-800 text-xs">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            className="bg-gradient-to-r from-primary to-primary/90 hover:to-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all rounded-full h-9 w-9 p-0 sm:w-auto sm:px-5 sm:h-10 flex items-center justify-center"
            onClick={() => navigate("/leave-management")}
            data-testid="button-quick-action"
          >
            <Plus className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2 stroke-[2.5]" />
            <span className="hidden sm:inline font-medium">Quick Action</span>
          </Button>
        </div>
      </div>
    </header>
  );
}