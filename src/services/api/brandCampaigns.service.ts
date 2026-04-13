import { supabase, handleError, ServiceResult, ServiceListResult } from "./base.service";

// Types
export interface BrandAccount {
  id: string;
  user_id: string;
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
}

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
  created_at: string;
  updated_at: string;
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

// Brand Account functions
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
  user_id: string;
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
      .insert(account)
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error: handleError(error) };
  }
};

// Campaign functions
export const getBrandCampaigns = async (brandId: string): Promise<ServiceListResult<BrandCampaign>> => {
  try {
    const { data, error } = await supabase
      .from("brand_campaigns")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
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
    return { data: data || [], error };
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
}): Promise<ServiceResult<BrandCampaign>> => {
  try {
    const { data, error } = await supabase
      .from("brand_campaigns")
      .insert(campaign)
      .select()
      .single();
    return { data, error };
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
    return { data, error };
  } catch (error) {
    return { data: null, error: handleError(error) };
  }
};

// Campaign merchants
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
    const { data, error } = await supabase
      .from("brand_campaign_merchants")
      .insert({ campaign_id: campaignId, merchant_id: merchantId })
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error: handleError(error) };
  }
};

// Campaign activity
export const getCampaignActivity = async (campaignId: string): Promise<ServiceListResult<BrandedPawbucksActivity>> => {
  try {
    const { data, error } = await supabase
      .from("branded_pawbucks_activity")
      .select("*, merchants(business_name)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { data: data || [], error };
  } catch (error) {
    return { data: [], error: handleError(error) };
  }
};

// Budget calculator helper
export const calculatePawbucksFromBudget = (budgetUsd: number): number => {
  // 1 PB = $0.001, so $1 = 1000 PB
  return Math.floor(budgetUsd * 1000);
};

export const calculateEstimatedReach = (pawbucksPool: number, perCheckin: number): number => {
  if (perCheckin <= 0) return 0;
  return Math.floor(pawbucksPool / perCheckin);
};
