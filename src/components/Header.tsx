import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PawPrint, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MenuItem {
  label: string;
  path: string;
}

interface HeaderProps {
  menuItems?: MenuItem[];
}

export const Header = ({ menuItems }: HeaderProps) => {
  const navigate = useNavigate();
  
  const defaultMenuItems: MenuItem[] = [
    { label: "For Pet Lovers", path: "/" },
    { label: "For Pet Merchants", path: "/merchants" }
  ];

  return (
    <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm" role="banner">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between" aria-label="Main navigation">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate("/")}
          aria-label="Go to home page"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center shadow-lg" aria-hidden="true">
            <PawPrint className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-accent">
            PetalPay
          </h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon"
              className="shadow-xl hover:shadow-2xl transition-all hover:scale-105"
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
                className="cursor-pointer"
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
};
