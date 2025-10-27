import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GradientCardProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
  onClick?: () => void;
}

export const GradientCard = ({ children, className, gradient = false, onClick }: GradientCardProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-6 shadow-sm transition-all duration-300",
        gradient && "bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20",
        "hover:shadow-[var(--shadow-soft)]",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};