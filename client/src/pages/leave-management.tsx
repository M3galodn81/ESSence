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
import { Loader2, Calendar, Clock, Plus, Check, X, Activity, User, FileDown } from "lucide-react";
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

  // 1. My Requests (Standard User)
  const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management"],
  });

  // 2. Pending Approvals (Manager Dashboard)
  const { data: pendingRequests, isLoading: pendingLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-management/pending"],
    enabled: canManageLeaves,
  });

  // 3. All History (Manager Reports)
  const { data: allHistoryRequests } = useQuery<LeaveRequest[]>({
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

  const getUserName = (userId: string) => userMap.get(userId) || "Unknown User";

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
  const pendingCount = pendingRequests?.filter(req => req.status === 'pending').length || 0;

  // ---------------------------------------------------------
  // PDF REPORT GENERATION (Landscape Mode)
  // ---------------------------------------------------------
  const downloadPDF = () => {
    // 1. Initialize in Landscape
    const doc = new jsPDF({ orientation: "landscape" });
    const isManagerView = canManageLeaves;

    if (isManagerView) {
      const data = allHistoryRequests || [];

      if (data.length === 0) {
        toast.error("No history data available to export");
        return;
      }

      // Group by User
      const groupedData: Record<string, LeaveRequest[]> = {};
      data.forEach(req => {
        const uid = req.userId!;
        if (!groupedData[uid]) groupedData[uid] = [];
        groupedData[uid].push(req);
      });

      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text("Employee Leave Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Employees: ${Object.keys(groupedData).length}`, 14, 27);
      
      let finalY = 35;

      Object.keys(groupedData).forEach((userId, index) => {
        const employeeName = getUserName(userId);
        const requests = groupedData[userId];
        
        const approved = requests.filter(r => r.status === 'approved');
        const rejected = requests.filter(r => r.status === 'rejected');

        // Page Break Logic (Landscape height is smaller ~210mm)
        if (finalY > 180) {
          doc.addPage();
          finalY = 20;
        } else if (index > 0) {
           doc.setDrawColor(226, 232, 240);
           doc.setLineWidth(0.5);
           doc.line(14, finalY, 280, finalY); // Wider line for landscape
           finalY += 10;
        }

        // --- SECTION HEADER ---
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(employeeName, 14, finalY);
        
        // --- SUMMARY STATS ---
        finalY += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Requests: ${requests.length}   |   Approved: ${approved.length}   |   Rejected: ${rejected.length}`, 14, finalY);
        finalY += 8;

        // --- TABLE 1: APPROVED LEAVES ---
        if (approved.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(21, 128, 61);
            doc.text(`Approved Leaves (${approved.length})`, 14, finalY);
            
            autoTable(doc, {
                startY: finalY + 2,
                head: [["Type", "Start Date", "End Date", "Days", "Reason"]],
                body: approved.map(req => [
                    req.type === 'annual' ? 'Service Incentive' : 'Addtl Benefit',
                    formatDate(req.startDate),
                    formatDate(req.endDate),
                    req.days,
                    req.reason || "-"
                ]),
                theme: 'grid',
                headStyles: { fillColor: [34, 197, 94], textColor: 255, fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                styles: { cellPadding: 3 },
                margin: { left: 14 }
            });
            finalY = (doc as any).lastAutoTable.finalY + 8;
        }

        // --- TABLE 2: REJECTED LEAVES ---
        if (rejected.length > 0) {
            // Check page break (Landscape height check)
            if (finalY > 170) { doc.addPage(); finalY = 20; }
            
            doc.setFontSize(10);
            doc.setTextColor(190, 18, 60);
            doc.text(`Rejected Leaves (${rejected.length})`, 14, finalY);
            
            autoTable(doc, {
                startY: finalY + 2,
                head: [["Type", "Start Date", "End Date", "Days", "Rejection Comments"]],
                body: rejected.map(req => [
                    req.type === 'annual' ? 'Service Incentive' : 'Addtl Benefit',
                    formatDate(req.startDate),
                    formatDate(req.endDate),
                    req.days,
                    req.comments || "-"
                ]),
                theme: 'grid',
                headStyles: { fillColor: [244, 63, 94], textColor: 255, fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                styles: { cellPadding: 3 },
                margin: { left: 14 }
            });
            finalY = (doc as any).lastAutoTable.finalY + 8;
        }

        if (approved.length === 0 && rejected.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text("No approved or rejected history available.", 14, finalY);
            finalY += 8;
        }
      });

      doc.save("manager_leave_report_landscape.pdf");
    } else {
      // Standard User PDF (Landscape)
      const data = leaveRequests || [];
      if (data.length === 0) { toast.error("No data"); return; }
      doc.text("My Leave History", 14, 20);
      autoTable(doc, {
        head: [["Type", "Start", "End", "Days", "Status", "Reason"]],
        body: data.map(req => [req.type, formatDate(req.startDate), formatDate(req.endDate), req.days, req.status, req.reason || "-"]),
        startY: 30,
        styles: { fontSize: 10, cellPadding: 3 }
      });
      doc.save("my_leave_history.pdf");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
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

      <Tabs defaultValue={canManageLeaves ? "pending" : "my-requests"} className="w-full">
        <div className="flex items-center mb-6">
          <TabsList className="bg-white/40 backdrop-blur-md border border-slate-200/50 p-1 rounded-full h-auto">
            {!canManageLeaves && <TabsTrigger value="my-requests" className="rounded-full px-4 py-2">My Requests</TabsTrigger>}
            {canManageLeaves && (
              <TabsTrigger value="pending" className="rounded-full px-4 py-2">
                Pending Approvals
                {pendingCount > 0 && <Badge className="ml-2 bg-rose-500 text-white h-5 px-1.5 rounded-full">{pendingCount}</Badge>}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="my-requests" className="mt-0">
          <div className="space-y-4">
            {isLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : 
             leaveRequests && leaveRequests.length > 0 ? (
               <div className="grid gap-4">
                 {leaveRequests.map((request) => (
                   <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-white/60 border border-slate-200/60 shadow-sm">
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
            ) : <div className="text-center py-20 text-slate-500">No leave requests history.</div>}
          </div>
        </TabsContent>

        {canManageLeaves && (
          <TabsContent value="pending" className="mt-0">
             {pendingLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div> : (
                <div className="space-y-4">
                  {pendingRequests?.filter(r => r.status === 'pending').length === 0 ? 
                      <div className="text-center py-20 text-slate-500">All caught up! No pending approvals.</div> : 
                      pendingRequests?.filter(r => r.status === 'pending').map((request) => (
                       <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-white border border-amber-100 shadow-sm">
                          <div className="flex items-start gap-4">
                             <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0"><User className="w-6 h-6" /></div>
                             <div>
                                <h4 className="font-bold text-slate-800 text-lg">{getUserName(request.userId)}</h4>
                                <p className="text-sm text-slate-600">Requested <span className="font-semibold text-amber-700">{request.type === 'annual' ? 'Service Incentive' : 'Additional'}</span> for {request.days} days</p>
                                <p className="text-sm text-slate-500">{formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                                {request.reason && <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg mt-2">"{request.reason}"</p>}
                             </div>
                          </div>
                          <div className="mt-4 md:mt-0 flex items-center gap-3 pl-16 md:pl-0">
                             <Button size="sm" onClick={() => handleApprove(request.id)} className="bg-emerald-600 hover:bg-emerald-700 rounded-full"><Check className="w-4 h-4 mr-2" /> Approve</Button>
                             <Button size="sm" variant="outline" onClick={() => handleReject(request.id)} className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-full"><X className="w-4 h-4 mr-2" /> Reject</Button>
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