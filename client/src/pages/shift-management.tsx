import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, 
  Copy, Users, CalendarDays, MapPin, Grid, List, 
  Sun, Moon, Sunset, LayoutPanelLeft, Check, ChevronsUpDown, AlertTriangle, AlertCircle
} from "lucide-react";
import type { Schedule, User, LeaveRequest } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// --- Configuration ---
const ROLES = ["cashier", "bar", "server", "kitchen"];

const SHIFT_PRESETS = {
  morning: { start: "08:00", end: "17:00", label: "AM", color: "bg-emerald-100 border-emerald-200 text-emerald-800", indicator: "bg-emerald-500", ring: "ring-emerald-500", text: "text-emerald-900", icon: "text-emerald-200", title: "text-emerald-600" },
  afternoon: { start: "13:00", end: "22:00", label: "PM", color: "bg-amber-100 border-amber-200 text-amber-800", indicator: "bg-amber-500", ring: "ring-amber-500", text: "text-amber-900", icon: "text-amber-200", title: "text-amber-600" },
  night: { start: "21:00", end: "06:00", label: "GY", color: "bg-indigo-100 border-indigo-200 text-indigo-800", indicator: "bg-indigo-500", ring: "ring-indigo-500", text: "text-indigo-900", icon: "text-indigo-200", title: "text-indigo-600" },
  off: { start: "00:00", end: "23:59", label: "Day Off", color: "bg-slate-100 border-slate-200 text-slate-500", indicator: "bg-slate-400", ring: "ring-slate-900", text: "text-slate-900", icon: "text-slate-100", title: "text-slate-400" }
};

const shiftFormSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  shiftType: z.enum(["morning", "afternoon", "night", "off"], { required_error: "Shift type is required" }),
  shiftRole: z.enum(["cashier", "bar", "server", "kitchen"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
});

type ShiftForm = z.infer<typeof shiftFormSchema>;

// --- Styles Definition ---
const styles = {
  page: { wrapper: "max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-8" },
  header: {
    container: "flex flex-col md:flex-row md:items-center justify-between gap-4",
    title: "text-2xl md:text-3xl font-bold tracking-tight text-slate-900",
    subtitle: "text-slate-500 mt-1 text-sm",
    actions: "flex flex-col sm:flex-row items-stretch sm:items-center gap-3",
    btnCopy: "bg-white/60 w-full sm:w-auto",
    btnCreate: "bg-slate-900 text-white rounded-full px-6 shadow-lg w-full sm:w-auto hover:bg-slate-800",
  },
  toolbar: {
    container: "flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm",
    leftGroup: "flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto",
    employeePickerBtn: "w-full sm:w-[200px] justify-between font-medium p-2 h-auto hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-md transition-all",
    dateNav: {
      container: "flex items-center bg-slate-50 rounded-lg p-1 w-full sm:w-auto justify-between sm:justify-center",
      text: "px-2 sm:px-4 text-sm font-semibold text-slate-700 min-w-[140px] text-center flex items-center justify-center gap-2",
      btn: "h-8 w-8 text-slate-500 hover:bg-white hover:shadow-sm"
    },
    rightGroup: "flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between sm:justify-end",
    tabsList: "bg-slate-100 h-9 p-1 w-full sm:w-auto",
    tabTrigger: "flex-1 sm:flex-none h-7 text-xs px-3 gap-2"
  },
  stats: {
    grid: "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4",
    card: "bg-white border-slate-200 shadow-sm p-3 md:p-4 flex items-center justify-between cursor-pointer transition-all hover:border-slate-400 select-none",
    cardActive: "ring-2 ring-offset-2",
    label: "text-[10px] font-bold uppercase",
    count: "text-xl md:text-2xl font-bold"
  },
  kanban: {
    grid: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start",
    column: "flex flex-col bg-slate-100/50 rounded-xl border border-slate-200 p-1",
    columnHeader: "p-3 border-b border-slate-100 mb-2 flex items-center justify-between",
    columnTitle: "font-bold text-sm text-slate-700 uppercase tracking-wider",
    cardList: "flex-1 space-y-2 p-2 min-h-[100px] md:min-h-[150px]"
  },
  roster: {
    card: "border-slate-200 shadow-sm overflow-hidden bg-white",
    scrollArea: "overflow-x-auto w-full",
    tableWrapper: "min-w-[800px] md:min-w-[1000px]",
    th: "p-3 md:p-4 text-left border-b border-r border-slate-200",
    tdUser: "p-3 md:p-4 border-b border-r border-slate-200 bg-white sticky left-0 z-10 group-hover:bg-slate-50/30",
    tdCell: "p-1 md:p-2 border-b border-r border-slate-200 align-top h-[100px]"
  },
  list: {
    row: "hover:bg-slate-50/50 transition-colors",
    cell: "px-4 md:px-6 py-3",
    header: "bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500"
  },
  form: {
    grid2: "grid grid-cols-1 sm:grid-cols-2 gap-4",
    input: "rounded-xl",
    timeWrapper: "bg-slate-50 p-3 rounded-xl"
  }
};

