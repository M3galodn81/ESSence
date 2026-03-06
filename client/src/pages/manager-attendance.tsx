import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ChevronsUpDown, Clock, Coffee, LogOut, Play, Shield, TimerReset, UserCheck, History, Filter, ArrowUpDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { User as UserType } from "@shared/schema";

// ==========================================
// 1. SEPARATED RESPONSIVE STYLES
// ==========================================
const styles = {
  pageWrapper: "p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 pb-24",
  headerBox: "space-y-1",
  title: "text-2xl md:text-3xl font-bold tracking-tight text-slate-900",
  subtitle: "text-sm md:text-base text-slate-500",
  
  // Combobox
  comboboxCard: "bg-white border-slate-200 shadow-sm rounded-2xl overflow-visible",
  comboboxTrigger: "w-full md:w-[350px] justify-between h-12 md:h-14 bg-slate-50 hover:bg-slate-100 border-slate-200 shadow-sm text-sm md:text-base",
  commandItem: "flex items-center gap-3 p-2 cursor-pointer",
  avatarBox: "h-8 w-8 rounded-full border border-slate-200 shrink-0",
  avatarFallback: "bg-slate-200 text-slate-600 text-xs font-bold",
  
  // Action Card
  actionCard: "bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-2xl md:rounded-3xl overflow-hidden",
  actionHeader: "bg-slate-50/50 border-b border-slate-100 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4",
  employeeDetails: "flex items-center gap-3 md:gap-4 w-full min-w-0",
  employeeAvatar: "w-12 h-12 md:w-16 md:h-16 border-2 border-white shadow-sm shrink-0",
  
  statusConfig: {
    clocked_in: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Clocked In", pulse: "bg-emerald-500" },
    on_break: { badge: "bg-amber-100 text-amber-700 border-amber-200", label: "On Break", pulse: "bg-amber-500" },
    clocked_out: { badge: "bg-slate-100 text-slate-600 border-slate-200", label: "Clocked Out", pulse: "bg-slate-400" },
    none: { badge: "bg-slate-100 text-slate-400 border-slate-200", label: "Not Clocked In", pulse: "bg-slate-300" }
  },

  // Buttons
  btnGrid: "grid grid-cols-2 gap-2 md:gap-4 mt-4 md:mt-6",
  btnBase: "h-20 md:h-24 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-1 md:gap-2 transition-all active:scale-95 shadow-sm border p-2 overflow-hidden",
  btnLabel: "font-bold tracking-tight text-[10px] md:text-xs text-center leading-tight whitespace-normal break-words max-w-full",
  btnIcon: "w-5 h-5 md:w-7 md:h-7 shrink-0",
  btnClockIn: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700",
  btnClockOut: "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700",
  btnBreakStart: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700",
  btnBreakEnd: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700",
  btnDisabled: "opacity-50 pointer-events-none grayscale",

  // Global Log Feed
  logCard: "bg-white border-slate-200 shadow-sm rounded-2xl md:rounded-3xl overflow-hidden mt-8 flex flex-col",
  logHeader: "bg-slate-50/80 border-b border-slate-100 p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
  logToolbar: "flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 p-4 border-b border-slate-100 bg-white",
  logTableHead: "bg-slate-50/50 border-b border-slate-100",
  logTableRow: "hover:bg-slate-50/50 transition-colors border-slate-100",
};

// Safe Date Parser
const safeFormatDate = (dateVal: any, formatString: string) => {
  if (!dateVal) return "N/A";
  try {
    const dateObj = new Date(Number(dateVal) || dateVal);
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    return format(dateObj, formatString);
  } catch (error) {
    return "Invalid Date";
  }
};

