import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShoppingCart, Coins, CreditCard, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AdPlacement } from "@/components/AdPlacement";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { PullToRefresh } from "@/components/PullToRefresh";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const CATEGORIES = ["All", "Food", "Treats", "Toys", "Bedding", "Accessories", "Healthcare", "Grooming"];

type PaymentMethod = "pawbucks" | "credit_card";

type PetStorePaymentFormProps = {
  itemId: string;
  itemName: string;
  quantity: number;
  totalAmount: number;
  cashbackRate: number;
  onSuccess: () => void;
  onCancel: () => void;
};

const PetStorePaymentForm = ({
  itemId,
  itemName,
  quantity,
  totalAmount,
  cashbackRate,
  onSuccess,
  onCancel,
}: PetStorePaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pet-store`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw error;
      }

      // PawBucks earned = amount × multiplier (10x, 20x, or 30x based on subscription)
      const pawbucksEarned = Math.round(totalAmount * cashbackRate);

      toast.success(
        `Payment successful! You earned ${pawbucksEarned} PawBucks!`
      );
      
      onSuccess();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  // PawBucks earned = amount × multiplier (10x, 20x, or 30x based on subscription)
  const pawbucksEarned = Math.round(totalAmount * cashbackRate);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Item:</span>
          <span className="font-medium">{itemName} x{quantity}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-medium">${totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">You'll earn ({cashbackRate}x):</span>
          <span className="font-bold text-accent flex items-center gap-1">
            <Coins className="h-3 w-3" />
            {pawbucksEarned} PawBucks
          </span>
        </div>
      </div>

      <PaymentElement />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || !stripe}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Pay Now"
          )}
        </Button>
      </div>
    </form>
  );
};

export default function PetStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  // Fetch user's PawBucks balance
  const { data: wallet } = useQuery({
    queryKey: ["pawbucks-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("pawbucks_wallet")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Check user's subscription for cashback rate
  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const cashbackRate = subscription ? 20 : 10; // 10x for free, 20x for subscribers (simplified)

  // Fetch active items
  const { data: items, isLoading } = useQuery({
    queryKey: ["pet-store-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_store_items")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (!user) throw new Error("Must be logged in");

      const item = items?.find(i => i.id === itemId);
      if (!item) throw new Error("Item not found");

      const totalCost = item.price_pawbucks * quantity;

      // Check balance
      if (!wallet || wallet.balance < totalCost) {
        throw new Error("Insufficient PawBucks balance");
      }

      // Check stock
      if (item.stock_quantity < quantity) {
        throw new Error("Not enough stock available");
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("pet_store_orders")
        .insert([{
          user_id: user.id,
          total_amount: totalCost,
          status: "completed",
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order item
      const { error: orderItemError } = await supabase
        .from("pet_store_order_items")
        .insert([{
          order_id: order.id,
          item_id: itemId,
          quantity: quantity,
          price_per_item: item.price_pawbucks,
        }]);

      if (orderItemError) throw orderItemError;

      // Deduct PawBucks
      const { error: walletError } = await supabase
        .from("pawbucks_wallet")
        .update({ balance: wallet.balance - totalCost })
        .eq("user_id", user.id);

      if (walletError) throw walletError;

      // Log activity
      const { error: activityError } = await supabase
        .from("pawbucks_activity")
        .insert([{
          user_id: user.id,
          type: "debit",
          amount: totalCost,
          source: "pet_store",
          description: `Purchased ${quantity}x ${item.name}`,
        }]);

      if (activityError) throw activityError;

      // Update stock
      const { error: stockError } = await supabase
        .from("pet_store_items")
        .update({ stock_quantity: item.stock_quantity - quantity })
        .eq("id", itemId);

      if (stockError) throw stockError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
      toast.success("Purchase successful!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Purchase failed");
    },
  });

  const handlePurchaseWithPawBucks = (itemId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    purchaseMutation.mutate({ itemId, quantity: 1 });
  };

  const handlePurchaseWithCard = async (item: any) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setSelectedItem(item);
    setIsCreatingIntent(true);
    setPaymentDialogOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pet-store-payment', {
        body: {
          itemId: item.id,
          quantity: 1,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      toast.error(error.message || "Failed to initialize payment");
      setPaymentDialogOpen(false);
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentDialogOpen(false);
    setSelectedItem(null);
    setClientSecret("");
    queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
  };

  const handlePaymentCancel = () => {
    setPaymentDialogOpen(false);
    setSelectedItem(null);
    setClientSecret("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
    await queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
  }, [queryClient]);

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredItems = useMemo(() => items?.filter(item => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [items, selectedCategory, searchQuery]);

  return (
    <>
      <SEO 
        title="Pet Store - Shop for Pet Supplies | PetalPay"
        description="Browse our selection of pet supplies including food, treats, toys, and more. Earn PawBucks rewards on every purchase."
        keywords={["pet store", "pet supplies", "pet food", "pet toys", "pet treats", "earn rewards"]}
      />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />
        
        <PullToRefresh
          ref={containerRef}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          progress={progress}
          className="flex-1 overflow-auto"
        >
          <main className="container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-7xl">
            {/* Ad Placement for Free Users */}
            <div className="mb-4 sm:mb-6">
              <AdPlacement />
          </div>

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold">Pet Store</h1>
              {user && wallet && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{wallet.balance} PawBucks</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Shop for your furry friends with PawBucks!</p>
          </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sm:w-96"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" role="status" aria-label="Loading products">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="flex flex-col">
              <div className="w-full h-48 bg-muted rounded-t-lg skeleton-pulse" />
              <CardContent className="pt-4 space-y-2">
                <div className="h-5 w-3/4 bg-muted rounded skeleton-pulse" />
                <div className="h-4 w-full bg-muted rounded skeleton-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded skeleton-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems?.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No items found</h3>
          <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
          <Button variant="outline" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredItems?.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="p-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant="secondary">{item.category}</Badge>
                </div>
                {item.description && (
                  <CardDescription className="line-clamp-2 mb-3">
                    {item.description}
                  </CardDescription>
                )}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-bold">${(item.price / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-lg font-bold text-primary">
                      {Formatters.number(item.price_pawbucks)} PawBucks
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.stock_quantity} in stock
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => handlePurchaseWithCard(item)}
                  disabled={!user || item.stock_quantity === 0}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {item.stock_quantity === 0 ? "Out of Stock" : `Pay $${(item.price / 100).toFixed(2)}`}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handlePurchaseWithPawBucks(item.id)}
                  disabled={!user || item.stock_quantity === 0 || purchaseMutation.isPending || (wallet?.balance || 0) < item.price_pawbucks}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  {item.stock_quantity === 0 ? "Out of Stock" : `Pay ${Formatters.number(item.price_pawbucks)} PawBucks`}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay with Credit Card</DialogTitle>
          </DialogHeader>
          {isCreatingIntent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clientSecret && selectedItem ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PetStorePaymentForm
                itemId={selectedItem.id}
                itemName={selectedItem.name}
                quantity={1}
                totalAmount={selectedItem.price}
                cashbackRate={cashbackRate}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Bottom Ad Placement */}
      <div className="mt-8 mb-6">
        <AdPlacement position="bottom" />
      </div>
        </main>
        </PullToRefresh>
      </div>
      {user && <BottomNav />}
    </>
  );
}
