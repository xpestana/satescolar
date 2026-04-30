import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant: "purple" | "orange" | "blue" | "pink" | "green" | "cyan";
  subtitle?: string;
}

const variantStyles = {
  purple: {
    bg: "bg-metric-purple",
    icon: "text-metric-purple-icon",
    title: "text-metric-purple-icon",
  },
  orange: {
    bg: "bg-metric-orange",
    icon: "text-metric-orange-icon",
    title: "text-metric-orange-icon",
  },
  blue: {
    bg: "bg-metric-blue",
    icon: "text-metric-blue-icon",
    title: "text-metric-blue-icon",
  },
  pink: {
    bg: "bg-metric-pink",
    icon: "text-metric-pink-icon",
    title: "text-metric-pink-icon",
  },
  green: {
    bg: "bg-metric-green",
    icon: "text-metric-green-icon",
    title: "text-metric-green-icon",
  },
  cyan: {
    bg: "bg-metric-cyan",
    icon: "text-metric-cyan-icon",
    title: "text-metric-cyan-icon",
  },
};

export function MetricCard({ title, value, icon, variant, subtitle }: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn("border-none shadow-sm", styles.bg)}>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className={cn("mb-3", styles.icon)}>
          {icon}
        </div>
        <p className={cn("text-sm font-medium mb-1", styles.title)}>{title}</p>
        {value === "..." ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
        {subtitle && (
          <p className={cn("text-xs mt-1", styles.title)}>{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
