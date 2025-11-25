import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search, Mail, Phone, Calendar, Building, UserPlus, Briefcase, User, Hash } from "lucide-react";
import { useState, useMemo } from "react";
import type { User as UserType } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient"; // Import apiRequest to define the new queryFn

export default function TeamManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserType | null>(null);

  const { data: teamMembers, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/team"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
  });

  // Fetch ALL users for guaranteed manager lookup
  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users/all"], // Using a distinct key to ensure no clash
    queryFn: async () => {
        const res = await apiRequest("GET", "/api/users"); 
        return await res.json();
    },
    // We need this comprehensive list if the user has broad management scope
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  // Filter out members who are admins, as they are usually managed separately, unless they are the current user
  const filteredMembers = useMemo(() => {
    if (!teamMembers) return [];

    return teamMembers
      .filter((member: UserType) => 
        member.role !== 'admin' || member.id === user?.id 
      )
      .filter((member: UserType) =>
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.position?.toLowerCase().includes(searchTerm.toLowerCase())
      ) || [];
  }, [teamMembers, searchTerm, user?.id]);

  // move this to permissions.ts
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
  
  // Use allUsers if available, otherwise fall back to teamMembers (which is guaranteed to have the current user's direct reports or all users if admin)
  const getManagerName = (managerId: string | null | undefined) => {
    if (!managerId || managerId === "") return "N/A";
    
    // Prioritize the comprehensive list for manager lookup
    const userList = allUsers || teamMembers;

    const manager = userList?.find((m: UserType) => m.id === managerId);
    
    return manager ? `${manager.firstName} ${manager.lastName}` : "Unknown Manager (ID Missing)";
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      employee: "bg-muted text-muted-foreground",
      manager: "bg-primary text-primary-foreground",
      admin: "bg-red-600 text-white",
    };

    return (
      <Badge className={colors[role as keyof typeof colors] || colors.employee}>
        {role.replace(/_/g, " ").toUpperCase()}
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
    if (!teamMembers) return { total: 0, active: 0 };
    
    const total = teamMembers.length;
    const active = teamMembers.filter((member: UserType) => member.isActive).length;
    
    return { total, active };
  };

  const stats = getTeamStats();
  
  const handleViewDetails = (member: UserType) => {
    setSelectedMember(member);
    setIsViewDialogOpen(true);
  };

  const handleEditMember = (member: UserType) => {
    setSelectedMember(member);
    setIsEditDialogOpen(true);
  };


  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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

        {/* Stats Grid (Modified to 3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <p className="text-sm font-medium text-muted-foreground">Manager Count</p>
                  <p className="text-2xl font-bold" data-testid="manager-count">
                    {teamMembers?.filter((m: UserType) => m.role === 'manager').length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs (Departments removed) */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList data-testid="team-tabs">
            <TabsTrigger value="members" data-testid="tab-members">Team Members</TabsTrigger>
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
                ) : filteredMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMembers.map((member: UserType) => (
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
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1" 
                                  data-testid={`button-view-${member.id}`}
                                  onClick={() => handleViewDetails(member)}
                                >
                                  View Details
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1" 
                                  data-testid={`button-edit-${member.id}`}
                                //   onClick={() => handleEditMember(member)}
                                >
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
        </Tabs>
        
        {/* 🟢 View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Employee Details</DialogTitle>
                    <DialogDescription>
                        Full profile information for {selectedMember?.firstName} {selectedMember?.lastName}
                    </DialogDescription>
                </DialogHeader>
                {selectedMember && (
                    <div className="space-y-4 pt-4">
                        <div className="flex flex-col items-center space-y-3 pb-4 border-b">
                            <Avatar className="w-20 h-20">
                                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                                    {getInitials(selectedMember.firstName, selectedMember.lastName)}
                                </AvatarFallback>
                            </Avatar>
                            <h3 className="text-xl font-bold">{selectedMember.firstName} {selectedMember.lastName}</h3>
                            <div className="flex space-x-2">
                                {getRoleBadge(selectedMember.role)}
                                {getStatusBadge(selectedMember.isActive!)}
                            </div>
                        </div>
                        
                        <div className="space-y-3 text-sm">
                            <DetailRow icon={Mail} label="Email" value={selectedMember.email} />
                            <DetailRow icon={User} label="Username" value={selectedMember.username} />
                            <DetailRow icon={Briefcase} label="Position" value={selectedMember.position || 'N/A'} />
                            <DetailRow icon={Building} label="Department" value={selectedMember.department || 'N/A'} />
                            {selectedMember.role === 'employee' && selectedMember.managerId && (
                                <DetailRow icon={Users} label="Manager" value={getManagerName(selectedMember.managerId)} />
                            )}
                            <DetailRow icon={Phone} label="Phone" value={selectedMember.phoneNumber || 'N/A'} />
                            <DetailRow icon={Hash} label="ID" value={selectedMember.employeeId || 'N/A'} />
                            <DetailRow icon={Calendar} label="Hire Date" value={formatDate(selectedMember.hireDate)} />
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>

        {/* 🟢 Edit Member Dialog (Placeholder for consistency with UserManagement.tsx) */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Member</DialogTitle>
                    <DialogDescription>
                        For full editing capabilities, please use the dedicated User Management page.
                    </DialogDescription>
                </DialogHeader>
                <div className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Editing a user's profile requires complex form handling and permission checks, which are centralized in the "User Management" section.
                    </p>
                    {selectedMember && (
                        <p className="font-medium">
                            Currently attempting to edit: **{selectedMember.firstName} {selectedMember.lastName}**
                        </p>
                    )}
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={() => setIsEditDialogOpen(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Helper component for detail rows
const DetailRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="flex justify-between items-start border-b pb-2 last:border-b-0 last:pb-0">
        <div className="flex items-center space-x-2 text-muted-foreground">
            <Icon className="w-4 h-4" />
            <span className="font-medium">{label}</span>
        </div>
        <span className="text-sm text-right text-foreground font-semibold">{value}</span>
    </div>
);