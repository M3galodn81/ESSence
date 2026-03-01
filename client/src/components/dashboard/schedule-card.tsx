import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Sun, Sunset, Moon, Coffee } from "lucide-react";
import { useLocation } from "wouter";
import type { Schedule } from "@shared/schema";
import { cn } from "@/lib/utils";

// --- Constants & Style Configuration ---

const SHIFT_CONFIG = {
  morning: { label: "AM", icon: Sun, color: "text-emerald-400" },
  afternoon: { label: "PM", icon: Sunset, color: "text-amber-400" },
  night: { label: "GY", icon: Moon, color: "text-indigo-400" },
  off: { label: "OFF", icon: Coffee, color: "text-slate-400" }
} as const;

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

  // Get config for current shift type
  const shift = todaySchedule 
    ? (SHIFT_CONFIG[todaySchedule.shiftType as keyof typeof SHIFT_CONFIG] || SHIFT_CONFIG.morning)
    : null;

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
               <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Shift Type</span>
               <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                 {shift && <shift.icon className={cn("w-3.5 h-3.5", shift.color)} />}
                 <span className="text-sm font-bold uppercase">
                   {shift?.label}
                 </span>
               </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-2">
                <Coffee className="w-8 h-8 text-slate-600 opacity-50" />
            </div>
            <p className="text-slate-400 font-medium">No shift today</p>
            <p className="text-xs text-slate-500 mt-1">Enjoy your day off!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}