import { cn } from"@/lib/utils";
import { ReactNode } from"react";

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
       "rounded-md border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-300 ease-out backdrop-blur-sm group",
        gradient &&"bg-gradient-to-br from-primary/10 via-accent/8 to-secondary/10 border-primary/30",
       "hover:shadow-[var(--shadow-medium)] hover:border-primary/40 hover:-translate-y-0.5",
        onClick &&"cursor-pointer active:scale-[0.99]",
        className
      )}
 onClick={onClick}
 >
 {children}
 </article>
 );
};