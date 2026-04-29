import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";

interface SharedAccountInfo {
 isSharedMember: boolean;
 ownerId: string | null;
 ownerName: string | null;
 isLoading: boolean;
}

/**
 * Hook to determine if the current user is a member of a shared PawBucks account.
 * If so, returns the owner's ID to use for wallet queries.
 * 
 * @param userId - The current authenticated user's ID
 * @returns SharedAccountInfo with the effective owner ID for wallet operations
 */
export const useSharedAccount = (userId: string | undefined): SharedAccountInfo => {
 const [isSharedMember, setIsSharedMember] = useState(false);
 const [ownerId, setOwnerId] = useState<string | null>(null);
 const [ownerName, setOwnerName] = useState<string | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 const checkSharedAccount = async () => {
 if (!userId) {
 setIsLoading(false);
 return;
 }

 try {
 // Check if user is a member of someone else's shared account
 const { data: membership, error } = await supabase
 .from("shared_account_members")
 .select("owner_id")
 .eq("member_id", userId)
 .eq("status","accepted")
 .maybeSingle();

 if (error) {
 console.error("[useSharedAccount] Error checking membership:", error);
 setIsLoading(false);
 return;
 }

 if (membership?.owner_id) {
 const { data: ownerProfile } = await supabase
 .from("profiles")
 .select("full_name, email")
 .eq("id", membership.owner_id)
 .single();

 setIsSharedMember(true);
 setOwnerId(membership.owner_id);
 setOwnerName(ownerProfile?.full_name || ownerProfile?.email || null);
 } else {
 setIsSharedMember(false);
 setOwnerId(null);
 setOwnerName(null);
 }
 } catch (err) {
 console.error("[useSharedAccount] Unexpected error:", err);
 } finally {
 setIsLoading(false);
 }
 };

 checkSharedAccount();
 }, [userId]);

 return {
 isSharedMember,
 ownerId,
 ownerName,
 isLoading,
 };
};

/**
 * Returns the effective user ID to use for wallet-related queries.
 * If the user is a shared member, returns the owner's ID.
 * Otherwise, returns the user's own ID.
 */
export const getEffectiveWalletUserId = (
 userId: string | undefined,
 sharedAccount: SharedAccountInfo
): string | undefined => {
 if (!userId) return undefined;
 if (sharedAccount.isSharedMember && sharedAccount.ownerId) {
 return sharedAccount.ownerId;
 }
 return userId;
};
