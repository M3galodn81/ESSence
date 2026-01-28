import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Edit, Eye, EyeOff, Users } from "lucide-react";
import type { Announcement } from "@shared/schema";

// --- Announcement Feed Item ---
interface AnnouncementFeedItemProps {
  announcement: Announcement;
  canManage: boolean;
  onEdit: (announcement: Announcement) => void;
  onToggleActive: (announcement: Announcement) => void;
}

// Announcement Feed Item Component
export function AnnouncementFeedItem({ announcement, canManage, onEdit, onToggleActive }: AnnouncementFeedItemProps) {
  
  // Type Badge
  const getTypeBadge = (type: string) => {
    // Define styles for each type
    const styles: Record<string, string> = {
      general: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
      urgent: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200 animate-pulse",
      holiday: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
      policy: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
    };

    // Return styled badge
    return (
      <Badge variant="outline" className={`${styles[type] || styles.general} border px-2 py-0.5 text-xs font-semibold transition-colors`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  // Icon based on type
  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case "urgent": return "🚨";
      case "holiday": return "🎉";
      case "policy": return "📋";
      default: return "📢";
    }
  };

  // Date and Time Formatting
  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    // Announcement Card Container
    <div 
      className={`group relative bg-white hover:bg-slate-50/50 border border-slate-200/60 hover:border-blue-200/60 rounded-2xl p-5 transition-all duration-300 hover:shadow-md hover:scale-[1.005] ${!announcement.isActive ? 'opacity-60 grayscale-[50%]' : ''}`}
      data-testid={`announcement-${announcement.id}`}
    >
      {/* Content Wrapper */}
      <div className="flex items-start gap-5">
        {/* Icon Box */}
        <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl shadow-sm group-hover:shadow-inner transition-shadow">
          {getAnnouncementIcon(announcement.type || "general")}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-slate-800 leading-none" data-testid={`announcement-title-${announcement.id}`}>
                  {announcement.title}
                </h3>
                {getTypeBadge(announcement.type || "general")}
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1">
                   <Calendar className="w-3 h-3" />
                   {formatDate(announcement.createdAt!)}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1">
                   <Clock className="w-3 h-3" />
                   {formatTime(announcement.createdAt!)}
                </span>
              </div>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-white shadow-sm border border-transparent hover:border-slate-100 rounded-lg"
                  onClick={() => onToggleActive(announcement)}
                  data-testid={`button-toggle-${announcement.id}`}
                >
                  {announcement.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg"
                  onClick={() => onEdit(announcement)}
                  data-testid={`button-edit-${announcement.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          
          <p className="text-slate-600 text-sm leading-relaxed max-w-4xl" data-testid={`announcement-content-${announcement.id}`}>
            {announcement.content}
          </p>
          
          {announcement.targetDepartments && (announcement.targetDepartments as string[]).length > 0 && (
            <div className="pt-2 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <div className="flex gap-1.5 flex-wrap">
                    {(announcement.targetDepartments as string[]).map(dept => (
                        <span key={dept} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200 font-medium uppercase tracking-wider">
                            {dept}
                        </span>
                    ))}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}