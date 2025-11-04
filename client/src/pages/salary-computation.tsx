import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, Plus, Minus, Save } from "lucide-react";
import type { User } from "@shared/schema";

export default function SalaryComputation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEmployee = user?.role === 'employee';
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [basicSalary, setBasicSalary] = useState(0);
  const [overtime, setOvertime] = useState(0);
  const [allowances, setAllowances] = useState(0);
  const [bonuses, setBonuses] = useState(0);

  const [tax, setTax] = useState(0);
  const [sss, setSss] = useState(0);
  const [philHealth, setPhilHealth] = useState(0);
  const [pagIbig, setPagIbig] = useState(0);
  const [others, setOthers] = useState(0);

  const { data: teamMembers } = useQuery({
    queryKey: ["/api/team"],
    enabled: isManagerOrAdmin,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const calculateGrossPay = () => {
    return basicSalary + overtime + allowances + bonuses;
  };

  const calculateTotalDeductions = () => {
    return tax + sss + philHealth + pagIbig + others;
  };

  const calculateNetPay = () => {
    return calculateGrossPay() - calculateTotalDeductions();
  };

  const autoCalculateDeductions = () => {
    const gross = calculateGrossPay();
    
    let calculatedTax = 0;
    if (gross <= 20833) {
      calculatedTax = 0;
    } else if (gross <= 33332) {
      calculatedTax = (gross - 20833) * 0.15;
    } else if (gross <= 66666) {
      calculatedTax = 1875 + (gross - 33332) * 0.20;
    } else if (gross <= 166666) {
      calculatedTax = 8541.80 + (gross - 66666) * 0.25;
    } else if (gross <= 666666) {
      calculatedTax = 33541.80 + (gross - 166666) * 0.30;
    } else {
      calculatedTax = 183541.80 + (gross - 666666) * 0.35;
    }

    let calculatedSss = 0;
    if (basicSalary <= 3250) {
      calculatedSss = 135;
    } else if (basicSalary <= 30000) {
      calculatedSss = Math.min(basicSalary * 0.045, 1350);
    } else {
      calculatedSss = 1350;
    }

    const calculatedPhilHealth = Math.min(basicSalary * 0.04, 3200);

    const calculatedPagIbig = Math.min(basicSalary * 0.02, 100);

    setTax(Math.round(calculatedTax));
    setSss(Math.round(calculatedSss));
    setPhilHealth(Math.round(calculatedPhilHealth));
    setPagIbig(Math.round(calculatedPagIbig));

    toast({
      title: "Deductions Calculated",
      description: "Deductions have been automatically calculated based on Philippine tax and contribution rates.",
    });
  };

  const createPayslipMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) {
        throw new Error("Please select an employee");
      }

      const payslipData = {
        userId: selectedEmployee,
        month,
        year,
        basicSalary: basicSalary * 100, 
        allowances: {
          overtime: overtime * 100,
          allowances: allowances * 100,
          bonuses: bonuses * 100,
        },
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
        description: "The payslip has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payslips"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create payslip",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setBasicSalary(0);
    setOvertime(0);
    setAllowances(0);
    setBonuses(0);
    setTax(0);
    setSss(0);
    setPhilHealth(0);
    setPagIbig(0);
    setOthers(0);
  };

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    const employee = teamMembers?.find((m: User) => m.id === employeeId);
    if (employee && employee.salary) {
      setBasicSalary(employee.salary / 100); 
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {}
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Calculator className="w-6 h-6 mr-2" />
            Salary {isEmployee ? 'Calculator' : 'Computation'}
          </h1>
          <p className="text-muted-foreground">
            {isEmployee
              ? 'Calculate and verify your salary breakdown for transparency'
              : 'Calculate and generate employee payslips'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {}
          <div className="lg:col-span-2 space-y-6">
            {}
            {isManagerOrAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Employee Information</CardTitle>
                  <CardDescription>Select employee and pay period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="employee">Employee *</Label>
                    <Select value={selectedEmployee} onValueChange={handleEmployeeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers?.map((member: User) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName} - {member.position || "No position"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="month">Month</Label>
                      <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={m.toString()}>
                              {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isEmployee && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">Salary Calculator</CardTitle>
                  <CardDescription className="text-blue-700">
                    Enter your salary details to calculate your net pay and verify deductions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-800">
                    This calculator helps you understand your salary breakdown based on Philippine tax laws and mandatory contributions (SSS, PhilHealth, Pag-IBIG).
                    Use the "Auto Calculate" button in the Deductions section to automatically compute your mandatory deductions.
                  </p>
                </CardContent>
              </Card>
            )}

            {}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-green-700">
                      <Plus className="w-5 h-5 mr-2" />
                      Earnings
                    </CardTitle>
                    <CardDescription>Income components</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="basicSalary">Basic Salary (₱)</Label>
                  <Input
                    id="basicSalary"
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="overtime">Overtime Pay (₱)</Label>
                  <Input
                    id="overtime"
                    type="number"
                    value={overtime}
                    onChange={(e) => setOvertime(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="allowances">Allowances (₱)</Label>
                  <Input
                    id="allowances"
                    type="number"
                    value={allowances}
                    onChange={(e) => setAllowances(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="bonuses">Bonuses (₱)</Label>
                  <Input
                    id="bonuses"
                    type="number"
                    value={bonuses}
                    onChange={(e) => setBonuses(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </CardContent>
            </Card>

            {}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-red-700">
                      <Minus className="w-5 h-5 mr-2" />
                      Deductions
                    </CardTitle>
                    <CardDescription>Mandatory and other deductions</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoCalculateDeductions}
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Auto Calculate
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tax">Withholding Tax (₱)</Label>
                  <Input
                    id="tax"
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="sss">SSS Contribution (₱)</Label>
                  <Input
                    id="sss"
                    type="number"
                    value={sss}
                    onChange={(e) => setSss(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="philHealth">PhilHealth Contribution (₱)</Label>
                  <Input
                    id="philHealth"
                    type="number"
                    value={philHealth}
                    onChange={(e) => setPhilHealth(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="pagIbig">Pag-IBIG Contribution (₱)</Label>
                  <Input
                    id="pagIbig"
                    type="number"
                    value={pagIbig}
                    onChange={(e) => setPagIbig(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="others">Other Deductions (₱)</Label>
                  <Input
                    id="others"
                    type="number"
                    value={others}
                    onChange={(e) => setOthers(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Pay</span>
                    <span className="font-semibold text-green-700">{formatCurrency(calculateGrossPay())}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Deductions</span>
                    <span className="font-semibold text-red-700">{formatCurrency(calculateTotalDeductions())}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Net Pay</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(calculateNetPay())}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  {isManagerOrAdmin && (
                    <Button
                      className="w-full"
                      onClick={() => createPayslipMutation.mutate()}
                      disabled={!selectedEmployee || createPayslipMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {createPayslipMutation.isPending ? "Generating..." : "Generate Payslip"}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={resetForm}
                  >
                    Reset Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
