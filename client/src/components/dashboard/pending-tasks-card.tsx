import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, ArrowRight, Clock, AlertTriangle, Calendar, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";
import { useLocation } from "wouter"; 
import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export default function PendingTasksCard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { hasPermission } = usePermission();

  // --- Permissions ---
  const canManageReports = hasPermission(Permission.MANAGE_REPORTS);
  const canApproveLeaves = hasPermission(Permission.APPROVE_LEAVES);
  const canManageSchedules = hasPermission(Permission.MANAGE_SCHEDULES);

  // --- Data Fetching ---
  const { data: reports, isLoading: reportsLoading } = useQuery({ 
    queryKey: ["/api/reports"],
    refetchInterval: 10000 
  });

  const { data: allLeaves, isLoading: leavesLoading } = useQuery({ 
    queryKey: ["/api/leave-management/all"],
    enabled: canApproveLeaves,
    refetchInterval: 10000 
  });

  const { data: teamMembers, isLoading: teamLoading } = useQuery({ 
    queryKey: ["/api/team"],
    enabled: canManageSchedules
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({ 
    queryKey: ["/api/schedules/all"],
    enabled: canManageSchedules
  });

  const isLoading = reportsLoading || (canApproveLeaves && leavesLoading) || (canManageSchedules && (teamLoading || schedulesLoading));

  // --- Task Aggregation ---
  const pendingTasks = useMemo(() => {
    if (!user) return [];
    let tasks: any[] = [];

    // 1. Personal NTEs (Notice to Explain)
    if (reports) {
        const myNTEs = reports.filter((r: any) => 
            r.assignedTo === user.id && r.nteRequired === true && (!r.nteContent || r.nteContent.trim() === "")
        ).map((r: any) => ({
            id: `nte-${r.id}`,
            type: 'nte',
            title: 'Submit Notice to Explain',
            subtitle: r.title,
            date: r.createdAt,
            priority: 3,
            link: '/reports'
        }));
        tasks.push(...myNTEs);
    }

    // 2. Manager: Pending Reports to Review
    if (canManageReports && reports) {
        const pendingReports = reports.filter((r: any) => 
            r.status === 'pending' && r.nteRequired === false 
        ).map((r: any) => ({
            id: `report-${r.id}`,
            type: 'report',
            title: 'Review Incident Report',
            subtitle: r.title,
            date: r.createdAt,
            priority: 2,
            link: '/reports'
        }));
        tasks.push(...pendingReports);
    }

    // 3. Manager: Pending Leave Requests
    if (canApproveLeaves && allLeaves) {
        const pendingLeaves = allLeaves.filter((l: any) => 
            l.status === 'pending'
        ).map((l: any) => ({
            id: `leave-${l.id}`,
            type: 'leave',
            title: 'Review Leave Request',
            subtitle: `${l.days} day(s) requested`,
            date: l.createdAt,
            priority: 1,
            link: '/leave-management'
        }));
        tasks.push(...pendingLeaves);
    }

    // 4. Manager: Missing Schedules
    if (canManageSchedules && teamMembers && schedules) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        // Find users who have at least one schedule entry in the next 7 days
        const scheduledUserIds = new Set(
            schedules.filter((s: any) => {
                const d = new Date(s.date);
                return d >= today && d < nextWeek;
            }).map((s: any) => s.userId)
        );

        // Check active employees against the scheduled list
        const activeEmployees = teamMembers.filter((u: any) => u.isActive && u.role !== 'admin');
        const unscheduledEmployees = activeEmployees.filter((u: any) => !scheduledUserIds.has(u.id));

        if (unscheduledEmployees.length > 0) {
            tasks.push({
                id: 'missing-schedules',
                type: 'schedule',
                title: 'Assign Weekly Schedules',
                subtitle: `${unscheduledEmployees.length} employees have no shifts assigned for the upcoming week.`,
                date: new Date().toISOString(), // Use now for sorting
                priority: 4,
                link: '/shift-management'
            });
        }
    }

    // Sort: Highest priority first, then newest first
    return tasks.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  }, [reports, allLeaves, teamMembers, schedules, user, canManageReports, canApproveLeaves, canManageSchedules]);

  // --- Styling Helpers ---
  const getTaskStyling = (type: string) => {
    switch (type) {
        case 'nte': 
            return { bg: 'bg-orange-50/50 hover:bg-orange-50', border: 'border-orange-100', text: 'text-orange-600', icon: FileText };
        case 'report': 
            return { bg: 'bg-rose-50/50 hover:bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: AlertTriangle };
        case 'leave': 
            return { bg: 'bg-blue-50/50 hover:bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', icon: Calendar };
        case 'schedule': 
            return { bg: 'bg-indigo-50/50 hover:bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', icon: CalendarDays };
        default: 
            return { bg: 'bg-slate-50 hover:bg-slate-100', border: 'border-slate-100', text: 'text-slate-600', icon: Clock };
    }
  };

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl h-fit flex flex-col" data-testid="pending-tasks-card">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <CheckCircle2 className="w-5 h-5 text-emerald-500" />
           Pending Tasks
           {pendingTasks.length > 0 && (
             <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100 ml-2">
                {pendingTasks.length}
             </Badge>
           )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="overflow-y-auto max-h-[400px] pr-2">
        {isLoading ? (
            <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100/50 animate-pulse rounded-xl border border-slate-100" />)}
            </div>
        ) : pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {pendingTasks.map((task: any) => {
              const style = getTaskStyling(task.type);
              const Icon = style.icon;

              return (
                <div 
                  key={task.id} 
                  className={cn("group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3", style.bg, style.border)}
                  onClick={() => setLocation(task.link)}
                >
                  <div className="flex items-start gap-3">
                      <div className={cn("mt-1 w-8 h-8 rounded-full bg-white border flex items-center justify-center shadow-sm shrink-0", style.border, style.text)}>
                          <Icon className="w-4 h-4" />
                      </div>
                      <div>
                          <h4 className="text-sm font-semibold text-slate-800 leading-tight">{task.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.subtitle}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-medium text-slate-500">
                                  {formatDistanceToNow(new Date(task.date), { addSuffix: true })}
                              </span>
                          </div>
                      </div>
                  </div>
                  <ArrowRight className={cn("w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1", style.text)} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8">
             <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
             </div>
             <p className="text-slate-800 font-bold">You're all caught up!</p>
             <p className="text-slate-500 text-sm mt-1">No pending actions required.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}