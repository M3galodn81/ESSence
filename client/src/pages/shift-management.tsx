import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, Copy, Users, CalendarDays } from "lucide-react";
import type { Schedule, User } from "@shared/schema";

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

  if (user?.role !== 'manager' && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Access denied. Manager or Admin role required.</p>
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

  const { data: teamMembers } = useQuery({
    queryKey: ["/api/team"],
  });

  const { data: allSchedules, isLoading } = useQuery({
    queryKey: ["/api/schedules/all", weekStart.toISOString(), weekEnd.toISOString()],
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
      const shiftDate = new Date(data.date);
      
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

      const startDateTime = new Date(shiftDate);
      const [startHour, startMinute] = startTime!.split(':');
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const endDateTime = new Date(shiftDate);
      const [endHour, endMinute] = endTime!.split(':');
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

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
      
      if (data.startTime && data.date) {
        const shiftDate = new Date(data.date);
        const [startHour, startMinute] = data.startTime.split(':');
        const startDateTime = new Date(shiftDate);
        startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
        updates.startTime = startDateTime.getTime();
      }

      if (data.endTime && data.date) {
        const shiftDate = new Date(data.date);
        const [endHour, endMinute] = data.endTime.split(':');
        const endDateTime = new Date(shiftDate);
        endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
        updates.endTime = endDateTime.getTime();
      }

      const res = await apiRequest("PATCH", `/api/schedules/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift updated",
        description: "The shift has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsEditDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Shift deleted",
        description: "The shift has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
      setIsDeleteDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete shift",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Schedule copied",
        description: "Previous week's schedule has been copied successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to copy schedule",
        description: error.message,
        variant: "destructive",
      });
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
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    editForm.reset({
      userId: schedule.userId,
      date: scheduleDate.toISOString().split('T')[0],
      shiftType: schedule.type as any,
      shiftRole: schedule.shiftRole as any,
      startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
      endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
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
    
    return allSchedules.filter((schedule: Schedule) => {
      const scheduleDate = new Date(schedule.date);
      const dateMatch = scheduleDate.toDateString() === date.toDateString();
      const userMatch = !userId || userId === "all" || schedule.userId === userId;
      return dateMatch && userMatch;
    });
  };

  const getEmployeeName = (userId: string) => {
    const employee = teamMembers?.find((m: User) => m.id === userId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
  };

  const getShiftBadge = (shiftType: string) => {
    switch (shiftType) {
      case 'morning':
        return <Badge className="bg-red-600 text-white">Morning</Badge>;
      case 'afternoon':
        return <Badge className="bg-gray-700 text-white">Afternoon</Badge>;
      case 'night':
        return <Badge className="bg-black text-white">Night</Badge>;
      case 'off':
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Day Off</Badge>;
      default:
        return <Badge variant="secondary">{shiftType}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      cashier: "bg-red-100 text-red-900 border border-red-300",
      bar: "bg-gray-800 text-white",
      server: "bg-gray-200 text-gray-900",
      kitchen: "bg-red-600 text-white",
    };
    return (
      <Badge className={roleColors[role] || "bg-gray-100 text-gray-800"}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatWeekRange = () => {
    return `${weekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })} - ${weekEnd.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Shift Management</h1>
            <p className="text-muted-foreground">Assign and manage employee work schedules</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => copyPreviousWeekMutation.mutate()}
              disabled={copyPreviousWeekMutation.isPending}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Previous Week
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Shift
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign New Shift</DialogTitle>
                  <DialogDescription>Create a new shift assignment for an employee</DialogDescription>
                </DialogHeader>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="userId">Employee *</Label>
                    <Select
                      onValueChange={(value) => createForm.setValue("userId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers?.map((member: User) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName} - {member.position || "No position"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {createForm.formState.errors.userId && (
                      <p className="text-sm text-destructive mt-1">
                        {createForm.formState.errors.userId.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      {...createForm.register("date")}
                    />
                    {createForm.formState.errors.date && (
                      <p className="text-sm text-destructive mt-1">
                        {createForm.formState.errors.date.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shiftType">Shift Type *</Label>
                      <Select
                        onValueChange={(value) => createForm.setValue("shiftType", value as any)}
                        defaultValue="morning"
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (8AM-4PM)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (4PM-12AM)</SelectItem>
                          <SelectItem value="night">Night (12AM-8AM)</SelectItem>
                          <SelectItem value="off">Day Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="shiftRole">Role</Label>
                      <Select
                        onValueChange={(value) => createForm.setValue("shiftRole", value as any)}
                        defaultValue="server"
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                          <SelectItem value="server">Server</SelectItem>
                          <SelectItem value="kitchen">Kitchen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        {...createForm.register("startTime")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        {...createForm.register("endTime")}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      {...createForm.register("location")}
                      placeholder="e.g., Main Branch"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createShiftMutation.isPending}>
                      {createShiftMutation.isPending ? "Creating..." : "Create Shift"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Label>Filter by Employee:</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {teamMembers?.map((member: User) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentDate(new Date())}
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  This Week
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  {formatWeekRange()}
                </CardTitle>
                <CardDescription>
                  {selectedEmployee === "all"
                    ? "All employees' schedules for this week"
                    : `${getEmployeeName(selectedEmployee)}'s schedule for this week`}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading schedules...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-4">
                {getDaysOfWeek().map((day, index) => {
                  const daySchedules = getSchedulesForDate(day, selectedEmployee);
                  const todayClass = isToday(day) ? 'ring-2 ring-primary' : '';

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all ${todayClass}`}
                    >
                      <div className="text-center mb-3">
                        <h3 className={`font-medium ${isToday(day) ? 'text-primary' : ''}`}>
                          {formatDateHeader(day)}
                        </h3>
                        {isToday(day) && (
                          <p className="text-xs text-primary font-medium">Today</p>
                        )}
                      </div>

                      {daySchedules.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">No shifts</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {daySchedules.map((schedule: Schedule) => (
                            <div
                              key={schedule.id}
                              className="p-2 bg-gray-50 rounded border space-y-2"
                            >
                              {selectedEmployee === "all" && (
                                <p className="text-xs font-medium truncate">
                                  {getEmployeeName(schedule.userId)}
                                </p>
                              )}

                              <div className="flex flex-col items-center space-y-1">
                                {getShiftBadge(schedule.type)}
                                {schedule.shiftRole && getRoleBadge(schedule.shiftRole)}
                              </div>

                              {schedule.type !== 'off' && (
                                <div className="flex items-center justify-center text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3 mr-1" />
                                  <span>
                                    {new Date(schedule.startTime).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                    {' - '}
                                    {new Date(schedule.endTime).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-center space-x-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleEdit(schedule)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(schedule)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Shift</DialogTitle>
              <DialogDescription>Update shift details</DialogDescription>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  {...editForm.register("date")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-shiftType">Shift Type *</Label>
                  <Select
                    onValueChange={(value) => editForm.setValue("shiftType", value as any)}
                    value={editForm.watch("shiftType")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning (8AM-4PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (4PM-12AM)</SelectItem>
                      <SelectItem value="night">Night (12AM-8AM)</SelectItem>
                      <SelectItem value="off">Day Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-shiftRole">Role</Label>
                  <Select
                    onValueChange={(value) => editForm.setValue("shiftRole", value as any)}
                    value={editForm.watch("shiftRole")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="kitchen">Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-startTime">Start Time</Label>
                  <Input
                    id="edit-startTime"
                    type="time"
                    {...editForm.register("startTime")}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-endTime">End Time</Label>
                  <Input
                    id="edit-endTime"
                    type="time"
                    {...editForm.register("endTime")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  {...editForm.register("location")}
                  placeholder="e.g., Main Branch"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateShiftMutation.isPending}>
                  {updateShiftMutation.isPending ? "Updating..." : "Update Shift"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Shift</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this shift assignment? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteShiftMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
