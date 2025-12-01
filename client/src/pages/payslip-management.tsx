import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Edit2, Check, X, Loader2, RefreshCw, CalendarDays, Users, FileCheck, Clock, Filter, Calculator, TrendingDown, PhilippinePeso, ChevronRight, Moon, Flame, Calendar, Briefcase, Coffee } from 'lucide-react';
import { HOURLY_RATE, OT_MULTIPLIER, ND_MULTIPLIER, computeSSS, computePhilHealth, computePagIbig } from "../lib/helper"; 
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BentoCard } from "@/components/custom/bento-card"; 

// Helper for consistent rounding
const round2 = (num: number) => Math.round(num * 100) / 100;

export default function PayrollManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- State ---
  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState({ 
    month: new Date().getMonth() + 1, 
    year: currentYear,
    half: 1 
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const [attendanceViewerId, setAttendanceViewerId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    regularHours: 0,
    overtimeHours: 0,
    nightDiffHours: 0,
    bonuses: 0,
    otherAllowances: 0,
    otherDeductions: 0,
    basicSalary: 0,
    grossPay: 0,
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    tax: 0,
    netPay: 0,
    overtimePay: 0,
    nightDiffPay: 0
  });

  // --- Data Fetching ---
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["/api/team"],
  });

  const { data: existingPayslips, isLoading: isLoadingPayslips } = useQuery({
    queryKey: ["/api/payslips", "all", selectedPeriod.month, selectedPeriod.year, selectedPeriod.half],
    queryFn: async () => {
       const res = await fetch(`/api/payslips/all`);
       if (!res.ok) throw new Error("Failed");
       const allPayslips = await res.json();
       return allPayslips.filter((p: any) => 
          Number(p.month) === Number(selectedPeriod.month) && 
          Number(p.year) === Number(selectedPeriod.year)
       );
    }
  });

  const { startDate, endDate } = useMemo(() => {
    const year = Number(selectedPeriod.year);
    const monthIndex = Number(selectedPeriod.month) - 1; 
    let start, end;
    if (Number(selectedPeriod.half) === 1) {
        start = new Date(year, monthIndex, 1);
        end = new Date(year, monthIndex, 15, 23, 59, 59);
    } else {
        start = new Date(year, monthIndex, 16);
        end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [selectedPeriod]);

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["/api/attendance/all", startDate, endDate],
    queryFn: async () => { 
        const res = await fetch(`/api/attendance/all?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error("Failed");
        return res.json();
    } 
  });

  // --- Logic Helpers ---
  const getNightDiffHours = (timeIn: string | number, timeOut: string | number) => {
    let start = new Date(timeIn);
    let end = new Date(timeOut);
    let ndHours = 0;
    let current = new Date(start);
    current.setMinutes(0, 0, 0); 
    if (current.getTime() < start.getTime()) current.setHours(current.getHours() + 1);

    while (current.getTime() < end.getTime()) {
        const h = current.getHours();
        if (h >= 22 || h < 6) ndHours += 1;
        current.setHours(current.getHours() + 1);
    }
    return ndHours;
  };

  const processAttendanceForUser = (userId: string, records: any[]) => {
    if (!records) return { regularHours: 0, overtimeHours: 0, nightDiffHours: 0 };
    const userRecords = records.filter((r: any) => r.userId === userId);
    let totalRegMinutes = 0, totalOTMinutes = 0, totalNDHours = 0;

    userRecords.forEach((record: any) => {
        if (record.timeOut && record.totalWorkMinutes) {
            // FIX: totalWorkMinutes is already net (breaks excluded)
            const workMinutes = record.totalWorkMinutes || 0;

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

  // --- Mutations ---
  const savePayslipMutation = useMutation({
    mutationFn: async ({ url, method, data }: { url: string, method: string, data: any }) => {
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if(!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Payslip processed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      setEditingId(null);
      setIsConfirmOpen(false);
      setIsEditOpen(false);
    }
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
        const res = await fetch("/api/payroll/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if(!res.ok) throw new Error("Calc failed");
        return res.json();
    },
    onSuccess: (data) => {
        setEditForm(prev => ({
            ...prev,
            sss: data.deductions.sss,
            philHealth: data.deductions.philHealth,
            pagIbig: data.deductions.pagIbig,
            tax: data.deductions.tax,
            netPay: data.netPay
        }));
    }
  });

  const fetchStatsMutation = useMutation({
    mutationFn: async (params: { userId: string, startDate: string, endDate: string }) => {
        const q = new URLSearchParams(params).toString();
        const res = await fetch(`/api/payroll/attendance-stats?${q}`);
        return res.json();
    },
    onSuccess: (data) => {
        setEditForm(prev => ({
            ...prev,
            regularHours: data.regularHours,
            overtimeHours: data.overtimeHours,
            nightDiffHours: data.nightDiffHours,
            bonuses: 0,
            otherAllowances: 0,
            otherDeductions: 0
        }));
    }
  });

  const getExistingPayslip = (userId: string) => {
      if (!existingPayslips) return undefined;
      return existingPayslips.find((p: any) => 
        p.userId === userId && 
        (Number(p.period) === Number(selectedPeriod.half) || (!p.period && Number(selectedPeriod.half) === 1))
      );
  };

  const handleEdit = (employee: any) => {
    setEditingId(employee.id);
    setIsEditOpen(true);

    const existingSlip = getExistingPayslip(employee.id);

    if (existingSlip) {
        const basic = existingSlip.basicSalary / 100;
        const allowances = existingSlip.allowances || {};
        const deductions = existingSlip.deductions || {};
        const regHours = basic / HOURLY_RATE;
        const otHours = (allowances.overtime || 0) / 100 / (HOURLY_RATE * OT_MULTIPLIER);
        const ndHours = (allowances.nightDiff || 0) / 100 / (HOURLY_RATE * ND_MULTIPLIER);

        setEditForm({
            regularHours: round2(regHours),
            overtimeHours: round2(otHours),
            nightDiffHours: round2(ndHours),
            bonuses: (allowances.bonuses || 0) / 100,
            otherAllowances: (allowances.otherAllowances || allowances.allowances || 0) / 100,
            otherDeductions: (deductions.others || 0) / 100,
            basicSalary: basic,
            overtimePay: (allowances.overtime || 0) / 100,
            nightDiffPay: (allowances.nightDiff || 0) / 100,
            grossPay: existingSlip.grossPay / 100,
            sss: (deductions.sss || 0) / 100,
            philHealth: (deductions.philHealth || 0) / 100,
            pagIbig: (deductions.pagIbig || 0) / 100,
            tax: (deductions.tax || 0) / 100,
            netPay: existingSlip.netPay / 100
        });
    } else {
        fetchStatsMutation.mutate({ 
            userId: employee.id, 
            startDate, 
            endDate 
        });
    }
  };

  // --- Auto-Calculation Effect ---
  useEffect(() => {
    if (!isEditOpen) return;

    const basicSalary = round2(editForm.regularHours * HOURLY_RATE);
    const overtimePay = round2(editForm.overtimeHours * (HOURLY_RATE * OT_MULTIPLIER));
    const nightDiffPay = round2(editForm.nightDiffHours * (HOURLY_RATE * ND_MULTIPLIER));
    const grossPay = round2(basicSalary + overtimePay + nightDiffPay + editForm.bonuses + editForm.otherAllowances);

    setEditForm(prev => ({
        ...prev,
        basicSalary,
        overtimePay,
        nightDiffPay,
        grossPay,
    }));

    const timer = setTimeout(() => {
        let previousDeductions = { sss: 0, philHealth: 0, pagIbig: 0 };
        if (Number(selectedPeriod.half) === 2 && existingPayslips && editingId) {
            const slip1 = existingPayslips.find((p: any) => 
                p.userId === editingId && (Number(p.period) === 1 || !p.period)
            );
            if (slip1 && slip1.deductions) {
                const d = slip1.deductions as any;
                previousDeductions = {
                    sss: (d.sss || 0) / 100,
                    philHealth: (d.philHealth || 0) / 100,
                    pagIbig: (d.pagIbig || 0) / 100
                };
            }
        }

        calculateMutation.mutate({
            grossPay,
            basicSalary,
            previousDeductions,
            otherDeductions: editForm.otherDeductions
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    editForm.regularHours, editForm.overtimeHours, editForm.nightDiffHours, 
    editForm.bonuses, editForm.otherAllowances, editForm.otherDeductions
  ]);

  const handleConfirmSave = async () => {
    if (!editingId) return;
    const payload = {
      userId: editingId,
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      period: selectedPeriod.half, 
      basicSalary: Math.round(editForm.basicSalary * 100),
      allowances: {
        overtime: Math.round(editForm.overtimePay * 100),
        nightDiff: Math.round(editForm.nightDiffPay * 100),
        allowances: Math.round(editForm.otherAllowances * 100),
        bonuses: Math.round(editForm.bonuses * 100),
      },
      deductions: {
        tax: Math.round(editForm.tax * 100),
        sss: Math.round(editForm.sss * 100),
        philHealth: Math.round(editForm.philHealth * 100),
        pagIbig: Math.round(editForm.pagIbig * 100),
        others: Math.round(editForm.otherDeductions * 100),
      },
      grossPay: Math.round(editForm.grossPay * 100),
      netPay: Math.round(editForm.netPay * 100)
    };

    const existingSlip = getExistingPayslip(editingId);
    if (existingSlip) {
        savePayslipMutation.mutate({ url: `/api/payslips/${existingSlip.id}`, method: "PATCH", data: payload });
    } else {
        savePayslipMutation.mutate({ url: "/api/payslips", method: "POST", data: payload });
    }
  };

  const processedEmployees = useMemo(() => {
    if (!teamMembers) return [];
    const onlyEmployees = teamMembers.filter((m: any) => m.role === 'employee' ); 
    return onlyEmployees.map((emp: any) => {
      const slip = getExistingPayslip(emp.id);
      return { ...emp, payslipStatus: slip ? 'generated' : 'pending', lastPay: slip };
    });
  }, [teamMembers, existingPayslips, selectedPeriod]);

  const filteredEmployees = processedEmployees.filter((emp: any) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalEmployees: filteredEmployees.length,
    generated: filteredEmployees.filter(e => e.payslipStatus === 'generated').length,
    pending: filteredEmployees.filter(e => e.payslipStatus === 'pending').length
  };

  const editingEmployeeName = useMemo(() => {
    if (!editingId || !teamMembers) return "";
    const emp = teamMembers.find((m: any) => m.id === editingId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
  }, [editingId, teamMembers]);

  // Viewer Logic
  const viewingEmployeeData = useMemo(() => {
    if (!attendanceViewerId || !teamMembers) return null;
    return teamMembers.find((m:any) => m.id === attendanceViewerId);
  }, [attendanceViewerId, teamMembers]);

  const viewingEmployeeRecords = useMemo(() => {
    if (!attendanceViewerId || !attendanceData) return [];
    return attendanceData.filter((r: any) => r.userId === attendanceViewerId)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [attendanceViewerId, attendanceData]);

  // FIX: Don't subtract break again, totalWorkMinutes is already net
  const viewerTotals = useMemo(() => {
      return viewingEmployeeRecords.reduce((acc: any, record: any) => {
          const workMinutes = record.totalWorkMinutes || 0;
          const breakMinutes = record.totalBreakMinutes || 0;
          
          const otMins = Math.max(0, workMinutes - 480);
          const regMins = workMinutes - otMins;
          const ndHrs = getNightDiffHours(record.timeIn, record.timeOut);
          
          return {
              regMinutes: acc.regMinutes + regMins,
              otMinutes: acc.otMinutes + otMins,
              ndHours: acc.ndHours + ndHrs,
              breakMinutes: acc.breakMinutes + breakMinutes,
              totalMinutes: acc.totalMinutes + workMinutes
          };
      }, { regMinutes: 0, otMinutes: 0, ndHours: 0, breakMinutes: 0, totalMinutes: 0 });
  }, [viewingEmployeeRecords]);

  const currentNetPay = useMemo(() => {
    return editForm.netPay;
  }, [editForm]);

  const formatTime = (ts: number) => format(new Date(ts), "h:mm a");
  const formatDate = (ts: number) => format(new Date(ts), "MMM d");
  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoadingTeam || isLoadingAttendance || isLoadingPayslips) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header, Stats, Filter ... (Same as before) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" data-testid="page-title">Payroll Generator</h1>
          <p className="text-slate-500 mt-1 text-sm">Process employee salaries and deductions</p>
        </div>
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-2 px-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={selectedPeriod.month.toString()} onValueChange={(val) => setSelectedPeriod(prev => ({ ...prev, month: parseInt(val) }))}>
                    <SelectTrigger className="w-[110px] h-8 border-none bg-transparent shadow-none text-xs font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <Select value={selectedPeriod.year.toString()} onValueChange={(val) => setSelectedPeriod(prev => ({ ...prev, year: parseInt(val) }))}>
                <SelectTrigger className="w-[80px] h-8 border-none bg-transparent shadow-none text-xs font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (<SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>))}
                </SelectContent>
            </Select>
            <div className="w-px h-4 bg-slate-200" />
            <Select value={selectedPeriod.half.toString()} onValueChange={(val) => setSelectedPeriod(prev => ({ ...prev, half: parseInt(val) }))}>
                <SelectTrigger className="w-[100px] h-8 border-none bg-transparent shadow-none text-xs font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="1">1st Half</SelectItem>
                    <SelectItem value="2">2nd Half</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BentoCard title="Total Employees" value={stats.totalEmployees} icon={Users} variant="default" testIdPrefix="stat-total" />
        <BentoCard title="Generated" value={stats.generated} icon={FileCheck} variant="emerald" testIdPrefix="stat-generated" />
        <BentoCard title="Pending" value={stats.pending} icon={Clock} variant="amber" testIdPrefix="stat-pending" />
      </div>

      <Card className="bg-white/40 backdrop-blur-md border-slate-200/60 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-slate-100 bg-white/50">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search employees..." 
                    className="pl-9 bg-white/60 border-slate-200/60 focus:bg-white rounded-xl transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Employee</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-center">Hours Detail</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Gross</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Deductions</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Net Pay</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee: any) => {
                  let computed = processAttendanceForUser(employee.id, attendanceData || []);
                  let viewBasic = 0, viewOT = 0, viewND = 0, viewGross = 0, viewNet = 0, viewTotalDeductions = 0;

                  if (employee.lastPay) {
                      const lp = employee.lastPay;
                      const allowances = lp.allowances || {};
                      viewBasic = lp.basicSalary / 100 / HOURLY_RATE;
                      viewOT = (allowances.overtime || 0) / 100 / (HOURLY_RATE * OT_MULTIPLIER);
                      viewND = (allowances.nightDiff || 0) / 100 / (HOURLY_RATE * ND_MULTIPLIER);
                      viewGross = lp.grossPay / 100;
                      viewNet = lp.netPay / 100;
                      viewTotalDeductions = (lp.grossPay - lp.netPay) / 100;
                  } else {
                      viewBasic = computed.regularHours;
                      viewOT = computed.overtimeHours;
                      viewND = computed.nightDiffHours;
                      let viewCalcBase = round2((viewBasic * HOURLY_RATE) + (viewOT * HOURLY_RATE * OT_MULTIPLIER) + (viewND * HOURLY_RATE * ND_MULTIPLIER));
                      viewGross = viewCalcBase;
                      
                      let prevDeduc = { sss: 0, philHealth: 0, pagIbig: 0 };
                      if (selectedPeriod.half === 2 && existingPayslips) {
                          const slip1 = existingPayslips.find((p: any) => p.userId === employee.id && (Number(p.period) === 1 || !p.period));
                          if (slip1) {
                              viewCalcBase += (slip1.grossPay / 100);
                              if (slip1.deductions) {
                                  const d = slip1.deductions as any;
                                  prevDeduc = { sss: (d.sss || 0) / 100, philHealth: (d.philHealth || 0) / 100, pagIbig: (d.pagIbig || 0) / 100 };
                              }
                          }
                      }
                      const vSSS = Math.max(0, round2(computeSSS(viewCalcBase) - prevDeduc.sss));
                      const vPH = Math.max(0, round2(computePhilHealth(viewCalcBase) - prevDeduc.philHealth));
                      const vHDMF = Math.max(0, round2(computePagIbig(viewCalcBase) - prevDeduc.pagIbig));
                      viewTotalDeductions = vSSS + vPH + vHDMF;
                      viewNet = Math.max(0, viewGross - viewTotalDeductions);
                  }
                  
                  return (
                    <tr key={employee.id} className="hover:bg-white/60 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-slate-900">{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-slate-500">{employee.position}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 space-y-1.5 min-w-[140px] group-hover:border-slate-200 transition-colors relative">
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Regular</span>
                                <span className="font-mono font-medium text-slate-700">{viewBasic.toFixed(2)}h</span>
                             </div>
                             {(viewOT > 0) && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-amber-600/90 font-medium">Overtime</span>
                                    <span className="font-mono font-bold text-amber-600">{viewOT.toFixed(2)}h</span>
                                </div>
                             )}
                             {(viewND > 0) && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-indigo-600/90 font-medium">Night Diff</span>
                                    <span className="font-mono font-bold text-indigo-600">{viewND.toFixed(2)}h</span>
                                </div>
                             )}
                             <div className="pt-2 mt-1 border-t border-slate-100 flex justify-center">
                                <button onClick={() => setAttendanceViewerId(employee.id)} className="text-[10px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-100 w-full justify-center">
                                    <Clock className="w-3 h-3" /> View Logs
                                </button>
                             </div>
                          </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top pt-6"><div className="text-sm font-bold text-slate-800">₱{viewGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></td>
                      <td className="px-6 py-4 text-right align-top pt-6"><div className="text-sm font-bold text-rose-600">-₱{viewTotalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600 text-lg align-top pt-5">{viewNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-center align-top pt-5">
                            <button onClick={() => handleEdit(employee)} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto transition-all ${employee.payslipStatus === 'generated' ? "text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200" : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm" }`}>
                                {employee.payslipStatus === 'generated' ? <Edit2 className="w-3 h-3" /> : <Calculator className="w-3 h-3" />}
                                {employee.payslipStatus === 'generated' ? 'Update' : 'Generate'}
                            </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Detail Dialog */}
      <Dialog open={!!attendanceViewerId} onOpenChange={(open) => !open && setAttendanceViewerId(null)}>
        <DialogContent className="max-w-5xl rounded-3xl p-0 overflow-hidden">
            <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            {viewingEmployeeData ? `${viewingEmployeeData.firstName} ${viewingEmployeeData.lastName}` : "Attendance Logs"}
                        </DialogTitle>
                        <DialogDescription className="mt-1 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> 
                            {new Date(0, selectedPeriod.month - 1).toLocaleString('default', { month: 'long' })} {selectedPeriod.year} 
                            <span className="text-slate-300 mx-1">|</span>
                            <Briefcase className="w-3.5 h-3.5" />
                            {selectedPeriod.half === 1 ? "1st Half (1-15)" : "2nd Half (16-End)"}
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center min-w-[70px]">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Regular</span>
                            <span className="text-lg font-bold text-slate-700">{(viewerTotals.regMinutes / 60).toFixed(1)}h</span>
                        </div>
                        <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl shadow-sm flex flex-col items-center min-w-[70px]">
                            <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">OT</span>
                            <span className="text-lg font-bold text-amber-700">{(viewerTotals.otMinutes / 60).toFixed(1)}h</span>
                        </div>
                        <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm flex flex-col items-center min-w-[70px]">
                            <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">ND</span>
                            <span className="text-lg font-bold text-indigo-700">{viewerTotals.ndHours.toFixed(1)}h</span>
                        </div>
                         <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex flex-col items-center min-w-[70px]">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Break</span>
                            <span className="text-lg font-bold text-slate-600">{(viewerTotals.breakMinutes / 60).toFixed(1)}h</span>
                        </div>
                        <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm flex flex-col items-center min-w-[70px]">
                            <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Net</span>
                            <span className="text-lg font-bold text-emerald-700">{(viewerTotals.totalMinutes / 60).toFixed(1)}h</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-xs">Date</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs">In / Out</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-right">Break</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-right">Reg</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-right">OT</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-right">ND</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-right">Net Total</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-xs text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {viewingEmployeeRecords.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">No logs found for this period.</td>
                            </tr>
                        ) : (
                            viewingEmployeeRecords.map((record: any) => {
                                // FIX: totalWorkMinutes is already net in DB
                                const workMinutes = record.totalWorkMinutes || 0;
                                const breakMinutes = record.totalBreakMinutes || 0;

                                const otMins = Math.max(0, workMinutes - 480);
                                const regMins = workMinutes - otMins;
                                const otHours = otMins / 60;
                                const ndHours = getNightDiffHours(record.timeIn, record.timeOut);
                                
                                return (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{formatDate(record.date)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex flex-col text-xs">
                                                <span className="font-mono text-slate-600">{formatTime(record.timeIn)}</span>
                                                <span className="font-mono text-slate-400">
                                                    {record.timeOut ? formatTime(record.timeOut) : '--:--'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-500 text-xs">
                                            {formatDuration(breakMinutes)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium text-slate-700 text-xs">
                                            {formatDuration(regMins)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {otHours > 0 ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                    <Flame className="w-3 h-3 mr-1" /> {otHours.toFixed(1)}h
                                                </span>
                                            ) : <span className="text-slate-300 text-xs">-</span>}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {ndHours > 0 ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                    <Moon className="w-3 h-3 mr-1" /> {ndHours.toFixed(1)}h
                                                </span>
                                            ) : <span className="text-slate-300 text-xs">-</span>}
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-900 text-xs">
                                            {formatDuration(workMinutes)}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide 
                                                ${record.status === 'clocked_out' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                                {record.status === 'clocked_out' ? 'Complete' : 'Incomplete'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <Button onClick={() => setAttendanceViewerId(null)} className="rounded-full bg-slate-900 text-white hover:bg-slate-800">Close</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (Existing content...) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {/* ... (Kept existing structure) ... */}
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
                <Button onClick={handleConfirmSave} className="rounded-full bg-slate-900 hover:bg-slate-800">Save & Confirm</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payslip {existingPayslips?.some((p:any) => p.userId === editingId) ? 'Update' : 'Generation'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {existingPayslips?.some((p:any) => p.userId === editingId) ? 'update' : 'generate'} the payslip for <strong>{editingEmployeeName}</strong>?
              <br/><br/>
              Period: {selectedPeriod.month}/{selectedPeriod.year} (Cutoff: {selectedPeriod.half === 1 ? '1st Half' : '2nd Half'})
              <br/>
              Net Pay: <strong>₱{currentNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <br/>
              <span className="text-xs text-slate-500">This action cannot be undone easily.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} className="bg-emerald-600 hover:bg-emerald-700 rounded-full">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}