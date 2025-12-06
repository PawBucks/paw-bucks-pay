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
import logo from "@/assets/logo.png";

interface MenuItem {
  label: string;
  path: string;
}

interface HeaderProps {
  menuItems?: MenuItem[];
  isAuthenticated?: boolean;
  onLogout?: () => void;
}

const HeaderComponent = ({ menuItems, isAuthenticated = false, onLogout }: HeaderProps) => {
  const navigate = useNavigate();
  
  const defaultMenuItems: MenuItem[] = [
    { label: "For Pet Lovers", path: "/" },
    { label: "Pet Store", path: "/pet-store" },
    { label: "For Pet Merchants", path: "/merchants" }
  ];

  return (
    <header className="border-b border-border/50 bg-card/95 backdrop-blur-xl sticky top-0 z-50 shadow-[var(--shadow-soft)] safe-area-inset-top" role="banner">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4" aria-label="Main navigation">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all duration-200 active:scale-95 touch-manipulation group"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate("/")}
          aria-label="Go to home page"
        >
          <img 
            src={logo} 
            alt="PawBucks Logo - Return to homepage" 
            className="h-14 sm:h-16 md:h-20 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            width={80}
            height={80}
            loading="eager"
          />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {!isAuthenticated && (menuItems || defaultMenuItems).map((item, index) => (
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

          {isAuthenticated && onLogout ? (
            <Button 
              onClick={onLogout}
              variant="outline"
              className="gap-2 min-h-[44px] touch-manipulation"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
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
