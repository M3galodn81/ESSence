import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/dashboard/stat-card";
import AnnouncementsCard from "@/components/dashboard/announcements-card";
import ActivitiesCard from "@/components/dashboard/activities-card";
import ScheduleCard from "@/components/dashboard/schedule-card";
import QuickActionsCard from "@/components/dashboard/quick-actions-card";
import PendingTasksCard from "@/components/dashboard/pending-tasks-card";
// import LaborCostCard from "@/components/dashboard/labor-cost-card"; // Assuming this new component exists
import { Calendar, Clock, AlertTriangle, Wallet, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";

export default function Dashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermission();

  // Granular permission checks
  const canViewTeam = hasPermission(Permission.VIEW_TEAM_ATTENDANCE);
  const canViewLabor = hasPermission(Permission.VIEW_LABOR_COST);
  const canViewOwnLeaves = hasPermission(Permission.VIEW_OWN_LEAVES);
  const canViewOwnAttendance = hasPermission(Permission.VIEW_OWN_ATTENDANCE);
  const canViewSchedule = hasPermission(Permission.VIEW_OWN_SCHEDULE);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  // Dynamically fetch all activities or just personal activities based on permissions
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: canViewTeam ? ["/api/activities/all"] : ["/api/activities"],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/schedules"],
    enabled: canViewSchedule, // Optimization: only fetch if permitted
  });

  return (
    <div className="p-6 md:p-8 space-y-8">
      
      {/* 1. Bento Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Manager/Admin: Show Team Strength instead of personal leave */}
        {canViewTeam ? (
           <StatCard
            title="Team Present"
            value={stats?.activeStaffCount?.toString() || "0/12"}
            icon={Users}
            variant="blue"
            isLoading={statsLoading}
            testId="stat-team-present"
          />
        ) : (
          canViewOwnLeaves && (
            <StatCard
              title="Leave Balance"
              value={stats?.leaveBalance || "0 days"}
              icon={Calendar}
              variant="blue"
              isLoading={statsLoading}
              testId="stat-leave-balance"
            />
          )
        )}

        {/* Manager/Admin: Show Labor Cost vs Sales */}
        {canViewLabor ? (
           <StatCard
            title="Labor Cost %"
            value={stats?.laborCostPercentage ? `${stats.laborCostPercentage}%` : "--"}
            icon={Wallet}
            variant={stats?.laborCostPercentage > 30 ? "rose" : "emerald"}
            isLoading={statsLoading}
            testId="stat-labor-cost"
          />
        ) : (
          canViewOwnAttendance && (
            <StatCard
              title="Hours This Week"
              value={stats?.weeklyHours || "0 hrs"}
              icon={Clock}
              variant="emerald"
              isLoading={statsLoading}
              testId="stat-weekly-hours"
            />
          )
        )}

        <StatCard
          title="Pending Approvals"
          value={stats?.pendingApprovals?.toString() || "0"}
          icon={AlertTriangle}
          variant="amber"
          isLoading={statsLoading}
          testId="stat-pending-approvals"
        />
        
        {/* Universal Stat */}
        <StatCard
          title="Next Shift"
          value={stats?.nextShiftStart ? new Date(stats.nextShiftStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "None"}
          icon={Calendar}
          variant="purple"
          isLoading={statsLoading}
          testId="stat-next-shift"
        />
      </div>

      {/* 2. Main Content Grid (Asymmetric Bento) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Operations/Feeds (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Manager Exclusive: Analytics Snapshot */}
          {/* {canViewLabor && (
             <LaborCostCard 
                data={stats?.laborTrends || []} 
                isLoading={statsLoading} 
             />
          )} */}

          <AnnouncementsCard
            announcements={announcements || []}
            isLoading={announcementsLoading}
          />
          
          {/* Only show recent activities if not viewing labor costs (managers have analytics instead to save space) */}
          {!canViewLabor && (
            <ActivitiesCard
              activities={activities || []}
              isLoading={activitiesLoading}
            />
          )}

          <PendingTasksCard />
        </div>

        {/* Right Column: Tools & Tasks (1/3 width) */}
        <div className="space-y-8">
          <QuickActionsCard />
          
          {canViewSchedule && (
            <ScheduleCard
              schedules={schedules || []}
              isLoading={schedulesLoading}
            />
          )}
          
          
        </div>
      </div>
    </div>
  );
}