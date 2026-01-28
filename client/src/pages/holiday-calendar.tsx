import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2, Plus } from "lucide-react";
import type { Holiday } from "@shared/schema";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

export default function HolidayCalendar() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "regular" });

  const { data: holidays, isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/holidays", data);
      return await res.json();
    },
    onSuccess: () => {
      toast("Holiday Added", { description: "The holiday has been successfully added." });
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setIsDialogOpen(false);
      setFormData({ name: "", type: "regular" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast("Holiday Removed", { description: "The holiday has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    }
  });

  // Calendar Grid Logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month
  const startPadding = Array.from({ length: monthStart.getDay() }, (_, i) => i);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (selectedDate && formData.name) {
      createMutation.mutate({
        date: selectedDate.getTime(), // Send as timestamp
        name: formData.name,
        type: formData.type
      });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Holiday Calendar</h1>
            <p className="text-slate-500 mt-1 text-sm">Manage holidays and non-working days for payroll calculation.</p>
         </div>
         <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-1 rounded-full border shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-full"><ChevronLeft className="w-4 h-4" /></Button>
            <div className="font-semibold text-slate-700 w-32 text-center">{format(currentDate, 'MMMM yyyy')}</div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-full"><ChevronRight className="w-4 h-4" /></Button>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar View */}
          <Card className="lg:col-span-2 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
             <div className="grid grid-cols-7 text-center py-4 bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
             </div>
             <div className="grid grid-cols-7 auto-rows-[100px] bg-white/40">
                {startPadding.map(i => <div key={`pad-${i}`} className="border-b border-r border-slate-100/50 bg-slate-50/20" />)}
                {daysInMonth.map(day => {
                   const holiday = holidays?.find(h => isSameDay(new Date(h.date), day));
                   const isToday = isSameDay(day, new Date());
                   
                   return (
                      <div 
                        key={day.toISOString()} 
                        onClick={() => handleDayClick(day)}
                        className={`relative border-b border-r border-slate-100/50 p-2 transition-colors hover:bg-blue-50/30 cursor-pointer group ${isToday ? 'bg-blue-50/20' : ''}`}
                      >
                         <span className={`text-sm font-medium ${isToday ? 'text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                            {format(day, 'd')}
                         </span>
                         
                         {holiday && (
                            <div className={`mt-2 p-1.5 rounded-lg text-xs font-medium border shadow-sm group-hover:shadow-md transition-all
                                ${holiday.type === 'regular' 
                                   ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                   : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}
                            >
                               <div className="truncate" title={holiday.name}>{holiday.name}</div>
                               <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-red-500 hover:bg-white/50" onClick={(e) => handleDelete(e, holiday.id)}>
                                      <Trash2 className="w-3 h-3" />
                                   </Button>
                               </div>
                            </div>
                         )}

                         {!holiday && (
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                 <Plus className="w-6 h-6 text-slate-300" />
                             </div>
                         )}
                      </div>
                   );
                })}
             </div>
          </Card>

          {/* Side List */}
          <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl h-fit">
             <CardHeader>
                <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
             </CardHeader>
             <CardContent>
                {isLoading ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
                ) : (holidays && holidays.length > 0) ? (
                    <div className="space-y-3">
                        {holidays
                          .filter(h => new Date(h.date) >= startOfMonth(currentDate))
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .slice(0, 5)
                          .map(holiday => (
                            <div key={holiday.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${holiday.type === 'regular' ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                                    <span className="text-xs font-bold uppercase">{format(new Date(holiday.date), 'MMM')}</span>
                                    <span className="text-lg font-bold leading-none">{format(new Date(holiday.date), 'd')}</span>
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">{holiday.name}</p>
                                    <p className="text-xs text-slate-500 capitalize">{holiday.type} Holiday</p>
                                </div>
                            </div>
                        ))}
                        {holidays.filter(h => new Date(h.date) >= startOfMonth(currentDate)).length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-sm">No upcoming holidays this month.</div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">No holidays found.</div>
                )}
             </CardContent>
          </Card>
       </div>

       {/* Add Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="rounded-2xl">
             <DialogHeader>
                <DialogTitle>Add Holiday</DialogTitle>
             </DialogHeader>
             <div className="space-y-4 py-4">
                <div className="space-y-2">
                   <Label>Date</Label>
                   <div className="p-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700">
                      {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : '-'}
                   </div>
                </div>
                <div className="space-y-2">
                   <Label>Holiday Name</Label>
                   <Input 
                      placeholder="e.g. Independence Day" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <Label>Type</Label>
                   <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="regular">Regular Holiday</SelectItem>
                         <SelectItem value="special">Special Non-Working</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
             <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>Add Holiday</Button>
             </DialogFooter>
          </DialogContent>
       </Dialog>
    </div>
  );
}