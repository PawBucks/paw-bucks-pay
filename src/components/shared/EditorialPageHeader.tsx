import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EditorialPageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  /** Optional fragment of the title rendered in italic primary color (editorial accent). */
  titleAccent?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** When true, removes the bottom hairline divider. */
  noDivider?: boolean;
  /** Visual scale. `compact` is for sidebar-shell dashboards. */
  size?: "default" | "compact";
}

/**
 * Editorial page header that mirrors the landing page DNA:
 *  - Uppercase tracked eyebrow in primary
 *  - Playfair Display title (inherited via global h1 styles) with optional italic accent
 *  - Muted-foreground subtitle
 *  - Hairline divider that ties the section to the editorial rhythm
 *
 * Designed to coexist with dense dashboard layouts — keeps utility intact
 * while bringing shared design DNA across Pet Owner / Merchant / Vet / Admin.
 */
export function EditorialPageHeader({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  actions,
  className,
  noDivider = false,
  size = "default",
}: EditorialPageHeaderProps) {
  const titleClasses =
    size === "compact"
      ? "text-2xl md:text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-foreground"
      : "text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.025em] text-foreground";

  return (
    <header
      className={cn(
        "w-full",
        !noDivider && "border-b border-border/60 pb-5 md:pb-6 mb-6 md:mb-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary mb-2 md:mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className={titleClasses}>
            {title}
            {titleAccent && (
              <>
                {" "}
                <em className="not-italic md:italic font-bold text-primary">
                  {titleAccent}
                </em>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-2 md:mt-3 text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3 md:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default EditorialPageHeader;