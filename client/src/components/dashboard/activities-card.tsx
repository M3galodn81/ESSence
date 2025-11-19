import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";
import { storage } from "server/storage";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface ActivitiesCardProps {
  activities: Activity[];
  isLoading?: boolean;
}

export default function ActivitiesCard({ activities, isLoading: activitiesLoading }: ActivitiesCardProps) {
  // Fetch all users to map user IDs to names
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users/"], // An endpoint that returns all users
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/"); 
      return res.json();
    }
  });

  // Memoized map of user IDs to names
  const userMap = useMemo(() => {
    if (!users) {
      return new Map<string, string>();
    }
    // Creates a Map from user ID to full name
    return users.reduce((map, user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
      return map;
    }, new Map<string, string>());
    
  }, [users]);

  const getUserName = (userId: string) => {
    return userMap.get(userId) || "Unknown User";
  };

  const isOverallLoading = activitiesLoading || usersLoading;
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case "leave_approved":
        return "bg-success";
      case "leave_rejected":
        return "bg-destructive";
      case "training_completed":
        return "bg-primary";
      case "profile_updated":
        return "bg-muted-foreground";
      case "document_uploaded":
        return "bg-warning";
      default:
        return "bg-muted-foreground";
    }
  };

  const getActivityText = (type: string) => {
    switch (type) {
      case "leave_approved":
        return "approved a leave request";
      case "leave_rejected":
        return "rejected a leave request";
      case "leave_requested":
        return "requested leave";
      case "profile_updated":
        return "updated profile information";
      case "report_created":
        return "created a new report";
      default:
        return type;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card data-testid="activities-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {isOverallLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="w-2 h-2 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4" data-testid={`activity-${activity.id}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getActivityColor(activity.type)}`} />
                <div className="flex-1">
                  <p className="text-sm text-foreground" data-testid={`activity-description-${activity.id}`}>
                    <strong className="font-medium">{getUserName(activity.userId)}</strong> {getActivityText(activity.type)}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`activity-time-${activity.id}`}>
                    {formatTimeAgo(new Date(activity.createdAt!))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" data-testid="no-activities">
            <p className="text-muted-foreground">No recent activities</p>
            <p className="text-sm text-muted-foreground">Your activities will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}