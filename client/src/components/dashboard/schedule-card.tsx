import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "lucide-react";
import { useLocation } from "wouter";
import type { Schedule } from "@shared/schema";

interface ScheduleCardProps {
  schedules: Schedule[];
  isLoading?: boolean;
}

export default function ScheduleCard({ schedules, isLoading }: ScheduleCardProps) {
  const [, navigate] = useLocation();
  
  const today = new Date();
  const todaySchedule = schedules.find(s => 
    new Date(s.date).toDateString() === today.toDateString()
  );

  const formatTime = (date: number | Date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg rounded-2xl border-none" data-testid="schedule-card">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
             <Calendar className="w-4 h-4 text-slate-400" /> Today
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => navigate("/schedules")}>
            Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3 bg-white/10" />
            <Skeleton className="h-8 w-2/3 bg-white/10" />
          </div>
        ) : todaySchedule ? (
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold tracking-tight">
                {formatTime(todaySchedule.startTime)}
              </p>
              <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5" />
                Until {formatTime(todaySchedule.endTime)}
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
               <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Shift</span>
               <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full capitalize">
                 {todaySchedule.type}
               </span>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-slate-400 font-medium">No shift today</p>
            <p className="text-xs text-slate-500 mt-1">Enjoy your day off!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}