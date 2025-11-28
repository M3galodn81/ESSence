import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, FileText, UserCog, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function QuickActionsCard() {
  const [, navigate] = useLocation();

  const quickActions = [
    {
      icon: CalendarPlus,
      label: "Apply Leave",
      desc: "Request time off",
      action: () => navigate("/leave-management"),
      color: "text-rose-600",
      bg: "bg-rose-50 hover:bg-rose-100",
    },
    {
      icon: FileText,
      label: "View Payslip",
      desc: "Check salary history",
      action: () => navigate("/payslips"),
      color: "text-emerald-600",
      bg: "bg-emerald-50 hover:bg-emerald-100",
    },
    {
      icon: UserCog,
      label: "My Profile",
      desc: "Update information",
      action: () => navigate("/profile"),
      color: "text-blue-600",
      bg: "bg-blue-50 hover:bg-blue-100",
    },
  ];

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl" data-testid="quick-actions-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={action.action}
            className={`flex items-center p-3 rounded-xl transition-all group text-left w-full ${action.bg}`}
          >
            <div className={`p-2 rounded-lg bg-white shadow-sm ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold text-slate-800">{action.label}</p>
              <p className="text-xs text-slate-500">{action.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}