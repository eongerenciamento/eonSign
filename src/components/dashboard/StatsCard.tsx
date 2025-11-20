import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "primary";
}

export const StatsCard = ({ title, value, icon: Icon, trend, variant = "default" }: StatsCardProps) => {
  const variantStyles = {
    default: "bg-card border-border",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    primary: "bg-primary/10 border-primary/20",
  };

  const iconVariantStyles = {
    default: "bg-muted text-foreground",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    primary: "bg-primary/20 text-primary",
  };

  return (
    <Card className={`p-6 border ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-card-foreground">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 ${trend.isPositive ? "text-success" : "text-destructive"}`}>
              {trend.isPositive ? "+" : ""}{trend.value}% vs. mês anterior
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconVariantStyles[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};
