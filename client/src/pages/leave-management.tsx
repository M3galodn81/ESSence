import { useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import { z } from "zod";
import { Calendar, Clock, Plus, Check, X, Eye } from "lucide-react";
import type { LeaveRequest } from "@shared/schema";

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

export default function LeaveManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: leaveRequests, isLoading } = useQuery({
    queryKey: ["/api/leave-requests"],
  });

  const { data: pendingRequests, isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/leave-requests/pending"],
    enabled: user?.role === 'manager' || user?.role === 'admin',
  });

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
    onSuccess: () => {
      toast({
        title: "Leave request updated",
        description: "The leave request has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/pending"] });
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

  const handleReject = (id: string) => {
    approveLeaveRequestMutation.mutate({ id, status: "rejected" });
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

  const canManageLeaves = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
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

        <Tabs defaultValue="my-requests" className="space-y-6">
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
                                {request.reason}
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
                                Employee ID: {request.userId}
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
                              onClick={() => handleReject(request.id)}
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
      </div>
    </div>
  );
}
