import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Calendar, Clock, Plus, Check, X, Activity, User, FileDown, Filter, PieChart, Users, ChevronsUpDown, Search } from "lucide-react";
import type { LeaveRequest, User as UserType } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const leaveFormSchema = insertLeaveRequestSchema.extend({
  startDate: z.string().min(1, "Start date is required")
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + 7);
      return selectedDate >= minDate;
    }, "Start date must be at least 1 week from today"),
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
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
};

export default function LeaveManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const canManageLeaves = user?.role === 'manager' || user?.role === 'admin';

  // --- FILTER STATES ---
  // User Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Manager Filters
  const [mgrStatusFilter, setMgrStatusFilter] = useState<string>("all");
  const [mgrTypeFilter, setMgrTypeFilter] = useState<string>("all");
  const [mgrEmployeeFilter, setMgrEmployeeFilter] = useState<string>("all");

  // Combobox State
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. My Requests
  const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management"],
  });

  // 2. All History
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

  // SORTED & FILTERED EMPLOYEES for Combobox
  const sortedEmployees = useMemo(() => {
    if (!users) return [];
    
    // 1. Filter out admins/self
    let employees = users.filter(u => u.role !== 'admin' && u.id !== user?.id);
    
    // 2. Sort by Last Name
    employees.sort((a, b) => a.lastName.localeCompare(b.lastName));

    // 3. Filter by Search Query
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

  const { mgrFilteredRequests, mgrStats, totalPendingCount } = useMemo(() => {
    const data = allHistoryRequests || [];
    const totalPendingCount = data.filter(r => r.status === 'pending').length;

    const stats = {
        total: data.length,
        approved: data.filter(r => r.status === 'approved').length,
        pending: totalPendingCount,
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

    return { mgrFilteredRequests: sorted, mgrStats: stats, totalPendingCount };
  }, [allHistoryRequests, mgrStatusFilter, mgrTypeFilter, mgrEmployeeFilter]);

  const getUserName = (userId: string) => userMap.get(userId) || "Unknown User";

  // Get selected employee name for button label
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
    const isManagerView = canManageLeaves;

    if (isManagerView) {
      const data = allHistoryRequests || [];
      if (data.length === 0) { toast.error("No history data available to export"); return; }
      
      const groupedData: Record<string, LeaveRequest[]> = {};
      data.forEach(req => {
        const uid = req.userId!;
        if (!groupedData[uid]) groupedData[uid] = [];
        groupedData[uid].push(req);
      });

      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text("Employee Leave Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Records: ${data.length}`, 14, 27);
      
      let finalY = 35;

      Object.keys(groupedData).forEach((userId, index) => {
        const employeeName = getUserName(userId);
        const requests = groupedData[userId];
        const approved = requests.filter(r => r.status === 'approved');
        const rejected = requests.filter(r => r.status === 'rejected');

        if (finalY > 180) { doc.addPage(); finalY = 20; } 
        else if (index > 0) {
           doc.setDrawColor(226, 232, 240);
           doc.setLineWidth(0.5);
           doc.line(14, finalY, 280, finalY);
           finalY += 10;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(employeeName, 14, finalY);
        
        finalY += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Requests: ${requests.length}   |   Approved: ${approved.length}   |   Rejected: ${rejected.length}`, 14, finalY);
        finalY += 8;

        if (approved.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(21, 128, 61);
            doc.text(`Approved Leaves (${approved.length})`, 14, finalY);
            autoTable(doc, {
                startY: finalY + 2,
                head: [["Type", "Start Date", "End Date", "Days", "Reason"]],
                body: approved.map(req => [ req.type === 'annual' ? 'Service Incentive' : 'Addtl Benefit', formatDate(req.startDate), formatDate(req.endDate), req.days, req.reason || "-" ]),
                theme: 'grid',
                headStyles: { fillColor: [34, 197, 94], textColor: 255, fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                styles: { cellPadding: 3 },
                margin: { left: 14 }
            });
            finalY = (doc as any).lastAutoTable.finalY + 8;
        }

        if (rejected.length > 0) {
            if (finalY > 170) { doc.addPage(); finalY = 20; }
            doc.setFontSize(10);
            doc.setTextColor(190, 18, 60);
            doc.text(`Rejected Leaves (${rejected.length})`, 14, finalY);
            autoTable(doc, {
                startY: finalY + 2,
                head: [["Type", "Start Date", "End Date", "Days", "Rejection Comments"]],
                body: rejected.map(req => [ req.type === 'annual' ? 'Service Incentive' : 'Addtl Benefit', formatDate(req.startDate), formatDate(req.endDate), req.days, req.comments || "-" ]),
                theme: 'grid',
                headStyles: { fillColor: [244, 63, 94], textColor: 255, fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                styles: { cellPadding: 3 },
                margin: { left: 14 }
            });
            finalY = (doc as any).lastAutoTable.finalY + 8;
        }
      });
      doc.save("manager_leave_report_landscape.pdf");
    } else {
      if (filteredRequests.length === 0) { toast.error("No data matching current filters"); return; }
      doc.text("My Leave History", 14, 20);
      autoTable(doc, {
        head: [["Type", "Start", "End", "Days", "Status", "Reason"]],
        body: filteredRequests.map(req => [req.type === 'annual' ? 'Service' : 'Addtl', formatDate(req.startDate), formatDate(req.endDate), req.days, req.status, req.reason || "-"]),
        startY: 30,
        styles: { fontSize: 10, cellPadding: 3 }
      });
      doc.save("my_leave_history.pdf");
    }
  };

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
                            <SelectItem value="annual">Service Incentive Leave</SelectItem>
                            <SelectItem value="sick">Additional Leave Benefit</SelectItem>
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
              <TabsTrigger value="manage" className="rounded-full px-4 py-2">
                Manage Requests
                {totalPendingCount > 0 && <Badge className="ml-2 bg-rose-500 text-white h-5 px-1.5 rounded-full">{totalPendingCount}</Badge>}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ----------------- USER VIEW ----------------- */}
        <TabsContent value="my-requests" className="mt-0 space-y-6">
          {!isLoading && (
            <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                         <div><p className="text-xs font-semibold text-emerald-600 uppercase">Approved</p><p className="text-2xl font-bold text-emerald-700">{stats.approved}</p></div>
                         <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Check className="w-4 h-4"/></div>
                     </div>
                     <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                         <div><p className="text-xs font-semibold text-amber-600 uppercase">Pending</p><p className="text-2xl font-bold text-amber-700">{stats.pending}</p></div>
                         <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600"><Clock className="w-4 h-4"/></div>
                     </div>
                     <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center justify-between">
                         <div><p className="text-xs font-semibold text-rose-600 uppercase">Rejected</p><p className="text-2xl font-bold text-rose-700">{stats.rejected}</p></div>
                         <div className="h-8 w-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-600"><X className="w-4 h-4"/></div>
                     </div>
                     <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                         <div><p className="text-xs font-semibold text-slate-500 uppercase">Total</p><p className="text-2xl font-bold text-slate-700">{stats.total}</p></div>
                         <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><PieChart className="w-4 h-4"/></div>
                     </div>
                </div>
                {/* User Filters */}
                <div className="bg-white/50 backdrop-blur-sm border border-slate-200 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Filter className="w-4 h-4" /> Filter:</div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[160px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="annual">Service Incentive</SelectItem><SelectItem value="sick">Additional Benefit</SelectItem></SelectContent>
                        </Select>
                        {(statusFilter !== "all" || typeFilter !== "all") && (
                            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); }} className="h-9 text-slate-500 hover:text-slate-900">Reset</Button>
                        )}
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
                            {request.type === 'annual' ? <Calendar className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                         </div>
                         <div>
                            <h4 className="font-semibold text-slate-800">{request.type === 'annual' ? 'Service Incentive' : 'Additional Benefit'} Leave</h4>
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
            ) : (
                <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Filter className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500">No requests found matching your filters.</p>
                </div>
            )}
          </div>
        </TabsContent>

        {/* ----------------- MANAGER VIEW ----------------- */}
        {canManageLeaves && (
          <TabsContent value="manage" className="mt-0 space-y-6">
             {mgrLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : (
                <div className="space-y-4">
                  {/* Manager Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                           <div><p className="text-xs font-semibold text-emerald-600 uppercase">Approved</p><p className="text-2xl font-bold text-emerald-700">{mgrStats.approved}</p></div>
                           <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Check className="w-4 h-4"/></div>
                       </div>
                       <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                           <div><p className="text-xs font-semibold text-amber-600 uppercase">Pending</p><p className="text-2xl font-bold text-amber-700">{mgrStats.pending}</p></div>
                           <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600"><Clock className="w-4 h-4"/></div>
                       </div>
                       <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center justify-between">
                           <div><p className="text-xs font-semibold text-rose-600 uppercase">Rejected</p><p className="text-2xl font-bold text-rose-700">{mgrStats.rejected}</p></div>
                           <div className="h-8 w-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-600"><X className="w-4 h-4"/></div>
                       </div>
                       <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                           <div><p className="text-xs font-semibold text-slate-500 uppercase">Total</p><p className="text-2xl font-bold text-slate-700">{mgrStats.total}</p></div>
                           <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><PieChart className="w-4 h-4"/></div>
                       </div>
                  </div>

                  {/* Manager Filters */}
                  <div className="bg-white/50 backdrop-blur-sm border border-slate-200 p-3 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
                      <div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Filter className="w-4 h-4" /> Filter:</div>
                      <div className="flex flex-wrap gap-2 w-full">
                          
                          {/* ---------------- NEW COMBOBOX ---------------- */}
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

                             {/* Dropdown Content */}
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
                          {/* --------------------------------------------- */}

                          <Select value={mgrStatusFilter} onValueChange={setMgrStatusFilter}>
                              <SelectTrigger className="w-[140px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                          </Select>

                          <Select value={mgrTypeFilter} onValueChange={setMgrTypeFilter}>
                              <SelectTrigger className="w-[160px] h-9 rounded-lg bg-white border-slate-200 text-sm"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                              <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="annual">Service Incentive</SelectItem><SelectItem value="sick">Additional Benefit</SelectItem></SelectContent>
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
                                <p className="text-sm text-slate-600">Requested <span className={`font-semibold ${request.type === 'annual' ? 'text-blue-600' : 'text-rose-600'}`}>{request.type === 'annual' ? 'Service Incentive' : 'Additional'}</span> for {request.days} days</p>
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