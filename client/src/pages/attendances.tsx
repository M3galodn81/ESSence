import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Calendar, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Briefcase
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types matching the API response
interface AttendanceRecord {
  id: string;
  userId: string;
  date: number; // timestamp
  timeIn: number; // timestamp
  timeOut: number | null; // timestamp
  status: string; // 'clocked_in' | 'clocked_out' | 'on_break'
  totalBreakMinutes: number;
  totalWorkMinutes: number | null;
  notes: string | null;
}

export default function AttendanceHistory() {
  // State for Date Filtering
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate start/end of the selected month for the API
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Construct ISO strings for the API query
  // Note: We use local time construction to ensure we get the full day range relevant to the user
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  // Fetch Data
  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  // Navigation Handlers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => setCurrentDate(new Date());

  // Helper Formatters
  const formatTime = (ts: number) => format(new Date(ts), "h:mm a");
  const formatDate = (ts: number) => format(new Date(ts), "MMM d, yyyy");
  const formatDay = (ts: number) => format(new Date(ts), "EEEE");
  
  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Filter Logic
  const filteredRecords = records?.filter(r => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const dateStr = formatDate(r.date).toLowerCase();
    const notesStr = (r.notes || "").toLowerCase();
    return dateStr.includes(searchLower) || notesStr.includes(searchLower);
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []; // Sort newest first

  // Summary Stats for the Table Header
  const totalWorkHours = filteredRecords.reduce((acc, curr) => acc + (curr.totalWorkMinutes || 0), 0) / 60;
  const daysPresent = filteredRecords.length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Attendance History</h1>
           <p className="text-muted-foreground mt-1">
             View and track your work hours and breaks.
           </p>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium">
            <Calendar className="h-4 w-4 text-gray-500" />
            {format(currentDate, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
         <Card>
            <CardContent className="pt-6 flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Days Present</p>
                 <h2 className="text-2xl font-bold">{daysPresent}</h2>
               </div>
               <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                 <Calendar className="h-5 w-5" />
               </div>
            </CardContent>
         </Card>
         <Card>
            <CardContent className="pt-6 flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Total Work Hours</p>
                 <h2 className="text-2xl font-bold">{totalWorkHours.toFixed(1)} hrs</h2>
               </div>
               <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                 <Briefcase className="h-5 w-5" />
               </div>
            </CardContent>
         </Card>
         <Card>
            <CardContent className="pt-6 flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                 <h2 className="text-lg font-bold truncate">
                    {currentDate.getMonth() === new Date().getMonth() ? 'Active Period' : 'Historical'}
                 </h2>
               </div>
               <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                 <Clock className="h-5 w-5" />
               </div>
            </CardContent>
         </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dates or notes..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={resetToToday} className="ml-auto">
          Today
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Date</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Time In</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Time Out</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Break</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs text-right">Work Duration</th>
                <th className="px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <Loader2 className="h-6 w-6 animate-spin text-primary" />
                       <p>Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <Calendar className="h-8 w-8 text-gray-300" />
                       <p>No attendance records found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{formatDate(record.date)}</div>
                      <div className="text-xs text-gray-500">{formatDay(record.date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                         ${record.status === 'clocked_in' ? 'bg-green-100 text-green-800' : 
                           record.status === 'on_break' ? 'bg-orange-100 text-orange-800' : 
                           record.status === 'clocked_out' ? 'bg-gray-100 text-gray-800' : 
                           'bg-red-100 text-red-800'}`}>
                         {record.status.replace('_', ' ')}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatTime(record.timeIn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {record.timeOut ? formatTime(record.timeOut) : <span className="text-gray-400 italic">--</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatDuration(record.totalBreakMinutes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                      {record.totalWorkMinutes !== null ? formatDuration(record.totalWorkMinutes) : <span className="text-gray-400 italic">In Progress</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 max-w-[200px] truncate" title={record.notes || ""}>
                      {record.notes || <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}