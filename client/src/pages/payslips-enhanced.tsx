import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, TrendingUp, DollarSign, Wallet, Clock, ChevronDown, Shield, Loader2 } from "lucide-react";
import type { Payslip, PayItems } from "@shared/schema";
import { HOURLY_RATE, OT_MULTIPLIER, ND_MULTIPLIER } from "@/utils/salary_computation";
import { cn } from "@/lib/utils";

// --- RBAC Imports ---
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";

// --- SEPARATED STYLES ---
const styles = {
  container: "p-6 md:p-8 max-w-7xl mx-auto space-y-8",
  
  // Header
  headerRow: "flex flex-col md:flex-row justify-between items-start md:items-end gap-4",
  title: "text-3xl font-bold tracking-tight text-slate-900",
  subtitle: "text-slate-500 mt-1",
  
  // List Section
  sectionHeader: "text-lg font-semibold text-slate-800 flex items-center gap-2",
  sectionIcon: "w-5 h-5 text-slate-500",
  listGrid: "grid grid-cols-1 gap-6",
  
  // Payslip Card
  cardBase: "bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm transition-all duration-300",
  cardInteractive: "hover:bg-white/80 hover:shadow-md",
  cardExpanded: "ring-2 ring-slate-200 shadow-md bg-white/80",
  summaryContainer: "p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer",
  
  // Icon & Date Info
  iconBox: "h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm",
  iconText: "text-xs font-bold uppercase",
  payslipTitle: "text-lg font-bold text-slate-800",
  badgeRow: "flex items-center gap-2 mt-1",
  periodBadge: "bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal border border-slate-200",
  dateText: "text-xs text-slate-400 hidden sm:inline-block",
  
  // Net Pay Preview
  netPayPreviewBox: "flex items-center gap-6 w-full md:w-auto justify-between md:justify-end",
  netPayLabelText: "text-xs font-medium text-slate-500 uppercase tracking-wider",
  netPayPreviewValue: "text-xl font-bold text-emerald-600",
  chevronBtn: "rounded-full transition-transform duration-300",
  
  // Expanded Content
  expandedArea: "px-6 pb-6 animate-in slide-in-from-top-2 duration-200",
  separator: "mb-6 bg-slate-200/60",
  detailsGrid: "grid grid-cols-1 md:grid-cols-2 gap-8",
  
  // Breakdown Boxes
  breakdownTitle: "text-sm font-semibold text-slate-900 flex items-center gap-2",
  breakdownBox: "bg-slate-50/50 rounded-xl border border-slate-100 p-4 space-y-3 mt-4",
  breakdownRow: "flex justify-between items-center text-sm",
  breakdownLabel: "text-slate-700 font-medium",
  breakdownHours: "text-xs text-slate-400",
  breakdownValue: "text-slate-900 font-mono",
  breakdownValueRed: "text-rose-600 font-mono",
  totalRow: "flex justify-between items-center font-bold text-slate-800",
  totalRowRed: "flex justify-between items-center font-bold text-rose-700",
  
  // Highlight Net Pay Box
  highlightBox: "mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center",
  highlightIconBox: "p-2 bg-emerald-100 rounded-full text-emerald-600",
  highlightTitle: "text-xs font-bold text-emerald-800 uppercase tracking-wider",
  highlightSub: "text-xs text-emerald-600",
  highlightValue: "text-2xl font-bold text-emerald-700 tracking-tight",
  
  // Empty & Lockout States
  emptyCard: "bg-white/40 border-dashed border-slate-200",
  emptyContent: "py-12 text-center",
  emptyIconBox: "w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4",
  lockoutCard: "w-full max-w-md bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-lg rounded-3xl",
  lockoutContent: "py-12 text-center space-y-4",
  lockoutIconBox: "w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500",
};