export default function ShiftManagement() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"roster" | "kanban" | "list">("kanban");
  const [openEmployeePicker, setOpenEmployeePicker] = useState(false);
    
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Filter State
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string | null>(null);

  if (!hasPermission(Permission.MANAGE_SCHEDULES)) {
    return <div className="p-8 text-center text-slate-500">Access denied. You do not have permission to manage schedules.</div>;
  }

  const { data: teamMembers } = useQuery<User[]>({ queryKey: ["/api/team"] });
  const { data: allSchedules, isLoading } = useQuery<Schedule[]>({ queryKey: ["/api/schedules/all"] });
  
  const { data: leaves } = useQuery<LeaveRequest[]>({ queryKey: ["/api/leave-management/all"] });
  const approvedLeaves = useMemo(() => leaves?.filter(l => l.status === 'approved') || [], [leaves]);

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
  
  const formatTimeForInput = (dateInput: string | number | Date) => {
    const date = new Date(dateInput);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutesRaw = date.getMinutes();
    const minutes = minutesRaw < 15 ? '00' : minutesRaw < 45 ? '30' : '00';
    return `${hours}:${minutes}`;
  };

  const getLocalYMD = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const delta = view === 'kanban' ? 1 : 7;
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? delta : -delta));
    setCurrentDate(newDate);
  };

  // --- Strict Conflict Detection Logic ---
  const getShiftConflict = (userId: string, date: string, startTime: string, endTime: string, shiftType: string, excludeId?: string) => {
    if (!userId || !date) return null;
    
    const targetDateStr = date; 

    const leave = approvedLeaves.find(l => {
        if (l.userId !== userId) return false;
        const startStr = new Date(l.startDate).toISOString().split('T')[0];
        const endStr = new Date(l.endDate).toISOString().split('T')[0];
        return targetDateStr >= startStr && targetDateStr <= endStr;
    });
    if (leave) return { type: 'leave', message: `Employee has an approved leave (${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}).` };

    if (shiftType === 'off') return null;

    const sameDayShift = allSchedules?.find(s => {
        if (s.userId !== userId || s.id === excludeId || s.shiftType === 'off') return false;
        const existingDateStr = new Date(s.date).toISOString().split('T')[0]; 
        return existingDateStr === targetDateStr;
    });

    if (sameDayShift) {
        return { type: 'daily_limit', message: `Employee already has a shift assigned on this date. Maximum 1 shift per day.` };
    }

    let st = startTime; let et = endTime;
    if (!st || !et) {
        const preset = SHIFT_PRESETS[shiftType as keyof typeof SHIFT_PRESETS];
        if(preset) { st = preset.start; et = preset.end; }
    }

    if (st && et) {
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const [sh, smin] = st.split(':').map(Number);
        const [eh, emin] = et.split(':').map(Number);
        
        const sTs = new Date(y, m - 1, d, sh, smin).getTime();
        let eTs = new Date(y, m - 1, d, eh, emin).getTime();
        if (eTs <= sTs) eTs += 86400000;

        const overlap = allSchedules?.find(s => {
            if (s.userId !== userId || s.id === excludeId || s.shiftType === 'off') return false;
            return sTs < s.endTime && eTs > s.startTime;
        });
        
        if (overlap) {
            const overlapDateStr = new Date(overlap.date).toISOString().split('T')[0];
            return { type: 'overlap', message: `Times overlap with an existing shift starting on ${overlapDateStr} (${new Date(overlap.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(overlap.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}).` };
        }
    }

    return null;
  };

  const evaluateScheduleConflict = (s: Schedule) => {
     return getShiftConflict(
         s.userId, 
         new Date(s.date).toISOString().split('T')[0], 
         formatTimeForInput(s.startTime), 
         formatTimeForInput(s.endTime), 
         s.shiftType || 'morning', 
         s.id
     );
  };

  // --- Duration Warning Logic (< 9 hours) ---
  const getShiftDurationWarning = (startTime: string, endTime: string, shiftType: string) => {
    if (shiftType === 'off' || !startTime || !endTime) return null;
    
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;

    let sMins = sh * 60 + sm;
    let eMins = eh * 60 + em;
    
    // Handle overnight calculations
    if (eMins <= sMins) eMins += 24 * 60;
    
    const hours = (eMins - sMins) / 60;
    
    if (hours > 0 && hours < 9) {
        return `Shift is only ${hours.toFixed(1)} hours long (standard is 9 hours including break).`;
    }
    return null;
  };

  // --- Filtering ---
  const filteredSchedules = useMemo(() => {
    if (!allSchedules) return [];
    return allSchedules.filter((s) => {
        const d = new Date(s.date);
        const inRange = view === 'roster' || view === 'list' 
            ? d >= weekStart && d <= weekEnd 
            : true;
        const employeeMatch = selectedEmployee === "all" || s.userId === selectedEmployee;
        return inRange && employeeMatch;
    });
  }, [allSchedules, weekStart, weekEnd, selectedEmployee, view]);

  const getSchedulesForDay = (date: Date) => {
    const dateStr = getLocalYMD(date);
    return filteredSchedules.filter(s => new Date(s.date).toISOString().split('T')[0] === dateStr);
  };

  const getShiftsForEmployeeAndDate = (employeeId: string, date: Date) => {
    const dateStr = getLocalYMD(date);
    return filteredSchedules.filter(s => 
        s.userId === employeeId && 
        new Date(s.date).toISOString().split('T')[0] === dateStr
    );
  };

  // --- Forms & Mutations ---
  const createForm = useForm<ShiftForm>({ resolver: zodResolver(shiftFormSchema) });
  const editForm = useForm<ShiftForm>({ resolver: zodResolver(shiftFormSchema) });

  const createValues = createForm.watch();
  const createConflict = useMemo(() => getShiftConflict(createValues.userId, createValues.date, createValues.startTime || "", createValues.endTime || "", createValues.shiftType), [createValues, allSchedules, approvedLeaves]);
  const createDurationWarning = useMemo(() => getShiftDurationWarning(createValues.startTime || "", createValues.endTime || "", createValues.shiftType), [createValues]);
  
  const editValues = editForm.watch();
  const editConflict = useMemo(() => getShiftConflict(editValues.userId, editValues.date, editValues.startTime || "", editValues.endTime || "", editValues.shiftType, selectedSchedule?.id), [editValues, selectedSchedule, allSchedules, approvedLeaves]);
  const editDurationWarning = useMemo(() => getShiftDurationWarning(editValues.startTime || "", editValues.endTime || "", editValues.shiftType), [editValues]);

  const handleShiftTypeChange = (val: string, form: any) => {
    form.setValue("shiftType", val, { shouldValidate: true });
    if (val === "off") {
      form.setValue("startTime", "00:00");
      form.setValue("endTime", "00:00");
    } else {
      const preset = SHIFT_PRESETS[val as keyof typeof SHIFT_PRESETS];
      if (preset) {
        form.setValue("startTime", preset.start, { shouldValidate: true });
        form.setValue("endTime", preset.end, { shouldValidate: true });
      }
    }
  };

  const onStartTimeChange = (val: string, form: any) => {
    if (!val) return;
    form.setValue("startTime", val, { shouldValidate: true });
    
    const hour = parseInt(val.split(':')[0], 10);
    if (!isNaN(hour)) {
        let detectedType: "morning" | "afternoon" | "night" = "night";
        if (hour >= 5 && hour < 12) detectedType = "morning";
        else if (hour >= 12 && hour < 18) detectedType = "afternoon";
        form.setValue("shiftType", detectedType);
    }

    const [h, m] = val.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
        const date = new Date();
        date.setHours(h, m, 0);
        date.setHours(date.getHours() + 9);
        
        const endH = date.getHours().toString().padStart(2, '0');
        const endM = date.getMinutes().toString().padStart(2, '0');
        form.setValue("endTime", `${endH}:${endM}`, { shouldValidate: true });
    }
  };

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftForm) => {
      const startDateTime = new Date(`${data.date}T${data.startTime || "00:00"}`);
      const endDateTime = new Date(`${data.date}T${data.endTime || "00:00"}`);
      if (endDateTime <= startDateTime && data.shiftType !== 'off') {
          endDateTime.setDate(endDateTime.getDate() + 1);
      }

      return (await apiRequest("POST", "/api/schedules", {
        userId: data.userId, 
        date: new Date(data.date).getTime(), 
        startTime: startDateTime.getTime(), 
        endTime: endDateTime.getTime(),
        shiftType: data.shiftType,
        type: "regular",
        title: `${data.shiftType.charAt(0).toUpperCase() + data.shiftType.slice(1)} Shift`,
        shiftRole: data.shiftRole, 
        location: data.location,
      })).json();
    },
    onSuccess: () => { 
      toast.success("Shift created"); 
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); 
      setIsCreateDialogOpen(false); 
      createForm.reset(); 
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShiftForm> }) => {
      const updates: any = { ...data };
      if (data.date && data.startTime && data.endTime) {
         updates.date = new Date(data.date).getTime();
         const start = new Date(`${data.date}T${data.startTime}`);
         const end = new Date(`${data.date}T${data.endTime}`);
         if (end <= start && data.shiftType !== 'off') end.setDate(end.getDate() + 1);
         updates.startTime = start.getTime(); 
         updates.endTime = end.getTime();
      }
      return (await apiRequest("PATCH", `/api/schedules/${id}`, updates)).json();
    },
    onSuccess: () => { toast.success("Shift updated"); queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); setIsEditDialogOpen(false); },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/schedules/${id}`, {})).json(),
    onSuccess: () => { 
        toast.success("Shift deleted"); 
        queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); 
        setIsDeleteDialogOpen(false); 
        setIsEditDialogOpen(false); 
    },
  });

  const copyWeekMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/schedules/copy-week", {
      sourceWeekStart: new Date(weekStart.getTime() - 7 * 86400000).toISOString(),
      targetWeekStart: weekStart.toISOString(),
    })).json(),
    onSuccess: () => { toast.success("Schedule copied"); queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] }); },
  });

  const handleCreateSubmit = (data: ShiftForm) => {
      if (createConflict) { toast.error("Scheduling Conflict", { description: createConflict.message }); return; }
      createShiftMutation.mutate(data);
  };

  const handleEditSubmit = (data: ShiftForm) => {
      if (editConflict) { toast.error("Scheduling Conflict", { description: editConflict.message }); return; }
      if (selectedSchedule) updateShiftMutation.mutate({ id: selectedSchedule.id, data });
  };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    const dateStr = new Date(schedule.date).toISOString().split('T')[0];
    const startStr = formatTimeForInput(schedule.startTime);
    const endStr = formatTimeForInput(schedule.endTime);

    editForm.reset({ 
        userId: schedule.userId, 
        date: dateStr, 
        shiftType: schedule.shiftType as any, 
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

  // Reusable Error Component
  const ErrorMsg = ({ error }: { error?: { message?: string } }) => {
    if (!error?.message) return null;
    return <p className="text-xs text-rose-500 mt-1">{error.message}</p>;
  };

  const TimeInput = ({ form, name, label, onChangeOverride }: any) => (
      <div className="space-y-1">
        <Label className="text-xs font-semibold">{label}</Label>
        <div className="relative">
            <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <Input 
                type="time" 
                className="bg-white h-9 border-slate-200 pl-9 font-mono text-sm" 
                {...form.register(name, {
                    onChange: (e) => {
                        if (onChangeOverride) onChangeOverride(e.target.value, form);
                    }
                })} 
            />
        </div>
        <ErrorMsg error={form.formState.errors[name]} />
      </div>
  );

  const Header = () => (
    <div className={styles.header.container}>
      <div>
        <h1 className={styles.header.title}>Shift Management</h1>
        <p className={styles.header.subtitle}>Assign and manage employee work schedules</p>
      </div>
      <div className={styles.header.actions}>
        <Button variant="outline" className={styles.header.btnCopy} onClick={() => copyWeekMutation.mutate()} disabled={copyWeekMutation.isPending}>
          <Copy className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Copy Previous Week</span><span className="sm:hidden">Copy Week</span>
        </Button>
        <Button 
            onClick={() => {
                createForm.reset({
                    shiftType: "morning",
                    shiftRole: "server",
                    startTime: SHIFT_PRESETS.morning.start,
                    endTime: SHIFT_PRESETS.morning.end,
                    date: getLocalYMD(new Date()) 
                });
                setIsCreateDialogOpen(true);
            }} 
            className={styles.header.btnCreate}
        >
          <Plus className="w-4 h-4 mr-2" /> Assign Shift
        </Button>
      </div>
    </div>
  );

  const Toolbar = () => (
    <div className={styles.toolbar.container}>
      <div className={styles.toolbar.leftGroup}>
        <Users className="w-4 h-4 text-slate-400 hidden lg:block" />
        <Popover open={openEmployeePicker} onOpenChange={setOpenEmployeePicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" role="combobox" aria-expanded={openEmployeePicker} className={styles.toolbar.employeePickerBtn}>
              {selectedEmployee === "all" ? "All Employees" : getEmployeeName(selectedEmployee)}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search employee..." />
              <CommandList>
                <CommandEmpty>No employee found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="all" onSelect={() => { setSelectedEmployee("all"); setOpenEmployeePicker(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", selectedEmployee === "all" ? "opacity-100" : "opacity-0")} /> All Employees
                  </CommandItem>
                  {teamMembers?.map((m) => (
                    <CommandItem key={m.id} value={`${m.firstName} ${m.lastName}`} onSelect={() => { setSelectedEmployee(m.id); setOpenEmployeePicker(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", selectedEmployee === m.id ? "opacity-100" : "opacity-0")} /> {m.firstName} {m.lastName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className={styles.toolbar.dateNav.container}>
        <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className={styles.toolbar.dateNav.btn}><ChevronLeft className="w-4 h-4" /></Button>
        <div className={styles.toolbar.dateNav.text}>
            <CalendarDays className="w-4 h-4 text-slate-400" />
            {view === 'kanban' ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'}) : 
             `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate('next')} className={styles.toolbar.dateNav.btn}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      <div className={styles.toolbar.rightGroup}>
        <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="w-full sm:w-auto">Today</Button>
        <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block" />
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full sm:w-auto">
          <TabsList className={styles.toolbar.tabsList}>
            <TabsTrigger value="kanban" className={styles.toolbar.tabTrigger}><LayoutPanelLeft className="w-3.5 h-3.5"/> Day</TabsTrigger>
            <TabsTrigger value="roster" className={styles.toolbar.tabTrigger}><Grid className="w-3.5 h-3.5"/> Roster</TabsTrigger>
            <TabsTrigger value="list" className={styles.toolbar.tabTrigger}><List className="w-3.5 h-3.5"/> List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const StatsBar = () => {
    const shifts = getSchedulesForDay(currentDate).filter(s => s.shiftType !== 'off');
    const counts = {
      total: shifts.length,
      morning: shifts.filter(s => s.shiftType === 'morning').length,
      afternoon: shifts.filter(s => s.shiftType === 'afternoon').length,
      night: shifts.filter(s => s.shiftType === 'night').length
    };

    const toggleFilter = (type: string | null) => setFilterType(prev => prev === type ? null : type);

    const StatCard = ({ type, count, icon: Icon, presetKey }: any) => {
        const preset = presetKey ? SHIFT_PRESETS[presetKey as keyof typeof SHIFT_PRESETS] : null;
        const isActive = presetKey ? filterType === presetKey : filterType === null;
        
        return (
            <div 
                onClick={() => toggleFilter(presetKey || null)}
                className={cn(
                    styles.stats.card,
                    preset ? `${preset.color} hover:border-current` : "hover:border-slate-400",
                    isActive && (preset ? preset.ring : "ring-slate-900") + " " + styles.stats.cardActive
                )}
            >
                <div>
                    <p className={cn(styles.stats.label, preset ? preset.title : "text-slate-400")}>{type}</p>
                    <p className={cn(styles.stats.count, preset ? preset.text : "text-slate-900")}>{count}</p>
                </div>
                <Icon className={cn("w-8 h-8", preset ? preset.icon : "text-slate-100")} />
            </div>
        );
    };

    return (
      <div className={styles.stats.grid}>
        <StatCard type="Total Staff" count={counts.total} icon={Users} />
        <StatCard type="Morning" count={counts.morning} icon={Sun} presetKey="morning" />
        <StatCard type="Afternoon" count={counts.afternoon} icon={Sunset} presetKey="afternoon" />
        <StatCard type="Night" count={counts.night} icon={Moon} presetKey="night" />
      </div>
    );
  };

  return (
    <div className={styles.page.wrapper}>
      <Header />
      <Toolbar />

      {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading schedule...</div>
      ) : (
          <>
            {/* --- VIEW: ROSTER --- */}
            {view === 'roster' && (
                <Card className={styles.roster.card}>
                    <div className={styles.roster.scrollArea}>
                        <div className={styles.roster.tableWrapper}>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(styles.roster.th, "w-[200px] bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky left-0 z-20")}>Employee</th>
                                        {getDaysOfWeek().map((day, i) => (
                                            <th key={i} className={cn(styles.roster.th, "text-center min-w-[140px]", isToday(day) && "bg-blue-50/50")}>
                                                <div className={cn("text-[10px] font-bold uppercase", isToday(day) ? "text-blue-600" : "text-slate-400")}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                                <div className={cn("text-lg font-bold", isToday(day) ? "text-blue-700" : "text-slate-700")}>{day.getDate()}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamMembers?.map((employee) => (
                                        <tr key={employee.id} className="group hover:bg-slate-50/30 transition-colors">
                                            <td className={styles.roster.tdUser}>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-slate-900">{employee.firstName} {employee.lastName}</span>
                                                    <span className="text-xs text-slate-500 capitalize">{employee.position || "Staff"}</span>
                                                </div>
                                            </td>
                                            {getDaysOfWeek().map((day, i) => {
                                                const shifts = getShiftsForEmployeeAndDate(employee.id, day);
                                                return (
                                                    <td key={i} className={cn(styles.roster.tdCell, isToday(day) && "bg-blue-50/10")}>
                                                        <div className="flex flex-col gap-2 h-full min-h-[60px]">
                                                            {shifts.map(shift => (
                                                              <RosterCard key={shift.id} schedule={shift} conflict={evaluateScheduleConflict(shift)} onEdit={handleEdit} onDelete={handleDelete} />
                                                            ))}
                                                            {shifts.length === 0 && (
                                                                <button 
                                                                    onClick={() => { 
                                                                        const pos = employee.position?.toLowerCase();
                                                                        const validRole = ROLES.includes(pos as any) ? pos : "server";
                                                                        
                                                                        createForm.reset({
                                                                            userId: employee.id, 
                                                                            date: getLocalYMD(day),
                                                                            shiftType: "morning",
                                                                            shiftRole: validRole as any,
                                                                            startTime: SHIFT_PRESETS.morning.start,
                                                                            endTime: SHIFT_PRESETS.morning.end
                                                                        });
                                                                        setIsCreateDialogOpen(true); 
                                                                    }} 
                                                                    className="flex-1 w-full h-full flex items-center justify-center rounded-lg border-2 border-dashed border-transparent hover:border-slate-300 text-slate-300 hover:text-slate-500 transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Plus className="w-5 h-5" />
                                                                </button>
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

            {/* --- VIEW: DAY KANBAN --- */}
            {view === 'kanban' && (
                <div className="space-y-6">
                    <StatsBar />
                    <div className={styles.kanban.grid}>
                        {ROLES.map(role => {
                            const roleShifts = getSchedulesForDay(currentDate)
                                .filter(s => {
                                  const roleMatch = s.shiftRole === role && s.shiftType !== 'off';
                                  const typeMatch = filterType ? s.shiftType === filterType : true; 
                                  return roleMatch && typeMatch;
                                })
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                            return (
                                <div key={role} className={styles.kanban.column}>
                                    <div className={styles.kanban.columnHeader}>
                                        <span className={styles.kanban.columnTitle}>{role}</span>
                                        <Badge variant="secondary" className="bg-white">{roleShifts.length}</Badge>
                                    </div>
                                    <div className={styles.kanban.cardList}>
                                        {roleShifts.length === 0 ? <div className="text-center py-8 text-slate-400 text-xs italic">No Staff</div> : 
                                            roleShifts.map(s => <KanbanCard key={s.id} schedule={s} conflict={evaluateScheduleConflict(s)} employeeName={getEmployeeName(s.userId)} onEdit={handleEdit} onDelete={handleDelete} />)
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
                <Card className={styles.roster.card}>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[600px]">
                      <thead className={styles.list.header}>
                        <tr>
                          <th className={styles.list.cell}>Date</th>
                          <th className={styles.list.cell}>Employee</th>
                          <th className={styles.list.cell}>Shift</th>
                          <th className={styles.list.cell}>Time</th>
                          <th className={styles.list.cell}>Status</th>
                          <th className={cn(styles.list.cell, "text-right")}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSchedules.map(s => {
                          const conflict = evaluateScheduleConflict(s);
                          return (
                            <tr key={s.id} className={styles.list.row}>
                              <td className={cn(styles.list.cell, "font-medium")}>{new Date(s.date).toLocaleDateString()}</td>
                              <td className={styles.list.cell}>{getEmployeeName(s.userId)}</td>
                              <td className={styles.list.cell}>
                                <Badge variant="outline" className={cn("capitalize", SHIFT_PRESETS[s.shiftType as keyof typeof SHIFT_PRESETS]?.color)}>
                                  {SHIFT_PRESETS[s.shiftType as keyof typeof SHIFT_PRESETS]?.label || s.shiftType}
                                </Badge>
                              </td>
                              <td className={cn(styles.list.cell, "text-slate-500 text-xs font-mono")}>
                                {s.shiftType !== 'off' ? `${new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(s.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'OFF'}
                              </td>
                              <td className={styles.list.cell}>
                                {conflict ? (
                                    <div className="flex items-center text-xs text-rose-500"><AlertTriangle className="w-3 h-3 mr-1"/> Conflict</div>
                                ) : (
                                    <div className="flex items-center text-xs text-emerald-500"><Check className="w-3 h-3 mr-1"/> Ok</div>
                                )}
                              </td>
                              <td className={cn(styles.list.cell, "text-right")}>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(s)}><Edit className="w-4 h-4" /></Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4" /></Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
            )}
          </>
      )}

      {/* --- Dialogs --- */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign New Shift</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            
            {createConflict && (
               <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-sm">
                   <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                   <div>
                       <p className="font-semibold">Scheduling Conflict Detected</p>
                       <p className="text-xs opacity-90">{createConflict.message}</p>
                   </div>
               </div>
            )}
            
            {createDurationWarning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Short Shift</p>
                        <p className="text-xs opacity-90">{createDurationWarning}</p>
                    </div>
                </div>
            )}

            <div className={styles.form.grid2}>
              <div className="space-y-2">
                <Label>Employee</Label>
                <Controller
                  control={createForm.control}
                  name="userId"
                  render={({ field }) => (
                    <Select 
                        value={field.value} 
                        onValueChange={(v) => {
                            field.onChange(v);
                            // Auto-detect role when employee changes
                            const emp = teamMembers?.find(m => m.id === v);
                            const pos = emp?.position?.toLowerCase();
                            if (pos && ROLES.includes(pos as any)) {
                                createForm.setValue("shiftRole", pos as any);
                            } else {
                                createForm.setValue("shiftRole", "server");
                            }
                        }}
                    >
                      <SelectTrigger className={styles.form.input}><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {teamMembers?.map(m => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                <ErrorMsg error={createForm.formState.errors.userId} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" className={styles.form.input} {...createForm.register("date")} />
                <ErrorMsg error={createForm.formState.errors.date} />
              </div>
            </div>
            <div className={styles.form.grid2}>
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Controller
                  control={createForm.control}
                  name="shiftType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(val) => handleShiftTypeChange(val, createForm)}>
                      <SelectTrigger className={styles.form.input}><SelectValue placeholder="Select Type..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SHIFT_PRESETS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                <ErrorMsg error={createForm.formState.errors.shiftType} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Controller
                  control={createForm.control}
                  name="shiftRole"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl capitalize"><SelectValue placeholder="Select Role..." /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                <ErrorMsg error={createForm.formState.errors.shiftRole} />
              </div>
            </div>
            <div className={cn(styles.form.grid2, styles.form.timeWrapper)}>
              <TimeInput form={createForm} name="startTime" label="Start Time" onChangeOverride={onStartTimeChange} />
              <TimeInput form={createForm} name="endTime" label="End Time" />
            </div>
            <div className="space-y-2"><Label>Location</Label><Input className={styles.form.input} placeholder="e.g. Main Hall" {...createForm.register("location")} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createShiftMutation.isPending || !!createConflict}>Create Shift</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Shift</DialogTitle></DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 mt-2">
                
                {editConflict && (
                   <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-sm">
                       <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                       <div>
                           <p className="font-semibold">Scheduling Conflict Detected</p>
                           <p className="text-xs opacity-90">{editConflict.message}</p>
                       </div>
                   </div>
                )}
                
                {editDurationWarning && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Short Shift</p>
                            <p className="text-xs opacity-90">{editDurationWarning}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Employee</Label>
                    <div className="flex items-center px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium">
                        <Users className="w-4 h-4 mr-2 opacity-50"/>
                        {selectedSchedule ? getEmployeeName(selectedSchedule.userId) : "Loading..."}
                    </div>
                </div>

                <div className={styles.form.grid2}>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" className={styles.form.input} {...editForm.register("date")} />
                      <ErrorMsg error={editForm.formState.errors.date} />
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Controller
                          control={editForm.control}
                          name="shiftRole"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="rounded-xl capitalize"><SelectValue placeholder="Select Role..."/></SelectTrigger>
                                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        />
                        <ErrorMsg error={editForm.formState.errors.shiftRole} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Shift Type</Label>
                    <Controller
                      control={editForm.control}
                      name="shiftType"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(val) => handleShiftTypeChange(val, editForm)}>
                            <SelectTrigger className={styles.form.input}><SelectValue placeholder="Select Type..."/></SelectTrigger>
                            <SelectContent>{Object.entries(SHIFT_PRESETS).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    />
                    <ErrorMsg error={editForm.formState.errors.shiftType} />
                </div>
                <div className={cn(styles.form.grid2, styles.form.timeWrapper)}>
                    <TimeInput form={editForm} name="startTime" label="Start Time" onChangeOverride={onStartTimeChange} />
                    <TimeInput form={editForm} name="endTime" label="End Time" />
                </div>
                <div className="space-y-2"><Label>Location</Label><Input {...editForm.register("location")} className={styles.form.input} /></div>
                
                <DialogFooter className="sm:justify-between items-center mt-6 border-t pt-4">
                    <Button 
                        type="button" 
                        variant="destructive" 
                        className="rounded-full w-full sm:w-auto mb-2 sm:mb-0" 
                        onClick={() => {
                            if (selectedSchedule) {
                                setIsDeleteDialogOpen(true);
                                setIsEditDialogOpen(false);
                            }
                        }}
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-full flex-1">Cancel</Button>
                        <Button type="submit" disabled={updateShiftMutation.isPending || !!editConflict} className="bg-slate-900 text-white rounded-full flex-1">Update</Button>
                    </div>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader><AlertDialogTitle>Delete Shift</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this shift? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => selectedSchedule && deleteShiftMutation.mutate(selectedSchedule.id)} className="bg-rose-600 hover:bg-rose-700 rounded-full">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Cards ---

function RosterCard({ schedule, conflict, onEdit, onDelete }: any) {
  const typeKey = schedule.shiftType?.toLowerCase() || 'morning';
  const style = SHIFT_PRESETS[typeKey as keyof typeof SHIFT_PRESETS] || SHIFT_PRESETS.morning;
  const label = schedule.shiftType || "Shift"; 

  if (typeKey === 'off') {
      return (
        <div onClick={() => onEdit(schedule)} className="rounded-md bg-slate-50 border border-slate-100 p-2 text-center cursor-pointer hover:bg-slate-100 relative">
            <span className="text-[10px] font-bold text-slate-300">OFF</span>
            {conflict && <AlertTriangle className="w-3 h-3 text-rose-500 absolute top-1 right-1" title={conflict.message} />}
        </div>
      );
  }

  return (
    <div onClick={() => onEdit(schedule)} className={cn("relative rounded-lg p-2 text-xs border shadow-sm cursor-pointer hover:scale-[1.02] transition-all group", style.color, conflict && "border-rose-400 ring-1 ring-rose-400 bg-rose-50")}>
      <div className="flex justify-between items-center mb-1 pr-3">
        <span className={cn("font-bold capitalize", conflict && "text-rose-700")}>{label}</span>
        <Badge variant="secondary" className={cn("h-4 px-1 text-[8px] bg-white/60 border-0 uppercase", conflict && "bg-rose-100 text-rose-700")}>{schedule.shiftRole}</Badge>
      </div>
      <div className={cn("font-mono text-[10px] opacity-90", conflict && "text-rose-600")}>
        {new Date(schedule.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
      </div>
      {conflict && <AlertTriangle className="w-3 h-3 text-rose-500 absolute top-1 right-1" title={conflict.message} />}
      {!conflict && (
        <button onClick={(e) => onDelete(schedule, e)} className="absolute top-1 right-1 p-1 rounded-full bg-white/40 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function KanbanCard({ schedule, conflict, employeeName, onEdit, onDelete }: any) {
  const typeKey = schedule.shiftType?.toLowerCase() || 'morning';
  const style = SHIFT_PRESETS[typeKey as keyof typeof SHIFT_PRESETS] || SHIFT_PRESETS.morning;

  return (
    <div onClick={() => onEdit(schedule)} className={cn("group relative bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer", conflict ? "border-rose-300" : "border-slate-100")}>
      <div className="flex justify-between items-start mb-1">
        <span className={cn("font-bold text-sm", conflict ? "text-rose-800" : "text-slate-800")}>{employeeName}</span>
        {!conflict && <div className={cn("w-2 h-2 rounded-full", style.indicator)} />}
        {conflict && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" title={conflict.message} />}
      </div>
      <div className="flex items-center text-xs text-slate-500 gap-1.5 mb-1">
        <Clock className="w-3 h-3" />
        {new Date(schedule.startTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})} - {new Date(schedule.endTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
      </div>
      <div className="flex items-center text-[10px] text-slate-400 gap-1.5">
        <MapPin className="w-3 h-3" /> {schedule.location || "Main Hall"}
      </div>
      {conflict && (
        <div className="mt-2 text-[10px] font-semibold text-rose-600 bg-rose-50 p-1.5 rounded">
            {conflict.message}
        </div>
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {!conflict && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={(e) => onDelete(schedule, e)}>
                <Trash2 className="w-3 h-3" />
            </Button>
        )}
      </div>
    </div>
  );
}