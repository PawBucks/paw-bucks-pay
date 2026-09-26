// Resolves whose PawBucks wallet a user spends from / earns into.
// Shared-account members use the primary owner's wallet. The app writes
// status 'accepted'; older rows may say 'active' — accept both.
// deno-lint-ignore no-explicit-any
export async function resolveWalletUserId(admin: any, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin
      .from("shared_account_members")
      .select("account_id, shared_accounts!inner(owner_id)")
      .eq("member_id", userId)
      .in("status", ["accepted", "active"])
      .limit(1)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const ownerId = (data as any)?.shared_accounts?.owner_id;
    return ownerId || userId;
  } catch (e) {
    console.error("[wallet-owner] lookup failed, using signed-in user", (e as Error).message);
    return userId;
  }
}
