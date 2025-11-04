import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { useLocation } from "wouter";
import type { Schedule } from "@shared/schema";

interface ScheduleCardProps {
  schedules: Schedule[];
  isLoading?: boolean;
}

export default function ScheduleCard({ schedules, isLoading }: ScheduleCardProps) {
  const [, navigate] = useLocation();
  const getScheduleColor = (shiftType: string) => {
    switch (shiftType) {
      case "morning":
        return "bg-primary";
      case "afternoon":
        return "bg-success";
      case "night":
        return "bg-accent-foreground";
      case "off":
        return "bg-muted-foreground";
      default:
        return "bg-muted-foreground";
    }
  };

  const formatTime = (time: number | Date | string | null | undefined) => {
    if (!time) return '';

    let date: Date;
    if (typeof time === 'number') {
      date = new Date(time);
    } else if (typeof time === 'string') {
      date = new Date(time);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getWeekSchedule = () => {
    const today = new Date();
    const weekSchedule = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const schedule = schedules.find(s => {
        const scheduleDate = new Date(s.date);
        return scheduleDate.toDateString() === date.toDateString();
      });
      
      weekSchedule.push({
        date,
        schedule,
        isToday: date.toDateString() === today.toDateString(),
      });
    }
    
    return weekSchedule;
  };

  const getDayLabel = (date: Date, isToday: boolean) => {
    if (isToday) return "Today";
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <Card data-testid="schedule-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-semibold">
            <Calendar className="w-5 h-5 mr-2" />
            This Week's Schedule
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80"
            onClick={() => navigate("/schedule")}
            data-testid="button-view-calendar"
          >
            View Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {getWeekSchedule().slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2" data-testid={`schedule-item-${index}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${item.schedule ? getScheduleColor(item.schedule.type) : 'bg-muted'}`} />
                  <div>
                    <p className="text-sm font-medium" data-testid={`schedule-title-${index}`}>
                      {item.schedule ?
                        (item.schedule.type === 'off' ? 'Day Off' : `${item.schedule.type.charAt(0).toUpperCase() + item.schedule.type.slice(1)} Shift`) :
                        'No Schedule'
                      }
                    </p>
                    {item.schedule && item.schedule.type !== 'off' && item.schedule.startTime && item.schedule.endTime && (
                      <p className="text-xs text-muted-foreground" data-testid={`schedule-time-${index}`}>
                        {formatTime(item.schedule.startTime)} - {formatTime(item.schedule.endTime)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground" data-testid={`schedule-day-${index}`}>
                  {getDayLabel(item.date, item.isToday)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
