import { useState, useEffect, useCallback, useMemo } from"react";
import { useAuth } from"@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";

export interface CartItem {
 id: string;
 item_id: string;
 quantity: number;
 item: {
 id: string;
 name: string;
 description: string | null;
 price: number;
 price_pawbucks: number;
 image_url: string | null;
 category: string | null;
 item_type: string | null;
 stock_quantity: number;
 merchant_id: string | null;
 };
}

export function useShoppingCart() {
 const { user } = useAuth();
 const queryClient = useQueryClient();

 // Get or create active cart
 const { data: cart, isLoading: cartLoading } = useQuery({
 queryKey: ["shopping-cart", user?.id],
 queryFn: async () => {
 if (!user) return null;

 // Try to get existing active cart
 const { data: existing, error } = await supabase
 .from("shopping_carts")
 .select("*")
 .eq("user_id", user.id)
 .eq("status","active")
 .maybeSingle();

 if (error) throw error;
 if (existing) return existing;

 // Create new cart
 const { data: newCart, error: createError } = await supabase
 .from("shopping_carts")
 .insert({ user_id: user.id, status:"active" })
 .select()
 .single();

 if (createError) throw createError;
 return newCart;
 },
 enabled: !!user,
 });

 // Get cart items with product details
 const { data: cartItems = [], isLoading: itemsLoading } = useQuery({
 queryKey: ["shopping-cart-items", cart?.id],
 queryFn: async () => {
 if (!cart) return [];

 const { data, error } = await supabase
 .from("shopping_cart_items")
 .select(`
 id, item_id, quantity, added_at,
 pet_store_items:item_id (
 id, name, description, price, price_pawbucks, 
 image_url, category, item_type, stock_quantity, merchant_id
 )
 `)
 .eq("cart_id", cart.id)
 .order("added_at", { ascending: true });

 if (error) throw error;

 return (data || []).map((item: any) => ({
 id: item.id,
 item_id: item.item_id,
 quantity: item.quantity,
 item: item.pet_store_items,
 })) as CartItem[];
 },
 enabled: !!cart?.id,
 });

 const addToCart = useMutation({
 mutationFn: async ({ itemId, quantity = 1 }: { itemId: string; quantity?: number }) => {
 if (!cart) throw new Error("No active cart");

 // Check if item already in cart (upsert via conflict)
 const existing = cartItems.find((ci) => ci.item_id === itemId);
 if (existing) {
 const newQty = existing.quantity + quantity;
 const { error } = await supabase
 .from("shopping_cart_items")
 .update({ quantity: newQty })
 .eq("id", existing.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("shopping_cart_items")
 .insert({ cart_id: cart.id, item_id: itemId, quantity });
 if (error) throw error;
 }
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart"] });
 },
 });

 const updateQuantity = useMutation({
 mutationFn: async ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => {
 if (quantity <= 0) {
 const { error } = await supabase
 .from("shopping_cart_items")
 .delete()
 .eq("id", cartItemId);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("shopping_cart_items")
 .update({ quantity })
 .eq("id", cartItemId);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 },
 });

 const removeFromCart = useMutation({
 mutationFn: async (cartItemId: string) => {
 const { error } = await supabase
 .from("shopping_cart_items")
 .delete()
 .eq("id", cartItemId);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 },
 });

 const clearCart = useMutation({
 mutationFn: async () => {
 if (!cart) return;
 const { error } = await supabase
 .from("shopping_cart_items")
 .delete()
 .eq("cart_id", cart.id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 },
 });

 const markConverted = useCallback(async () => {
 if (!cart) return;
 await supabase
 .from("shopping_carts")
 .update({ status:"converted", converted_at: new Date().toISOString() })
 .eq("id", cart.id);
 queryClient.invalidateQueries({ queryKey: ["shopping-cart"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 }, [cart, queryClient]);

 const itemCount = useMemo(
 () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
 [cartItems]
 );

 const totalUsd = useMemo(
 () => cartItems.reduce((sum, item) => sum + item.item.price * item.quantity, 0),
 [cartItems]
 );

 const totalPawbucks = useMemo(
 () => cartItems.reduce((sum, item) => sum + item.item.price_pawbucks * item.quantity, 0),
 [cartItems]
 );

 return {
 cart,
 cartItems,
 isLoading: cartLoading || itemsLoading,
 itemCount,
 totalUsd,
 totalPawbucks,
 addToCart,
 updateQuantity,
 removeFromCart,
 clearCart,
 markConverted,
 };
}
