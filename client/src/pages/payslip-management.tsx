import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit2, Check, X, Loader2, RefreshCw } from 'lucide-react';

// --- Constants ---
const HOURLY_RATE = 58.75;
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 1.25;

export default function PayrollManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState({ 
    month: 11, // November (matching your seed data)
    year: 2025 
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    regularHours: 0,
    overtimeHours: 0,
    nightDiffHours: 0,
    hourlyRate: HOURLY_RATE,      
    basicSalary: 0,
    allowances: { overtime: 0, nightDiff: 0, otherAllowances: 0, bonuses: 0 },
    deductions: { tax: 0, sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
  });

  // --- Real API Data Fetching ---
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["/api/team"],
  });

  const { data: existingPayslips } = useQuery({
    queryKey: ["/api/payslips", selectedPeriod.month, selectedPeriod.year],
    queryFn: async () => {
       const res = await fetch(`/api/payslips?month=${selectedPeriod.month}&year=${selectedPeriod.year}`);
       if (!res.ok) throw new Error("Failed");
       return res.json();
    }
  });

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["/api/attendance/period", selectedPeriod.month, selectedPeriod.year],
    queryFn: async () => { 
        const res = await fetch(`/api/attendance/period?month=${selectedPeriod.month}&year=${selectedPeriod.year}`);
        if (!res.ok) throw new Error("Failed");
        return res.json();
    } 
  });

  // --- Core Calculation Logic ---
  
  // Helper: Calculate intersection of work hours with Night Shift (10PM - 6AM)
  const getNightDiffHours = (timeInMs: number, timeOutMs: number) => {
    let start = new Date(timeInMs);
    let end = new Date(timeOutMs);
    let ndHours = 0;

    // We loop hour by hour to check for 10PM-6AM
    // This is a simplified approach robust enough for typical shifts
    let current = new Date(start);
    // Align to next hour start
    current.setMinutes(0, 0, 0); 
    if (current.getTime() < start.getTime()) current.setHours(current.getHours() + 1);

    while (current.getTime() < end.getTime()) {
        const h = current.getHours();
        // Night diff is 22:00 (10PM) to 6:00 (6AM)
        if (h >= 22 || h < 6) {
            // Check if this full hour is within the work period
            // (For precision, you'd calculate exact minutes, but hourly blocks are standard for basic payroll)
            ndHours += 1;
        }
        current.setHours(current.getHours() + 1);
    }
    return ndHours;
  };

  const processAttendanceForUser = (userId: string, records: any[]) => {
    if (!records) return { regularHours: 0, overtimeHours: 0, nightDiffHours: 0 };

    const userRecords = records.filter((r: any) => r.userId === userId);
    
    let totalRegMinutes = 0;
    let totalOTMinutes = 0;
    let totalNDHours = 0;

    userRecords.forEach((record: any) => {
        // Only count if they have clocked out
        if (record.timeOut && record.totalWorkMinutes) {
            const workMinutes = record.totalWorkMinutes;
            
            // Standard Shift is 8 hours (480 minutes)
            if (workMinutes > 480) {
                totalRegMinutes += 480;
                totalOTMinutes += (workMinutes - 480);
            } else {
                totalRegMinutes += workMinutes;
            }

            // Calculate Night Diff based on timestamps
            totalNDHours += getNightDiffHours(record.timeIn, record.timeOut);
        }
    });

    return { 
        regularHours: Math.floor(totalRegMinutes / 60), 
        overtimeHours: parseFloat((totalOTMinutes / 60).toFixed(2)), 
        nightDiffHours: totalNDHours 
    };
  };

  // --- Financial Formulas ---
  const computePagIbig = (gross: number) => (gross * 0.02) > 100 ? 100 : gross * 0.02;
  const computePhilHealth = (gross: number) => (gross * 0.05) / 2;
  const computeSSS = (gross: number) => (gross * 0.045); 
  const computeTax = (gross: number) => {
    if (gross <= 20833) return 0;
    if (gross <= 33332) return (gross - 20833) * 0.15;
    if (gross <= 66666) return 1875 + (gross - 33332) * 0.2;
    return 8541 + (gross - 66666) * 0.25;
  };
  const calculateGrossPay = (basic: number, allowancesObj: any) => parseFloat((basic || 0).toString()) + Object.values(allowancesObj).reduce((acc: number, curr: any) => acc + (parseFloat(curr) || 0), 0);
  const calculateTotalDeductions = (deductionsObj: any) => Object.values(deductionsObj).reduce((acc: number, curr: any) => acc + (parseFloat(curr) || 0), 0);
  const calculateNetPay = (gross: number, totalDeductions: number) => gross - totalDeductions;

  // --- Mutations ---
  const createPayslipMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if(!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Payslip saved to database." });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setEditingId(null);
    }
  });

  // --- Handlers ---
  const handleEdit = (employee: any) => {
    setEditingId(employee.id);
    
    // 1. Process Real Attendance Data
    const { regularHours, overtimeHours, nightDiffHours } = processAttendanceForUser(employee.id, attendanceData);

    setEditForm({
      regularHours,
      overtimeHours,
      nightDiffHours,
      hourlyRate: HOURLY_RATE,
      basicSalary: 0, 
      allowances: { overtime: 0, nightDiff: 0, otherAllowances: 0, bonuses: 0 },
      deductions: { tax: 0, sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
    });
  };

  const handleSave = async (employeeId: string) => {
    const grossPay = calculateGrossPay(editForm.basicSalary, editForm.allowances);
    const totalDeductions = calculateTotalDeductions(editForm.deductions);
    const netPay = calculateNetPay(grossPay, totalDeductions);

    createPayslipMutation.mutate({
      userId: employeeId,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      basicSalary: Math.round(editForm.basicSalary * 100), // Convert to cents for DB
      allowances: {
        overtime: Math.round(editForm.allowances.overtime * 100),
        nightDiff: Math.round(editForm.allowances.nightDiff * 100),
        allowances: Math.round(editForm.allowances.otherAllowances * 100),
        bonuses: Math.round(editForm.allowances.bonuses * 100),
      },
      deductions: {
        tax: Math.round(editForm.deductions.tax * 100),
        sss: Math.round(editForm.deductions.sss * 100),
        philHealth: Math.round(editForm.deductions.philHealth * 100),
        pagIbig: Math.round(editForm.deductions.pagIbig * 100),
        others: Math.round(editForm.deductions.others * 100),
      },
      grossPay: Math.round(grossPay * 100),
      netPay: Math.round(netPay * 100)
    });
  };

  // --- Effects (Auto-Calculate Money when Hours Change) ---
  useEffect(() => {
    if (editingId) {
      const rate = editForm.hourlyRate;
      const basicPay = editForm.regularHours * rate;
      const otPay = editForm.overtimeHours * (rate * OT_MULTIPLIER);
      const ndPay = editForm.nightDiffHours * (rate * ND_MULTIPLIER);

      setEditForm(prev => ({
        ...prev,
        basicSalary: Math.round(basicPay * 100) / 100,
        allowances: {
          ...prev.allowances,
          overtime: Math.round(otPay * 100) / 100,
          nightDiff: Math.round(ndPay * 100) / 100,
        }
      }));
    }
  }, [editForm.regularHours, editForm.overtimeHours, editForm.nightDiffHours, editingId]);

  useEffect(() => {
    if (editingId) {
      const gross = calculateGrossPay(editForm.basicSalary, editForm.allowances);
      setEditForm(prev => ({
        ...prev,
        deductions: {
          ...prev.deductions,
          tax: Math.round(computeTax(gross) * 100) / 100,
          sss: Math.round(computeSSS(gross) * 100) / 100,
          philHealth: Math.round(computePhilHealth(gross) * 100) / 100,
          pagIbig: Math.round(computePagIbig(gross) * 100) / 100,
        }
      }));
    }
  }, [editForm.basicSalary, editForm.allowances]);

  // --- Render ---
  const processedEmployees = useMemo(() => {
    if (!teamMembers) return [];
    const onlyEmployees = teamMembers.filter((m: any) => m.role === 'employee');
    return onlyEmployees.map((emp: any) => {
      const slip = existingPayslips?.find((p: any) => p.userId === emp.id);
      return { ...emp, payslipStatus: slip ? 'generated' : 'pending', lastPay: slip };
    });
  }, [teamMembers, existingPayslips]);

  const filteredEmployees = processedEmployees.filter((emp: any) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingTeam || isLoadingAttendance) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payroll Management</h1>
              <p className="text-gray-600">Period: {selectedPeriod.month}/{selectedPeriod.year}</p>
            </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Employee</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Hours (Auto)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase w-48">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee: any) => {
                  const isEditing = editingId === employee.id;
                  
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-gray-500">{employee.position}</div>
                      </td>
                      
                      <td className="px-4 py-4 text-center align-top">
                        {isEditing ? (
                            <div className="flex flex-col gap-2 items-center">
                                <div className="flex items-center gap-2 text-xs" title="Regular Hours">
                                    <span className="w-8 text-right text-gray-500">Reg:</span>
                                    <input type="number" value={editForm.regularHours} onChange={e => setEditForm({...editForm, regularHours: parseFloat(e.target.value) || 0})} className="w-16 text-right border rounded p-1" />
                                </div>
                                <div className="flex items-center gap-2 text-xs" title="Overtime Hours">
                                    <span className="w-8 text-right text-orange-600">OT:</span>
                                    <input type="number" value={editForm.overtimeHours} onChange={e => setEditForm({...editForm, overtimeHours: parseFloat(e.target.value) || 0})} className="w-16 text-right border border-orange-200 bg-orange-50 rounded p-1" />
                                </div>
                                <div className="flex items-center gap-2 text-xs" title="Night Differential Hours">
                                    <span className="w-8 text-right text-indigo-600">ND:</span>
                                    <input type="number" value={editForm.nightDiffHours} onChange={e => setEditForm({...editForm, nightDiffHours: parseFloat(e.target.value) || 0})} className="w-16 text-right border border-indigo-200 bg-indigo-50 rounded p-1" />
                                </div>
                            </div>
                        ) : (
                             // View Mode: Show calculated summary if attendance exists, else --
                             <div className="text-xs text-gray-500 italic mt-2">
                                {attendanceData && attendanceData.length > 0 ? "Ready to Calc" : "No Data"}
                             </div>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right align-top">
                        {isEditing ? (
                            <div className="flex flex-col gap-1 items-end">
                                <div className="text-sm font-bold">₱{editForm.basicSalary.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-400 mb-1">Basic</div>
                                {(editForm.allowances.overtime > 0) && <div className="text-xs text-orange-600">+₱{editForm.allowances.overtime} <span className="text-[10px]">(OT)</span></div>}
                                {(editForm.allowances.nightDiff > 0) && <div className="text-xs text-indigo-600">+₱{editForm.allowances.nightDiff} <span className="text-[10px]">(ND)</span></div>}
                                <div className="flex items-center gap-2 mt-1 pt-1 border-t w-full justify-end">
                                    <span className="text-[10px] text-gray-500">Bonus:</span>
                                    <input type="number" value={editForm.allowances.bonuses} onChange={e => setEditForm({...editForm, allowances: {...editForm.allowances, bonuses: parseFloat(e.target.value) || 0}})} className="w-16 text-right border rounded p-0.5 text-xs" />
                                </div>
                            </div>
                        ) : "-"}
                      </td>
                      
                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                             <div className="flex flex-col w-full">
                                <div className="text-right font-bold text-red-600 mb-2 border-b pb-1">
                                    -₱{calculateTotalDeductions(editForm.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-600"><span>Tax:</span><span>{editForm.deductions.tax}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>SSS:</span><span>{editForm.deductions.sss}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>PhilHealth:</span><span>{editForm.deductions.philHealth}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>Pag-IBIG:</span><span>{editForm.deductions.pagIbig}</span></div>
                                    <div className="flex justify-between items-center text-xs text-gray-600 pt-1 mt-1 border-t border-dashed">
                                        <span>Other:</span>
                                        <input type="number" value={editForm.deductions.others} onChange={e => setEditForm({...editForm, deductions: {...editForm.deductions, others: parseFloat(e.target.value) || 0}})} className="w-16 text-right border border-red-200 bg-red-50 rounded p-0.5 text-xs" />
                                    </div>
                                </div>
                             </div>
                        ) : "-"}
                      </td>
                      
                      <td className="px-4 py-4 text-right font-bold text-green-600 text-lg align-top">
                        {isEditing ? (
                            calculateNetPay(calculateGrossPay(editForm.basicSalary, editForm.allowances), calculateTotalDeductions(editForm.deductions))
                            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        ) : "--"}
                      </td>

                      <td className="px-4 py-4 text-center align-top">
                        {isEditing ? (
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => handleSave(employee.id)} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Check className="w-4 h-4"/></button>
                                <button onClick={() => setEditingId(null)} className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            employee.payslipStatus === 'pending' ? (
                                <button onClick={() => handleEdit(employee)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 mx-auto border border-blue-200">
                                    <Edit2 className="w-3 h-3" /> Calc
                                </button>
                            ) : (
                                <span className="text-green-600 text-xs font-bold border border-green-200 bg-green-50 px-2 py-1 rounded-full">Done</span>
                            )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}