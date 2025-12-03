import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { CalendarClock, CheckCircle2, XCircle, LogIn, LogOut } from "lucide-react";

export default function ActivitiesCard() {
  const { user } = useAuth();

  // Admins see all system activities, Employees see only their own
  const queryKey = user?.role === 'admin' ? "/api/activities/all" : "/api/activities";

  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: [queryKey],
    enabled: !!user, // Wait for user to be loaded
  });

  const getActivityColor = (type: string) => {
    switch (type) {
      case "leave_approved": return "text-emerald-500 bg-emerald-50 ring-emerald-100";
      case "leave_rejected": return "text-rose-500 bg-rose-50 ring-rose-100";
      case "clock_in": return "text-blue-500 bg-blue-50 ring-blue-100";
      case "clock_out": return "text-amber-500 bg-amber-50 ring-amber-100";
      case "break_start": return "text-orange-500 bg-orange-50 ring-orange-100";
      case "break_end": return "text-indigo-500 bg-indigo-50 ring-indigo-100";
      default: return "text-slate-500 bg-slate-50 ring-slate-100";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "leave_approved": return <CheckCircle2 className="w-3 h-3" />;
      case "leave_rejected": return <XCircle className="w-3 h-3" />;
      case "clock_in": return <LogIn className="w-3 h-3" />;
      case "clock_out": return <LogOut className="w-3 h-3" />;
      default: return <CalendarClock className="w-3 h-3" />;
    }
  };

  const getUserName = (activity: Activity) => {
    const details = activity.details as any;
    return details?.userName || "System";
  };

  const formatTimeAgo = (dateStr: Date | string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl flex flex-col" data-testid="activities-card">
      <CardHeader className="pb-3 border-b border-slate-100/50">
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <CalendarClock className="w-5 h-5 text-primary" />
           Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[350px]">
          <div className="p-5">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="relative border-l-2 border-slate-100 ml-3.5 space-y-8 pb-2">
                {activities.map((activity) => (
                  <div key={activity.id} className="ml-6 relative group">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[31px] top-1 h-7 w-7 rounded-full ring-4 ring-white flex items-center justify-center transition-transform group-hover:scale-110 ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-slate-600 leading-snug">
                        <span className="font-semibold text-slate-900 block mb-0.5">
                          {getUserName(activity)}
                        </span>
                        <span className="capitalize">
                          {activity.type.replace(/_/g, " ")}
                        </span>
                      </p>
                      <span className="text-xs font-medium text-slate-400">
                        {formatTimeAgo(activity.createdAt!)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm">No recent activities found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}