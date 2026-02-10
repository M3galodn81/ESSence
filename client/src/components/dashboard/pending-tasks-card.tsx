import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, ArrowRight, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter"; 
import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";

export default function PendingTasksCard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: reports, isLoading } = useQuery({ 
    queryKey: ["/api/reports"],
    refetchInterval: 10000 
  });

  const pendingTasks = useMemo(() => {
    if (!reports || !user) return [];

    return reports.filter((r: any) => 
        r.assignedTo === user.id && 
        r.nteRequired === true && 
        (!r.nteContent || r.nteContent.trim() === "")
    ).map((r: any) => ({
        id: r.id,
        type: 'nte',
        title: 'Submit Notice to Explain',
        subtitle: r.title,
        date: r.createdAt,
        priority: 'high'
    }));
  }, [reports, user]);

  return (
    // UPDATED: Changed 'h-full' to 'h-fit' so it only takes necessary space
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl h-fit flex flex-col" data-testid="pending-tasks-card">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <CheckCircle2 className="w-5 h-5 text-orange-500" />
           Pending Tasks
           {pendingTasks.length > 0 && (
             <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 ml-2">
                {pendingTasks.length}
             </Badge>
           )}
        </CardTitle>
        {pendingTasks.length > 0 && (
             <Button variant="ghost" size="sm" className="text-xs text-slate-400 h-8" onClick={() => setLocation("/reports")}>
                View All
             </Button>
        )}
      </CardHeader>
      
      {/* UPDATED: Removed 'flex-1' to prevent forcing height. Added 'max-h' for safety if list gets too long. */}
      <CardContent className="overflow-y-auto max-h-[400px] pr-1">
        {isLoading ? (
            <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />)}
            </div>
        ) : pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {pendingTasks.map((task: any) => (
              <div 
                key={task.id} 
                className="group p-3 rounded-xl border border-orange-100 bg-orange-50/50 hover:bg-orange-50 transition-all cursor-pointer flex items-center justify-between gap-3"
                onClick={() => setLocation("/reports")}
              >
                <div className="flex items-start gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-white border border-orange-100 flex items-center justify-center shadow-sm text-orange-600">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-slate-800">{task.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">Ref: {task.subtitle}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] font-medium text-orange-600">
                                {formatDistanceToNow(new Date(task.date), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                </div>
                <ArrowRight className="w-4 h-4 text-orange-300 group-hover:text-orange-600 transition-colors" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-6">
             <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
             </div>
             <p className="text-slate-800 font-medium">You're all caught up!</p>
             <p className="text-slate-400 text-xs mt-1">No pending actions required.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}