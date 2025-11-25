import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  isLoading?: boolean;
  className?: string;
  "data-testid"?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  bgColor = "bg-primary/10",
  isLoading = false,
  className,
  "data-testid": testId,
}: StatCardProps) {
  return (
    <Card className={cn("", className)} data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold text-foreground" data-testid={`${testId}-value`}>
                {value}
              </p>
            )}
          </div>
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", bgColor)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
