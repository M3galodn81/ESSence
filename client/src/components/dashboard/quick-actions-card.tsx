import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, FileText, UserCog } from "lucide-react";
import { useLocation } from "wouter";

export default function QuickActionsCard() {
  const [, navigate] = useLocation();

  const quickActions = [
    {
      icon: CalendarPlus,
      label: "Apply Leave",
      action: () => navigate("/leave-management"),
      testId: "quick-action-leave",
    },
    {
      icon: FileText,
      label: "View Payslip",
      action: () => navigate("/payslips"),
      testId: "quick-action-payslip",
    },
    {
      icon: UserCog,
      label: "Update Profile",
      action: () => navigate("/profile"),
      testId: "quick-action-profile",
    },
  ];

  return (
    <Card data-testid="quick-actions-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Button
              key={action.testId}
              variant="outline"
              className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={action.action}
              data-testid={action.testId}
            >
              <action.icon className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
