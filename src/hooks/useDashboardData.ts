import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";

type Profile = {
  user_type: "pet_owner" | "merchant";
  full_name: string;
};

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
  personality_type?: string | null;
  personality_quiz_completed?: boolean | null;
};

export const useDashboardData = () => {
  const { user, loading: authLoading } = useAuth();
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
  const queryClient = useQueryClient();

  const walletUserId = effectiveWalletUserId || user?.id;
  const isReady = !!user && !authLoading && !sharedAccount.isLoading;

  // Profile query
  const profileQuery = useQuery({
    queryKey: ["dashboard-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_type, full_name")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: isReady,
    staleTime: 1000 * 60 * 5,
  });

  // PawBucks wallet - reuses prefetch cache key
  const pawbucksQuery = useQuery({
    queryKey: ["pawbucks-wallet", walletUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", walletUserId!)
        .maybeSingle();
      return data;
    },
    enabled: isReady && !!walletUserId,
    staleTime: 1000 * 60 * 2,
  });

  // Pet profiles - reuses prefetch cache key
  const petsQuery = useQuery({
    queryKey: ["pets", walletUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_profiles")
        .select("id, name, type, breed, birthday, photo_url, personality_type, personality_quiz_completed")
        .eq("user_id", walletUserId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as PetProfile[];
    },
    enabled: isReady && !!walletUserId,
    staleTime: 1000 * 60 * 5,
  });

  // Total spent from completed transactions
  const spendingQuery = useQuery({
    queryKey: ["dashboard-spending", walletUserId],
    queryFn: async () => {
      const [txResult, medicalResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", walletUserId!)
          .eq("status", "completed"),
        supabase
          .from("pet_medical_records")
          .select("price")
          .eq("user_id", walletUserId!)
          .not("price", "is", null)
          .limit(100),
      ]);

      const totalSpent = (txResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
      const medicalSpending = (medicalResult.data || []).reduce((sum, r) => sum + (r.price || 0), 0);

      return { totalSpent, medicalSpending };
    },
    enabled: isReady && !!walletUserId,
    staleTime: 1000 * 60 * 3,
  });

  const dataLoading = profileQuery.isLoading || pawbucksQuery.isLoading || petsQuery.isLoading || spendingQuery.isLoading;

  const refetchAll = () => {
    profileQuery.refetch();
    pawbucksQuery.refetch();
    petsQuery.refetch();
    spendingQuery.refetch();
  };

  return {
    profile: profileQuery.data ?? null,
    pawbucksWallet: pawbucksQuery.data ?? null,
    pets: petsQuery.data ?? [],
    totalSpent: spendingQuery.data?.totalSpent ?? 0,
    medicalSpending: spendingQuery.data?.medicalSpending ?? 0,
    dataLoading,
    isReady,
    sharedAccount,
    effectiveWalletUserId,
    refetchAll,
  };
};
