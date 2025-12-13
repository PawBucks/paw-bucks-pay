import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Compass, User, Coins, Store, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Home", to: "/dashboard", icon: Home },
  { title: "Discover", to: "/discover", icon: Compass },
  { title: "Store", to: "/pet-store", icon: Store },
  { title: "PawBucks", to: "/pawbucks/wallet", icon: Coins },
  { title: "Profile", to: "/profile", icon: User },
];

const BottomNavComponent = () => {
  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border/50 shadow-[0_-2px_16px_rgba(0,0,0,0.08)]"
      role="navigation"
      aria-label="Bottom navigation"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200 min-w-[56px] active:scale-95 touch-manipulation",
                "text-muted-foreground hover:text-foreground",
                isActive && "text-primary"
              )
            }
            aria-label={item.title}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-full transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-all duration-200",
                      isActive && "text-primary"
                    )}
                    aria-hidden="true"
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-all leading-tight",
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
