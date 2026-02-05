import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Eye, TrendingUp, DollarSign, Calendar, Wallet, TrendingDown, Clock, ChevronDown } from "lucide-react";
import type { Payslip } from "@shared/schema";
import { BentoCard } from "@/components/custom/bento-card";
import { Loader2 } from "lucide-react";
import { HOURLY_RATE, OT_MULTIPLIER, ND_MULTIPLIER } from "@/utils/salary_computation";

export default function PayslipsEnhanced() {
  const { user } = useAuth();
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const { data: payslips, isLoading } = useQuery<Payslip[]>({
    queryKey: ["/api/payslips"],
  });

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    if (!payslips || payslips.length === 0) return { totalNet: 0, totalGross: 0, latestPay: 0, totalDeductions: 0 };
    
    const totalNet = payslips.reduce((acc, curr) => acc + curr.netPay, 0);
    const totalGross = payslips.reduce((acc, curr) => acc + curr.grossPay, 0);
    const totalDeductions = totalGross - totalNet;
    
    // Sort by date desc to get latest
    const sorted = [...payslips].sort((a, b) => new Date(b.generatedAt!).getTime() - new Date(a.generatedAt!).getTime());
    const latestPay = sorted.length > 0 ? sorted[0].netPay : 0;

    return { totalNet, totalGross, latestPay, totalDeductions };
  }, [payslips]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount / 100);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const getPeriodLabel = (payslip: Payslip) => {
    // Check for null/undefined explicitly since 1 or 2 are valid numbers
        if (payslip.period !== undefined && payslip.period !== null) {
            return payslip.period === 1 ? "1st Half (1-15)" : "2nd Half (16-End)";
        }
        
        // Fallback logic
        if (!payslip.generatedAt) return "Regular";
        const date = new Date(payslip.generatedAt);
        const day = date.getDate();
        return day <= 15 ? "1st Half (1-15)" : "2nd Half (16-End)";
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
    
    const basic = payslip.basicSalary || 0;
    const overtime = allowances.overtime || 0;
    const nightDiff = allowances.nightDiff || 0;
    const bonuses = allowances.bonuses || 0;
    const otherAllowances = allowances.allowances || allowances.otherAllowances || 0;

    const basicHours = (basic / 100) / HOURLY_RATE;
    const overtimeHours = (overtime / 100) / OT_MULTIPLIER;
    const nightDiffHours = (nightDiff / 100) / ND_MULTIPLIER;

    return [
        { label: "Basic Salary", amount: basic, hours: basicHours, hasHours: true },
        { label: "Overtime", amount: overtime, hours: overtimeHours, hasHours: true, highlight: true },
        { label: "Night Differential", amount: nightDiff, hours: nightDiffHours, hasHours: true, highlight: true },
        { label: "Bonuses", amount: bonuses, hasHours: false },
        { label: "Other Allowances", amount: otherAllowances, hasHours: false },
    ].filter(item => item.amount > 0);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Glass Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Payslips</h1>
          <p className="text-slate-500 mt-1">View your salary history and income breakdown</p>
        </div>
      </div>

      {/* Bento Stats */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BentoCard 
            title="Total Earnings (YTD)" 
            value={formatCurrency(stats.totalNet)} 
            icon={Wallet} 
            variant="emerald" 
            testIdPrefix="stat-total-earnings" 
        />
        <BentoCard 
            title="Latest Payout" 
            value={formatCurrency(stats.latestPay)} 
            icon={Clock} 
            variant="default" 
            testIdPrefix="stat-latest-pay" 
        />
        <BentoCard 
            title="Total Deductions" 
            value={formatCurrency(stats.totalDeductions)} 
            icon={TrendingDown} 
            variant="rose" 
            testIdPrefix="stat-deductions" 
        />
      </div> */}

      {/* Payslip List */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" /> Recent Payslips
        </h2>
        
        {payslips && payslips.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {[...payslips].sort((a, b) => new Date(b.generatedAt!).getTime() - new Date(a.generatedAt!).getTime()).map((payslip: Payslip) => {
                const periodLabel = getPeriodLabel(payslip);
                const earnings = getEarningsData(payslip);
                const deductions = getDeductionBreakdown(payslip);
                const isExpanded = selectedPayslip?.id === payslip.id;

                return (
                  <Card key={payslip.id} className={`bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm transition-all duration-300 ${isExpanded ? 'ring-2 ring-slate-200 shadow-md bg-white/80' : 'hover:bg-white/80 hover:shadow-md'}`}>
                    <CardContent className="p-0">
                        {/* Summary Row */}
                        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer" onClick={() => setSelectedPayslip(isExpanded ? null : payslip)}>
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
                                    <span className="text-xs font-bold uppercase">{getMonthName(payslip.month).substring(0, 3)}</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">{getMonthName(payslip.month)} {payslip.year}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal border border-slate-200">{periodLabel}</Badge>
                                        <span className="text-xs text-slate-400 hidden sm:inline-block">• Generated {formatDate(payslip.generatedAt!)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Net Pay</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(payslip.netPay)}</p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={`rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-slate-100' : ''}`}
                                >
                                    <ChevronDown className="w-5 h-5 text-slate-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                            <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                                <Separator className="mb-6 bg-slate-200/60" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Earnings */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-blue-600" /> Earnings
                                        </h4>
                                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 space-y-3">
                                            {earnings.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm">
                                                    <div>
                                                        <p className="text-slate-700 font-medium">{item.label}</p>
                                                        {item.hasHours && <p className="text-xs text-slate-400">{item.hours.toFixed(1)} hrs</p>}
                                                    </div>
                                                    <p className="text-slate-900 font-mono">{formatCurrency(item.amount)}</p>
                                                </div>
                                            ))}
                                            <Separator className="bg-slate-200" />
                                            <div className="flex justify-between items-center font-bold text-slate-800">
                                                <span>Total Gross</span>
                                                <span>{formatCurrency(payslip.grossPay)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-rose-600" /> Deductions
                                        </h4>
                                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 space-y-3">
                                            {deductions.length > 0 ? deductions.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm">
                                                    <p className="text-slate-600">{item.name}</p>
                                                    <p className="text-rose-600 font-mono">-{formatCurrency(item.value)}</p>
                                                </div>
                                            )) : <p className="text-sm text-slate-400 italic">No deductions</p>}
                                            <Separator className="bg-slate-200" />
                                            <div className="flex justify-between items-center font-bold text-rose-700">
                                                <span>Total Deductions</span>
                                                <span>-{formatCurrency(payslip.grossPay - payslip.netPay)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Net Pay Highlight */}
                                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                                            <Wallet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Net Pay</p>
                                            <p className="text-xs text-emerald-600">Take home pay</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-emerald-700 tracking-tight">{formatCurrency(payslip.netPay)}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                  </Card>
                );
            })}
          </div>
        ) : (
          <Card className="bg-white/40 border-dashed border-slate-200">
            <CardContent className="py-12 text-center">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-medium text-slate-900">No Payslips Found</h3>
               <p className="text-slate-500">Your payslip history will appear here once generated.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}