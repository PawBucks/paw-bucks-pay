import { useAuth } from "@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { BottomNav } from "@/components/BottomNav";
import { CustomerLoyaltyCards } from "@/components/dashboard/CustomerLoyaltyCards";
import { Stamp } from "lucide-react";

export default function LoyaltyCardsPage() {
  const { user } = useAuth();
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="My Loyalty Cards" description="Track your loyalty punch cards and rewards" />
      <Header />
      <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stamp className="w-6 h-6 text-primary" />
            My Loyalty Cards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your punch cards and redeem rewards from your favorite merchants
          </p>
        </div>
        <CustomerLoyaltyCards userId={effectiveUserId || user.id} />
      </div>
      <BottomNav />
    </div>
  );
}
