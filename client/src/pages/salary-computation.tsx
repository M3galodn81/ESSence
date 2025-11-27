import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { Calculator, Plus, Minus, RefreshCw } from "lucide-react";

export default function SalaryComputation() {
  const { user } = useAuth();

  // Determine Hourly Rate based on user's salary or default
  const getHourlyRate = () => {
    if (user?.salary) {
      // Assuming salary is stored in cents
      return (user.salary / 100) / 22 / 8;
    }
    return 58.75;
  };

  const HOURLY_RATE = getHourlyRate();
  const OVERTIME_RATE = 1.25;
  const OVERTIME_PER_HOUR = HOURLY_RATE * OVERTIME_RATE;

  const [hoursWorked, setHoursWorked] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);

  // Deductions State
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
  const overtimePay = overtimeHours * OVERTIME_PER_HOUR;
  const calculateGrossPay = () => basicPay + overtimePay;
  const calculateTotalDeductions = () => tax + sss + philHealth + pagIbig + others;
  
  const calculateNetPay = () =>
    Math.max(0, calculateGrossPay() - calculateTotalDeductions());

  // --- Compute Pag-IBIG ---
  const computePagIbig = (grossSalary: number) => {
    const capped = Math.min(grossSalary, 10000);
    return capped * 0.02;
  };

  // --- Compute PhilHealth ---
  const computePhilHealth = (grossSalary: number) => {
    let income = grossSalary;
    if (income < 10000) income = 10000;
    if (income > 100000) income = 100000;
    return (income * 0.05) / 2;
  };

  // --- Compute SSS ---
  const computeSSS = (grossSalary: number) => {
    const msc = Math.min(grossSalary, 30000);
    return msc * 0.045;
  };

  // --- Updated autoCalculateDeductions ---
  const autoCalculateDeductions = (grossSalary: number) => {
    // Tax: Set to 0 to align with current system configuration
    const calculatedTax = 0; 

    const sssVal = computeSSS(grossSalary);
    const philHealthVal = computePhilHealth(grossSalary);
    const pagIbigVal = computePagIbig(grossSalary);

    setTax(calculatedTax);
    setSss(sssVal);
    setPhilHealth(philHealthVal);
    setPagIbig(pagIbigVal);
  };

  useEffect(() => {
    // Recalculate deductions based on Basic Pay
    autoCalculateDeductions(basicPay); 
  }, [hoursWorked, overtimeHours, basicPay]);

  const resetForm = () => {
    setHoursWorked(0);
    setOvertimeHours(0);
    setOthers(0);
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Calculator className="w-6 h-6 mr-2" />
            Salary Calculator
          </h1>
          <p className="text-muted-foreground">
            Estimate your net pay based on hours worked.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Earnings
                </CardTitle>
                <CardDescription>
                    Rate: {formatCurrency(HOURLY_RATE)}/hr (Based on your profile)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Regular Hours</Label>
                        <Input
                            type="number"
                            min="0"
                            value={hoursWorked}
                            onChange={(e) => setHoursWorked(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="e.g. 80"
                        />
                    </div>
                    <div>
                        <Label>Overtime Hours</Label>
                        <Input
                            type="number"
                            min="0"
                            value={overtimeHours}
                            onChange={(e) => setOvertimeHours(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="e.g. 5"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Rate: {formatCurrency(OVERTIME_PER_HOUR)}/hr
                        </p>
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-700">
                  <Minus className="w-5 h-5 mr-2" />
                  Deductions (Estimated)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>SSS</Label>
                        <Input value={formatCurrency(sss)} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <Label>PhilHealth</Label>
                        <Input value={formatCurrency(philHealth)} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <Label>Pag-IBIG</Label>
                        <Input value={formatCurrency(pagIbig)} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <Label>Other Deductions</Label>
                        <Input
                            type="number"
                            min="0"
                            value={others}
                            onChange={(e) => setOthers(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                    </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center justify-between">
                  Summary
                  <RefreshCw className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-primary" onClick={resetForm} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Basic Pay</span>
                        <span>{formatCurrency(basicPay)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overtime</span>
                        <span>{formatCurrency(overtimePay)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                        <span>Gross Pay</span>
                        <span className="text-green-600">{formatCurrency(calculateGrossPay())}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Deductions</span>
                        <span className="text-red-600">-{formatCurrency(calculateTotalDeductions())}</span>
                    </div>
                </div>

                <Separator className="my-4" />
                
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg">Net Pay</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(calculateNetPay())}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}