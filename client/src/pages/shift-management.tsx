import { useState, useMemo, useEffect } from "react";
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
  Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, 
  Copy, Users, CalendarDays, MapPin, Grid, List, Calendar as CalendarIcon, 
  Sun, Moon, Sunset, Filter, LayoutPanelLeft
} from "lucide-react";
import type { Schedule, User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// --- Configuration ---
const ROLES = ["cashier", "bar", "server", "kitchen"];

const SHIFT_PRESETS = {
  morning: { start: "08:00", end: "17:00", label: "Day (8am - 5pm)", color: "bg-emerald-100 border-emerald-200 text-emerald-800", indicator: "bg-emerald-500" },
  afternoon: { start: "13:00", end: "00:00", label: "Mid (1pm - 12am)", color: "bg-amber-100 border-amber-200 text-amber-800", indicator: "bg-amber-500" },
  night: { start: "21:00", end: "06:00", label: "Night (9pm - 6am)", color: "bg-indigo-100 border-indigo-200 text-indigo-800", indicator: "bg-indigo-500" },
  off: { start: "00:00", end: "23:59", label: "Day Off", color: "bg-slate-100 border-slate-200 text-slate-500", indicator: "bg-slate-400" }
};

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

export default function ShiftManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"roster" | "kanban" | "list">("roster");
   
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
   
  // Filter State
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // --- Permission Check ---
  if (user?.role !== 'manager' && user?.role !== 'admin') return <div className="p-8 text-center text-slate-500">Access denied.</div>;

  // --- Queries ---
  const { data: teamMembers } = useQuery<User[]>({ queryKey: ["/api/team"] });
  const { data: allSchedules, isLoading } = useQuery<Schedule[]>({ queryKey: ["/api/schedules/all"] });

  // --- Helpers ---
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

  const getDaysOfWeek = () => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const getEmployeeName = (userId: string) => {
    const emp = teamMembers?.find((m) => m.id === userId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };
  
  // FIX: Helper for robust time formatting (HH:mm)
  const formatTimeForInput = (dateInput: string | number | Date) => {
    const date = new Date(dateInput);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const delta = view === 'kanban' ? 1 : 7; // Move by day in Kanban, by week in Roster
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? delta : -delta));
    setCurrentDate(newDate);
  };

  // --- Filtering ---
  const filteredSchedules = useMemo(() => {
    if (!allSchedules) return [];
    return allSchedules.filter((s) => {
        const d = new Date(s.date);
        const inRange = view === 'roster' || view === 'list' 
            ? d >= weekStart && d <= weekEnd 
            : true; // For Kanban (Day view), we filter specifically below
        const employeeMatch = selectedEmployee === "all" || s.userId === selectedEmployee;
        return inRange && employeeMatch;
    });
  }, [allSchedules, weekStart, weekEnd, selectedEmployee, view]);

  const getSchedulesForDay = (date: Date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return filteredSchedules.filter(s => new Date(s.date).toISOString().split('T')[0] === dateStr);
  };

  const getShiftsForEmployeeAndDate = (employeeId: string, date: Date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return filteredSchedules.filter(s => 
        s.userId === employeeId && 
        new Date(s.date).toISOString().split('T')[0] === dateStr
    );
  };

  // --- Forms & Mutations (Simplified for brevity, logic same as before) ---
  const createForm = useForm<ShiftForm>({ resolver: zodResolver(shiftFormSchema), defaultValues: { shiftType: "morning", shiftRole: "server" } });
  const editForm = useForm<ShiftForm>({ resolver: zodResolver(shiftFormSchema) });

  // 1. MODIFIED: Only sets the label/color, does NOT force the time anymore
  const handleShiftTypeChange = (val: string, form: any) => {
    form.setValue("shiftType", val);
    // Removed the lines that set startTime/endTime based on the preset
  };

  // 2. NEW: Automatically sets End Time to Start Time + 9 Hours
  const onStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>, form: any) => {
    const newStartTime = e.target.value;
    
    // Update the start time field immediately
    form.setValue("startTime", newStartTime);

    if (newStartTime) {
      const [hours, minutes] = newStartTime.split(':').map(Number);
      
      // Create a date object to handle the math (including crossing midnight)
      const date = new Date();
      date.setHours(hours);
      date.setMinutes(minutes);
      
      // Add 9 hours
      date.setHours(date.getHours() + 9);
      
      // Format back to HH:mm
      const newEndHour = date.getHours().toString().padStart(2, '0');
      const newEndMinute = date.getMinutes().toString().padStart(2, '0');
      
      form.setValue("endTime", `${newEndHour}:${newEndMinute}`);
    }
  };

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftForm) => {
      let { startTime, endTime } = data;
      if ((!startTime || !endTime) && data.shiftType !== 'off') {
         const preset = SHIFT_PRESETS[data.shiftType];
         startTime = preset.start; endTime = preset.end;
      }
      const startDateTime = new Date(`${data.date}T${startTime || "00:00"}`);
      const endDateTime = new Date(`${data.date}T${endTime || "00:00"}`);
      if (endDateTime < startDateTime && data.shiftType !== 'off') endDateTime.setDate(endDateTime.getDate() + 1);

      return (await apiRequest("POST", "/api/schedules", {
        userId: data.userId, date: new Date(data.date).getTime(), startTime: startDateTime.getTime(), endTime: endDateTime.getTime(),
        type: data.shiftType, title: `${data.shiftType.charAt(0).toUpperCase() + data.shiftType.slice(1)} Shift`,
        shiftRole: data.shiftRole, location: data.location,
      })).json();
    },
    onSuccess: () => {
      toast.success("Shift created");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsCreateDialogOpen(false); createForm.reset();
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShiftForm> }) => {
      const updates: any = { ...data };
      if (data.date) {
        updates.date = new Date(data.date).getTime();
        if (data.startTime && data.endTime) {
            const start = new Date(`${data.date}T${data.startTime}`);
            const end = new Date(`${data.date}T${data.endTime}`);
            if (end < start && data.shiftType !== 'off') end.setDate(end.getDate() + 1);
            updates.startTime = start.getTime(); updates.endTime = end.getTime();
        }
      }
      return (await apiRequest("PATCH", `/api/schedules/${id}`, updates)).json();
    },
    onSuccess: () => { toast.success("Shift updated"); queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); setIsEditDialogOpen(false); },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/schedules/${id}`, {})).json(),
    onSuccess: () => { toast.success("Shift deleted"); queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); setIsDeleteDialogOpen(false); },
  });

  const copyWeekMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/schedules/copy-week", {
      sourceWeekStart: new Date(weekStart.getTime() - 7 * 86400000).toISOString(),
      targetWeekStart: weekStart.toISOString(),
    })).json(),
    onSuccess: () => { toast.success("Schedule copied"); queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); },
  });

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    const dateStr = new Date(schedule.date).toISOString().split('T')[0];
    
    // FIX: Use manual extraction for accurate HH:mm for HTML inputs
    const startStr = formatTimeForInput(schedule.startTime);
    const endStr = formatTimeForInput(schedule.endTime);

    editForm.reset({ 
        userId: schedule.userId, 
        date: dateStr, 
        shiftType: schedule.type as any, 
        shiftRole: schedule.shiftRole as any, 
        startTime: startStr, 
        endTime: endStr, 
        location: schedule.location || "" 
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (schedule: Schedule, e?: React.MouseEvent) => {
    e?.stopPropagation(); setSelectedSchedule(schedule); setIsDeleteDialogOpen(true);
  };

  // --- UI Components ---
  const Header = () => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shift Management</h1>
        <p className="text-slate-500 mt-1 text-sm">Assign and manage employee work schedules</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" className="bg-white/60" onClick={() => copyWeekMutation.mutate()} disabled={copyWeekMutation.isPending}>
          <Copy className="w-4 h-4 mr-2" /> Copy Previous Week
        </Button>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-slate-900 text-white rounded-full px-6 shadow-lg">
          <Plus className="w-4 h-4 mr-2" /> Assign Shift
        </Button>
      </div>
    </div>
  );

  const Toolbar = () => (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-3 w-full lg:w-auto">
        <Users className="w-4 h-4 text-slate-400" />
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-[180px] border-none shadow-none font-medium p-0 h-auto focus:ring-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {teamMembers?.map((m) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center bg-slate-50 rounded-lg p-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className="h-8 w-8 text-slate-500 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
        <div className="px-4 text-sm font-semibold text-slate-700 min-w-[160px] text-center flex items-center justify-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            {view === 'kanban' ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'}) : 
             `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate('next')} className="h-8 w-8 text-slate-500 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
      </div>

      <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
        <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        <div className="h-4 w-px bg-slate-200 mx-2" />
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-auto">
          <TabsList className="bg-slate-100 h-9 p-1">
            <TabsTrigger value="roster" className="h-7 text-xs px-3 gap-2"><Grid className="w-3.5 h-3.5"/> Roster</TabsTrigger>
            <TabsTrigger value="kanban" className="h-7 text-xs px-3 gap-2"><LayoutPanelLeft className="w-3.5 h-3.5"/> Day</TabsTrigger>
            <TabsTrigger value="list" className="h-7 text-xs px-3 gap-2"><List className="w-3.5 h-3.5"/> List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const StatsBar = () => {
    const shifts = getSchedulesForDay(currentDate).filter(s => s.type !== 'off');
    const counts = {
        total: shifts.length,
        morning: shifts.filter(s => s.type === 'morning').length,
        afternoon: shifts.filter(s => s.type === 'afternoon').length,
        night: shifts.filter(s => s.type === 'night').length
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Total Staff</p><p className="text-2xl font-bold text-slate-900">{counts.total}</p></div>
                <Users className="w-8 h-8 text-slate-100" />
            </Card>
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm p-4 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase text-emerald-600">Morning</p><p className="text-2xl font-bold text-emerald-900">{counts.morning}</p></div>
                <Sun className="w-8 h-8 text-emerald-200" />
            </Card>
            <Card className="bg-amber-50 border-amber-100 shadow-sm p-4 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase text-amber-600">Afternoon</p><p className="text-2xl font-bold text-amber-900">{counts.afternoon}</p></div>
                <Sunset className="w-8 h-8 text-amber-200" />
            </Card>
            <Card className="bg-indigo-50 border-indigo-100 shadow-sm p-4 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase text-indigo-600">Night</p><p className="text-2xl font-bold text-indigo-900">{counts.night}</p></div>
                <Moon className="w-8 h-8 text-indigo-200" />
            </Card>
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
      <Header />
      <Toolbar />

      {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading schedule...</div>
      ) : (
          <>
            {/* --- VIEW: ROSTER (Employees x Days) --- */}
            {view === 'roster' && (
                <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                        <div className="min-w-[1000px]">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="w-[200px] p-4 text-left bg-slate-50 border-b border-r border-slate-200 text-xs font-bold text-slate-500 uppercase sticky left-0 z-20">Employee</th>
                                        {getDaysOfWeek().map((day, i) => (
                                            <th key={i} className={cn("p-3 text-center border-b border-r border-slate-200 min-w-[140px]", isToday(day) && "bg-blue-50/50")}>
                                                <div className={cn("text-[10px] font-bold uppercase", isToday(day) ? "text-blue-600" : "text-slate-400")}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                                <div className={cn("text-lg font-bold", isToday(day) ? "text-blue-700" : "text-slate-700")}>{day.getDate()}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamMembers?.map((employee) => (
                                        <tr key={employee.id} className="group hover:bg-slate-50/30 transition-colors">
                                            <td className="p-4 border-b border-r border-slate-200 bg-white sticky left-0 z-10 group-hover:bg-slate-50/30">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-slate-900">{employee.firstName} {employee.lastName}</span>
                                                    <span className="text-xs text-slate-500 capitalize">{employee.position || "Staff"}</span>
                                                </div>
                                            </td>
                                            {getDaysOfWeek().map((day, i) => {
                                                const shifts = getShiftsForEmployeeAndDate(employee.id, day);
                                                return (
                                                    <td key={i} className={cn("p-2 border-b border-r border-slate-200 align-top h-[100px]", isToday(day) && "bg-blue-50/10")}>
                                                        <div className="flex flex-col gap-2 h-full">
                                                            {shifts.map(shift => <RosterCard key={shift.id} schedule={shift} onEdit={handleEdit} onDelete={handleDelete} />)}
                                                            {shifts.length === 0 && (
                                                                <button onClick={() => { createForm.setValue("userId", employee.id); createForm.setValue("date", day.toISOString().split('T')[0]); setIsCreateDialogOpen(true); }} className="flex-1 w-full flex items-center justify-center rounded-lg border-2 border-dashed border-slate-100 hover:border-slate-300 text-slate-300 hover:text-slate-500 transition-all opacity-0 group-hover:opacity-100"><Plus className="w-5 h-5" /></button>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Card>
            )}

            {/* --- VIEW: DAY KANBAN (Roles Columns) --- */}
            {view === 'kanban' && (
                <div className="space-y-6">
                    <StatsBar />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        {ROLES.map(role => {
                            const roleShifts = getSchedulesForDay(currentDate)
                                .filter(s => s.shiftRole === role && s.type !== 'off')
                                .sort((a,b) => a.startTime - b.startTime);
                            return (
                                <div key={role} className="flex flex-col bg-slate-100/50 rounded-xl border border-slate-200 p-1">
                                    <div className="p-3 border-b border-slate-100 mb-2 flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-700 uppercase tracking-wider">{role}</span>
                                        <Badge variant="secondary" className="bg-white">{roleShifts.length}</Badge>
                                    </div>
                                    <div className="flex-1 space-y-2 p-2 min-h-[150px]">
                                        {roleShifts.length === 0 ? <div className="text-center py-8 text-slate-400 text-xs italic">No Staff</div> : 
                                            roleShifts.map(s => <KanbanCard key={s.id} schedule={s} employeeName={getEmployeeName(s.userId)} onEdit={handleEdit} onDelete={handleDelete} />)
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- VIEW: LIST --- */}
            {view === 'list' && (
                <Card className="border-slate-200 shadow-sm"><CardContent className="p-0"><table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-6 py-3 font-semibold">Date</th><th className="px-6 py-3 font-semibold">Employee</th><th className="px-6 py-3 font-semibold">Shift</th><th className="px-6 py-3 font-semibold">Time</th><th className="px-6 py-3 font-semibold text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSchedules.map(s => (<tr key={s.id} className="hover:bg-slate-50/50"><td className="px-6 py-3 font-medium">{new Date(s.date).toLocaleDateString()}</td><td className="px-6 py-3">{getEmployeeName(s.userId)}</td><td className="px-6 py-3"><Badge variant="outline" className={cn("capitalize", SHIFT_PRESETS[s.type as keyof typeof SHIFT_PRESETS]?.color)}>{s.type}</Badge></td><td className="px-6 py-3 text-slate-500 text-xs font-mono">{s.type !== 'off' ? `${new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(s.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'OFF'}</td><td className="px-6 py-3 text-right"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(s)}><Edit className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4" /></Button></td></tr>))}</tbody></table></CardContent></Card>
            )}
          </>
      )}

      {/* --- Dialogs --- */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>Assign New Shift</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createShiftMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Employee</Label><Select onValueChange={(v) => createForm.setValue("userId", v)}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{teamMembers?.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Date</Label><Input type="date" className="rounded-xl" {...createForm.register("date")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Shift Type</Label><Select onValueChange={(v) => handleShiftTypeChange(v, createForm)} defaultValue="morning"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SHIFT_PRESETS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Role</Label><Select onValueChange={(v) => createForm.setValue("shiftRole", v as any)} defaultValue="server"><SelectTrigger className="rounded-xl capitalize"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl">
              <div className="space-y-1"><Label className="text-xs">Start Time</Label><Input type="time" className="bg-white h-8" {...createForm.register("startTime")} onChange={(e) => onStartTimeChange(e, createForm)}/></div>
              <div className="space-y-1"><Label className="text-xs">End Time</Label><Input type="time" className="bg-white h-8" {...createForm.register("endTime")} /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input className="rounded-xl" placeholder="e.g. Main Hall" {...createForm.register("location")} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createShiftMutation.isPending}>Create Shift</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
       
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader><DialogTitle>Edit Shift</DialogTitle></DialogHeader>
            <form onSubmit={editForm.handleSubmit((d) => selectedSchedule && updateShiftMutation.mutate({ id: selectedSchedule.id, data: d }))} className="space-y-4 mt-2">
                
                {/* --- FIX: Display Employee Name --- */}
                <div className="space-y-2">
                    <Label>Employee</Label>
                    <div className="flex items-center px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium">
                        <Users className="w-4 h-4 mr-2 opacity-50"/>
                        {selectedSchedule ? getEmployeeName(selectedSchedule.userId) : "Loading..."}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" className="rounded-xl" {...editForm.register("date")} /></div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select onValueChange={(value) => editForm.setValue("shiftRole", value as any)} value={editForm.watch("shiftRole")}>
                            <SelectTrigger className="rounded-xl capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Shift Type</Label>
                    <Select onValueChange={(val) => handleShiftTypeChange(val, editForm)} value={editForm.watch("shiftType")}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(SHIFT_PRESETS).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl">
                    <div className="space-y-1"><Label className="text-xs">Start Time</Label><Input type="time" className="bg-white h-8" {...editForm.register("startTime")} onChange={(e) => onStartTimeChange(e, editForm)}/></div>
                    <div className="space-y-1"><Label className="text-xs">End Time</Label><Input type="time" className="bg-white h-8" {...editForm.register("endTime")} /></div>
                </div>
                <div className="space-y-2"><Label>Location</Label><Input {...editForm.register("location")} className="rounded-xl" /></div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={updateShiftMutation.isPending} className="bg-slate-900 text-white">Update Shift</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader><DialogTitle>Delete Shift</DialogTitle><DialogDescription>Are you sure?</DialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => selectedSchedule && deleteShiftMutation.mutate(selectedSchedule.id)} className="bg-rose-600 hover:bg-rose-700 rounded-full">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Cards ---

function RosterCard({ schedule, onEdit, onDelete }: any) {
  if (schedule.type === 'off') return <div onClick={() => onEdit(schedule)} className="rounded-md bg-slate-50 border border-slate-100 p-2 text-center cursor-pointer hover:bg-slate-100"><span className="text-[10px] font-bold text-slate-300">OFF</span></div>;
  const style = SHIFT_PRESETS[schedule.type as keyof typeof SHIFT_PRESETS];
  return (
    <div onClick={() => onEdit(schedule)} className={cn("relative rounded-lg p-2 text-xs border shadow-sm cursor-pointer hover:scale-[1.02] transition-all group", style?.color)}>
      <div className="flex justify-between items-center mb-1"><span className="font-bold capitalize">{schedule.type}</span><Badge variant="secondary" className="h-4 px-1 text-[8px] bg-white/60 border-0 uppercase">{schedule.shiftRole}</Badge></div>
      <div className="font-mono text-[10px] opacity-90">{new Date(schedule.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      <button onClick={(e) => onDelete(schedule, e)} className="absolute top-1 right-1 p-1 rounded-full bg-white/40 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function KanbanCard({ schedule, employeeName, onEdit, onDelete }: any) {
  const style = SHIFT_PRESETS[schedule.type as keyof typeof SHIFT_PRESETS];
  return (
    <div onClick={() => onEdit(schedule)} className="group relative bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-sm text-slate-800">{employeeName}</span>
        <div className={cn("w-2 h-2 rounded-full", style?.indicator)} />
      </div>
      <div className="flex items-center text-xs text-slate-500 gap-1.5 mb-1">
        <Clock className="w-3 h-3" />
        {new Date(schedule.startTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})} - {new Date(schedule.endTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
      </div>
      <div className="flex items-center text-[10px] text-slate-400 gap-1.5"><MapPin className="w-3 h-3" /> {schedule.location || "Main Hall"}</div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={(e) => onDelete(schedule, e)}><Trash2 className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}