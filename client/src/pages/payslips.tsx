import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Eye, Calendar } from "lucide-react";
import type { Payslip } from "@shared/schema";

export default function Payslips() {
  const { data: payslips, isLoading } = useQuery({
    queryKey: ["/api/payslips"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); 
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {}
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Payslips</h1>
          <p className="text-muted-foreground">View and download your salary statements</p>
        </div>

        {}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8" data-testid="loading-payslips">
              <p className="text-muted-foreground">Loading payslips...</p>
            </div>
          ) : payslips && payslips.length > 0 ? (
            payslips.map((payslip: Payslip) => (
              <Card key={payslip.id} data-testid={`payslip-${payslip.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`payslip-title-${payslip.id}`}>
                          {getMonthName(payslip.month)} {payslip.year}
                        </CardTitle>
                        <CardDescription data-testid={`payslip-generated-${payslip.id}`}>
                          Generated on {formatDate(payslip.generatedAt!)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" data-testid={`payslip-status-${payslip.id}`}>
                        Paid
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-view-${payslip.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-download-${payslip.id}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                        Earnings
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Basic Salary</span>
                          <span className="text-sm font-medium" data-testid={`basic-salary-${payslip.id}`}>
                            {formatCurrency(payslip.basicSalary)}
                          </span>
                        </div>
                        {payslip.allowances && Object.entries(payslip.allowances as Record<string, number>).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className="text-sm font-medium" data-testid={`allowance-${key}-${payslip.id}`}>
                              {formatCurrency(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                        Deductions
                      </h4>
                      <div className="space-y-2">
                        {payslip.deductions && Object.entries(payslip.deductions as Record<string, number>).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className="text-sm font-medium text-destructive" data-testid={`deduction-${key}-${payslip.id}`}>
                              -{formatCurrency(value)}
                            </span>
                          </div>
                        ))}
                        {(!payslip.deductions || Object.keys(payslip.deductions).length === 0) && (
                          <div className="text-sm text-muted-foreground">No deductions</div>
                        )}
                      </div>
                    </div>

                    {}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                        Summary
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Gross Pay</span>
                          <span className="text-sm font-medium" data-testid={`gross-pay-${payslip.id}`}>
                            {formatCurrency(payslip.grossPay)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold">Net Pay</span>
                          <span className="text-lg font-bold text-primary" data-testid={`net-pay-${payslip.id}`}>
                            {formatCurrency(payslip.netPay)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-center" data-testid="no-payslips">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No payslips available</h3>
                  <p className="text-muted-foreground">Your payslips will appear here once they are generated</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Payslip Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Pay Schedule</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pay Frequency:</span>
                    <span>Monthly</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pay Day:</span>
                    <span>Last working day of the month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Pay Date:</span>
                    <span>{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3">Important Notes</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Payslips are generated on the last working day of each month</p>
                  <p>• You can download PDF copies of your payslips anytime</p>
                  <p>• Contact HR if you notice any discrepancies</p>
                  <p>• Keep your payslips for tax and loan application purposes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
