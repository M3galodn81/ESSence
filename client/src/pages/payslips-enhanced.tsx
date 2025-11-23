import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, Calendar, TrendingUp, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Payslip } from "@shared/schema";

//Remove Data Analytics here

export default function PayslipsEnhanced() {
  const { user } = useAuth();
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: payslips, isLoading } = useQuery({
    queryKey: ["/api/payslips"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };


  const getDeductionBreakdown = (payslip: Payslip) => {
    const deductions = payslip.deductions as Record<string, number> || {};
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
    const netPay = payslip.netPay;
    
    const data = [
      ...Object.entries(deductions).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: value,
        percentage: ((value / payslip.grossPay) * 100).toFixed(1),
      })),
      {
        name: "Net Pay",
        value: netPay,
        percentage: ((netPay / payslip.grossPay) * 100).toFixed(1),
      }
    ];

    return data;
  };

  //Fix display
  const getNetPayProgress = () => {
    if (!payslips || payslips.length === 0) return [];
    
    return payslips
      .slice(0, 7)
      .reverse()
      .map((p: Payslip) => ({
        month: getMonthName(p.month).substring(0, 3),
        netPay: p.netPay / 100,
      }));
  };

  const COLORS = ['#dc2626', '#000000', '#6b7280', '#9ca3af', '#374151', '#1f2937'];

  const netPayProgress = getNetPayProgress();

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
    percentage,
  }) => {
    if (percentage < 2) return null; // hide small ones

    const RADIAN = Math.PI / 180;
    const r = outerRadius + 25;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#333"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {`${name}: ${percentage}%`}
      </text>
    );
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div>
          <h1 className="text-2xl font-bold">Payslips & Salary Analytics</h1>
          <p className="text-muted-foreground">View detailed salary history and predictions</p>
        </div>

        {}
        
        {}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Salary History</h2>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading payslips...</p>
            </div>
          ) : payslips && payslips.length > 0 ? (
            payslips.map((payslip: Payslip) => (
              <Card key={payslip.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {getMonthName(payslip.month)} {payslip.year}
                        </CardTitle>
                        <CardDescription>
                          Generated on {formatDate(payslip.generatedAt!)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Paid</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPayslip(selectedPayslip?.id === payslip.id ? null : payslip)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {selectedPayslip?.id === payslip.id ? "Hide" : "View"} Details
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Pay</p>
                      <p className="text-lg font-semibold">{formatCurrency(payslip.grossPay)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deductions</p>
                      <p className="text-lg font-semibold text-red-600">
                        -{formatCurrency(payslip.grossPay - payslip.netPay)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(payslip.netPay)}</p>
                    </div>
                  </div>

                  {selectedPayslip?.id === payslip.id && (
                    <div className="mt-6 pt-6 border-t space-y-6">
                      <div>
                        <h3 className="font-semibold mb-4">Deductions Breakdown</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={getDeductionBreakdown(payslip)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomLabel}
                                outerRadius={90}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {getDeductionBreakdown(payslip).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => formatCurrency(value as number)} />
                              
                            </PieChart>
                          </ResponsiveContainer>

                          <div className="space-y-3">
                            {getDeductionBreakdown(payslip).map((item, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  />
                                  <span className="text-sm">{item.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold">{formatCurrency(item.value)}</p>
                                  <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No payslips found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
