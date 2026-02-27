import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission"; // <-- Added RBAC hook
import { Permission } from "@/lib/permissions";         // <-- Added Enums
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2, Calendar, Clock, Plus, Check, X, Activity, User, FileDown, Filter, PieChart, Users, ChevronsUpDown, Search, BarChart3, ChevronDown, Baby } from "lucide-react";
import type { LeaveRequest, User as UserType } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- DOLE LEAVE MAPPINGS ---
export const LEAVE_TYPES: Record<string, string> = {
  annual: 'Service Incentive Leave (SIL)',
  sick: 'Sick Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  magna_carta: 'Magna Carta (Women)',
  vawc: 'VAWC Leave',
  solo_parent: 'Solo Parent Leave',
  bereavement: 'Bereavement / Emergency Leave'
};

const getAvailableLeaveTypes = (user: UserType | null) => {
  const types = [
    { id: 'annual', label: LEAVE_TYPES.annual },
    { id: 'sick', label: LEAVE_TYPES.sick },
    { id: 'bereavement', label: LEAVE_TYPES.bereavement },
    { id: 'solo_parent', label: LEAVE_TYPES.solo_parent }
  ];

  if (user?.gender === 'Female') {
    types.push({ id: 'maternity', label: LEAVE_TYPES.maternity });
    types.push({ id: 'magna_carta', label: LEAVE_TYPES.magna_carta });
    types.push({ id: 'vawc', label: LEAVE_TYPES.vawc });
  }

  if (user?.gender === 'Male' && user?.civilStatus === 'Married') {
    types.push({ id: 'paternity', label: LEAVE_TYPES.paternity });
  }

  return types;
};

// --- SCHEMAS ---
const leaveFormSchema = insertLeaveRequestSchema.extend({
  startDate: z.string().min(1, "Start date is required")
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Start date cannot be in the past"),
  endDate: z.string().min(1, "End date is required"),
}).omit({ userId: true }).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type LeaveForm = z.infer<typeof leaveFormSchema>;

const rejectFormSchema = z.object({
  comments: z.string().min(10, "A detailed reason (at least 10 characters) is required for rejection"),
});
type RejectForm = z.infer<typeof rejectFormSchema>;

const getMinStartDate = () => {
  return new Date().toISOString().split('T')[0];
};

