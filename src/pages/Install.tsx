import { useState, useEffect } from"react";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Download, Smartphone, Zap, Shield, Wifi, CheckCircle2 } from"lucide-react";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";

interface BeforeInstallPromptEvent extends Event {
 prompt: () => Promise<void>;
 userChoice: Promise<{ outcome:"accepted" |"dismissed" }>;
}

export default function Install() {
 const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
 const [isInstallable, setIsInstallable] = useState(false);
 const [isInstalled, setIsInstalled] = useState(false);

 useEffect(() => {
 // Check if already installed
 if (window.matchMedia("(display-mode: standalone)").matches) {
 setIsInstalled(true);
 return;
 }

 // Listen for the beforeinstallprompt event
 const handleBeforeInstallPrompt = (e: Event) => {
 e.preventDefault();
 setDeferredPrompt(e as BeforeInstallPromptEvent);
 setIsInstallable(true);
 };

 window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

 // Check if app is installed
 window.addEventListener("appinstalled", () => {
 setIsInstalled(true);
 setIsInstallable(false);
 });

 return () => {
 window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
 };
 }, []);

 const handleInstallClick = async () => {
 if (!deferredPrompt) return;

 deferredPrompt.prompt();
 const { outcome } = await deferredPrompt.userChoice;

 if (outcome ==="accepted") {
 console.log("User accepted the install prompt");
 }

 setDeferredPrompt(null);
 setIsInstallable(false);
 };

 const features = [
 {
 icon: <Zap className="w-6 h-6" />,
 title:"Lightning Fast",
 description:"Instant loading with optimized performance"
 },
 {
 icon: <Wifi className="w-6 h-6" />,
 title:"Works Offline",
 description:"Access your wallet even without internet"
 },
 {
 icon: <Shield className="w-6 h-6" />,
 title:"Secure & Safe",
 description:"Bank-level security for all transactions"
 },
 {
 icon: <Smartphone className="w-6 h-6" />,
 title:"Native Feel",
 description:"App-like experience on your home screen"
 }
 ];

 return (
 <>
 <SEO
 title={seoMeta.install.title}
 description={seoMeta.install.description}
 keywords={[...seoMeta.install.keywords]}
 canonical={seoMeta.install.canonical}
 />
 
 <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
 <div className="container mx-auto px-4 py-12 max-w-4xl">
 {/* Hero Section */}
 <div className="text-center mb-12 animate-fade-in">
 <div className="flex justify-center mb-6">
 <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-3xl shadow-[var(--shadow-large)] flex items-center justify-center animate-float">
 <img src="/logo.png" alt="PawBucks" className="w-16 h-16" />
 </div>
 </div>
 <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
 Get the PawBucks App
 </h1>
 <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
 Install PawBucks on your device for the ultimate pet payment experience. 
 Fast, secure, and works even offline!
 </p>
 </div>

 {/* Install Status Card */}
 {isInstalled ? (
 <Card className="mb-8 border-2 border-primary shadow-[var(--shadow-glow-primary)] animate-scale-in">
 <CardContent className="pt-6">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
 <CheckCircle2 className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold text-lg">App Already Installed!</h3>
 <p className="text-sm text-muted-foreground">
 You're all set. Find PawBucks on your home screen.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 ) : (
 <Card className="mb-8 shadow-[var(--shadow-large)] animate-scale-in">
 <CardHeader>
 <CardTitle className="flex items-center gap-3">
 <Download className="w-6 h-6 text-primary" />
 Install the App
 </CardTitle>
 <CardDescription>
 Add PawBucks to your home screen for quick access and offline capabilities
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {isInstallable ? (
 <Button 
 onClick={handleInstallClick} 
 size="lg" 
 className="w-full shadow-[var(--shadow-glow-primary)]"
 >
 <Download className="mr-2" />
 Install Now
 </Button>
 ) : (
 <div className="space-y-4">
 <div className="p-4 bg-muted/50 rounded-lg border">
 <p className="text-sm font-medium mb-2">How to Install:</p>
 <div className="space-y-2 text-sm text-muted-foreground">
 <p><strong>iPhone/iPad:</strong> Tap the Share button (📤) →"Add to Home Screen"</p>
 <p><strong>Android:</strong> Tap the menu (⋮) →"Install app" or"Add to Home screen"</p>
 <p><strong>Desktop:</strong> Look for the install icon (⊕) in your browser's address bar</p>
 </div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Features Grid */}
 <div className="grid md:grid-cols-2 gap-4 mb-8">
 {features.map((feature, index) => (
 <Card 
 key={index} 
 className="shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-medium)] transition-all duration-300 hover:-translate-y-1"
 style={{ animationDelay: `${index * 100}ms` }}
 >
 <CardContent className="pt-6">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary flex-shrink-0">
 {feature.icon}
 </div>
 <div>
 <h3 className="font-semibold mb-1">{feature.title}</h3>
 <p className="text-sm text-muted-foreground">{feature.description}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Benefits Section */}
 <Card className="shadow-[var(--shadow-medium)] bg-gradient-to-br from-card via-primary/5 to-accent/5">
 <CardHeader>
 <CardTitle>Why Install?</CardTitle>
 </CardHeader>
 <CardContent>
 <ul className="space-y-3">
 {[
"One-tap access from your home screen",
"Push notifications for transactions and rewards",
"Works even when you're offline",
"Faster than using a browser",
"Full-screen experience without browser UI",
"Automatic updates in the background"
 ].map((benefit, index) => (
 <li key={index} className="flex items-start gap-3">
 <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
 <span className="text-sm">{benefit}</span>
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 </div>
 </div>
 </>
 );
}
