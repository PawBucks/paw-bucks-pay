import { forwardRef } from "react";
import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLinkProps extends RouterNavLinkProps {
  activeClassName?: string;
}

/**
 * Enhanced NavLink component with active state styling
 */
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, children, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        className={({ isActive }) =>
          cn(
            className,
            isActive && activeClassName
          )
        }
        {...props}
      >
        {children}
      </RouterNavLink>
    );
  }
);

NavLink.displayName = "NavLink";
