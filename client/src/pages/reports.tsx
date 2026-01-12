import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReportSchema } from "@shared/schema";
import { z } from "zod";
import { 
  AlertTriangle, ShieldAlert, UserX, Stethoscope, 
  Hammer, FileWarning, Plus, Calendar as CalendarIcon, Clock, 
  Eye, FileText, MapPin, CheckCircle2, AlertCircle, Filter, ArrowUpDown, X
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

// Extend the schema to handle the nested JSON 'details' field in the form
const reportFormSchema = insertReportSchema.omit({ userId: true }).extend({
    details: z.object({
        itemName: z.string().optional(),
        policeReportNumber: z.string().optional(),
        injuryType: z.string().optional(),
        medicalAction: z.string().optional()
    }).optional()
});

type ReportForm = z.infer<typeof reportFormSchema>;

export default function Reports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // --- Filter States ---
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Real-life categories
  const categories = [
    { id: "customer", label: "Customer Incident", icon: UserX, color: "bg-orange-100 text-orange-600", desc: "Fights, harassment, intoxicated guests" },
    { id: "employee", label: "Employee Incident", icon: FileWarning, color: "bg-blue-100 text-blue-600", desc: "Staff injury, misconduct, rule violations" },
    { id: "accident", label: "Accident Report", icon: AlertTriangle, color: "bg-yellow-100 text-yellow-600", desc: "Slips, falls, broken glass, burns" },
    { id: "security", label: "Security Incident", icon: ShieldAlert, color: "bg-red-100 text-red-600", desc: "Theft, vandalism, trespassing" },
    { id: "medical", label: "Medical Incident", icon: Stethoscope, color: "bg-rose-100 text-rose-600", desc: "Guest or staff illness/injury requiring aid" },
    { id: "property", label: "Property Damage", icon: Hammer, color: "bg-slate-100 text-slate-600", desc: "Damaged furniture, equipment, facilities" },
  ];

  const { data: reports, isLoading } = useQuery({ queryKey: ["/api/reports"] });

  // --- Filtering Logic ---
  const filteredReports = useMemo(() => {
    if (!reports) return [];

    return reports.filter((r: any) => {
        // 1. Status Filter
        if (statusFilter !== "all" && r.status !== statusFilter) return false;

        // 2. Category Filter
        if (categoryFilter !== "all" && r.category !== categoryFilter) return false;

        // 3. Date Range Filter
        if (dateRange.from && dateRange.to && r.dateOccurred) {
            const reportDate = new Date(r.dateOccurred);
            // Ensure comparison covers the whole day
            if (!isWithinInterval(reportDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
                return false;
            }
        }
        return true;
    }).sort((a: any, b: any) => {
        // 4. Sort (Date + Time)
        // Combine date and time string to compare properly
        const getDateObj = (dateStr: string | Date, timeStr: string) => {
            const d = new Date(dateStr);
            const [hours, minutes] = timeStr.split(':').map(Number);
            d.setHours(hours || 0, minutes || 0);
            return d.getTime();
        };

        const timeA = getDateObj(a.dateOccurred, a.timeOccurred);
        const timeB = getDateObj(b.dateOccurred, b.timeOccurred);

        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [reports, statusFilter, categoryFilter, dateRange, sortOrder]);


  const form = useForm<ReportForm>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      category: "customer",
      severity: "low",
      dateOccurred: new Date(), 
      timeOccurred: format(new Date(), "HH:mm"),
      details: {}
    },
  });

  const selectedCategory = form.watch("category");

  const createReportMutation = useMutation({
    mutationFn: async (data: ReportForm) => {
      const res = await apiRequest("POST", "/api/reports", data);
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Report Filed Successfully", { description: "The incident has been logged and notified to management." });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (err) => toast.error("Failed to file report", { description: err.message })
  });

  // View Details Modal State
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  
  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setIsViewOpen(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Incident Reporting</h1>
          <p className="text-slate-500 mt-1">Official documentation for workplace incidents</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white rounded-full px-6 shadow-lg hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" /> File Official Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
             {/* ... (Existing Create Form Code) ... */}
             {/* I am hiding the create form internals for brevity since they didn't change, 
                 but in your real file keep the form code here. */}
             <DialogHeader className="border-b border-slate-100 pb-4">
              <DialogTitle className="text-xl font-bold">File Incident Report</DialogTitle>
              <p className="text-sm text-slate-500">Please provide factual, objective details.</p>
            </DialogHeader>
              
            <form onSubmit={form.handleSubmit((d) => createReportMutation.mutate(d))} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label>Report Category</Label>
                      <Select value={selectedCategory} onValueChange={(val) => form.setValue("category", val)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                              {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select onValueChange={(val) => form.setValue("severity", val)} defaultValue="low">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" {...form.register("dateOccurred", { valueAsDate: true })} />
                  </div>
                  <div className="space-y-2">
                      <Label>Time</Label>
                      <Input type="time" {...form.register("timeOccurred")} />
                  </div>
                  <div className="space-y-2">
                      <Label>Location</Label>
                      <Input placeholder="e.g. Kitchen" {...form.register("location")} />
                  </div>
              </div>

              <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Brief summary" {...form.register("title")} />
              </div>
              <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Detailed description..." {...form.register("description")} />
              </div>
              <div className="space-y-2">
                  <Label>Action Taken</Label>
                  <Textarea placeholder="Immediate actions..." {...form.register("actionTaken")} />
              </div>
              
              {/* Conditional Fields */}
              {selectedCategory === 'property' && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                      <h4 className="font-medium">Property Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <Input placeholder="Item Name" {...form.register("details.itemName")} />
                      </div>
                  </div>
              )}
              {selectedCategory === 'security' && (
                  <div className="bg-red-50 p-4 rounded-lg">
                      <Label>Police Report #</Label>
                      <Input placeholder="PR-XXXX" {...form.register("details.policeReportNumber")} />
                  </div>
              )}
              {selectedCategory === 'medical' && (
                  <div className="bg-rose-50 p-4 rounded-lg">
                      <Label>Injury Type</Label>
                      <Input placeholder="e.g. Burn" {...form.register("details.injuryType")} />
                  </div>
              )}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Report</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- Filter Toolbar --- */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    
                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-[300px] h-10 border-slate-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-500" />
                                <span className="text-slate-600">Category:</span>
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[200px] h-10 border-slate-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-slate-500" />
                                <span className="text-slate-600">Status:</span>
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Range Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("h-10 justify-start text-left font-normal border-slate-200 rounded-lg w-full sm:w-[240px]", !dateRange.from && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "PPP")
                                    )
                                ) : (
                                    <span>Filter by Date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange.from}
                                selected={dateRange}
                                onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Sort & Reset */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                        <SelectTrigger className="w-full sm:w-[150px] h-10 border-none bg-slate-50 shadow-none rounded-lg">
                            <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    {(categoryFilter !== 'all' || statusFilter !== 'all' || dateRange.from) && (
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-500 hover:text-slate-900 h-10 w-10"
                            onClick={() => {
                                setCategoryFilter('all');
                                setStatusFilter('all');
                                setDateRange({ from: undefined, to: undefined });
                            }}
                            title="Reset Filters"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </CardContent>
      </Card>

      {/* Reports Display Grid */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
            <div className="text-center py-10 text-slate-400">Loading records...</div>
        ) : filteredReports.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Filter className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-sm font-medium text-slate-900">No reports found</h3>
                <p className="text-sm text-slate-500 mt-1">Try adjusting your filters to see more results.</p>
            </div>
        ) : filteredReports.map((report: any) => {
            const cat = categories.find(c => c.id === report.category) || categories[0];
            const Icon = cat.icon;

            return (
                <Card key={report.id} className="hover:shadow-md transition-all border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cat.color}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg">{report.title}</h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                            <Badge variant="outline" className="bg-slate-50 font-normal">
                                                {cat.label}
                                            </Badge>
                                            <span>•</span>
                                            <span>{format(new Date(report.dateOccurred), "MMM dd, yyyy")}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {report.timeOccurred}</span>
                                        </div>
                                    </div>
                                    <Badge className={cn("capitalize", 
                                        report.severity === 'critical' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                        report.severity === 'high' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                    )}>
                                        {report.severity} Priority
                                    </Badge>
                                </div>
                                
                                <p className="text-slate-600 text-sm line-clamp-2">
                                    {report.description}
                                </p>
                                
                                <div className="pt-2 flex justify-end">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-slate-600 gap-2 rounded-full hover:bg-slate-50 hover:text-slate-900"
                                        onClick={() => handleViewReport(report)}
                                    >
                                        <FileText className="w-4 h-4" /> View Full Report
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        })}
      </div>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedReport && (
                <>
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                                {categories.find(c => c.id === selectedReport.category)?.label || "Report"}
                            </Badge>
                            <Badge className={cn("capitalize", 
                                selectedReport.severity === 'critical' ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            )}>
                                {selectedReport.severity} Priority
                            </Badge>
                        </div>
                        <DialogTitle className="text-2xl font-bold text-slate-900">{selectedReport.title}</DialogTitle>
                        <DialogDescription className="flex items-center gap-2 text-slate-500">
                            <CalendarIcon className="w-4 h-4" /> {format(new Date(selectedReport.dateOccurred), "MMMM dd, yyyy")} 
                            <Clock className="w-4 h-4 ml-2" /> {selectedReport.timeOccurred}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* 1. Location & Context */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase">Location</span>
                                <div className="flex items-center gap-2 font-medium text-slate-900">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    {selectedReport.location}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
                                <div className="flex items-center gap-2 font-medium text-slate-900 capitalize">
                                    {selectedReport.status === 'resolved' ? 
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                    }
                                    {selectedReport.status}
                                </div>
                            </div>
                        </div>

                        {/* 2. Main Narrative */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 mb-2">Incident Description</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-lg">
                                    {selectedReport.description}
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 mb-2">Immediate Action Taken</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-lg">
                                    {selectedReport.actionTaken || "No immediate action recorded."}
                                </p>
                            </div>
                        </div>

                        {/* 3. People Involved */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase">Witnesses</span>
                                <p className="text-sm font-medium text-slate-900">{selectedReport.witnesses || "None listed"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase">Parties Involved</span>
                                <p className="text-sm font-medium text-slate-900">{selectedReport.partiesInvolved || "None listed"}</p>
                            </div>
                        </div>

                        {/* 4. Specific Category Details */}
                        {selectedReport.details && Object.keys(selectedReport.details).length > 0 && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-3">Additional Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(selectedReport.details).map(([key, value]) => (
                                        <div key={key}>
                                            <span className="text-xs text-blue-600/70 uppercase font-semibold block mb-1">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                            <span className="text-sm font-medium text-blue-900">
                                                {value as string}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                        {user?.role !== 'employee' && (
                            <Button>Mark as Resolved</Button>
                        )}
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}