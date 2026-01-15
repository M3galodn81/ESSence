import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { toast } from "sonner";
import { Clock, Coffee, LogIn, LogOut, Timer, AlertCircle, CalendarCheck, History } from "lucide-react";
import { format, differenceInMinutes, addMinutes, subMinutes, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";

// --- Configuration ---
const BREAK_LIMIT_MINUTES = 60;
const SHIFT_WINDOW_TOLERANCE = 30; // Minutes before/after shift user can act

interface Schedule {
  shiftStart: number; 
  shiftEnd: number;   
}

interface Attendance {
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

interface Break {
  id: string;
  attendanceId: string;
  userId: string;
  breakStart: number;
  breakEnd: number | null;
  breakMinutes: number | null;
  breakType: string;
  notes: string | null;
}

interface TodayAttendance {
  attendance: Attendance | null;
  activeBreak: Break | null;
  breaks: Break[];
  schedule: Schedule | null; 
}

export default function TimeClock() {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [breakNotes, setBreakNotes] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: todayData, isLoading } = useQuery<TodayAttendance>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 30000,
  });

  // --- Mutations ---
  const clockInMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast.success("Clocked In", { description: "You have successfully clocked in." });
      setNotes("");
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast.success("Clocked Out", { description: "You have successfully clocked out." });
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  });

  const startBreakMutation = useMutation({
    mutationFn: async ({ breakType, notes }: { breakType: string; notes: string }) => {
      const res = await fetch("/api/attendance/break-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakType, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast.success("Break Started", { description: "Your break has started." });
      setBreakNotes("");
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/break-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast.success("Break Ended", { description: "Your break has ended." });
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  });

  // --- Logic Helpers ---
  const formatTime = (date: Date) => format(date, "h:mm:ss a");
  const formatTimeOnly = (date: Date) => format(date, "h:mm a");
  
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateElapsedTime = (startTime: number) => {
    const start = new Date(startTime).getTime();
    const now = currentTime.getTime();
    const elapsed = Math.floor((now - start) / (1000 * 60));
    return formatDuration(elapsed);
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-slate-500">Loading time clock...</p>
            </div>
        </div>
    );
  }

  const { attendance, activeBreak, breaks, schedule } = todayData || { attendance: null, activeBreak: null, breaks: [], schedule: null };
  
  // 1. Shift Status Logic
  const isClockedIn = attendance && !attendance.timeOut;
  const isShiftCompleted = attendance && attendance.timeIn && attendance.timeOut;
  const isOnBreak = activeBreak !== null;

  // 2. Break Limit Logic
  const totalUsedBreak = attendance ? attendance.totalBreakMinutes : 0;
  const currentBreakSession = activeBreak ? differenceInMinutes(currentTime, new Date(activeBreak.breakStart)) : 0;
  const realTimeTotalBreak = totalUsedBreak + currentBreakSession;
  const remainingBreakMinutes = BREAK_LIMIT_MINUTES - realTimeTotalBreak;
  const isBreakLimitReached = remainingBreakMinutes <= 0 && !isOnBreak;

  // 3. Schedule Window Logic
  let canClockIn = true;
  let canClockOut = true;
  let restrictionMessage = "";

  if (schedule) {
    const shiftStart = new Date(schedule.shiftStart);
    const shiftEnd = new Date(schedule.shiftEnd);

    const validClockInStart = subMinutes(shiftStart, SHIFT_WINDOW_TOLERANCE);
    const validClockInEnd = addMinutes(shiftStart, SHIFT_WINDOW_TOLERANCE);
    const validClockOutStart = subMinutes(shiftEnd, SHIFT_WINDOW_TOLERANCE);
    const validClockOutEnd = addMinutes(shiftEnd, SHIFT_WINDOW_TOLERANCE);

    const inClockInWindow = isWithinInterval(currentTime, { start: validClockInStart, end: validClockInEnd });
    const inClockOutWindow = isWithinInterval(currentTime, { start: validClockOutStart, end: validClockOutEnd });

    if (!isClockedIn && !isShiftCompleted) {
      if (!inClockInWindow) {
        canClockIn = false;
        if (currentTime < validClockInStart) restrictionMessage = `Clock in available at ${format(validClockInStart, 'h:mm a')}`;
        else restrictionMessage = "Clock-in window missed.";
      }
    }

    if (isClockedIn) {
      if (!inClockOutWindow) {
        if (currentTime < validClockOutStart) {
          canClockOut = false;
          restrictionMessage = `Clock out available at ${format(validClockOutStart, 'h:mm a')}`;
        }
      }
    }
  }

  // --- Render: Shift Completed State ---
  if (isShiftCompleted) {
    return (
      <div className="container mx-auto p-6 max-w-4xl flex flex-col items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl text-center overflow-hidden">
            <div className="bg-emerald-500/10 p-8 flex justify-center">
                <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full">
                    <CalendarCheck className="w-12 h-12" />
                </div>
            </div>
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800">You're all set!</CardTitle>
                <CardDescription className="text-slate-500">Shift completed for today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Time In</p>
                        <p className="text-xl font-bold text-slate-700 mt-1">{formatTimeOnly(new Date(attendance!.timeIn))}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Time Out</p>
                        <p className="text-xl font-bold text-slate-700 mt-1">{formatTimeOnly(new Date(attendance!.timeOut!))}</p>
                    </div>
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
                    <span>Total Work Duration</span>
                    <span>{formatDuration(attendance!.totalWorkMinutes || 0)}</span>
                </div>
            </CardContent>
        </Card>
      </div>
    )
  }

  // --- Main Render ---
  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Time Clock</h1>
            <p className="text-slate-500 mt-1">Manage your daily attendance and breaks</p>
        </div>
        {schedule && (
            <div className="px-4 py-2 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-medium text-slate-600 shadow-sm">
                Shift: {formatTimeOnly(new Date(schedule.shiftStart))} - {formatTimeOnly(new Date(schedule.shiftEnd))}
            </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Clock & Controls */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Big Clock Card */}
            <Card className="bg-white/70 backdrop-blur-2xl border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden relative">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                
                <CardContent className="p-10 flex flex-col items-center justify-center min-h-[320px] relative z-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-7xl md:text-8xl font-bold  text-slate-800 tabular-nums drop-shadow-sm">
                            {formatTime(currentTime).replace(/\s[AP]M/, '')}
                            <span className="text-3xl md:text-4xl text-slate-400 ml-2 font-medium">
                                {format(currentTime, "a")}
                            </span>
                        </h2>
                        <p className="text-xl font-medium text-slate-500 uppercase tracking-widest">
                            {format(currentTime, "EEEE, MMMM d")}
                        </p>
                    </div>

                    {/* Live Status Pill */}
                    <div className={`mt-10 px-6 py-2.5 rounded-full border text-sm font-bold shadow-sm transition-all duration-300 flex items-center gap-2 ${
                        isOnBreak ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        isClockedIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${
                            isOnBreak ? 'bg-amber-500 animate-pulse' :
                            isClockedIn ? 'bg-emerald-500 animate-pulse' :
                            'bg-slate-400'
                        }`} />
                        {isOnBreak ? 'ON BREAK' : isClockedIn ? 'CLOCKED IN' : 'READY TO START'}
                    </div>
                </CardContent>
            </Card>

            {/* 2. Action Controls */}
            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
                <CardContent className="p-6">
                    {restrictionMessage && (
                        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-100 text-red-800 rounded-xl">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Action Restricted</AlertTitle>
                            <AlertDescription>{restrictionMessage}</AlertDescription>
                        </Alert>
                    )}

                    {!isClockedIn ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-slate-600 ml-1">Shift Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Add any notes about your shift..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="rounded-2xl bg-slate-50 border-slate-200 focus:bg-white transition-all resize-none"
                                />
                            </div>
                            <Button
                                onClick={() => clockInMutation.mutate(notes)}
                                disabled={clockInMutation.isPending || !canClockIn}
                                className="w-full h-14 text-lg rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 shadow-lg shadow-slate-900/20"
                            >
                                <LogIn className="mr-2 h-5 w-5" />
                                Clock In
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Break Controls */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                {!isOnBreak ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="breakNotes" className="text-slate-600 text-xs uppercase tracking-wider font-semibold">Break Reason</Label>
                                            <Textarea
                                                id="breakNotes"
                                                placeholder="Lunch, Coffee..."
                                                value={breakNotes}
                                                onChange={(e) => setBreakNotes(e.target.value)}
                                                rows={1}
                                                className="rounded-xl bg-white border-slate-200 min-h-[50px] resize-none"
                                            />
                                        </div>
                                        <Button
                                            onClick={() => startBreakMutation.mutate({ breakType: "regular", notes: breakNotes })}
                                            disabled={startBreakMutation.isPending || isBreakLimitReached}
                                            variant="outline"
                                            className="w-full h-12 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                        >
                                            <Coffee className="mr-2 h-4 w-4" />
                                            {isBreakLimitReached ? "Break Limit Reached" : "Start Break"}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => endBreakMutation.mutate()}
                                        disabled={endBreakMutation.isPending}
                                        className="w-full h-full min-h-[100px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex flex-col gap-2"
                                    >
                                        <Timer className="h-8 w-8" />
                                        <span className="text-lg font-bold">End Break</span>
                                        <span className="text-xs font-normal opacity-90">Return to work</span>
                                    </Button>
                                )}
                            </div>

                            {/* Clock Out Control */}
                            <div className="flex items-end">
                                <Button
                                    onClick={() => clockOutMutation.mutate()}
                                    disabled={clockOutMutation.isPending || isOnBreak || !canClockOut}
                                    variant="destructive"
                                    className="w-full h-full min-h-[100px] rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-600/20 flex flex-col justify-center items-center gap-2"
                                >
                                    <LogOut className="h-6 w-6" />
                                    <span className="text-lg font-bold">Clock Out</span>
                                    {!canClockOut && <span className="text-xs opacity-75 font-normal">Too early to leave</span>}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Stats & Logs */}
        <div className="space-y-6">
            
            {/* Current Status Details */}
            <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-slate-800">Session Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isClockedIn && attendance ? (
                        <>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Time In</p>
                                        <p className="text-sm font-semibold text-slate-900">{formatTimeOnly(new Date(attendance.timeIn))}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <Timer className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Duration</p>
                                        <p className="text-sm font-semibold text-slate-900">{calculateElapsedTime(attendance.timeIn)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`flex justify-between items-center p-3 rounded-xl border shadow-sm ${remainingBreakMinutes < 15 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${remainingBreakMinutes < 15 ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <Coffee className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Break Used</p>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {formatDuration(realTimeTotalBreak)} <span className="text-slate-400 font-normal">/ {BREAK_LIMIT_MINUTES}m</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {isOnBreak && activeBreak && (
                                <div className="mt-2 p-3 bg-amber-500 text-white rounded-xl text-center animate-pulse">
                                    <p className="text-xs uppercase font-bold tracking-wider opacity-90">Current Break</p>
                                    <p className="text-2xl font-bold">{calculateElapsedTime(activeBreak.breakStart)}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-8 text-center text-slate-400 text-sm">
                            <p>No active session.</p>
                            <p>Clock in to see details.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Break History */}
            <Card className="glass-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-500" />
                        Break History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {breaks && breaks.length > 0 ? (
                        <div className="relative border-l border-slate-200 ml-2 space-y-4">
                            {breaks.map((breakItem) => (
                                <div key={breakItem.id} className="ml-4 relative">
                                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-200 border-2 border-white" />
                                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 capitalize">{breakItem.breakType} Break</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {formatTimeOnly(new Date(breakItem.breakStart))}
                                                    {breakItem.breakEnd && ` - ${formatTimeOnly(new Date(breakItem.breakEnd))}`}
                                                </p>
                                            </div>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-mono">
                                                {breakItem.breakMinutes ? formatDuration(breakItem.breakMinutes) : "Active"}
                                            </Badge>
                                        </div>
                                        {breakItem.notes && (
                                            <p className="text-xs text-slate-400 mt-2 border-t border-slate-50 pt-2">
                                                "{breakItem.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            No breaks taken today
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}