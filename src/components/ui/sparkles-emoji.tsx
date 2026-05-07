import { CSSProperties, forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Drop-in replacement for the lucide `Sparkles` icon.
 * Renders the ✨ emoji while preserving the LucideIcon API so existing
 * call sites (className, size, color, ref) still work and type-check.
 */
export const Sparkles = forwardRef<SVGSVGElement, LucideProps>(
  ({ className = "", size, style, strokeWidth: _sw, color, ...rest }, _ref) => {
    const mergedStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      fontSize: typeof size === "number" ? `${size}px` : size ?? "1em",
      width: typeof size === "number" ? `${size}px` : undefined,
      height: typeof size === "number" ? `${size}px` : undefined,
      color: color as string | undefined,
      ...style,
    };
    return (
      <span
        role="img"
        aria-label="sparkles"
        className={className}
        style={mergedStyle}
        {...(rest as any)}
      >
        ✨
      </span>
    );
  }
) as unknown as React.ForwardRefExoticComponent<
  Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

export default Sparkles;
