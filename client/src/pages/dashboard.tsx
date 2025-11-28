import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/dashboard/stat-card";
import AnnouncementsCard from "@/components/dashboard/announcements-card";
import ActivitiesCard from "@/components/dashboard/activities-card";
import ScheduleCard from "@/components/dashboard/schedule-card";
import QuickActionsCard from "@/components/dashboard/quick-actions-card";
import PendingTasksCard from "@/components/dashboard/pending-tasks-card";
import { Calendar, Clock, AlertTriangle, GraduationCap } from "lucide-react";
import { canViewDashoardHoursThisWeek, canViewDashoardLeaveBalance, canViewDashoardWeekSchedule } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities/all"],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/schedules"],
  });

  const { user } = useAuth();

  return (
    <div className="p-6 md:p-8 space-y-8">
      
      {/* 1. Bento Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {canViewDashoardLeaveBalance(user) && (
          <StatCard
            title="Leave Balance"
            value={stats?.leaveBalance || "0 days"}
            icon={Calendar}
            variant="blue"
            isLoading={statsLoading}
            testId="stat-leave-balance"
          />
        )}
        {canViewDashoardHoursThisWeek(user) && (
          <StatCard
            title="Hours This Week"
            value={stats?.weeklyHours || "0 hrs"}
            icon={Clock}
            variant="emerald"
            isLoading={statsLoading}
            testId="stat-weekly-hours"
          />
        )}
        <StatCard
          title="Pending Approvals"
          value={stats?.pendingApprovals?.toString() || "0"}
          icon={AlertTriangle}
          variant="amber"
          isLoading={statsLoading}
          testId="stat-pending-approvals"
        />
        {/* Example of a 4th card or placeholder */}
        {/* <StatCard
          title="Training Progress"
          value={stats?.trainingProgress || "0%"}
          icon={GraduationCap}
          variant="rose"
          isLoading={statsLoading}
          testId="stat-training-progress"
        /> */}
      </div>

      {/* 2. Main Content Grid (Asymmetric Bento) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Feeds (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          <AnnouncementsCard
            announcements={announcements || []}
            isLoading={announcementsLoading}
          />
          <ActivitiesCard
            activities={activities || []}
            isLoading={activitiesLoading}
          />
        </div>

        {/* Right Column: Tools & Tasks (1/3 width) */}
        <div className="space-y-8">
          <QuickActionsCard />
          
          {canViewDashoardWeekSchedule(user) && (
            <ScheduleCard
              schedules={schedules || []}
              isLoading={schedulesLoading}
            />
          )}
          
          <PendingTasksCard />
        </div>
      </div>
    </div>
  );
}