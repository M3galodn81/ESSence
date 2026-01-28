import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, ChevronLeft, ChevronRight, CalendarDays, MapPin } from "lucide-react";
import type { Schedule } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function Schedules() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getWeekBounds = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Set to Sunday
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Set to Saturday
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };

  const { start: weekStart, end: weekEnd } = getWeekBounds(currentDate);

  const { data: schedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const getDaysOfWeek = () => {
    const days = [];
    const start = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const getScheduleForDate = (viewDate: Date) => {
    if (!schedules) return null;
    const viewDateStr = viewDate.toLocaleDateString('en-CA'); 

    return schedules.find((schedule: any) => {
      const scheduleDate = new Date(schedule.date);
      const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
      return scheduleDateStr === viewDateStr;
    });
  };

  const formatTime = (time: number | null) => {
    if (!time) return '';
    const date = new Date(time);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getShiftBadge = (shiftType: string) => {
    const styles = {
        morning: "bg-emerald-100 text-emerald-700 border-emerald-200",
        afternoon: "bg-amber-100 text-amber-700 border-amber-200",
        night: "bg-indigo-100 text-indigo-700 border-indigo-200",
        off: "bg-slate-100 text-slate-500 border-slate-200"
    };
    const style = styles[shiftType as keyof typeof styles] || styles.morning;
    
    return (
      <Badge variant="outline" className={`${style} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border`}>
        {shiftType}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    return <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">{role}</span>;
  };

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };
  
  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const formatWeekRange = () => {
    return `${weekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })} - ${weekEnd.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" data-testid="page-title">My Schedule</h1>
          <p className="text-slate-500 mt-1 text-sm">View your upcoming shifts and work hours</p>
        </div>
        
        {/* Glass Toolbar */}
        <div className="flex items-center bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 mr-2">
                <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')} className="h-8 w-8 rounded-lg hover:bg-slate-100" data-testid="button-prev-week">
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                </Button>
                <div className="px-2 text-sm font-medium text-slate-700 min-w-[140px] text-center">
                    {formatWeekRange()}
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')} className="h-8 w-8 rounded-lg hover:bg-slate-100" data-testid="button-next-week">
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                </Button>
            </div>
            <Button 
                variant="ghost" 
                onClick={() => setCurrentDate(new Date())} 
                className="h-8 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3"
                data-testid="button-today"
            >
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Today
            </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      <Card className="glass-card">
        <CardContent className="p-6">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Loading schedule...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
              {getDaysOfWeek().map((day, index) => {
                const schedule = getScheduleForDate(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col gap-3 p-3 rounded-2xl border min-h-[200px] transition-all duration-200
                        ${isCurrentDay 
                            ? 'bg-blue-50/80 border-blue-200 shadow-inner' 
                            : 'bg-white/60 border-slate-100 hover:border-slate-200 hover:bg-white/80'
                        }`}
                    data-testid={`day-${day.toISOString().split('T')[0]}`}
                  >
                    {/* Day Header */}
                    <div className={`text-center pb-2 border-b ${isCurrentDay ? 'border-blue-200' : 'border-slate-100'}`}>
                      <p className={`text-xs uppercase tracking-wider font-semibold ${isCurrentDay ? 'text-blue-600' : 'text-slate-400'}`}>
                        {formatDateHeader(day)}
                      </p>
                      <div className={`text-lg font-bold leading-tight ${isCurrentDay ? 'text-blue-700' : 'text-slate-700'}`}>
                        {formatDayNumber(day)}
                      </div>
                    </div>

                    {/* Shift Content */}
                    <div className="flex-1 flex flex-col justify-center">
                      {schedule ? (
                        <div className="relative group">
                            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-3">
                                <div className="flex justify-center items-center">
                                    {getShiftBadge(schedule.type)}
                                </div>
                                <div className="flex justify-center items-center">
                                    {schedule.shiftRole && getRoleBadge(schedule.shiftRole)}
                                </div>

                                {schedule.type !== 'off' && schedule.startTime && schedule.endTime ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-1.5 rounded-lg">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <div className="flex flex-col leading-none gap-0.5">
                                                <span>{formatTime(schedule.startTime)}</span>
                                                <span className="text-slate-400 text-[10px]">to {formatTime(schedule.endTime)}</span>
                                            </div>
                                        </div>
                                        {/* {schedule.location && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 px-1">
                                                <MapPin className="w-3 h-3" />
                                                <span className="truncate">{schedule.location}</span>
                                            </div>
                                        )} */}
                                    </div>
                                ) : (
                                    <div className="py-2 text-center">
                                        <p className="text-xs text-slate-400 italic">No work assigned</p>
                                    </div>
                                )}
                            </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-8 h-8 bg-slate-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                                    <span className="text-xs text-slate-300 font-bold">-</span>
                                </div>
                            </div>
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