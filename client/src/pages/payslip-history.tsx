import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2, ChevronDown, ChevronRight, Eye, Filter, Search } from "lucide-react";
import type { Payslip, PayItems } from "@shared/schema";
import { computeSSS, computePhilHealth, computePagIbig, HOURLY_RATE, OT_MULTIPLIER, ND_MULTIPLIER } from "@/utils/salary_computation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- RBAC Imports ---
import { usePermission } from "@/hooks/use-permission";
import { Permission } from "@/lib/permissions";

// Helper for display rounding
const round2 = (num: number) => Math.round(num * 100) / 100;

// --- SEPARATED STYLES ---
const styles = {
  container: "p-6 md:p-8 max-w-7xl mx-auto space-y-8",
  headerRow: "mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4",
  title: "text-3xl font-bold tracking-tight text-slate-900",
  subtitle: "text-slate-500 mt-1 text-sm",
  
  // Filters
  filterBox: "flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/60 shadow-sm w-full md:w-auto",
  searchWrapper: "relative w-full md:w-auto md:min-w-[200px] flex-1",
  searchInput: "pl-9 h-8 border-none bg-transparent focus:ring-0 w-full",
  divider: "hidden md:block w-px h-4 bg-slate-200",
  selectWrapper: "flex items-center gap-2 px-2",
  
  // Table
  tableCard: "bg-white/60 backdrop-blur-xl border-slate-200/60 shadow-sm rounded-3xl overflow-hidden",
  tableHead: "bg-slate-50/50 border-b border-slate-200/60",
  thBase: "px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs",
  
  // Rows
  groupRow: "bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer transition-colors border-l-4 border-l-transparent hover:border-l-primary/40",
  detailRow: "bg-white hover:bg-gray-50 transition-colors border-b border-gray-100",
  expandedSummaryBg: "bg-slate-50/30",
  expandedSummaryCard: "grid grid-cols-1 md:grid-cols-2 gap-6 text-sm border border-slate-200/60 p-5 rounded-2xl bg-white/60 shadow-sm",
  
  // Buttons
  actionBtnGroup: "flex justify-center gap-2",
  viewBtn: "h-8 w-8 hover:text-emerald-600 hover:bg-emerald-50 rounded-full",
  editBtn: "h-8 w-8 hover:text-blue-600 hover:bg-blue-50 rounded-full",
  deleteBtn: "h-8 w-8 hover:text-red-600 hover:bg-red-50 rounded-full",
  
  // Dialog & View
  sectionTitle: "font-medium text-sm text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3",
  detailCard: "grid grid-cols-2 gap-8 p-4 bg-slate-50 rounded-xl border border-slate-100",
  netPayBanner: "flex justify-between items-center p-4 bg-green-50 border border-green-100 rounded-xl",
};

