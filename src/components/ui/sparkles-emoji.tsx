import { CSSProperties } from "react";

interface SparklesProps {
  className?: string;
  size?: number | string;
  style?: CSSProperties;
  strokeWidth?: number;
  color?: string;
  [key: string]: any;
}

/**
 * Drop-in replacement for the lucide `Sparkles` icon.
 * Renders the ✨ emoji while preserving className/size APIs so existing
 * call sites (which pass Tailwind size classes like `w-5 h-5`) still work.
 */
export const Sparkles = ({ className = "", size, style, strokeWidth: _sw, color, ...rest }: SparklesProps) => {
  const mergedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    fontSize: typeof size === "number" ? `${size}px` : size ?? "1em",
    width: typeof size === "number" ? `${size}px` : undefined,
    height: typeof size === "number" ? `${size}px` : undefined,
    color,
    ...style,
  };
  return (
    <span
      role="img"
      aria-label="sparkles"
      className={className}
      style={mergedStyle}
      {...rest}
    >
      ✨
    </span>
  );
};

export default Sparkles;
