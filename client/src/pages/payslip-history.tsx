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
import { Loader2, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { Payslip } from "@shared/schema";
import { computeSSS, computePhilHealth, computePagIbig } from "@/lib/helper";

// --- Constants ---
const HOURLY_RATE = 58.75;
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 0.1; // 10% for Night Diff

const round2 = (num: number) => Math.round(num * 100) / 100;

export default function PayslipHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // State for the edit form
  const [editForm, setEditForm] = useState({
    regularHours: 0,
    overtimeHours: 0,
    nightDiffHours: 0,
    bonuses: 0,
    otherAllowances: 0,
    otherDeductions: 0,
    // Calculated values held in state for display/saving
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

  // Fetch ALL payslips (Admin/Payroll Officer/Manager)
  const { data: payslips, isLoading } = useQuery({
    queryKey: ["/api/payslips", { all: true }],
    queryFn: async () => {
       const res = await fetch("/api/payslips/all");
       if (!res.ok) throw new Error("Failed to fetch payslips");
       return res.json();
    }
  });

  const { data: teamMembers } = useQuery({ queryKey: ["/api/team"] });

  // --- Mutations ---
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
      toast({ title: "Updated", description: "Payslip updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsEditOpen(false);
    }
  });

  const deletePayslipMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payslips/${id}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Payslip deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setIsDeleteOpen(false);
    }
  });

  // --- Auto-Calculation Effect ---
  useEffect(() => {
    if (!isEditOpen) return;

    // 1. Calculate Earnings
    const basicSalary = round2(editForm.regularHours * HOURLY_RATE);
    const overtimePay = round2(editForm.overtimeHours * (HOURLY_RATE * OT_MULTIPLIER));
    const nightDiffPay = round2(editForm.nightDiffHours * (HOURLY_RATE * ND_MULTIPLIER));
    
    const grossPay = round2(basicSalary + overtimePay + nightDiffPay + editForm.bonuses + editForm.otherAllowances);

    // 2. Calculate Deductions (Consolidated Monthly Basis logic)
    let calculationBase = grossPay; 
    let previousDeductions = { sss: 0, philHealth: 0, pagIbig: 0 };

    // If editing a 2nd Half payslip, find the 1st Half to calculate differentials
    if (selectedPayslip && selectedPayslip.period === 2 && payslips) {
        const slip1 = payslips.find((p: any) => 
            p.userId === selectedPayslip.userId && 
            p.month === selectedPayslip.month && 
            p.year === selectedPayslip.year &&
            p.period === 1
        );

        if (slip1) {
            calculationBase = grossPay + (slip1.grossPay / 100);
            if (slip1.deductions) {
                const d = slip1.deductions as any;
                previousDeductions = {
                    sss: (d.sss || 0) / 100,
                    philHealth: (d.philHealth || 0) / 100,
                    pagIbig: (d.pagIbig || 0) / 100
                };
            }
        }
    }

    // Compute Gov Contributions based on TOTAL MONTHLY GROSS
    const totalSSS = computeSSS(calculationBase);
    const totalPH = computePhilHealth(calculationBase);
    const totalHDMF = computePagIbig(calculationBase);

    // Deduct what was already paid in 1st half
    const sss = Math.max(0, round2(totalSSS - previousDeductions.sss));
    const philHealth = Math.max(0, round2(totalPH - previousDeductions.philHealth));
    const pagIbig = Math.max(0, round2(totalHDMF - previousDeductions.pagIbig));
    
    const tax = 0; // Tax disabled

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
      tax,
      netPay
    }));
  }, [
    editForm.regularHours, 
    editForm.overtimeHours, 
    editForm.nightDiffHours, 
    editForm.bonuses, 
    editForm.otherAllowances, 
    editForm.otherDeductions,
    isEditOpen,
    selectedPayslip, // Added dependency to ensure period check works
    payslips // Added dependency to find 1st half
  ]);

  // --- Handlers ---
  const handleEdit = (payslip: any) => {
    setSelectedPayslip(payslip);
    
    const allowances = payslip.allowances || {};
    const deductions = payslip.deductions || {};

    const basicVal = payslip.basicSalary / 100;
    const otVal = (allowances.overtime || 0) / 100;
    const ndVal = (allowances.nightDiff || 0) / 100;

    // Reverse Calculate Hours
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
        // Initial display values
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

  const handleSaveEdit = () => {
    if(!selectedPayslip) return;
    
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

  const getEmployeeName = (id: string) => {
    if (user && user.id === id) return `${user.firstName} ${user.lastName} (You)`;
    const emp = teamMembers?.find((m: any) => m.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

  // --- Grouping Logic ---
  const groupedPayslips = useMemo(() => {
    if (!payslips) return [];

    const groups: Record<string, any> = {};

    payslips.forEach((slip: Payslip) => {
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
                totalDeductions: 0
            };
        }
        groups[key].slips.push(slip);
        groups[key].totalGross += slip.grossPay;
        groups[key].totalNet += slip.netPay;
        groups[key].totalDeductions += (slip.grossPay - slip.netPay);
    });

    return Object.values(groups).sort((a: any, b: any) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
  }, [payslips]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if(isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Payslip History</h1>
        <p className="text-muted-foreground">View and manage generated payslips.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Monthly Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Total Gross</TableHead>
                <TableHead className="text-right text-red-600">Total Deductions</TableHead>
                <TableHead className="text-right text-green-600">Total Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedPayslips.map((group: any) => (
                <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <TableRow className="bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors" onClick={() => toggleGroup(group.id)}>
                        <TableCell className="text-center">
                            {expandedGroups[group.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-semibold">{getEmployeeName(group.userId)}</TableCell>
                        <TableCell className="font-medium">{group.month}/{group.year}</TableCell>
                        <TableCell className="text-right font-medium">₱{(group.totalGross / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">-₱{(group.totalDeductions / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-green-700">₱{(group.totalNet / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                    
                    {/* Detailed Rows (Collapsible) */}
                    {expandedGroups[group.id] && group.slips.map((slip: Payslip) => (
                         <TableRow key={slip.id} className="bg-white hover:bg-gray-50">
                             <TableCell></TableCell>
                             <TableCell className="pl-10 text-gray-500 text-sm border-l-4 border-l-transparent hover:border-l-primary/20">
                                {slip.period === 1 ? '1st Half (1-15)' : '2nd Half (16-End)'}
                             </TableCell>
                             <TableCell className="text-gray-500 text-sm"></TableCell>
                             <TableCell className="text-right text-gray-600 text-sm">₱{(slip.grossPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                             <TableCell className="text-right text-red-400 text-sm">-₱{((slip.grossPay - slip.netPay) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                             <TableCell className="text-right text-green-600 font-medium text-sm">₱{(slip.netPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                             <TableCell className="text-center">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEdit(slip); }}>
                                        <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(slip); }}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                             </TableCell>
                         </TableRow>
                    ))}
                </React.Fragment>
              ))}
              {(!groupedPayslips || groupedPayslips.length === 0) && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payslips found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl">
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
                        <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider border-b pb-1">Hours & Adjustments</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">Reg Hours</Label>
                                <Input type="number" value={editForm.regularHours} onChange={e => setEditForm({...editForm, regularHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">OT Hours</Label>
                                <Input type="number" value={editForm.overtimeHours} onChange={e => setEditForm({...editForm, overtimeHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">ND Hours</Label>
                                <Input type="number" value={editForm.nightDiffHours} onChange={e => setEditForm({...editForm, nightDiffHours: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Bonuses</Label>
                                <Input type="number" value={editForm.bonuses} onChange={e => setEditForm({...editForm, bonuses: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground">Other Allowances</Label>
                                <Input type="number" value={editForm.otherAllowances} onChange={e => setEditForm({...editForm, otherAllowances: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground">Other Deductions</Label>
                                <Input type="number" value={editForm.otherDeductions} onChange={e => setEditForm({...editForm, otherDeductions: Math.max(0, parseFloat(e.target.value) || 0)})} />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Computed Values */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                         <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider border-b pb-1">Calculated Summary</h3>
                         <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Basic Salary:</span><span className="font-medium">₱{editForm.basicSalary.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Overtime Pay:</span><span className="font-medium">₱{editForm.overtimePay.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Night Diff:</span><span className="font-medium">₱{editForm.nightDiffPay.toLocaleString()}</span></div>
                            <div className="flex justify-between pt-2 border-t font-bold"><span>Gross Pay:</span><span>₱{editForm.grossPay.toLocaleString()}</span></div>

                            <div className="pt-2 space-y-1">
                                <div className="flex justify-between text-xs text-red-600"><span>SSS:</span><span>-{editForm.sss.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-red-600"><span>PhilHealth:</span><span>-{editForm.philHealth.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-red-600"><span>Pag-IBIG:</span><span>-{editForm.pagIbig.toLocaleString()}</span></div>
                                {/* <div className="flex justify-between text-xs text-red-600"><span>Tax:</span><span>-{editForm.tax.toLocaleString()}</span></div> */}
                                <div className="flex justify-between text-xs text-red-600"><span>Other Ded:</span><span>-{editForm.otherDeductions.toLocaleString()}</span></div>
                            </div>

                            <div className="flex justify-between pt-4 border-t text-lg font-bold text-green-700">
                                <span>Net Pay:</span><span>₱{editForm.netPay.toLocaleString()}</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. The record for <strong>{selectedPayslip && getEmployeeName(selectedPayslip.userId)}</strong> will be permanently removed.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => selectedPayslip && deletePayslipMutation.mutate(selectedPayslip.id)}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}