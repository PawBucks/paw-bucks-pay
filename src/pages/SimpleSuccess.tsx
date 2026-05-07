import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Check } from "lucide-react";
import { Formatters } from "@/utils/formatters";

const SimpleSuccess = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [params] = useSearchParams();
  const saved = parseFloat(params.get("saved") ?? "0") || 0;
  const earned = parseFloat(params.get("earned") ?? "0") || 0;
  const merchant = params.get("merchant") ?? "your favorite place";

  // Auto-bounce home after a moment
  useEffect(() => {
    const t = setTimeout(() => navigate("/home"), 8000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <>
      <SEO title="Payment complete — PawBucks" noIndex />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-28 max-w-md mx-auto text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center mb-5"
          >
            <Check className="h-10 w-10 text-success" />
          </motion.div>

          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            You're all set
          </h1>
          <p className="text-muted-foreground mb-6">
            Paid {merchant}. Thanks for taking care of your pet.
          </p>

          {saved > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground px-6 py-5 mb-3 w-full shadow-[var(--shadow-glow-primary)]"
            >
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90 mb-1">
                <Sparkles className="h-3.5 w-3.5" /> You saved
              </div>
              <div className="text-4xl font-semibold tabular-nums">
                {Formatters.currency(saved)}
              </div>
            </motion.div>
          )}

          {earned > 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              Plus {Formatters.currency(earned)} added to your savings for next time.
            </p>
          )}

          <div className="w-full space-y-2">
            <Button size="lg" className="w-full h-14 rounded-xl" onClick={() => navigate("/home")}>
              Done
            </Button>
            <Button size="lg" variant="outline" className="w-full h-12 rounded-xl" onClick={() => navigate("/savings")}>
              See my savings
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    </>
  );
};

export default SimpleSuccess;