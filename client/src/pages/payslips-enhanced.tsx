import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Eye, TrendingUp, DollarSign } from "lucide-react";
import type { Payslip } from "@shared/schema";

// Constants for reverse calculation of hours (Must match PayrollManagement)
const HOURLY_RATE = 58.75;
const OT_RATE = HOURLY_RATE * 1.25;
const ND_RATE = HOURLY_RATE * 1.25;

export default function PayslipsEnhanced() {
  const { user } = useAuth();
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

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

  const getPeriodLabel = (payslip: Payslip) => {
    // Use the DB field if available, otherwise fallback to date inference for old records
    if (payslip.period) {
        return payslip.period === 1 ? "1st Half" : "2nd Half";
    }
    // Fallback for old records
    if (!payslip.generatedAt) return "Regular";
    const date = new Date(payslip.generatedAt);
    const day = date.getDate();
    return day <= 15 ? "1st Half" : "2nd Half";
  };

  const getDeductionBreakdown = (payslip: Payslip) => {
    const deductions = payslip.deductions as Record<string, number> || {};
    
    const data = Object.entries(deductions).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
      value: value,
    }));

    return data.filter(item => item.value > 0);
  };

  const getEarningsData = (payslip: Payslip) => {
    const allowances = payslip.allowances as Record<string, number> || {};
    
    // Raw amounts in cents
    const basic = payslip.basicSalary || 0;
    const overtime = allowances.overtime || 0;
    const nightDiff = allowances.nightDiff || 0;
    const bonuses = allowances.bonuses || 0;
    const otherAllowances = allowances.allowances || allowances.otherAllowances || 0;

    // Calculate Hours (Amount in Pesos / Rate)
    const basicHours = (basic / 100) / HOURLY_RATE;
    const overtimeHours = (overtime / 100) / OT_RATE;
    const nightDiffHours = (nightDiff / 100) / ND_RATE;

    return [
        { label: "Basic Salary", amount: basic, hours: basicHours, hasHours: true },
        { label: "Overtime", amount: overtime, hours: overtimeHours, hasHours: true, highlight: true },
        { label: "Night Differential", amount: nightDiff, hours: nightDiffHours, hasHours: true, highlight: true },
        { label: "Bonuses", amount: bonuses, hasHours: false },
        { label: "Other Allowances", amount: otherAllowances, hasHours: false },
    ].filter(item => item.amount > 0);
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Payslips & Salary Analytics</h1>
          <p className="text-muted-foreground">View detailed salary history and income breakdown</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Salary History</h2>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading payslips...</p>
            </div>
          ) : payslips && payslips.length > 0 ? (
            payslips.map((payslip: Payslip) => {
                const periodLabel = getPeriodLabel(payslip);
                const earnings = getEarningsData(payslip);
                const deductions = getDeductionBreakdown(payslip);

                return (
                  <Card key={payslip.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {getMonthName(payslip.month)} {payslip.year} 
                              <Badge variant="outline" className="font-normal">
                                {periodLabel}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Generated on {formatDate(payslip.generatedAt!)}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">Paid</Badge>
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
                        <div className="mt-6 pt-6 border-t grid grid-cols-1 lg:grid-cols-2 gap-8">
                          
                          {/* Earnings Section */}
                          <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                Earnings Breakdown
                            </h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-500">Earnings</th>
                                            <th className="px-4 py-2 text-center font-medium text-gray-500">Hours</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {earnings.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className={`px-4 py-2 ${item.highlight ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                                    {item.label}
                                                </td>
                                                <td className="px-4 py-2 text-center text-gray-500">
                                                    {item.hasHours ? Math.round(item.hours * 10) / 10 : '-'}
                                                </td>
                                                <td className={`px-4 py-2 text-right ${item.highlight ? 'font-medium text-green-600' : ''}`}>
                                                    {formatCurrency(item.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 font-semibold">
                                            <td className="px-4 py-3">Total Gross</td>
                                            <td className="px-4 py-3 text-center">-</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(payslip.grossPay)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                          </div>

                          {/* Deductions Section - Table View */}
                          <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-red-600" />
                                Deductions Breakdown
                            </h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-500">Description</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {deductions.length > 0 ? (
                                            deductions.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-2 text-gray-600">{item.name}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurrency(item.value)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-4 text-center text-gray-400 italic">No deductions</td>
                                            </tr>
                                        )}
                                        <tr className="bg-gray-50 font-semibold text-red-600">
                                            <td className="px-4 py-3">Total Deductions</td>
                                            <td className="px-4 py-3 text-right">
                                                -{formatCurrency(payslip.grossPay - payslip.netPay)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Net Pay Highlight */}
                            <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-lg flex justify-between items-center">
                                <span className="font-bold text-green-800">NET PAY</span>
                                <span className="text-xl font-bold text-green-700">{formatCurrency(payslip.netPay)}</span>
                            </div>
                          </div>

                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
            })
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