export default function PayslipHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  
  const canManagePayroll = hasPermission(Permission.MANAGE_PAYROLL);

  const currentYear = new Date().getFullYear();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [searchTerm, setSearchTerm] = useState("");

  const [editForm, setEditForm] = useState({
    regularHours: 0, overtimeHours: 0, nightDiffHours: 0,
    bonuses: 0, otherAllowances: 0, otherDeductions: 0,
    basicSalary: 0, overtimePay: 0, nightDiffPay: 0,
    grossPay: 0, sss: 0, philHealth: 0, pagIbig: 0, tax: 0, netPay: 0
  });

  const { data: payslips, isLoading } = useQuery({
    queryKey: ["/api/payslips", { all: true }],
    queryFn: async () => {
       const res = await fetch("/api/payslips?all=true");
       if (!res.ok) throw new Error("Failed to fetch payslips");
       return res.json();
    }
  });

  const { data: teamMembers } = useQuery({ 
    queryKey: ["/api/team"],
    queryFn: async () => {
        const res = await fetch("/api/team");
        if (!res.ok) throw new Error("Failed to fetch team members");
        return res.json();
    }
  });

  // FIXED: id is now string
  const updatePayslipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/payslips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if(!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Updated", { description: "Payslip updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsEditOpen(false);
    },
    onError: (error: Error) => toast.error("Update Failed", { description: error.message })
  });

  // FIXED: id is now string
  const deletePayslipMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payslips/${id}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Deleted", { description: "Payslip deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsDeleteOpen(false);
    },
    onError: (error: Error) => toast.error("Delete Failed", { description: error.message })
  });

  const getEmployeeName = (id: string) => {
    if (user && String(user.id) === String(id)) return `${user.firstName} ${user.lastName} (You)`;
    const emp = teamMembers?.find((m: any) => String(m.id) === String(id));
    return emp ? `${emp.firstName} ${emp.lastName}` : `User ${id}`;
  };

  useEffect(() => {
    if (!isEditOpen) return;

    const basicSalary = round2(editForm.regularHours * HOURLY_RATE);
    const overtimePay = round2(editForm.overtimeHours * (HOURLY_RATE * OT_MULTIPLIER));
    const nightDiffPay = round2(editForm.nightDiffHours * (HOURLY_RATE * ND_MULTIPLIER));
    
    const grossPay = round2(basicSalary + overtimePay + nightDiffPay + editForm.bonuses + editForm.otherAllowances);
    const sss = round2(computeSSS(basicSalary)); 
    const philHealth = round2(computePhilHealth(basicSalary)); 
    const pagIbig = round2(computePagIbig(basicSalary)); 
    const tax = editForm.tax; 

    const totalDeductions = round2(sss + philHealth + pagIbig + tax + editForm.otherDeductions);
    const netPay = Math.max(0, round2(grossPay - totalDeductions));

    setEditForm(prev => ({
      ...prev, basicSalary, overtimePay, nightDiffPay, grossPay, sss, philHealth, pagIbig, netPay
    }));
  }, [
    editForm.regularHours, editForm.overtimeHours, editForm.nightDiffHours, 
    editForm.bonuses, editForm.otherAllowances, editForm.otherDeductions,
    editForm.tax, isEditOpen
  ]);

  const handleEdit = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    
    // UPDATED: Mapping explicitly against new Schema
    const basicVal = payslip.basicSalary / 100;
    const otVal = (payslip.overtimePay || 0) / 100;
    const ndVal = (payslip.nightDiffPay || 0) / 100;

    const allowancesArr = (payslip.allowances as PayItems[]) || [];
    const bonuses = allowancesArr.find(a => a.name.toLowerCase().includes("bonus"))?.amount || 0;
    const otherAlls = allowancesArr.filter(a => !a.name.toLowerCase().includes("bonus")).reduce((sum, a) => sum + a.amount, 0);

    const deductionsArr = (payslip.otherDeductions as PayItems[]) || [];
    const otherDeds = deductionsArr.reduce((sum, d) => sum + d.amount, 0);

    setEditForm({
        regularHours: round2(basicVal / HOURLY_RATE),
        overtimeHours: round2(otVal / (HOURLY_RATE * OT_MULTIPLIER)),
        nightDiffHours: round2(ndVal / (HOURLY_RATE * ND_MULTIPLIER)),
        bonuses: bonuses / 100,
        otherAllowances: otherAlls / 100,
        otherDeductions: otherDeds / 100,
        basicSalary: basicVal,
        overtimePay: otVal,
        nightDiffPay: ndVal,
        grossPay: payslip.grossPay / 100,
        sss: (payslip.sssContribution || 0) / 100,
        philHealth: (payslip.philHealthContribution || 0) / 100,
        pagIbig: (payslip.pagIbigContribution || 0) / 100,
        tax: (payslip.withholdingTax || 0) / 100,
        netPay: payslip.netPay / 100
    });
    setIsEditOpen(true);
  };

  const handleView = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsViewOpen(true);
  };

  const handleSaveEdit = () => {
    if(!selectedPayslip) return;
    
    // UPDATED: Packing data exactly to match the new strict schema columns
    const payload = {
        basicSalary: Math.round(editForm.basicSalary * 100),
        overtimePay: Math.round(editForm.overtimePay * 100),
        nightDiffPay: Math.round(editForm.nightDiffPay * 100),
        
        sssContribution: Math.round(editForm.sss * 100),
        philHealthContribution: Math.round(editForm.philHealth * 100),
        pagIbigContribution: Math.round(editForm.pagIbig * 100),
        withholdingTax: Math.round(editForm.tax * 100),
        
        allowances: [
            { name: "Bonus", amount: Math.round(editForm.bonuses * 100) },
            { name: "Other Allowances", amount: Math.round(editForm.otherAllowances * 100) }
        ].filter(a => a.amount > 0),
        
        otherDeductions: [
            { name: "Other Deductions", amount: Math.round(editForm.otherDeductions * 100) }
        ].filter(d => d.amount > 0),

        grossPay: Math.round(editForm.grossPay * 100),
        totalDeductions: Math.round((editForm.sss + editForm.philHealth + editForm.pagIbig + editForm.tax + editForm.otherDeductions) * 100),
        netPay: Math.round(editForm.netPay * 100)
    };
    
    updatePayslipMutation.mutate({ id: selectedPayslip.id, data: payload });
  };

  const handleDelete = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsDeleteOpen(true);
  };

  // Grouping Logic
  const groupedPayslips = useMemo(() => {
    if (!payslips) return [];

    const filtered = payslips.filter((slip: Payslip) => {
        const matchMonth = filterMonth === "all" || slip.month.toString() === filterMonth;
        const matchYear = filterYear === "all" || slip.year.toString() === filterYear;
        const name = getEmployeeName(String(slip.userId)).toLowerCase();
        const matchSearch = name.includes(searchTerm.toLowerCase());
        return matchMonth && matchYear && matchSearch;
    });

    const groups: Record<string, any> = {};

    filtered.forEach((slip: Payslip) => {
        const key = `${slip.userId}-${slip.month}-${slip.year}`;
        if (!groups[key]) {
            groups[key] = {
                id: key, userId: slip.userId, month: slip.month, year: slip.year,
                slips: [], totalGross: 0, totalNet: 0, totalDeductions: 0,
                totalRegHours: 0, totalOTHours: 0, totalNDHours: 0,
                deductions: { sss: 0, philHealth: 0, pagIbig: 0, tax: 0, others: 0 }
            };
        }
        
        // UPDATED: Grouping logic references new explicit columns
        const basic = slip.basicSalary / 100;
        const ot = (slip.overtimePay || 0) / 100;
        const nd = (slip.nightDiffPay || 0) / 100;

        groups[key].totalRegHours += basic / HOURLY_RATE;
        groups[key].totalOTHours += ot / (HOURLY_RATE * OT_MULTIPLIER);
        groups[key].totalNDHours += nd / (HOURLY_RATE * ND_MULTIPLIER);

        const otherDeductionsTotal = (slip.otherDeductions as PayItems[] || []).reduce((sum, item) => sum + item.amount, 0);

        groups[key].deductions.sss += (slip.sssContribution || 0);
        groups[key].deductions.philHealth += (slip.philHealthContribution || 0);
        groups[key].deductions.pagIbig += (slip.pagIbigContribution || 0);
        groups[key].deductions.tax += (slip.withholdingTax || 0);
        groups[key].deductions.others += otherDeductionsTotal;

        groups[key].slips.push(slip);
        groups[key].totalGross += slip.grossPay;
        groups[key].totalNet += slip.netPay;
        groups[key].totalDeductions += (slip.grossPay - slip.netPay);
    });

    return Object.values(groups).sort((a: any, b: any) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
  }, [payslips, filterMonth, filterYear, searchTerm, teamMembers]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if(isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className={styles.container}>
      {/* Header & Filters */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Payslip History</h1>
          <p className={styles.subtitle}>View and manage generated payslips.</p>
        </div>
        
        <div className={styles.filterBox}>
            <div className={styles.searchWrapper}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search employee..." 
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className={styles.divider} />
            <div className={styles.selectWrapper}>
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="w-[110px] h-8 border-none bg-transparent shadow-none text-xs font-medium"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-[80px] h-8 border-none bg-transparent shadow-none text-xs font-medium"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (<SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      {/* Main Table */}
      <Card className={styles.tableCard}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className={styles.tableHead}>
                <tr>
                  <th className="w-[50px] px-4 py-3"></th>
                  <th className={styles.thBase}>Employee</th>
                  <th className={styles.thBase}>Month</th>
                  <th className={cn(styles.thBase, "text-right")}>Total Gross</th>
                  <th className={cn(styles.thBase, "text-right text-rose-600")}>Total Deductions</th>
                  <th className={cn(styles.thBase, "text-right text-emerald-600")}>Total Net Pay</th>
                  <th className={cn(styles.thBase, "text-center")}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedPayslips.map((group: any) => (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <TableRow className={styles.groupRow} onClick={() => toggleGroup(group.id)}>
                        <TableCell className="text-center">
                            {expandedGroups[group.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">{getEmployeeName(group.userId)}</TableCell>
                        <TableCell className="font-medium text-slate-600">{group.month}/{group.year}</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">₱{(group.totalGross / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-medium text-rose-600">-₱{(group.totalDeductions / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">₱{(group.totalNet / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                    
                    {/* Expanded Summary */}
                    {expandedGroups[group.id] && (
                        <>
                            <TableRow className={styles.expandedSummaryBg}>
                                <TableCell></TableCell>
                                <TableCell colSpan={6} className="p-4">
                                    <div className={styles.expandedSummaryCard}>
                                        <div>
                                            <h4 className={styles.sectionTitle}>
                                                <Pencil className="w-4 h-4 text-blue-500" /> Monthly Hours
                                            </h4>
                                            <div className="grid grid-cols-2 gap-y-2">
                                                <span className="text-slate-500">Regular:</span>
                                                <span className="font-medium text-slate-700 text-right">{round2(group.totalRegHours)} hrs</span>
                                                <span className="text-slate-500">Overtime:</span>
                                                <span className="font-medium text-slate-700 text-right">{round2(group.totalOTHours)} hrs</span>
                                                <span className="text-slate-500">Night Diff:</span>
                                                <span className="font-medium text-slate-700 text-right">{round2(group.totalNDHours)} hrs</span>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className={styles.sectionTitle}>
                                                <Trash2 className="w-4 h-4 text-rose-500" /> Monthly Deductions
                                            </h4>
                                            <div className="grid grid-cols-2 gap-y-2">
                                                <span className="text-slate-500">SSS:</span>
                                                <span className="font-medium text-slate-700 text-right">₱{(group.deductions.sss / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                <span className="text-slate-500">PhilHealth:</span>
                                                <span className="font-medium text-slate-700 text-right">₱{(group.deductions.philHealth / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                <span className="text-slate-500">Pag-IBIG:</span>
                                                <span className="font-medium text-slate-700 text-right">₱{(group.deductions.pagIbig / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                {group.deductions.others > 0 && (
                                                    <>
                                                        <span className="text-slate-500">Others:</span>
                                                        <span className="font-medium text-slate-700 text-right">₱{(group.deductions.others / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>

                            {/* Detailed Slip Rows */}
                            {group.slips.map((slip: Payslip) => (
                                <TableRow key={slip.id} className={styles.detailRow}>
                                    <TableCell></TableCell>
                                    <TableCell className="pl-10 text-slate-500 text-sm border-l-4 border-l-transparent hover:border-l-primary/20">
                                        {slip.period === 1 ? '1st Half (1-15)' : '2nd Half (16-End)'}
                                    </TableCell>
                                    <TableCell className="text-slate-400 text-xs"></TableCell>
                                    <TableCell className="text-right text-slate-600 text-sm font-mono">₱{(slip.grossPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right text-rose-500 text-sm font-mono">-₱{((slip.grossPay - slip.netPay) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right text-emerald-600 font-bold text-sm font-mono">₱{(slip.netPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                        <div className={styles.actionBtnGroup}>
                                            <Button variant="ghost" size="icon" className={styles.viewBtn} onClick={(e) => { e.stopPropagation(); handleView(slip); }} title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            
                                            {/* RBAC: Only Payroll/Admin can edit or delete */}
                                            {canManagePayroll && (
                                              <>
                                                <Button variant="ghost" size="icon" className={styles.editBtn} onClick={(e) => { e.stopPropagation(); handleEdit(slip); }} title="Edit">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(slip); }} title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                              </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </>
                    )}
                  </React.Fragment>
              ))}
              
              {(!groupedPayslips || groupedPayslips.length === 0) && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                        No payslips found matching your filters.
                    </TableCell>
                </TableRow>
              )}
            </tbody >
            </table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog (Read-Only) */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
                <DialogTitle>Payslip Details</DialogTitle>
                <DialogDescription>
                    Detailed breakdown for {selectedPayslip && getEmployeeName(String(selectedPayslip.userId))}
                </DialogDescription>
            </DialogHeader>
            {selectedPayslip && (
             <div className="grid gap-6 py-4">
                <div className={styles.detailCard}>
                   <div>
                     <h3 className={styles.sectionTitle}>Earnings</h3>
                     <div className="space-y-2 text-sm">
                         <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span className="font-medium">₱{(selectedPayslip.basicSalary / 100).toLocaleString()}</span></div>
                         {selectedPayslip.overtimePay > 0 && <div className="flex justify-between"><span className="text-slate-600">Overtime</span><span className="font-medium">₱{(selectedPayslip.overtimePay / 100).toLocaleString()}</span></div>}
                         {selectedPayslip.nightDiffPay > 0 && <div className="flex justify-between"><span className="text-slate-600">Night Diff</span><span className="font-medium">₱{(selectedPayslip.nightDiffPay / 100).toLocaleString()}</span></div>}
                         
                         {/* Map JSON Array of Allowances */}
                         {(selectedPayslip.allowances as PayItems[] || []).map((item, idx) => (
                             <div key={`allowance-${idx}`} className="flex justify-between"><span className="text-slate-600">{item.name}</span><span className="font-medium">₱{(item.amount / 100).toLocaleString()}</span></div>
                         ))}
                         
                         <div className="pt-2 border-t flex justify-between font-bold text-slate-800"><span>Total Gross</span><span>₱{(selectedPayslip.grossPay / 100).toLocaleString()}</span></div>
                     </div>
                   </div>
                   <div>
                      <h3 className={styles.sectionTitle}>Deductions</h3>
                      <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-600">SSS</span><span className="font-medium">₱{((selectedPayslip.sssContribution || 0) / 100).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">PhilHealth</span><span className="font-medium">₱{((selectedPayslip.philHealthContribution || 0) / 100).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Pag-IBIG</span><span className="font-medium">₱{((selectedPayslip.pagIbigContribution || 0) / 100).toLocaleString()}</span></div>
                          {selectedPayslip.withholdingTax > 0 && <div className="flex justify-between"><span className="text-slate-600">Withholding Tax</span><span className="font-medium">₱{((selectedPayslip.withholdingTax || 0) / 100).toLocaleString()}</span></div>}

                          {/* Map JSON Array of other deductions */}
                          {(selectedPayslip.otherDeductions as PayItems[] || []).map((item, idx) => (
                             <div key={`deduction-${idx}`} className="flex justify-between"><span className="text-slate-600">{item.name}</span><span className="font-medium">₱{(item.amount / 100).toLocaleString()}</span></div>
                          ))}

                          <div className="pt-2 border-t flex justify-between font-bold text-rose-600"><span>Total Deductions</span><span>-₱{((selectedPayslip.grossPay - selectedPayslip.netPay) / 100).toLocaleString()}</span></div>
                       </div>
                   </div>
                </div>
                <div className={styles.netPayBanner}>
                   <span className="text-sm font-bold text-green-800 uppercase tracking-wide">Net Pay</span>
                   <span className="text-2xl font-bold text-green-700">₱{(selectedPayslip.netPay / 100).toLocaleString()}</span>
                </div>
             </div>
            )}
            <DialogFooter>
                <Button onClick={() => setIsViewOpen(false)} className="rounded-full">Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (RBAC Protected logically by the button that opens it) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
            <DialogHeader>
                <DialogTitle>Edit Payslip Details</DialogTitle>
                <DialogDescription>
                    Adjust hours and other amounts. Tax and Government contributions are auto-calculated.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                    {/* Left Column: Inputs */}
                    <div className="space-y-4">
                        <h3 className={styles.sectionTitle}>Hours & Adjustments</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-slate-500">Reg Hours</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.regularHours} onChange={e => setEditForm({...editForm, regularHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">OT Hours</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.overtimeHours} onChange={e => setEditForm({...editForm, overtimeHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">ND Hours</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.nightDiffHours} onChange={e => setEditForm({...editForm, nightDiffHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Bonuses</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.bonuses} onChange={e => setEditForm({...editForm, bonuses: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-slate-500">Other Allowances</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.otherAllowances} onChange={e => setEditForm({...editForm, otherAllowances: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-slate-500">Other Deductions</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.otherDeductions} onChange={e => setEditForm({...editForm, otherDeductions: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                             <div className="col-span-2">
                                <Label className="text-xs text-slate-500">Tax</Label>
                                <Input type="number" className="rounded-xl border-slate-200" value={editForm.tax} onChange={e => setEditForm({...editForm, tax: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Computed Values */}
                    <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                         <h3 className={styles.sectionTitle}>Calculated Summary</h3>
                         <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Basic Salary:</span><span className="font-medium text-slate-700">₱{editForm.basicSalary.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Overtime Pay:</span><span className="font-medium text-slate-700">₱{editForm.overtimePay.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Night Diff:</span><span className="font-medium text-slate-700">₱{editForm.nightDiffPay.toLocaleString()}</span></div>
                            <div className="flex justify-between pt-2 border-t border-slate-200 font-bold"><span>Gross Pay:</span><span>₱{editForm.grossPay.toLocaleString()}</span></div>

                            <div className="pt-2 space-y-1">
                                <div className="flex justify-between text-xs text-rose-600"><span>SSS:</span><span>-{editForm.sss.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-rose-600"><span>PhilHealth:</span><span>-{editForm.philHealth.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-rose-600"><span>Pag-IBIG:</span><span>-{editForm.pagIbig.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-rose-600"><span>Tax:</span><span>-{editForm.tax.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-rose-600"><span>Other Ded:</span><span>-{editForm.otherDeductions.toLocaleString()}</span></div>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-slate-200 text-lg font-bold text-emerald-600">
                                <span>Net Pay:</span><span>₱{editForm.netPay.toLocaleString()}</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full">Cancel</Button>
                <Button onClick={handleSaveEdit} className="rounded-full bg-slate-900 hover:bg-slate-800">Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. The record for <strong>{selectedPayslip && getEmployeeName(String(selectedPayslip.userId))}</strong> will be permanently removed.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 rounded-full" onClick={() => selectedPayslip && deletePayslipMutation.mutate(selectedPayslip.id)}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}