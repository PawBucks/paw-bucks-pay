import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 active:scale-[0.97] hover:[&_svg]:scale-110 touch-manipulation cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-medium)] hover:shadow-[var(--shadow-glow-primary)] hover:-translate-y-1 hover:scale-[1.02]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[var(--shadow-medium)] hover:shadow-[var(--shadow-large)] hover:-translate-y-1 hover:scale-[1.02]",
        outline: "border-2 border-border bg-background hover:bg-accent/10 hover:text-accent-foreground hover:border-accent shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-medium)] hover:-translate-y-1 hover:scale-[1.02]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[var(--shadow-medium)] hover:shadow-[var(--shadow-glow-secondary)] hover:-translate-y-1 hover:scale-[1.02]",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground hover:scale-[1.02]",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        premium: "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-large)] hover:-translate-y-1 hover:scale-[1.02]",
      },
      size: {
        default: "h-11 px-5 py-2.5 min-w-[44px]",
        sm: "h-10 rounded-md px-4 text-xs min-w-[40px]",
        lg: "h-12 rounded-lg px-8 text-base min-w-[48px]",
        xl: "h-14 rounded-xl px-10 text-lg min-w-[52px]",
        icon: "h-11 w-11 min-w-[44px] min-h-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
