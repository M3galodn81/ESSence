import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, Copy, Users, CalendarDays, Filter } from "lucide-react";
import type { Schedule, User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // move this to permissions.ts
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

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/team"],
  });

  const { data: allSchedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules/all"],
  });

  const createForm = useForm<ShiftForm>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      shiftType: "morning",
      shiftRole: "server",
    },
  });

  const editForm = useForm<ShiftForm>({
    resolver: zodResolver(shiftFormSchema),
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftForm) => {
      let startTime = data.startTime;
      let endTime = data.endTime;
      
      if (!startTime || !endTime) {
        switch (data.shiftType) {
          case "morning":
            startTime = "08:00";
            endTime = "16:00";
            break;
          case "afternoon":
            startTime = "16:00";
            endTime = "00:00"; 
            break;
          case "night":
            startTime = "00:00";
            endTime = "08:00";
            break;
          case "off":
            startTime = "00:00";
            endTime = "00:00";
            break;
        }
      }

      const startDateTime = new Date(`${data.date}T${startTime}`);
      const endDateTime = new Date(`${data.date}T${endTime}`);
      
      if (endDateTime < startDateTime && data.shiftType !== 'off') {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const shiftDate = new Date(data.date);

      const res = await apiRequest("POST", "/api/schedules", {
        userId: data.userId,
        date: shiftDate.getTime(),
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
      toast({
        title: "Shift created",
        description: "The shift has been assigned successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create shift",
        description: error.message,
        variant: "destructive",
      });
    },
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
      
      // Reconstruct Dates
      if (data.date) {
        const shiftDate = new Date(data.date);
        if (!isNaN(shiftDate.getTime())) updates.date = shiftDate.getTime();

        if (data.startTime) {
            const startDateTime = new Date(`${data.date}T${data.startTime}`);
            if (!isNaN(startDateTime.getTime())) updates.startTime = startDateTime.getTime();
        }

        if (data.endTime) {
            const endDateTime = new Date(`${data.date}T${data.endTime}`);
            if (data.startTime) {
                const startDateTime = new Date(`${data.date}T${data.startTime}`);
                if (endDateTime < startDateTime && data.shiftType !== 'off') {
                    endDateTime.setDate(endDateTime.getDate() + 1);
                }
            }
            if (!isNaN(endDateTime.getTime())) updates.endTime = endDateTime.getTime();
        }
      }

      const res = await apiRequest("PATCH", `/api/schedules/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Shift updated", description: "The shift has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsEditDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update shift", description: error.message, variant: "destructive" });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Shift deleted", description: "The shift has been removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsDeleteDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete shift", description: error.message, variant: "destructive" });
    },
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
      toast({ title: "Schedule copied", description: "Previous week's schedule has been copied successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to copy schedule", description: error.message, variant: "destructive" });
    },
  });

  const onCreateSubmit = (data: ShiftForm) => {
    createShiftMutation.mutate(data);
  };

  const onEditSubmit = (data: ShiftForm) => {
    if (selectedSchedule) {
      updateShiftMutation.mutate({ id: selectedSchedule.id, data });
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    const scheduleDate = new Date(schedule.date);
    const dateString = scheduleDate.toISOString().split('T')[0];

    const start = new Date(schedule.startTime);
    const startString = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const end = new Date(schedule.endTime);
    const endString = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
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

  const handleDelete = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedSchedule) {
      deleteShiftMutation.mutate(selectedSchedule.id);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

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

  const getSchedulesForDate = (date: Date, userId?: string) => {
    if (!allSchedules) return [];
    const targetDateString = date.toLocaleDateString('en-CA');
    
    return allSchedules.filter((schedule: Schedule) => {
      const scheduleDate = new Date(schedule.date);
      const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
      
      const dateMatch = scheduleDateStr === targetDateString;
      const userMatch = !userId || userId === "all" || schedule.userId === userId;
      return dateMatch && userMatch;
    });
  };

  const getEmployeeName = (userId: string) => {
    const employee = teamMembers?.find((m: User) => m.id === userId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
  };

  const getShiftBadge = (shiftType: string) => {
    const styles = {
        morning: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
        afternoon: "bg-amber-100 text-amber-700 hover:bg-amber-200",
        night: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
        off: "bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200"
    };
    const style = styles[shiftType as keyof typeof styles] || styles.morning;
    return <Badge className={`${style} border-0 shadow-none font-medium uppercase tracking-wide text-[10px]`}>{shiftType}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    return <span className="text-[10px] text-slate-500 font-medium capitalize">{role}</span>;
  };

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatWeekRange = () => {
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
            <Button variant="outline" className="bg-white/60 backdrop-blur-sm border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 shadow-sm rounded-full" onClick={() => copyPreviousWeekMutation.mutate()} disabled={copyPreviousWeekMutation.isPending}>
                <Copy className="w-4 h-4 mr-2" /> Copy Previous Week
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6">
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
                      <Select onValueChange={(value) => createForm.setValue("shiftType", value as any)} defaultValue="morning">
                        <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="night">Night</SelectItem>
                          <SelectItem value="off">Day Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shiftRole">Role</Label>
                      <Select onValueChange={(value) => createForm.setValue("shiftRole", value as any)} defaultValue="server">
                        <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                          <SelectItem value="server">Server</SelectItem>
                          <SelectItem value="kitchen">Kitchen</SelectItem>
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
         <Button variant="ghost" onClick={() => setCurrentDate(new Date())} className="rounded-xl hover:bg-slate-100 text-slate-600 w-full sm:w-auto">
            <CalendarDays className="w-4 h-4 mr-2" /> This Week
         </Button>
      </div>

      {/* Schedule Grid */}
      <Card className="bg-white/40 backdrop-blur-md border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-slate-100 bg-white/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-slate-500" />
                {formatWeekRange()}
              </CardTitle>
            </div>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')} className="h-8 w-8 p-0 rounded-md hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4 text-slate-600" /></Button>
              <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')} className="h-8 w-8 p-0 rounded-md hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4 text-slate-600" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
             <div className="text-center py-12 text-slate-400">Loading schedules...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
              {getDaysOfWeek().map((day, index) => {
                const daySchedules = getSchedulesForDate(day, selectedEmployee);
                const isCurrentDay = isToday(day);

                return (
                  <div key={index} className={`flex flex-col gap-3 p-3 rounded-2xl border min-h-[180px] transition-all ${isCurrentDay ? 'bg-blue-50/50 border-blue-100' : 'bg-white/60 border-slate-100 hover:border-slate-200'}`}>
                    <div className="text-center pb-2 border-b border-slate-100/50">
                      <h3 className={`text-sm font-bold ${isCurrentDay ? 'text-blue-600' : 'text-slate-700'}`}>{formatDateHeader(day)}</h3>
                      {isCurrentDay && <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Today</span>}
                    </div>

                    <div className="flex-1 space-y-2">
                      {daySchedules.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-4">No shifts</div>
                      ) : (
                        daySchedules.map((schedule: Schedule) => (
                          <div key={schedule.id} className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative">
                            {selectedEmployee === "all" && (
                              <p className="text-xs font-bold text-slate-800 truncate mb-1">{getEmployeeName(schedule.userId)}</p>
                            )}
                            
                            <div className="flex justify-center gap-1 mb-1.5">
                                {getShiftBadge(schedule.type)}
                            </div>
                            <div className="flex justify-center gap-1 mb-1.5">
                                {schedule.shiftRole && getRoleBadge(schedule.shiftRole)}
                            </div>

                            {schedule.type !== 'off' && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-1.5 py-0.5 rounded-md w-fit">
                                    <Clock className="w-3 h-3" />
                                    {new Date(schedule.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                                    {new Date(schedule.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </div>
                            )}
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md bg-slate-100 hover:bg-white hover:text-blue-600" onClick={() => handleEdit(schedule)}><Edit className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md bg-slate-100 hover:bg-white hover:text-red-600" onClick={() => handleDelete(schedule)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
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
                        <Select onValueChange={(value) => editForm.setValue("shiftType", value as any)} value={editForm.watch("shiftType")}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="morning">Morning</SelectItem>
                                <SelectItem value="afternoon">Afternoon</SelectItem>
                                <SelectItem value="night">Night</SelectItem>
                                <SelectItem value="off">Day Off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select onValueChange={(value) => editForm.setValue("shiftRole", value as any)} value={editForm.watch("shiftRole")}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="cashier">Cashier</SelectItem>
                                <SelectItem value="bar">Bar</SelectItem>
                                <SelectItem value="server">Server</SelectItem>
                                <SelectItem value="kitchen">Kitchen</SelectItem>
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

      {/* Delete Alert */}
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