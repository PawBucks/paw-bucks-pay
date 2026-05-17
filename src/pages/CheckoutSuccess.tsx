import { useEffect, useState } from"react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { SEO } from"@/components/SEO";

const CheckoutSuccess = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const sessionId = searchParams.get("session_id");
 const storeId = searchParams.get("store");
 const [isVisible, setIsVisible] = useState(false);
 const [showConfetti, setShowConfetti] = useState(true);

 useEffect(() => {
 // Trigger entrance animation
 requestAnimationFrame(() => setIsVisible(true));
 
 // Hide confetti after animation
 const timer = setTimeout(() => setShowConfetti(false), 3000);
 return () => clearTimeout(timer);
 }, []);

 return (
 <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
 <SEO 
 title="Payment Successful"
 description="Your payment was processed successfully"
 noIndex
 />

 {/* Animated Confetti Particles */}
 {showConfetti && (
 <div className="absolute inset-0 pointer-events-none overflow-hidden">
 {[...Array(20)].map((_, i) => (
 <div
 key={i}
 className="absolute w-3 h-3 rounded-full animate-confetti"
 style={{
 left: `${Math.random() * 100}%`,
 backgroundColor: ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'][Math.floor(Math.random() * 5)],
 animationDelay: `${Math.random() * 0.5}s`,
 animationDuration: `${2 + Math.random() * 2}s`,
 }}
 />
 ))}
 </div>
 )}

 <div
 className={`transition-all duration-500 ease-out ${
 isVisible 
 ?'opacity-100 scale-100 translate-y-0' 
 :'opacity-0 scale-95 translate-y-4'
 }`}
 >
 <Card className="max-w-md w-full shadow-2xl border-primary/20">
 <CardHeader className="text-center pb-2">
 <div 
 className={`mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-success to-success flex items-center justify-center shadow-lg shadow-green-500/30 transition-all duration-500 delay-200 ${
 isVisible ?'scale-100' :'scale-0'
 }`}
 >
 <CheckCircle className="h-12 w-12 text-white" />
 </div>
 <CardTitle className="text-2xl md:text-3xl font-bold">Payment Successful!</CardTitle>
 <CardDescription className="text-base">
 Your order has been confirmed and is being processed
 </CardDescription>
 </CardHeader>

 <CardContent className="space-y-6">
 {/* PawBucks Reward Notification */}
 <div 
 className={`p-4 bg-gradient-to-r from-warning/10 via-warning/10 to-warning/10 rounded-md border border-warning/20 transition-all duration-500 delay-300 ${
 isVisible ?'opacity-100 translate-x-0' :'opacity-0 -translate-x-4'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-gradient-to-br from-warning to-warning flex items-center justify-center">
 <Sparkles className="h-5 w-5 text-white" />
 </div>
 <div>
 <p className="font-semibold text-warning">
 PawBucks Earned!
 </p>
 <p className="text-sm text-muted-foreground">
 Rewards added to your wallet
 </p>
 </div>
 </div>
 </div>

 {/* Order Details */}
 <div 
 className={`space-y-3 transition-all duration-500 delay-400 ${
 isVisible ?'opacity-100' :'opacity-0'
 }`}
 >
 <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
 <span className="h-5 w-5 text-primary" aria-hidden="true">🎁</span>
 <div className="text-sm">
 <p className="font-medium">Confirmation email sent</p>
 <p className="text-muted-foreground">Check your inbox for details</p>
 </div>
 </div>

 {sessionId && (
 <div className="p-3 bg-muted/30 rounded-lg">
 <p className="text-xs text-muted-foreground mb-1">Order Reference</p>
 <p className="text-xs font-mono break-all text-foreground/70">
 {sessionId.substring(0, 20)}...
 </p>
 </div>
 )}
 </div>

 {/* Action Buttons */}
 <div 
 className={`flex flex-col gap-3 pt-4 transition-all duration-500 delay-500 ${
 isVisible ?'opacity-100 translate-y-0' :'opacity-0 translate-y-4'
 }`}
 >
 <Button 
 onClick={() => navigate("/home")} 
 className="w-full"
 size="lg"
 >
 <span className="h-4 w-4 mr-2" aria-hidden="true">🏠</span>
 Go to Dashboard
 </Button>

 <Button 
 onClick={() => navigate("/pawbucks/wallet")} 
 variant="outline"
 className="w-full border-warning/30 text-warning hover:bg-warning/10"
 size="lg"
 >
 <Sparkles className="h-4 w-4 mr-2" />
 View PawBucks Wallet
 </Button>

 {storeId && (
 <Button 
 variant="ghost" 
 onClick={() => navigate(`/store/${storeId}`)} 
 className="w-full"
 >
 <span className="h-4 w-4 mr-2" aria-hidden="true">🛍️</span>
 Continue Shopping
 </Button>
 )}

 {!storeId && (
 <Button 
 variant="ghost" 
 onClick={() => navigate(-2)} 
 className="w-full"
 >
 <ArrowLeft className="h-4 w-4 mr-2" />
 Back to Previous Page
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Floating Background Decorations */}
 <div className="absolute top-1/4 left-10 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
 <div className="absolute bottom-1/4 right-10 w-32 h-32 bg-warning/5 rounded-full blur-3xl" />
 </div>
 );
};

export default CheckoutSuccess;