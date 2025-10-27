import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLaborCostDataSchema } from "@shared/schema";
import { z } from "zod";
import { DollarSign, TrendingUp, TrendingDown, Plus, AlertCircle, CheckCircle, Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { LaborCostData } from "@shared/schema";

const laborCostFormSchema = insertLaborCostDataSchema;
type LaborCostForm = z.infer<typeof laborCostFormSchema>;

export default function LaborCostAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: laborCostData, isLoading } = useQuery({
    queryKey: ["/api/labor-cost-data", selectedYear],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/labor-cost-data?year=${selectedYear}`);
      return await res.json();
    },
  });

  const form = useForm<LaborCostForm>({
    resolver: zodResolver(laborCostFormSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      totalSales: 0,
      totalLaborCost: 0,
      laborCostPercentage: 0,
      status: "",
      performanceRating: "",
      notes: "",
    },
  });

  const createLaborCostMutation = useMutation({
    mutationFn: async (data: LaborCostForm) => {
      
      const percentage = (data.totalLaborCost / data.totalSales) * 10000; 
      
      let status = "";
      let performanceRating = "";
      
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
      } else {
        status = "Poor";
        performanceRating = "critical";
      }

      const res = await apiRequest("POST", "/api/labor-cost-data", {
        ...data,
        laborCostPercentage: Math.round(percentage),
        status,
        performanceRating,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Data added",
        description: "Labor cost data has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/labor-cost-data"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LaborCostForm) => {
    createLaborCostMutation.mutate(data);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount / 100);
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
      "Excellent": { color: "bg-gray-700 text-white", icon: CheckCircle },
      "High": { color: "bg-gray-400 text-gray-900", icon: AlertCircle },
      "Poor": { color: "bg-red-600 text-white", icon: AlertCircle },
    };
    const config = variants[status] || variants["High"];
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getRatingBadge = (rating: string) => {
    const colors: Record<string, string> = {
      good: "bg-gray-700 text-white",
      warning: "bg-gray-400 text-gray-900",
      critical: "bg-red-600 text-white",
    };
    return (
      <Badge className={colors[rating] || colors.warning}>
        ⭐ {rating.charAt(0).toUpperCase() + rating.slice(1)}
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
    sales: data.totalSales / 100,
    laborCost: data.totalLaborCost / 100,
    laborPercent: data.laborCostPercentage / 100,
  })) || [];

  if (user?.role !== 'manager' && user?.role !== 'hr') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Access denied. This page is only available to managers and HR.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Labor Cost Analytics</h1>
            <p className="text-muted-foreground">Track labor costs as a percentage of sales</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Labor Cost Data</DialogTitle>
                <DialogDescription>
                  Enter monthly sales and labor cost data
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Input
                      id="month"
                      type="number"
                      min="1"
                      max="12"
                      {...form.register("month", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      {...form.register("year", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalSales">Total Sales (₱)</Label>
                  <Input
                    id="totalSales"
                    type="number"
                    {...form.register("totalSales", { valueAsNumber: true })}
                    placeholder="e.g., 78500000 (for ₱785,000)"
                  />
                  <p className="text-xs text-muted-foreground">Enter amount in centavos (multiply by 100)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalLaborCost">Total Labor Cost (₱)</Label>
                  <Input
                    id="totalLaborCost"
                    type="number"
                    {...form.register("totalLaborCost", { valueAsNumber: true })}
                    placeholder="e.g., 38500000 (for ₱385,000)"
                  />
                  <p className="text-xs text-muted-foreground">Enter amount in centavos (multiply by 100)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    {...form.register("notes")}
                    placeholder="Any additional notes"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLaborCostMutation.isPending}>
                    {createLaborCostMutation.isPending ? "Adding..." : "Add Data"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {}
        {currentMonthData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-red-600 to-black text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  THE BIG PICTURE - LABOR COST AS % OF SALES
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="12"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={currentMonthData.laborCostPercentage < 3500 ? "#10b981" : currentMonthData.laborCostPercentage < 4500 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="12"
                        strokeDasharray={`${(currentMonthData.laborCostPercentage / 100) * 2.51} 251`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="45" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
                        {(currentMonthData.laborCostPercentage / 100).toFixed(1)}%
                      </text>
                      <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="8">
                        LABOR COST
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/10 rounded p-3">
                    <p className="text-gray-200">Total Sales</p>
                    <p className="font-bold text-lg">{formatCurrency(currentMonthData.totalSales)}</p>
                    <p className="text-xs text-gray-300">100%</p>
                  </div>
                  <div className="bg-white/10 rounded p-3">
                    <p className="text-gray-200">Labor Cost Deducted</p>
                    <p className="font-bold text-lg">{formatCurrency(currentMonthData.totalLaborCost)}</p>
                    <p className="text-xs text-gray-300">{(currentMonthData.laborCostPercentage / 100).toFixed(1)}% of sales</p>
                  </div>
                </div>

                <div className={`rounded p-4 ${
                  currentMonthData.status === "Excellent" ? "bg-gray-700" :
                  currentMonthData.status === "High" ? "bg-gray-500" : "bg-red-600"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">Status</span>
                    <span className="text-2xl">
                      {currentMonthData.status === "Excellent" ? "🟢" :
                       currentMonthData.status === "High" ? "🟡" : "🔴"}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{currentMonthData.status}</p>
                </div>

                <div className="bg-white/10 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span>⭐</span>
                    <span className="font-semibold">Performance Rating</span>
                  </div>
                  <p className="text-lg font-bold capitalize">{currentMonthData.performanceRating}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  INSIGHT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {currentMonthData.laborCostPercentage < 3500
                    ? "Excellent! Your labor costs are well-optimized. Continue maintaining this efficiency."
                    : currentMonthData.laborCostPercentage < 4500
                    ? "Good performance, but there's room for improvement. Consider reviewing staffing levels."
                    : "Consider reviewing staffing levels to improve efficiency and reach target range."}
                </p>

                {improvement && (
                  <div className="bg-muted rounded p-4">
                    <p className="text-sm font-semibold mb-2">PROGRESS TRACKER</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Starting Point ({getMonthName(previousMonthData.month)}):</span>
                      <span className="font-bold">{(previousMonthData.laborCostPercentage / 100).toFixed(1)}% labor cost</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm">Current ({getMonthName(currentMonthData.month)}):</span>
                      <span className="font-bold">{(currentMonthData.laborCostPercentage / 100).toFixed(1)}% labor cost</span>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">Improvement:</span>
                        <span className={`text-2xl font-bold ${parseFloat(improvement) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(improvement) > 0 ? '-' : '+'}{Math.abs(parseFloat(improvement))} percentage points! 🎉
                        </span>
                      </div>
                      {parseFloat(improvement) > 0 && (
                        <p className="text-sm text-gray-700 mt-2">
                          You've dramatically improved efficiency as sales grew!
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Trend Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>MONTHLY TREND: SALES vs LABOR COST</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#000000" name="Sales" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="laborCost" stroke="#dc2626" name="Labor Cost" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="laborPercent" stroke="#6b7280" name="Labor %" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Monthly Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Data</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading data...</p>
              </div>
            ) : laborCostData && laborCostData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Month</th>
                      <th className="text-right p-2">Sales</th>
                      <th className="text-right p-2">Labor Cost</th>
                      <th className="text-right p-2">Labor %</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborCostData.map((data: LaborCostData) => (
                      <tr key={data.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">{getMonthName(data.month)}</td>
                        <td className="text-right p-2">{formatCurrency(data.totalSales)}</td>
                        <td className="text-right p-2">{formatCurrency(data.totalLaborCost)}</td>
                        <td className="text-right p-2 font-semibold">{(data.laborCostPercentage / 100).toFixed(1)}%</td>
                        <td className="text-center p-2">{getStatusBadge(data.status || "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No data available. Add your first entry to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
