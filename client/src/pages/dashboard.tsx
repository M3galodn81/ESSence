import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/dashboard/stat-card";
import AnnouncementsCard from "@/components/dashboard/announcements-card";
import ActivitiesCard from "@/components/dashboard/activities-card";
import ScheduleCard from "@/components/dashboard/schedule-card";
import QuickActionsCard from "@/components/dashboard/quick-actions-card";
import PendingTasksCard from "@/components/dashboard/pending-tasks-card";
// import LaborCostCard from "@/components/dashboard/labor-cost-card"; // Assuming this new component exists
import { Calendar, Clock, AlertTriangle, Wallet, Users } from "lucide-react";
import { canViewDashoardHoursThisWeek, canViewDashoardLeaveBalance, canViewDashoardWeekSchedule } from "@/utils/permissions";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["/api/announcements"],
  });

  const { data: activities, isLoading: activitiesLoading } = 
  isManager ? useQuery({
    queryKey: ["/api/activities/all"],
  }) : useQuery({
    queryKey: ["/api/activities"],
  });


  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/schedules"],
  });

  return (
    <div className="p-6 md:p-8 space-y-8">
      
      {/* 1. Bento Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Manager: Show Team Strength instead of personal leave */}
        {isManager ? (
           <StatCard
            title="Team Present"
            value={stats?.activeStaffCount?.toString() || "0/12"}
            icon={Users}
            variant="blue"
            isLoading={statsLoading}
            testId="stat-team-present"
          />
        ) : (
          canViewDashoardLeaveBalance(user) && (
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

        {/* Manager: Show Labor Cost vs Sales */}
        {isManager ? (
           <StatCard
            title="Labor Cost %"
            value={stats?.laborCostPercentage ? `${stats.laborCostPercentage}%` : "--"}
            icon={Wallet}
            variant={stats?.laborCostPercentage > 30 ? "rose" : "emerald"}
            isLoading={statsLoading}
            testId="stat-labor-cost"
          />
        ) : (
          canViewDashoardHoursThisWeek(user) && (
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
          {/* {isManager && (
             <LaborCostCard 
                data={stats?.laborTrends || []} 
                isLoading={statsLoading} 
             />
          )} */}

          <AnnouncementsCard
            announcements={announcements || []}
            isLoading={announcementsLoading}
          />
          
          {/* Only show recent activities if not a manager (managers have analytics instead to save space) */}
          {!isManager && (
            <ActivitiesCard
              activities={activities || []}
              isLoading={activitiesLoading}
            />
          )}
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