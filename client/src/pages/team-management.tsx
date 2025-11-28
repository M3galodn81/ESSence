import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Search, Mail, Phone, Calendar, Building, UserPlus, Briefcase, User, Hash, Shield, CheckCircle, XCircle } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { BentoCard } from "@/components/custom/bento-card";

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
    queryKey: ["/api/users/all"], 
    queryFn: async () => {
        const res = await apiRequest("GET", "/api/users"); 
        return await res.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

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
      <div className="p-8 flex justify-center items-center h-screen">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-8 h-8" />
            </div>
            <p className="text-slate-500">You need manager or admin privileges to access team management features.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const getManagerName = (managerId: string | null | undefined) => {
    if (!managerId || managerId === "") return "N/A";
    const userList = allUsers || teamMembers;
    const manager = userList?.find((m: UserType) => m.id === managerId);
    return manager ? `${manager.firstName} ${manager.lastName}` : "Unknown Manager";
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      employee: "bg-slate-100 text-slate-600 border-slate-200",
      manager: "bg-indigo-100 text-indigo-700 border-indigo-200",
      admin: "bg-rose-100 text-rose-700 border-rose-200",
      payroll_officer: "bg-blue-100 text-blue-700 border-blue-200"
    };
    const style = styles[role as keyof typeof styles] || styles.employee;

    return (
      <Badge variant="outline" className={`${style} border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>
        {role.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 px-2 py-0.5 text-[10px]">
        <CheckCircle className="w-3 h-3" /> Active
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1 px-2 py-0.5 text-[10px]">
        <XCircle className="w-3 h-3" /> Inactive
      </Badge>
    );
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not specified";
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getTeamStats = () => {
    if (!teamMembers) return { total: 0, active: 0, managers: 0 };
    const total = teamMembers.length;
    const active = teamMembers.filter((member: UserType) => member.isActive).length;
    const managers = teamMembers.filter((member: UserType) => member.role === 'manager').length;
    return { total, active, managers };
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Team Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your team members and organizational structure</p>
        </div>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6" data-testid="button-add-member">
            <UserPlus className="w-4 h-4 mr-2" /> Add Team Member
        </Button>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BentoCard title="Total Members" value={stats.total} icon={Users} variant="default" testIdPrefix="total-members" />
        <BentoCard title="Active Members" value={stats.active} icon={CheckCircle} variant="emerald" testIdPrefix="active-members" />
        <BentoCard title="Managers" value={stats.managers} icon={Briefcase} variant="amber" testIdPrefix="manager-count" />
      </div>

      {/* Tabs & List */}
      <Tabs defaultValue="members" className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/60 shadow-sm">
            <TabsList className="bg-transparent p-0 h-auto" data-testid="team-tabs">
                <TabsTrigger value="members" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-members">Team Members</TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search team members..." 
                    className="pl-9 h-9 w-full sm:w-64 border-none bg-slate-100/50 focus:bg-white focus:ring-0 rounded-xl transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="search-members"
                />
            </div>
        </div>

        <TabsContent value="members" className="mt-0 focus-visible:outline-none">
            {isLoading ? (
                <div className="text-center py-12 text-slate-400">Loading team members...</div>
            ) : filteredMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMembers.map((member: UserType) => (
                    <Card key={member.id} className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group" data-testid={`member-${member.id}`}>
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                                        <AvatarImage src={member.profilePicture || ""} />
                                        <AvatarFallback className="bg-slate-100 text-slate-600 text-lg font-bold">
                                            {getInitials(member.firstName, member.lastName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{member.firstName} {member.lastName}</h3>
                                        <p className="text-xs text-slate-500">{member.position || "No position"}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mb-6">
                                {getRoleBadge(member.role)}
                                {getStatusBadge(member.isActive!)}
                            </div>

                            <div className="space-y-2.5 mb-6">
                                <div className="flex items-center text-sm text-slate-600">
                                    <Mail className="w-4 h-4 mr-3 text-slate-400" />
                                    <span className="truncate">{member.email}</span>
                                </div>
                                <div className="flex items-center text-sm text-slate-600">
                                    <Building className="w-4 h-4 mr-3 text-slate-400" />
                                    <span className="truncate">{member.department || "No department"}</span>
                                </div>
                                {member.phoneNumber && (
                                    <div className="flex items-center text-sm text-slate-600">
                                        <Phone className="w-4 h-4 mr-3 text-slate-400" />
                                        <span>{member.phoneNumber}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100/50">
                                <Button variant="outline" className="w-full rounded-xl border-slate-200 hover:bg-slate-50" onClick={() => handleViewDetails(member)}>
                                    View Details
                                </Button>
                                <Button variant="ghost" className="w-full rounded-xl hover:bg-slate-100 text-slate-600" onClick={() => handleEditMember(member)}>
                                    Edit
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No team members found.</p>
                    {searchTerm && <Button variant="link" onClick={() => setSearchTerm("")} className="mt-2 text-slate-900">Clear Search</Button>}
                </div>
            )}
        </TabsContent>
      </Tabs>
      
      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[450px] rounded-2xl">
              <DialogHeader>
                  <DialogTitle>Employee Details</DialogTitle>
                  <DialogDescription>Full profile information for {selectedMember?.firstName} {selectedMember?.lastName}</DialogDescription>
              </DialogHeader>
              {selectedMember && (
                  <div className="space-y-6 pt-4">
                      <div className="flex flex-col items-center space-y-3 pb-6 border-b border-slate-100">
                          <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                              <AvatarImage src={selectedMember.profilePicture || ""} />
                              <AvatarFallback className="text-3xl bg-slate-100 text-slate-600">
                                  {getInitials(selectedMember.firstName, selectedMember.lastName)}
                              </AvatarFallback>
                          </Avatar>
                          <div className="text-center">
                              <h3 className="text-2xl font-bold text-slate-900">{selectedMember.firstName} {selectedMember.lastName}</h3>
                              <p className="text-slate-500">{selectedMember.position || "No position"}</p>
                          </div>
                          <div className="flex gap-2">
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
                          <DetailRow icon={Hash} label="Employee ID" value={selectedMember.employeeId || 'N/A'} />
                          <DetailRow icon={Calendar} label="Hire Date" value={formatDate(selectedMember.hireDate)} />
                      </div>
                  </div>
              )}
          </DialogContent>
      </Dialog>

      {/* Edit Dialog (Placeholder) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                  <DialogTitle>Edit Member</DialogTitle>
                  <DialogDescription>
                      For full editing capabilities, please use the dedicated User Management page.
                  </DialogDescription>
              </DialogHeader>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                  <p>Editing a user's profile requires complex form handling and permission checks, which are centralized in the <strong>User Management</strong> section.</p>
                  {selectedMember && (
                      <div className="mt-4 font-medium text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4" /> {selectedMember.firstName} {selectedMember.lastName}
                      </div>
                  )}
              </div>
              <div className="flex justify-end pt-2">
                  <Button onClick={() => setIsEditDialogOpen(false)} className="rounded-full bg-slate-900">Close</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for detail rows
const DetailRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
        <div className="flex items-center space-x-3 text-slate-500">
            <div className="p-1.5 bg-slate-50 rounded-lg"><Icon className="w-4 h-4" /></div>
            <span className="font-medium text-xs uppercase tracking-wide">{label}</span>
        </div>
        <span className="text-slate-800 font-medium text-right">{value}</span>
    </div>
);