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

  const HOURLY_RATE = 60;
  const OVERTIME_RATE = 1.25;

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
  const overtimePay = overtimeHours * (HOURLY_RATE * OVERTIME_RATE);
  const calculateGrossPay = () => basicPay + overtimePay;
  const calculateTotalDeductions = () => tax + sss + philHealth + pagIbig + others;
  const calculateNetPay = () => calculateGrossPay() - calculateTotalDeductions();

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

  return { employeeRate, employeeShare, employerRate, employerShare, totalContribution };
};

// --- Compute PhilHealth ---
const computePhilHealth = (grossSalary: number): BreakdownPhilHealth => {
  let contribution = 0;
  if (grossSalary <= 10000) contribution = 500;
  else if (grossSalary <= 99999.99) contribution = grossSalary * 0.05;
  else contribution = 5000;

  const employeeShare = contribution / 2;
  const employerShare = contribution / 2;

  return { contribution, employeeShare, employerShare, totalContribution: contribution };
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
  if (grossSalary <= 20833) calculatedTax = 0;
  else if (grossSalary <= 33332) calculatedTax = (grossSalary - 20833) * 0.15;
  else if (grossSalary <= 66666) calculatedTax = 1875 + (grossSalary - 33332) * 0.2;
  else if (grossSalary <= 166666) calculatedTax = 8541.8 + (grossSalary - 66666) * 0.25;
  else if (grossSalary <= 666666) calculatedTax = 33541.8 + (grossSalary - 166666) * 0.3;
  else calculatedTax = 183541.8 + (grossSalary - 666666) * 0.35;

  const sss = computeSSS(grossSalary);
  const philHealth = computePhilHealth(grossSalary);
  const pagIbig = computePagIbig(grossSalary);

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
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(parseFloat(e.target.value) || 0)}
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
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 10"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Overtime rate: ₱{HOURLY_RATE * 1.25}
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
                    <CardDescription>Auto-calculated based on gross pay</CardDescription>
                  </div>
                  {/* <Button variant="outline" size="sm" onClick={() => autoCalculateDeductions(true)}>
                    <Calculator className="w-4 h-4 mr-2" />
                    Recalculate
                  </Button> */}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Withholding Tax (Read-only) */}
                {/* <div>
                  <Label>Withholding Tax (₱)</Label>
                  <Input type="number" value={tax} readOnly className="bg-gray-100" />
                </div> */}

                {/* Editable others */}
                <div>
                  <Label>SSS Contribution (₱)</Label>
                  <Input type="number" value={sss} readOnly className="bg-gray-100" />
                </div>
                <div>
                  <Label>PhilHealth Contribution (₱)</Label>
                  <Input type="number" value={philHealth} readOnly className="bg-gray-100" />
                </div>
                <div>
                  <Label>Pag-IBIG Contribution (₱)</Label>
                  <Input type="number" value={pagIbig} readOnly className="bg-gray-100" />
                </div>
                <div>
                  <Label>Other Deductions (₱)</Label>
                  <Input
                    type="number"
                    value={others}
                    onChange={(e) => setOthers(parseFloat(e.target.value) || 0)}
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
                  <span>Basic Pay</span>
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
                {/* <Button
                  className="w-full"
                  onClick={() => createPayslipMutation.mutate()}
                  disabled={createPayslipMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createPayslipMutation.isPending
                    ? "Generating..."
                    : "Generate Payslip"}
                </Button> */}
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
