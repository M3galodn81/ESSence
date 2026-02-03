import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import type { Schedule } from "@shared/schema";
import { cn } from "@/lib/utils";

// --- Constants & Style Configuration ---

const SHIFT_MAP = {
  morning: { label: "AM", style: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  afternoon: { label: "PM", style: "bg-amber-100 text-amber-700 border-amber-200" },
  night: { label: "GY", style: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  off: { label: "OFF", style: "bg-slate-100 text-slate-500 border-slate-200" }
} as const;

// --- Helper Components ---

const ShiftBadge = ({ type }: { type: string }) => {
  const config = SHIFT_MAP[type as keyof typeof SHIFT_MAP] || SHIFT_MAP.morning;
  return (
    <Badge variant="outline" className={cn(config.style, "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border")}>
      {config.label}
    </Badge>
  );
};

const RoleBadge = ({ role }: { role: string }) => (
  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">
    {role}
  </span>
);

export default function Schedules() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Queries
  const { data: schedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
    staleTime: 1000 * 60 * 5,
  });

  // Date Logic
  const getWeekBounds = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const { start: weekStart, end: weekEnd } = getWeekBounds(currentDate);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });

  const formatTime = (time: number | null) => {
    if (!time) return '';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Schedule</h1>
          <p className="text-slate-500 mt-1 text-sm">View your AM, PM, and GY shifts</p>
        </div>
        
        <div className="flex items-center bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-1 pr-2 border-r border-slate-200 mr-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() - 7)))} className="h-8 w-8 rounded-lg">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            <div className="px-2 text-sm font-medium text-slate-700 min-w-[160px] text-center">
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() + 7)))} className="h-8 w-8 rounded-lg">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setCurrentDate(new Date())} className="h-8 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Today
          </Button>
        </div>
      </div>

      {/* Grid */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Fetching your rotation...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
              {daysOfWeek.map((day, index) => {
                const dateKey = day.toLocaleDateString('en-CA');
                const schedule = schedules?.find(s => new Date(s.date).toISOString().split('T')[0] === dateKey);
                const active = day.toDateString() === new Date().toDateString();
                
                return (
                  <div 
                    key={index} 
                    className={cn(
                      "flex flex-col gap-3 p-3 rounded-2xl border min-h-[220px] transition-all duration-200",
                      active ? "bg-blue-50/80 border-blue-200 shadow-inner" : "bg-white/60 border-slate-100 hover:border-slate-200 hover:bg-white/80"
                    )}
                  >
                    <div className={cn("text-center pb-2 border-b", active ? "border-blue-200" : "border-slate-100")}>
                      <p className={cn("text-xs uppercase tracking-wider font-semibold", active ? "text-blue-600" : "text-slate-400")}>
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <div className={cn("text-lg font-bold leading-tight", active ? "text-blue-700" : "text-slate-700")}>
                        {day.getDate()}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      {schedule ? (
                        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-3">
                          <div className="flex justify-center"><ShiftBadge type={schedule.type} /></div>
                          <div className="flex justify-center">{schedule.shiftRole && <RoleBadge role={schedule.shiftRole} />}</div>

                          {schedule.type !== 'off' && (
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-1.5 rounded-lg">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <div className="flex flex-col leading-none">
                                <span>{formatTime(schedule.startTime)}</span>
                                <span className="text-slate-400 text-[10px] mt-0.5">to {formatTime(schedule.endTime)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center opacity-10">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold">-</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}