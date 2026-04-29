import { useState, useEffect } from"react";
import { X, Download } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Card } from"@/components/ui/card";
import { useNavigate } from"react-router-dom";

export const PWAInstallBanner = () => {
 const [isVisible, setIsVisible] = useState(false);
 const [isDismissed, setIsDismissed] = useState(false);
 const navigate = useNavigate();

 useEffect(() => {
 // Check if already dismissed
 const dismissed = localStorage.getItem("pwa-banner-dismissed");
 if (dismissed) {
 setIsDismissed(true);
 return;
 }

 // Check if already installed
 if (window.matchMedia("(display-mode: standalone)").matches) {
 return;
 }

 // Show banner after a short delay on mobile
 const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
 if (isMobile) {
 const timer = setTimeout(() => {
 setIsVisible(true);
 }, 3000);

 return () => clearTimeout(timer);
 }
 }, []);

 const handleDismiss = () => {
 setIsVisible(false);
 localStorage.setItem("pwa-banner-dismissed","true");
 setIsDismissed(true);
 };

 const handleInstall = () => {
 navigate("/install");
 handleDismiss();
 };

 if (!isVisible || isDismissed) return null;

 return (
 <div 
 className="fixed z-50 animate-fade-in md:bottom-4 md:left-auto md:right-4 md:max-w-sm left-3 right-3"
 style={{
 bottom:'calc(4.5rem + max(0.5rem, env(safe-area-inset-bottom)))',
 }}
 >
 <Card className="shadow-[var(--shadow-large)] border-2 border-primary/20 bg-gradient-to-br from-card via-primary/5 to-accent/5 backdrop-blur-sm">
 <div className="p-4">
 <button
 onClick={handleDismiss}
 className="absolute right-2 top-2 p-1 rounded-full hover:bg-muted transition-colors"
 aria-label="Dismiss"
 >
 <X className="w-4 h-4" />
 </button>
 
 <div className="flex items-start gap-3 pr-6">
 <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
 <Download className="w-5 h-5 text-primary" />
 </div>
 
 <div className="flex-1">
 <h3 className="font-semibold text-sm mb-1">
 Install PawBucks
 </h3>
 <p className="text-xs text-muted-foreground mb-3">
 Get the app experience! Faster, offline access, and more.
 </p>
 
 <Button 
 size="sm" 
 onClick={handleInstall}
 className="w-full shadow-[var(--shadow-glow-primary)]"
 >
 Install App
 </Button>
 </div>
 </div>
 </div>
 </Card>
 </div>
 );
};
