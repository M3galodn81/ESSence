import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/dashboard/stat-card";
import AnnouncementsCard from "@/components/dashboard/announcements-card";
import ActivitiesCard from "@/components/dashboard/activities-card";
import ScheduleCard from "@/components/dashboard/schedule-card";
import QuickActionsCard from "@/components/dashboard/quick-actions-card";
import PendingTasksCard from "@/components/dashboard/pending-tasks-card";
import { Calendar, Clock, AlertTriangle, GraduationCap } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities"],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/schedules"],
  });

  return (
    <div className="p-6 space-y-8">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Leave Balance"
          value={stats?.leaveBalance || "0 days"}
          icon={Calendar}
          iconColor="text-primary"
          bgColor="bg-primary/10"
          isLoading={statsLoading}
          data-testid="stat-leave-balance"
        />
        <StatCard
          title="Hours This Week"
          value={stats?.weeklyHours || "0 hrs"}
          icon={Clock}
          iconColor="text-success"
          bgColor="bg-success/10"
          isLoading={statsLoading}
          data-testid="stat-weekly-hours"
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pendingApprovals?.toString() || "0"}
          icon={AlertTriangle}
          iconColor="text-warning"
          bgColor="bg-warning/10"
          isLoading={statsLoading}
          data-testid="stat-pending-approvals"
        />
        <StatCard
          title="Training Progress"
          value={stats?.trainingProgress || "0%"}
          icon={GraduationCap}
          iconColor="text-accent-foreground"
          bgColor="bg-accent/10"
          isLoading={statsLoading}
          data-testid="stat-training-progress"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
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

        {/* Right Column */}
        <div className="space-y-8">
          <ScheduleCard
            schedules={schedules || []}
            isLoading={schedulesLoading}
          />
          <QuickActionsCard />
          <PendingTasksCard />
        </div>
      </div>
    </div>
  );
}
