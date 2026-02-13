import { useState, useMemo } from "react";
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
import { Loader2, Calendar, Clock, Plus, Check, X, Activity, User, Download, FileDown } from "lucide-react";
import type { LeaveRequest, User as UserType } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ... (Keep your existing schemas: leaveFormSchema, rejectFormSchema, etc.)
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

  const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management"],
  });

  const { data: pendingRequests, isLoading: pendingLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management/pending"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
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

  const getUserName = (userId: string) => userMap.get(userId) || "Unknown User";

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      type: "annual",
      startDate: "",
      endDate: "",
      days: 1,
      reason: "",
    },
  });

  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { comments: "" },
  });

  const createLeaveRequestMutation = useMutation({
    mutationFn: async (data: LeaveForm) => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneWeekFromNow = new Date(today);
      oneWeekFromNow.setDate(today.getDate() + 7);

      if (startDate < oneWeekFromNow) throw new Error("Start date must be at least 1 week from today");
      if (endDate < startDate) throw new Error("End date must be on or after start date");

      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const res = await apiRequest("POST", "/api/leave-management", {
        ...data,
        startDate,
        endDate,
        days,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Leave request submitted", { description: "Your leave request has been submitted for approval." });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Error submitting leave request:", error);
      toast.error("Submission failed", { description: error.message });
    },
  });

  const approveLeaveRequestMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/leave-management/${id}`, { status, comments });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      toast.success(`Leave request ${variables.status}`, { description: `The leave request has been ${variables.status} successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-management"] });

      if (variables.status === 'rejected') {
        setIsRejectDialogOpen(false);
        setRejectionRequestId(null);
        rejectForm.reset();
      }
    },
    onError: (error: Error) => {
      toast.error("Update failed", { description: error.message });
    },
  });

  const onSubmit = (data: LeaveForm) => createLeaveRequestMutation.mutate(data);
  const handleApprove = (id: string) => approveLeaveRequestMutation.mutate({ id, status: "approved" });
  const handleReject = (id: string) => {
    setRejectionRequestId(id);
    setIsRejectDialogOpen(true);
  };
  const onRejectSubmit = (data: RejectForm) => {
    if (rejectionRequestId) {
      approveLeaveRequestMutation.mutate({ id: rejectionRequestId, status: "rejected", comments: data.comments });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200">Approved</Badge>;
      case "rejected": return <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200">Rejected</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">Pending</Badge>;
    }
  };

  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString();
  const canManageLeaves = user?.role === 'manager' || user?.role === 'admin';
  const pendingCount = pendingRequests?.filter(req => req.status === 'pending').length || 0;

  // ---------------------------------------------------------
  // PDF Table Download Logic
  // ---------------------------------------------------------
  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Determine which dataset to use
    const isManagerView = canManageLeaves;
    const dataToExport = isManagerView ? pendingRequests : leaveRequests;
    const reportTitle = isManagerView ? "Leave Requests Report" : "My Leave History";
    const filename = isManagerView ? "leave_requests_report.pdf" : "my_leave_history.pdf";

    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data available to export");
      return;
    }

    // Add Title
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateStr}`, 14, 30);

    // Prepare Table Data
    const tableColumn = ["Employee", "Type", "Start Date", "End Date", "Days", "Status", "Reason"];
    const tableRows: any[] = [];

    dataToExport.forEach(req => {
      const name = req.userId ? getUserName(req.userId) : `${user?.firstName} ${user?.lastName}`;
      const type = req.type === 'annual' ? 'Service Incentive' : 'Additional Benefit';
      
      const rowData = [
        name,
        type,
        formatDate(req.startDate),
        formatDate(req.endDate),
        req.days,
        req.status?.toUpperCase() || "PENDING",
        req.reason || "-"
      ];
      tableRows.push(rowData);
    });

    // Generate Table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] }, // Slate-900 color for header
      alternateRowStyles: { fillColor: [241, 245, 249] }, // Slate-100 for zebra striping
    });

    // Save
    doc.save(filename);
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" data-testid="page-title">Leave Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your leave requests and view balances</p>
        </div>
        
        <div className="flex gap-2">
            {/* Download PDF Button */}
            <Button 
                variant="outline" 
                onClick={downloadPDF}
                className="rounded-full border-slate-200 shadow-sm hover:bg-slate-50"
            >
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF Report
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) form.reset(); }}>
                <DialogTrigger asChild>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6" data-testid="button-apply-leave">
                    <Plus className="w-4 h-4 mr-2" /> Apply for Leave
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg rounded-2xl">
                    <DialogHeader>
                    <DialogTitle className="text-xl">Apply for Leave</DialogTitle>
                    <DialogDescription>Submit a new request for time off</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="type">Leave Type</Label>
                        <Select onValueChange={(value) => form.setValue("type", value)} defaultValue="annual">
                        <SelectTrigger className="rounded-xl border-slate-200" data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="annual">Service Incentive Leave</SelectItem>
                            <SelectItem value="sick">Additional Leave Benefit</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input id="startDate" type="date" className="rounded-xl border-slate-200" min={getMinStartDate()} {...form.register("startDate")} data-testid="input-start-date" />
                        {form.formState.errors.startDate && <p className="text-xs text-red-500">{form.formState.errors.startDate.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input id="endDate" type="date" className="rounded-xl border-slate-200" min={form.watch("startDate")} {...form.register("endDate")} data-testid="input-end-date" />
                        {form.formState.errors.endDate && <p className="text-xs text-red-500">{form.formState.errors.endDate.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason (Optional)</Label>
                        <Textarea id="reason" className="rounded-xl border-slate-200 resize-none" rows={3} {...form.register("reason")} placeholder="Why are you taking leave?" data-testid="input-reason" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-full">Cancel</Button>
                        <Button type="submit" disabled={createLeaveRequestMutation.isPending} className="rounded-full bg-slate-900" data-testid="button-submit-leave">
                        {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                        </Button>
                    </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Bento Stats - Leave Balances */}
      {!canManageLeaves && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Incentive</p>
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Calendar className="w-4 h-4" /></div>
            </div>
            <div className="flex items-baseline gap-1">
              <h3 className="text-3xl font-bold text-slate-800">{user?.annualLeaveBalance ?? 0}</h3>
              <span className="text-sm text-slate-400 font-medium">/ {user?.annualLeaveBalanceLimit ?? 0} days</span>
            </div>
            <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((user?.annualLeaveBalance || 0) / (user?.annualLeaveBalanceLimit || 1)) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Benefit</p>
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><Activity className="w-4 h-4" /></div>
            </div>
            <div className="flex items-baseline gap-1">
              <h3 className="text-3xl font-bold text-slate-800">{user?.sickLeaveBalance ?? 0}</h3>
              <span className="text-sm text-slate-400 font-medium">/ {user?.sickLeaveBalanceLimit ?? 0} days</span>
            </div>
            <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((user?.sickLeaveBalance || 0) / (user?.sickLeaveBalanceLimit || 1)) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Tabs Section */}
      <Tabs defaultValue={canManageLeaves ? "pending" : "my-requests"} className="w-full">
        <div className="flex items-center mb-6">
          <TabsList className="bg-white/40 backdrop-blur-md border border-slate-200/50 p-1 rounded-full h-auto" data-testid="leave-tabs">
            {!canManageLeaves && (
            <TabsTrigger value="my-requests" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-my-requests">My Requests</TabsTrigger>
            )}
            {canManageLeaves && (
              <TabsTrigger value="pending" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-pending">
                Pending Approvals
                {pendingCount > 0 && <Badge className="ml-2 bg-rose-500 hover:bg-rose-600 border-none text-white h-5 px-1.5 rounded-full">{pendingCount}</Badge>}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="my-requests" className="mt-0 focus-visible:outline-none">
          <div className="space-y-4">
            {isLoading ? (
               <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
            ) : leaveRequests && leaveRequests.length > 0 ? (
               <div className="grid gap-4">
                 {leaveRequests.map((request) => (
                   <div key={request.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-white/60 hover:bg-white border border-slate-200/60 hover:border-blue-200/60 shadow-sm hover:shadow-md transition-all" data-testid={`request-${request.id}`}>
                      <div className="flex items-start gap-4">
                         <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                            {request.type === 'annual' ? <Calendar className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                         </div>
                         <div className="space-y-1">
                            <h4 className="font-semibold text-slate-800">{request.type === 'annual' ? 'Service Incentive' : 'Additional Benefit'} Leave</h4>
                            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                               <span className="font-medium text-slate-700">{formatDate(request.startDate)} - {formatDate(request.endDate)}</span>
                               <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-mono">{request.days} days</span>
                            </div>
                            {request.reason && <p className="text-sm text-slate-500 mt-1 italic">"{request.reason}"</p>}
                            {request.status === 'rejected' && request.comments && (
                               <p className="text-sm text-rose-600 mt-1 font-medium bg-rose-50 p-2 rounded-lg inline-block">Reason: {request.comments}</p>
                            )}
                         </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2">
                         {getStatusBadge(request.status!)}
                         <span className="text-xs text-slate-400">Applied {formatDate(request.createdAt!)}</span>
                      </div>
                   </div>
                 ))}
               </div>
            ) : (
               <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No leave requests history.</p>
               </div>
            )}
          </div>
        </TabsContent>

        {canManageLeaves && (
          <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
             {pendingLoading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
             ) : (
                <div className="space-y-4">
                  {pendingRequests?.filter(r => r.status === 'pending').length === 0 ? (
                      <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                         <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                         <p className="text-slate-500">All caught up! No pending approvals.</p>
                      </div>
                   ) : (
                     pendingRequests?.filter(r => r.status === 'pending').map((request) => (
                       <div key={request.id} className="group flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-white border border-amber-100 shadow-sm hover:shadow-md transition-all" data-testid={`pending-request-${request.id}`}>
                          <div className="flex items-start gap-4">
                             <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                <User className="w-6 h-6" />
                             </div>
                             <div className="space-y-1">
                                <h4 className="font-bold text-slate-800 text-lg">{getUserName(request.userId)}</h4>
                                <p className="text-sm text-slate-600">
                                  Requested <span className="font-semibold text-amber-700">{request.type === 'annual' ? 'Service Incentive' : 'Additional'} Leave</span> for <span className="font-semibold">{request.days} days</span>
                                </p>
                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                   <Calendar className="w-3.5 h-3.5" /> {formatDate(request.startDate)} - {formatDate(request.endDate)}
                                </p>
                                {request.reason && <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg mt-2">"{request.reason}"</p>}
                             </div>
                          </div>
                          <div className="mt-4 md:mt-0 flex items-center gap-3 pl-16 md:pl-0">
                             <Button size="sm" onClick={() => handleApprove(request.id)} disabled={approveLeaveRequestMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg shadow-emerald-600/20" data-testid={`button-approve-${request.id}`}>
                                <Check className="w-4 h-4 mr-2" /> Approve
                             </Button>
                             <Button size="sm" variant="outline" onClick={() => handleReject(request.id)} disabled={approveLeaveRequestMutation.isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-full" data-testid={`button-reject-${request.id}`}>
                                <X className="w-4 h-4 mr-2" /> Reject
                             </Button>
                          </div>
                       </div>
                     ))
                   )}
                </div>
             )}
          </TabsContent>
        )}
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => { setIsRejectDialogOpen(open); if (!open) { setRejectionRequestId(null); rejectForm.reset(); }}}>
        <DialogContent className="rounded-2xl">
            <DialogHeader>
                <DialogTitle className="text-rose-600">Reject Request</DialogTitle>
                <DialogDescription>Provide a reason for rejecting this request.</DialogDescription>
            </DialogHeader>
            <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4">
                <Textarea {...rejectForm.register("comments")} placeholder="Reason for rejection..." className="rounded-xl resize-none" rows={3} data-testid="input-reject-comments" />
                {rejectForm.formState.errors.comments && <p className="text-xs text-rose-600">{rejectForm.formState.errors.comments.message}</p>}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-full">Cancel</Button>
                    <Button type="submit" variant="destructive" className="rounded-full" data-testid="button-confirm-reject">Confirm Rejection</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}