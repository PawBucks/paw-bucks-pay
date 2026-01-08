import { ReactNode, memo } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

// Simplified page transition - removed useState/useEffect for instant rendering
// CSS handles the animation without blocking first paint
const PageTransitionComponent = ({ children }: PageTransitionProps) => {
  return (
    <div className="min-h-screen animate-fade-in">
      {children}
    </div>
  );
};

export const PageTransition = memo(PageTransitionComponent);