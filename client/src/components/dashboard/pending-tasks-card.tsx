import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function PendingTasksCard() {
  

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl" data-testid="pending-tasks-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <CheckCircle2 className="w-5 h-5 text-orange-500" />
           Pending Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        
          <div className="text-center py-6 text-slate-400 text-sm">You're all caught up!</div>
        
      </CardContent>
    </Card>
  );
}