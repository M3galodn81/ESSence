import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();

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
          
          {}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
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
