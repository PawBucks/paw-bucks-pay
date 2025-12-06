import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowLeft, Home, Sparkles, Gift, ShoppingBag } from "lucide-react";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const storeId = searchParams.get("store");
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
      <SEO 
        title="Payment Successful"
        description="Your payment was processed successfully"
      />

      {/* Animated Background Elements */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 5)],
              }}
              initial={{ y: -20, opacity: 1, scale: 0 }}
              animate={{
                y: window.innerHeight + 100,
                opacity: [1, 1, 0],
                scale: [0, 1, 0.5],
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="max-w-md w-full shadow-2xl border-primary/20">
          <CardHeader className="text-center pb-2">
            <motion.div 
              className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            >
              <CheckCircle className="h-12 w-12 text-white" />
            </motion.div>
            <CardTitle className="text-2xl md:text-3xl font-bold">Payment Successful!</CardTitle>
            <CardDescription className="text-base">
              Your order has been confirmed and is being processed
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* PawBucks Reward Notification */}
            <motion.div 
              className="p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-xl border border-amber-500/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    PawBucks Earned!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Rewards added to your wallet
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Order Details */}
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Gift className="h-5 w-5 text-primary" />
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
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              className="flex flex-col gap-3 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button 
                onClick={() => navigate("/dashboard")} 
                className="w-full"
                size="lg"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>

              <Button 
                onClick={() => navigate("/pawbucks")} 
                variant="outline"
                className="w-full border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
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
                  <ShoppingBag className="h-4 w-4 mr-2" />
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
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Floating Background Decorations */}
      <div className="absolute top-1/4 left-10 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
      <div className="absolute bottom-1/4 right-10 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
    </div>
  );
};

export default CheckoutSuccess;
