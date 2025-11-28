import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { insertReportSchema } from "@shared/schema";
import { z } from "zod";
import { AlertTriangle, Package, Plus, Eye, CheckCircle, XCircle, Clock, FileText, Activity, AlertCircle } from "lucide-react";
import type { Report } from "@shared/schema";
import { BentoCard } from "@/components/custom/bento-card"; 

const reportFormSchema = insertReportSchema.omit({ userId: true });
type ReportForm = z.infer<typeof reportFormSchema>;

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      toast({ title: "Report submitted", description: "Your report has been submitted successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/reports/${id}`, { status, notes });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Report updated", description: "The report has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ReportForm) => {
    createReportMutation.mutate(data);
  };

  // Stats Calculation
  const stats = useMemo(() => {
    if (!reports) return { total: 0, incidents: 0, breakages: 0, resolved: 0 };
    return {
        total: reports.length,
        incidents: reports.filter((r: Report) => r.type === 'incident' && r.status !== 'closed').length,
        breakages: reports.filter((r: Report) => r.type === 'breakage' && r.status !== 'closed').length,
        resolved: reports.filter((r: Report) => r.status === 'resolved' || r.status === 'closed').length
    };
  }, [reports]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Incidents & Breakages</h1>
          <p className="text-slate-500 mt-1 text-sm">Submit and track operational issues</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/20 rounded-full px-6">
              <Plus className="w-4 h-4 mr-2" /> New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Submit New Report</DialogTitle>
              <DialogDescription>Report an incident or breakage for tracking and resolution</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="type">Report Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => {
                    form.setValue("type", value as "incident" | "breakage");
                    setReportType(value as "incident" | "breakage");
                  }}
                >
                  <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="incident">Incident Report</SelectItem>
                    <SelectItem value="breakage">Breakage Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...form.register("title")} placeholder="Brief description of the issue" className="rounded-xl border-slate-200" />
                {form.formState.errors.title && <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...form.register("description")} placeholder="Detailed description of what happened" rows={4} className="rounded-xl border-slate-200 resize-none" />
                {form.formState.errors.description && <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select value={form.watch("severity")} onValueChange={(value) => form.setValue("severity", value)}>
                    <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" {...form.register("location")} placeholder="Where did this occur?" className="rounded-xl border-slate-200" />
                </div>
              </div>

              {reportType === "breakage" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <Label htmlFor="itemName">Item Name</Label>
                    <Input id="itemName" {...form.register("itemName")} placeholder="e.g., Wine glass" className="rounded-xl border-slate-200 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemQuantity">Quantity</Label>
                    <Input id="itemQuantity" type="number" {...form.register("itemQuantity", { valueAsNumber: true })} placeholder="1" className="rounded-xl border-slate-200 bg-white" />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-full">Cancel</Button>
                <Button type="submit" disabled={createReportMutation.isPending} className="rounded-full bg-rose-600 hover:bg-rose-700">
                  {createReportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BentoCard title="Total Reports" value={stats.total} icon={FileText} variant="default" testIdPrefix="stat-total" />
        <BentoCard title="Active Incidents" value={stats.incidents} icon={AlertTriangle} variant="rose" testIdPrefix="stat-incidents" />
        <BentoCard title="Breakages" value={stats.breakages} icon={Package} variant="amber" testIdPrefix="stat-breakages" />
        <BentoCard title="Resolved" value={stats.resolved} icon={CheckCircle} variant="emerald" testIdPrefix="stat-resolved" />
      </div>

      {/* Tabs & List */}
      <Tabs defaultValue="all" className="w-full space-y-6">
        <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 p-1 rounded-full w-fit shadow-sm">
            <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger value="all" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">All Reports</TabsTrigger>
                <TabsTrigger value="incident" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Incidents</TabsTrigger>
                <TabsTrigger value="breakage" className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Breakages</TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="all" className="mt-0 space-y-4">
           <ReportList reports={reports} isLoading={isLoading} onUpdate={updateReportMutation.mutate} user={user} />
        </TabsContent>
        <TabsContent value="incident" className="mt-0 space-y-4">
           <ReportList reports={reports?.filter((r: Report) => r.type === "incident")} isLoading={isLoading} onUpdate={updateReportMutation.mutate} user={user} />
        </TabsContent>
        <TabsContent value="breakage" className="mt-0 space-y-4">
           <ReportList reports={reports?.filter((r: Report) => r.type === "breakage")} isLoading={isLoading} onUpdate={updateReportMutation.mutate} user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportList({ reports, isLoading, onUpdate, user }: any) {
    if (isLoading) return <div className="text-center py-12 text-slate-400">Loading reports...</div>;
    
    if (!reports || reports.length === 0) {
        return (
            <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
                <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500">No reports found in this category.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {reports.map((report: Report) => (
                <ReportCard key={report.id} report={report} user={user} onUpdate={onUpdate} />
            ))}
        </div>
    );
}

function ReportCard({ report, user, onUpdate }: any) {
  const [notes, setNotes] = useState("");
  const isManager = user?.role === "manager" || user?.role === "hr";

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-slate-100 text-slate-600 border-slate-200",
      investigating: "bg-blue-100 text-blue-700 border-blue-200",
      resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      closed: "bg-slate-900 text-white border-slate-900",
    };
    const icons = {
      pending: Clock,
      investigating: Eye,
      resolved: CheckCircle,
      closed: XCircle,
    };
    const Icon = icons[status as keyof typeof icons] || Clock;
    
    return (
      <Badge variant="outline" className={`${styles[status as keyof typeof styles] || styles.pending} flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-medium capitalize`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getSeverityColor = (severity: string) => {
     switch(severity) {
         case 'critical': return 'bg-red-50 border-red-100 text-red-700';
         case 'high': return 'bg-orange-50 border-orange-100 text-orange-700';
         case 'medium': return 'bg-amber-50 border-amber-100 text-amber-700';
         default: return 'bg-slate-50 border-slate-100 text-slate-600';
     }
  };

  return (
    <Card className="group bg-white/60 backdrop-blur-xl border-slate-200/60 hover:border-slate-300 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
           {/* Icon Column */}
           <div className="flex-shrink-0">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                 report.type === 'incident' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}>
                  {report.type === 'incident' ? <AlertTriangle className="w-7 h-7" /> : <Package className="w-7 h-7" />}
              </div>
           </div>

           {/* Content Column */}
           <div className="flex-1 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                 <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800 leading-none">{report.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                       <CalendarCheck className="w-3 h-3" /> 
                       {new Date(report.createdAt!).toLocaleDateString()} 
                       {report.location && <span className="flex items-center gap-1 ml-2"><span className="w-1 h-1 rounded-full bg-slate-300" /> {report.location}</span>}
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`capitalize border ${getSeverityColor(report.severity || 'low')}`}>
                       {report.severity} Priority
                    </Badge>
                    {getStatusBadge(report.status || 'pending')}
                 </div>
              </div>

              <div className="p-4 bg-white/50 rounded-xl border border-slate-100/50 text-sm text-slate-600 leading-relaxed">
                 {report.description}
              </div>

              {report.type === 'breakage' && (
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100/50">
                       <p className="text-xs text-amber-600/80 uppercase tracking-wider font-semibold">Item</p>
                       <p className="font-medium text-slate-800">{report.itemName || '-'}</p>
                    </div>
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100/50">
                       <p className="text-xs text-amber-600/80 uppercase tracking-wider font-semibold">Quantity</p>
                       <p className="font-medium text-slate-800">{report.itemQuantity || 0}</p>
                    </div>
                 </div>
              )}

              {isManager && (
                 <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Actions:</span>
                    <Select defaultValue={report.status} onValueChange={(value) => onUpdate({ id: report.id, status: value, notes })}>
                       <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg bg-white border-slate-200"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="investigating">Investigating</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              )}
           </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}