import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, 
  Copy, Users, CalendarDays, MapPin, Grid, List, Briefcase, Sun, Moon, Sunset
} from "lucide-react";
import type { Schedule, User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const shiftFormSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  shiftType: z.enum(["morning", "afternoon", "night", "off"]),
  shiftRole: z.enum(["cashier", "bar", "server", "kitchen"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
});

type ShiftForm = z.infer<typeof shiftFormSchema>;

const ROLES = ["cashier", "bar", "server", "kitchen"];

// Configuration for Shift Presets
const SHIFT_PRESETS = {
  morning: { start: "08:00", end: "17:00", label: "Day (8am - 5pm)" },
  afternoon: { start: "13:00", end: "00:00", label: "Mid (1pm - 12am)" },
  night: { start: "21:00", end: "06:00", label: "Night (9pm - 6am)" },
  off: { start: "", end: "", label: "Day Off" }
};

export default function ShiftManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"timetable" | "day" | "list">("timetable");
  
  // Dialog States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // --- Permission Check ---
  if (user?.role !== 'manager' && user?.role !== 'admin') {
    return (
      <div className="p-8 flex justify-center items-center h-screen bg-slate-50">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200 shadow-xl">
          <CardContent className="py-12 text-center text-slate-500">
            Access denied. Manager or Admin role required.
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Date Helpers ---
  const getWeekBounds = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };

  const { start: weekStart, end: weekEnd } = getWeekBounds(currentDate);

  const getDaysOfWeek = () => {
    const days = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // --- Data Fetching ---
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/team"],
  });

  const { data: allSchedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules/all"],
  });

  // --- Filtering ---
  const filteredSchedules = useMemo(() => {
    if (!allSchedules) return [];

    return allSchedules.filter((schedule) => {
        const scheduleDate = new Date(schedule.date);
        const isInWeek = scheduleDate >= weekStart && scheduleDate <= weekEnd;
        const isEmployeeMatch = selectedEmployee === "all" || schedule.userId === selectedEmployee;
        return isInWeek && isEmployeeMatch;
    });
  }, [allSchedules, weekStart, weekEnd, selectedEmployee]);

  // --- Helper: Get Shifts for specific criteria ---
  const getSchedulesForDay = (viewDate: Date) => {
    const viewDateStr = viewDate.toLocaleDateString('en-CA'); 
    return filteredSchedules.filter((s) => new Date(s.date).toISOString().split('T')[0] === viewDateStr);
  };

  const getSchedulesForRole = (role: string, day: Date) => {
    return getSchedulesForDay(day).filter(s => s.shiftRole === role);
  };

  // --- Stats Calculator ---
  const getDailyStats = (date: Date) => {
    const shifts = getSchedulesForDay(date).filter(s => s.type !== 'off');
    return {
        total: shifts.length,
        morning: shifts.filter(s => s.type === 'morning').length,
        afternoon: shifts.filter(s => s.type === 'afternoon').length,
        night: shifts.filter(s => s.type === 'night').length
    };
  };

  // --- Layout Algorithm for Stacking (Reusable) ---
  const stackEvents = (events: Schedule[]) => {
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    const columns: Schedule[][] = [];
    const processedEvents: Array<Schedule & { colIndex: number, totalCols: number }> = [];

    sortedEvents.forEach((event) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const lastEventInColumn = columns[i][columns[i].length - 1];
            if (lastEventInColumn.endTime <= event.startTime) {
                columns[i].push(event);
                processedEvents.push({ ...event, colIndex: i, totalCols: 0 });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
            processedEvents.push({ ...event, colIndex: columns.length - 1, totalCols: 0 });
        }
    });

    return processedEvents.map(e => ({ ...e, totalCols: columns.length }));
  };

  // --- Forms & Mutations ---
  const createForm = useForm<ShiftForm>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: { shiftType: "morning", shiftRole: "server" },
  });

  const editForm = useForm<ShiftForm>({ resolver: zodResolver(shiftFormSchema) });

  // --- AUTO ASSIGN TIME HANDLERS ---
  const handleShiftTypeChange = (val: string, form: any) => {
    form.setValue("shiftType", val);
    const preset = SHIFT_PRESETS[val as keyof typeof SHIFT_PRESETS];
    if (preset) {
        form.setValue("startTime", preset.start);
        form.setValue("endTime", preset.end);
    }
  };

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftForm) => {
      let { startTime, endTime } = data;
      // Final fallback if form is empty (though handleShiftTypeChange covers most)
      if (!startTime || !endTime && data.shiftType !== 'off') {
         const preset = SHIFT_PRESETS[data.shiftType];
         startTime = preset.start;
         endTime = preset.end;
      }

      const startDateTime = new Date(`${data.date}T${startTime || "00:00"}`);
      const endDateTime = new Date(`${data.date}T${endTime || "00:00"}`);
      
      // Handle overnight shifts (if end time is less than start time)
      if (endDateTime < startDateTime && data.shiftType !== 'off') {
          endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const res = await apiRequest("POST", "/api/schedules", {
        userId: data.userId,
        date: new Date(data.date).getTime(),
        startTime: startDateTime.getTime(),
        endTime: endDateTime.getTime(),
        type: data.shiftType,
        title: `${data.shiftType.charAt(0).toUpperCase() + data.shiftType.slice(1)} Shift`,
        shiftRole: data.shiftRole,
        location: data.location,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Shift created");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => toast.error("Failed to create shift", { description: error.message }),
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShiftForm> }) => {
      const updates: any = {};
      if (data.shiftType) {
        updates.type = data.shiftType;
        updates.title = `${data.shiftType.charAt(0).toUpperCase() + data.shiftType.slice(1)} Shift`;
      }
      if (data.shiftRole) updates.shiftRole = data.shiftRole;
      if (data.location) updates.location = data.location;
      
      if (data.date) {
        updates.date = new Date(data.date).getTime();
        
        // Handle time updates carefully
        if (data.startTime && data.endTime) {
            const startDateTime = new Date(`${data.date}T${data.startTime}`);
            const endDateTime = new Date(`${data.date}T${data.endTime}`);
            
            if (endDateTime < startDateTime && data.shiftType !== 'off') {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }
            updates.startTime = startDateTime.getTime();
            updates.endTime = endDateTime.getTime();
        }
      }
      const res = await apiRequest("PATCH", `/api/schedules/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Shift updated");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsEditDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => toast.error("Failed to update shift", { description: error.message }),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Shift deleted");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsDeleteDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => toast.error("Failed to delete shift", { description: error.message }),
  });

  const copyPreviousWeekMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/schedules/copy-week", {
        sourceWeekStart: new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        targetWeekStart: weekStart.toISOString(),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Schedule copied");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
    },
    onError: (error: Error) => toast.error("Failed to copy schedule", { description: error.message }),
  });

  // --- Event Handlers ---
  const onCreateSubmit = (data: ShiftForm) => createShiftMutation.mutate(data);
  const onEditSubmit = (data: ShiftForm) => { if (selectedSchedule) updateShiftMutation.mutate({ id: selectedSchedule.id, data }); };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    const dateString = new Date(schedule.date).toISOString().split('T')[0];
    const startString = new Date(schedule.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const endString = new Date(schedule.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    editForm.reset({
      userId: schedule.userId,
      date: dateString,
      shiftType: schedule.type as any,
      shiftRole: schedule.shiftRole as any,
      startTime: startString,
      endTime: endString,
      location: schedule.location || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (schedule: Schedule, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedSchedule(schedule);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => { if (selectedSchedule) deleteShiftMutation.mutate(selectedSchedule.id); };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // --- Display Helpers ---
  const getEmployeeName = (userId: string) => {
    const employee = teamMembers?.find((m: User) => m.id === userId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
  };

  const getShiftBadge = (shiftType: string) => {
    const styles = {
        morning: "bg-emerald-100 text-emerald-700 border-emerald-200",
        afternoon: "bg-amber-100 text-amber-700 border-amber-200",
        night: "bg-indigo-100 text-indigo-700 border-indigo-200",
        off: "bg-slate-100 text-slate-500 border-slate-200"
    };
    const style = styles[shiftType as keyof typeof styles] || styles.morning;
    return <Badge className={`${style} border shadow-none font-bold uppercase tracking-wider text-[10px]`}>{shiftType}</Badge>;
  };

  const getShiftColorBlock = (type: string) => {
      switch(type) {
          case 'morning': return "bg-emerald-100 border-emerald-200 text-emerald-800 hover:bg-emerald-200";
          case 'afternoon': return "bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200";
          case 'night': return "bg-indigo-100 border-indigo-200 text-indigo-800 hover:bg-indigo-200";
          default: return "bg-slate-100 border-slate-200 text-slate-600";
      }
  };

  const getRoleBadge = (role: string) => (
    <span className="text-xs text-slate-600 font-medium capitalize px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">{role}</span>
  );

  const formatWeekRange = () => {
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shift Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Assign and manage employee work schedules</p>
        </div>
        <div className="flex items-center space-x-3">
            <Button variant="outline" className="bg-white/60 backdrop-blur-sm border-slate-200 text-slate-700 hover:bg-white" onClick={() => copyPreviousWeekMutation.mutate()} disabled={copyPreviousWeekMutation.isPending}>
                <Copy className="w-4 h-4 mr-2" /> Copy Previous Week
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg rounded-full px-6">
                  <Plus className="w-4 h-4 mr-2" /> Assign Shift
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Assign New Shift</DialogTitle>
                  <DialogDescription>Create a new shift assignment for an employee</DialogDescription>
                </DialogHeader>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="userId">Employee</Label>
                    <Select onValueChange={(value) => createForm.setValue("userId", value)}>
                      <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {teamMembers?.map((member: User) => (
                          <SelectItem key={member.id} value={member.id}>{member.firstName} {member.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {createForm.formState.errors.userId && <p className="text-xs text-red-500">{createForm.formState.errors.userId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" className="rounded-xl border-slate-200" {...createForm.register("date")} />
                    {createForm.formState.errors.date && <p className="text-xs text-red-500">{createForm.formState.errors.date.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shiftType">Shift Type</Label>
                      {/* Auto-fill Handler attached here */}
                      <Select onValueChange={(val) => handleShiftTypeChange(val, createForm)} defaultValue="morning">
                        <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="morning">{SHIFT_PRESETS.morning.label}</SelectItem>
                          <SelectItem value="afternoon">{SHIFT_PRESETS.afternoon.label}</SelectItem>
                          <SelectItem value="night">{SHIFT_PRESETS.night.label}</SelectItem>
                          <SelectItem value="off">{SHIFT_PRESETS.off.label}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shiftRole">Role</Label>
                      <Select 
                        onValueChange={(value) => createForm.setValue("shiftRole", value as any)} defaultValue="server">
                        <SelectTrigger className="rounded-xl border-slate-200 capitalize"> <SelectValue /> </SelectTrigger>
                        <SelectContent className="rounded-xl capitalize">
                          {ROLES.map(r => (
                            <SelectItem key={r} value={r} className="capitalize">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input id="startTime" type="time" className="rounded-xl border-slate-200" {...createForm.register("startTime")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input id="endTime" type="time" className="rounded-xl border-slate-200" {...createForm.register("endTime")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" {...createForm.register("location")} placeholder="e.g., Main Branch" className="rounded-xl border-slate-200" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-full">Cancel</Button>
                    <Button type="submit" disabled={createShiftMutation.isPending} className="rounded-full bg-slate-900">{createShiftMutation.isPending ? "Creating..." : "Create Shift"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/60 shadow-sm">
         <div className="flex items-center gap-3 px-3 w-full">
            <Users className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full border-none bg-transparent shadow-none text-sm font-medium px-0 focus:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Employees</SelectItem>
                    {teamMembers?.map((member: User) => (
                        <SelectItem key={member.id} value={member.id}>{member.firstName} {member.lastName}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
         </div>
         <div className="h-8 w-px bg-slate-200 hidden sm:block" />
         <div className="flex items-center gap-1 w-full sm:w-auto">
             <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')} className="h-8 w-8 rounded-lg hover:bg-slate-100">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
             </Button>
             <div className="px-2 text-sm font-medium text-slate-700 min-w-[140px] text-center">
                {view === 'day' ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric'}) : formatWeekRange()}
             </div>
             <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')} className="h-8 w-8 rounded-lg hover:bg-slate-100">
                <ChevronRight className="w-4 h-4 text-slate-600" />
             </Button>
         </div>
         <div className="h-8 w-px bg-slate-200 hidden sm:block" />
         <Button variant="ghost" onClick={() => setCurrentDate(new Date())} className="rounded-xl hover:bg-slate-100 text-slate-600 w-full sm:w-auto">
            <CalendarDays className="w-4 h-4 mr-2" /> Today
         </Button>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="timetable" className="w-full" onValueChange={(v) => setView(v as any)}>
        <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-white border border-slate-200">
                <TabsTrigger value="timetable" className="gap-2"><Grid className="w-4 h-4" /> Weekly</TabsTrigger>
                <TabsTrigger value="day" className="gap-2"><Calendar className="w-4 h-4" /> Day Detail</TabsTrigger>
                <TabsTrigger value="list" className="gap-2"><List className="w-4 h-4" /> List View</TabsTrigger>
            </TabsList>
        </div>

        {/* --- TIMETABLE VIEW --- */}
        <TabsContent value="timetable" className="mt-0">
            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white max-h-[800px] flex flex-col">
                <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/50 sticky top-0 z-20">
                    <div className="p-4 text-xs font-semibold text-slate-400 text-center border-r border-slate-100">TIME</div>
                    {getDaysOfWeek().map((day, i) => {
                        const stats = getDailyStats(day);
                        return (
                            <div key={i} className={cn("p-2 text-center border-r border-slate-100 last:border-r-0", isToday(day) && "bg-blue-50/50")}>
                                <div className={cn("text-[10px] font-bold uppercase", isToday(day) ? "text-blue-600" : "text-slate-400")}>
                                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={cn("text-lg font-bold leading-tight", isToday(day) ? "text-blue-700" : "text-slate-700")}>
                                    {day.getDate()}
                                </div>
                                <div className="mt-1 flex justify-center">
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-white border border-slate-200 text-slate-600">
                                        {stats.total} Staff
                                    </Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <CardContent className="p-0 overflow-y-auto">
                    <div className="min-w-[900px] relative grid grid-cols-8">
                        <div className="border-r border-slate-200">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="h-20 border-b border-slate-100 text-xs text-slate-400 p-2 text-center relative">
                                    <span className="-top-3 relative bg-white px-1">
                                        {i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {getDaysOfWeek().map((day, colIndex) => {
                            const daySchedules = getSchedulesForDay(day);
                            const stacked = stackEvents(daySchedules.filter((s:any) => s.type !== 'off'));
                            
                            return (
                                <div key={colIndex} className={cn("relative border-r border-slate-100 last:border-r-0", isToday(day) && "bg-blue-50/10")}>
                                    {Array.from({ length: 24 }).map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50" />)}
                                    {stacked.map((schedule: any) => {
                                        const start = new Date(schedule.startTime);
                                        const end = new Date(schedule.endTime);
                                        const hourHeight = 80; // h-20
                                        const durationHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                        const topOffset = (start.getHours() * hourHeight) + ((start.getMinutes() / 60) * hourHeight);
                                        const height = durationHrs * hourHeight;
                                        const width = 94 / schedule.totalCols;
                                        const leftOffset = 3 + (schedule.colIndex * width);

                                        return (
                                            <div 
                                                key={schedule.id}
                                                onClick={() => handleEdit(schedule)}
                                                className={cn("absolute rounded-md border p-1.5 text-xs shadow-sm transition-all hover:scale-[1.02] hover:z-30 cursor-pointer overflow-hidden flex flex-col gap-0.5 group", getShiftColorBlock(schedule.type))}
                                                style={{ top: `${topOffset}px`, height: `${Math.max(height, 30)}px`, width: `${width}%`, left: `${leftOffset}%` }}
                                            >
                                                <div className="font-bold truncate text-[11px] leading-tight">{getEmployeeName(schedule.userId)}</div>
                                                <div className="flex items-center gap-1 opacity-90 truncate text-[9px]">
                                                    {new Date(schedule.startTime).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})} - {new Date(schedule.endTime).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}
                                                </div>
                                                {height > 50 && <div className="mt-auto"><Badge variant="secondary" className="h-3.5 px-1 text-[8px] uppercase bg-white/50 backdrop-blur-sm border-0">{schedule.shiftRole}</Badge></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* --- DAY VIEW (By Role) --- */}
        <TabsContent value="day" className="mt-0">
            <Card className="border-slate-200 shadow-sm bg-white mb-4">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-6 justify-between items-center bg-slate-50">
                    <div className="text-center sm:text-left">
                        <h2 className="text-lg font-bold text-slate-800">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})}</h2>
                        <p className="text-sm text-slate-500">Daily coverage breakdown by role</p>
                    </div>
                    <div className="flex gap-4">
                        {[
                            { label: "Day", count: getDailyStats(currentDate).morning, icon: Sun, color: "text-emerald-600 bg-emerald-100" },
                            { label: "Mid", count: getDailyStats(currentDate).afternoon, icon: Sunset, color: "text-amber-600 bg-amber-100" },
                            { label: "Night", count: getDailyStats(currentDate).night, icon: Moon, color: "text-indigo-600 bg-indigo-100" },
                        ].map(stat => (
                            <div key={stat.label} className="flex flex-col items-center p-2 rounded-xl bg-white border border-slate-100 shadow-sm w-24">
                                <span className={cn("p-1.5 rounded-full mb-1", stat.color)}><stat.icon className="w-4 h-4" /></span>
                                <span className="text-xl font-bold text-slate-800">{stat.count}</span>
                                <span className="text-[10px] uppercase text-slate-400 font-bold">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white max-h-[800px] flex flex-col">
                <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50/50 sticky top-0 z-20">
                    <div className="p-4 text-xs font-semibold text-slate-400 text-center border-r border-slate-100">TIME</div>
                    {ROLES.map((role, i) => (
                        <div key={i} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                            <div className="text-sm font-bold uppercase text-slate-700">{role}</div>
                        </div>
                    ))}
                </div>
                <CardContent className="p-0 overflow-y-auto">
                    <div className="min-w-[700px] relative grid grid-cols-5">
                        <div className="border-r border-slate-200">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="h-24 border-b border-slate-100 text-xs text-slate-400 p-2 text-center relative">
                                    <span className="-top-3 relative bg-white px-1">{i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`}</span>
                                </div>
                            ))}
                        </div>
                        {ROLES.map((role, colIndex) => {
                            const roleSchedules = getSchedulesForRole(role, currentDate);
                            const stacked = stackEvents(roleSchedules.filter((s:any) => s.type !== 'off'));
                            return (
                                <div key={colIndex} className="relative border-r border-slate-100 last:border-r-0">
                                    {Array.from({ length: 24 }).map((_, i) => <div key={i} className="h-24 border-b border-slate-100/50" />)}
                                    {stacked.map((schedule: any) => {
                                        const start = new Date(schedule.startTime);
                                        const end = new Date(schedule.endTime);
                                        const hourHeight = 96; // h-24
                                        const durationHrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                        const topOffset = (start.getHours() * hourHeight) + ((start.getMinutes() / 60) * hourHeight);
                                        const height = durationHrs * hourHeight;
                                        const width = 94 / schedule.totalCols;
                                        const leftOffset = 3 + (schedule.colIndex * width);

                                        return (
                                            <div 
                                                key={schedule.id}
                                                onClick={() => handleEdit(schedule)}
                                                className={cn("absolute rounded-md border p-3 text-xs shadow-sm transition-all hover:scale-[1.02] hover:z-30 cursor-pointer overflow-hidden flex flex-col gap-1 group", getShiftColorBlock(schedule.type))}
                                                style={{ top: `${topOffset}px`, height: `${Math.max(height, 40)}px`, width: `${width}%`, left: `${leftOffset}%` }}
                                            >
                                                <div className="font-bold text-sm">{getEmployeeName(schedule.userId)}</div>
                                                <div className="flex items-center gap-1 opacity-90 text-[11px]">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(schedule.startTime).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})} - {new Date(schedule.endTime).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}
                                                </div>
                                                <button onClick={(e) => handleDelete(schedule, e)} className="absolute top-1 right-1 p-1 rounded-full bg-white/50 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-0">
            <Card className="bg-white/40 backdrop-blur-md border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-white/50 border-b border-slate-200/60">
                        <tr>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Employee</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Shift Details</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Time</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Location</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading schedules...</td></tr>
                        ) : filteredSchedules.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No shifts assigned.</td></tr>
                        ) : (
                        filteredSchedules.map((schedule) => (
                            <tr key={schedule.id} className="hover:bg-white/60 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{getEmployeeName(schedule.userId)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {getShiftBadge(schedule.type)}
                                    {schedule.shiftRole && getRoleBadge(schedule.shiftRole)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {schedule.type !== 'off' ? (
                                    <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {new Date(schedule.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(schedule.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </div>
                                ) : <span className="text-slate-400 text-xs italic">Off Duty</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {schedule.location ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {schedule.location}
                                    </div>
                                ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => handleEdit(schedule)}>
                                        <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={() => handleDelete(schedule)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </td>
                            </tr>
                        ))
                        )}
                    </tbody>
                    </table>
                </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
                <DialogTitle>Edit Shift</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
                <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" className="rounded-xl" {...editForm.register("date")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Shift Type</Label>
                        {/* Auto-fill Handler attached here for EDIT too */}
                        <Select onValueChange={(val) => handleShiftTypeChange(val, editForm)} value={editForm.watch("shiftType")}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="morning">{SHIFT_PRESETS.morning.label}</SelectItem>
                                <SelectItem value="afternoon">{SHIFT_PRESETS.afternoon.label}</SelectItem>
                                <SelectItem value="night">{SHIFT_PRESETS.night.label}</SelectItem>
                                <SelectItem value="off">{SHIFT_PRESETS.off.label}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select onValueChange={(value) => editForm.setValue("shiftRole", value as any)} value={editForm.watch("shiftRole")}>
                            <SelectTrigger className="rounded-xl capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl capitalize">
                                {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input type="time" className="rounded-xl" {...editForm.register("startTime")} />
                    </div>
                    <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input type="time" className="rounded-xl" {...editForm.register("endTime")} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Location</Label>
                    <Input {...editForm.register("location")} className="rounded-xl" />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-full">Cancel</Button>
                    <Button type="submit" disabled={updateShiftMutation.isPending} className="rounded-full bg-slate-900">{updateShiftMutation.isPending ? "Updating..." : "Update Shift"}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Shift</AlertDialogTitle>
                <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 rounded-full">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}