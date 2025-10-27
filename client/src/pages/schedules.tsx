import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Schedule } from "@shared/schema";

export default function Schedules() {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["/api/schedules", weekStart.toISOString(), weekEnd.toISOString()],
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

  const getScheduleForDate = (date: Date) => {
    if (!schedules) return null;
    
    return schedules.find((schedule: Schedule) => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate.toDateString() === date.toDateString();
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getShiftBadge = (shiftType: string) => {
    switch (shiftType) {
      case 'morning':
        return <Badge className="bg-red-600 text-white">Morning</Badge>;
      case 'afternoon':
        return <Badge className="bg-gray-700 text-white">Afternoon</Badge>;
      case 'night':
        return <Badge className="bg-black text-white">Night</Badge>;
      case 'off':
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Day Off</Badge>;
      default:
        return <Badge variant="secondary">{shiftType}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      cashier: "bg-red-100 text-red-900 border border-red-300",
      bar: "bg-gray-800 text-white",
      server: "bg-gray-200 text-gray-900",
      kitchen: "bg-red-600 text-white",
    };
    return (
      <Badge className={roleColors[role] || "bg-gray-100 text-gray-800"}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
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
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Work Schedules</h1>
            <p className="text-muted-foreground">View your weekly work schedule</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
              data-testid="button-today"
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Today
            </Button>
          </div>
        </div>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  {formatWeekRange()}
                </CardTitle>
                <CardDescription>Your work schedule for this week</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  data-testid="button-prev-week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  data-testid="button-next-week"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" data-testid="loading-schedules">
                <p className="text-muted-foreground">Loading schedules...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-4">
                {getDaysOfWeek().map((day, index) => {
                  const schedule = getScheduleForDate(day);
                  const todayClass = isToday(day) ? 'ring-2 ring-primary' : '';
                  
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all ${todayClass}`}
                      data-testid={`day-${day.toISOString().split('T')[0]}`}
                    >
                      <div className="text-center mb-3">
                        <h3 className={`font-medium ${isToday(day) ? 'text-primary' : ''}`}>
                          {formatDateHeader(day)}
                        </h3>
                        {isToday(day) && (
                          <p className="text-xs text-primary font-medium">Today</p>
                        )}
                      </div>
                      
                      {schedule ? (
                        <div className="space-y-3">
                          <div className="text-center">
                            {getShiftBadge(schedule.shiftType)}
                          </div>

                          {schedule.shiftRole && (
                            <div className="text-center">
                              {getRoleBadge(schedule.shiftRole)}
                            </div>
                          )}

                          {schedule.shiftType !== 'off' && schedule.startTime && schedule.endTime && (
                            <div className="text-center">
                              <div className="flex items-center justify-center text-sm text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                <span data-testid={`schedule-time-${day.toISOString().split('T')[0]}`}>
                                  {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                </span>
                              </div>
                            </div>
                          )}

                          {schedule.notes && (
                            <div className="text-xs text-muted-foreground text-center">
                              <p data-testid={`schedule-notes-${day.toISOString().split('T')[0]}`}>
                                {schedule.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-8 h-8 bg-muted rounded-full mx-auto mb-2 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">?</span>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid={`no-schedule-${day.toISOString().split('T')[0]}`}>
                            No schedule
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Working Days</span>
                  <span className="font-medium" data-testid="working-days-count">
                    {schedules ? schedules.filter((s: Schedule) => s.shiftType !== 'off').length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Days Off</span>
                  <span className="font-medium" data-testid="days-off-count">
                    {schedules ? schedules.filter((s: Schedule) => s.shiftType === 'off').length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Estimated Hours</span>
                  <span className="font-medium" data-testid="estimated-hours">
                    {schedules ? schedules.filter((s: Schedule) => s.shiftType !== 'off').length * 8 : 0}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Shift Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="text-sm">Morning</span>
                  </div>
                  <span className="text-sm font-medium" data-testid="morning-shifts-count">
                    {schedules ? schedules.filter((s: Schedule) => s.type === 'morning').length : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-700 rounded-full"></div>
                    <span className="text-sm">Afternoon</span>
                  </div>
                  <span className="text-sm font-medium" data-testid="afternoon-shifts-count">
                    {schedules ? schedules.filter((s: Schedule) => s.type === 'afternoon').length : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-black rounded-full"></div>
                    <span className="text-sm">Night</span>
                  </div>
                  <span className="text-sm font-medium" data-testid="night-shifts-count">
                    {schedules ? schedules.filter((s: Schedule) => s.type === 'night').length : 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Quick Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Standard Hours</p>
                  <p className="font-medium">40 hours/week</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Break Time</p>
                  <p className="font-medium">1 hour lunch</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Overtime Policy</p>
                  <p className="font-medium">40+ hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
