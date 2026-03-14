import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import { z } from "zod";
import { Loader2, Calendar, Clock, Plus, Check, X, Activity, FileDown, Filter, PieChart, Users, ChevronsUpDown, Search, ChevronDown, Baby, FileText, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { DayPicker } from "react-day-picker"; 
import "react-day-picker/dist/style.css"; 
import type { LeaveRequest, User as UserType } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// FIX: Imported Avatar from your UI components folder instead of raw Radix to preserve styles
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

// --- GLOBAL HELPERS & MAPPINGS ---
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

const getInitials = (first?: string, last?: string) => {
  return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '??';
};

const formatDate = (date: string | Date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// --- REUSABLE AVATAR COMPONENT ---
const UserAvatar = ({ user, className, fallbackClassName }: { user?: UserType | null, className?: string, fallbackClassName?: string }) => {
  const initials = getInitials(user?.firstName, user?.lastName);
  return (
    <Avatar className={cn("border border-slate-200 shrink-0 bg-white", className)}>
      <AvatarImage src={user?.profilePicture || ""} alt={`${user?.firstName} ${user?.lastName}`} className="object-cover" />
      <AvatarFallback className={cn("bg-slate-100 text-slate-600 font-bold flex items-center justify-center w-full h-full", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
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
  
  const canManageLeaves = hasPermission(Permission.APPROVE_LEAVES);

  // --- UI STATES ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
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
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management/all"] });
      
      setIsApproveConfirmOpen(false);
      setIsRejectDialogOpen(false);
      setIsDetailsOpen(false);
      setSelectedRequest(null);
      rejectForm.reset();
    },
    onError: (error: Error) => toast.error("Update failed", { description: error.message }),
  });

  const onSubmit = (data: LeaveForm) => createLeaveRequestMutation.mutate(data);
  
  const handleApproveClick = (request: LeaveRequest) => {
      setSelectedRequest(request);
      setIsApproveConfirmOpen(true);
  };

  const handleRejectClick = (request: LeaveRequest) => {
      setSelectedRequest(request);
      setIsRejectDialogOpen(true);
  };

  const handleViewDetails = (request: LeaveRequest) => {
      setSelectedRequest(request);
      setIsDetailsOpen(true);
  };

  const confirmApprove = () => {
      if (selectedRequest) {
          approveLeaveRequestMutation.mutate({ id: selectedRequest.id, status: "approved" });
      }
  };

  const onRejectSubmit = (data: RejectForm) => {
    if (selectedRequest) {
        approveLeaveRequestMutation.mutate({ id: selectedRequest.id, status: "rejected", comments: data.comments });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm">Approved</Badge>;
      case "rejected": return <Badge className="bg-rose-100 text-rose-700 border-rose-200 shadow-sm">Rejected</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 shadow-sm">Pending Review</Badge>;
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    const dataToExport = canManageLeaves ? mgrFilteredRequests : filteredRequests;
    const reportTitle = canManageLeaves ? "Organization Leave Report" : "My Leave History";

    if (!dataToExport || dataToExport.length === 0) { 
        toast.error("No data available to export based on current filters."); 
        return; 
    }

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); 
    doc.text(reportTitle, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);

    const rows = dataToExport.map((req: any) => {
        const baseRow = [
            LEAVE_TYPES[req.type] || req.type.toUpperCase(),
            `${formatDate(req.startDate)} to ${formatDate(req.endDate)}`,
            `${req.days} Day(s)`,
            req.status.toUpperCase(),
            formatDate(req.createdAt)
        ];

        if (canManageLeaves) {
            baseRow.unshift(getUserName(req.userId)); 
        }

        return baseRow;
    });

    const head = canManageLeaves 
        ? [["Employee", "Leave Type", "Duration", "Days", "Status", "Filed On"]]
        : [["Leave Type", "Duration", "Days", "Status", "Filed On"]];

    autoTable(doc, {
        head: head,
        body: rows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, 
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] } 
    });

    const fileName = canManageLeaves 
        ? `leave_report_${format(new Date(), "yyyy-MM-dd")}.pdf` 
        : `my_leaves_${format(new Date(), "yyyy-MM-dd")}.pdf`;
        
    doc.save(fileName);
    toast.success("PDF downloaded successfully!");
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Leave Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your leave requests and view balances</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={downloadPDF} className="w-full sm:w-auto rounded-full border-slate-200 shadow-sm hover:bg-slate-50">
                <FileDown className="w-4 h-4 mr-2" /> Download Report
            </Button>

            {/* FIX: Hide the "Apply for Leave" button if the user is a manager */}
            {!canManageLeaves && (
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) form.reset(); }}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white shadow-lg rounded-full px-6">
                        <Plus className="w-4 h-4 mr-2" /> Apply for Leave
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg w-[95vw] rounded-2xl p-4 md:p-6">
                        <DialogHeader>
                        <DialogTitle>Apply for Leave</DialogTitle>
                        <DialogDescription>Submit a new request for time off</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-5 mt-2">
                        <div className="space-y-2">
                            <Label>Leave Type</Label>
                            <Select onValueChange={(value) => form.setValue("type", value)} defaultValue="annual">
                            <SelectTrigger className="rounded-xl w-full"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {availableLeaveTypes.map(leave => (
                                    <SelectItem key={leave.id} value={leave.id}>{leave.label}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" className="rounded-xl w-full" min={getMinStartDate()} {...form.register("startDate")} />
                            {form.formState.errors.startDate && <p className="text-xs text-red-500">{form.formState.errors.startDate.message}</p>}
                            </div>
                            <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" className="rounded-xl w-full" min={form.watch("startDate")} {...form.register("endDate")} />
                            {form.formState.errors.endDate && <p className="text-xs text-red-500">{form.formState.errors.endDate.message}</p>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason (Optional)</Label>
                            <Textarea className="rounded-xl resize-none w-full" rows={3} {...form.register("reason")} placeholder="Why are you taking leave?" />
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-full w-full sm:w-auto">Cancel</Button>
                            <Button type="submit" disabled={createLeaveRequestMutation.isPending} className="rounded-full bg-slate-900 w-full sm:w-auto">
                            {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                            </Button>
                        </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
      </div>

      <Tabs defaultValue={canManageLeaves ? "manage" : "my-requests"} className="w-full">
        <div className="flex items-center mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-white/40 backdrop-blur-md border border-slate-200/50 p-1 rounded-full h-auto shadow-sm w-max min-w-full sm:min-w-0">
            {!canManageLeaves && <TabsTrigger value="my-requests" className="rounded-full px-4 py-2 whitespace-nowrap">My Requests</TabsTrigger>}
            {canManageLeaves && (
              <>
                <TabsTrigger value="manage" className="rounded-full px-4 py-2 whitespace-nowrap">
                    Manage Requests
                    {mgrStats.pending > 0 && <Badge className="ml-2 bg-rose-500 text-white h-5 px-1.5 rounded-full">{mgrStats.pending}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="employee-stats" className="rounded-full px-4 py-2 whitespace-nowrap">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                     <FilterCard title="Approved" value={stats.approved} icon={Check} color="bg-emerald-50 text-emerald-700 border-emerald-100" isActive={statusFilter === 'approved'} onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')} />
                     <FilterCard title="Pending" value={stats.pending} icon={Clock} color="bg-amber-50 text-amber-700 border-amber-100" isActive={statusFilter === 'pending'} onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')} />
                     <FilterCard title="Rejected" value={stats.rejected} icon={X} color="bg-rose-50 text-rose-700 border-rose-100" isActive={statusFilter === 'rejected'} onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')} />
                     <FilterCard title="Total" value={stats.total} icon={PieChart} color="bg-slate-50 text-slate-700 border-slate-200" isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
                </div>
                <div className="bg-white/50 backdrop-blur-sm border border-slate-200 p-3 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Filter className="w-4 h-4" /> Filter:</div>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[140px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Leave Type" /></SelectTrigger>
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
                   <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all gap-4">
                      <div className="flex items-start gap-4">
                         <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 shrink-0">
                            {['maternity', 'paternity', 'solo_parent'].includes(request.type) ? <Baby className="w-5 h-5 md:w-6 md:h-6" /> : request.type === 'annual' ? <Calendar className="w-5 h-5 md:w-6 md:h-6" /> : <Activity className="w-5 h-5 md:w-6 md:h-6" />}
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-800 text-sm md:text-base">{LEAVE_TYPES[request.type] || request.type}</h4>
                            <div className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">{formatDate(request.startDate)} - {formatDate(request.endDate)} • {request.days} days</div>
                            {request.status === 'rejected' && request.comments && <p className="text-xs text-rose-600 mt-2 bg-rose-50 p-2 rounded-lg inline-block border border-rose-100 break-words line-clamp-2">Reason: {request.comments}</p>}
                         </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                         {getStatusBadge(request.status!)}
                         <span className="text-[10px] md:text-xs text-slate-400 font-medium">Applied {formatDate(request.createdAt!)}</span>
                      </div>
                   </div>
                 ))}
               </div>
            ) : <div className="text-center py-20 text-slate-500 font-medium bg-white/50 border border-dashed rounded-3xl mx-4">No requests match filters.</div>}
          </div>
        </TabsContent>

        {/* ----------------- MANAGER VIEW ----------------- */}
        {canManageLeaves && (
            <>
          <TabsContent value="manage" className="mt-0 space-y-6">
             {mgrLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : (
                <div className="space-y-4">
                  {/* Interactive Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                       <FilterCard title="Approved" value={mgrStats.approved} icon={Check} color="bg-emerald-50 text-emerald-700 border-emerald-100" isActive={mgrStatusFilter === 'approved'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'approved' ? 'all' : 'approved')} />
                       <FilterCard title="Pending" value={mgrStats.pending} icon={Clock} color="bg-amber-50 text-amber-700 border-amber-100" isActive={mgrStatusFilter === 'pending'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'pending' ? 'all' : 'pending')} />
                       <FilterCard title="Rejected" value={mgrStats.rejected} icon={X} color="bg-rose-50 text-rose-700 border-rose-100" isActive={mgrStatusFilter === 'rejected'} onClick={() => setMgrStatusFilter(mgrStatusFilter === 'rejected' ? 'all' : 'rejected')} />
                       <FilterCard title="Total" value={mgrStats.total} icon={PieChart} color="bg-slate-50 text-slate-700 border-slate-200" isActive={mgrStatusFilter === 'all'} onClick={() => setMgrStatusFilter('all')} />
                  </div>

                  {/* Manager Filters */}
                  <div className="bg-white border border-slate-200 p-3 md:p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 text-sm font-medium w-full md:w-auto"><Filter className="w-4 h-4" /> Filter:</div>
                      <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
                          
                          {/* Custom Combobox */}
                          <div className="relative w-full sm:w-auto" ref={comboboxRef}>
                             <Button 
                                variant="outline" 
                                role="combobox" 
                                className="w-full sm:w-[220px] justify-between bg-slate-50 text-sm font-medium text-slate-700 border-slate-200"
                                onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                             >
                                <span className="truncate">{getSelectedEmployeeLabel()}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                             </Button>

                             {isComboboxOpen && (
                                <div className="absolute top-full left-0 z-50 w-full sm:w-[220px] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] flex flex-col p-1 animate-in fade-in-0 zoom-in-95 duration-100">
                                   <div className="flex items-center border-b border-slate-100 px-2 pb-1 mb-1">
                                      <Search className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                      <input 
                                        autoFocus
                                        className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-slate-400 min-w-0"
                                        placeholder="Search name..."
                                        value={employeeSearch}
                                        onChange={(e) => setEmployeeSearch(e.target.value)}
                                      />
                                   </div>
                                   <div className="overflow-y-auto max-h-[220px]">
                                      <div 
                                        className={`px-2 py-2 text-sm rounded-md cursor-pointer flex items-center font-medium ${mgrEmployeeFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
                                        onClick={() => { setMgrEmployeeFilter("all"); setIsComboboxOpen(false); }}
                                      >
                                        <Check className={`mr-2 h-3.5 w-3.5 shrink-0 ${mgrEmployeeFilter === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                                        <span className="truncate">All Employees</span>
                                      </div>
                                      {sortedEmployees.length === 0 && <div className="px-2 py-4 text-xs text-slate-400 text-center">No employee found.</div>}
                                      {sortedEmployees.map(u => (
                                          <div 
                                            key={u.id}
                                            className={`px-2 py-2 text-sm rounded-md cursor-pointer flex items-center ${mgrEmployeeFilter === u.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50'}`}
                                            onClick={() => { setMgrEmployeeFilter(u.id); setIsComboboxOpen(false); }}
                                          >
                                            <Check className={`mr-2 h-3.5 w-3.5 shrink-0 ${mgrEmployeeFilter === u.id ? 'opacity-100' : 'opacity-0'}`} />
                                            <span className="truncate">{u.lastName}, {u.firstName}</span>
                                          </div>
                                      ))}
                                   </div>
                                </div>
                             )}
                          </div>

                          <Select value={mgrStatusFilter} onValueChange={setMgrStatusFilter}>
                              <SelectTrigger className="w-full sm:w-[140px] h-9 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                          </Select>

                          <Select value={mgrTypeFilter} onValueChange={setMgrTypeFilter}>
                              <SelectTrigger className="w-full sm:w-[200px] h-9 rounded-lg bg-slate-50 border-slate-200 text-sm font-medium"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  {Object.entries(LEAVE_TYPES).map(([id, label]) => (
                                    <SelectItem key={id} value={id}>{label}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>

                          {(mgrStatusFilter !== "all" || mgrTypeFilter !== "all" || mgrEmployeeFilter !== "all") && (
                              <Button variant="ghost" size="sm" onClick={() => { setMgrStatusFilter("all"); setMgrTypeFilter("all"); setMgrEmployeeFilter("all"); setEmployeeSearch(""); }} className="h-9 w-full sm:w-auto text-rose-500 hover:text-rose-600 hover:bg-rose-50">Reset</Button>
                          )}
                      </div>
                      <div className="hidden md:block ml-auto text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">{mgrFilteredRequests.length} results</div>
                  </div>

                  {/* List */}
                  {mgrFilteredRequests.length === 0 ? 
                      <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl mx-2">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3"><Users className="w-6 h-6 text-slate-300"/></div>
                          <p className="text-slate-500 font-medium">No requests found matching filters.</p>
                      </div> : 
                      <div className="grid gap-3">
                        {mgrFilteredRequests.map((request) => (
                          <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all group gap-4">
                            <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
                                <div className="relative shrink-0">
                                    <UserAvatar user={users?.find(u => u.id === request.userId)} className="h-10 w-10 md:h-12 md:w-12" fallbackClassName="text-sm md:text-base" />
                                    {request.status === 'pending' && (
                                        <div className="absolute -bottom-1 -right-1 bg-amber-100 border-2 border-white rounded-full p-1">
                                            <Clock className="w-3 h-3 text-amber-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-base md:text-lg flex flex-wrap items-center gap-2 leading-tight">
                                      <span className="truncate">{getUserName(request.userId)}</span>
                                      {getStatusBadge(request.status!)}
                                  </h4>
                                  <p className="text-xs md:text-sm text-slate-600 mt-1 truncate">Requested <span className="font-bold text-blue-700">{LEAVE_TYPES[request.type] || request.type}</span> for {request.days} days</p>
                                  <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                                    <p className="text-[10px] md:text-xs font-medium text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 whitespace-nowrap"><Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400"/> {formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Filed: {formatDate(request.createdAt!)}</span>
                                  </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row md:flex-col items-stretch md:items-end w-full md:w-auto gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                                {/* ACTION BUTTONS */}
                                {request.status === 'pending' ? (
                                  <div className="flex w-full md:w-auto gap-2">
                                      <Button size="sm" onClick={() => handleApproveClick(request)} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"><Check className="w-4 h-4 mr-1 md:mr-1.5" /> Approve</Button>
                                      <Button size="sm" variant="outline" onClick={() => handleRejectClick(request)} className="flex-1 md:flex-none border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"><X className="w-4 h-4 mr-1 md:mr-1.5" /> Reject</Button>
                                      <Button size="icon" variant="ghost" onClick={() => handleViewDetails(request)} className="rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0" title="View Full Details">
                                          <ExternalLink className="w-4 h-4" />
                                      </Button>
                                  </div>
                                ) : (
                                  <Button variant="outline" size="sm" onClick={() => handleViewDetails(request)} className="rounded-xl text-slate-600 bg-white border-slate-200 shadow-sm w-full md:w-auto">
                                      <FileText className="w-4 h-4 mr-2 text-slate-400" /> View Details
                                  </Button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                </div>
             )}
          </TabsContent>

          {/* ----------------- EMPLOYEE STATS TAB ----------------- */}
          <TabsContent value="employee-stats" className="mt-0">
             <div className="grid gap-6">
                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl md:rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 md:p-6">
                        <CardTitle className="text-lg md:text-xl">Leave Usage Leaderboard</CardTitle>
                        <CardDescription className="text-xs md:text-sm">Overview of employee leave history</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {employeeStats.map((stat, i) => (
                                <div key={stat.id} className="transition-all overflow-hidden bg-white">
                                  {/* Header Row */}
                                  <div 
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors gap-3 sm:gap-0"
                                    onClick={() => setExpandedUser(expandedUser === stat.id ? null : stat.id)}
                                  >
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shadow-sm border shrink-0", i < 3 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-slate-50 text-slate-600 border-slate-200")}>
                                            {i + 1}
                                        </div>
                                        <UserAvatar user={users?.find(u => u.id === stat.id)} className="h-10 w-10 hidden sm:flex" fallbackClassName="text-sm" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 text-sm md:text-base truncate">{stat.name}</p>
                                            <div className="flex flex-wrap gap-2 md:gap-3 text-[10px] md:text-xs font-medium text-slate-500 mt-0.5">
                                                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500"/> {stat.approved} Approved</span>
                                                <span className="flex items-center gap-1"><X className="w-3 h-3 text-rose-500"/> {stat.rejected} Rejected</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 sm:gap-6 justify-end w-full sm:w-auto pl-11 sm:pl-0 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                                        <div className="hidden md:block text-center">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Annual</p>
                                            <Badge variant="outline" className="bg-slate-50">{stat.types.annual}</Badge>
                                        </div>
                                        <div className="hidden md:block text-center">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Sick</p>
                                            <Badge variant="outline" className="bg-slate-50">{stat.types.sick}</Badge>
                                        </div>
                                        <div className="mr-2 text-center flex items-center sm:block gap-2 sm:gap-0">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold sm:mb-1">Total</p>
                                            <Badge className="bg-slate-900 text-white shadow-sm">{stat.total}</Badge>
                                        </div>
                                        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0", expandedUser === stat.id ? "rotate-180" : "")} />
                                    </div>
                                  </div>

                                  {/* Collapsible Details */}
                                  {expandedUser === stat.id && (
                                    <div className="bg-slate-50/80 border-t border-slate-100 p-3 md:p-6 animate-in slide-in-from-top-2 fade-in duration-300 shadow-inner">
                                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
                                        <Table className="min-w-[600px] w-full">
                                          <TableHeader className="bg-slate-50">
                                            <TableRow className="border-slate-100 hover:bg-transparent">
                                              <TableHead className="w-[180px] font-bold text-slate-700 pl-4 md:pl-6">Leave Type</TableHead>
                                              <TableHead className="font-bold text-slate-700">Duration & Reason</TableHead>
                                              <TableHead className="w-[120px] font-bold text-slate-700">Status</TableHead>
                                              <TableHead className="w-[80px] text-right font-bold text-slate-700 pr-4 md:pr-6">Days</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {stat.requests.length > 0 ? (
                                              stat.requests.map((req) => (
                                                <TableRow key={req.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => handleViewDetails(req)}>
                                                  <TableCell className="align-top py-4 pl-4 md:pl-6">
                                                    <div className="flex items-center gap-3">
                                                      <div className={cn(
                                                        "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center border shrink-0 shadow-sm",
                                                        req.type === 'annual' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                                                      )}>
                                                        {['maternity', 'paternity', 'solo_parent'].includes(req.type) ? <Baby className="w-4 h-4 md:w-5 md:h-5" /> : req.type === 'annual' ? <Calendar className="w-4 h-4 md:w-5 md:h-5" /> : <Activity className="w-4 h-4 md:w-5 md:h-5" />}
                                                      </div>
                                                      <span className="font-bold text-xs md:text-sm text-slate-800 leading-tight">
                                                        {LEAVE_TYPES[req.type] || req.type}
                                                      </span>
                                                    </div>
                                                  </TableCell>
                                                  
                                                  <TableCell className="align-top py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                      <span className="text-xs md:text-sm font-semibold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                                        {formatDate(req.startDate)} <span className="text-slate-400 mx-1">→</span> {formatDate(req.endDate)}
                                                      </span>
                                                      {req.reason ? (
                                                        <span className="text-xs md:text-sm text-slate-600 italic flex items-start gap-1 line-clamp-2">
                                                          "{req.reason}"
                                                        </span>
                                                      ) : (
                                                        <span className="text-xs font-medium text-slate-400 opacity-70">No reason provided</span>
                                                      )}
                                                    </div>
                                                  </TableCell>

                                                  <TableCell className="align-top py-4">
                                                    {getStatusBadge(req.status!)}
                                                  </TableCell>

                                                  <TableCell className="align-top text-right py-4 pr-4 md:pr-6">
                                                    <span className="font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg text-sm border border-slate-200">
                                                      {req.days}
                                                    </span>
                                                  </TableCell>
                                                </TableRow>
                                              ))
                                            ) : (
                                              <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center">
                                                  <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <FileDown className="w-8 h-8 mb-2 opacity-20" />
                                                    <p className="text-sm font-medium">No leave history found.</p>
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
                            {employeeStats.length === 0 && <div className="text-center py-16 text-slate-400 font-medium mx-4">No data available</div>}
                        </div>
                    </CardContent>
                </Card>
             </div>
          </TabsContent>
          </>
        )}
      </Tabs>

      {/* --- MANAGER MODALS --- */}

      {/* 1. View Details Modal (Calendar & Timeline View) */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-3xl p-0 overflow-hidden bg-slate-50 border-slate-200/60 max-h-[90vh] flex flex-col">
            {selectedRequest && (
                <div className="overflow-y-auto">
                    <div className="bg-white p-4 md:p-6 lg:p-8 border-b border-slate-200">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <UserAvatar user={users?.find(u => u.id === selectedRequest.userId)} className="h-14 w-14 md:h-16 md:w-16 shadow-md" fallbackClassName="text-lg md:text-xl bg-blue-100 text-blue-700" />
                                <div className="min-w-0">
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{getUserName(selectedRequest.userId)}</h2>
                                    <p className="text-slate-500 text-xs md:text-sm font-medium flex items-center gap-2 mt-1 flex-wrap">
                                        {LEAVE_TYPES[selectedRequest.type] || selectedRequest.type}
                                        <span className="text-slate-300 hidden sm:inline">•</span>
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 whitespace-nowrap">{selectedRequest.days} Days</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                                {getStatusBadge(selectedRequest.status!)}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Filed: {formatDate(selectedRequest.createdAt!)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        {/* Left: Info */}
                        <div className="space-y-6">
                            <div>
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Leave Duration</Label>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                                    <div className="flex-1 w-full sm:w-auto">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</p>
                                        <p className="font-semibold text-slate-900 text-sm md:text-base">{formatDate(selectedRequest.startDate)}</p>
                                    </div>
                                    <div className="w-8 flex items-center justify-center text-slate-300 rotate-90 sm:rotate-0">→</div>
                                    <div className="flex-1 w-full sm:w-auto">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</p>
                                        <p className="font-semibold text-slate-900 text-sm md:text-base">{formatDate(selectedRequest.endDate)}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Employee Reason</Label>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-h-[100px] text-sm text-slate-700 leading-relaxed">
                                    {selectedRequest.reason ? `"${selectedRequest.reason}"` : <span className="italic opacity-50">No additional reason provided.</span>}
                                </div>
                            </div>

                            {selectedRequest.status === 'rejected' && selectedRequest.comments && (
                                <div>
                                    <Label className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 block">Rejection Note</Label>
                                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-sm text-rose-700 font-medium">
                                        {selectedRequest.comments}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Calendar Visualization */}
                        <div>
                            <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Calendar Overview</Label>
                            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-center overflow-x-auto scrollbar-hide">
                                {/* FIX: Added fixedWeeks so calendar height stays exactly the same across all months */}
                                <DayPicker 
                                    mode="range"
                                    defaultMonth={new Date(selectedRequest.startDate)}
                                    selected={{
                                        from: new Date(selectedRequest.startDate),
                                        to: new Date(selectedRequest.endDate)
                                    }}
                                    modifiers={{
                                        selected: { from: new Date(selectedRequest.startDate), to: new Date(selectedRequest.endDate) }
                                    }}
                                    modifiersStyles={{
                                        selected: { backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold' } 
                                    }}
                                    styles={{
                                        caption: { color: '#0f172a', fontWeight: 'bold' },
                                        head_cell: { color: '#64748b', fontWeight: 'bold', fontSize: '0.8rem' },
                                    }}
                                    showOutsideDays
                                    fixedWeeks
                                    className="border-0 p-0 m-0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions (Only if Pending) */}
                    {selectedRequest.status === 'pending' && canManageLeaves && (
                        <div className="bg-white p-4 md:p-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                            <Button variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 h-11 px-6 w-full sm:w-auto" onClick={() => setIsRejectDialogOpen(true)}>
                                <X className="w-4 h-4 mr-2" /> Reject
                            </Button>
                            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 h-11 px-8 w-full sm:w-auto" onClick={() => setIsApproveConfirmOpen(true)}>
                                <Check className="w-4 h-4 mr-2" /> Approve Leave
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* 2. Approve Confirmation Alert */}
      <AlertDialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen}>
        <AlertDialogContent className="rounded-3xl w-[90vw] max-w-sm">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-xl">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Confirm Approval
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm md:text-base text-slate-600">
                    Are you sure you want to approve this leave request for <strong className="text-slate-900">{selectedRequest ? getUserName(selectedRequest.userId) : ''}</strong>? 
                    <br/><br/>
                    This will automatically deduct <strong className="text-slate-900">{selectedRequest?.days} days</strong> from their {selectedRequest ? LEAVE_TYPES[selectedRequest.type] : ''} balance.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 md:mt-6 gap-2 sm:gap-0 flex-col sm:flex-row">
                <AlertDialogCancel className="rounded-xl h-11 border-slate-200 m-0 w-full sm:w-auto">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 m-0 w-full sm:w-auto"
                    onClick={confirmApprove}
                    disabled={approveLeaveRequestMutation.isPending}
                >
                    {approveLeaveRequestMutation.isPending ? "Approving..." : "Yes, Approve Leave"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 3. Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => { setIsRejectDialogOpen(open); if (!open) { rejectForm.reset(); }}}>
        <DialogContent className="rounded-3xl w-[95vw] max-w-md p-4 md:p-6">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg md:text-xl text-rose-600">
                    <X className="w-5 h-5 md:w-6 md:h-6" /> Reject Leave Request
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                    Please provide a clear reason for denying this request. This will be visible to the employee.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4 mt-2 md:mt-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Rejection Reason <span className="text-rose-500">*</span></Label>
                    <Textarea 
                        {...rejectForm.register("comments")} 
                        placeholder="e.g. Insufficient coverage on these dates, please reschedule..." 
                        className="rounded-xl resize-none border-slate-200 focus-visible:ring-rose-500 text-sm" 
                        rows={4} 
                    />
                    {rejectForm.formState.errors.comments && <p className="text-xs font-medium text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{rejectForm.formState.errors.comments.message}</p>}
                </div>
                <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl h-11 border-slate-200 w-full sm:w-auto">Cancel</Button>
                    <Button type="submit" variant="destructive" className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 w-full sm:w-auto" disabled={approveLeaveRequestMutation.isPending}>
                        {approveLeaveRequestMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}