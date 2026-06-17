import { memo } from"react";
import { useNavigate } from"react-router-dom";
import { Button } from"@/components/ui/button";
import { LogOut, Menu } from"lucide-react";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
 DropdownMenuSeparator,
} from"@/components/ui/dropdown-menu";
import { NotificationsDropdown } from"@/components/NotificationsDropdown";
import logo from"@/assets/logo.png";

interface MenuItem {
 label: string;
 path: string;
}

interface HeaderProps {
 menuItems?: MenuItem[];
 isAuthenticated?: boolean;
 onLogout?: () => void;
 userId?: string;
 variant?:"petowner" |"merchant";
}

const HeaderComponent = ({ menuItems, isAuthenticated = false, onLogout, userId, variant ="petowner" }: HeaderProps) => {
 const navigate = useNavigate();
 
 const defaultMenuItems: MenuItem[] = [
 { label:"For Pet Owners", path:"/" },
 { label:"Pet Store", path:"/pet-store" },
 { label:"Lost Pets", path:"/lost-pets" },
 { label:"For Pet Merchants", path:"/merchants" }
 ];

 const petOwnerMenuItems: MenuItem[] = [
 { label:"Home", path:"/home" },
 { label:"Discover", path:"/discover" },
 { label:"Pet Store", path:"/pet-store" },
 { label:"Lost Pets", path:"/lost-pets" },
 { label:"PawBucks Wallet", path:"/pawbucks/wallet" },
 { label:"Profile", path:"/profile" }
 ];

 const merchantMenuItems: MenuItem[] = [
 { label:"Dashboard", path:"/merchant-dashboard" },
 { label:"Offers", path:"/merchant/offers" },
 { label:"Analytics", path:"/merchant-analytics" },
 { label:"Products", path:"/merchant/products" },
 { label:"Transactions", path:"/merchant/transactions" },
 { label:"PawBucks Wallet", path:"/merchant/pawbucks" }
 ];

 return (
 <header 
 className="border-b border-border/40 bg-card/98 backdrop-blur-xl sticky top-0 z-50 shadow-[var(--shadow-soft)]" 
 role="banner"
 style={{
 paddingTop:'max(0.5rem, env(safe-area-inset-top))',
 }}
 >
 <nav className="container mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3" aria-label="Main navigation">
 <div 
 className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity duration-150 active:scale-[0.98] touch-manipulation group shrink-0"
 onClick={() => navigate(variant ==="merchant" ?"/merchant-dashboard" :"/")}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => e.key ==='Enter' && navigate(variant ==="merchant" ?"/merchant-dashboard" :"/")}
 aria-label={variant ==="merchant" ?"Go to merchant dashboard" :"Go to home page"}
 >
 <img 
 src={logo} 
 alt="PawBucks Logo - Return to homepage" 
 className="h-11 sm:h-16 md:h-20 w-auto object-contain"
 width={80}
 height={80}
 loading="eager"
 />
 </div>
 
 <div className="flex items-center gap-1 sm:gap-3">
 {/* Desktop Navigation Links for Authenticated Users */}
 {isAuthenticated && variant ==="petowner" && (
 <div className="hidden md:flex items-center gap-1">
 <Button
 variant="ghost"
 onClick={() => navigate("/home")}
 className="text-sm font-medium hover:text-accent"
 >
 Home
 </Button>
 <Button
 variant="ghost"
 onClick={() => navigate("/discover")}
 className="text-sm font-medium hover:text-accent"
 >
 Discover
 </Button>
 <Button
 variant="ghost"
 onClick={() => navigate("/pet-store")}
 className="text-sm font-medium hover:text-accent"
 >
 Store
 </Button>
 <Button
 variant="ghost"
 onClick={() => navigate("/lost-pets")}
 className="text-sm font-medium hover:text-accent"
 >
 Lost Pets
 </Button>
 <Button
 variant="ghost"
 onClick={() => navigate("/pawbucks/wallet")}
 className="text-sm font-medium hover:text-accent"
 >
 PawBucks Wallet
 </Button>
 <Button
 variant="ghost"
 onClick={() => navigate("/profile")}
 className="text-sm font-medium hover:text-accent"
 >
 Profile
 </Button>
 </div>
 )}

 {/* Desktop Navigation Links for Authenticated Merchants */}
 {isAuthenticated && variant ==="merchant" && (
 <div className="hidden md:flex items-center gap-1">
 {merchantMenuItems.map((item, index) => (
 <Button
 key={index}
 variant="ghost"
 onClick={() => navigate(item.path)}
 className="text-sm font-medium hover:text-accent"
 >
 {item.label}
 </Button>
 ))}
 </div>
 )}

 {/* Desktop Navigation Links for Unauthenticated Users */}
 {!isAuthenticated && (
 <div className="hidden md:flex items-center gap-2">
 {(menuItems || defaultMenuItems).map((item, index) => (
 <Button
 key={index}
 variant="ghost"
 onClick={() => navigate(item.path)}
 className="text-sm font-medium hover:text-accent"
 >
 {item.label}
 </Button>
 ))}
 </div>
 )}

 {isAuthenticated && onLogout ? (
 <>
 {userId && <NotificationsDropdown userId={userId} />}
 {/* Desktop logout button */}
 <Button
 onClick={onLogout}
 variant="ghost"
 className="hidden md:inline-flex gap-2 min-h-[44px] touch-manipulation text-muted-foreground hover:text-destructive"
 aria-label="Logout"
 >
 <LogOut className="h-4 w-4" />
 <span>Logout</span>
 </Button>
 {/* Mobile hamburger: nav links + logout */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 size="icon"
 variant="outline"
 className="md:hidden h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
 aria-label="Open menu"
 >
 <Menu className="h-5 w-5" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" sideOffset={8} className="w-56 bg-card z-50">
 {(variant ==="merchant" ? merchantMenuItems : petOwnerMenuItems).map((item, index) => (
 <DropdownMenuItem
 key={index}
 onClick={() => navigate(item.path)}
 className="cursor-pointer min-h-[44px] touch-manipulation"
 >
 {item.label}
 </DropdownMenuItem>
 ))}
 <DropdownMenuSeparator />
 <DropdownMenuItem
 onClick={onLogout}
 className="cursor-pointer min-h-[44px] touch-manipulation text-destructive focus:text-destructive"
 >
 <LogOut className="h-4 w-4 mr-2" />
 Logout
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </>
 ) : (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 size="icon"
 variant="outline"
 className="md:hidden h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
 aria-label="Open menu"
 >
 <Menu className="h-5 w-5" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" sideOffset={8} className="w-56 bg-card z-50">
 {(menuItems || defaultMenuItems).map((item, index) => (
 <DropdownMenuItem
 key={index}
 onClick={() => navigate(item.path)}
 className="cursor-pointer min-h-[44px] touch-manipulation"
 >
 {item.label}
 </DropdownMenuItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>
 </nav>
 </header>
 );
};

export const Header = memo(HeaderComponent);
