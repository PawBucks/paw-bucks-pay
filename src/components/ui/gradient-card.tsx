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
        "rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-300 backdrop-blur-sm",
        gradient && "bg-gradient-to-br from-primary/8 via-accent/6 to-secondary/8 border-primary/25",
        "hover:shadow-[var(--shadow-medium)] hover:border-primary/35 hover:-translate-y-0.5",
        onClick && "cursor-pointer hover:scale-[1.01]",
        className
      )}
      onClick={onClick}
    >
      {children}
    </article>
  );
};