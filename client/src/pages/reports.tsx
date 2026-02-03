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
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReportSchema, type User as UserType } from "@shared/schema";
import { z } from "zod";
import { 
  AlertTriangle, UserX, Hammer, Plus, Calendar as CalendarIcon, Clock, 
  FileText, MapPin, CheckCircle2, AlertCircle, X, Users,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BarChart3, 
  List as ListIcon, Banknote, Search, History, Filter,Check,
  Loader2,
  ChevronsUpDown
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, subMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";

/**
 * REPORT FORM SCHEMA CONFIGURATION
 */
const reportFormSchema = insertReportSchema.omit({ userId: true, partiesInvolved: true }).extend({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(2, "Location is required"),
  involvedPeople: z.array(z.string()).min(1, "At least one person must be involved"), 
  dateOccurred: z.coerce.date({ required_error: "Date is required" }),
  timeOccurred: z.string().min(1, "Time is required"),
  category: z.string().min(1, "Category is required"),
  severity: z.string().min(1, "Severity is required"),
  // Note: details is kept optional as per your shared schema
});

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

type ReportForm = z.infer<typeof reportFormSchema>;

export default function Reports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // --- UI STATE MANAGEMENT ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [view, setView] = useState<"list" | "analytics">("list");
  
  // --- FILTER STATE ---
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>(""); // NEW: Person Filter
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [openFilterPicker, setOpenFilterPicker] = useState(false);


  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // --- DYNAMIC FORM STATE ---
  const [newItem, setNewItem] = useState({ name: "", quantity: 1 });
  const [newPerson, setNewPerson] = useState("");
  const [staffSearchTerm, setStaffSearchTerm] = useState(""); 
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
const [resolutionAction, setResolutionAction] = useState("");
const [openEmployeePicker, setOpenEmployeePicker] = useState(false);


  // --- CONFIGURATION CONSTANTS ---
  const categories = [
    { 
        id: "awan", 
        label: "AWAN (Away With Advanced Notice)", 
        icon: Clock, 
        color: "bg-blue-100 text-blue-700", 
        fill: "#3b82f6" 
    },
    { 
        id: "awol", 
        label: "AWOL (Absent Without Offical Leave)", 
        icon: UserX, 
        color: "bg-red-100 text-red-700", 
        fill: "#ef4444" 
    },
    { 
        id: "tardiness", 
        label: "Tardiness", 
        icon: History, 
        color: "bg-amber-100 text-amber-700", 
        fill: "#f59e0b" 
    },
    { 
        id: "cashier_shortage", 
        label: "Cashier Shortage", 
        icon: Banknote, 
        color: "bg-emerald-100 text-emerald-700", 
        fill: "#10b981" 
    },
    { 
        id: "breakages", 
        label: "Breakages", 
        icon: Hammer, 
        color: "bg-orange-100 text-orange-700", 
        fill: "#f97316" 
    },
    { 
        id: "others", 
        label: "Others", 
        icon: FileText, 
        color: "bg-slate-100 text-slate-700", 
        fill: "#64748b" 
    },
  ];

  // --- DATA FETCHING ---
  const { data: reports, isLoading } = useQuery({ queryKey: ["/api/reports"] });
  const { data: teamMembers } = useQuery<UserType[]>({ queryKey: ["/api/team"] });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, monthFilter, personFilter, sortOrder]);

  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
        const d = subMonths(new Date(), i);
        options.push({
            value: format(d, "yyyy-MM"),
            label: format(d, "MMMM yyyy")
        });
    }
    return options;
  }, []);

  const getEmployeeName = (userId: string) => {
    const emp = teamMembers?.find((m) => m.id === userId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };

  const getEmployeeRole = (userId: string) => {
    const emp = teamMembers?.find((m) => m.id === userId);
    return emp ? emp.role : "Unknown";
  };


  // --- FILTERING LOGIC ---
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r: any) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
        
        // Month Filter
        if (monthFilter !== "all" && r.dateOccurred) {
            const reportMonth = format(new Date(r.dateOccurred), "yyyy-MM");
            if (reportMonth !== monthFilter) return false;
        }

        // NEW: Person Filter (Check against partiesInvolved string)
        if (personFilter.trim() !== "") {
            const search = personFilter.toLowerCase();
            const parties = (r.partiesInvolved || "").toLowerCase();
            if (!parties.includes(search)) return false;
        }

        return true;
    }).sort((a: any, b: any) => {
    if (sortBy === "priority") {
      const weightA = SEVERITY_WEIGHTS[a.severity] || 0;
      const weightB = SEVERITY_WEIGHTS[b.severity] || 0;
      // Sort by weight first, then by date for reports with same weight
      if (weightB !== weightA) return weightB - weightA;
    }
    
    // Default or fallback: Date sorting
    const timeA = new Date(a.dateOccurred).getTime();
    const timeB = new Date(b.dateOccurred).getTime();
    return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
  });
}, [reports, statusFilter, categoryFilter, monthFilter, personFilter, sortOrder, sortBy]);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  const stats = useMemo(() => {
    if (!reports) return { monthly: [], byCategory: [], mostInvolved: [] };

    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months[format(d, "MMM yyyy")] = 0;
    }
    
    reports.forEach((r: any) => {
        const key = format(new Date(r.dateOccurred), "MMM yyyy");
        if (months.hasOwnProperty(key)) {
            months[key]++;
        }
    });
    const monthlyData = Object.entries(months).map(([name, count]) => ({ name, count }));

    const catCounts: Record<string, number> = {};
    reports.forEach((r: any) => {
        catCounts[r.category] = (catCounts[r.category] || 0) + 1;
    });
    const categoryData = Object.entries(catCounts).map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        return { name: cat?.label || id, value, fill: cat?.fill || "#cbd5e1" };
    });

    const peopleCounts: Record<string, number> = {};
    reports.forEach((r: any) => {
        if (r.partiesInvolved) {
            r.partiesInvolved.split(',').forEach((name: string) => {
                const n = name.trim();
                if (n && n !== 'N/A') peopleCounts[n] = (peopleCounts[n] || 0) + 1;
            });
        }
    });
    const mostInvolved = Object.entries(peopleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return { monthly: monthlyData, byCategory: categoryData, mostInvolved };
  }, [reports]);

  // --- FORM HANDLING ---
  const form = useForm<ReportForm>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      category: "others",
      severity: "low",
      dateOccurred: new Date(),
      timeOccurred: format(new Date(), "HH:mm"),
      involvedPeople: [], 
      details: { items: [] }
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
      form.reset({
        category: "others",
        severity: "low",
        dateOccurred: new Date(),
        timeOccurred: format(new Date(), "HH:mm"),
        involvedPeople: [],
        details: { items: [] }
      });
    },
    onError: (err) => {
        toast.error("Failed to file report", { description: err.message });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, actionTaken }: { id: number; status: string; actionTaken?: string }) => {
        const payload: any = { status };
        if (actionTaken) payload.actionTaken = actionTaken; // Update action only if provided
        
        const res = await apiRequest("PATCH", `/api/reports/${id}`, payload);
        return await res.json();
    },
    onSuccess: (updatedReport) => {
        toast.success(`Report marked as ${updatedReport.status}`);
        queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
        setIsResolveDialogOpen(false); // Close the popup
        setResolutionAction(""); // Clear the text
        if (selectedReport) {
        setSelectedReport(updatedReport);
        }
    },
    onError: (err) => {
        toast.error("Failed to update status", { description: err.message });
    }
    });

  const onInvalid = (errors: FieldErrors<ReportForm>) => {
    const firstErrorKey = Object.keys(errors)[0];
    const errorMessage = errors[firstErrorKey as keyof ReportForm]?.message;
    toast.error("Validation Error", { description: errorMessage ? String(errorMessage) : "Please check the form fields." });
  };

  // --- HELPER FUNCTIONS ---

  const addPerson = () => {
      if (!newPerson.trim()) return;
      const current = form.getValues("involvedPeople");
      if (!current.includes(newPerson)) {
          form.setValue("involvedPeople", [...current, newPerson]);
          form.trigger("involvedPeople");
      }
      setNewPerson("");
  };

  const addStaffFromSelect = (name: string) => {
      const current = form.getValues("involvedPeople");
      if (!current.includes(name)) {
          form.setValue("involvedPeople", [...current, name]);
          form.trigger("involvedPeople");
      }
  };

  const removePerson = (index: number) => {
      const current = form.getValues("involvedPeople");
      form.setValue("involvedPeople", current.filter((_, i) => i !== index));
      form.trigger("involvedPeople");
  };

  const addItem = () => {
      if (!newItem.name.trim()) return;
      const current = form.getValues("details.items") || [];
      form.setValue("details.items", [...current, newItem]);
      setNewItem({ name: "", quantity: 1 });
  };

  const removeItem = (index: number) => {
      const current = form.getValues("details.items") || [];
      form.setValue("details.items", current.filter((_, i) => i !== index));
  };

  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const filteredEmployees = useMemo(() => {
    if (!teamMembers) return [];
    if (!staffSearchTerm) return teamMembers.filter(m => m.role !== 'admin');
    
    return teamMembers.filter(m => 
        m.role !== 'admin' && 
        (m.firstName.toLowerCase().includes(staffSearchTerm.toLowerCase()) || 
         m.lastName.toLowerCase().includes(staffSearchTerm.toLowerCase()))
    );
  }, [teamMembers, staffSearchTerm]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* --- PAGE HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reporting</h1>
          <p className="text-slate-500 mt-1">Document AWOL, breakage, and other incidents</p>
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
                  <DialogTitle>File a Report</DialogTitle>
                  <DialogDescription>Please provide factual, objective details.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit((d) => createReportMutation.mutate(d), onInvalid)} className="space-y-6 pt-4">
                  {/* Classification */}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={selectedCategory} onValueChange={(val: any) => form.setValue("category", val)}>
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
                          <Input placeholder="e.g. Kitchen / POS" {...form.register("location")} />
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
                  
                  {/* Actions & Witnesses */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Action Taken</Label>
                        <Textarea placeholder="Immediate actions..." {...form.register("actionTaken")} />
                    </div>
                    <div className="space-y-2">
                        <Label>Witnesses</Label>
                        <Textarea placeholder="Names/Contacts..." {...form.register("witnesses")} />
                    </div>
                  </div>

                  {/* People Involved (With Search) */}
                  <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                      <Label>People Involved <span className="text-red-500">*</span></Label>
                      <div className="flex flex-col gap-3">
                          {/* Staff Search & Dropdown */}
                          <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-slate-500 font-medium">Add Staff Member</span>
                              
                              {/* People Involved Autocomplete */}
                                
                                
                                <Popover open={openEmployeePicker} onOpenChange={setOpenEmployeePicker}>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openEmployeePicker}
                                        className="w-full justify-between bg-white border-slate-200 font-normal hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4 opacity-50" />
                                        <span>Search from team members...</span>
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
  <Command>
    <CommandInput placeholder="Type staff name..." />
    {/* Setting a max-height and overflow here allows mouse wheel scrolling */}
    <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200">
      <CommandEmpty className="p-4 text-sm text-slate-500 flex flex-col items-center gap-2">
        <UserX className="w-8 h-8 opacity-20" />
        No staff member found.
      </CommandEmpty>
      <CommandGroup heading="Active Staff">
        {filteredEmployees.map((member) => {
          const fullName = `${member.firstName} ${member.lastName}`;
          const isAlreadyAdded = currentPeople.includes(fullName);
          
          return (
            <CommandItem
              key={member.id}
              value={fullName}
              disabled={isAlreadyAdded}
              onSelect={() => {
                addStaffFromSelect(fullName);
                setOpenEmployeePicker(false);
              }}
              className={cn(
                "flex items-center justify-between py-2 px-4 cursor-pointer",
                isAlreadyAdded && "opacity-50 grayscale pointer-events-none"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-slate-100">
                    {member.firstName[0]}{member.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium text-xs">{fullName}</span>
                  <span className="text-[9px] text-slate-400 uppercase">{member.position}</span>
                </div>
              </div>
              {isAlreadyAdded ? (
                <Badge variant="secondary" className="text-[8px] bg-emerald-50 text-emerald-600">Added</Badge>
              ) : (
                <Plus className="w-3 h-3 text-slate-300" />
              )}
            </CommandItem>
          );
        })}
      </CommandGroup>
    </CommandList>
  </Command>
</PopoverContent>
                                </Popover>
                                
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

                      {/* Chips for Selected People */}
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

                  {/* Property Details (Only for Breakages) */}
                  {selectedCategory === 'breakages' && (
                      <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
                          <h4 className="font-medium text-sm text-slate-900">Damaged Items</h4>
                          <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-9"><Label className="text-xs">Item Name</Label><Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Plate" /></div>
                              <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: +e.target.value})} /></div>
                              <div className="col-span-1"><Button type="button" size="icon" onClick={addItem}><Plus className="w-4 h-4" /></Button></div>
                          </div>
                          <div className="space-y-2">{currentItems.map((item, i) => <div key={i} className="flex justify-between items-center text-sm bg-white p-2 rounded border"><span>{item.quantity}x {item.name}</span><button type="button" onClick={() => removeItem(i)}><X className="w-4 h-4 hover:text-red-500" /></button></div>)}</div>
                      </div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createReportMutation.isPending}>
                        {createReportMutation.isPending ? "Submitting..." : "Submit Report"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {view === "list" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Reports List */}
            <Card className="bg-white border-slate-200 shadow-sm md:col-span-2">
                <CardContent className="p-0">
                    {/* --- FILTER BAR (Embedded) --- */}
                    <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl items-center">
                        <Filter className="w-4 h-4 text-slate-400" />
                        
                        <div className="flex items-center gap-2">
  <Popover open={openFilterPicker} onOpenChange={setOpenFilterPicker}>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={openFilterPicker}
        className="w-[200px] h-8 justify-between text-xs bg-white font-normal"
      >
        <div className="flex items-center gap-2 truncate">
          <Search className="h-3 w-3 opacity-50" />
          {personFilter || "Filter by person..."}
        </div>
        {personFilter && (
          <X 
            className="h-3 w-3 opacity-50 hover:opacity-100" 
            onClick={(e) => {
              e.stopPropagation();
              setPersonFilter("");
            }} 
          />
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[200px] p-0" align="start">
      <Command>
        <CommandInput placeholder="Search name..." className="h-8 text-xs" />
        <CommandList className="max-h-[200px]">
          <CommandEmpty className="py-2 px-4 text-xs text-slate-500">No one found.</CommandEmpty>
          <CommandGroup heading="Staff Members">
            {teamMembers?.map((member) => {
              const fullName = `${member.firstName} ${member.lastName}`;
              return (
                <CommandItem
                  key={member.id}
                  value={fullName}
                  onSelect={(currentValue) => {
                    setPersonFilter(currentValue === personFilter ? "" : currentValue);
                    setOpenFilterPicker(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      personFilter === fullName ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{fullName}</span>
                    <span className="text-[10px] text-slate-400">{member.position}</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
          
          {/* Include logic for "manual" names that might be in reports but not in team list */}
          <CommandGroup heading="Recent Involved Parties">
            {stats.mostInvolved.map(([name]) => (
               <CommandItem
                  key={name}
                  value={name}
                  onSelect={(val) => {
                    setPersonFilter(val);
                    setOpenFilterPicker(false);
                  }}
                  className="text-xs"
               >
                 <History className="mr-2 h-3 w-3 opacity-50" />
                 {name}
               </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</div>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[160px] h-8 text-xs bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        
                        <Select value={monthFilter} onValueChange={setMonthFilter}>
                            <SelectTrigger className="w-[140px] h-8 text-xs bg-white"><SelectValue placeholder="Month" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                                <div className="flex items-center gap-2">
                                <BarChart3 className="w-3 h-3" />
                                <SelectValue placeholder="Sort By" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Sort by Date</SelectItem>
                                <SelectItem value="priority">Sort by Priority</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent>
                        </Select>

                        {(categoryFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all' || personFilter !== "") && (
                            <Button variant="ghost" size="sm" onClick={() => {setCategoryFilter('all'); setStatusFilter('all'); setMonthFilter('all'); setPersonFilter('');}} className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">Reset</Button>
                        )}
                    </div>

                    {/* --- LIST ITEMS --- */}
                    <div className="divide-y divide-slate-100 min-h-[300px]">
                        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : 
                        paginatedReports.length === 0 ? <div className="p-8 text-center text-slate-400">No reports found.</div> :
                        paginatedReports.map((report: any) => (
                            <div 
  key={report.id} 
  onClick={() => { setSelectedReport(report); setIsViewOpen(true); }} 
  className={cn(
    "flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer group transition-colors border-l-4",
    report.severity === 'critical' ? "border-l-red-600 bg-red-50/30" : 
    report.severity === 'high' ? "border-l-orange-500" : "border-l-transparent"
  )}
>
  <div className="flex items-center gap-4">
    <div className="relative">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", categories.find(c=>c.id===report.category)?.color || "bg-slate-100 text-slate-600")}>
        {(() => { const Icon = categories.find(c=>c.id===report.category)?.icon || FileText; return <Icon className="w-5 h-5" /> })()}
      </div>
      
      {/* ADD DANGER ICON OVERLAY */}
      {(report.severity === 'critical' || report.severity === 'high') && (
        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
          <AlertTriangle className={cn("w-3.5 h-3.5", report.severity === 'critical' ? "text-red-600" : "text-orange-500")} />
        </div>
      )}
    </div>

    <div>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-bold text-slate-800">{report.title}</h4>
        {report.severity === 'critical' && (
          <Badge variant="destructive" className="h-4 px-1.5 text-[8px] animate-pulse">CRITICAL</Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
        <span>{format(new Date(report.dateOccurred), "MMM dd")}</span>
        {/* ... existing badges ... */}
      </div>
    </div>
  </div>
  <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'} className="capitalize">{report.status}</Badge>
</div>
                        ))}
                    </div>
                    
                    {/* --- PAGINATION FOOTER --- */}
                    {filteredReports.length > 0 && (
                        <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-white rounded-b-xl">
                            <div className="text-xs text-slate-500 font-medium">
                                Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} of {filteredReports.length}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft className="w-3 h-3" /></Button>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="w-3 h-3" /></Button>
                                <span className="text-xs font-medium px-2 min-w-[3rem] text-center">{currentPage} / {totalPages || 1}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-3 h-3" /></Button>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="w-3 h-3" /></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* --- MOST INVOLVED SIDEBAR --- */}
            <Card className="bg-white border-slate-200 shadow-sm h-fit">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Most Involved
                    </CardTitle>
                    <CardDescription className="text-xs">Frequent names in recent incidents</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {stats.mostInvolved?.map(([name, count], i) => (
                            <button 
                                key={name} 
                                onClick={() => setPersonFilter(name)}
                                className={cn(
                                    "w-full flex items-center justify-between text-sm p-2 rounded-lg transition-colors hover:bg-slate-100 text-left",
                                    personFilter === name ? "bg-blue-50 border border-blue-100" : "bg-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", i === 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600")}>
                                        {i + 1}
                                    </span>
                                    <span className={cn("font-medium truncate max-w-[120px]", personFilter === name ? "text-blue-700" : "text-slate-700")} title={name}>
                                        {name}
                                    </span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] bg-white border border-slate-100">{count}</Badge>
                            </button>
                        ))}
                        {(!stats.mostInvolved || stats.mostInvolved.length === 0) && <div className="text-center text-slate-400 text-xs py-4">No data available</div>}
                        
                        {personFilter && !stats.mostInvolved.some(([n]) => n === personFilter) && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-400 mb-1">Active Filter:</p>
                                <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-100 flex justify-between">
                                    {personFilter} 
                                    <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setPersonFilter("")} />
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Trend Over Time */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Report Trend (Last 6 Months)</CardTitle>
                    <CardDescription>Number of reports filed per month</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.monthly}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Chart 2: Category Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Reports by Category</CardTitle>
                    <CardDescription>Distribution of report types</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.byCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.byCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}


      {/* View Details Dialog */}
        <Dialog open={isViewOpen} onOpenChange={(open) => {
        setIsViewOpen(open);
        if (!open) setSelectedReport(null); // Clear selection on close
        }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {!selectedReport ? (
            <div className="p-8 text-center flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
            ) : (
            <>
                <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                    {categories.find(c => c.id === selectedReport.category)?.label || selectedReport.category}
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
                        {selectedReport.status === 'resolved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                        {selectedReport.status}
                    </div>
                    </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <Users className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Filed By</p>
                            <p className="text-sm font-bold text-slate-900">{getEmployeeName(selectedReport.userId)}</p>
                            <p className="text-xs text-slate-500 capitalize">{getEmployeeRole(selectedReport.userId)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Submission Date</p>
                        <p className="text-xs font-medium text-slate-700">
                            {format(new Date(selectedReport.createdAt), "MMM dd, yyyy p")}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2">Incident Description</h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-lg">{selectedReport.description}</p>
                    </div>
                    <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2">Immediate Action Taken</h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-lg">{selectedReport.actionTaken || "No immediate action recorded."}</p>
                    </div>
                </div>

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
                </div>

                <DialogFooter className="flex-row justify-between sm:justify-between border-t pt-4">
                <Button variant="ghost" onClick={() => setIsViewOpen(false)}>Close</Button>
                
                {selectedReport.status === 'resolved' ? (
                    <Button 
                    variant="outline"
                    className="border-amber-500 text-amber-600 hover:bg-amber-50"
                    onClick={() => updateStatusMutation.mutate({ id: selectedReport.id, status: 'pending' })}
                    disabled={updateStatusMutation.isPending}
                    >
                    <Clock className="w-4 h-4 mr-2" /> Mark as Pending
                    </Button>
                ) : (
                    <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                        setResolutionAction(selectedReport.actionTaken || ""); 
                        setIsViewOpen(false); 
                        // Delay slightly to allow the first dialog to close
                        setTimeout(() => setIsResolveDialogOpen(true), 150);
                    }}
                    >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Resolved
                    </Button>
                )}
                </DialogFooter>
            </>
            )}
        </DialogContent>
        </Dialog>

        {/* Resolve Action Popup */}
        <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Resolve Report
            </DialogTitle>
            <DialogDescription>
                Document the final action taken to address this incident.
            </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="resolution">Immediate Action Taken</Label>
                <Textarea 
                id="resolution"
                placeholder="e.g. Discussed with staff, issued warning, or item replaced..."
                className="min-h-[120px]"
                value={resolutionAction}
                onChange={(e) => setResolutionAction(e.target.value)}
                />
            </div>
            </div>
            <DialogFooter>
            <Button 
                variant="ghost" 
                onClick={() => {
                setIsResolveDialogOpen(false);
                setIsViewOpen(true); // Go back if cancelled
                }}
            >
                Back
            </Button>
            <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!resolutionAction.trim() || updateStatusMutation.isPending}
                onClick={() => {
                if (!selectedReport) return;
                updateStatusMutation.mutate({ 
                    id: selectedReport.id, 
                    status: 'resolved',
                    actionTaken: resolutionAction 
                });
                }}
            >
                {updateStatusMutation.isPending ? "Saving..." : "Confirm & Resolve"}
            </Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>

    </div>
  );
}