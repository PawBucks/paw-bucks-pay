import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { ShoppingCart, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = ["All", "Food", "Treats", "Toys", "Bedding", "Accessories", "Healthcare", "Grooming"];

export default function PetStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

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

      const totalCost = item.price * quantity;

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
          price_per_item: item.price,
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

  const handlePurchase = (itemId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    purchaseMutation.mutate({ itemId, quantity: 1 });
  };

  const filteredItems = items?.filter(item => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold">Pet Store</h1>
          {user && wallet && (
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-semibold">{wallet.balance} PawBucks</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground">Shop for your furry friends with PawBucks!</p>
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
        <div className="text-center py-12">Loading items...</div>
      ) : filteredItems?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No items found. Try adjusting your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-lg font-bold text-primary">
                    <Coins className="h-4 w-4" />
                    {item.price}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.stock_quantity} in stock
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handlePurchase(item.id)}
                  disabled={!user || item.stock_quantity === 0 || purchaseMutation.isPending}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {item.stock_quantity === 0 ? "Out of Stock" : "Buy Now"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
