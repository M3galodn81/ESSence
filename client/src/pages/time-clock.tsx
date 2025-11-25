import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Assuming you have an Alert component
import { useToast } from "@/hooks/use-toast";
import { Clock, Coffee, LogIn, LogOut, Timer, AlertCircle } from "lucide-react";
import { format, differenceInMinutes, addMinutes, subMinutes, isWithinInterval } from "date-fns";

// --- Configuration ---
const BREAK_LIMIT_MINUTES = 60;
const SHIFT_WINDOW_TOLERANCE = 30; // Minutes before/after shift user can act

interface Schedule {
  shiftStart: number; // Unix timestamp or ISO string for today's shift start
  shiftEnd: number;   // Unix timestamp or ISO string for today's shift end
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
  schedule: Schedule | null; // Added schedule to API response
}

export default function TimeClock() {
  const { toast } = useToast();
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

  // --- Mutations (Same as before) ---
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
      toast({ title: "Clocked In", description: "You have successfully clocked in." });
      setNotes("");
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
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
      toast({ title: "Clocked Out", description: "You have successfully clocked out." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
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
      toast({ title: "Break Started", description: "Your break has started." });
      setBreakNotes("");
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
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
      toast({ title: "Break Ended", description: "Your break has ended." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // --- Logic Helpers ---

  const formatTime = (date: Date) => format(date, "h:mm:ss a");
  
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
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const { attendance, activeBreak, breaks, schedule } = todayData || { attendance: null, activeBreak: null, breaks: [], schedule: null };
  
  // 1. Shift Status Logic
  const isClockedIn = attendance && !attendance.timeOut;
  const isShiftCompleted = attendance && attendance.timeIn && attendance.timeOut;
  const isOnBreak = activeBreak !== null;

  // 2. Break Limit Logic
  const totalUsedBreak = attendance ? attendance.totalBreakMinutes : 0;
  // If on break, add the current session duration to the total
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

    // Clock In Window: e.g., 30 mins before start to 30 mins after start
    // (Adjust logic if you want to allow late clock-ins)
    const validClockInStart = subMinutes(shiftStart, SHIFT_WINDOW_TOLERANCE);
    const validClockInEnd = addMinutes(shiftStart, SHIFT_WINDOW_TOLERANCE);
    
    // Clock Out Window: e.g., 30 mins before end to 30 mins after end
    const validClockOutStart = subMinutes(shiftEnd, SHIFT_WINDOW_TOLERANCE);
    const validClockOutEnd = addMinutes(shiftEnd, SHIFT_WINDOW_TOLERANCE);

    const inClockInWindow = isWithinInterval(currentTime, { start: validClockInStart, end: validClockInEnd });
    
    // For clock out, we usually just want to prevent Early clock out, or prevent staying too late
    // Here we check if they are within the tolerance zone of the end time
    const inClockOutWindow = isWithinInterval(currentTime, { start: validClockOutStart, end: validClockOutEnd });

    // Can only clock in if within window AND hasn't worked today
    if (!isClockedIn && !isShiftCompleted) {
      if (!inClockInWindow) {
        canClockIn = false;
        // Simple check to see if too early or too late
        if (currentTime < validClockInStart) restrictionMessage = `You can only clock in starting ${format(validClockInStart, 'h:mm a')}`;
        else restrictionMessage = "You have missed your clock-in window.";
      }
    }

    // Can only clock out if within window
    if (isClockedIn) {
      if (!inClockOutWindow) {
        // Allow clock out if it's AFTER the window (overtime), but block if BEFORE
        if (currentTime < validClockOutStart) {
          canClockOut = false;
          restrictionMessage = `You cannot clock out until ${format(validClockOutStart, 'h:mm a')}`;
        }
      }
    }
  }

  // 4. Single Shift Per Day Logic
  if (isShiftCompleted) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center">
        <Card>
            <CardHeader>
                <CardTitle className="text-green-600">Shift Complete</CardTitle>
                <CardDescription>You have already completed your shift for today.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold mb-4">{format(currentTime, "h:mm:ss a")}</div>
                <div className="flex justify-center gap-4 text-sm">
                    <div>Time In: <span className="font-bold">{format(new Date(attendance!.timeIn), "h:mm a")}</span></div>
                    <div>Time Out: <span className="font-bold">{format(new Date(attendance!.timeOut!), "h:mm a")}</span></div>
                </div>
            </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Time Clock</h1>
        <p className="text-muted-foreground">
            {schedule 
                ? `Scheduled Shift: ${format(new Date(schedule.shiftStart), "h:mm a")} - ${format(new Date(schedule.shiftEnd), "h:mm a")}` 
                : "No schedule found"}
        </p>
      </div>

      {/* Current Time Display */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{formatTime(currentTime)}</div>
            <div className="text-lg text-muted-foreground">{format(currentTime, "EEEE, MMMM d, yyyy")}</div>
          </div>
        </CardContent>
      </Card>

      {/* Logic Restriction Alerts */}
      {restrictionMessage && (
         <Alert variant="destructive" className="mb-6">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Action Restricted</AlertTitle>
           <AlertDescription>{restrictionMessage}</AlertDescription>
         </Alert>
      )}

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="font-medium">Status:</span>
              <span className={`font-bold ${isOnBreak ? 'text-orange-600' : isClockedIn ? 'text-green-600' : 'text-gray-600'}`}>
                {isOnBreak ? 'On Break' : isClockedIn ? 'Clocked In' : 'Clocked Out'}
              </span>
            </div>

            {isClockedIn && attendance && (
              <>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="font-medium">Time In:</span>
                  <span className="font-bold">{format(new Date(attendance.timeIn), "h:mm a")}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="font-medium">Time Worked:</span>
                  <span className="font-bold">{calculateElapsedTime(attendance.timeIn)}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex flex-col">
                      <span className="font-medium">Break Time Used:</span>
                      <span className="text-xs text-muted-foreground">Limit: {BREAK_LIMIT_MINUTES} mins</span>
                  </div>
                  <div className={`font-bold ${remainingBreakMinutes < 10 ? 'text-red-600' : ''}`}>
                    {formatDuration(realTimeTotalBreak)}
                  </div>
                </div>

                {isOnBreak && activeBreak && (
                  <div className="flex items-center justify-between p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <span className="font-medium">Current Break:</span>
                    <span className="font-bold">{calculateElapsedTime(activeBreak.breakStart)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isClockedIn && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about your shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <Button
                onClick={() => clockInMutation.mutate(notes)}
                disabled={clockInMutation.isPending || !canClockIn}
                className="w-full"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Clock In
              </Button>
            </div>
          )}

          {isClockedIn && !isOnBreak && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakNotes">Break Notes (Optional)</Label>
                <Textarea
                  id="breakNotes"
                  placeholder="Reason for break..."
                  value={breakNotes}
                  onChange={(e) => setBreakNotes(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={() => startBreakMutation.mutate({ breakType: "regular", notes: breakNotes })}
                  disabled={startBreakMutation.isPending || isBreakLimitReached}
                  className="w-full"
                  variant="outline"
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  {isBreakLimitReached ? "Break Limit Reached" : "Start Break"}
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending || !canClockOut}
                  className="w-full"
                  size="lg"
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Clock Out
                </Button>
              </div>
            </div>
          )}

          {isOnBreak && (
            <Button
              onClick={() => endBreakMutation.mutate()}
              disabled={endBreakMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Timer className="mr-2 h-5 w-5" />
              End Break
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Today's Breaks (Existing Code) */}
      {breaks && breaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Breaks</CardTitle>
            <CardDescription>All breaks taken today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {breaks.map((breakItem) => (
                <div key={breakItem.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{breakItem.breakType} Break</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(breakItem.breakStart), "h:mm a")}
                      {breakItem.breakEnd && ` - ${format(new Date(breakItem.breakEnd), "h:mm a")}`}
                    </div>
                  </div>
                  <div className="font-bold">
                    {breakItem.breakMinutes ? formatDuration(breakItem.breakMinutes) : "In Progress"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}