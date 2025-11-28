import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function PendingTasksCard() {
  const { data: trainings } = useQuery({ queryKey: ["/api/trainings"] });
  const { data: userTrainings } = useQuery({ queryKey: ["/api/user-trainings"] });

  const pendingTasks = (() => {
    if (!trainings || !userTrainings) return [];
    const completedIds = userTrainings.filter((ut: any) => ut.status === 'completed').map((ut: any) => ut.trainingId);
    return trainings.filter((t: any) => t.isRequired && !completedIds.includes(t.id)).map((t: any) => ({
      id: t.id,
      title: t.title,
      type: "Training"
    }));
  })();

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl" data-testid="pending-tasks-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <CheckCircle2 className="w-5 h-5 text-orange-500" />
           Pending Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {pendingTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-orange-50/50 border border-orange-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm text-orange-600">
                     <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.type}</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="h-7 text-xs bg-white text-slate-700 shadow-sm hover:bg-orange-100">
                  Start
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">You're all caught up!</div>
        )}
      </CardContent>
    </Card>
  );
}