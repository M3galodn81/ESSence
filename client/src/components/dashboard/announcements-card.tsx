import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Trophy, Info } from "lucide-react";
import { useLocation } from "wouter";
import type { Announcement } from "@shared/schema";

interface AnnouncementsCardProps {
  announcements: Announcement[];
  isLoading?: boolean;
}

export default function AnnouncementsCard({ announcements, isLoading }: AnnouncementsCardProps) {
  const [, navigate] = useLocation();
  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <Megaphone className="w-5 h-5 text-destructive" />;
      case "holiday":
        return <Trophy className="w-5 h-5 text-success" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const getAnnouncementBg = (type: string) => {
    switch (type) {
      case "urgent":
        return "bg-destructive/10";
      case "holiday":
        return "bg-success/10";
      default:
        return "bg-primary/10";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card data-testid="announcements-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Announcements</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80"
            onClick={() => navigate("/announcements")}
            data-testid="button-view-all-announcements"
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="flex items-start space-x-4" data-testid={`announcement-${announcement.id}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getAnnouncementBg(announcement.type || "general")}`}>
                  {getAnnouncementIcon(announcement.type || "general")}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground" data-testid={`announcement-title-${announcement.id}`}>
                    {announcement.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`announcement-content-${announcement.id}`}>
                    {announcement.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2" data-testid={`announcement-time-${announcement.id}`}>
                    {formatTimeAgo(new Date(announcement.createdAt!))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" data-testid="no-announcements">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No announcements</p>
            <p className="text-sm text-muted-foreground">Check back later for company updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
