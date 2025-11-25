import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Edit2, Check, X, Loader2, Clock 
} from 'lucide-react';

export default function PayrollManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- State Management ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState({ 
    month: new Date().getMonth() + 1, 
    year: new Date().getFullYear() 
  });
  
  // Edit Mode State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    hoursWorked: 0,      
    hourlyRate: 58.75,      
    basicSalary: 0,
    allowances: { overtime: 0, otherAllowances: 0, bonuses: 0 },
    deductions: { tax: 0, sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
  });

  // --- Data Fetching ---
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["/api/team"],
  });

  const { data: existingPayslips } = useQuery({
    queryKey: ["/api/payslips", selectedPeriod.month, selectedPeriod.year],
    queryFn: async () => { return []; } // Mock return
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["/api/attendance/period", selectedPeriod.month, selectedPeriod.year],
    queryFn: async () => { return []; } // Mock return
  });

  // --- Logic Block ---

  const computePagIbig = (gross) => (gross * 0.02) > 100 ? 100 : gross * 0.02;
  const computePhilHealth = (gross) => (gross * 0.05) / 2;
  const computeSSS = (gross) => (gross * 0.045); 
  
  const computeTax = (gross) => {
    if (gross <= 20833) return 0;
    if (gross <= 33332) return (gross - 20833) * 0.15;
    if (gross <= 66666) return 1875 + (gross - 33332) * 0.2;
    return 8541 + (gross - 66666) * 0.25;
  };

  const calculateGrossPay = (basic, allowancesObj) => {
    const totalAllowances = Object.values(allowancesObj).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
    return parseFloat(basic || 0) + totalAllowances;
  };

  const calculateTotalDeductions = (deductionsObj) => {
    return Object.values(deductionsObj).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  };

  const calculateNetPay = (gross, totalDeductions) => gross - totalDeductions;

  // --- Mutations ---
  const createPayslipMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/payslips", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Payslip Generated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setEditingId(null);
    },
    onError: (error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // --- Event Handlers ---

  const handleEdit = (employee) => {
    setEditingId(employee.id);
    
    // 1. Get Contract Salary
    const contractMonthlySalary = employee.salary ? employee.salary / 100 : 0;
    
    // 2. Calculate Hourly Rate (Standard: Monthly / 22 days / 8 hours)
    const calculatedHourlyRate = contractMonthlySalary / 22 / 8;

    // 3. Get Attendance Hours
    const totalHours = employee.attendanceSummary?.totalHours || 0;

    // Initialize Form
    setEditForm({
      hoursWorked: totalHours,
      hourlyRate: calculatedHourlyRate,
      basicSalary: 0, // Will be calculated by useEffect
      allowances: { 
        overtime: 0, // Will be calculated by useEffect
        otherAllowances: 0, 
        bonuses: 0 
      },
      deductions: { tax: 0, sss: 0, philHealth: 0, pagIbig: 0, others: 0 }
    });
  };

  // --- NEW: Effect to Recalculate Earnings based on Hours ---
  useEffect(() => {
    if (editingId && editForm.hourlyRate > 0) {
      const hours = parseFloat(editForm.hoursWorked) || 0;
      const rate = editForm.hourlyRate;
      const standardHours = 176; // 22 days * 8 hours

      // Split hours
      const regularHours = Math.min(hours, standardHours);
      const overtimeHours = Math.max(hours - standardHours, 0);

      // Calculate Pay Components
      const newBasicPay = regularHours * rate;
      const newOvertimePay = overtimeHours * (rate * 1.25); // 125% OT Rate

      setEditForm(prev => ({
        ...prev,
        basicSalary: Math.round(newBasicPay),
        allowances: {
          ...prev.allowances,
          overtime: Math.round(newOvertimePay)
        }
      }));
    }
  }, [editForm.hoursWorked, editForm.hourlyRate, editingId]);

  // --- Effect to Recalculate Deductions based on Gross Pay ---
  useEffect(() => {
    if (editingId) {
      const gross = calculateGrossPay(editForm.basicSalary, editForm.allowances);
      setEditForm(prev => ({
        ...prev,
        deductions: {
          ...prev.deductions,
          tax: computeTax(gross),
          sss: computeSSS(gross),
          philHealth: computePhilHealth(gross),
          pagIbig: computePagIbig(gross),
        }
      }));
    }
  }, [editForm.basicSalary, editForm.allowances]);


  const handleSave = async (employeeId) => {
    const grossPay = calculateGrossPay(editForm.basicSalary, editForm.allowances);
    const totalDeductions = calculateTotalDeductions(editForm.deductions);
    const netPay = calculateNetPay(grossPay, totalDeductions);

    const payload = {
      userId: employeeId,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      basicSalary: editForm.basicSalary * 100, 
      allowances: {
        overtime: editForm.allowances.overtime * 100,
        allowances: editForm.allowances.otherAllowances * 100,
        bonuses: editForm.allowances.bonuses * 100,
      },
      deductions: {
        tax: editForm.deductions.tax * 100,
        sss: editForm.deductions.sss * 100,
        philHealth: editForm.deductions.philHealth * 100,
        pagIbig: editForm.deductions.pagIbig * 100,
        others: editForm.deductions.others * 100,
      },
      grossPay: grossPay * 100,
      netPay: netPay * 100
    };
    createPayslipMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // --- Filtering & Data Merging ---
  const processedEmployees = useMemo(() => {
    if (!teamMembers) return [];
    
    const onlyEmployees = teamMembers.filter(member => member.role === 'employee');

    return onlyEmployees.map(emp => {
      const slip = existingPayslips?.find(p => p.userId === emp.id);
      const totalHoursWorked = 176 + (Math.floor(Math.random() * 20) - 5); // Mock hours

      return {
        ...emp,
        payslipStatus: slip ? 'generated' : 'pending',
        lastPay: slip,
        attendanceSummary: {
            totalHours: totalHoursWorked,
            daysPresent: Math.floor(totalHoursWorked / 8)
        }
      };
    });
  }, [teamMembers, existingPayslips, attendanceData]);

  const filteredEmployees = processedEmployees.filter(emp =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = processedEmployees.filter(e => e.payslipStatus === 'pending').length;

  if (user?.role !== 'payroll_officer' && user?.role !== 'admin') {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  if (isLoadingTeam) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payroll Management</h1>
          <p className="text-gray-600">Period: {selectedPeriod.month}/{selectedPeriod.year}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
             <div className="text-sm text-gray-600">Pending Payslips</div>
             <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
             <div className="text-sm text-gray-600">Total Employees</div>
             <div className="text-2xl font-bold text-blue-600">{processedEmployees.length}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow mb-6 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-2">
               {/* Month Selectors */}
            </div>
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Search employees..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Employee</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Hours (Rate)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Earned Basic</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Allowances/OT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => {
                  const isEditing = editingId === employee.id;
                  const contractSalary = employee.salary ? employee.salary / 100 : 0;
                  
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-gray-500">{employee.position}</div>
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        {isEditing ? (
                            <div className="flex flex-col items-center gap-1">
                                <input 
                                    type="number" 
                                    value={editForm.hoursWorked}
                                    onChange={e => setEditForm({...editForm, hoursWorked: parseFloat(e.target.value)})}
                                    className="w-16 text-center border border-blue-400 rounded p-1 text-sm bg-blue-50"
                                    title="Edit Total Hours"
                                />
                                <span className="text-[10px] text-gray-500">Rate: ₱{editForm.hourlyRate.toFixed(2)}/hr</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                    <Clock className="w-3 h-3" />
                                    {employee.attendanceSummary.totalHours} hrs
                                </div>
                            </div>
                        )}
                      </td>

                      {isEditing ? (
                        <>
                           {/* EDIT MODE INPUTS */}
                           <td className="px-4 py-4 text-right">
                             {/* Basic Salary is now Read-Only as it is calculated from hours */}
                             <div className="text-sm font-medium">
                                ₱{editForm.basicSalary.toLocaleString()}
                             </div>
                             <div className="text-[10px] text-gray-500">Auto-calculated</div>
                           </td>
                           <td className="px-4 py-4">
                              <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500">OT Pay:</span>
                                    <span className="text-xs font-medium w-16 text-right">
                                        ₱{editForm.allowances.overtime.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500">Bonus:</span>
                                    <input 
                                        type="number" 
                                        value={editForm.allowances.bonuses} 
                                        onChange={e => setEditForm({
                                            ...editForm, 
                                            allowances: {...editForm.allowances, bonuses: parseFloat(e.target.value)}
                                        })}
                                        className="w-16 text-right border rounded p-1 text-xs"
                                    />
                                </div>
                              </div>
                           </td>
                           <td className="px-4 py-4 text-right text-sm">
                                ₱{calculateTotalDeductions(editForm.deductions).toLocaleString()}
                                 <div className="text-[10px] text-gray-500">Auto-calculated</div>
                           </td>
                           
                           <td className="px-4 py-4 text-right font-bold text-green-600">
                                {calculateNetPay(
                                    calculateGrossPay(editForm.basicSalary, editForm.allowances),
                                    calculateTotalDeductions(editForm.deductions)
                                ).toLocaleString()}
                           </td>
                        </>
                      ) : (
                        <>
                           {/* VIEW MODE */}
                           <td className="px-4 py-4 text-right text-sm">₱{(contractSalary).toLocaleString()}</td>
                           <td className="px-4 py-4 text-right text-sm">-</td>
                           <td className="px-4 py-4 text-right text-sm text-gray-500">Auto</td>
                           <td className="px-4 py-4 text-right font-bold text-gray-700">--</td>
                        </>
                      )}

                      <td className="px-4 py-4 text-center">
                        {isEditing ? (
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => handleSave(employee.id)} className="bg-green-600 text-white p-1 rounded"><Check className="w-4 h-4"/></button>
                                <button onClick={handleCancelEdit} className="bg-gray-500 text-white p-1 rounded"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            employee.payslipStatus === 'pending' ? (
                                <button onClick={() => handleEdit(employee)} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 mx-auto">
                                    <Edit2 className="w-4 h-4" /> Calc
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