// ==========================================
// 2. MAIN COMPONENT
// ==========================================
export default function ManagerAttendance() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, action: string, title: string, desc: string }>({
    isOpen: false, action: "", title: "", desc: ""
  });

  const canManage = hasPermission(Permission.MANAGE_ATTENDANCE);

  // Queries
  const { data: teamMembers } = useQuery<UserType[]>({
    queryKey: ["/api/team"],
    enabled: canManage,
  });

  const { data: attendanceStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/attendance/user-today", selectedUserId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/attendance/user-today/${selectedUserId}`);
      return res.json();
    },
    enabled: !!selectedUserId && canManage,
  });

  // Fetch ALL activities for the Global Feed
  const { data: allActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities/all", "attendance-feed"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/activities/all?limit=2000");
        return await res.json();
      } catch (e) {
        return [];
      }
    },
    enabled: canManage,
    refetchInterval: 10000, 
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: async (actionPath: string) => {
      const res = await apiRequest("POST", `/api/attendance/${actionPath}`, { userId: selectedUserId });
      return res.json();
    },
    onSuccess: (_, actionPath) => {
      toast.success(`Successfully recorded: ${actionPath.replace('-', ' ')}`);
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/user-today", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all", "attendance-feed"] });
      setConfirmDialog({ ...confirmDialog, isOpen: false });
    },
    onError: (err: Error) => {
      toast.error("Action Failed", { description: err.message });
      setConfirmDialog({ ...confirmDialog, isOpen: false });
    }
  });

  // Filter ONLY employees for the select dropdowns
  const employeeList = useMemo(() => {
    if (!teamMembers) return [];
    return [...teamMembers]
      .filter(u => u.role === 'employee') 
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [teamMembers]);

  const selectedUser = employeeList.find(u => u.id === selectedUserId);
  const getInitials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  
  const handleActionClick = (action: string, title: string, desc: string) => {
    setConfirmDialog({ isOpen: true, action, title, desc });
  };

  const confirmAction = () => {
    actionMutation.mutate(confirmDialog.action);
  };

  if (!canManage) {
    return (
      <div className="flex justify-center items-center h-[80vh] p-4">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
                <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
            <p className="text-slate-500">You must be a Manager or Admin to manually control employee time logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* Header */}
      <div className={styles.headerBox}>
        <h1 className={styles.title}>Manual Attendance</h1>
        <p className={styles.subtitle}>Select an employee to manually override their clock-in or break status.</p>
      </div>

      {/* SINGLE COLUMN LAYOUT */}
      <div className="flex flex-col space-y-6 lg:space-y-8">
        
        {/* CONTROLS SECTION */}
        <div className="space-y-6">
          {/* Employee Selector */}
          <Card className={styles.comboboxCard}>
            <CardContent className="p-4 md:p-6">
              <p className="block mb-2 text-slate-700 font-semibold text-sm">Select Employee</p>
              <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className={styles.comboboxTrigger}>
                    <span className="truncate pr-2">
                      {selectedUser ? `${selectedUser.lastName}, ${selectedUser.firstName}` : "Search employee..."}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] md:w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name..." />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employeeList.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.lastName}, ${member.firstName}`}
                            onSelect={() => {
                              setSelectedUserId(member.id);
                              setIsComboboxOpen(false);
                            }}
                            className={styles.commandItem}
                          >
                            <Check className={cn("h-4 w-4 shrink-0", selectedUserId === member.id ? "opacity-100 text-blue-600" : "opacity-0")} />
                            <Avatar className={styles.avatarBox}>
                              <AvatarImage src={member.profilePicture || ""} />
                              <AvatarFallback className={styles.avatarFallback}>{getInitials(member.firstName, member.lastName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm text-slate-800 truncate">{member.lastName}, {member.firstName}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{member.position || "Staff"}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Action Interface */}
          {selectedUser && (
            <Card className={styles.actionCard}>
              {statusLoading ? (
                <div className="p-12 flex flex-col items-center text-slate-400">
                  <TimerReset className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm">Loading current status...</p>
                </div>
              ) : (
                <ActionInterface 
                  user={selectedUser} 
                  statusData={attendanceStatus} 
                  onAction={handleActionClick} 
                  isPending={actionMutation.isPending}
                />
              )}
            </Card>
          )}
        </div>

        {/* GLOBAL FEED SECTION */}
        <div className="min-w-0">
          <GlobalAttendanceLog 
             activities={allActivities} 
             allUsers={teamMembers} // Pass ALL users here to resolve Manager IDs
             employeeList={employeeList} // Pass ONLY employees here for the filter dropdown
             isLoading={activitiesLoading || !teamMembers} 
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(val) => !val && setConfirmDialog({...confirmDialog, isOpen: false})}>
        <AlertDialogContent className="rounded-2xl w-[90vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel className="rounded-full m-0 w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={actionMutation.isPending} className="rounded-full bg-slate-900 hover:bg-slate-800 m-0 w-full sm:w-auto">
              {actionMutation.isPending ? "Processing..." : "Confirm Action"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ==========================================
// 3. ACTION INTERFACE (Manual Overrides)
// ==========================================
function ActionInterface({ user, statusData, onAction, isPending }: any) {
  const currentAttendance = statusData?.attendance;

  let currentState: keyof typeof styles.statusConfig = "none";
  if (currentAttendance) {
    if (currentAttendance.status === "clocked_in") currentState = "clocked_in";
    if (currentAttendance.status === "on_break") currentState = "on_break";
    if (currentAttendance.timeOut) currentState = "clocked_out"; 
  }

  const conf = styles.statusConfig[currentState];

  const canClockIn = currentState === "none" || currentState === "clocked_out";
  const canClockOut = currentState === "clocked_in";
  const canStartBreak = currentState === "clocked_in";
  const canEndBreak = currentState === "on_break";

  return (
    <>
      <div className={styles.actionHeader}>
        <div className={styles.employeeDetails}>
          <Avatar className={styles.employeeAvatar}>
            <AvatarFallback className="bg-blue-100 text-blue-700 text-lg md:text-xl font-bold">
              {user.firstName[0]}{user.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-xl font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</h2>
            <p className="text-slate-500 text-xs md:text-sm flex items-center gap-1.5 mt-0.5 truncate">
              <UserCheck className="w-3 h-3 md:w-4 md:h-4 shrink-0"/> ID: {user.employeeId || "N/A"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-sm border border-slate-100 shrink-0 self-start md:self-auto max-w-full">
           <div className={cn("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animate-pulse shrink-0", conf.pulse)} />
           <span className="font-semibold text-slate-700 text-xs md:text-sm truncate">{conf.label}</span>
        </div>
      </div>

      <CardContent className="p-4 md:p-6">
        <h3 className="font-semibold text-slate-800 mb-1">Available Actions</h3>
        <p className="text-xs md:text-sm text-slate-500 mb-4">You are manually overriding the time logs for this employee.</p>
        
        <div className={styles.btnGrid}>
          <button 
            disabled={!canClockIn || isPending}
            onClick={() => onAction("clock-in", "Force Clock In", `Are you sure you want to manually clock in ${user.firstName}?`)}
            className={cn(styles.btnBase, styles.btnClockIn, (!canClockIn || isPending) && styles.btnDisabled)}
          >
            <Play className={styles.btnIcon} />
            <span className={styles.btnLabel}>CLOCK IN</span>
          </button>

          <button 
            disabled={!canClockOut || isPending}
            onClick={() => onAction("clock-out", "Force Clock Out", `Are you sure you want to manually clock out ${user.firstName}?`)}
            className={cn(styles.btnBase, styles.btnClockOut, (!canClockOut || isPending) && styles.btnDisabled)}
          >
            <LogOut className={styles.btnIcon} />
            <span className={styles.btnLabel}>CLOCK OUT</span>
          </button>

          <button 
            disabled={!canStartBreak || isPending}
            onClick={() => onAction("break-start", "Force Start Break", `Are you sure you want to put ${user.firstName} on break?`)}
            className={cn(styles.btnBase, styles.btnBreakStart, (!canStartBreak || isPending) && styles.btnDisabled)}
          >
            <Coffee className={styles.btnIcon} />
            <span className={styles.btnLabel}>START BREAK</span>
          </button>

          <button 
            disabled={!canEndBreak || isPending}
            onClick={() => onAction("break-end", "Force End Break", `Are you sure you want to end ${user.firstName}'s break?`)}
            className={cn(styles.btnBase, styles.btnBreakEnd, (!canEndBreak || isPending) && styles.btnDisabled)}
          >
            <TimerReset className={styles.btnIcon} />
            <span className={styles.btnLabel}>END BREAK</span>
          </button>
        </div>
      </CardContent>
    </>
  );
}

// ==========================================
// 4. GLOBAL LOG FEED COMPONENT
// ==========================================
function GlobalAttendanceLog({ activities, allUsers, employeeList, isLoading }: any) {
  
  const [dateFilter, setDateFilter] = useState(() => {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Build userMap from ALL users (so managers can be resolved)
  const userMap = useMemo(() => {
    if (!allUsers) return new Map();
    return allUsers.reduce((map: any, u: any) => { map.set(u.id, u); return map; }, new Map());
  }, [allUsers]);

  // Helper to replace raw IDs in the details text with actual names
  const formatLogDetails = (details: string) => {
    if (!details) return "No details provided.";
    // Regex finds "ID: <uuid>" and grabs the uuid
    return details.replace(/ID:\s*([a-zA-Z0-9-]+)/g, (match, id) => {
       const u = userMap.get(id.trim());
       return u ? `${u.firstName} ${u.lastName}` : match;
    });
  };

  const filteredLogs = useMemo(() => {
    if (!activities) return [];

    let logs = activities.filter((a: any) => 
        ['clock_in', 'clock_out', 'break_start', 'break_end'].includes(a.type)
    );

    if (dateFilter) {
        logs = logs.filter((a: any) => {
            const logDate = new Date(a.timestamp || a.createdAt);
            const localDateStr = new Date(logDate.getTime() - logDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            return localDateStr === dateFilter;
        });
    }

    if (employeeFilter !== "all") {
        logs = logs.filter((a: any) => a.userId === employeeFilter);
    }

    if (statusFilter !== "all") {
        logs = logs.filter((a: any) => a.type === statusFilter);
    }

    logs.sort((a: any, b: any) => {
        const tA = new Date(a.timestamp || a.createdAt).getTime();
        const tB = new Date(b.timestamp || b.createdAt).getTime();
        return sortOrder === "asc" ? tA - tB : tB - tA;
    });

    return logs;
  }, [activities, dateFilter, employeeFilter, statusFilter, sortOrder]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const getActionBadge = (type: string) => {
    if (type === 'clock_in') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Start Shift</Badge>;
    if (type === 'clock_out') return <Badge className="bg-rose-100 text-rose-700 border-rose-200">End Shift</Badge>;
    if (type === 'break_start') return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Start Break</Badge>;
    if (type === 'break_end') return <Badge className="bg-blue-100 text-blue-700 border-blue-200">End Break</Badge>;
    return null;
  };

  const getInitials = (first?: string, last?: string) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase() || '??';

  return (
    <Card className={styles.logCard}>
      <CardHeader className={styles.logHeader}>
        <div>
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <History className="w-5 h-5 text-slate-400"/> Organization Log Feed
          </CardTitle>
          <CardDescription className="mt-1">Chronological history of all time-clock actions.</CardDescription>
        </div>
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
            className="w-full sm:w-auto rounded-xl h-10 sm:h-9 bg-white border-slate-200 text-slate-600 shadow-sm mt-2 sm:mt-0 shrink-0"
        >
            <ArrowUpDown className="w-3.5 h-3.5 mr-2" />
            {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
        </Button>
      </CardHeader>
      
      <div className={styles.logToolbar}>
         <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 w-full sm:w-auto shrink-0">
             <Filter className="w-4 h-4"/> Filters:
         </div>
         <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto flex-1">
             <Input 
                 type="date" 
                 value={dateFilter} 
                 onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }} 
                 className="w-full sm:w-[150px] h-10 rounded-xl bg-slate-50 border-slate-200 text-sm"
             />
             
             <Select value={employeeFilter} onValueChange={(v) => { setEmployeeFilter(v); setCurrentPage(1); }}>
                 <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl bg-slate-50 border-slate-200 text-sm truncate">
                     <SelectValue placeholder="All Employees" />
                 </SelectTrigger>
                 <SelectContent>
                     <SelectItem value="all">All Employees</SelectItem>
                     {/* Map over the filtered employeeList, not allUsers */}
                     {employeeList?.map((u: any) => (
                         <SelectItem key={u.id} value={u.id}>{u.lastName}, {u.firstName}</SelectItem>
                     ))}
                 </SelectContent>
             </Select>

             <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                 <SelectTrigger className="col-span-2 sm:col-span-1 w-full sm:w-[160px] h-10 rounded-xl bg-slate-50 border-slate-200 text-sm">
                     <SelectValue placeholder="All Statuses" />
                 </SelectTrigger>
                 <SelectContent>
                     <SelectItem value="all">All Statuses</SelectItem>
                     <SelectItem value="clock_in">Start Shift</SelectItem>
                     <SelectItem value="clock_out">End Shift</SelectItem>
                     <SelectItem value="break_start">Start Break</SelectItem>
                     <SelectItem value="break_end">End Break</SelectItem>
                 </SelectContent>
             </Select>
         </div>
         
         {(dateFilter !== new Date().toISOString().split('T')[0] || employeeFilter !== 'all' || statusFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-10 sm:h-9 w-full sm:w-auto px-4 rounded-xl mt-2 sm:mt-0 shrink-0"
              onClick={() => {
                setDateFilter(new Date().toISOString().split('T')[0]);
                setEmployeeFilter("all");
                setStatusFilter("all");
                setCurrentPage(1);
              }}
            >
              Reset
            </Button>
         )}
      </div>

      <div className="overflow-x-auto w-full">
         <Table className="min-w-[600px] w-full">
            <TableHeader className={styles.logTableHead}>
               <TableRow>
                  <TableHead className="w-[140px] font-semibold text-slate-600 pl-4 md:pl-6">Time</TableHead>
                  <TableHead className="w-[200px] font-semibold text-slate-600">Employee</TableHead>
                  <TableHead className="font-semibold text-slate-600">Event Details</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading ? (
                  <TableRow>
                     <TableCell colSpan={3} className="h-32 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading feed...
                     </TableCell>
                  </TableRow>
               ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={3} className="h-32 text-center text-slate-400">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-20" /> No logs found for this filter.
                     </TableCell>
                  </TableRow>
               ) : (
                  paginatedLogs.map((log: any) => {
                     const u = userMap.get(log.userId);
                     return (
                        <TableRow key={log.id} className={styles.logTableRow}>
                           {/* 1. Time */}
                           <TableCell className="align-top py-3 font-mono text-sm text-slate-600 whitespace-nowrap pl-4 md:pl-6">
                              {safeFormatDate(log.timestamp || log.createdAt, "hh:mm:ss a")}
                           </TableCell>
                           
                           {/* 2. Employee */}
                           <TableCell className="align-top py-3">
                              <div className="flex items-center gap-3">
                                 <Avatar className="h-8 w-8 rounded-full border border-slate-200 shrink-0">
                                    <AvatarImage src={u?.profilePicture || ""} />
                                    <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">
                                       {getInitials(u?.firstName, u?.lastName)}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-sm text-slate-900 leading-tight truncate">
                                       {u ? `${u.firstName} ${u.lastName}` : "Unknown"}
                                    </span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                                       {u?.position || "Staff"}
                                    </span>
                                 </div>
                              </div>
                           </TableCell>

                           {/* 3. Details (Merged Action + Parsed Name Note) */}
                           <TableCell className="align-top py-3 pr-4 md:pr-6">
                              <div className="flex flex-col items-start gap-1.5">
                                 {getActionBadge(log.type)}
                                 <span className="text-sm font-medium text-slate-700 whitespace-normal break-words max-w-[200px] sm:max-w-xs md:max-w-md">
                                    {formatLogDetails(log.details)}
                                 </span>
                              </div>
                           </TableCell>
                        </TableRow>
                     );
                  })
               )}
            </TableBody>
         </Table>
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
         <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50 mt-auto">
            <p className="text-xs text-slate-500 font-medium text-center sm:text-left">
               Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
               <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
               </Button>
               <span className="text-xs font-medium px-3 text-slate-700">Page {currentPage} of {totalPages || 1}</span>
               <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                  <ChevronRight className="w-4 h-4" />
               </Button>
            </div>
         </div>
      )}
    </Card>
  );
}