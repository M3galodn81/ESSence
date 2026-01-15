import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReportSchema, type User as UserType } from "@shared/schema";
import { z } from "zod";
import { 
  AlertTriangle, ShieldAlert, UserX, Stethoscope, 
  Hammer, FileWarning, Plus, Calendar as CalendarIcon, Clock, 
  Eye, FileText, MapPin, CheckCircle2, AlertCircle, Filter, ArrowUpDown, X, Users, Minus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BarChart3, PieChart as PieChartIcon,
  List as ListIcon
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// --- Schema & Types ---
// Enhanced schema to support lists of items and people and enforce required fields
const reportFormSchema = insertReportSchema.omit({ userId: true, partiesInvolved: true }).extend({
    // Override dateOccurred to accept Date objects from the form state
    dateOccurred: z.coerce.date({ required_error: "Date is required" }),
    
    // Make fields explicitly required with custom messages
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    location: z.string().min(1, "Location is required"),
    timeOccurred: z.string().min(1, "Time is required"),
    actionTaken: z.string().min(1, "Action taken is required"),
    witnesses: z.string().min(1, "Witnesses field is required (enter 'None' if applicable)"),

    involvedPeople: z.array(z.string()).min(1, "At least one person must be involved"), 
    details: z.object({
        items: z.array(z.object({
            name: z.string().min(1, "Item name required"),
            quantity: z.number().min(1),
            cost: z.number().min(0)
        })).optional(),
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
  const [view, setView] = useState<"list" | "analytics">("list");
  
  // Filter States
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [newItem, setNewItem] = useState({ name: "", quantity: 1, cost: 0 });
  const [newPerson, setNewPerson] = useState("");

  const categories = [
    { id: "customer", label: "Customer Incident", icon: UserX, color: "bg-orange-100 text-orange-600", fill: "#f97316" },
    { id: "employee", label: "Employee Incident", icon: FileWarning, color: "bg-blue-100 text-blue-600", fill: "#3b82f6" },
    { id: "accident", label: "Accident Report", icon: AlertTriangle, color: "bg-yellow-100 text-yellow-600", fill: "#eab308" },
    { id: "security", label: "Security Incident", icon: ShieldAlert, color: "bg-red-100 text-red-600", fill: "#ef4444" },
    { id: "medical", label: "Medical Incident", icon: Stethoscope, color: "bg-rose-100 text-rose-600", fill: "#f43f5e" },
    { id: "property", label: "Property Damage", icon: Hammer, color: "bg-slate-100 text-slate-600", fill: "#64748b" },
  ];

  const { data: reports, isLoading } = useQuery({ queryKey: ["/api/reports"] });
  const { data: teamMembers } = useQuery<UserType[]>({ queryKey: ["/api/team"] });

  useEffect(() => { setCurrentPage(1); }, [statusFilter, categoryFilter, dateRange, sortOrder]);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r: any) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
        if (dateRange.from && dateRange.to && r.dateOccurred) {
            const reportDate = new Date(r.dateOccurred);
            if (!isWithinInterval(reportDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
        }
        return true;
    }).sort((a: any, b: any) => {
        const timeA = new Date(a.dateOccurred).getTime();
        const timeB = new Date(b.dateOccurred).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [reports, statusFilter, categoryFilter, dateRange, sortOrder]);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  const stats = useMemo(() => {
    if (!reports) return { monthly: [], byCategory: [], mostInvolved: [] };
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) { months[format(subMonths(new Date(), i), "MMM yyyy")] = 0; }
    
    reports.forEach((r: any) => {
        const key = format(new Date(r.dateOccurred), "MMM yyyy");
        if (months.hasOwnProperty(key)) months[key]++;
    });
    
    const catCounts: Record<string, number> = {};
    reports.forEach((r: any) => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    
    const peopleCounts: Record<string, number> = {};
    reports.forEach((r: any) => {
        if (r.partiesInvolved) {
            r.partiesInvolved.split(',').forEach((name: string) => {
                const n = name.trim();
                if (n && n !== 'N/A') peopleCounts[n] = (peopleCounts[n] || 0) + 1;
            });
        }
    });

    return { 
        monthly: Object.entries(months).map(([name, count]) => ({ name, count })),
        byCategory: Object.entries(catCounts).map(([id, value]) => {
            const cat = categories.find(c => c.id === id);
            return { name: cat?.label || id, value, fill: cat?.fill || "#cbd5e1" };
        }),
        mostInvolved: Object.entries(peopleCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [reports]);

  const form = useForm<ReportForm>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      category: "customer", severity: "low", dateOccurred: new Date(), timeOccurred: format(new Date(), "HH:mm"),
      involvedPeople: [], details: { items: [] }
    },
  });

  const selectedCategory = form.watch("category");
  const currentPeople = form.watch("involvedPeople");
  const currentItems = form.watch("details.items") || [];

  const createReportMutation = useMutation({
    mutationFn: async (data: ReportForm) => {
      const { involvedPeople, ...cleanData } = data;
      const payload = {
          ...cleanData,
          partiesInvolved: involvedPeople.join(", "),
          userId: user?.id,
          // Convert Date object to timestamp (number) for SQLite integer column
          dateOccurred: new Date(data.dateOccurred).getTime(),
          witnesses: cleanData.witnesses || "", 
          images: [],
      };
      const res = await apiRequest("POST", "/api/reports", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Report Filed Successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setIsDialogOpen(false);
      form.reset({ category: "customer", severity: "low", dateOccurred: new Date(), timeOccurred: format(new Date(), "HH:mm"), involvedPeople: [], details: { items: [] } });
    },
    onError: (err) => toast.error("Failed to file report", { description: err.message })
  });

  // Validation Error Handler
  const onInvalid = (errors: FieldErrors<ReportForm>) => {
    const firstErrorKey = Object.keys(errors)[0];
    const errorMessage = errors[firstErrorKey as keyof ReportForm]?.message;
    toast.error("Validation Error", { description: errorMessage ? String(errorMessage) : "Please check the form fields." });
    console.log("Form Validation Errors:", errors);
  };

  // Helpers
  const addPerson = () => {
      if (!newPerson.trim()) return;
      const current = form.getValues("involvedPeople");
      if (!current.includes(newPerson)) {
          const newPeople = [...current, newPerson];
          form.setValue("involvedPeople", newPeople);
          form.trigger("involvedPeople");
      }
      setNewPerson("");
  };
  const addStaffFromSelect = (name: string) => {
      const current = form.getValues("involvedPeople");
      if (!current.includes(name)) {
          const newPeople = [...current, name];
          form.setValue("involvedPeople", newPeople);
          form.trigger("involvedPeople");
      }
  };
  const removePerson = (index: number) => {
      const current = form.getValues("involvedPeople");
      const newPeople = current.filter((_, i) => i !== index);
      form.setValue("involvedPeople", newPeople);
      form.trigger("involvedPeople");
  };
  const addItem = () => {
      if (!newItem.name.trim()) return;
      const current = form.getValues("details.items") || [];
      form.setValue("details.items", [...current, newItem]);
      setNewItem({ name: "", quantity: 1, cost: 0 });
  };
  const removeItem = (index: number) => {
      const current = form.getValues("details.items") || [];
      form.setValue("details.items", current.filter((_, i) => i !== index));
  };

  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Incident Reporting</h1>
          <p className="text-slate-500 mt-1">Official documentation for workplace incidents</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setView("list")}
                    className={cn("text-xs", view === "list" && "bg-white shadow-sm text-slate-900")}
                >
                    <ListIcon className="w-4 h-4 mr-2" /> Reports
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setView("analytics")}
                    className={cn("text-xs", view === "analytics" && "bg-white shadow-sm text-slate-900")}
                >
                    <BarChart3 className="w-4 h-4 mr-2" /> Analytics
                </Button>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 text-white rounded-full px-6 shadow-lg hover:bg-slate-800 ml-2">
                  <Plus className="w-4 h-4 mr-2" /> File Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
                <DialogHeader className="border-b border-slate-100 pb-4">
                  <DialogTitle>File Incident Report</DialogTitle>
                  <DialogDescription>Please provide factual, objective details.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit((d) => createReportMutation.mutate(d), onInvalid)} className="space-y-6 pt-4">
                  {/* Classification */}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Category</Label>
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

                  {/* Time & Location */}
                  <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                          <Label>Date</Label>
                          <Input 
                              type="date" 
                              value={format(new Date(form.watch("dateOccurred")), "yyyy-MM-dd")} 
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value) form.setValue("dateOccurred", new Date(value), { shouldValidate: true });
                              }} 
                          />
                          {form.formState.errors.dateOccurred && <p className="text-xs text-red-500">{form.formState.errors.dateOccurred.message}</p>}
                      </div>
                      <div className="space-y-2">
                          <Label>Time</Label>
                          <Input type="time" {...form.register("timeOccurred")} />
                          {form.formState.errors.timeOccurred && <p className="text-xs text-red-500">{form.formState.errors.timeOccurred.message}</p>}
                      </div>
                      <div className="space-y-2">
                          <Label>Location</Label>
                          <Input placeholder="e.g. Kitchen" {...form.register("location")} />
                          {form.formState.errors.location && <p className="text-xs text-red-500">{form.formState.errors.location.message}</p>}
                      </div>
                  </div>

                  {/* Narrative */}
                  <div className="space-y-2">
                      <Label>Title</Label>
                      <Input placeholder="Brief summary" {...form.register("title")} />
                      {form.formState.errors.title && <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Detailed description..." {...form.register("description")} />
                      {form.formState.errors.description && <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>}
                  </div>
                  
                  {/* ADDED: Witnesses & Action Taken Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Action Taken</Label>
                        <Textarea placeholder="Immediate actions..." {...form.register("actionTaken")} />
                        {form.formState.errors.actionTaken && <p className="text-xs text-red-500">{form.formState.errors.actionTaken.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Witnesses</Label>
                        <Textarea placeholder="Names/Contacts..." {...form.register("witnesses")} />
                        {form.formState.errors.witnesses && <p className="text-xs text-red-500">{form.formState.errors.witnesses.message}</p>}
                    </div>
                  </div>

                  {/* Dynamic People List */}
                  <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                      <Label>People Involved <span className="text-red-500">*</span></Label>
                      <div className="flex flex-col gap-3">
                          {/* Staff Dropdown */}
                          <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-slate-500 font-medium">Add Staff Member</span>
                              <Select onValueChange={addStaffFromSelect}>
                                  <SelectTrigger className="bg-white border-slate-200">
                                      <SelectValue placeholder="Select from team..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {teamMembers?.filter(m => m.role !== 'admin').map((member) => (
                                          <SelectItem key={member.id} value={`${member.firstName} ${member.lastName}`}>
                                              {member.firstName} {member.lastName} <span className="text-xs text-slate-400 ml-1">({member.position})</span>
                                          </SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>

                          {/* Manual Input */}
                          <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-slate-500 font-medium">Add Guest / Other</span>
                              <div className="flex gap-2">
                                  <Input 
                                      value={newPerson} 
                                      onChange={(e) => setNewPerson(e.target.value)} 
                                      placeholder="Type name manually..." 
                                      className="bg-white"
                                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addPerson(); } }}
                                  />
                                  <Button type="button" onClick={addPerson} variant="outline" className="bg-white">Add</Button>
                              </div>
                          </div>
                      </div>

                      {currentPeople.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200/60">
                              {currentPeople.map((p, i) => (
                                  <Badge key={i} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-white border border-slate-200">
                                      {p} <button type="button" onClick={() => removePerson(i)} className="hover:bg-slate-100 rounded-full p-0.5"><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
                                  </Badge>
                              ))}
                          </div>
                      )}
                      {form.formState.errors.involvedPeople && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {form.formState.errors.involvedPeople.message}</p>}
                  </div>

                  {/* Property Details */}
                  {selectedCategory === 'property' && (
                      <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
                          <h4 className="font-medium text-sm text-slate-900">Damaged Items</h4>
                          <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-6"><Label className="text-xs">Item Name</Label><Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Plate" /></div>
                              <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: +e.target.value})} /></div>
                              <div className="col-span-3"><Label className="text-xs">Cost</Label><Input type="number" value={newItem.cost} onChange={e => setNewItem({...newItem, cost: +e.target.value})} /></div>
                              <div className="col-span-1"><Button type="button" size="icon" onClick={addItem}><Plus className="w-4 h-4" /></Button></div>
                          </div>
                          <div className="space-y-2">{currentItems.map((item, i) => <div key={i} className="flex justify-between items-center text-sm bg-white p-2 rounded border"><span>{item.quantity}x {item.name} (${item.cost})</span><button type="button" onClick={() => removeItem(i)}><X className="w-4 h-4 hover:text-red-500" /></button></div>)}</div>
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
      </div>

      {view === "list" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-slate-200 shadow-sm md:col-span-2">
                <CardContent className="p-0">
                    <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent></Select>
                        <Button variant="ghost" size="sm" onClick={() => {setCategoryFilter('all'); setStatusFilter('all')}} className="h-8 text-xs">Reset</Button>
                    </div>
                    <div className="divide-y divide-slate-100 min-h-[300px]">
                        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : 
                        paginatedReports.length === 0 ? <div className="p-8 text-center text-slate-400">No reports found.</div> :
                        paginatedReports.map((report: any) => (
                            <div key={report.id} onClick={() => { setSelectedReport(report); setIsViewOpen(true); }} className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer group transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", categories.find(c=>c.id===report.category)?.color)}>{(() => { const Icon = categories.find(c=>c.id===report.category)?.icon || FileText; return <Icon className="w-5 h-5" /> })()}</div>
                                    <div><h4 className="text-sm font-bold text-slate-800">{report.title}</h4><div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5"><span>{format(new Date(report.dateOccurred), "MMM dd")}</span><span>•</span><span className="capitalize">{report.severity} Priority</span></div></div>
                                </div>
                                <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'} className="capitalize">{report.status}</Badge>
                            </div>
                        ))}
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-white rounded-b-xl">
                        <div className="text-xs text-slate-500">Page {currentPage} of {totalPages}</div>
                        <div className="flex gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(1)} disabled={currentPage===1}><ChevronsLeft className="w-3 h-3"/></Button>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p=>Math.max(1, p-1))} disabled={currentPage===1}><ChevronLeft className="w-3 h-3"/></Button>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p=>Math.min(totalPages, p+1))} disabled={currentPage===totalPages}><ChevronRight className="w-3 h-3"/></Button>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages}><ChevronsRight className="w-3 h-3"/></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm h-fit">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><Users className="w-4 h-4" /> Most Involved</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">{stats.mostInvolved.map(([name, count], i) => (<div key={name} className="flex justify-between text-sm"><span>{i+1}. {name}</span><Badge variant="secondary">{count}</Badge></div>))}</div>
                </CardContent>
            </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Incident Trend</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer><BarChart data={stats.monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><RechartsTooltip/><Bar dataKey="count" fill="#3b82f6"/></BarChart></ResponsiveContainer></div></CardContent></Card>
            <Card><CardHeader><CardTitle>By Category</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer><PieChart><Pie data={stats.byCategory} dataKey="value" cx="50%" cy="50%" outerRadius={80}>{stats.byCategory.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><RechartsTooltip /><Legend /></PieChart></ResponsiveContainer></div></CardContent></Card>
        </div>
      )}
      
      {/* Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedReport && (
                <>
                    <DialogHeader><DialogTitle>{selectedReport.title}</DialogTitle><DialogDescription>{format(new Date(selectedReport.dateOccurred), "PPP")} at {selectedReport.timeOccurred}</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg border">
                            <div className="grid grid-cols-2 gap-4"><div><span className="text-xs uppercase text-slate-500">Location</span><p className="font-medium">{selectedReport.location}</p></div><div><span className="text-xs uppercase text-slate-500">Status</span><p className="font-medium capitalize">{selectedReport.status}</p></div></div>
                        </div>
                        <div><h4 className="font-bold text-sm mb-1">Description</h4><p className="text-sm text-slate-600">{selectedReport.description}</p></div>
                        <div><h4 className="font-bold text-sm mb-1">Action Taken</h4><p className="text-sm text-slate-600">{selectedReport.actionTaken}</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><h4 className="font-bold text-sm mb-1">Witnesses</h4><p className="text-sm text-slate-600">{selectedReport.witnesses}</p></div>
                            <div><h4 className="font-bold text-sm mb-1">Parties Involved</h4><p className="text-sm text-slate-600">{selectedReport.partiesInvolved}</p></div>
                        </div>
                        {selectedReport.details?.items && (
                            <div className="border-t pt-4"><h4 className="font-bold text-sm mb-2">Items</h4>{selectedReport.details.items.map((i:any, idx:number) => <div key={idx} className="flex justify-between text-sm"><span>{i.quantity}x {i.name}</span><span>${i.cost}</span></div>)}</div>
                        )}
                    </div>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}