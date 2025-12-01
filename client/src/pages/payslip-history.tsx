import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2, ChevronDown, ChevronRight, Eye, Filter, Search } from "lucide-react";
import type { Payslip } from "@shared/schema";
import { computeSSS, computePhilHealth, computePagIbig, HOURLY_RATE, OT_MULTIPLIER, ND_MULTIPLIER } from "@/lib/helper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper for display rounding
const round2 = (num: number) => Math.round(num * 100) / 100;

export default function PayslipHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // Filters
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [searchTerm, setSearchTerm] = useState("");

  // State for the edit form
  const [editForm, setEditForm] = useState({
    regularHours: 0,
    overtimeHours: 0,
    nightDiffHours: 0,
    bonuses: 0,
    otherAllowances: 0,
    otherDeductions: 0,
    basicSalary: 0,
    overtimePay: 0,
    nightDiffPay: 0,
    grossPay: 0,
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    tax: 0,
    netPay: 0
  });

  // Fetch ALL payslips
  const { data: payslips, isLoading } = useQuery({
    queryKey: ["/api/payslips", { all: true }],
    queryFn: async () => {
       const res = await fetch("/api/payslips?all=true");
       if (!res.ok) throw new Error("Failed to fetch payslips");
       return res.json();
    }
  });

  // FIX: Added queryFn to fetch team members
  const { data: teamMembers } = useQuery({ 
    queryKey: ["/api/team"],
    queryFn: async () => {
        const res = await fetch("/api/team");
        if (!res.ok) throw new Error("Failed to fetch team members");
        return res.json();
    }
  });

  // --- Mutations ---
  const updatePayslipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/payslips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if(!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Payslip updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsEditOpen(false);
    },
    onError: (error: Error) => {
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  const deletePayslipMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payslips/${id}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Payslip deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsDeleteOpen(false);
    },
    onError: (error: Error) => {
        toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  });

  // --- Helpers ---
  const getEmployeeName = (id: string) => {
    // If it's the current user
    if (user && String(user.id) === String(id)) return `${user.firstName} ${user.lastName} (You)`;
    
    // Look up in team members
    const emp = teamMembers?.find((m: any) => String(m.id) === String(id));
    return emp ? `${emp.firstName} ${emp.lastName}` : `User ${id}`;
  };

  // --- Auto-Calculation Effect for Edit ---
  // This ensures that when you change hours/bonuses in the UI, the gross/net/deductions update automatically
  
  useEffect(() => {
    if (!isEditOpen) return;

    const basicSalary = round2(editForm.regularHours * HOURLY_RATE);
    const overtimePay = round2(editForm.overtimeHours * (HOURLY_RATE * OT_MULTIPLIER));
    const nightDiffPay = round2(editForm.nightDiffHours * (HOURLY_RATE * ND_MULTIPLIER));
    
    const grossPay = round2(basicSalary + overtimePay + nightDiffPay + editForm.bonuses + editForm.otherAllowances);

    // Re-calculate government deductions based on new basic salary
    const sss = round2(computeSSS(basicSalary)); 
    const philHealth = round2(computePhilHealth(basicSalary)); 
    const pagIbig = round2(computePagIbig(basicSalary)); 
    
    // Default tax to 0 or keep existing logic (simplified here)
    const tax = editForm.tax; 

    const totalDeductions = round2(sss + philHealth + pagIbig + tax + editForm.otherDeductions);
    const netPay = Math.max(0, round2(grossPay - totalDeductions));

    setEditForm(prev => ({
      ...prev,
      basicSalary,
      overtimePay,
      nightDiffPay,
      grossPay,
      sss,
      philHealth,
      pagIbig,
      netPay
    }));
  }, [
    editForm.regularHours, 
    editForm.overtimeHours, 
    editForm.nightDiffHours, 
    editForm.bonuses, 
    editForm.otherAllowances, 
    editForm.otherDeductions,
    editForm.tax,
    isEditOpen
  ]);

  // --- Handlers ---
  const handleEdit = (payslip: any) => {
    setSelectedPayslip(payslip);
    
    const allowances = payslip.allowances || {};
    const deductions = payslip.deductions || {};

    // Convert from cents (Integers) to Currency (Floats) for the form
    const basicVal = payslip.basicSalary / 100;
    const otVal = (allowances.overtime || 0) / 100;
    const ndVal = (allowances.nightDiff || 0) / 100;

    const regularHours = basicVal / HOURLY_RATE;
    const overtimeHours = otVal / (HOURLY_RATE * OT_MULTIPLIER);
    const nightDiffHours = ndVal / (HOURLY_RATE * ND_MULTIPLIER);

    setEditForm({
        regularHours: round2(regularHours),
        overtimeHours: round2(overtimeHours),
        nightDiffHours: round2(nightDiffHours),
        bonuses: (allowances.bonuses || 0) / 100,
        otherAllowances: (allowances.otherAllowances || allowances.allowances || 0) / 100,
        otherDeductions: (deductions.others || 0) / 100,
        basicSalary: basicVal,
        overtimePay: otVal,
        nightDiffPay: ndVal,
        grossPay: payslip.grossPay / 100,
        sss: (deductions.sss || 0) / 100,
        philHealth: (deductions.philHealth || 0) / 100,
        pagIbig: (deductions.pagIbig || 0) / 100,
        tax: (deductions.tax || 0) / 100,
        netPay: payslip.netPay / 100
    });
    setIsEditOpen(true);
  };

  const handleView = (payslip: any) => {
    setSelectedPayslip(payslip);
    setIsViewOpen(true);
  };

  const handleSaveEdit = () => {
    if(!selectedPayslip) return;
    
    // Pack data back into cents (Integers) for the API
    const payload = {
        basicSalary: Math.round(editForm.basicSalary * 100),
        allowances: {
            ...(selectedPayslip.allowances as object),
            overtime: Math.round(editForm.overtimePay * 100),
            nightDiff: Math.round(editForm.nightDiffPay * 100),
            bonuses: Math.round(editForm.bonuses * 100),
            otherAllowances: Math.round(editForm.otherAllowances * 100),
        },
        deductions: {
            ...(selectedPayslip.deductions as object),
            sss: Math.round(editForm.sss * 100),
            philHealth: Math.round(editForm.philHealth * 100),
            pagIbig: Math.round(editForm.pagIbig * 100),
            tax: Math.round(editForm.tax * 100),
            others: Math.round(editForm.otherDeductions * 100),
        },
        grossPay: Math.round(editForm.grossPay * 100),
        netPay: Math.round(editForm.netPay * 100)
    };
    
    updatePayslipMutation.mutate({ id: selectedPayslip.id, data: payload });
  };

  const handleDelete = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsDeleteOpen(true);
  };

  // --- Grouping Logic ---
  const groupedPayslips = useMemo(() => {
    if (!payslips) return [];

    // 1. Filter
    const filtered = payslips.filter((slip: Payslip) => {
        const matchMonth = filterMonth === "all" || slip.month.toString() === filterMonth;
        const matchYear = filterYear === "all" || slip.year.toString() === filterYear;
        const name = getEmployeeName(String(slip.userId)).toLowerCase();
        const matchSearch = name.includes(searchTerm.toLowerCase());
        return matchMonth && matchYear && matchSearch;
    });

    // 2. Group by User+Month+Year
    const groups: Record<string, any> = {};

    filtered.forEach((slip: Payslip) => {
        const key = `${slip.userId}-${slip.month}-${slip.year}`;
        if (!groups[key]) {
            groups[key] = {
                id: key,
                userId: slip.userId,
                month: slip.month,
                year: slip.year,
                slips: [],
                totalGross: 0,
                totalNet: 0,
                totalDeductions: 0,
                totalRegHours: 0,
                totalOTHours: 0,
                totalNDHours: 0,
                deductions: { sss: 0, philHealth: 0, pagIbig: 0, tax: 0, others: 0 }
            };
        }
        
        const basic = slip.basicSalary / 100;
        const allowances = slip.allowances as any || {};
        const deductions = slip.deductions as any || {};
        
        const ot = (allowances.overtime || 0) / 100;
        const nd = (allowances.nightDiff || 0) / 100;

        groups[key].totalRegHours += basic / HOURLY_RATE;
        groups[key].totalOTHours += ot / (HOURLY_RATE * OT_MULTIPLIER);
        groups[key].totalNDHours += nd / (HOURLY_RATE * ND_MULTIPLIER);

        groups[key].deductions.sss += (deductions.sss || 0);
        groups[key].deductions.philHealth += (deductions.philHealth || 0);
        groups[key].deductions.pagIbig += (deductions.pagIbig || 0);
        groups[key].deductions.tax += (deductions.tax || 0);
        groups[key].deductions.others += (deductions.others || 0);

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

  if(isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payslip History</h1>
          <p className="text-slate-500 mt-1 text-sm">View and manage generated payslips.</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="relative w-full max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search..." 
                    className="pl-9 h-8 border-none bg-transparent focus:ring-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 px-2">
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

      <Card className="bg-white/40 backdrop-blur-md border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200/60">
                <tr>
                  <th className="w-[50px] px-4 py-3"></th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs">Employee</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs">Month</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Total Gross</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right text-rose-600">Total Deductions</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right text-emerald-600">Total Net Pay</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-xs text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedPayslips.map((group: any) => (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <TableRow className="bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer transition-colors border-l-4 border-l-transparent hover:border-l-primary/40" onClick={() => toggleGroup(group.id)}>
                        <TableCell className="text-center">
                            {expandedGroups[group.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">{getEmployeeName(group.userId)}</TableCell>
                        <TableCell className="font-medium text-slate-600">{group.month}/{group.year}</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">₱{(group.totalGross / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-medium text-rose-600">-₱{(group.totalDeductions / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">₱{(group.totalNet / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                    
                    {/* Expanded Content */}
                    {expandedGroups[group.id] && (
                        <>
                            {/* Summary Statistics Row */}
                            <TableRow className="bg-slate-50/30">
                                <TableCell></TableCell>
                                <TableCell colSpan={6} className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm border border-slate-200/60 p-5 rounded-2xl bg-white/60 shadow-sm">
                                        <div>
                                            <h4 className="font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
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
                                            <h4 className="font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
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
                                <TableRow key={slip.id} className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-100">
                                    <TableCell></TableCell>
                                    <TableCell className="pl-10 text-slate-500 text-sm border-l-4 border-l-transparent hover:border-l-primary/20">
                                        {slip.period === 1 ? '1st Half (1-15)' : '2nd Half (16-End)'}
                                    </TableCell>
                                    <TableCell className="text-slate-400 text-xs"></TableCell>
                                    <TableCell className="text-right text-slate-600 text-sm font-mono">₱{(slip.grossPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right text-rose-500 text-sm font-mono">-₱{((slip.grossPay - slip.netPay) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right text-emerald-600 font-bold text-sm font-mono">₱{(slip.netPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-emerald-600 hover:bg-emerald-50 rounded-full" onClick={(e) => { e.stopPropagation(); handleView(slip); }} title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50 rounded-full" onClick={(e) => { e.stopPropagation(); handleEdit(slip); }} title="Edit">
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={(e) => { e.stopPropagation(); handleDelete(slip); }} title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
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
                <div className="grid grid-cols-2 gap-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                   <div>
                     <h3 className="font-medium text-sm text-slate-500 uppercase tracking-wider border-b pb-2 mb-3">Earnings</h3>
                     <div className="space-y-2 text-sm">
                         <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span className="font-medium">₱{(selectedPayslip.basicSalary / 100).toLocaleString()}</span></div>
                         <div className="flex justify-between"><span className="text-slate-600">Overtime</span><span className="font-medium">₱{((selectedPayslip.allowances?.overtime || 0) / 100).toLocaleString()}</span></div>
                         <div className="flex justify-between"><span className="text-slate-600">Night Diff</span><span className="font-medium">₱{((selectedPayslip.allowances?.nightDiff || 0) / 100).toLocaleString()}</span></div>
                         {selectedPayslip.allowances?.bonuses > 0 && <div className="flex justify-between"><span className="text-slate-600">Bonuses</span><span className="font-medium">₱{(selectedPayslip.allowances.bonuses / 100).toLocaleString()}</span></div>}
                         {selectedPayslip.allowances?.otherAllowances > 0 && <div className="flex justify-between"><span className="text-slate-600">Allowances</span><span className="font-medium">₱{(selectedPayslip.allowances.otherAllowances / 100).toLocaleString()}</span></div>}
                         <div className="pt-2 border-t flex justify-between font-bold text-slate-800"><span>Total Gross</span><span>₱{(selectedPayslip.grossPay / 100).toLocaleString()}</span></div>
                     </div>
                   </div>
                   <div>
                      <h3 className="font-medium text-sm text-slate-500 uppercase tracking-wider border-b pb-2 mb-3">Deductions</h3>
                      <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-600">SSS</span><span className="font-medium">₱{((selectedPayslip.deductions?.sss || 0) / 100).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">PhilHealth</span><span className="font-medium">₱{((selectedPayslip.deductions?.philHealth || 0) / 100).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Pag-IBIG</span><span className="font-medium">₱{((selectedPayslip.deductions?.pagIbig || 0) / 100).toLocaleString()}</span></div>
                          {selectedPayslip.deductions?.others > 0 && <div className="flex justify-between"><span className="text-slate-600">Others</span><span className="font-medium">₱{((selectedPayslip.deductions?.others || 0) / 100).toLocaleString()}</span></div>}
                          <div className="pt-2 border-t flex justify-between font-bold text-rose-600"><span>Total Deductions</span><span>-₱{((selectedPayslip.grossPay - selectedPayslip.netPay) / 100).toLocaleString()}</span></div>
                       </div>
                   </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-green-50 border border-green-100 rounded-xl">
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

      {/* Edit Dialog */}
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
                        <h3 className="font-medium text-sm text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Hours & Adjustments</h3>
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
                         <h3 className="font-medium text-sm text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">Calculated Summary</h3>
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