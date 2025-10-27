import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
import { insertReportSchema } from "@shared/schema";
import { z } from "zod";
import { AlertTriangle, Package, Plus, Eye, CheckCircle, XCircle, Clock } from "lucide-react";
import type { Report } from "@shared/schema";

const reportFormSchema = insertReportSchema.omit({ userId: true });
type ReportForm = z.infer<typeof reportFormSchema>;

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportType, setReportType] = useState<"incident" | "breakage">("incident");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/reports"],
  });

  const form = useForm<ReportForm>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      type: "incident",
      title: "",
      description: "",
      severity: "low",
      location: "",
      itemName: "",
      itemQuantity: 0,
      estimatedCost: 0,
    },
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: ReportForm) => {
      const res = await apiRequest("POST", "/api/reports", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Your report has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
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

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/reports/${id}`, { status, notes });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Report updated",
        description: "The report has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setSelectedReport(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReportForm) => {
    createReportMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      investigating: { variant: "default", icon: Eye },
      resolved: { variant: "default", icon: CheckCircle },
      closed: { variant: "outline", icon: CheckCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-gray-200 text-gray-800",
      medium: "bg-gray-400 text-gray-900",
      high: "bg-gray-700 text-white",
      critical: "bg-red-600 text-white",
    };
    return (
      <Badge className={colors[severity] || colors.low}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground">Submit and track incident and breakage reports</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit New Report</DialogTitle>
                <DialogDescription>
                  Report an incident or breakage for tracking and resolution
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Report Type</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value) => {
                      form.setValue("type", value as "incident" | "breakage");
                      setReportType(value as "incident" | "breakage");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incident">Incident Report</SelectItem>
                      <SelectItem value="breakage">Breakage Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="Brief description of the issue"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Detailed description of what happened"
                    rows={4}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity</Label>
                    <Select
                      value={form.watch("severity")}
                      onValueChange={(value) => form.setValue("severity", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      {...form.register("location")}
                      placeholder="Where did this occur?"
                    />
                  </div>
                </div>

                {reportType === "breakage" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemName">Item Name</Label>
                      <Input
                        id="itemName"
                        {...form.register("itemName")}
                        placeholder="e.g., Wine glass, Plate"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="itemQuantity">Quantity</Label>
                      <Input
                        id="itemQuantity"
                        type="number"
                        {...form.register("itemQuantity", { valueAsNumber: true })}
                        placeholder="Number of items"
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="estimatedCost">Estimated Cost (₱)</Label>
                      <Input
                        id="estimatedCost"
                        type="number"
                        {...form.register("estimatedCost", { valueAsNumber: true })}
                        placeholder="Estimated replacement cost"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createReportMutation.isPending}>
                    {createReportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Reports</TabsTrigger>
            <TabsTrigger value="incident">Incidents</TabsTrigger>
            <TabsTrigger value="breakage">Breakages</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading reports...</p>
              </div>
            ) : reports && reports.length > 0 ? (
              reports.map((report: Report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  user={user}
                  onUpdate={updateReportMutation.mutate}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  getStatusBadge={getStatusBadge}
                  getSeverityBadge={getSeverityBadge}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No reports found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="incident" className="space-y-4">
            {reports?.filter((r: Report) => r.type === "incident").map((report: Report) => (
              <ReportCard
                key={report.id}
                report={report}
                user={user}
                onUpdate={updateReportMutation.mutate}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                getStatusBadge={getStatusBadge}
                getSeverityBadge={getSeverityBadge}
              />
            ))}
          </TabsContent>

          <TabsContent value="breakage" className="space-y-4">
            {reports?.filter((r: Report) => r.type === "breakage").map((report: Report) => (
              <ReportCard
                key={report.id}
                report={report}
                user={user}
                onUpdate={updateReportMutation.mutate}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                getStatusBadge={getStatusBadge}
                getSeverityBadge={getSeverityBadge}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReportCard({ report, user, onUpdate, formatDate, formatCurrency, getStatusBadge, getSeverityBadge }: any) {
  const [notes, setNotes] = useState("");
  const isManager = user?.role === "manager" || user?.role === "hr";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              report.type === "incident" ? "bg-red-100" : "bg-gray-200"
            }`}>
              {report.type === "incident" ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <Package className="w-6 h-6 text-gray-700" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{report.title}</CardTitle>
                {getStatusBadge(report.status)}
                {getSeverityBadge(report.severity)}
              </div>
              <CardDescription>{formatDate(report.createdAt!)}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{report.description}</p>
        
        {report.location && (
          <div className="text-sm">
            <span className="font-medium">Location:</span> {report.location}
          </div>
        )}

        {report.type === "breakage" && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            {report.itemName && (
              <div>
                <span className="font-medium">Item:</span> {report.itemName}
              </div>
            )}
            {report.itemQuantity && (
              <div>
                <span className="font-medium">Quantity:</span> {report.itemQuantity}
              </div>
            )}
            {report.estimatedCost && (
              <div>
                <span className="font-medium">Est. Cost:</span> {formatCurrency(report.estimatedCost)}
              </div>
            )}
          </div>
        )}

        {isManager && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Select
              defaultValue={report.status}
              onValueChange={(value) => onUpdate({ id: report.id, status: value, notes })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
