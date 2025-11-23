import { useState , useMemo} from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"; // Added DialogFooter
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import { z } from "zod";
import { Calendar, Clock, Plus, Check, X, Eye, Activity, AlertCircle, Briefcase } from "lucide-react";
import type { LeaveRequest, User } from "@shared/schema"; // Added User type

const leaveFormSchema = insertLeaveRequestSchema.extend({
  startDate: z.string().min(1, "Start date is required")
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneWeekFromNow = new Date(today);
      oneWeekFromNow.setDate(today.getDate() + 7);
      return selectedDate >= oneWeekFromNow;
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

// New schema for rejection comments
const rejectFormSchema = z.object({
    comments: z.string().min(10, "A detailed reason (at least 10 characters) is required for rejection"),
});
type RejectForm = z.infer<typeof rejectFormSchema>;

export default function LeaveManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

    // 🆕 New State for Rejection Dialog
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);

  const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
  });

  //move this to permissions.ts
  const { data: pendingRequests, isLoading: pendingLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests/pending"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
  });

  // Fetch all users to map user IDs to names
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users/"], // An endpoint that returns all users
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/"); 
      return res.json();
    }
  });

  // Memoized map of user IDs to names
  const userMap = useMemo(() => {
    if (!users) {
      return new Map<string, string>();
    }
    // Creates a Map from user ID to full name
    return users.reduce((map, user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
      return map;
    }, new Map<string, string>());
    
  }, [users]);

  const getUserName = (userId: string) => {
    return userMap.get(userId) || "Unknown User";
  };

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

    // 🆕 New form for rejection comments
    const rejectForm = useForm<RejectForm>({
        resolver: zodResolver(rejectFormSchema),
        defaultValues: {
            comments: "",
        },
    });
    
  const createLeaveRequestMutation = useMutation({
    mutationFn: async (data: LeaveForm) => {
      // Validate dates again before submission
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneWeekFromNow = new Date(today);
      oneWeekFromNow.setDate(today.getDate() + 7);

      if (startDate < oneWeekFromNow) {
        throw new Error("Start date must be at least 1 week from today");
      }

      if (endDate < startDate) {
        throw new Error("End date must be on or after start date");
      }

      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const res = await apiRequest("POST", "/api/leave-requests", {
        ...data,
        startDate,
        endDate,
        days,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Leave request submitted",
        description: "Your leave request has been submitted for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveLeaveRequestMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/leave-requests/${id}`, {
        status,
        comments,
      });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: `Leave request ${variables.status}`,
        description: `The leave request has been ${variables.status} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/pending"] });
        if (variables.status === 'rejected') {
            setIsRejectDialogOpen(false);
            setRejectionRequestId(null);
            rejectForm.reset();
        }
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeaveForm) => {
    createLeaveRequestMutation.mutate(data);
  };

  const handleApprove = (id: string) => {
    approveLeaveRequestMutation.mutate({ id, status: "approved" });
  };

    // 🟢 Updated handleReject: Opens the dialog instead of rejecting immediately
  const handleReject = (id: string) => {
        setRejectionRequestId(id);
        setIsRejectDialogOpen(true);
  };
    
    // 🟢 New function for rejection submission
    const onRejectSubmit = (data: RejectForm) => {
        if (rejectionRequestId) {
            approveLeaveRequestMutation.mutate({ 
                id: rejectionRequestId, 
                status: "rejected", 
                comments: data.comments 
            });
        }
    };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-success text-white" data-testid={`status-approved`}>Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid={`status-rejected`}>Rejected</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`status-pending`}>Pending</Badge>;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  //move this to permissions.ts
  const canManageLeaves = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header and Apply Leave Dialog (Unchanged) */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Leave Management</h1>
            <p className="text-muted-foreground">Manage your leave requests and approvals</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-apply-leave">
                <Plus className="w-4 h-4 mr-2" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
                <DialogDescription>Submit a new leave request</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="type">Leave Type</Label>
                  <Select
                    onValueChange={(value) => form.setValue("type", value)}
                    defaultValue="annual"
                  >
                    <SelectTrigger data-testid="select-leave-type">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="personal">Personal Leave</SelectItem>
                      <SelectItem value="emergency">Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      data-testid="input-start-date"
                      min={(() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 7);
                        return date.toISOString().split('T')[0];
                      })()}
                      {...form.register("startDate")}
                    />
                    {form.formState.errors.startDate && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.startDate.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      data-testid="input-end-date"
                      min={form.watch("startDate") || (() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 7);
                        return date.toISOString().split('T')[0];
                      })()}
                      {...form.register("endDate")}
                    />
                    {form.formState.errors.endDate && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.endDate.message}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    data-testid="input-reason"
                    {...form.register("reason")}
                    placeholder="Provide a reason for your leave request"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createLeaveRequestMutation.isPending}
                    data-testid="button-submit-leave"
                  >
                    {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 🟢 Leave Balance Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium text-muted-foreground">Annual Leave</p>
                        <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <h3 className="text-2xl font-bold">{user?.annualLeaveBalance ?? 0}</h3>
                        <span className="text-sm text-muted-foreground">/ {user?.annualLeaveBalanceLimit ?? 0} days</span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(100, ((user?.annualLeaveBalance || 0) / (user?.annualLeaveBalanceLimit || 1)) * 100)}%` }} 
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium text-muted-foreground">Sick Leave</p>
                        <Activity className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <h3 className="text-2xl font-bold">{user?.sickLeaveBalance ?? 0}</h3>
                        <span className="text-sm text-muted-foreground">/ {user?.sickLeaveBalanceLimit ?? 0} days</span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${Math.min(100, ((user?.sickLeaveBalance || 0) / (user?.sickLeaveBalanceLimit || 1)) * 100)}%` }} 
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium text-muted-foreground">Service Incentive</p>
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <h3 className="text-2xl font-bold">{user?.serviceIncentiveLeaveBalance ?? 0}</h3>
                        <span className="text-sm text-muted-foreground">/ {user?.serviceIncentiveLeaveBalanceLimit ?? 0} days</span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${Math.min(100, ((user?.serviceIncentiveLeaveBalance || 0) / (user?.serviceIncentiveLeaveBalanceLimit || 1)) * 100)}%` }} 
                        />
                    </div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="my-requests" className="space-y-6">
          {/* TabsList and TabsContent for My Requests (Unchanged) */}
            <TabsList data-testid="leave-tabs">
            <TabsTrigger value="my-requests" data-testid="tab-my-requests">My Requests</TabsTrigger>
            {canManageLeaves && (
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending Approvals
                {pendingRequests && pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
            
            <TabsContent value="my-requests">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Calendar className="w-5 h-5 mr-2" />
                            My Leave Requests
                        </CardTitle>
                        <CardDescription>View and track your leave requests</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8" data-testid="loading-my-requests">
                                <p className="text-muted-foreground">Loading leave requests...</p>
                            </div>
                        ) : leaveRequests && leaveRequests.length > 0 ? (
                            <div className="space-y-4">
                                {leaveRequests.map((request: LeaveRequest) => (
                                    <div
                                        key={request.id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                        data-testid={`request-${request.id}`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                                <Calendar className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium capitalize" data-testid={`request-type-${request.id}`}>
                                                    {request.type} Leave
                                                </h4>
                                                <p className="text-sm text-muted-foreground" data-testid={`request-dates-${request.id}`}>
                                                    {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.days} days)
                                                </p>
                                                {request.reason && (
                                <p className="text-sm text-muted-foreground mt-1" data-testid={`request-reason-${request.id}`}>
                                  **Reason:** {request.reason}
                                </p>
                              )}
                              {/* 🟢 Display Rejection Comment if status is rejected and comments exist */}
                              {request.status === 'rejected' && request.comments && (
                                <p className="text-sm text-destructive mt-1" data-testid={`rejection-comments-${request.id}`}>
                                  **Rejected Reason:** {request.comments}
                                </p>
                              )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {getStatusBadge(request.status!)}
                                            <p className="text-xs text-muted-foreground mt-1" data-testid={`request-created-${request.id}`}>
                                                Applied on {formatDate(request.createdAt!)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8" data-testid="no-requests">
                                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">No leave requests found</p>
                                <p className="text-sm text-muted-foreground">Start by applying for your first leave</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

          {canManageLeaves && (
            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Pending Approvals
                  </CardTitle>
                  <CardDescription>Review and approve leave requests from your team</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingLoading ? (
                    <div className="text-center py-8" data-testid="loading-pending">
                      <p className="text-muted-foreground">Loading pending requests...</p>
                    </div>
                  ) : pendingRequests && pendingRequests.length > 0 ? (
                    <div className="space-y-4">
                      {pendingRequests.map((request: LeaveRequest) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`pending-request-${request.id}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                              <Clock className="w-6 h-6 text-warning" />
                            </div>
                            <div>
                              <h4 className="font-medium" data-testid={`pending-employee-${request.id}`}>
                                Employee Name: {getUserName(request.userId)}
                              </h4>
                              <p className="text-sm text-muted-foreground capitalize" data-testid={`pending-type-${request.id}`}>
                                {request.type} Leave
                              </p>
                              <p className="text-sm text-muted-foreground" data-testid={`pending-dates-${request.id}`}>
                                {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.days} days)
                              </p>
                              {request.reason && (
                                <p className="text-sm text-muted-foreground mt-1" data-testid={`pending-reason-${request.id}`}>
                                  Reason: {request.reason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={approveLeaveRequestMutation.isPending}
                              data-testid={`button-approve-${request.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)} // 🟢 Calls new handleReject
                              disabled={approveLeaveRequestMutation.isPending}
                              data-testid={`button-reject-${request.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8" data-testid="no-pending">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No pending approvals</p>
                      <p className="text-sm text-muted-foreground">All leave requests have been processed</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
        
        {/* 🟢 New Rejection Pop-up Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
            setIsRejectDialogOpen(open);
            if (!open) {
                setRejectionRequestId(null);
                rejectForm.reset();
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-destructive">Reject Leave Request</DialogTitle>
                    <DialogDescription>
                        Please provide a detailed reason for rejecting this leave request. This reason will be sent to the employee.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="reject-comments">Rejection Reason *</Label>
                        <Textarea
                            id="reject-comments"
                            data-testid="input-reject-comments"
                            {...rejectForm.register("comments")}
                            placeholder="e.g., Conflicts with a major project deadline, insufficient coverage, etc."
                            rows={4}
                        />
                        {rejectForm.formState.errors.comments && (
                            <p className="text-sm text-destructive mt-1">
                                {rejectForm.formState.errors.comments.message}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsRejectDialogOpen(false)}
                            data-testid="button-reject-cancel"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={approveLeaveRequestMutation.isPending || !rejectionRequestId}
                            data-testid="button-confirm-reject"
                        >
                            {approveLeaveRequestMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}