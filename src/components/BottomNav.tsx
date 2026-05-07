import { memo, useCallback } from"react";
import { NavLink, useLocation } from"react-router-dom";
import { Compass, User, Sparkles, Home, CreditCard } from"lucide-react";
import { cn } from"@/lib/utils";

const navItems = [
 { title:"Home", to:"/home", icon: Home, ariaLabel:"Home" },
 { title:"Pay", to:"/pay", icon: CreditCard, ariaLabel:"Pay & save" },
 { title:"Discover", to:"/discover", icon: Compass, ariaLabel:"Discover places" },
 { title:"Savings", to:"/savings", icon: Sparkles, ariaLabel:"Your savings" },
 { title:"Profile", to:"/profile", icon: User, ariaLabel:"Profile" },
];

const BottomNavComponent = () => {
 const location = useLocation();

 const isActiveRoute = useCallback((path: string) => {
  if (path ==="/home") {
  return location.pathname ==="/home" || location.pathname ==="/dashboard" || location.pathname ==="/";
 }
 return location.pathname.startsWith(path);
 }, [location.pathname]);

 return (
 <nav 
 className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border/40 shadow-[0_-1px_8px_rgba(0,0,0,0.04)] will-change-transform"
 role="navigation"
 aria-label="Main navigation"
 style={{
 paddingBottom:'max(0.5rem, env(safe-area-inset-bottom))',
 }}
 >
 <div className="flex items-center justify-around max-w-lg mx-auto px-1">
 {navItems.map((item) => {
 const isActive = isActiveRoute(item.to);
 
 return (
 <NavLink
 key={item.to}
 to={item.to}
 className={cn(
"flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-md transition-all duration-200 min-w-[56px] min-h-[48px] active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
"text-muted-foreground hover:text-foreground",
 isActive &&"text-primary"
 )}
 aria-label={item.ariaLabel}
 aria-current={isActive ?"page" : undefined}
 >
 <div className={cn(
"flex items-center justify-center w-10 h-8 rounded-full transition-all duration-200",
 isActive &&"bg-primary/10"
 )}>
 <item.icon
 className={cn(
"w-5 h-5 transition-all duration-200",
 isActive &&"text-primary"
 )}
 aria-hidden="true"
 />
 </div>
 <span className={cn(
"text-[10px] font-medium transition-all leading-tight",
 isActive &&"font-semibold text-primary"
 )}>{item.title}</span>
 </NavLink>
 );
 })}
 </div>
 </nav>
 );
};

export const BottomNav = memo(BottomNavComponent);
