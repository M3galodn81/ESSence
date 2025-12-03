import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Trophy, Info, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { Announcement } from "@shared/schema";

interface AnnouncementsCardProps {
  announcements: Announcement[];
  isLoading?: boolean;
}

export default function AnnouncementsCard({ announcements, isLoading }: AnnouncementsCardProps) {
  const [, navigate] = useLocation();
  
  const getIcon = (type: string) => {
    switch (type) {
      case "urgent": return <Megaphone className="w-5 h-5 text-rose-500" />;
      case "holiday": return <Trophy className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl" data-testid="announcements-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold text-slate-800">Announcements</CardTitle>
        <Button variant="link" className="text-xs h-auto p-0 text-slate-500 hover:text-primary" onClick={() => navigate("/announcements")}>
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : announcements.length > 0 ? (
          <div className="grid gap-4">
            {announcements.slice(0, 2).map((announcement) => (
              <div key={announcement.id} className="group flex items-start gap-4 p-4 rounded-2xl bg-white/50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all shadow-sm hover:shadow-md cursor-pointer" onClick={() => navigate("/announcements")}>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:scale-105 transition-transform">
                  {getIcon(announcement.type || "general")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-slate-800 truncate pr-2">{announcement.title}</h4>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(announcement.createdAt!).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {announcement.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No new announcements
          </div>
        )}
      </CardContent>
    </Card>
  );
}