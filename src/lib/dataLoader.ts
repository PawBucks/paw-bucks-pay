import { supabase } from '@/integrations/supabase/client';

// Centralized data loading utilities with error handling and retries

export class DataLoader {
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
        .single();

      if (error) throw error;
      return data;
    });
  }

  static async loadPetProfiles(userId: string) {
    return this.retryOperation(async () => {
      const { data, error } = await supabase
        .from('pet_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  }

  static async loadTransactions(userId: string, limit: number = 10) {
    return this.retryOperation(async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  }

  static async loadMerchants() {
    return this.retryOperation(async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
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
      if (result.status === 'fulfilled') {
        acc[key] = result.value;
      } else {
        console.error(`Failed to load ${key}:`, result.reason);
        acc[key] = null;
      }
      return acc;
    }, {});
  }
}