export default function PayslipsEnhanced() {
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const canViewPayslips = hasPermission(Permission.VIEW_OWN_PAYSLIP);

  const { data: payslips, isLoading } = useQuery<Payslip[]>({
    queryKey: ["/api/payslips"],
    enabled: canViewPayslips,
  });

  // --- Formatting Helpers ---
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
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  };

  const getPeriodLabel = (payslip: Payslip) => {
    if (payslip.period !== undefined && payslip.period !== null) {
      return payslip.period === 1 ? "1st Half (1-15)" : "2nd Half (16-End)";
    }
    if (!payslip.generatedAt) return "Regular";
    const date = new Date(payslip.generatedAt);
    const day = date.getDate();
    return day <= 15 ? "1st Half (1-15)" : "2nd Half (16-End)";
  };

  // --- Schema Mapping Logic ---
  const getEarningsData = (payslip: Payslip) => {
    const basic = payslip.basicSalary || 0;
    const overtime = payslip.overtimePay || 0;
    const nightDiff = payslip.nightDiffPay || 0;
    const holiday = payslip.holidayPay || 0;
    
    // Parse JSON arrays
    const allowances = (payslip.allowances as PayItems[]) || [];

    const basicHours = (basic / 100) / HOURLY_RATE;
    const overtimeHours = (overtime / 100) / (HOURLY_RATE * OT_MULTIPLIER);
    const nightDiffHours = (nightDiff / 100) / (HOURLY_RATE * ND_MULTIPLIER);

    // Standard fixed columns
    const baseItems = [
      { label: "Basic Salary", amount: basic, hours: basicHours, hasHours: true },
      { label: "Overtime", amount: overtime, hours: overtimeHours, hasHours: true },
      { label: "Night Differential", amount: nightDiff, hours: nightDiffHours, hasHours: true },
      { label: "Holiday Pay", amount: holiday, hasHours: false },
    ];

    // Dynamic JSON allowances
    const dynamicItems = allowances.map(a => ({
      label: a.name,
      amount: a.amount,
      hasHours: false
    }));

    return [...baseItems, ...dynamicItems].filter(item => item.amount > 0);
  };

  const getDeductionBreakdown = (payslip: Payslip) => {
    // Standard fixed columns
    const baseItems = [
      { name: "SSS", value: payslip.sssContribution || 0 },
      { name: "PhilHealth", value: payslip.philHealthContribution || 0 },
      { name: "Pag-IBIG", value: payslip.pagIbigContribution || 0 },
      { name: "Withholding Tax", value: payslip.withholdingTax || 0 },
    ];

    // Dynamic JSON deductions
    const dynamicItems = ((payslip.otherDeductions as PayItems[]) || []).map(d => ({
      name: d.name,
      value: d.amount
    }));

    return [...baseItems, ...dynamicItems].filter(item => item.value > 0);
  };

  // --- UI Renders ---

  // RBAC Lockout State
  if (!canViewPayslips) {
    return (
      <div className="p-8 flex justify-center items-center h-[80vh]">
        <Card className={styles.lockoutCard}>
          <CardContent className={styles.lockoutContent}>
            <div className={styles.lockoutIconBox}>
                <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
            <p className="text-slate-500">You do not have permission to view payslips. Please contact HR if you believe this is an error.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading State
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className={styles.container}>
      
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>My Payslips</h1>
          <p className={styles.subtitle}>View your salary history and income breakdown</p>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className={styles.sectionHeader}>
            <FileText className={styles.sectionIcon} /> Recent Payslips
        </h2>
        
        {payslips && payslips.length > 0 ? (
          <div className={styles.listGrid}>
            {[...payslips].sort((a, b) => new Date(b.generatedAt!).getTime() - new Date(a.generatedAt!).getTime()).map((payslip: Payslip) => {
                const periodLabel = getPeriodLabel(payslip);
                const earnings = getEarningsData(payslip);
                const deductions = getDeductionBreakdown(payslip);
                const isExpanded = selectedPayslip?.id === payslip.id;

                return (
                  <Card key={payslip.id} className={cn(styles.cardBase, isExpanded ? styles.cardExpanded : styles.cardInteractive)}>
                    <CardContent className="p-0">
                        {/* Summary Header Row */}
                        <div className={styles.summaryContainer} onClick={() => setSelectedPayslip(isExpanded ? null : payslip)}>
                            <div className="flex items-center gap-4">
                                <div className={styles.iconBox}>
                                    <span className={styles.iconText}>{getMonthName(payslip.month).substring(0, 3)}</span>
                                </div>
                                <div>
                                    <h3 className={styles.payslipTitle}>{getMonthName(payslip.month)} {payslip.year}</h3>
                                    <div className={styles.badgeRow}>
                                        <Badge variant="secondary" className={styles.periodBadge}>{periodLabel}</Badge>
                                        <span className={styles.dateText}>• Generated {formatDate(payslip.generatedAt!)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.netPayPreviewBox}>
                                <div className="text-right">
                                    <p className={styles.netPayLabelText}>Net Pay</p>
                                    <p className={styles.netPayPreviewValue}>{formatCurrency(payslip.netPay)}</p>
                                </div>
                                <Button variant="ghost" size="icon" className={cn(styles.chevronBtn, isExpanded ? 'rotate-180 bg-slate-100' : '')}>
                                    <ChevronDown className="w-5 h-5 text-slate-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Expanded Breakdown */}
                        {isExpanded && (
                            <div className={styles.expandedArea}>
                                <Separator className={styles.separator} />
                                
                                <div className={styles.detailsGrid}>
                                    {/* Left: Earnings */}
                                    <div>
                                        <h4 className={styles.breakdownTitle}>
                                            <TrendingUp className="w-4 h-4 text-blue-600" /> Earnings
                                        </h4>
                                        <div className={styles.breakdownBox}>
                                            {earnings.map((item, idx) => (
                                                <div key={`earn-${idx}`} className={styles.breakdownRow}>
                                                    <div>
                                                        <p className={styles.breakdownLabel}>{item.label}</p>
                                                        {item.hasHours && <p className={styles.breakdownHours}>{item.hours.toFixed(1)} hrs</p>}
                                                    </div>
                                                    <p className={styles.breakdownValue}>{formatCurrency(item.amount)}</p>
                                                </div>
                                            ))}
                                            <Separator className="bg-slate-200" />
                                            <div className={styles.totalRow}>
                                                <span>Total Gross</span>
                                                <span>{formatCurrency(payslip.grossPay)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Deductions */}
                                    <div>
                                        <h4 className={styles.breakdownTitle}>
                                            <DollarSign className="w-4 h-4 text-rose-600" /> Deductions
                                        </h4>
                                        <div className={styles.breakdownBox}>
                                            {deductions.length > 0 ? deductions.map((item, idx) => (
                                                <div key={`ded-${idx}`} className={styles.breakdownRow}>
                                                    <p className={styles.breakdownLabel}>{item.name}</p>
                                                    <p className={styles.breakdownValueRed}>-{formatCurrency(item.value)}</p>
                                                </div>
                                            )) : <p className="text-sm text-slate-400 italic">No deductions</p>}
                                            <Separator className="bg-slate-200" />
                                            <div className={styles.totalRowRed}>
                                                <span>Total Deductions</span>
                                                <span>-{formatCurrency(payslip.totalDeductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Net Pay Footer Banner */}
                                <div className={styles.highlightBox}>
                                    <div className="flex items-center gap-2">
                                        <div className={styles.highlightIconBox}>
                                            <Wallet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className={styles.highlightTitle}>Total Net Pay</p>
                                            <p className={styles.highlightSub}>Take home pay</p>
                                        </div>
                                    </div>
                                    <span className={styles.highlightValue}>{formatCurrency(payslip.netPay)}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                  </Card>
                );
            })}
          </div>
        ) : (
          <Card className={styles.emptyCard}>
            <CardContent className={styles.emptyContent}>
               <div className={styles.emptyIconBox}>
                  <FileText className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-medium text-slate-900">No Payslips Found</h3>
               <p className="text-slate-500 mt-1">Your payslip history will appear here once generated.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}