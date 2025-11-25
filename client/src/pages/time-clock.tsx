import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Clock, Coffee, LogIn, LogOut, Timer } from "lucide-react";
import { format } from "date-fns";

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
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const clockInMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to clock in");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked In", description: "You have successfully clocked in." });
      setNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to clock out");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked Out", description: "You have successfully clocked out." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: async ({ breakType, notes }: { breakType: string; notes: string }) => {
      const res = await fetch("/api/attendance/break-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ breakType, notes }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to start break");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Break Started", description: "Your break has started." });
      setBreakNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/break-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to end break");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Break Ended", description: "Your break has ended." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatTime = (date: Date) => {
    return format(date, "h:mm:ss a");
  };

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

  const { attendance, activeBreak, breaks } = todayData || { attendance: null, activeBreak: null, breaks: [] };
  const isClockedIn = attendance && !attendance.timeOut;
  const isOnBreak = activeBreak !== null;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Time Clock</h1>
        <p className="text-muted-foreground">Track your work hours and breaks</p>
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

                {attendance.totalBreakMinutes > 0 && (
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <span className="font-medium">Total Break Time:</span>
                    <span className="font-bold">{formatDuration(attendance.totalBreakMinutes)}</span>
                  </div>
                )}

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
                disabled={clockInMutation.isPending}
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
                  disabled={startBreakMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  Start Break
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
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

      {/* Today's Breaks */}
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