export default function LeaveManagement() {
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  
  // Use explicit RBAC permission instead of role-checking
  const canManageLeaves = hasPermission(Permission.APPROVE_LEAVES);

  // --- FILTER STATES ---
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const [mgrStatusFilter, setMgrStatusFilter] = useState<string>("all"); 
  const [mgrTypeFilter, setMgrTypeFilter] = useState<string>("all");
  const [mgrEmployeeFilter, setMgrEmployeeFilter] = useState<string>("all");
  
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Queries
  const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management"],
  });

  const { data: allHistoryRequests, isLoading: mgrLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management/all"], 
    enabled: canManageLeaves,
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users/"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/");
      return res.json();
    }
  });

  const userMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return users.reduce((map, user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
      return map;
    }, new Map<string, string>());
  }, [users]);

  // Derived Data: Sorted Employees for Combobox
  const sortedEmployees = useMemo(() => {
    if (!users) return [];
    let employees = users.filter(u => u.role !== 'admin' && u.id !== user?.id);
    employees.sort((a, b) => a.lastName.localeCompare(b.lastName));
    if (employeeSearch) {
        const query = employeeSearch.toLowerCase();
        employees = employees.filter(u => 
            u.firstName.toLowerCase().includes(query) || 
            u.lastName.toLowerCase().includes(query)
        );
    }
    return employees;
  }, [users, user, employeeSearch]);

  // Derived Data: User View
  const { filteredRequests, stats } = useMemo(() => {
    const data = leaveRequests || [];
    const stats = {
        total: data.length,
        approved: data.filter(r => r.status === 'approved').length,
        pending: data.filter(r => r.status === 'pending').length,
        rejected: data.filter(r => r.status === 'rejected').length
    };
    const filtered = data.filter(req => {
        const statusMatch = statusFilter === "all" || req.status === statusFilter;
        const typeMatch = typeFilter === "all" || req.type === typeFilter;
        return statusMatch && typeMatch;
    });
    return { filteredRequests: filtered, stats };
  }, [leaveRequests, statusFilter, typeFilter]);

  // Derived Data: Manager View
  const { mgrFilteredRequests, mgrStats } = useMemo(() => {
    const data = allHistoryRequests || [];
    const stats = {
        total: data.length,
        approved: data.filter(r => r.status === 'approved').length,
        pending: data.filter(r => r.status === 'pending').length,
        rejected: data.filter(r => r.status === 'rejected').length
    };
    const filtered = data.filter(req => {
        const statusMatch = mgrStatusFilter === "all" || req.status === mgrStatusFilter;
        const typeMatch = mgrTypeFilter === "all" || req.type === mgrTypeFilter;
        const empMatch = mgrEmployeeFilter === "all" || req.userId === mgrEmployeeFilter;
        return statusMatch && typeMatch && empMatch;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });

    return { mgrFilteredRequests: sorted, mgrStats: stats };
  }, [allHistoryRequests, mgrStatusFilter, mgrTypeFilter, mgrEmployeeFilter]);

  // Derived Data: Employee Stats (Leaderboard) with Detailed Requests
  const employeeStats = useMemo(() => {
     if (!allHistoryRequests || !users) return [];
     
     const statsMap: Record<string, { 
         id: string, 
         name: string, 
         total: number, 
         approved: number, 
         rejected: number, 
         pending: number, 
         types: Record<string, number>,
         requests: LeaveRequest[] 
     }> = {};

     allHistoryRequests.forEach(req => {
        if (!req.userId) return;
        if (!statsMap[req.userId]) {
            statsMap[req.userId] = { 
                id: req.userId,
                name: userMap.get(req.userId) || "Unknown", 
                total: 0, approved: 0, rejected: 0, pending: 0, 
                types: { annual: 0, sick: 0, maternity: 0, paternity: 0, magna_carta: 0, vawc: 0, solo_parent: 0, bereavement: 0 },
                requests: []
            };
        }
        
        const stat = statsMap[req.userId];
        stat.requests.push(req);
        stat.total++;
        if (req.status === 'approved') stat.approved++;
        if (req.status === 'rejected') stat.rejected++;
        if (req.status === 'pending') stat.pending++;
        if (stat.types[req.type] !== undefined) {
          stat.types[req.type]++;
        }
     });

     Object.values(statsMap).forEach(stat => {
         stat.requests.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
     });

     return Object.values(statsMap).sort((a, b) => b.total - a.total);
  }, [allHistoryRequests, users, userMap]);

  const getUserName = (userId: string) => userMap.get(userId) || "Unknown User";

  const getSelectedEmployeeLabel = () => {
    if (mgrEmployeeFilter === "all") return "All Employees";
    const u = users?.find(u => u.id === mgrEmployeeFilter);
    return u ? `${u.lastName}, ${u.firstName}` : "Select Employee";
  };

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { type: "annual", startDate: "", endDate: "", days: 1, reason: "" },
  });

  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { comments: "" },
  });

  const availableLeaveTypes = getAvailableLeaveTypes(user);

  const createLeaveRequestMutation = useMutation({
    mutationFn: async (data: LeaveForm) => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const res = await apiRequest("POST", "/api/leave-management", { ...data, startDate, endDate, days });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management/all"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast.error("Submission failed", { description: error.message }),
  });

  const approveLeaveRequestMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/leave-management/${id}`, { status, comments });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      toast.success(`Leave request ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management/all"] });
      if (variables.status === 'rejected') {
        setIsRejectDialogOpen(false);
        setRejectionRequestId(null);
        rejectForm.reset();
      }
    },
    onError: (error: Error) => toast.error("Update failed", { description: error.message }),
  });

  const onSubmit = (data: LeaveForm) => createLeaveRequestMutation.mutate(data);
  const handleApprove = (id: string) => approveLeaveRequestMutation.mutate({ id, status: "approved" });
  const handleReject = (id: string) => { setRejectionRequestId(id); setIsRejectDialogOpen(true); };
  const onRejectSubmit = (data: RejectForm) => {
    if (rejectionRequestId) approveLeaveRequestMutation.mutate({ id: rejectionRequestId, status: "rejected", comments: data.comments });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
      case "rejected": return <Badge className="bg-rose-100 text-rose-700 border-rose-200">Rejected</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
    }
  };

  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString();

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    if (canManageLeaves) {
      const data = allHistoryRequests || [];
      if (data.length === 0) { toast.error("No data"); return; }
      doc.text("Manager Leave Report", 14, 20);
      doc.save("manager_leave_report.pdf");
    } else {
        doc.save("my_leave.pdf");
    }
  };

  const FilterCard = ({ title, value, icon: Icon, color, isActive, onClick }: any) => (
    <div 
        onClick={onClick}
        className={cn(
            "p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all border border-transparent shadow-sm hover:shadow-md",
            isActive ? "bg-white border-slate-900 ring-2 ring-slate-900/10" : color
        )}
    >
        <div>
            <p className={cn("text-xs font-semibold uppercase tracking-wider", isActive ? "text-slate-900" : "opacity-80")}>{title}</p>
            <p className={cn("text-2xl font-bold", isActive ? "text-slate-900" : "")}>{value}</p>
        </div>
        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center bg-white/40", isActive ? "bg-slate-100 text-slate-900" : "")}>
            <Icon className="w-4 h-4"/>
        </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leave Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your leave requests and view balances</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={downloadPDF} className="rounded-full border-slate-200 shadow-sm hover:bg-slate-50">
                <FileDown className="w-4 h-4 mr-2" /> Download Report
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) form.reset(); }}>
                <DialogTrigger asChild>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg rounded-full px-6">
                    <Plus className="w-4 h-4 mr-2" /> Apply for Leave
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg rounded-2xl">
                    <DialogHeader>
                    <DialogTitle>Apply for Leave</DialogTitle>
                    <DialogDescription>Submit a new request for time off</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                    <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select onValueChange={(value) => form.setValue("type", value)} defaultValue="annual">
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {availableLeaveTypes.map(leave => (
                                <SelectItem key={leave.id} value={leave.id}>{leave.label}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="date" className="rounded-xl" min={getMinStartDate()} {...form.register("startDate")} />
                        {form.formState.errors.startDate && <p className="text-xs text-red-500">{form.formState.errors.startDate.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="date" className="rounded-xl" min={form.watch("startDate")} {...form.register("endDate")} />
                        {form.formState.errors.endDate && <p className="text-xs text-red-500">{form.formState.errors.endDate.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Textarea className="rounded-xl resize-none" rows={3} {...form.register("reason")} placeholder="Why are you taking leave?" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-full">Cancel</Button>
                        <Button type="submit" disabled={createLeaveRequestMutation.isPending} className="rounded-full bg-slate-900">
                        {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                        </Button>
                    </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Tabs defaultValue={canManageLeaves ? "manage" : "my-requests"} className="w-full">
        <div className="flex items-center mb-6">
          <TabsList className="bg-white/40 backdrop-blur-md border border-slate-200/50 p-1 rounded-full h-auto">
            {!canManageLeaves && <TabsTrigger value="my-requests" className="rounded-full px-4 py-2">My Requests</TabsTrigger>}
            {canManageLeaves && (
              <>
                <TabsTrigger value="manage" className="rounded-full px-4 py-2">
                    Manage Requests
                    {mgrStats.pending > 0 && <Badge className="ml-2 bg-rose-500 text-white h-5 px-1.5 rounded-full">{mgrStats.pending}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="employee-stats" className="rounded-full px-4 py-2">
                    Employee Stats
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        {/* ----------------- USER VIEW ----------------- */}
        <TabsContent value="my-requests" className="mt-0 space-y-6">
          {!isLoading && (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <FilterCard title="Approved" value={stats.approved} icon={Check} color="bg-emerald-50 text-emerald-700" isActive={statusFilter === 'approved'} onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')} />
                     <FilterCard title="Pending" value={stats.pending} icon={Clock} color="bg-amber-50 text-amber-700" isActive={statusFilter === 'pending'} onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')} />
                     <FilterCard title="Rejected" value={stats.rejected} icon={X} color="bg-rose-50 text-rose-700" isActive={statusFilter === 'rejected'} onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')} />
                     <FilterCard title="Total" value={stats.total} icon={PieChart} color="bg-slate-50 text-slate-700" isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
                </div>
                <div className="bg-white/50 backdrop-blur-sm border border-slate-200 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Filter className="w-4 h-4" /> Filter:</div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {availableLeaveTypes.map(type => (
                                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
          )}
          <div className="space-y-4">
            {isLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : 
             filteredRequests.length > 0 ? (
               <div className="grid gap-4">
                 {filteredRequests.map((request) => (
                   <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-white/60 border border-slate-200/60 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                         <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                            {['maternity', 'paternity', 'solo_parent'].includes(request.type) ? <Baby className="w-6 h-6" /> : request.type === 'annual' ? <Calendar className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                         </div>
                         <div>
                            <h4 className="font-semibold text-slate-800">{LEAVE_TYPES[request.type] || request.type}</h4>
                            <div className="text-sm text-slate-500">{formatDate(request.startDate)} - {formatDate(request.endDate)} • {request.days} days</div>
                            {request.status === 'rejected' && request.comments && <p className="text-sm text-rose-600 mt-1">Reason: {request.comments}</p>}
                         </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex flex-row sm:flex-col items-center sm:items-end gap-2">
                         {getStatusBadge(request.status!)}
                         <span className="text-xs text-slate-400">Applied {formatDate(request.createdAt!)}</span>
                      </div>
                   </div>
                 ))}
               </div>
            ) : <div className="text-center py-20 text-slate-500">No requests match filters.</div>}
          </div>
        </TabsContent>

        {/* ----------------- MANAGER VIEW ----------------- */}
        {canManageLeaves && (
            <>
          <TabsContent value="manage" className="mt-0 space-y-6">
             {mgrLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : (
                <div className="space-y-4">
                  {/* Interactive Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <FilterCard title="Approved" value={mgrStats.approved} icon={Check} color="bg-emerald-50 text-emerald-700" isActive={mgrStatusFilter === 'approved'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'approved' ? 'all' : 'approved')} />
                       <FilterCard title="Pending" value={mgrStats.pending} icon={Clock} color="bg-amber-50 text-amber-700" isActive={mgrStatusFilter === 'pending'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'pending' ? 'all' : 'pending')} />
                       <FilterCard title="Rejected" value={mgrStats.rejected} icon={X} color="bg-rose-50 text-rose-700" isActive={mgrStatusFilter === 'rejected'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'rejected' ? 'all' : 'rejected')} />
                       <FilterCard title="Total" value={mgrStats.total} icon={PieChart} color="bg-slate-50 text-slate-700" isActive={mgrStatusFilter === 'all'} onClick={() => setMgrStatusFilter('all')} />
                  </div>

                  {/* Manager Filters */}
                  <div className="bg-white/50 backdrop-blur-sm border border-slate-200 p-3 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
                      <div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Filter className="w-4 h-4" /> Filter:</div>
                      <div className="flex flex-wrap gap-2 w-full">
                          
                          {/* Custom Combobox */}
                          <div className="relative" ref={comboboxRef}>
                             <Button 
                                variant="outline" 
                                role="combobox" 
                                className="w-[220px] justify-between bg-white text-sm font-normal text-slate-700 border-slate-200"
                                onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                             >
                                {getSelectedEmployeeLabel()}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                             </Button>

                             {isComboboxOpen && (
                                <div className="absolute top-full left-0 z-50 w-[220px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[300px] flex flex-col p-1 animate-in fade-in-0 zoom-in-95 duration-100">
                                   <div className="flex items-center border-b border-slate-100 px-2 pb-1 mb-1">
                                      <Search className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                      <input 
                                        autoFocus
                                        className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-slate-400"
                                        placeholder="Search name..."
                                        value={employeeSearch}
                                        onChange={(e) => setEmployeeSearch(e.target.value)}
                                      />
                                   </div>
                                   <div className="overflow-y-auto max-h-[220px]">
                                      <div 
                                        className={`px-2 py-1.5 text-sm rounded-md cursor-pointer flex items-center ${mgrEmployeeFilter === 'all' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                                        onClick={() => { setMgrEmployeeFilter("all"); setIsComboboxOpen(false); }}
                                      >
                                        <Check className={`mr-2 h-3.5 w-3.5 ${mgrEmployeeFilter === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                                        All Employees
                                      </div>
                                      {sortedEmployees.length === 0 && <div className="px-2 py-2 text-xs text-slate-400 text-center">No employee found.</div>}
                                      {sortedEmployees.map(u => (
                                          <div 
                                            key={u.id}
                                            className={`px-2 py-1.5 text-sm rounded-md cursor-pointer flex items-center ${mgrEmployeeFilter === u.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                                            onClick={() => { setMgrEmployeeFilter(u.id); setIsComboboxOpen(false); }}
                                          >
                                            <Check className={`mr-2 h-3.5 w-3.5 ${mgrEmployeeFilter === u.id ? 'opacity-100' : 'opacity-0'}`} />
                                            {u.lastName}, {u.firstName}
                                          </div>
                                      ))}
                                   </div>
                                </div>
                             )}
                          </div>

                          <Select value={mgrStatusFilter} onValueChange={setMgrStatusFilter}>
                              <SelectTrigger className="w-[140px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                          </Select>

                          <Select value={mgrTypeFilter} onValueChange={setMgrTypeFilter}>
                              <SelectTrigger className="w-[200px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  {Object.entries(LEAVE_TYPES).map(([id, label]) => (
                                    <SelectItem key={id} value={id}>{label}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>

                          {(mgrStatusFilter !== "all" || mgrTypeFilter !== "all" || mgrEmployeeFilter !== "all") && (
                              <Button variant="ghost" size="sm" onClick={() => { setMgrStatusFilter("all"); setMgrTypeFilter("all"); setMgrEmployeeFilter("all"); setEmployeeSearch(""); }} className="h-9 text-slate-500 hover:text-slate-900">Reset</Button>
                          )}
                      </div>
                      <div className="ml-auto text-xs text-slate-400">Showing {mgrFilteredRequests.length} results</div>
                  </div>

                  {/* List */}
                  {mgrFilteredRequests.length === 0 ? 
                      <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3"><Users className="w-6 h-6 text-slate-300"/></div>
                          <p className="text-slate-500">No requests found matching filters.</p>
                      </div> : 
                      mgrFilteredRequests.map((request) => (
                       <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-start gap-4">
                             <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${request.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                <User className="w-6 h-6" />
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-800 text-lg">{getUserName(request.userId)}</h4>
                                <p className="text-sm text-slate-600">Requested <span className="font-semibold text-blue-600">{LEAVE_TYPES[request.type] || request.type}</span> for {request.days} days</p>
                                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3"/> {formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                                {request.reason && <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 inline-block">"{request.reason}"</p>}
                                {request.status === 'rejected' && request.comments && <p className="text-sm text-rose-600 bg-rose-50 p-2 rounded-lg mt-2 block">Reason: {request.comments}</p>}
                             </div>
                          </div>
                          <div className="mt-4 md:mt-0 flex flex-col items-end gap-3 pl-16 md:pl-0">
                             {request.status === 'pending' ? (
                               <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleApprove(request.id)} className="bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-600/20"><Check className="w-4 h-4 mr-2" /> Approve</Button>
                                  <Button size="sm" variant="outline" onClick={() => handleReject(request.id)} className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-full"><X className="w-4 h-4 mr-2" /> Reject</Button>
                               </div>
                             ) : (
                                getStatusBadge(request.status!)
                             )}
                             <span className="text-xs text-slate-400">Applied {formatDate(request.createdAt!)}</span>
                          </div>
                       </div>
                     ))
                   }
                </div>
             )}
          </TabsContent>

          {/* ----------------- EMPLOYEE STATS TAB ----------------- */}
          <TabsContent value="employee-stats" className="mt-0">
             <div className="grid gap-6">
                <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl">
                    <CardHeader><CardTitle>Leave Usage Leaderboard</CardTitle><CardDescription>Overview of employee leave history</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {employeeStats.map((stat, i) => (
                                <div key={stat.id} className="border border-transparent hover:border-slate-100 transition-all rounded-lg overflow-hidden">
                                  {/* Header Row */}
                                  <div 
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedUser(expandedUser === stat.id ? null : stat.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">{i + 1}</div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{stat.name}</p>
                                            <div className="flex gap-2 text-xs text-slate-500">
                                                <span className="text-emerald-600">{stat.approved} Approved</span>
                                                <span>•</span>
                                                <span className="text-rose-600">{stat.rejected} Rejected</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div className="hidden sm:block">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Annual</p>
                                            <p className="text-sm font-medium">{stat.types.annual}</p>
                                        </div>
                                        <div className="hidden sm:block">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Sick</p>
                                            <p className="text-sm font-medium">{stat.types.sick}</p>
                                        </div>
                                        <div className="mr-2">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Total</p>
                                            <Badge variant="secondary" className="bg-slate-900 text-white hover:bg-slate-800">{stat.total}</Badge>
                                        </div>
                                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", expandedUser === stat.id ? "rotate-180" : "")} />
                                    </div>
                                  </div>

                                  {/* Collapsible Details */}
                                  {expandedUser === stat.id && (
                                    <div className="bg-slate-50/80 border-t border-slate-100 p-4 md:p-6 animate-in slide-in-from-top-2 fade-in duration-300">
                                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <Table>
                                          <TableHeader className="bg-slate-50/50">
                                            <TableRow className="border-slate-100 hover:bg-transparent">
                                              <TableHead className="w-[180px] font-semibold text-slate-700">Leave Type</TableHead>
                                              <TableHead className="font-semibold text-slate-700">Duration & Reason</TableHead>
                                              <TableHead className="w-[120px] font-semibold text-slate-700">Status</TableHead>
                                              <TableHead className="w-[80px] text-right font-semibold text-slate-700">Days</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {stat.requests.length > 0 ? (
                                              stat.requests.map((req) => (
                                                <TableRow key={req.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                  <TableCell className="align-top py-4">
                                                    <div className="flex items-center gap-2">
                                                      <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                                                        req.type === 'annual' 
                                                          ? "bg-blue-50 text-blue-600 border-blue-100" 
                                                          : "bg-purple-50 text-purple-600 border-purple-100"
                                                      )}>
                                                        {['maternity', 'paternity', 'solo_parent'].includes(req.type) ? <Baby className="w-4 h-4" /> : req.type === 'annual' ? <Calendar className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                                      </div>
                                                      <span className="font-medium text-sm text-slate-700">
                                                        {LEAVE_TYPES[req.type] || req.type}
                                                      </span>
                                                    </div>
                                                  </TableCell>
                                                  
                                                  <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-1">
                                                      <span className="text-sm font-medium text-slate-900">
                                                        {formatDate(req.startDate)} <span className="text-slate-400 mx-1">→</span> {formatDate(req.endDate)}
                                                      </span>
                                                      {req.reason ? (
                                                        <span className="text-xs text-slate-500 italic flex items-start gap-1">
                                                          <span className="shrink-0 mt-0.5 opacity-50">↳</span> "{req.reason}"
                                                        </span>
                                                      ) : (
                                                        <span className="text-xs text-slate-400 opacity-50">No reason provided</span>
                                                      )}
                                                    </div>
                                                  </TableCell>

                                                  <TableCell className="align-top py-4">
                                                    <Badge variant="outline" className={cn(
                                                      "rounded-md px-2.5 py-1 text-xs font-medium capitalize shadow-sm",
                                                      req.status === 'approved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                                      req.status === 'rejected' && "bg-rose-50 text-rose-700 border-rose-200",
                                                      req.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-200"
                                                    )}>
                                                      {req.status}
                                                    </Badge>
                                                    {req.status === 'rejected' && req.comments && (
                                                      <div className="mt-2 text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-100 max-w-[140px]">
                                                        <span className="font-semibold">Reason:</span> {req.comments}
                                                      </div>
                                                    )}
                                                  </TableCell>

                                                  <TableCell className="align-top text-right py-4">
                                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md text-sm">
                                                      {req.days}
                                                    </span>
                                                  </TableCell>
                                                </TableRow>
                                              ))
                                            ) : (
                                              <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center">
                                                  <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <FileDown className="w-8 h-8 mb-2 opacity-20" />
                                                    <p className="text-sm">No leave history found for this employee.</p>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                            ))}
                            {employeeStats.length === 0 && <div className="text-center py-10 text-slate-400">No data available</div>}
                        </div>
                    </CardContent>
                </Card>
             </div>
          </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => { setIsRejectDialogOpen(open); if (!open) { setRejectionRequestId(null); rejectForm.reset(); }}}>
        <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="text-rose-600">Reject Request</DialogTitle><DialogDescription>Reason for rejection</DialogDescription></DialogHeader>
            <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4">
                <Textarea {...rejectForm.register("comments")} placeholder="Reason..." className="rounded-xl resize-none" rows={3} />
                {rejectForm.formState.errors.comments && <p className="text-xs text-rose-600">{rejectForm.formState.errors.comments.message}</p>}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-full">Cancel</Button>
                    <Button type="submit" variant="destructive" className="rounded-full">Confirm</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}