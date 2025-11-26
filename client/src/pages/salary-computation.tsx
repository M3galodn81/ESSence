import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, Plus, Minus, Save } from "lucide-react";

export default function SalaryComputation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const HOURLY_RATE = 58.75;
  const OVERTIME_RATE = 1.25;
  const NIGHT_DIFFERENTIAL_RATE = .1;
  const OVERTIME_PER_HOUR = Number(
    (HOURLY_RATE * OVERTIME_RATE).toFixed(2)
  );

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [hoursWorked, setHoursWorked] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);

  const [tax, setTax] = useState(0);
  const [sss, setSss] = useState(0);
  const [philHealth, setPhilHealth] = useState(0);
  const [pagIbig, setPagIbig] = useState(0);
  const [others, setOthers] = useState(0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {  
      style: "currency",
      currency: "PHP",
    }).format(amount);

  // --- Computations ---
  const basicPay = hoursWorked * HOURLY_RATE;
  const overtimePay = overtimeHours * (OVERTIME_PER_HOUR);
  const calculateGrossPay = () => basicPay + overtimePay;
  const calculateTotalDeductions = () =>
    tax + sss + philHealth + pagIbig + others;
  
  // ✅ FIX: Ensure Net Pay never goes below 0
  const calculateNetPay = () =>
    Math.max(0, calculateGrossPay() - calculateTotalDeductions());

  // --- Contributions Breakdown Types ---
  interface BreakdownSSS {
    msc: number;
    employeeShare: number;
    employerShare: number;
    totalContribution: number;
  }

  interface BreakdownPhilHealth {
    contribution: number;
    employeeShare: number;
    employerShare: number;
    totalContribution: number;
  }

  interface BreakdownPagIbig {
    employeeRate: number;
    employeeShare: number;
    employerRate: number;
    employerShare: number;
    totalContribution: number;
  }

  // --- Compute Pag-IBIG ---
  const computePagIbig = (grossSalary: number): BreakdownPagIbig => {
    const employeeRate = grossSalary > 1500 ? 0.02 : 0.01;
    const employerRate = 0.02;

    const employeeShare = grossSalary * employeeRate;
    const employerShare = grossSalary * employerRate;
    const totalContribution = employeeShare + employerShare;

    return {
      employeeRate,
      employeeShare,
      employerRate,
      employerShare,
      totalContribution,
    };
  };

  // --- Compute PhilHealth ---
  const computePhilHealth = (grossSalary: number): BreakdownPhilHealth => {
    let contribution = 0;
    if (grossSalary <= 10000) contribution = 500;
    else if (grossSalary <= 99999.99) contribution = grossSalary * 0.05;
    else contribution = 5000;

    const employeeShare = contribution / 2;
    const employerShare = contribution / 2;

    return {
      contribution,
      employeeShare,
      employerShare,
      totalContribution: contribution,
    };
  };

  // --- Compute SSS ---
  const computeSSS = (grossSalary: number): BreakdownSSS => {
    const minMsc = 5000;
    const maxMsc = 35000;

    // Floor salary to nearest 500
    const floored = Math.floor(Math.max(0, grossSalary) / 500) * 500;
    const msc = Math.min(Math.max(floored, minMsc), maxMsc);

    const employeeRate = 0.05;
    const employerRate = 0.1;
    const mpf = msc < 15000 ? 10 : 30;

    const employeeShare = msc * employeeRate;
    const employerShare = msc * employerRate + mpf;
    const totalContribution = employeeShare + employerShare + mpf;

    return { msc, employeeShare, employerShare, totalContribution };
  };

  // --- Updated autoCalculateDeductions ---
  const autoCalculateDeductions = (grossSalary: number, showToast = false) => {
    // Tax computation (keep your previous tax logic)
    let calculatedTax = 0;
    // Ensure negative gross salary is treated as 0 for tax purposes
    const safeGross = Math.max(0, grossSalary);

    if (safeGross <= 20833) calculatedTax = 0;
    else if (safeGross <= 33332) calculatedTax = (safeGross - 20833) * 0.15;
    else if (safeGross <= 66666)
      calculatedTax = 1875 + (safeGross - 33332) * 0.2;
    else if (safeGross <= 166666)
      calculatedTax = 8541.8 + (safeGross - 66666) * 0.25;
    else if (safeGross <= 666666)
      calculatedTax = 33541.8 + (safeGross - 166666) * 0.3;
    else calculatedTax = 183541.8 + (safeGross - 666666) * 0.35;

    const sss = computeSSS(safeGross);
    const philHealth = computePhilHealth(safeGross);
    const pagIbig = computePagIbig(safeGross);

    setTax(Math.round(calculatedTax));
    setSss(Math.round(sss.employeeShare));
    setPhilHealth(Math.round(philHealth.employeeShare));
    setPagIbig(Math.round(pagIbig.employeeShare));
  };

  // ✅ Auto-update deductions whenever hours change
  useEffect(() => {
    autoCalculateDeductions(calculateGrossPay());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursWorked, overtimeHours]);

  // --- Mutation for creating payslip ---
  const createPayslipMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user logged in");

      const payslipData = {
        userId: user.id,
        month,
        year,
        basicSalary: basicPay * 100,
        allowances: { overtime: overtimePay * 100 },
        deductions: {
          tax: tax * 100,
          sss: sss * 100,
          philHealth: philHealth * 100,
          pagIbig: pagIbig * 100,
          others: others * 100,
        },
        grossPay: calculateGrossPay() * 100,
        netPay: calculateNetPay() * 100,
      };

      const res = await apiRequest("POST", "/api/payslips", payslipData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payslip Created",
        description: "Payslip generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setHoursWorked(0);
    setOvertimeHours(0);
    setTax(0);
    setSss(0);
    setPhilHealth(0);
    setPagIbig(0);
    setOthers(0);
  };

  // --- UI ---
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Calculator className="w-6 h-6 mr-2" />
            Salary Calculator
          </h1>
          <p className="text-muted-foreground">
            Compute your salary based on hours worked and standard deductions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Earnings
                </CardTitle>
                <CardDescription>Enter hours and overtime</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Hours Worked</Label>
                  <Input
                    type="number"
                    min="0"
                    value={hoursWorked}
                    // ✅ FIX: Prevent negative input
                    onChange={(e) =>
                      setHoursWorked(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                    placeholder="e.g. 160"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Hourly rate: ₱{HOURLY_RATE}
                  </p>
                </div>
                <div>
                  <Label>Overtime Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={overtimeHours}
                    // ✅ FIX: Prevent negative input
                    onChange={(e) =>
                      setOvertimeHours(
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                    placeholder="e.g. 10"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Overtime rate: ₱{OVERTIME_PER_HOUR} per hour
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-red-700">
                      <Minus className="w-5 h-5 mr-2" />
                      Deductions
                    </CardTitle>
                    <CardDescription>
                      Auto-calculated based on gross pay
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Editable others */}
                <div>
                  <Label>SSS Contribution (₱)</Label>
                  <Input
                    type="number"
                    value={sss}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label>PhilHealth Contribution (₱)</Label>
                  <Input
                    type="number"
                    value={philHealth}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label>Pag-IBIG Contribution (₱)</Label>
                  <Input
                    type="number"
                    value={pagIbig}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label>Other Deductions (₱)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={others}
                    // ✅ FIX: Prevent negative input
                    onChange={(e) =>
                      setOthers(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    placeholder="0.00"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Gross Pay</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(calculateGrossPay())}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Basic Pay</span>
                  <span className=" ">
                    {formatCurrency(basicPay)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  {/* ✅ FIX: Corrected label from 'Basic Pay' to 'Overtime Pay' */}
                  <span>Overtime Pay</span>
                  <span className=" ">
                    {formatCurrency(overtimePay)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span>Total Deductions</span>
                  <span className="font-semibold text-red-700">
                    {formatCurrency(calculateTotalDeductions())}
                  </span>
                </div>

                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Net Pay</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(calculateNetPay())}
                  </span>
                </div>
                <Separator className="my-4" />
                <Button variant="outline" className="w-full" onClick={resetForm}>
                  Reset Form
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}