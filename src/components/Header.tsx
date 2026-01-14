import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import logo from "@/assets/logo.png";

interface MenuItem {
  label: string;
  path: string;
}

interface HeaderProps {
  menuItems?: MenuItem[];
  isAuthenticated?: boolean;
  onLogout?: () => void;
  userId?: string;
  variant?: "petowner" | "merchant";
}

const HeaderComponent = ({ menuItems, isAuthenticated = false, onLogout, userId, variant = "petowner" }: HeaderProps) => {
  const navigate = useNavigate();
  
  const defaultMenuItems: MenuItem[] = [
    { label: "For Pet Owners", path: "/" },
    { label: "Pet Store", path: "/pet-store" },
    { label: "Lost Pets", path: "/lost-pets" },
    { label: "For Pet Merchants", path: "/merchants" }
  ];

  const merchantMenuItems: MenuItem[] = [
    { label: "Dashboard", path: "/merchant/dashboard" },
    { label: "Offers", path: "/merchant/offers" },
    { label: "Analytics", path: "/merchant/analytics" },
    { label: "Products", path: "/merchant/products" },
    { label: "Transactions", path: "/merchant/transactions" },
    { label: "PawBucks Wallet", path: "/merchant/pawbucks-wallet" }
  ];

  return (
    <header 
      className="border-b border-border/50 bg-card/95 backdrop-blur-xl sticky top-0 z-50 shadow-[var(--shadow-soft)]" 
      role="banner"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      }}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 flex items-center justify-between gap-3" aria-label="Main navigation">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all duration-200 active:scale-95 touch-manipulation group"
          onClick={() => navigate(variant === "merchant" ? "/merchant/dashboard" : "/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(variant === "merchant" ? "/merchant/dashboard" : "/")}
          aria-label={variant === "merchant" ? "Go to merchant dashboard" : "Go to home page"}
        >
          <img 
            src={logo} 
            alt="PawBucks Logo - Return to homepage" 
            className="h-24 sm:h-32 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            width={128}
            height={128}
            loading="eager"
          />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Desktop Navigation Links for Authenticated Users */}
          {isAuthenticated && variant === "petowner" && (
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard")}
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
          {isAuthenticated && variant === "merchant" && (
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
              <Button 
                onClick={onLogout}
                variant="outline"
                className="gap-2 min-h-[44px] touch-manipulation"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="icon"
                  className="md:hidden shadow-lg hover:shadow-xl transition-all hover:scale-105 min-h-[44px] min-w-[44px] touch-manipulation"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card z-50">
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
