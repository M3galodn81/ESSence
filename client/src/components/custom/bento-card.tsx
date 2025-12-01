import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BentoVariant = "default" | "emerald" | "rose" | "amber";

interface BentoCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: BentoVariant;
  testIdPrefix?: string;
}

const variants = {
  default: {
    card: "bg-white/60 border-slate-200/60",
    title: "text-slate-500",
    value: "text-slate-800",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
  emerald: {
    card: "bg-emerald-50/50 border-emerald-100/60",
    title: "text-emerald-600",
    value: "text-emerald-800",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  rose: {
    card: "bg-rose-50/50 border-rose-100/60",
    title: "text-rose-600",
    value: "text-rose-800",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  amber: {
    card: "bg-amber-50/50 border-amber-100/60",
    title: "text-amber-600",
    value: "text-amber-800",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  indigo: {
    card: "bg-amber-50/50 border-indigo-100/60",
    title: "text-indigo-600",
    value: "text-indigo-800",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
};

export function BentoCard({ title, value, icon: Icon, variant = "default", testIdPrefix }: BentoCardProps) {
  const styles = variants[variant];

  return (
    <Card className={cn("backdrop-blur-xl shadow-sm hover:shadow-md transition-all rounded-2xl", styles.card)}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className={cn("text-xs font-medium uppercase tracking-wider", styles.title)}>{title}</p>
          <p className={cn("text-3xl font-bold mt-2", styles.value)} data-testid={testIdPrefix}>
            {value}
          </p>
        </div>
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", styles.iconBg, styles.iconColor)}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}