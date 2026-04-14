import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface CartIconProps {
  itemCount: number;
  onClick: () => void;
}

export function CartIcon({ itemCount, onClick }: CartIconProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="relative"
      onClick={onClick}
      aria-label={`Shopping cart with ${itemCount} items`}
    >
      <ShoppingCart className="h-5 w-5" />
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
          >
            {itemCount > 99 ? "99+" : itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
