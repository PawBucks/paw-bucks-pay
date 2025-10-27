import { NavLink } from "react-router-dom";
import { Compass, Wallet, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Discover", to: "/discover", icon: Compass },
  { title: "Wallet", to: "/wallet", icon: Wallet },
  { title: "Referrals", to: "/referrals", icon: Gift },
  { title: "Profile", to: "/profile", icon: User },
];

export const BottomNav = () => {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[64px]",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isActive && "text-primary bg-primary/10"
              )
            }
            aria-label={item.title}
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive && "scale-110"
                  )} 
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
