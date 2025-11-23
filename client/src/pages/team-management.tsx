import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search, Mail, Phone, Calendar, Building, UserPlus } from "lucide-react";
import { useState } from "react";
import type { User } from "@shared/schema";

export default function TeamManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["/api/team"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
  });

  const canManageTeam = user?.role === 'manager' || user?.role === 'admin';

  if (!canManageTeam) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                You need manager or admin privileges to access team management features.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const filteredTeamMembers = teamMembers?.filter((member: User) =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.position?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      employee: "bg-muted text-muted-foreground",
      manager: "bg-primary text-primary-foreground",
      admin: "bg-red-600 text-white",
    };

    return (
      <Badge className={colors[role as keyof typeof colors] || colors.employee}>
        {role.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-success text-white">Active</Badge>
    ) : (
      <Badge variant="destructive">Inactive</Badge>
    );
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not specified";
    return new Date(date).toLocaleDateString();
  };

  const getTeamStats = () => {
    if (!teamMembers) return { total: 0, active: 0, departments: 0 };
    
    const total = teamMembers.length;
    const active = teamMembers.filter((member: User) => member.isActive).length;
    const departments = new Set(teamMembers.map((member: User) => member.department).filter(Boolean)).size;
    
    return { total, active, departments };
  };

  const getDepartmentBreakdown = () => {
    if (!teamMembers) return {};
    
    return teamMembers.reduce((acc: any, member: User) => {
      const dept = member.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
  };

  const stats = getTeamStats();
  const departmentBreakdown = getDepartmentBreakdown();

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Team Management</h1>
            <p className="text-muted-foreground">
              Manage your team members and organizational structure
            </p>
          </div>
          <Button data-testid="button-add-member">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Team Member
          </Button>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold" data-testid="total-members">
                    {stats.total}
                  </p>
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
                  <p className="text-sm font-medium text-muted-foreground">Active Members</p>
                  <p className="text-2xl font-bold" data-testid="active-members">
                    {stats.active}
                  </p>
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
                  <p className="text-sm font-medium text-muted-foreground">Departments</p>
                  <p className="text-2xl font-bold" data-testid="department-count">
                    {stats.departments}
                  </p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New This Month</p>
                  <p className="text-2xl font-bold" data-testid="new-members">
                    {}
                    2
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList data-testid="team-tabs">
            <TabsTrigger value="members" data-testid="tab-members">Team Members</TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Team Members
                    </CardTitle>
                    <CardDescription>Manage and view team member details</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search team members..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                        data-testid="search-members"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8" data-testid="loading-members">
                    <p className="text-muted-foreground">Loading team members...</p>
                  </div>
                ) : filteredTeamMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTeamMembers.map((member: User) => (
                      <Card key={member.id} className="hover:shadow-md transition-shadow" data-testid={`member-${member.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-medium truncate" data-testid={`member-name-${member.id}`}>
                                    {member.firstName} {member.lastName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground" data-testid={`member-position-${member.id}`}>
                                    {member.position || "No position"}
                                  </p>
                                </div>
                                <div className="flex flex-col space-y-1">
                                  {getRoleBadge(member.role)}
                                  {getStatusBadge(member.isActive!)}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center space-x-2">
                                  <Mail className="w-3 h-3 text-muted-foreground" />
                                  <span className="truncate" data-testid={`member-email-${member.id}`}>
                                    {member.email}
                                  </span>
                                </div>
                                {member.phoneNumber && (
                                  <div className="flex items-center space-x-2">
                                    <Phone className="w-3 h-3 text-muted-foreground" />
                                    <span data-testid={`member-phone-${member.id}`}>
                                      {member.phoneNumber}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-2">
                                  <Building className="w-3 h-3 text-muted-foreground" />
                                  <span data-testid={`member-department-${member.id}`}>
                                    {member.department || "No department"}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  <span data-testid={`member-hire-date-${member.id}`}>
                                    Hired {formatDate(member.hireDate)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex space-x-2 mt-4">
                                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${member.id}`}>
                                  View Details
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-edit-${member.id}`}>
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8" data-testid="no-members-found">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No team members found matching your search" : "No team members found"}
                    </p>
                    {searchTerm && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchTerm("")}
                        className="mt-2"
                        data-testid="button-clear-search"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="w-5 h-5 mr-2" />
                  Department Overview
                </CardTitle>
                <CardDescription>Team distribution across departments</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(departmentBreakdown).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(departmentBreakdown).map(([department, count]) => (
                      <Card key={department} data-testid={`department-${department}`}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium" data-testid={`department-name-${department}`}>
                                {department}
                              </h3>
                              <p className="text-sm text-muted-foreground">Department</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold" data-testid={`department-count-${department}`}>
                                {count as number}
                              </p>
                              <p className="text-sm text-muted-foreground">Members</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8" data-testid="no-departments">
                    <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No department data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
