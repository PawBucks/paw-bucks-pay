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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                "text-muted-foreground hover:text-foreground",
                isActive && "text-primary"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive && "scale-110"
                  )} 
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
