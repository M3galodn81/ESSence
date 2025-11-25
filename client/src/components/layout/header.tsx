import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 ml-12 lg:ml-0">
          <div>
            <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="page-subtitle">
              {subtitle || `${getGreeting()}, ${user?.firstName || "User"}!`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative text-muted-foreground hover:text-foreground"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5" />
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                  data-testid="notification-badge"
                >
                  3
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Notifications</h4>
                <div className="space-y-2">
                  <div className="text-sm p-2 hover:bg-accent rounded-md cursor-pointer">
                    <p className="font-medium">Leave request approved</p>
                    <p className="text-xs text-muted-foreground">Your annual leave has been approved</p>
                  </div>
                  <div className="text-sm p-2 hover:bg-accent rounded-md cursor-pointer">
                    <p className="font-medium">New announcement</p>
                    <p className="text-xs text-muted-foreground">Company holiday schedule updated</p>
                  </div>
                  <div className="text-sm p-2 hover:bg-accent rounded-md cursor-pointer">
                    <p className="font-medium">Payslip available</p>
                    <p className="text-xs text-muted-foreground">Your payslip for this month is ready</p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
            onClick={() => navigate("/leave-management")}
            data-testid="button-quick-action"
          >
            <Plus className="w-4 h-4 mr-2" />
            Quick Action
          </Button>
        </div>
      </div>
    </header>
  );
}
