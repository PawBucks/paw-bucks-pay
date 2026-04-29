import { useState, useCallback, useMemo, useEffect } from"react";

export interface StorefrontCartItem {
 productId: string;
 priceId: string;
 name: string;
 description: string | null;
 image: string | null;
 unitAmount: number; // cents
 currency: string;
 formatted: string;
 quantity: number;
}

const STORAGE_KEY_PREFIX ="storefront-cart-";

function getStorageKey(merchantSlug: string) {
 return `${STORAGE_KEY_PREFIX}${merchantSlug}`;
}

function loadCart(merchantSlug: string): StorefrontCartItem[] {
 try {
 const raw = localStorage.getItem(getStorageKey(merchantSlug));
 return raw ? JSON.parse(raw) : [];
 } catch {
 return [];
 }
}

function saveCart(merchantSlug: string, items: StorefrontCartItem[]) {
 try {
 if (items.length === 0) {
 localStorage.removeItem(getStorageKey(merchantSlug));
 } else {
 localStorage.setItem(getStorageKey(merchantSlug), JSON.stringify(items));
 }
 } catch {
 // localStorage full or unavailable
 }
}

export function useStorefrontCart(merchantSlug: string | undefined) {
 const [items, setItems] = useState<StorefrontCartItem[]>(() =>
 merchantSlug ? loadCart(merchantSlug) : []
 );

 // Sync to localStorage on change
 useEffect(() => {
 if (merchantSlug) {
 saveCart(merchantSlug, items);
 }
 }, [items, merchantSlug]);

 // Reload when merchantSlug changes
 useEffect(() => {
 if (merchantSlug) {
 setItems(loadCart(merchantSlug));
 }
 }, [merchantSlug]);

 const addToCart = useCallback(
 (product: Omit<StorefrontCartItem,"quantity">, quantity = 1) => {
 setItems((prev) => {
 const existing = prev.find((i) => i.priceId === product.priceId);
 if (existing) {
 return prev.map((i) =>
 i.priceId === product.priceId
 ? { ...i, quantity: i.quantity + quantity }
 : i
 );
 }
 return [...prev, { ...product, quantity }];
 });
 },
 []
 );

 const updateQuantity = useCallback(
 (priceId: string, quantity: number) => {
 setItems((prev) => {
 if (quantity <= 0) {
 return prev.filter((i) => i.priceId !== priceId);
 }
 return prev.map((i) =>
 i.priceId === priceId ? { ...i, quantity } : i
 );
 });
 },
 []
 );

 const removeItem = useCallback((priceId: string) => {
 setItems((prev) => prev.filter((i) => i.priceId !== priceId));
 }, []);

 const clearCart = useCallback(() => {
 setItems([]);
 }, []);

 const itemCount = useMemo(
 () => items.reduce((sum, i) => sum + i.quantity, 0),
 [items]
 );

 const totalCents = useMemo(
 () => items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0),
 [items]
 );

 return {
 items,
 itemCount,
 totalCents,
 addToCart,
 updateQuantity,
 removeItem,
 clearCart,
 };
}
