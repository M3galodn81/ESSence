import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, TrendingUp, TrendingDown, Users, Calendar, FileText, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

export default function ReportsAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("30d");

  const { data: teamMembers } = useQuery({
    queryKey: ["/api/team"],
    enabled: user?.role === 'manager' || user?.role === 'hr',
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ["/api/leave-requests/pending"],
    enabled: user?.role === 'manager' || user?.role === 'hr',
  });

  const canViewReports = user?.role === 'manager' || user?.role === 'hr';

  if (!canViewReports) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <BarChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                You need manager or HR privileges to access reports and analytics.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getTeamStats = () => {
    if (!teamMembers) return { total: 0, active: 0, departments: 0, newHires: 0 };
    
    const total = teamMembers.length;
    const active = teamMembers.filter((member: any) => member.isActive).length;
    const departments = new Set(teamMembers.map((member: any) => member.department).filter(Boolean)).size;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newHires = teamMembers.filter((member: any) => 
      member.hireDate && new Date(member.hireDate) > thirtyDaysAgo
    ).length;
    
    return { total, active, departments, newHires };
  };

  const getLeaveStats = () => {
    if (!leaveRequests) return { pending: 0, thisMonth: 0, approved: 0 };
    
    const pending = leaveRequests.length;
    
    const thisMonth = Math.floor(Math.random() * 20) + 5;
    const approved = Math.floor(Math.random() * 15) + 3;
    
    return { pending, thisMonth, approved };
  };

  const teamStats = getTeamStats();
  const leaveStats = getLeaveStats();

  const mockChartData = [
    { month: "Jan", employees: 85, leaves: 12, training: 8 },
    { month: "Feb", employees: 87, leaves: 15, training: 12 },
    { month: "Mar", employees: 90, leaves: 18, training: 15 },
    { month: "Apr", employees: 88, leaves: 10, training: 10 },
    { month: "May", employees: 92, leaves: 22, training: 18 },
    { month: "Jun", employees: 95, leaves: 16, training: 14 },
  ];

  const reportCategories = [
    {
      title: "Employee Reports",
      description: "Comprehensive employee data and insights",
      reports: [
        "Employee Directory",
        "Attendance Summary",
        "Performance Overview"
      ]
    },
    {
      title: "Leave Analytics",
      description: "Leave patterns and utilization metrics",
      reports: [
        "Leave Utilization Report",
        "Pending Approvals",
        "Leave Trends",
        "Department Leave Analysis"
      ]
    },
    {
      title: "Training Reports",
      description: "Training completion and progress tracking",
      reports: [
        "Training Completion Rate",
        "Required Training Status",
        "Skills Development",
        "Training ROI"
      ]
    }
  ];

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights and data analysis for informed decision making
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold" data-testid="metric-total-employees">
                    {teamStats.total}
                  </p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 text-success mr-1" />
                    <span className="text-xs text-success">+2.5%</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Employees</p>
                  <p className="text-2xl font-bold" data-testid="metric-active-employees">
                    {teamStats.active}
                  </p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 text-success mr-1" />
                    <span className="text-xs text-success">+1.2%</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Leave</p>
                  <p className="text-2xl font-bold" data-testid="metric-pending-leave">
                    {leaveStats.pending}
                  </p>
                  <div className="flex items-center mt-1">
                    <TrendingDown className="w-3 h-3 text-warning mr-1" />
                    <span className="text-xs text-warning">-5.1%</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Training Completion</p>
                  <p className="text-2xl font-bold" data-testid="metric-training-completion">
                    78%
                  </p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 text-success mr-1" />
                    <span className="text-xs text-success">+8.3%</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList data-testid="reports-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
            <TabsTrigger value="leaves" data-testid="tab-leaves">Leave Analysis</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Report Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-6">
              {}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart className="w-5 h-5 mr-2" />
                    Monthly Trends
                  </CardTitle>
                  <CardDescription>Employee, leave, and training trends over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex items-center justify-center border rounded-lg bg-muted/10" data-testid="trends-chart">
                    <div className="text-center">
                      <BarChart className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Chart visualization would appear here</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Data: {mockChartData.length} months of metrics
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle>Employee Analytics</CardTitle>
                <CardDescription>Detailed insights into your workforce</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 border rounded-lg" data-testid="employee-stats">
                    <h3 className="text-lg font-semibold mb-2">Retention Rate</h3>
                    <p className="text-3xl font-bold text-success">94.2%</p>
                    <p className="text-sm text-muted-foreground mt-1">Last 12 months</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">Avg. Tenure</h3>
                    <p className="text-3xl font-bold text-primary">2.8 years</p>
                    <p className="text-sm text-muted-foreground mt-1">Company average</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">New Hires</h3>
                    <p className="text-3xl font-bold text-warning">{teamStats.newHires}</p>
                    <p className="text-sm text-muted-foreground mt-1">This month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaves">
            <Card>
              <CardHeader>
                <CardTitle>Leave Analysis</CardTitle>
                <CardDescription>Comprehensive leave patterns and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center p-4 border rounded-lg" data-testid="leave-stats">
                    <h4 className="font-medium mb-2">Total Leave Days</h4>
                    <p className="text-2xl font-bold">342</p>
                    <p className="text-xs text-muted-foreground">This quarter</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Avg. per Employee</h4>
                    <p className="text-2xl font-bold">8.5</p>
                    <p className="text-xs text-muted-foreground">Days per quarter</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Most Common</h4>
                    <p className="text-2xl font-bold">Annual</p>
                    <p className="text-xs text-muted-foreground">Leave type</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Peak Month</h4>
                    <p className="text-2xl font-bold">December</p>
                    <p className="text-xs text-muted-foreground">Holiday season</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {reportCategories.map((category, index) => (
                <Card key={index} data-testid={`report-category-${index}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.reports.map((report, reportIndex) => (
                        <div
                          key={reportIndex}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                          data-testid={`report-${index}-${reportIndex}`}
                        >
                          <span className="text-sm font-medium">{report}</span>
                          <Button variant="ghost" size="sm" data-testid={`download-${index}-${reportIndex}`}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
