import { supabase, handleError, ServiceResult, ServiceListResult } from"./base.service";

// ============================================================
// Types
// ============================================================
export interface BrandAccount {
 id: string;
 user_id: string | null;
 brand_name: string;
 logo_url: string | null;
 contact_name: string | null;
 contact_email: string | null;
 description: string | null;
 website_url: string | null;
 status: string;
 created_by: string;
 created_at: string;
 updated_at: string;
 invitation_token: string | null;
 invitation_email: string | null;
 invitation_sent_at: string | null;
 invitation_claimed_at: string | null;
}

export interface TargetingRules {
 species?: string[];
 breeds?: string[];
 age_min_years?: number;
 age_max_years?: number;
 zip_codes?: string[];
 zip_radius_miles?: number;
 center_zip?: string;
 consumer_tiers?: string[];
 subscription_tiers?: string[];
 min_purchases?: number;
 recent_active_days?: number;
}

// New funding helpers
export const startBrandCampaignCheckout = async (campaignId: string) => {
 const { data, error } = await supabase.functions.invoke("create-brand-campaign-payment", {
 body: { campaign_id: campaignId },
 });
 return { data, error };
};

export const requestBrandCampaignInvoice = async (campaignId: string) => {
 const { data, error } = await supabase.functions.invoke("request-brand-campaign-invoice", {
 body: { campaign_id: campaignId },
 });
 return { data, error };
};

export const verifyBrandCampaignPayment = async (campaignId: string) => {
 const { data, error } = await supabase.functions.invoke("verify-brand-campaign-payment", {
 body: { campaign_id: campaignId },
 });
 return { data, error };
};

export interface BrandCampaign {
 id: string;
 brand_id: string;
 name: string;
 description: string | null;
 budget_usd: number;
 pawbucks_pool: number;
 pawbucks_per_checkin: number;
 status: string;
 start_date: string | null;
 end_date: string | null;
 total_distributed: number;
 total_redeemed: number;
 total_checkins: number;
 admin_invoice_id: string | null;
 campaign_color: string | null;
 campaign_logo_url: string | null;
 targeting_notes: string | null;
 daily_spend_cap: number | null;
 auto_pause_threshold_pct: number | null;
 auto_replenish_enabled: boolean;
 auto_replenish_threshold: number | null;
 auto_replenish_amount_usd: number | null;
 targeting_rules: TargetingRules;
 funding_method:"invoice" |"self_serve";
 stripe_payment_intent_id: string | null;
 stripe_customer_id: string | null;
 funded_at: string | null;
 created_at: string;
 updated_at: string;
 trigger_type:"checkin" |"checkout" |"both";
 min_purchase_usd: number;
 brand_accounts?: { brand_name: string; logo_url: string | null };
}

export interface BrandCampaignMerchant {
 id: string;
 campaign_id: string;
 merchant_id: string;
 status: string;
 joined_at: string | null;
 created_at: string;
 merchants?: { business_name: string; logo_url: string | null };
}

export interface BrandedPawbucksActivity {
 id: string;
 campaign_id: string;
 user_id: string;
 type: string;
 amount: number;
 merchant_id: string | null;
 checkin_id: string | null;
 description: string | null;
 created_at: string;
 merchants?: { business_name: string } | null;
 profiles?: { full_name: string } | null;
}

export interface BrandCampaignDailyStat {
 id: string;
 campaign_id: string;
 date: string;
 checkins: number;
 redemptions: number;
 pawbucks_distributed: number;
 pawbucks_redeemed: number;
 spend_usd: number;
 unique_users: number;
 unique_merchants: number;
}

export interface MerchantLeaderboardEntry {
 merchant_id: string;
 business_name: string;
 logo_url: string | null;
 checkins: number;
 pawbucks_distributed: number;
 unique_users: number;
}

