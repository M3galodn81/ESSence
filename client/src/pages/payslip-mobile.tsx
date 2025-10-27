import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Calendar as CalendarIcon, FileText, User, Bell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useLocation } from "wouter";
import type { Payslip } from "@shared/schema";

export default function PayslipMobile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
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

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

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

  const getDeductionBreakdown = (payslip: Payslip) => {
    const deductions = payslip.deductions as any || {};
    const data = [];
    
    if (deductions.tax) data.push({ name: 'Tax', value: deductions.tax, percentage: 52 });
    if (deductions.sss) data.push({ name: 'SSS', value: deductions.sss, percentage: 12 });
    if (deductions.philHealth) data.push({ name: 'PhilHealth', value: deductions.philHealth, percentage: 9 });
    if (deductions.pagIbig) data.push({ name: 'Pag-IBIG', value: deductions.pagIbig, percentage: 4 });
    if (deductions.others) data.push({ name: 'Others', value: deductions.others, percentage: 21 });
    
    return data;
  };

  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const netPayProgress = getNetPayProgress();
  const latestPayslip = payslips && payslips.length > 0 ? payslips[0] : null;

  if (selectedPayslip) {
    
    const allowances = selectedPayslip.allowances as any || {};
    const deductions = selectedPayslip.deductions as any || {};
    const deductionData = getDeductionBreakdown(selectedPayslip);
    const totalDeductions = Object.values(deductions).reduce((sum: number, val: any) => sum + (val || 0), 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 pb-20">
        {}
        <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setSelectedPayslip(null)}
              >
                ←
              </Button>
              <h1 className="text-lg font-semibold">Payslip Details</h1>
            </div>
            <div className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                3
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {}
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">Earnings Breakdown</h2>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-red-600 rounded"></div>
                  <span className="text-sm text-gray-600">Basic Salary</span>
                </div>
                <span className="font-semibold">{formatCurrency(selectedPayslip.basicSalary)}</span>
              </div>

              {allowances.overtime && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-blue-600 rounded"></div>
                    <span className="text-sm text-gray-600">Overtime</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(allowances.overtime)}</span>
                </div>
              )}

              {allowances.allowances && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-green-600 rounded"></div>
                    <span className="text-sm text-gray-600">Allowances</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(allowances.allowances)}</span>
                </div>
              )}

              {allowances.bonuses && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-purple-600 rounded"></div>
                    <span className="text-sm text-gray-600">Bonuses</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(allowances.bonuses)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {}
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 space-y-4">
              <h2 className="font-semibold text-gray-700">Deductions Breakdown</h2>
              
              {}
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={deductionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ percentage }) => `${percentage}%`}
                    >
                      {deductionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalDeductions)}</p>
              </div>

              {}
              <div className="space-y-3 pt-2">
                {deductions.tax && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 bg-red-500 rounded"></div>
                      <span className="text-sm text-gray-600">Tax</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(deductions.tax)}</span>
                  </div>
                )}

                {deductions.sss && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 bg-blue-500 rounded"></div>
                      <span className="text-sm text-gray-600">SSS</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(deductions.sss)}</span>
                  </div>
                )}

                {deductions.philHealth && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-600">PhilHealth</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(deductions.philHealth)}</span>
                  </div>
                )}

                {deductions.pagIbig && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 bg-yellow-500 rounded"></div>
                      <span className="text-sm text-gray-600">Pag-IBIG</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(deductions.pagIbig)}</span>
                  </div>
                )}

                {deductions.others && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-6 bg-purple-500 rounded"></div>
                      <span className="text-sm text-gray-600">Others</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(deductions.others)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex justify-around items-center py-3">
            <button
              onClick={() => setLocation("/")}
              className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
            >
              <Home className="w-5 h-5" />
              <span className="text-xs">Home</span>
            </button>
            <button
              onClick={() => setLocation("/schedules")}
              className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
            >
              <CalendarIcon className="w-5 h-5" />
              <span className="text-xs">Schedule</span>
            </button>
            <button
              onClick={() => setLocation("/payslip-mobile")}
              className="flex flex-col items-center space-y-1 text-amber-600"
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-semibold">Payslip</span>
              <div className="w-12 h-1 bg-amber-600 rounded-full -mt-1"></div>
            </button>
            <button
              onClick={() => setLocation("/profile")}
              className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
            >
              <User className="w-5 h-5" />
              <span className="text-xs">Profile</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 pb-20">
      {}
      <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Payslip</h1>
          <div className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              3
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold text-gray-700 mb-4">Net Pay Progress</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={netPayProgress}>
                <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="netPay"
                  stroke="#78716c"
                  strokeWidth={2}
                  dot={{ fill: '#78716c', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {}
        {latestPayslip && (
          <Card className="bg-gradient-to-br from-amber-100 to-orange-100 shadow-md">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">
                    {getMonthName(latestPayslip.month)}, {latestPayslip.year}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-800">Gross Pay</h3>
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(latestPayslip.grossPay)}</p>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Deductions</span>
                <span className="font-semibold text-gray-800">
                  {formatCurrency(latestPayslip.grossPay - latestPayslip.netPay)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-amber-200">
                <span className="text-sm font-semibold text-gray-700">Net Pay</span>
                <span className="text-xl font-bold text-amber-700">{formatCurrency(latestPayslip.netPay)}</span>
              </div>

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setSelectedPayslip(latestPayslip)}
              >
                View Details
              </Button>
            </CardContent>
          </Card>
        )}

        {}
        {payslips && payslips.length > 1 && (
          <div className="space-y-3">
            {payslips.slice(1).map((payslip: Payslip) => (
              <Card key={payslip.id} className="bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">
                        {getMonthName(payslip.month)}, {payslip.year}
                      </p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatCurrency(payslip.grossPay)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPayslip(payslip)}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading payslips...</p>
          </div>
        )}

        {!isLoading && (!payslips || payslips.length === 0) && (
          <div className="text-center py-8">
            <p className="text-gray-500">No payslips available</p>
          </div>
        )}
      </div>

      {}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex justify-around items-center py-3">
          <button
            onClick={() => setLocation("/")}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setLocation("/schedules")}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
          >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-xs">Schedule</span>
          </button>
          <button
            onClick={() => setLocation("/payslip-mobile")}
            className="flex flex-col items-center space-y-1 text-amber-600"
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs font-semibold">Payslip</span>
            <div className="w-12 h-1 bg-amber-600 rounded-full -mt-1"></div>
          </button>
          <button
            onClick={() => setLocation("/profile")}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-amber-600"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
