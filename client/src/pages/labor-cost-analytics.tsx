import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DollarSign, Plus, AlertCircle, CheckCircle, Lightbulb, TrendingUp, TrendingDown, Activity, Pencil, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import type { LaborCostData } from "@shared/schema";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  totalSales: z.number().min(0, "Sales must be positive"),
  totalLaborCost: z.number().min(0, "Labor cost must be positive"),
  notes: z.string().optional(),
});

type LaborCostForm = z.infer<typeof formSchema>;

export default function LaborCostAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Edit/Delete State
  const [editingRecord, setEditingRecord] = useState<LaborCostData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: laborCostData, isLoading } = useQuery({
    queryKey: ["/api/labor-cost-data", selectedYear],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/labor-cost-data?year=${selectedYear}`);
      return await res.json();
    },
  });

  const form = useForm<LaborCostForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      totalSales: 0,
      totalLaborCost: 0,
      notes: "",
    },
  });

  // Helper for calculations
  const calculateMetrics = (totalSales: number, totalLaborCost: number) => {
    const salesInCentavos = Math.round(totalSales * 100);
    const laborInCentavos = Math.round(totalLaborCost * 100);

    let percentage = 0;
    if (salesInCentavos > 0) {
        percentage = (laborInCentavos / salesInCentavos) * 10000;
    } else if (laborInCentavos > 0) {
        percentage = 1000000; 
    }
    
    let status = "Poor";
    let performanceRating = "critical";
    
    if (percentage < 3000) {
      status = "Excellent";
      performanceRating = "good";
    } else if (percentage < 3500) {
      status = "High";
      performanceRating = "good";
    } else if (percentage < 4500) {
      status = "High";
      performanceRating = "warning";
    } else if (percentage < 5000) {
      status = "Poor";
      performanceRating = "warning";
    }

    return { 
      salesInCentavos, 
      laborInCentavos, 
      percentage: Math.round(percentage), 
      status, 
      performanceRating 
    };
  };

  const createLaborCostMutation = useMutation({
    mutationFn: async (data: LaborCostForm) => {
      const metrics = calculateMetrics(data.totalSales, data.totalLaborCost);
      
      const res = await apiRequest("POST", "/api/labor-cost-data", {
        month: data.month,
        year: data.year,
        notes: data.notes,
        totalSales: metrics.salesInCentavos,
        totalLaborCost: metrics.laborInCentavos,
        laborCostPercentage: metrics.percentage,
        status: metrics.status,
        performanceRating: metrics.performanceRating,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Data added", description: "Labor cost data has been added successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/labor-cost-data"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add data", description: error.message, variant: "destructive" });
    },
  });

  const updateLaborCostMutation = useMutation({
    mutationFn: async (data: LaborCostForm) => {
      if (!editingRecord) throw new Error("No record selected");
      
      const metrics = calculateMetrics(data.totalSales, data.totalLaborCost);

      const res = await fetch(`/api/labor-cost-data/${editingRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...metrics,
            totalSales: metrics.salesInCentavos,
            totalLaborCost: metrics.laborInCentavos,
            laborCostPercentage: metrics.percentage,
            month: data.month,
            year: data.year,
            notes: data.notes
        }),
      });
      
      if (!res.ok) throw new Error("Failed to update");
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Data updated", description: "Record updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/labor-cost-data"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteLaborCostMutation = useMutation({
    mutationFn: async (id: string) => {
       // Assuming standard REST delete endpoint exists or added
       const res = await fetch(`/api/labor-cost-data/${id}`, { method: "DELETE" }); 
       // If endpoint doesn't exist yet, this will fail. Ensure backend supports it.
       if(!res.ok) throw new Error("Failed to delete");
       return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/labor-cost-data"] });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: "Could not delete record.", variant: "destructive" });
    }
  });

  const onSubmit = (data: LaborCostForm) => {
    if (editingRecord) {
        updateLaborCostMutation.mutate(data);
    } else {
        createLaborCostMutation.mutate(data);
    }
  };

  const handleEdit = (record: LaborCostData) => {
    setEditingRecord(record);
    form.reset({
        month: record.month,
        year: record.year,
        totalSales: record.totalSales / 100,
        totalLaborCost: record.totalLaborCost / 100,
        notes: record.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRecord(null);
    form.reset();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  // New formatting for compact numbers (e.g. 2.5m)
  const formatCompactNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2).replace(/\.00$/, '') + 'm';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return value.toString();
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      "Excellent": { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
      "High": { color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
      "Poor": { color: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertCircle },
    };
    const config = variants[status] || variants["High"];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const currentMonthData = laborCostData?.[0];
  const previousMonthData = laborCostData?.[1];
  
  const improvement = currentMonthData && previousMonthData
    ? ((previousMonthData.laborCostPercentage - currentMonthData.laborCostPercentage) / 100).toFixed(1)
    : null;

  const chartData = laborCostData?.slice(0, 7).reverse().map((data: LaborCostData) => ({
    month: getMonthName(data.month).substring(0, 3),
    fullMonth: getMonthName(data.month),
    year: data.year,
    sales: data.totalSales / 100,
    laborCost: data.totalLaborCost / 100,
    laborPercent: data.laborCostPercentage / 100,
  })) || [];

  if (user?.role !== 'manager' && user?.role !== 'hr') {
    return (
      <div className="p-8 flex justify-center items-center h-screen bg-slate-50">
        <Card className="w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200 shadow-xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
               <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
            <p className="text-slate-500">This page is only available to managers and HR personnel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Labor Cost Analytics</h1>
          <p className="text-slate-500 mt-1 text-sm">Strategic insights into workforce efficiency and sales performance</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
                className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 rounded-full px-6"
                onClick={() => { setEditingRecord(null); form.reset(); }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Monthly Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingRecord ? 'Edit Data' : 'Add Labor Cost Data'}</DialogTitle>
              <DialogDescription>Enter confirmed financial data for the month</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Input id="month" type="number" min="1" max="12" {...form.register("month", { valueAsNumber: true })} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" type="number" {...form.register("year", { valueAsNumber: true })} className="rounded-xl" />
                  </div>
               </div>
               <div className="space-y-2">
                  <Label htmlFor="totalSales">Total Sales (₱)</Label>
                  <Input id="totalSales" type="number" step="0.01" {...form.register("totalSales", { valueAsNumber: true })} placeholder="0.00" className="rounded-xl text-lg font-medium" />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="totalLaborCost">Total Labor Cost (₱)</Label>
                  <Input id="totalLaborCost" type="number" step="0.01" {...form.register("totalLaborCost", { valueAsNumber: true })} placeholder="0.00" className="rounded-xl text-lg font-medium" />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...form.register("notes")} className="rounded-xl resize-none" />
               </div>
               <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog} className="rounded-full">Cancel</Button>
                  <Button type="submit" disabled={createLaborCostMutation.isPending || updateLaborCostMutation.isPending} className="rounded-full bg-slate-900">
                    {createLaborCostMutation.isPending || updateLaborCostMutation.isPending ? "Saving..." : "Save Data"}
                  </Button>
               </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bento Grid - The Big Picture */}
      {currentMonthData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* 1. Key Metric: Labor % Gauge */}
           <Card className="lg:row-span-2 bg-slate-900 text-white border-slate-800 shadow-xl rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none group-hover:bg-white/10 transition-colors duration-500    "  />
              <CardHeader>
                 <CardTitle className="text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Activity className="w-4 h-4" /> Efficiency Score
                 </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8 relative z-10">
                  <div className="relative w-56 h-56">
                     <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
                        <circle 
                           cx="50" cy="50" r="40" fill="none" 
                           // Cap visual progress at 100%
                           strokeDasharray={`${Math.min(100, currentMonthData.laborCostPercentage / 100) * 2.51} 251`}
                           stroke={currentMonthData.laborCostPercentage < 3500 ? "#10b981" : currentMonthData.laborCostPercentage < 4500 ? "#f59e0b" : "#ef4444"}
                           strokeWidth="10"
                           strokeLinecap="round"
                           className="drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-bold tracking-tighter ${currentMonthData.laborCostPercentage > 99900 ? 'text-3xl' : 'text-5xl'}`}>
                           {formatCompactNumber(currentMonthData.laborCostPercentage / 100)}<span className="text-2xl text-slate-400">%</span>
                        </span>
                        <span className="text-xs font-medium text-slate-400 uppercase mt-1">Labor / Sales</span>
                     </div>
                  </div>
                  <div className="mt-6 text-center space-y-1">
                     <p className="text-lg font-semibold">{currentMonthData.status} Rating</p>
                     <p className="text-sm text-slate-400">Target: &lt; 30%</p>
                  </div>
              </CardContent>
           </Card>

           {/* 2. Financials */}
           <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Financial Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div>
                    <p className="text-xs text-slate-400 mb-1">Total Revenue</p>
                    <div className="flex items-center gap-2">
                       <p className="text-3xl font-bold text-slate-800">₱{formatCompactNumber(currentMonthData.totalSales / 100)}</p>
                       <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" /> Sales
                       </span>
                    </div>
                 </div>
                 <div className="h-px bg-slate-100 w-full" />
                 <div>
                    <p className="text-xs text-slate-400 mb-1">Total Labor Cost</p>
                    <div className="flex items-center gap-2">
                       <p className="text-3xl font-bold text-rose-600">₱{formatCompactNumber(currentMonthData.totalLaborCost / 100)}</p>
                       <span className="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center">
                          <TrendingDown className="w-3 h-3 mr-1" /> Cost
                       </span>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* 3. Insight Card */}
           <Card className="bg-gradient-to-br from-blue-50/80 to-white/80 backdrop-blur-xl border-blue-100/60 shadow-sm rounded-3xl">
              <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> AI Insight
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-slate-700 font-medium leading-relaxed">
                    {currentMonthData.laborCostPercentage < 3500
                      ? "Excellent work! Your labor costs are optimized. This efficiency maximizes profitability."
                      : currentMonthData.laborCostPercentage < 4500
                      ? "Performance is stable, but watch out for overtime spikes during low-sales periods."
                      : "Labor costs are eating into margins. Consider reviewing scheduling efficiency or increasing sales targets."}
                 </p>
                 {improvement && parseFloat(improvement) > 0 && (
                    <div className="mt-4 p-3 bg-emerald-100/50 rounded-xl border border-emerald-100 flex items-center gap-3">
                       <div className="bg-emerald-500 text-white p-1.5 rounded-full"><TrendingDown className="w-4 h-4" /></div>
                       <div>
                          <p className="text-xs text-emerald-800 font-bold uppercase">Improvement</p>
                          <p className="text-sm text-emerald-900">Reduced costs by <span className="font-bold">{improvement}%</span> vs last month.</p>
                       </div>
                    </div>
                 )}
              </CardContent>
           </Card>

           {/* 4. Trend Chart (Spans 2 cols) */}
           <Card className="lg:col-span-2 bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
              <CardHeader>
                 <CardTitle className="text-lg font-bold text-slate-800">6-Month Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 p-3 rounded-xl shadow-xl text-sm">
                                <p className="font-bold text-slate-800 mb-2 border-b border-slate-200/60 pb-2">
                                  {data.fullMonth}, {data.year}
                                </p>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                                      <span className="text-slate-500">Sales:</span>
                                    </div>
                                    <span className="font-mono font-medium text-slate-900">
                                      ₱{data.sales.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-red-500" />
                                      <span className="text-slate-500">Labor:</span>
                                    </div>
                                    <span className="font-mono font-medium text-rose-600">
                                      ₱{data.laborCost.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" name="Sales" />
                      <Area type="monotone" dataKey="laborCost" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" name="Labor Cost" />
                    </AreaChart>
                 </ResponsiveContainer>
              </CardContent>
           </Card>
        </div>
      ) : (
        <div className="text-center py-20 bg-white/40 border border-dashed border-slate-200 rounded-3xl">
             <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <DollarSign className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-lg font-semibold text-slate-900">No Data Available</h3>
             <p className="text-slate-500 max-w-md mx-auto mt-2 mb-6">Start tracking your labor efficiency by adding your first month's financial data.</p>
             <Button onClick={() => setIsDialogOpen(true)} className="rounded-full bg-slate-900">Add Data Now</Button>
        </div>
      )}

      {/* Detailed History Table */}
      {laborCostData && laborCostData.length > 0 && (
          <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-white/50 border-b border-slate-100 px-6 py-4">
                <CardTitle className="text-lg font-bold text-slate-800">Historical Data</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-500">
                        <tr>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">Month</th>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-right">Sales</th>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-right">Labor Cost</th>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-right">Efficiency %</th>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-center">Status</th>
                            <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {laborCostData.map((data: LaborCostData) => (
                            <tr key={data.id} className="hover:bg-white/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {getMonthName(data.month)} {data.year}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-600">
                                    ₱{formatCompactNumber(data.totalSales / 100)}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-rose-600">
                                    ₱{formatCompactNumber(data.totalLaborCost / 100)}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-800">
                                    {(data.laborCostPercentage / 100).toFixed(1)}%
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center">
                                       {getStatusBadge(data.status || "")}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={() => handleEdit(data)}>
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={() => setDeleteId(data.id)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </Card>
      )}

      {/* Delete Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This financial record will be permanently removed.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 rounded-full" onClick={() => deleteId && deleteLaborCostMutation.mutate(deleteId)}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}