import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Calendar, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Briefcase,
  CalendarCheck,
  History,
  Filter,
  Moon,
  Flame
} from "lucide-react";
import { BentoCard } from "@/components/custom/bento-card";
import { useAuth } from "@/hooks/use-auth";

// Types matching the API response
interface AttendanceRecord {
  id: string;
  userId: string;
  date: number; 
  timeIn: number; 
  timeOut: number | null; 
  status: string; 
  totalBreakMinutes: number;
  totalWorkMinutes: number | null;
  notes: string | null;
}

export default function AdminAttendance() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedPeriod, setSelectedPeriod] = useState<"1" | "2">("1"); // "1" = 1st Half, "2" = 2nd Half
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const { startDate, endDate } = useMemo(() => {
    let start, end;
    if (selectedPeriod === "1") {
        start = new Date(year, month, 1);
        end = new Date(year, month, 15, 23, 59, 59);
    } else {
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 0, 23, 59, 59); // Last day of month
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [year, month, selectedPeriod]);

  const { data: teamMembers } = useQuery({ queryKey: ["/api/team"] });

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/all", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/attendance/all?${params}`);
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  // Calculate unique employees present in the current records to shorten the dropdown list
  const employeeOptions = useMemo(() => {
    if (!teamMembers || !records) return [];
    
    // Get distinct user IDs from the loaded records
    const activeUserIds = new Set(records.map(r => r.userId));
    
    // Filter team members to only those present in the records
    return teamMembers
        .filter((member: any) => activeUserIds.has(member.id))
        .sort((a: any, b: any) => a.firstName.localeCompare(b.firstName));
  }, [teamMembers, records]);

  const getEmployeeName = (id: string) => {
    const emp = teamMembers?.find((m: any) => m.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown User";
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => {
      setCurrentDate(new Date());
      setSelectedPeriod(new Date().getDate() <= 15 ? "1" : "2");
  };

  const formatTime = (ts: number) => format(new Date(ts), "h:mm a");
  const formatDate = (ts: number) => format(new Date(ts), "MMM d, yyyy");
  
  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Helper for Night Diff
  const getNightDiffHours = (timeIn: number, timeOut: number | null) => {
    if (!timeOut) return 0;
    let start = new Date(timeIn);
    let end = new Date(timeOut);
    let ndHours = 0;
    let current = new Date(start);
    current.setMinutes(0, 0, 0); 
    if (current.getTime() < start.getTime()) current.setHours(current.getHours() + 1);

    while (current.getTime() < end.getTime()) {
        const h = current.getHours();
        // Night Diff: 10PM (22) to 6AM (6)
        if (h >= 22 || h < 6) ndHours += 1;
        current.setHours(current.getHours() + 1);
    }
    return ndHours;
  };

  // Filter Logic
  const filteredRecords = records?.filter(r => {
    if (selectedEmployeeId !== "all" && r.userId !== selectedEmployeeId) return false;
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = getEmployeeName(r.userId).toLowerCase();
    const dateStr = formatDate(r.date).toLowerCase();
    return name.includes(searchLower) || dateStr.includes(searchLower);
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []; 

  // Stats Calculation
  const stats = filteredRecords.reduce((acc, curr) => {
    const workMinutes = curr.totalWorkMinutes || 0;
    acc.totalMinutes += workMinutes;

    // Overtime: Hours exceeding 8 hours (480 mins)
    if (workMinutes > 480) {
        acc.otMinutes += (workMinutes - 480);
    }

    // Night Differential
    if (curr.timeOut) {
        acc.ndHours += getNightDiffHours(curr.timeIn, curr.timeOut);
    }

    return acc;
  }, { totalMinutes: 0, otMinutes: 0, ndHours: 0 });

  const totalWorkHours = stats.totalMinutes / 60;
  const totalOTHours = stats.otMinutes / 60;
  const avgHours = filteredRecords.length > 0 ? (totalWorkHours / filteredRecords.length) : 0;
  const presentCount = new Set(filteredRecords.map(r => r.userId + r.date)).size;

  if (user?.role === 'employee') {
    return <div className="p-6 text-center">Access Denied</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employee Attendance</h1>
           <p className="text-slate-500 mt-1 text-sm">
             Monitor workforce attendance logs.
           </p>
        </div>
        
        {/* Date & Period Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
             {/* Period Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm px-1 h-10">
                 <button 
                    onClick={() => setSelectedPeriod("1")}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${selectedPeriod === "1" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                 >
                    1st Half (1-15)
                 </button>
                 <div className="w-px h-4 bg-slate-200 mx-1"></div>
                 <button 
                    onClick={() => setSelectedPeriod("2")}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${selectedPeriod === "2" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                 >
                    2nd Half (16-End)
                 </button>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1 rounded-full shadow-sm h-10">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full h-8 w-8 hover:bg-slate-100 text-slate-500">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-4 min-w-[140px] justify-center font-semibold text-slate-700 text-sm">
                <Calendar className="h-4 w-4 text-slate-400" />
                {format(currentDate, "MMMM yyyy")}
              </div>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full h-8 w-8 hover:bg-slate-100 text-slate-500">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
         <BentoCard 
            title="Total Hours" 
            value={`${totalWorkHours.toFixed(1)}h`} 
            icon={Briefcase} 
            variant="default"
            testIdPrefix="stat-hours"
         />
         <BentoCard 
            title="Overtime" 
            value={`${totalOTHours.toFixed(1)}h`} 
            icon={Flame} 
            variant="rose"
            testIdPrefix="stat-ot"
         />
         <BentoCard 
            title="Night Diff" 
            value={`${stats.ndHours.toFixed(1)}h`} 
            icon={Moon} 
            variant="indigo"
            testIdPrefix="stat-nd"
         />
         <BentoCard 
            title="Avg / Shift" 
            value={`${avgHours.toFixed(1)}h`} 
            icon={Clock} 
            variant="emerald"
            testIdPrefix="stat-avg"
         />
         <BentoCard 
            title="Days Present" 
            value={presentCount} 
            icon={CalendarCheck} 
            variant="amber"
            testIdPrefix="stat-days"
         />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-4">
        {/* Employee Dropdown */}
        <div className="w-full lg:w-64">
             <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="h-11 rounded-xl bg-white/60 backdrop-blur-sm border-slate-200/60">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Filter className="w-4 h-4" />
                        <SelectValue placeholder="Filter Employee" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employeeOptions.map((member: any) => (
                        <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                        </SelectItem>
                    ))}
                </SelectContent>
             </Select>
        </div>

        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search records..."
            className="pl-10 h-11 rounded-xl bg-white/60 backdrop-blur-sm border-slate-200/60 focus:bg-white focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
            variant="outline" 
            onClick={resetToToday} 
            className="rounded-xl border-slate-200/60 bg-white/60 backdrop-blur-sm hover:bg-white w-full sm:w-auto h-11"
        >
            Jump to Today
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="bg-white/40 backdrop-blur-md border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/50 border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Employee</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Time In</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Time Out</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Break</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">OT</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">ND</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Duration</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p>Loading logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center">
                             <Calendar className="h-6 w-6 text-slate-400" />
                          </div>
                          <p>No attendance records found for this period.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    // Calculate per-row stats
                    const otHours = Math.max(0, ((record.totalWorkMinutes || 0) - 480) / 60);
                    const ndHours = getNightDiffHours(record.timeIn, record.timeOut);

                    return (
                      <tr key={record.id} className="hover:bg-white/60 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                          {getEmployeeName(record.userId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                          {formatTime(record.timeIn)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                          {record.timeOut ? formatTime(record.timeOut) : <span className="text-slate-400 italic">--</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {formatDuration(record.totalBreakMinutes)}
                        </td>
                        {/* OT Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-xs">
                           {otHours > 0 ? (
                             <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                               {otHours.toFixed(1)}h
                             </span>
                           ) : <span className="text-slate-300">-</span>}
                        </td>
                        {/* ND Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-xs">
                           {ndHours > 0 ? (
                             <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                               {ndHours.toFixed(1)}h
                             </span>
                           ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                          {record.totalWorkMinutes !== null ? formatDuration(record.totalWorkMinutes) : <span className="text-slate-400 italic">--</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border
                              ${record.status === 'clocked_in' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                record.status === 'on_break' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                record.status === 'clocked_out' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                                'bg-rose-50 text-rose-700 border-rose-100'}`}>
                             {record.status.replace('_', ' ')}
                            </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}