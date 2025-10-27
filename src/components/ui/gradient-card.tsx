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
    <article
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300",
        gradient && "bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border-primary/20",
        "hover:shadow-[var(--shadow-soft)] hover:border-primary/30",
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      {children}
    </article>
  );
};