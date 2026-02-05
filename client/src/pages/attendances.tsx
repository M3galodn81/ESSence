import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Calendar, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Briefcase,
  CalendarCheck,
  History
} from "lucide-react";
import { BentoCard } from "@/components/custom/bento-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function AttendanceHistory() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>("all"); // New State

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  // Reset week filter when month changes
  const handleMonthChange = (newDate: Date) => {
    setCurrentDate(newDate);
    setSelectedWeek("all");
  };

  // Generate Weeks for the current month
  const weeksInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start, end });

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart);
      return {
        label: `Week ${index + 1}`,
        subLabel: `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
        id: index.toString(),
        start: weekStart,
        end: weekEnd
      };
    });
  }, [currentDate]);

  // Updated Filter Logic
 const filteredRecords = records?.filter(r => {
    const recordDate = new Date(r.date);
    
    // Week Filter Only
    if (selectedWeek !== "all") {
      const week = weeksInMonth[parseInt(selectedWeek)];
      const isInWeek = isWithinInterval(recordDate, { start: week.start, end: week.end });
      if (!isInWeek) return false;
    }

    return true;
  }).sort((a, b) => b.date - a.date) || [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => setCurrentDate(new Date());

  const formatTime = (ts: number) => format(new Date(ts), "h:mm a");
  const formatDate = (ts: number) => format(new Date(ts), "MMM d, yyyy");
  const formatDay = (ts: number) => format(new Date(ts), "EEEE");
  
  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const totalWorkHours = filteredRecords.reduce((acc, curr) => acc + (curr.totalWorkMinutes || 0), 0) / 60;
  const daysPresent = filteredRecords.length;

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header Section with Month Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Logs</h1>
           <p className="text-slate-500 mt-1 text-sm">
             Track your daily time-in, time-out, and break durations.
           </p>
        </div>
        
        {/* Glass Month Navigator */}
        <div className="flex items-center bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1 rounded-full shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 min-w-[160px] justify-center font-semibold text-slate-700 text-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            {format(currentDate, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full hover:bg-slate-100 text-slate-500">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <BentoCard 
            title="Days Present" 
            value={daysPresent} 
            icon={CalendarCheck} 
            variant="default" // Blue-ish default
            testIdPrefix="stat-days"
         />
         <BentoCard 
            title="Total Hours" 
            value={`${totalWorkHours.toFixed(1)} hrs`} 
            icon={Briefcase} 
            variant="emerald"
            testIdPrefix="stat-hours"
         />
         <BentoCard 
            title="Status" 
            value={currentDate.getMonth() === new Date().getMonth() ? 'Active' : 'Historical'} 
            icon={History} 
            variant="amber"
            testIdPrefix="stat-status"
         />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md border border-slate-200/60 rounded-2xl w-fit">
          <button
            onClick={() => setSelectedWeek("all")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              selectedWeek === "all" 
                ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            All Month
          </button>
          
          <div className="w-px h-6 bg-slate-300/50 mx-1 hidden sm:block" />

          {weeksInMonth.map((week) => (
            <button
              key={week.id}
              onClick={() => setSelectedWeek(week.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium flex flex-col items-center transition-all",
                selectedWeek === week.id 
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <span>{week.label}</span>
              <span className="text-[10px] opacity-60 font-normal leading-none mt-0.5">
                {week.subLabel}
              </span>
            </button>
          ))}
        </div>

        <Button 
            variant="outline" 
            onClick={() => handleMonthChange(new Date())} 
            className="rounded-2xl border-slate-200/60 bg-white/60 backdrop-blur-sm hover:bg-white h-full py-6 lg:py-2"
        >
            <Clock className="w-4 h-4 mr-2 text-slate-500" />
            Jump to Today
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/50 border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Time In</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Time Out</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Break</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Work Duration</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                         <Loader2 className="h-6 w-6 animate-spin text-primary" />
                         <p>Loading records...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                         <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center">
                             <Calendar className="h-6 w-6 text-slate-400" />
                         </div>
                         <p>No attendance records found for this period.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-white/60 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{formatDate(record.date)}</div>
                        <div className="text-xs text-slate-500">{formatDay(record.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border
                           ${record.status === 'clocked_in' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                             record.status === 'on_break' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                             record.status === 'clocked_out' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                             'bg-rose-50 text-rose-700 border-rose-100'}`}>
                           {record.status.replace('_', ' ')}
                         </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-base">
                        {formatTime(record.timeIn)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-base">
                        {record.timeOut ? formatTime(record.timeOut) : <span className="text-slate-400 italic">--</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {formatDuration(record.totalBreakMinutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                        {record.totalWorkMinutes !== null ? formatDuration(record.totalWorkMinutes) : <span className="text-slate-400 italic">In Progress</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 max-w-[200px] truncate text-xs" title={record.notes || ""}>
                        {record.notes || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}