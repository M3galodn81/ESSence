import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";

interface ActivitiesCardProps {
  activities: Activity[];
  isLoading?: boolean;
}

export default function ActivitiesCard({ activities, isLoading }: ActivitiesCardProps) {
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

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  return (
    <Card data-testid="activities-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
                    {activity.description}
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
