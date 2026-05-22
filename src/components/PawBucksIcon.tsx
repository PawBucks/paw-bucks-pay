import { cn } from "@/lib/utils";
import pawbucksLogo from "@/assets/pawbucks-logo.png";

interface PawBucksIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
}

/**
 * PawBucks brand mark — drop-in replacement for the `PawPrint` lucide icon.
 * Accepts the same `className` / `size` props so it can be swapped 1:1.
 */
export const PawBucksIcon = ({ size, className, alt = "PawBucks", ...rest }: PawBucksIconProps) => {
  const style = size ? { width: size, height: size, ...rest.style } : rest.style;
  return (
    <img
      src={pawbucksLogo}
      alt={alt}
      {...rest}
      style={style}
      className={cn("inline-block object-contain shrink-0", className)}
    />
  );
};

export default PawBucksIcon;