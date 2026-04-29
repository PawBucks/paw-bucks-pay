import { supabase } from'@/integrations/supabase/client';

// Centralized data loading utilities with error handling and retries

export class DataLoader {
 private static cache = new Map<string, { data: any; timestamp: number }>();
 private static CACHE_TTL = 1000 * 60 * 2; // 2 minutes cache TTL

 private static getCached<T>(key: string): T | null {
 const cached = this.cache.get(key);
 if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
 return cached.data as T;
 }
 this.cache.delete(key);
 return null;
 }

 private static setCache(key: string, data: any): void {
 this.cache.set(key, { data, timestamp: Date.now() });
 }

 static clearCache(): void {
 this.cache.clear();
 }

 private static async retryOperation<T>(
 operation: () => Promise<T>,
 maxRetries: number = 2,
 delay: number = 1000
 ): Promise<T> {
 let lastError: any;
 
 for (let i = 0; i <= maxRetries; i++) {
 try {
 return await operation();
 } catch (error) {
 lastError = error;
 if (i < maxRetries) {
 await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
 }
 }
 }
 
 throw lastError;
 }

 static async loadUserProfile(userId: string) {
 return this.retryOperation(async () => {
 const { data, error } = await supabase
 .from('profiles')
 .select('*')
 .eq('id', userId)
 .single();

 if (error) throw error;
 return data;
 });
 }

 static async loadWalletData(userId: string) {
 return this.retryOperation(async () => {
 const { data, error } = await supabase
 .from('wallets')
 .select('*')
 .eq('user_id', userId)
 .maybeSingle();

 if (error) throw error;
 return data;
 });
 }

 static async loadPetProfiles(userId: string) {
 return this.retryOperation(async () => {
 console.log('[DataLoader] Loading pet profiles for user:', userId);
 const { data, error } = await supabase
 .from('pet_profiles')
 .select('*')
 .eq('user_id', userId)
 .order('created_at', { ascending: false });

 if (error) {
 console.error('[DataLoader] Error loading pet profiles:', error);
 throw error;
 }
 console.log('[DataLoader] Loaded pet profiles:', data?.length || 0,'pets');
 return data || [];
 });
 }

 static async loadTransactions(userId: string, limit: number = 10) {
 console.log('[DataLoader] Loading transactions for user:', userId);
 return this.retryOperation(async () => {
 // Use FK hint for merchants join - profiles join not needed here as we're querying by user_id
 const { data, error } = await supabase
 .from('transactions')
 .select('*, merchants!transactions_merchant_id_fkey(business_type, business_name)')
 .eq('user_id', userId)
 .order('created_at', { ascending: false })
 .limit(limit);

 if (error) {
 console.error('[DataLoader] Error loading transactions:', error);
 throw error;
 }
 console.log('[DataLoader] Loaded transactions:', data?.length || 0,'transactions');
 return data || [];
 });
 }

 static async loadTransactionsForBudget(userId: string) {
 return this.retryOperation(async () => {
 // Fetch current month's completed transactions with merchant info for budget tracking
 const now = new Date();
 const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
 const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
 
 // Use FK hint for merchants join - exclude refunded transactions from budget
 const { data, error } = await supabase
 .from('transactions')
 .select('id, amount, created_at, merchants!transactions_merchant_id_fkey(business_type)')
 .eq('user_id', userId)
 .eq('status','completed')
 .gte('created_at', startOfMonth)
 .lte('created_at', endOfMonth)
 .order('created_at', { ascending: false });

 if (error) throw error;
 return data || [];
 });
 }

 static async loadMerchants() {
 return this.retryOperation(async () => {
 // Use public view (excludes sensitive contact info - no stripe_account_id)
 const { data, error } = await supabase
 .from('merchants_public')
 .select('id, business_name, business_type, description, address, latitude, longitude, cashback_rate, logo_url, accepts_pawbucks, price_range, is_sponsored')
 .order('business_name');

 if (error) throw error;
 return data || [];
 });
 }

 // Batch load multiple data sources in parallel
 static async batchLoad(
 loaders: Record<string, () => Promise<any>>
 ): Promise<Record<string, any>> {
 const entries = Object.entries(loaders);
 const results = await Promise.allSettled(
 entries.map(([_, loader]) => loader())
 );

 return entries.reduce((acc: Record<string, any>, [key], index) => {
 const result = results[index];
 if (result.status ==='fulfilled') {
 acc[key] = result.value;
 } else {
 console.error(`Failed to load ${key}:`, result.reason);
 acc[key] = null;
 }
 return acc;
 }, {});
 }
}
