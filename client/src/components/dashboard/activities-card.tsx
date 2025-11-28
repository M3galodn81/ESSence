import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity, User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivitiesCardProps {
  activities: Activity[];
  isLoading?: boolean;
}

export default function ActivitiesCard({ activities, isLoading: activitiesLoading }: ActivitiesCardProps) {
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users/"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/"); 
      return res.json();
    }
  });

  const userMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return users.reduce((map, user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
      return map;
    }, new Map<string, string>());
  }, [users]);

  const getUserName = (userId: string) => userMap.get(userId) || "Unknown User";
  const isOverallLoading = activitiesLoading || usersLoading;

  const getActivityColor = (type: string) => {
    switch (type) {
      case "leave_approved": return "bg-emerald-500";
      case "leave_rejected": return "bg-rose-500";
      case "clock_in": return "bg-blue-500";
      case "clock_out": return "bg-amber-500";
      default: return "bg-slate-400";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl h-full" data-testid="activities-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-slate-800">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {isOverallLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="relative border-l border-slate-200 ml-3 space-y-6 my-2">
              {activities.map((activity) => (
                <div key={activity.id} className="ml-4 relative">
                  <div className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${getActivityColor(activity.type)}`} />
                  <div className="flex flex-col">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{getUserName(activity.userId)}</span>{" "}
                      {activity.type.replace(/_/g, " ")}
                    </p>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {formatTimeAgo(new Date(activity.createdAt!))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm">No recent activities</div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}