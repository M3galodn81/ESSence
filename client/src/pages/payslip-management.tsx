import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit2, Check, X, Loader2, RefreshCw, CalendarDays } from 'lucide-react';
import { computeSSS, computePhilHealth, computePagIbig } from '@/lib/helper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    month: 11, // November
    year: 2025,
    half: 1 // 1 = 1st Half (1-15), 2 = 2nd Half (16-End)
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    regularHours: 0,
    overtimeHours: 0,
    nightDiffHours: 0,
    hourlyRate: HOURLY_RATE,      
    basicSalary: 0,
    allowances: { overtime: 0, nightDiff: 0, otherAllowances: 0, bonuses: 0 },
    deductions: { sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
  });

  // --- Real API Data Fetching ---
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["/api/team"],
  });

  const { data: existingPayslips } = useQuery({
    // Include half in query key if you update backend filtering, otherwise we filter locally below
    queryKey: ["/api/payslips", selectedPeriod.month, selectedPeriod.year], 
    queryFn: async () => {
       const res = await fetch(`/api/payslips?month=${selectedPeriod.month}&year=${selectedPeriod.year}`);
       if (!res.ok) throw new Error("Failed");
       return res.json();
    }
  });

  // --- Date Range Calculation Logic ---
  const { startDate, endDate } = useMemo(() => {
    const year = selectedPeriod.year;
    const monthIndex = selectedPeriod.month - 1; 
    let start, end;

    if (selectedPeriod.half === 1) {
        // 1st Half: 1st to 15th
        start = new Date(year, monthIndex, 1);
        end = new Date(year, monthIndex, 15, 23, 59, 59);
    } else {
        // 2nd Half: 16th to Last Day of Month
        start = new Date(year, monthIndex, 16);
        end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
    }

    return { 
        startDate: start.toISOString(), 
        endDate: end.toISOString() 
    };
  }, [selectedPeriod]);

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["/api/attendance/all", startDate, endDate],
    queryFn: async () => { 
        const res = await fetch(`/api/attendance/all?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error("Failed");
        return res.json();
    } 
  });

  // --- Core Calculation Logic ---
  const getNightDiffHours = (timeIn: string | number, timeOut: string | number) => {
    let start = new Date(timeIn);
    let end = new Date(timeOut);
    let ndHours = 0;

    let current = new Date(start);
    current.setMinutes(0, 0, 0); 
    if (current.getTime() < start.getTime()) current.setHours(current.getHours() + 1);

    while (current.getTime() < end.getTime()) {
        const h = current.getHours();
        if (h >= 22 || h < 6) {
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
        if (record.timeOut && record.totalWorkMinutes) {
            const workMinutes = record.totalWorkMinutes;
            
            if (workMinutes > 480) {
                totalRegMinutes += 480;
                totalOTMinutes += (workMinutes - 480);
            } else {
                totalRegMinutes += workMinutes;
            }

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
      toast({ title: "Success", description: "Payslip generated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setEditingId(null);
      setIsConfirmOpen(false);
    }
  });

  // --- Handlers ---
  const handleEdit = (employee: any) => {
    setEditingId(employee.id);
    
    const { regularHours, overtimeHours, nightDiffHours } = processAttendanceForUser(employee.id, attendanceData);

    setEditForm({
      regularHours,
      overtimeHours,
      nightDiffHours,
      hourlyRate: HOURLY_RATE,
      basicSalary: 0, 
      allowances: { overtime: 0, nightDiff: 0, otherAllowances: 0, bonuses: 0 },
      deductions: { sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
    });
  };

  const handleInitiateSave = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!editingId) return;

    const grossPay = calculateGrossPay(editForm.basicSalary, editForm.allowances);
    const netPay = calculateNetPay(grossPay, calculateTotalDeductions(editForm.deductions));

    createPayslipMutation.mutate({
      userId: editingId,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      period: selectedPeriod.half, // Added Period/Half to DB insert
      basicSalary: Math.round(editForm.basicSalary * 100),
      allowances: {
        overtime: Math.round(editForm.allowances.overtime * 100),
        nightDiff: Math.round(editForm.allowances.nightDiff * 100),
        allowances: Math.round(editForm.allowances.otherAllowances * 100),
        bonuses: Math.round(editForm.allowances.bonuses * 100),
      },
      deductions: {
        tax: 0,
        sss: Math.round(editForm.deductions.sss * 100),
        philHealth: Math.round(editForm.deductions.philHealth * 100),
        pagIbig: Math.round(editForm.deductions.pagIbig * 100),
        others: Math.round(editForm.deductions.others * 100),
      },
      grossPay: Math.round(grossPay * 100),
      netPay: Math.round(netPay * 100)
    });
  };

  // --- Effects ---
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
      const basic = editForm.basicSalary;
      const sss = computeSSS(basic);
      const philHealth = computePhilHealth(basic);
      const pagIbig = computePagIbig(basic);

      setEditForm(prev => ({
        ...prev,
        deductions: {
          ...prev.deductions,
          sss: Math.round(sss * 100) / 100,
          philHealth: Math.round(philHealth * 100) / 100,
          pagIbig: Math.round(pagIbig * 100) / 100,
        }
      }));
    }
  }, [editForm.basicSalary, editForm.allowances]);

  const editingEmployeeName = useMemo(() => {
    if (!editingId || !teamMembers) return "";
    const emp = teamMembers.find((m: any) => m.id === editingId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
  }, [editingId, teamMembers]);

  const currentNetPay = useMemo(() => {
    const gross = calculateGrossPay(editForm.basicSalary, editForm.allowances);
    const deduc = calculateTotalDeductions(editForm.deductions);
    return calculateNetPay(gross, deduc);
  }, [editForm]);

  // --- Render & Processing ---
  const processedEmployees = useMemo(() => {
    if (!teamMembers) return [];
    const onlyEmployees = teamMembers.filter((m: any) => m.role === 'employee' ); 
    
    return onlyEmployees.map((emp: any) => {
      // Filter existing payslips by BOTH month AND period (half)
      const slip = existingPayslips?.find((p: any) => 
        p.userId === emp.id && 
        p.month === selectedPeriod.month && 
        p.year === selectedPeriod.year &&
        (p.period === selectedPeriod.half || (!p.period && selectedPeriod.half === 1)) // Fallback for old records
      );
      return { ...emp, payslipStatus: slip ? 'generated' : 'pending', lastPay: slip };
    });
  }, [teamMembers, existingPayslips, selectedPeriod]);

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
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarDays className="w-4 h-4" />
                <span>Period: {selectedPeriod.month}/{selectedPeriod.year}</span>
                
                <div className="ml-4 flex items-center gap-2">
                    <span className="text-sm font-medium">Cutoff:</span>
                    <Select 
                        value={selectedPeriod.half.toString()} 
                        onValueChange={(val) => setSelectedPeriod(prev => ({ ...prev, half: parseInt(val) }))}
                    >
                        <SelectTrigger className="w-[180px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1st Half (1-15)</SelectItem>
                            <SelectItem value="2">2nd Half (16-End)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
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
                  
                  const computed = processAttendanceForUser(employee.id, attendanceData || []);
                  const viewBasic = computed.regularHours * HOURLY_RATE;
                  const viewOT = computed.overtimeHours * (HOURLY_RATE * OT_MULTIPLIER);
                  const viewND = computed.nightDiffHours * (HOURLY_RATE * ND_MULTIPLIER);
                  const viewGross = viewBasic + viewOT + viewND;
                  
                  const vSSS = computeSSS(viewBasic);
                  const vPH = computePhilHealth(viewBasic);
                  const vHDMF = computePagIbig(viewBasic);

                  const viewDeductions = {
                      tax: 0,
                      sss: vSSS,
                      philHealth: vPH,
                      pagIbig: vHDMF,
                      others: 0
                  };
                  const viewTotalDeductions = calculateTotalDeductions(viewDeductions);
                  const viewNet = calculateNetPay(viewGross, viewTotalDeductions);
                  
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
                             <div className="flex flex-col gap-1 items-center text-xs">
                                <div title="Regular Hours">Reg: {computed.regularHours}</div>
                                {computed.overtimeHours > 0 && <div className="text-orange-600" title="Overtime">OT: {computed.overtimeHours}</div>}
                                {computed.nightDiffHours > 0 && <div className="text-indigo-600" title="Night Diff">ND: {computed.nightDiffHours}</div>}
                                {(!attendanceData || attendanceData.length === 0) && <span className="text-gray-400 italic">--</span>}
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
                        ) : (
                            <div className="flex flex-col gap-1 items-end">
                                <div className="text-sm font-bold">₱{viewBasic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="text-[10px] text-gray-400 mb-1">Basic</div>
                                {(viewOT > 0) && <div className="text-xs text-orange-600">+₱{viewOT.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px]">(OT)</span></div>}
                                {(viewND > 0) && <div className="text-xs text-indigo-600">+₱{viewND.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px]">(ND)</span></div>}
                            </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                             <div className="flex flex-col w-full">
                                <div className="text-right font-bold text-red-600 mb-2 border-b pb-1">
                                    -₱{calculateTotalDeductions(editForm.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-600"><span>SSS:</span><span>{editForm.deductions.sss}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>PhilHealth:</span><span>{editForm.deductions.philHealth}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>Pag-IBIG:</span><span>{editForm.deductions.pagIbig}</span></div>
                                    <div className="flex justify-between items-center text-xs text-gray-600 pt-1 mt-1 border-t border-dashed">
                                        <span>Other:</span>
                                        <input type="number" value={editForm.deductions.others} onChange={e => setEditForm({...editForm, deductions: {...editForm.deductions, others: parseFloat(e.target.value) || 0}})} className="w-16 text-right border border-red-200 bg-red-50 rounded p-0.5 text-xs" />
                                    </div>
                                </div>
                             </div>
                        ) : (
                             <div className="flex flex-col w-full">
                                <div className="text-right font-bold text-red-600 mb-2 border-b pb-1">
                                    -₱{viewTotalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="space-y-1 opacity-75">
                                    <div className="flex justify-between text-xs text-gray-600"><span>SSS:</span><span>{viewDeductions.sss.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>PhilHealth:</span><span>{viewDeductions.philHealth.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs text-gray-600"><span>Pag-IBIG:</span><span>{viewDeductions.pagIbig.toFixed(2)}</span></div>
                                </div>
                             </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 text-right font-bold text-green-600 text-lg align-top">
                        {isEditing ? (
                            calculateNetPay(calculateGrossPay(editForm.basicSalary, editForm.allowances), calculateTotalDeductions(editForm.deductions))
                            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        ) : (
                            viewNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        )}
                      </td>

                      <td className="px-4 py-4 text-center align-top">
                        {isEditing ? (
                            <div className="flex gap-2 justify-center">
                                <button onClick={handleInitiateSave} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Check className="w-4 h-4"/></button>
                                <button onClick={() => setEditingId(null)} className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleEdit(employee)} 
                                disabled={employee.payslipStatus !== 'pending'}
                                className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 mx-auto border ${
                                    employee.payslipStatus === 'pending' 
                                    ? "text-blue-600 hover:bg-blue-50 border-blue-200" 
                                    : "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed opacity-50"
                                }`}
                            >
                                <Edit2 className="w-3 h-3" /> Edit
                            </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Payslip Generation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to generate the payslip for <strong>{editingEmployeeName}</strong>?
                <br/><br/>
                Period: {selectedPeriod.month}/{selectedPeriod.year} (Cutoff: {selectedPeriod.half === 1 ? '1st Half' : '2nd Half'})
                <br/>
                Net Pay: <strong>₱{currentNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <br/>
                <span className="text-xs text-gray-500">This action cannot be undone easily.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSave} className="bg-green-600 hover:bg-green-700">
                Confirm Generate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}