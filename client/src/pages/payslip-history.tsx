import React, { useState } from "react";
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
import { Loader2, Pencil, Trash2, Eye, FileText } from "lucide-react";
import type { Payslip } from "@shared/schema";

export default function PayslipHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [editData, setEditData] = useState<any>({});

  // Fetch ALL payslips (Admin/Payroll Officer)
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

  // --- Handlers ---
  const handleEdit = (payslip: any) => {
    setSelectedPayslip(payslip);
    
    // Extract allowances safely
    const allowances = payslip.allowances || {};
    const deductions = payslip.deductions || {};

    // Initialize form with existing values
    setEditData({
        basicSalary: payslip.basicSalary / 100,
        // Allowances
        overtime: (allowances.overtime || 0) / 100,
        nightDiff: (allowances.nightDiff || 0) / 100,
        bonuses: (allowances.bonuses || 0) / 100,
        otherAllowances: (allowances.otherAllowances || allowances.allowances || 0) / 100, // Handle both naming conventions
        // Deductions
        sss: (deductions.sss || 0) / 100,
        philHealth: (deductions.philHealth || 0) / 100,
        pagIbig: (deductions.pagIbig || 0) / 100,
        otherDeductions: (deductions.others || 0) / 100,
        tax: (deductions.tax || 0) / 100,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if(!selectedPayslip) return;
    
    // Reconstruct JSON structure for DB (convert back to cents)
    const payload = {
        basicSalary: Math.round(editData.basicSalary * 100),
        allowances: {
            ...(selectedPayslip.allowances as object),
            overtime: Math.round(editData.overtime * 100),
            nightDiff: Math.round(editData.nightDiff * 100),
            bonuses: Math.round(editData.bonuses * 100),
            otherAllowances: Math.round(editData.otherAllowances * 100),
        },
        deductions: {
            ...(selectedPayslip.deductions as object),
            sss: Math.round(editData.sss * 100),
            philHealth: Math.round(editData.philHealth * 100),
            pagIbig: Math.round(editData.pagIbig * 100),
            others: Math.round(editData.otherDeductions * 100),
            tax: Math.round(editData.tax * 100),
        }
    };

    // Recalculate Net/Gross
    const totalAllowances = Object.values(payload.allowances).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
    const gross = payload.basicSalary + totalAllowances;
    
    const totalDeductions = Object.values(payload.deductions).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
    const net = Math.max(0, gross - totalDeductions);
    
    updatePayslipMutation.mutate({ 
        id: selectedPayslip.id, 
        data: { ...payload, grossPay: gross, netPay: net } 
    });
  };

  const handleDelete = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsDeleteOpen(true);
  };

  const getEmployeeName = (id: string) => {
    const emp = teamMembers?.find((m: any) => m.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
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
            <CardTitle>All Payslips</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips?.map((slip: any) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-medium">{getEmployeeName(slip.userId)}</TableCell>
                  <TableCell>
                    {slip.month}/{slip.year} 
                    <span className="ml-2 text-xs text-muted-foreground">
                        ({slip.period === 1 ? '1st' : '2nd'} Half)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">₱{(slip.grossPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">₱{(slip.netPay / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(slip)}>
                            <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(slip)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!payslips || payslips.length === 0) && (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payslips found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit Payslip Details</DialogTitle>
                <DialogDescription>Manually adjust values. Gross and Net Pay will be recalculated automatically upon save.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider">Earnings</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Basic Salary</Label>
                            <Input type="number" value={editData.basicSalary} onChange={e => setEditData({...editData, basicSalary: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Overtime</Label>
                            <Input type="number" value={editData.overtime} onChange={e => setEditData({...editData, overtime: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Night Diff</Label>
                            <Input type="number" value={editData.nightDiff} onChange={e => setEditData({...editData, nightDiff: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Bonuses</Label>
                            <Input type="number" value={editData.bonuses} onChange={e => setEditData({...editData, bonuses: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Other Allowances</Label>
                            <Input type="number" value={editData.otherAllowances} onChange={e => setEditData({...editData, otherAllowances: parseFloat(e.target.value) || 0})} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider">Deductions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>SSS</Label>
                            <Input type="number" value={editData.sss} onChange={e => setEditData({...editData, sss: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>PhilHealth</Label>
                            <Input type="number" value={editData.philHealth} onChange={e => setEditData({...editData, philHealth: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Pag-IBIG</Label>
                            <Input type="number" value={editData.pagIbig} onChange={e => setEditData({...editData, pagIbig: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Tax</Label>
                            <Input type="number" value={editData.tax} onChange={e => setEditData({...editData, tax: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <Label>Other Deductions</Label>
                            <Input type="number" value={editData.otherDeductions} onChange={e => setEditData({...editData, otherDeductions: parseFloat(e.target.value) || 0})} />
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