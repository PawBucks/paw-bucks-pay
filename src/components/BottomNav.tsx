import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Compass, Wallet, Gift, User, Coins, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Discover", to: "/discover", icon: Compass },
  { title: "Store", to: "/pet-store", icon: Store },
  { title: "PawBucks", to: "/pawbucks/wallet", icon: Coins },
  { title: "Profile", to: "/profile", icon: User },
];

const BottomNavComponent = () => {
  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] safe-area-inset-bottom"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 h-14">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[64px] min-h-[48px] active:scale-95 touch-manipulation",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isActive && "text-primary bg-primary/10 shadow-sm"
              )
            }
            aria-label={item.title}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive && "scale-110 text-primary"
                  )}
                  aria-hidden="true"
                />
                <span className={cn(
                  "text-[11px] font-medium transition-all",
                  isActive && "font-semibold text-primary"
                )}>{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export const BottomNav = memo(BottomNavComponent);
