import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatVariant = "default" | "blue" | "emerald" | "amber" | "rose";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: StatVariant;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

const variants = {
  default: "bg-white/60 border-slate-200/50",
  blue: "bg-blue-50/60 border-blue-100/60 text-blue-900",
  emerald: "bg-emerald-50/60 border-emerald-100/60 text-emerald-900",
  amber: "bg-amber-50/60 border-amber-100/60 text-amber-900",
  rose: "bg-rose-50/60 border-rose-100/60 text-rose-900",
};

const iconStyles = {
  default: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  isLoading = false,
  className,
  testId,
}: StatCardProps) {
  return (
    <Card 
      className={cn(
        "backdrop-blur-xl shadow-sm hover:shadow-md transition-all rounded-2xl border",
        variants[variant],
        className
      )} 
      data-testid={testId}
    >
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 bg-black/5" />
          ) : (
            <p className="text-3xl font-bold" data-testid={`${testId}-value`}>
              {value}
            </p>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}