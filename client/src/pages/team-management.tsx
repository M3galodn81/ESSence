import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, Search, UserPlus, Briefcase, 
  CheckCircle, Filter, MoreHorizontal, Mail, Phone, Calendar, Hash, User as UserIcon, Building, Clock, MapPin, Heart, Flag
} from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { BentoCard } from "@/components/custom/bento-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TeamManagement() {
  const { user } = useAuth();
  
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserType | null>(null);

  // --- QUERIES ---
  const { data: teamMembers, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/team"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
  });

  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users/all"], 
    queryFn: async () => {
        const res = await apiRequest("GET", "/api/users"); 
        return await res.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  // --- FILTERING & SORTING LOGIC ---
  const filteredAndSortedMembers = useMemo(() => {
    if (!teamMembers) return [];

    let result = teamMembers
      .filter((member: UserType) => member.role !== 'admin' || member.id === user?.id);

    // Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((member) =>
        `${member.lastName}, ${member.firstName}`.toLowerCase().includes(lowerTerm) ||
        member.email.toLowerCase().includes(lowerTerm) ||
        member.employeeId?.toLowerCase().includes(lowerTerm) ||
        member.username.toLowerCase().includes(lowerTerm)
      );
    }

    // Role Filter
    if (roleFilter !== "all") {
      result = result.filter((member) => member.role === roleFilter);
    }

    // Status Filter
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((member) => Boolean(member.isActive) === isActive);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.lastName.localeCompare(b.lastName);
        case "name_desc":
          return b.lastName.localeCompare(a.lastName);
        case "newest":
          return (new Date(b.hireDate || 0).getTime()) - (new Date(a.hireDate || 0).getTime());
        case "oldest":
          return (new Date(a.hireDate || 0).getTime()) - (new Date(b.hireDate || 0).getTime());
        default:
          return 0;
      }
    });

    return result;
  }, [teamMembers, searchTerm, roleFilter, statusFilter, sortBy, user?.id]);

  // --- HELPERS ---
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
    if (!managerId || managerId === "") return "—";
    const userList = allUsers || teamMembers;
    const manager = userList?.find((m: UserType) => m.id === managerId);
    return manager ? `${manager.lastName}, ${manager.firstName}` : "Unknown";
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

  const formatDate = (date: Date | string | number | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper to calculate years/months active
  const calculateTenure = (hireDate: Date | string | number | null, inactiveDate: Date | string | number | null, isActive: boolean | null) => {
    if (!hireDate) return "—";
    const start = new Date(hireDate);
    // If active, use today. If inactive, use inactiveDate. If inactiveDate missing, default to today.
    const end = (!isActive && inactiveDate) ? new Date(inactiveDate) : new Date();

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }
    
    // Handle very short durations or negative calculation errors
    if (years < 0) return "0m"; 
    
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    
    return parts.length > 0 ? parts.join(" ") : "< 1m";
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
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

      {/* Controls & Table */}
      <div className="space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            
            {/* Search */}
            <div className="relative w-full xl:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by name, ID, username..." 
                    className="pl-9 h-9 w-full bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">Filters:</span>
                </div>
                
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="payroll_officer">Payroll</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>

                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Sort By" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                        <SelectItem value="newest">Newest Hired</SelectItem>
                        <SelectItem value="oldest">Oldest Hired</SelectItem>
                    </SelectContent>
                </Select>

                {(roleFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setSearchTerm(''); }}
                        className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                        Reset
                    </Button>
                )}
            </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow>
                        <TableHead className="w-[220px]">Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Department / Position</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Active Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                Loading team members...
                            </TableCell>
                        </TableRow>
                    ) : filteredAndSortedMembers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                                <div className="flex flex-col items-center gap-2">
                                    <Users className="w-8 h-8 text-slate-300" />
                                    <p>No team members found matching your criteria.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredAndSortedMembers.map((member) => (
                            <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-9 h-9 border border-slate-200">
                                            <AvatarImage src={member.profilePicture || ""} />
                                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                                                {getInitials(member.firstName, member.lastName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm text-slate-900">
                                                {member.lastName}, {member.firstName}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                @{member.username}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{getRoleBadge(member.role)}</TableCell>
                                <TableCell>
                                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        {member.employeeId || "—"}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 font-medium">{member.department || "—"}</span>
                                        <span className="text-xs text-slate-500">{member.position || "—"}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        {member.managerId && <UserIcon className="w-3 h-3 text-slate-400" />}
                                        <span className="text-sm text-slate-600">
                                            {member.role === 'employee' ? getManagerName(member.managerId) : "—"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {formatDate(member.hireDate)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-sm text-slate-700 font-medium font-mono bg-slate-50 px-2 py-1 rounded-md w-fit">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {calculateTenure(member.hireDate, member.inactiveDate, member.isActive)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {member.isActive ? (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit border border-emerald-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Active
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full w-fit border border-slate-200">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                            Inactive
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleViewDetails(member)}>View Full Profile</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEditMember(member)}>Edit Details</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            </div>
        </div>
      </div>
      
      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle>Employee Profile</DialogTitle>
              </DialogHeader>
              {selectedMember && (
                  <div className="space-y-6 pt-2">
                      {/* Header Card */}
                      <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <Avatar className="w-20 h-20 border-4 border-white shadow-sm">
                              <AvatarImage src={selectedMember.profilePicture || ""} />
                              <AvatarFallback className="text-2xl bg-slate-200 text-slate-600">
                                  {getInitials(selectedMember.firstName, selectedMember.lastName)}
                              </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                              <h3 className="text-xl font-bold text-slate-900">{selectedMember.lastName}, {selectedMember.firstName} {selectedMember.middleName ? selectedMember.middleName[0] + '.' : ''}</h3>
                              <p className="text-sm text-slate-500 mb-2">{selectedMember.position || "No position"} • {selectedMember.department || "No dept"}</p>
                              <div className="flex gap-2">
                                  {getRoleBadge(selectedMember.role)}
                                  {selectedMember.isActive ? 
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge> : 
                                    <Badge variant="outline" className="bg-slate-100 text-slate-500">Inactive since {formatDate(selectedMember.inactiveDate)}</Badge>
                                  }
                              </div>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          
                          {/* Personal Info */}
                          <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">Personal Information</h4>
                              <div className="space-y-2">
                                <DetailRow icon={Calendar} label="Birth Date" value={formatDate(selectedMember.birthDate)} />
                                <DetailRow icon={UserIcon} label="Gender" value={selectedMember.gender || "N/A"} />
                                <DetailRow icon={Heart} label="Civil Status" value={selectedMember.civilStatus || "N/A"} />
                                <DetailRow icon={Flag} label="Nationality" value={selectedMember.nationality || "N/A"} />
                              </div>
                          </div>

                          {/* Contact Info */}
                          <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">Contact Details</h4>
                              <div className="space-y-2">
                                <DetailRow icon={Mail} label="Email" value={selectedMember.email} />
                                <DetailRow icon={Phone} label="Phone" value={selectedMember.phoneNumber || "N/A"} />
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="text-[10px] uppercase font-semibold tracking-wider">Address</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 pl-5.5 text-balance">
                                        {selectedMember.address ? 
                                            `${(selectedMember.address as any).street}, ${(selectedMember.address as any).city}, ${(selectedMember.address as any).province}` 
                                            : "N/A"}
                                    </p>
                                </div>
                              </div>
                          </div>

                          {/* Employment Info */}
                          <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">Employment Details</h4>
                              <div className="space-y-2">
                                <DetailRow icon={Hash} label="Employee ID" value={selectedMember.employeeId || "N/A"} />
                                <DetailRow icon={Calendar} label="Date Hired" value={formatDate(selectedMember.hireDate)} />
                                <DetailRow icon={Briefcase} label="Status" value={selectedMember.employmentStatus || "N/A"} />
                                <DetailRow icon={Users} label="Manager" value={getManagerName(selectedMember.managerId)} />
                              </div>
                          </div>

                          {/* Emergency Contact */}
                          <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">Emergency Contact</h4>
                              <div className="space-y-2">
                                <DetailRow icon={UserIcon} label="Name" value={(selectedMember.emergencyContact as any)?.name || "N/A"} />
                                <DetailRow icon={Heart} label="Relation" value={(selectedMember.emergencyContact as any)?.relation || "N/A"} />
                                <DetailRow icon={Phone} label="Phone" value={(selectedMember.emergencyContact as any)?.phone || "N/A"} />
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </DialogContent>
      </Dialog>

      {/* Edit Dialog Warning */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                  <DialogTitle>Edit Member</DialogTitle>
                  <DialogDescription>
                      Full profile editing is handled in the dedicated User Management section.
                  </DialogDescription>
              </DialogHeader>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                  <p>To ensure data integrity and proper permission handling, please use the <strong>User Management</strong> page to edit employee details, roles, or reset passwords.</p>
              </div>
              <div className="flex justify-end pt-2">
                  <Button onClick={() => setIsEditDialogOpen(false)} className="rounded-full bg-slate-900">Close</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for detail rows in dialog
const DetailRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-slate-400">
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-semibold tracking-wider">{label}</span>
        </div>
        <p className="text-sm font-medium text-slate-700 pl-5.5 truncate" title={value}>{value}</p>
    </div>
);