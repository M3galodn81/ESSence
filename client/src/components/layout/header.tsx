import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <header className="sticky top-0 z-20 w-full px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60 transition-all duration-200" data-testid="header">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        
        {/* Title Section */}
        <div className="flex items-center space-x-4 ml-12 lg:ml-0">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900" data-testid="page-title">
              {title}
            </h2>
            <p className="text-sm font-medium text-slate-500" data-testid="page-subtitle">
              {subtitle || `${getGreeting()}, ${user?.firstName || "User"}!`}
            </p>
          </div>
        </div>
        
        {/* Actions Section */}
        <div className="flex items-center space-x-3 md:space-x-4">
          {/* Search Input (Visual Enhancement) */}
          <div className="hidden md:flex relative group">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
             <Input 
               placeholder="Search..." 
               className="pl-9 h-10 w-48 lg:w-64 bg-slate-100/50 border-transparent focus:bg-white focus:border-primary/20 focus:ring-2 focus:ring-primary/10 rounded-full transition-all text-sm"
             />
          </div>

          {/* Notification Bell */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full h-10 w-10 text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 border-none shadow-xl rounded-2xl overflow-hidden mr-4" align="end">
              <div className="bg-white">
                <div className="px-4 py-3 border-b bg-slate-50/80 backdrop-blur-sm flex justify-between items-center">
                  <h4 className="font-semibold text-sm text-slate-800">Notifications</h4>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-primary/10 text-primary hover:bg-primary/20">3 New</Badge>
                </div>
                <div className="max-h-[300px] overflow-y-auto py-1">
                  <div className="text-sm p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex gap-3 items-start group">
                    <div className="w-2 h-2 mt-1.5 bg-blue-500 rounded-full shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="font-medium text-slate-800">Leave request approved</p>
                      <p className="text-xs text-slate-500 mt-0.5">Your annual leave has been approved</p>
                    </div>
                  </div>
                  <div className="text-sm p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex gap-3 items-start group">
                    <div className="w-2 h-2 mt-1.5 bg-purple-500 rounded-full shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="font-medium text-slate-800">New announcement</p>
                      <p className="text-xs text-slate-500 mt-0.5">Company holiday schedule updated</p>
                    </div>
                  </div>
                  <div className="text-sm p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex gap-3 items-start group">
                    <div className="w-2 h-2 mt-1.5 bg-green-500 rounded-full shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="font-medium text-slate-800">Payslip available</p>
                      <p className="text-xs text-slate-500 mt-0.5">Your payslip for this month is ready</p>
                    </div>
                  </div>
                </div>
                <div className="p-2 border-t bg-slate-50/50 text-center">
                    <Button variant="link" className="text-xs h-auto p-0 text-slate-500 hover:text-primary">Mark all as read</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Quick Action Button */}
          <Button
            className="bg-gradient-to-r from-primary to-primary/90 hover:to-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all rounded-full px-5 h-10 font-medium"
            size="sm"
            onClick={() => navigate("/leave-management")}
            data-testid="button-quick-action"
          >
            <Plus className="w-4 h-4 mr-2 stroke-[2.5]" />
            Quick Action
          </Button>
        </div>
      </div>
    </header>
  );
}