export interface MerchantPerformanceRow {
  merchant_id: string;
  business_name: string;
  logo_url: string | null;
  address: string | null;
  business_type: string | null;
  checkins: number;
  redemptions: number;
  pawbucks_distributed: number;
  pawbucks_redeemed: number;
  unique_users: number;
  campaigns_count: number;
  last_activity_at: string | null;
  redemption_rate_pct: number;
}

export interface CommandCenterSummary {
 total_budget_usd: number;
 total_spent_usd: number;
 total_pool: number;
 total_distributed: number;
 total_redeemed: number;
 total_checkins: number;
 total_redemptions: number;
 active_campaigns: number;
 unique_users_reached: number;
 cost_per_checkin: number;
 cost_per_redemption: number;
 redemption_rate_pct: number;
 burn_rate_per_day_usd: number;
 days_until_depletion: number | null;
}

// ============================================================
// Brand Account
// ============================================================
export const getBrandAccountForUser = async (userId: string): Promise<ServiceResult<BrandAccount>> => {
 try {
 const { data, error } = await supabase
 .from("brand_accounts")
 .select("*")
 .eq("user_id", userId)
 .maybeSingle();
 return { data, error };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

export const getAllBrandAccounts = async (): Promise<ServiceListResult<BrandAccount>> => {
 try {
 const { data, error } = await supabase
 .from("brand_accounts")
 .select("*")
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const createBrandAccount = async (account: {
 user_id?: string;
 brand_name: string;
 contact_name?: string;
 contact_email?: string;
 description?: string;
 website_url?: string;
 created_by: string;
}): Promise<ServiceResult<BrandAccount>> => {
 try {
 const { data, error } = await supabase
 .from("brand_accounts")
 .insert({
 ...account,
 invitation_email: account.contact_email || undefined,
 })
 .select()
 .single();
 return { data, error };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

// ============================================================
// Campaigns
// ============================================================
export const getBrandCampaigns = async (brandId: string): Promise<ServiceListResult<BrandCampaign>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaigns")
 .select("*")
 .eq("brand_id", brandId)
 .order("created_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaign[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const getAllBrandCampaigns = async (): Promise<ServiceListResult<BrandCampaign>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaigns")
 .select("*, brand_accounts(brand_name, logo_url)")
 .order("created_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaign[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const createBrandCampaign = async (campaign: {
 brand_id: string;
 name: string;
 description?: string;
 budget_usd: number;
 pawbucks_pool: number;
 pawbucks_per_checkin: number;
 start_date?: string;
 end_date?: string;
 campaign_color?: string;
 targeting_notes?: string;
 targeting_rules?: TargetingRules;
 daily_spend_cap?: number;
 auto_pause_threshold_pct?: number;
 auto_replenish_enabled?: boolean;
 auto_replenish_threshold?: number;
 auto_replenish_amount_usd?: number;
 funding_method?:"invoice" |"self_serve";
 trigger_type?:"checkin" |"checkout" |"both";
 min_purchase_usd?: number;
}): Promise<ServiceResult<BrandCampaign>> => {
 try {
 const { targeting_rules, ...rest } = campaign;
 const insertPayload: Record<string, unknown> = { ...rest };
 if (targeting_rules) insertPayload.targeting_rules = targeting_rules as unknown;
 const { data, error } = await supabase
 .from("brand_campaigns")
 .insert(insertPayload as never)
 .select()
 .single();
 return { data: data as unknown as BrandCampaign | null, error };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

export const updateBrandCampaignStatus = async (
 campaignId: string,
 status: string
): Promise<ServiceResult<BrandCampaign>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaigns")
 .update({ status })
 .eq("id", campaignId)
 .select()
 .single();
 return { data: data as unknown as BrandCampaign | null, error };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

// ============================================================
// Admin: campaign management
// ============================================================
export const adminUpdateBrandCampaign = async (
 campaignId: string,
 updates: Record<string, unknown>
) => {
 const { data, error } = await supabase.rpc("admin_update_brand_campaign", {
 p_campaign_id: campaignId,
 p_updates: updates as never,
 });
 return { data, error };
};

export const adminGrantBrandedPawbucks = async (
 campaignId: string,
 userId: string,
 amount: number,
 description?: string
) => {
 const { data, error } = await supabase.rpc("admin_grant_branded_pawbucks", {
 p_campaign_id: campaignId,
 p_user_id: userId,
 p_amount: amount,
 p_description: description ??"Admin manual grant",
 });
 return { data, error };
};

// ============================================================
// Campaign merchants
// ============================================================
export const getCampaignMerchants = async (campaignId: string): Promise<ServiceListResult<BrandCampaignMerchant>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaign_merchants")
 .select("*, merchants(business_name, logo_url)")
 .eq("campaign_id", campaignId)
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const addMerchantToCampaign = async (
 campaignId: string,
 merchantId: string
): Promise<ServiceResult<BrandCampaignMerchant>> => {
 try {
 // Route through invitation edge function to ensure consistent audit trail.
 // Merchants must accept the invitation before being enrolled in brand_campaign_merchants.
 const { data, error } = await supabase.functions.invoke("invite-merchant-to-campaign", {
 body: { campaign_id: campaignId, merchant_ids: [merchantId] },
 });
 if (error) return { data: null, error };
 return { data: data as unknown as BrandCampaignMerchant, error: null };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

// ============================================================
// Activity
// ============================================================
async function attachMerchantNames<T extends { merchant_id?: string | null }>(rows: T[]): Promise<(T & { merchants: { business_name: string } | null })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.merchant_id).filter((x): x is string => !!x)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, merchants: null }));
  const { data: merchants } = await supabase
    .from("merchants_public")
    .select("id, business_name")
    .in("id", ids);
  const map = new Map<string, string>((merchants || []).map((m: { id: string; business_name: string }) => [m.id, m.business_name]));
  return rows.map((r) => ({
    ...r,
    merchants: r.merchant_id && map.has(r.merchant_id) ? { business_name: map.get(r.merchant_id)! } : null,
  }));
}

export const getCampaignActivity = async (campaignId: string): Promise<ServiceListResult<BrandedPawbucksActivity>> => {
 try {
 const { data, error } = await supabase
 .from("branded_pawbucks_activity")
  .select("*")
 .eq("campaign_id", campaignId)
 .order("created_at", { ascending: false })
 .limit(200);
  const withMerchants = await attachMerchantNames(data || []);
  return { data: withMerchants, error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

// Activity for ALL campaigns of a brand (for live activity feed)
export const getBrandRecentActivity = async (
 brandId: string,
 limit: number = 25
): Promise<ServiceListResult<BrandedPawbucksActivity>> => {
 try {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: { id: string }) => c.id);
 if (ids.length === 0) return { data: [], error: null };

 const { data, error } = await supabase
 .from("branded_pawbucks_activity")
  .select("*")
 .in("campaign_id", ids)
 .order("created_at", { ascending: false })
 .limit(limit);
  const withMerchants = await attachMerchantNames(data || []);
  return { data: withMerchants, error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

// ============================================================
// Daily Stats (for charts)
// ============================================================
export const getCampaignDailyStats = async (
 campaignId: string,
 days: number = 30
): Promise<ServiceListResult<BrandCampaignDailyStat>> => {
 try {
 const since = new Date();
 since.setDate(since.getDate() - days);
 const { data, error } = await supabase
 .from("brand_campaign_daily_stats")
 .select("*")
 .eq("campaign_id", campaignId)
 .gte("date", since.toISOString().slice(0, 10))
 .order("date", { ascending: true });
 return { data: (data || []) as unknown as BrandCampaignDailyStat[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const getBrandDailyStats = async (
 brandId: string,
 days: number = 30
): Promise<ServiceListResult<BrandCampaignDailyStat>> => {
 try {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: { id: string }) => c.id);
 if (ids.length === 0) return { data: [], error: null };

 const since = new Date();
 since.setDate(since.getDate() - days);

 const { data, error } = await supabase
 .from("brand_campaign_daily_stats")
 .select("*")
 .in("campaign_id", ids)
 .gte("date", since.toISOString().slice(0, 10))
 .order("date", { ascending: true });
 return { data: (data || []) as unknown as BrandCampaignDailyStat[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

// ============================================================
// Merchant Leaderboard (computed from activity)
// ============================================================
export const getBrandMerchantLeaderboard = async (
 brandId: string,
 limit: number = 10
): Promise<ServiceListResult<MerchantLeaderboardEntry>> => {
 try {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: { id: string }) => c.id);
 if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
  .from("branded_pawbucks_activity")
  .select("merchant_id, amount, type, user_id")
  .in("campaign_id", ids)
  .eq("type","earn")
  .not("merchant_id","is", null)
  .limit(5000);

  if (error) return { data: [], error };

  // Resolve merchant names/logos via the public view (RLS-safe)
  const merchantIds = Array.from(
    new Set(((data || []) as Array<{ merchant_id: string | null }>).map((r) => r.merchant_id).filter(Boolean) as string[]),
  );
  const { data: merchantsData } = merchantIds.length
    ? await supabase
        .from("merchants_public")
        .select("id, business_name, logo_url")
        .in("id", merchantIds)
    : { data: [] as Array<{ id: string; business_name: string; logo_url: string | null }> };
  const merchantMap = new Map<string, { business_name: string; logo_url: string | null }>(
    (merchantsData || []).map((m: { id: string; business_name: string; logo_url: string | null }) => [
      m.id,
      { business_name: m.business_name, logo_url: m.logo_url },
    ]),
  );

  // Aggregate in memory
  const map = new Map<string, MerchantLeaderboardEntry & { _users: Set<string> }>();
  for (const row of (data || []) as Array<{
  merchant_id: string;
  amount: number;
  user_id: string;
  }>) {
 const mid = row.merchant_id;
 if (!mid) continue;
 const existing = map.get(mid);
 if (existing) {
 existing.checkins += 1;
 existing.pawbucks_distributed += row.amount;
 existing._users.add(row.user_id);
 } else {
 const users = new Set<string>();
 users.add(row.user_id);
  const m = merchantMap.get(mid);
 map.set(mid, {
 merchant_id: mid,
  business_name: m?.business_name || "Unknown Merchant",
  logo_url: m?.logo_url || null,
 checkins: 1,
 pawbucks_distributed: row.amount,
 unique_users: 0,
 _users: users,
 });
 }
 }

 const result: MerchantLeaderboardEntry[] = Array.from(map.values())
 .map(({ _users, ...rest }) => ({ ...rest, unique_users: _users.size }))
 .sort((a, b) => b.checkins - a.checkins)
 .slice(0, limit);

 return { data: result, error: null };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

// ============================================================
// Command Center Summary (computed)
// ============================================================
export const getCommandCenterSummary = async (
 brandId: string
): Promise<ServiceResult<CommandCenterSummary>> => {
  return _getCommandCenterSummaryImpl(brandId);
};

// Full performance breakdown for every merchant participating in any of the brand's campaigns.
// Includes merchants enrolled via brand_campaign_merchants even if they have no activity yet.
export const getBrandAllMerchantsPerformance = async (
  brandId: string,
): Promise<ServiceListResult<MerchantPerformanceRow>> => {
  try {
    const { data: campaigns } = await supabase
      .from("brand_campaigns")
      .select("id")
      .eq("brand_id", brandId);
    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
    if (campaignIds.length === 0) return { data: [], error: null };

    // 1. Pull every merchant enrolled in any of these campaigns (active or otherwise)
    const { data: enrollments, error: enrollErr } = await supabase
      .from("brand_campaign_merchants")
      .select("merchant_id, campaign_id, status")
      .in("campaign_id", campaignIds);
    if (enrollErr) return { data: [], error: enrollErr };

    // Resolve merchant details via the public view (RLS-safe)
    const enrolledMerchantIds = Array.from(
      new Set(((enrollments || []) as Array<{ merchant_id: string | null }>).map((e) => e.merchant_id).filter(Boolean) as string[]),
    );
    const { data: merchantsData } = enrolledMerchantIds.length
      ? await supabase
          .from("merchants_public")
          .select("id, business_name, logo_url, address, business_type")
          .in("id", enrolledMerchantIds)
      : { data: [] as Array<{ id: string; business_name: string; logo_url: string | null; address: string | null; business_type: string | null }> };
    const merchantDetailsMap = new Map<
      string,
      { business_name: string; logo_url: string | null; address: string | null; business_type: string | null }
    >(
      (merchantsData || []).map((m: { id: string; business_name: string; logo_url: string | null; address: string | null; business_type: string | null }) => [
        m.id,
        { business_name: m.business_name, logo_url: m.logo_url, address: m.address, business_type: m.business_type },
      ]),
    );

    type Row = MerchantPerformanceRow & { _users: Set<string>; _campaigns: Set<string> };
    const map = new Map<string, Row>();
    for (const e of (enrollments || []) as Array<{
      merchant_id: string;
      campaign_id: string;
      status: string;
    }>) {
      if (!e.merchant_id) continue;
      const existing = map.get(e.merchant_id);
      if (existing) {
        existing._campaigns.add(e.campaign_id);
      } else {
        const campaignsSet = new Set<string>();
        campaignsSet.add(e.campaign_id);
        const m = merchantDetailsMap.get(e.merchant_id);
        map.set(e.merchant_id, {
          merchant_id: e.merchant_id,
          business_name: m?.business_name || "Unknown Merchant",
          logo_url: m?.logo_url ?? null,
          address: m?.address ?? null,
          business_type: m?.business_type ?? null,
          checkins: 0,
          redemptions: 0,
          pawbucks_distributed: 0,
          pawbucks_redeemed: 0,
          unique_users: 0,
          campaigns_count: 0,
          last_activity_at: null,
          redemption_rate_pct: 0,
          _users: new Set<string>(),
          _campaigns: campaignsSet,
        });
      }
    }

    // 2. Pull activity (paged) and aggregate
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: activity, error: actErr } = await supabase
        .from("branded_pawbucks_activity")
        .select("merchant_id, amount, type, user_id, created_at")
        .in("campaign_id", campaignIds)
        .not("merchant_id", "is", null)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (actErr) return { data: [], error: actErr };
      const rows = (activity || []) as Array<{
        merchant_id: string;
        amount: number;
        type: string;
        user_id: string;
        created_at: string;
      }>;
      for (const a of rows) {
        let entry = map.get(a.merchant_id);
        if (!entry) {
          // Activity exists but enrollment row missing — still surface the merchant
          entry = {
            merchant_id: a.merchant_id,
            business_name: "Unknown Merchant",
            logo_url: null,
            address: null,
            business_type: null,
            checkins: 0,
            redemptions: 0,
            pawbucks_distributed: 0,
            pawbucks_redeemed: 0,
            unique_users: 0,
            campaigns_count: 0,
            last_activity_at: null,
            redemption_rate_pct: 0,
            _users: new Set<string>(),
            _campaigns: new Set<string>(),
          };
          map.set(a.merchant_id, entry);
        }
        if (a.type === "earn") {
          entry.checkins += 1;
          entry.pawbucks_distributed += Number(a.amount) || 0;
        } else if (a.type === "redeem") {
          entry.redemptions += 1;
          entry.pawbucks_redeemed += Math.abs(Number(a.amount) || 0);
        }
        if (a.user_id) entry._users.add(a.user_id);
        if (!entry.last_activity_at || a.created_at > entry.last_activity_at) {
          entry.last_activity_at = a.created_at;
        }
      }
      if (rows.length < PAGE) break;
      from += PAGE;
      if (from > 20000) break; // safety cap
    }

    // Backfill names/logos for any merchants surfaced via activity but missing details
    const missingIds = Array.from(map.values())
      .filter((r) => r.business_name === "Unknown Merchant")
      .map((r) => r.merchant_id);
    if (missingIds.length > 0) {
      const { data: extra } = await supabase
        .from("merchants_public")
        .select("id, business_name, logo_url, address, business_type")
        .in("id", missingIds);
      for (const m of (extra || []) as Array<{ id: string; business_name: string; logo_url: string | null; address: string | null; business_type: string | null }>) {
        const entry = map.get(m.id);
        if (entry) {
          entry.business_name = m.business_name || entry.business_name;
          entry.logo_url = m.logo_url ?? entry.logo_url;
          entry.address = m.address ?? entry.address;
          entry.business_type = m.business_type ?? entry.business_type;
        }
      }
    }

    const result: MerchantPerformanceRow[] = Array.from(map.values())
      .map(({ _users, _campaigns, ...rest }) => ({
        ...rest,
        unique_users: _users.size,
        campaigns_count: _campaigns.size,
        redemption_rate_pct:
          rest.pawbucks_distributed > 0
            ? (rest.pawbucks_redeemed / rest.pawbucks_distributed) * 100
            : 0,
      }))
      .sort((a, b) => b.checkins - a.checkins || b.pawbucks_distributed - a.pawbucks_distributed);

    return { data: result, error: null };
  } catch (error) {
    return { data: [], error: handleError(error) };
  }
};

const _getCommandCenterSummaryImpl = async (
  brandId: string,
): Promise<ServiceResult<CommandCenterSummary>> => {
 try {
 const { data: campaigns, error } = await supabase
 .from("brand_campaigns")
 .select("budget_usd, pawbucks_pool, pawbucks_per_checkin, total_distributed, total_redeemed, total_checkins, status, funded_at")
 .eq("brand_id", brandId);

 if (error) return { data: null, error };

 const list = (campaigns || []) as Array<{
 budget_usd: number;
 pawbucks_pool: number;
 pawbucks_per_checkin: number;
 total_distributed: number;
 total_redeemed: number;
 total_checkins: number;
 status: string;
 funded_at: string | null;
 }>;

 const total_budget_usd = list.reduce((s, c) => s + Number(c.budget_usd || 0), 0);
 const total_pool = list.reduce((s, c) => s + Number(c.pawbucks_pool || 0), 0);
 const total_distributed = list.reduce((s, c) => s + Number(c.total_distributed || 0), 0);
 const total_redeemed = list.reduce((s, c) => s + Number(c.total_redeemed || 0), 0);
 const total_checkins = list.reduce((s, c) => s + Number(c.total_checkins || 0), 0);
 const active_campaigns = list.filter((c) => c.status ==="active").length;
 const total_spent_usd = total_distributed / 1000; // 1 PB = $0.001

 // Unique users reached — query branded ledger
 const { data: campaignIds } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaignIds || []).map((c: { id: string }) => c.id);
 let unique_users_reached = 0;
 if (ids.length > 0) {
 const { count } = await supabase
 .from("branded_pawbucks_ledger")
 .select("user_id", { count:"exact", head: true })
 .in("campaign_id", ids);
 unique_users_reached = count || 0;
 }

 const cost_per_checkin = total_checkins > 0 ? total_spent_usd / total_checkins : 0;
 const cost_per_redemption = total_redeemed > 0 ? total_spent_usd / (total_redeemed / 1000) : 0;
 const redemption_rate_pct = total_distributed > 0 ? (total_redeemed / total_distributed) * 100 : 0;

 // Burn rate based on active campaigns funded in the last 30d
 const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
 const recentSpend = list
 .filter((c) => c.funded_at && new Date(c.funded_at).getTime() >= thirtyDaysAgo)
 .reduce((s, c) => s + Number(c.total_distributed || 0), 0) / 1000;
 const burn_rate_per_day_usd = recentSpend / 30;
 const remainingPool = Math.max(total_pool - total_distributed, 0);
 const remainingUsd = remainingPool / 1000;
 const days_until_depletion =
 burn_rate_per_day_usd > 0 ? Math.floor(remainingUsd / burn_rate_per_day_usd) : null;

 return {
 data: {
 total_budget_usd,
 total_spent_usd,
 total_pool,
 total_distributed,
 total_redeemed,
 total_checkins,
 active_campaigns,
 unique_users_reached,
 cost_per_checkin,
 cost_per_redemption,
 redemption_rate_pct,
 burn_rate_per_day_usd,
 days_until_depletion,
 },
 error: null,
 };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

// ============================================================
// Helpers
// ============================================================
export const calculatePawbucksFromBudget = (budgetUsd: number): number => {
 // 1 PB = $0.001, so $1 = 1000 PB
 return Math.floor(budgetUsd * 1000);
};

export const calculateEstimatedReach = (pawbucksPool: number, perCheckin: number): number => {
 if (perCheckin <= 0) return 0;
 return Math.floor(pawbucksPool / perCheckin);
};

// ============================================================
// Marketplace (Phase 3)
// ============================================================
export interface MarketplaceMerchant {
 id: string;
 business_name: string;
 business_type: string | null;
 business_categories: string[] | null;
 logo_url: string | null;
 address: string | null;
 description: string | null;
 cashback_rate: number | null;
 accepts_pawbucks: boolean;
}

export interface BrandCampaignInvitation {
 id: string;
 campaign_id: string;
 merchant_id: string;
 status: string;
 message: string | null;
 invited_at: string;
 responded_at: string | null;
 merchants?: { business_name: string; logo_url: string | null } | null;
 brand_campaigns?: { name: string; campaign_color: string | null } | null;
 brand_accounts?: { brand_name: string; logo_url: string | null } | null;
}

export const getMarketplaceMerchants = async (
 search?: string,
 category?: string,
 limit: number = 100,
): Promise<ServiceListResult<MarketplaceMerchant>> => {
 try {
 const { data, error } = await supabase.rpc("get_marketplace_merchants", {
 p_search: search ?? null,
 p_category: category ?? null,
 p_limit: limit,
 } as never);
 return { data: (data || []) as unknown as MarketplaceMerchant[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const getCampaignInvitations = async (
 brandId: string,
): Promise<ServiceListResult<BrandCampaignInvitation>> => {
 try {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: { id: string }) => c.id);
 if (ids.length === 0) return { data: [], error: null };

 const { data, error } = await supabase
 .from("brand_campaign_invitations")
 .select("*, merchants(business_name, logo_url), brand_campaigns(name, campaign_color)")
 .in("campaign_id", ids)
 .order("invited_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaignInvitation[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const getMerchantInvitations = async (
 merchantId: string,
): Promise<ServiceListResult<BrandCampaignInvitation>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaign_invitations")
 .select("*, brand_campaigns(*, brand_accounts(brand_name, logo_url, description, website_url, contact_email, contact_name))")
 .eq("merchant_id", merchantId)
 .order("invited_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaignInvitation[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const inviteMerchantsToCampaign = async (
 campaignId: string,
 merchantIds: string[],
 message?: string,
) => {
 const { data, error } = await supabase.functions.invoke("invite-merchant-to-campaign", {
 body: { campaign_id: campaignId, merchant_ids: merchantIds, message },
 });
 return { data, error };
};

export const respondToCampaignInvitation = async (invitationId: string, accept: boolean) => {
 const { data, error } = await supabase.rpc("respond_to_brand_campaign_invitation", {
 p_invitation_id: invitationId,
 p_accept: accept,
 } as never);
 return { data, error };
};

// ============================================================
// Merchant-initiated join requests
// ============================================================
export interface AvailableBrandCampaign {
 id: string;
 brand_id: string;
 name: string;
 description: string | null;
 pawbucks_per_checkin: number;
 pawbucks_pool: number;
 budget_usd: number;
 start_date: string | null;
 end_date: string | null;
 campaign_color: string | null;
 campaign_logo_url: string | null;
 targeting_notes: string | null;
 trigger_type: string;
 min_purchase_usd: number;
 status: string;
 brand_name: string;
 brand_logo_url: string | null;
 brand_description: string | null;
 brand_website_url: string | null;
 existing_request_status: string | null;
 existing_invitation_status: string | null;
}

export interface BrandCampaignJoinRequest {
 id: string;
 campaign_id: string;
 merchant_id: string;
 requested_by: string;
 status:"pending" |"approved" |"declined" |"cancelled";
 message: string | null;
 response_message: string | null;
 requested_at: string;
 responded_at: string | null;
 responded_by: string | null;
 merchants?: { business_name: string; logo_url: string | null } | null;
 brand_campaigns?: { name: string; campaign_color: string | null } | null;
}

export const getAvailableBrandCampaigns = async (
 merchantId: string,
): Promise<ServiceListResult<AvailableBrandCampaign>> => {
 try {
 const { data, error } = await supabase.rpc("get_available_brand_campaigns", {
 p_merchant_id: merchantId,
 } as never);
 return { data: (data || []) as unknown as AvailableBrandCampaign[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const requestToJoinBrandCampaign = async (
 campaignId: string,
 merchantId: string,
 message?: string,
): Promise<ServiceResult<BrandCampaignJoinRequest>> => {
 try {
 const { data: userData } = await supabase.auth.getUser();
 const userId = userData.user?.id;
 if (!userId) return { data: null, error: new Error("Not authenticated") };
 const { data, error } = await supabase
 .from("brand_campaign_join_requests")
 .insert({
 campaign_id: campaignId,
 merchant_id: merchantId,
 requested_by: userId,
 message: message || null,
 })
 .select()
 .single();
 if (!error && data?.id) {
 // Fire-and-forget brand owner notification email
 supabase.functions
 .invoke("notify-brand-campaign-join-request", {
 body: { requestId: data.id, event:"submitted" },
 })
 .catch((e) => console.warn("join-request submitted email failed", e));
 }
 return { data: data as unknown as BrandCampaignJoinRequest | null, error };
 } catch (error) {
 return { data: null, error: handleError(error) };
 }
};

export const cancelBrandCampaignJoinRequest = async (requestId: string) => {
 const { data, error } = await supabase
 .from("brand_campaign_join_requests")
 .update({ status:"cancelled" })
 .eq("id", requestId)
 .eq("status","pending")
 .select()
 .maybeSingle();
 return { data, error };
};

export const getMerchantJoinRequests = async (
 merchantId: string,
): Promise<ServiceListResult<BrandCampaignJoinRequest>> => {
 try {
 const { data, error } = await supabase
 .from("brand_campaign_join_requests")
 .select("*, brand_campaigns(name, campaign_color)")
 .eq("merchant_id", merchantId)
 .order("requested_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaignJoinRequest[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const getBrandJoinRequests = async (
 brandId: string,
): Promise<ServiceListResult<BrandCampaignJoinRequest>> => {
 try {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: { id: string }) => c.id);
 if (ids.length === 0) return { data: [], error: null };
 const { data, error } = await supabase
 .from("brand_campaign_join_requests")
 .select("*, merchants(business_name, logo_url), brand_campaigns(name, campaign_color)")
 .in("campaign_id", ids)
 .order("requested_at", { ascending: false });
 return { data: (data || []) as unknown as BrandCampaignJoinRequest[], error };
 } catch (error) {
 return { data: [], error: handleError(error) };
 }
};

export const respondToBrandCampaignJoinRequest = async (
 requestId: string,
 approve: boolean,
 responseMessage?: string,
) => {
 const { data, error } = await supabase.rpc("respond_to_brand_campaign_join_request", {
 p_request_id: requestId,
 p_approve: approve,
 p_response_message: responseMessage ?? null,
 } as never);
 if (!error) {
 // Fire-and-forget merchant notification email
 supabase.functions
 .invoke("notify-brand-campaign-join-request", {
 body: { requestId, event: approve ?"approved" :"declined" },
 })
 .catch((e) => console.warn("join-request response email failed", e));
 }
 return { data, error };
};
