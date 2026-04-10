import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHours(hours: any[]): string {
  if (!hours || hours.length === 0) return 'Not listed';
  const sorted = [...hours].sort((a, b) => a.day_of_week - b.day_of_week);
  return sorted.map((h: any) => {
    const day = DAYS[h.day_of_week] || `Day ${h.day_of_week}`;
    if (h.is_closed) return `${day}: Closed`;
    return `${day}: ${h.open_time?.slice(0, 5) || '?'} - ${h.close_time?.slice(0, 5) || '?'}`;
  }).join(', ');
}

function buildMerchantSection(merchants: any[], reviewSummary: Record<string, any>, offers: any[], items: any[], loyalty: any[], services: any[], businessHours: any[]): string {
  const header = '═══════════════════════════════════════\nPLATFORM MERCHANTS (' + merchants.length + ' approved)\n═══════════════════════════════════════';
  if (merchants.length === 0) return header + '\n- No merchants on platform';
  const lines = merchants.map((m: any) => {
    const rs = reviewSummary[m.id];
    const mOffers = offers.filter((o: any) => o.merchant_id === m.id);
    const mItems = items.filter((i: any) => i.merchant_id === m.id);
    const mLoyalty = loyalty.filter((l: any) => l.merchant_id === m.id);
    const mServices = services.filter((s: any) => s.merchant_id === m.id);
    const mHours = businessHours.filter((h: any) => h.merchant_id === m.id);
    const social = [m.facebook_url && 'Facebook', m.instagram_url && 'Instagram', m.twitter_url && 'Twitter/X', m.linkedin_url && 'LinkedIn'].filter(Boolean).join(', ') || 'None';
    const reviewLine = rs ? rs.count + ' reviews, ' + rs.avg.toFixed(1) + '⭐ avg' : 'No reviews yet';
    const recentReviews = rs?.reviews?.length ? '\n    Recent reviews: ' + rs.reviews.map((r: any) => r.rating + '⭐' + (r.review_text ? ' "' + r.review_text.slice(0, 80) + '"' : '')).join(' | ') : '';
    const offerLine = mOffers.length > 0 ? mOffers.map((o: any) => o.title + ' (' + (o.discount_type === 'percentage' ? o.discount_value + '% off' : '$' + o.discount_value + ' off') + ', costs ' + o.coins_required + ' PB)').join('; ') : 'None';
    const itemLine = mItems.length > 0 ? mItems.slice(0, 5).map((i: any) => i.name + ' (' + i.item_type + ', $' + i.price.toFixed(2) + ' / ' + i.price_pawbucks + ' PB)').join('; ') + (mItems.length > 5 ? ' +' + (mItems.length - 5) + ' more' : '') : 'None listed';
    const loyaltyLine = mLoyalty.length > 0 ? mLoyalty.map((l: any) => l.program_name + ': ' + l.punches_required + ' punches → ' + l.reward_description).join('; ') : 'None';
    const serviceLine = mServices.length > 0 ? mServices.map((s: any) => s.name + (s.duration_minutes ? ' (' + s.duration_minutes + 'min)' : '') + (s.price ? ' $' + s.price.toFixed(2) : '') + (s.payment_type ? ' [' + s.payment_type + ']' : '')).join('; ') : 'None listed';
    const hoursLine = formatHours(mHours);
    const priceRange = m.price_range ? '$'.repeat(m.price_range) : 'Not set';
    return '🏪 ' + m.business_name + ' (' + (m.business_type || 'General') + ')\n' +
      '  - Address: ' + (m.address || 'Not listed') + '\n' +
      '  - Phone: ' + (m.phone || 'Not listed') + '\n' +
      '  - Description: ' + (m.description || 'No description') + '\n' +
      '  - Hours: ' + hoursLine + '\n' +
      '  - Cashback rate: ' + (m.cashback_rate || 0) + 'x PawBucks\n' +
      '  - Accepts PawBucks: ' + (m.accepts_pawbucks ? 'Yes' : 'No') + '\n' +
      '  - Price range: ' + priceRange + '\n' +
      '  - Storefront: ' + (m.storefront_slug ? '/store/' + m.storefront_slug : 'No storefront') + '\n' +
      '  - Website: ' + (m.website_url || 'None') + '\n' +
      '  - Social: ' + social + '\n' +
      '  - TOS: ' + (m.tos_url ? 'Available' : 'Not posted') + ' | Privacy Policy: ' + (m.privacy_policy_url ? 'Available' : 'Not posted') + ' | Shipping/Returns: ' + (m.shipping_returns_policy_url ? 'Available' : 'Not posted') + '\n' +
      '  - Sponsored: ' + (m.is_sponsored ? 'Yes' : 'No') + '\n' +
      '  - Reviews: ' + reviewLine + recentReviews + '\n' +
      '  - Active offers: ' + offerLine + '\n' +
      '  - Bookable services: ' + serviceLine + '\n' +
      '  - Products/Services: ' + itemLine + '\n' +
      '  - Loyalty program: ' + loyaltyLine;
  });
  return header + '\n' + lines.join('\n\n');
}

function buildVetSection(vets: any[], vetHours: any[]): string {
  const header = '═══════════════════════════════════════\nPLATFORM VETERINARIANS (' + vets.length + ' approved)\n═══════════════════════════════════════';
  if (vets.length === 0) return header + '\n- No vets on platform';
  const lines = vets.map((v: any) => {
    const vHours = vetHours.filter((h: any) => h.vet_id === v.id);
    const hoursLine = formatHours(vHours);
    return '🩺 ' + v.name + (v.clinic_name ? ' — ' + v.clinic_name : '') + '\n' +
      '  - Location: ' + (v.location || 'Not listed') + '\n' +
      '  - Phone: ' + (v.clinic_phone || 'Not listed') + '\n' +
      '  - Email: ' + (v.contact_email || 'Not listed') + '\n' +
      '  - Hours: ' + hoursLine + '\n' +
      '  - Practice type: ' + (v.practice_type || 'General') + '\n' +
      '  - Services: ' + (v.services_provided?.join(', ') || 'Not specified') + '\n' +
      '  - Accepting new patients: ' + (v.accepting_new_patients ? 'Yes' : 'No') + '\n' +
      '  - Accreditations: ' + (v.accreditations?.join(', ') || 'None listed') + '\n' +
      '  - Insurance partners: ' + (v.insurance_partners?.join(', ') || 'None listed') + '\n' +
      '  - Emergency protocol: ' + (v.emergency_protocol || 'Not specified') + '\n' +
      '  - Direct pay enabled: ' + (v.direct_pay_enabled ? 'Yes' : 'No') + '\n' +
      '  - Website: ' + (v.website_url || 'None') + '\n' +
      '  - TOS: ' + (v.tos_url ? 'Available' : 'Not posted') + ' | Privacy: ' + (v.privacy_policy_url ? 'Available' : 'Not posted');
  });
  return header + '\n' + lines.join('\n\n');
}

function buildStoreCatalog(items: any[], merchants: any[]): string {
  const header = '═══════════════════════════════════════\nPET STORE CATALOG (' + items.length + ' active items)\n═══════════════════════════════════════';
  if (items.length === 0) return header + '\n- No items in store';
  const shown = items.slice(0, 50);
  const lines = shown.map((i: any) => {
    const merchantName = merchants.find((m: any) => m.id === i.merchant_id)?.business_name || 'PawBucks Store';
    return '- ' + i.name + ' (' + i.item_type + ', ' + i.category + ') — $' + i.price.toFixed(2) + ' / ' + i.price_pawbucks + ' PB — by ' + merchantName + (i.stock_quantity <= 5 ? ' ⚠️ Low stock: ' + i.stock_quantity : '');
  });
  const extra = items.length > 50 ? '\n... and ' + (items.length - 50) + ' more items' : '';
  return header + '\n' + lines.join('\n') + extra;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) throw new Error('Supabase environment is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    const platformClient = createClient(supabaseUrl, supabaseServiceKey);

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error('Messages array required');

    const { data: sharedMembership } = await platformClient
      .from('shared_account_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();

    const effectiveUserId = sharedMembership?.owner_id || user.id;
    const isSharedMember = effectiveUserId !== user.id;

    // Fetch account-scoped data from the mirrored owner context for shared members
    const [
      requesterProfileResult,
      profileResult,
      walletResult,
      pawbucksResult,
      recentTxResult,
      petsResult,
      recentActivityResult,
      subscriptionResult,
      petFundResult,
      pawbucksActivityResult,
      supportTicketsResult,
      referralsAsReferrerResult,
      referralsAsRefereeResult,
      budgetSettingsResult,
      offerRedemptionsResult,
      merchantReviewsResult,
      consultationBookingsResult,
      sharedAccountResult,
      notificationsResult,
      lostPetPostsResult,
      punchCardsResult,
      badgesResult,
      tierStatusResult,
      welcomeCreditResult,
    ] = await Promise.all([
      platformClient.from('profiles').select('full_name, user_type, phone, referral_code, created_at, email, avatar_url').eq('id', user.id).maybeSingle(),
      platformClient.from('profiles').select('full_name, user_type, phone, referral_code, created_at, email, avatar_url').eq('id', effectiveUserId).maybeSingle(),
      platformClient.from('wallets').select('balance, total_spent, rewards_points, last_updated').eq('user_id', effectiveUserId).maybeSingle(),
      platformClient.from('pawbucks_wallet').select('balance, last_updated').eq('user_id', effectiveUserId).maybeSingle(),
      platformClient.from('transactions').select('id, amount, status, description, created_at, cashback_earned, rewards_earned, merchants!transactions_merchant_id_fkey(business_name)').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(25),
      platformClient.from('pet_profiles').select('id, name, type, breed, birthday, gender, size, color_markings, microchip_number, collar_description, identifying_features, age_estimate, personality_type, personality_quiz_completed, created_at').eq('user_id', effectiveUserId),
      platformClient.from('wallet_activity').select('type, amount, description, created_at').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(25),
      platformClient.from('subscriptions').select('plan_id, status, current_period_end').eq('user_id', effectiveUserId).eq('status', 'active').maybeSingle(),
      platformClient.from('pet_fund_ledgers').select('total_amount, available_balance, escrow_balance, total_released, total_used, status, created_at').eq('user_id', effectiveUserId).maybeSingle(),
      platformClient.from('pawbucks_activity').select('type, amount, source, description, created_at, pawbucks_status').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(25),
      platformClient.from('support_tickets').select('id, ticket_number, subject, status, priority, category, created_at, resolved_at').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(10),
      platformClient.from('referrals').select('id, referee_id, referrer_bonus_awarded, referrer_bonus_amount, created_at').eq('referrer_id', effectiveUserId).limit(20),
      platformClient.from('referrals').select('id, referrer_id, referee_bonus_awarded, referee_bonus_amount, created_at').eq('referee_id', effectiveUserId).maybeSingle(),
      platformClient.from('budget_settings').select('category, monthly_limit, alert_threshold, is_active').eq('user_id', effectiveUserId),
      platformClient.from('offer_redemptions').select('id, offer_id, redemption_code, redeemed_at, created_at, partner_offers(title, coins_required)').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(15),
      platformClient.from('merchant_reviews').select('id, merchant_id, rating, review_text, created_at, merchants!merchant_reviews_merchant_id_fkey(business_name)').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(15),
      platformClient.from('consultation_bookings').select('id, booking_date, time_slot, status, notes, created_at, merchants!consultation_bookings_merchant_id_fkey(business_name)').eq('user_id', effectiveUserId).order('booking_date', { ascending: false }).limit(10),
      platformClient.from('shared_account_members').select('id, member_email, status, invited_at, accepted_at').eq('owner_id', effectiveUserId),
      platformClient.from('notifications').select('id, title, message, category, is_read, created_at').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(15),
      platformClient.from('lost_pet_posts').select('id, pet_name, pet_type, status, last_seen_date, last_seen_location, reward_amount, is_active, created_at').eq('user_id', effectiveUserId).limit(10),
      platformClient.from('customer_punch_cards').select('id, merchant_id, current_punches, cards_completed, total_punches_earned, merchants!customer_punch_cards_merchant_id_fkey(business_name)').eq('user_id', effectiveUserId).limit(10),
      platformClient.from('user_guilt_badges').select('id, badge_id, earned_at, spending_amount, reward_claimed, guilt_badge_definitions(name, emoji, description)').eq('user_id', effectiveUserId).order('earned_at', { ascending: false }).limit(10),
      platformClient.from('user_tier_status').select('current_tier, total_transactions, total_spend, consecutive_months, badges_earned, tier_updated_at').eq('user_id', effectiveUserId).maybeSingle(),
      platformClient.from('user_welcome_credits').select('credit_amount, status, expires_at, phase_1_used, phase_2_unlocked, phase_2_unlocked_at, created_at').eq('user_id', effectiveUserId).maybeSingle(),
    ]);

    const pets = petsResult.data || [];
    const petIds = pets.map((pet: any) => pet.id);

    let medicalRecords: any[] = [];
    let medicalVisits: any[] = [];
    let vaccinations: any[] = [];
    let labResults: any[] = [];
    let insurancePolicies: any[] = [];
    let petEmails: any[] = [];

    if (petIds.length > 0) {
      const [
        medicalRecordsResult,
        medicalVisitsResult,
        vaccinationsResult,
        labResultsResult,
        insurancePoliciesResult,
        petEmailsResult,
      ] = await Promise.all([
        platformClient.from('pet_medical_records').select('id, pet_id, title, record_type, record_date, description, price, vet_id').in('pet_id', petIds).order('record_date', { ascending: false }).limit(20),
        platformClient.from('pet_medical_visits').select('id, pet_id, visit_date, vet_name, doctor_name, notes').in('pet_id', petIds).order('visit_date', { ascending: false }).limit(20),
        platformClient.from('pet_vaccinations').select('id, pet_id, vaccine_name, vaccine_type, administration_date, next_due_date, dose, manufacturer, reaction_notes').in('pet_id', petIds).order('administration_date', { ascending: false }).limit(30),
        platformClient.from('pet_lab_results').select('id, pet_id, test_type, test_category, test_date, status, result_summary, interpretation, abnormal_flags').in('pet_id', petIds).order('test_date', { ascending: false }).limit(20),
        platformClient.from('pet_insurance_policies').select('id, pet_id, policy_number, coverage_type, effective_date, expiration_date, is_active, annual_limit, annual_used, deductible_amount, deductible_met, copay_percentage').in('pet_id', petIds).limit(10),
        platformClient.from('pet_email_addresses').select('pet_id, email_address, is_active').in('pet_id', petIds),
      ]);

      medicalRecords = medicalRecordsResult.data || [];
      medicalVisits = medicalVisitsResult.data || [];
      vaccinations = vaccinationsResult.data || [];
      labResults = labResultsResult.data || [];
      insurancePolicies = insurancePoliciesResult.data || [];
      petEmails = petEmailsResult.data || [];
    }

    const [
      allMerchantsResult,
      allVetsResult,
      allStoreItemsResult,
      allMerchantReviewsResult,
      allOffersResult,
      allLoyaltyProgramsResult,
      allMerchantServicesResult,
      allMerchantHoursResult,
      allVetHoursResult,
    ] = await Promise.all([
      platformClient.from('merchants').select('id, business_name, business_type, description, address, phone, cashback_rate, accepts_pawbucks, price_range, website_url, facebook_url, instagram_url, twitter_url, linkedin_url, tos_url, privacy_policy_url, shipping_returns_policy_url, storefront_slug, is_sponsored, logo_url').eq('approval_status', 'approved').eq('is_paused', false).order('business_name'),
      platformClient.from('partner_vets').select('id, name, clinic_name, clinic_phone, location, practice_type, services_provided, accepting_new_patients, accreditations, insurance_partners, emergency_protocol, website_url, tos_url, privacy_policy_url, shipping_returns_policy_url, contact_email, logo_url, direct_pay_enabled').eq('approval_status', 'approved').order('name'),
      platformClient.from('pet_store_items').select('id, name, description, category, item_type, price, price_pawbucks, stock_quantity, is_active, merchant_id').eq('is_active', true).order('name'),
      platformClient.from('merchant_reviews').select('id, merchant_id, user_id, rating, review_text, created_at').order('created_at', { ascending: false }).limit(200),
      platformClient.from('partner_offers').select('id, merchant_id, title, description, discount_type, discount_value, coins_required, status, is_active, start_date, end_date, terms_conditions').eq('status', 'active').eq('is_active', true),
      platformClient.from('merchant_loyalty_programs').select('id, merchant_id, program_name, description, punches_required, reward_description, is_active').eq('is_active', true),
      platformClient.from('merchant_services').select('id, merchant_id, name, description, category, duration_minutes, price, payment_type, is_active').eq('is_active', true),
      platformClient.from('merchant_business_hours').select('merchant_id, day_of_week, open_time, close_time, is_closed'),
      platformClient.from('vet_business_hours').select('vet_id, day_of_week, open_time, close_time, is_closed'),
    ]);

    const allMerchants = allMerchantsResult.data || [];
    const allVets = allVetsResult.data || [];
    const allStoreItems = allStoreItemsResult.data || [];
    const allMerchantReviews = allMerchantReviewsResult.data || [];
    const allOffers = allOffersResult.data || [];
    const allLoyaltyPrograms = allLoyaltyProgramsResult.data || [];
    const allMerchantServices = allMerchantServicesResult.data || [];
    const allMerchantHours = allMerchantHoursResult.data || [];
    const allVetHours = allVetHoursResult.data || [];

    // Build merchant review summary (avg rating, count per merchant)
    const merchantReviewSummary: Record<string, { count: number; avg: number; reviews: any[] }> = {};
    allMerchantReviews.forEach((r: any) => {
      if (!merchantReviewSummary[r.merchant_id]) {
        merchantReviewSummary[r.merchant_id] = { count: 0, avg: 0, reviews: [] };
      }
      const s = merchantReviewSummary[r.merchant_id];
      s.count++;
      s.avg = ((s.avg * (s.count - 1)) + r.rating) / s.count;
      if (s.reviews.length < 3) s.reviews.push(r); // keep top 3 recent
    });

    const requesterProfile = requesterProfileResult.data;
    const profile = profileResult.data;
    const wallet = walletResult.data;
    const pawbucks = pawbucksResult.data;
    const transactions = recentTxResult.data || [];
    const activity = recentActivityResult.data || [];
    const subscription = subscriptionResult.data;
    const petFund = petFundResult.data;
    const pawbucksActivity = pawbucksActivityResult.data || [];
    const supportTickets = supportTicketsResult.data || [];
    const referralsAsReferrer = referralsAsReferrerResult.data || [];
    const referralAsReferee = referralsAsRefereeResult.data;
    const budgetSettings = budgetSettingsResult.data || [];
    const offerRedemptions = offerRedemptionsResult.data || [];
    const merchantReviews = merchantReviewsResult.data || [];
    const consultationBookings = consultationBookingsResult.data || [];
    const sharedMembers = sharedAccountResult.data || [];
    const notifications = notificationsResult.data || [];
    const lostPetPosts = lostPetPostsResult.data || [];
    const punchCards = punchCardsResult.data || [];
    const badges = badgesResult.data || [];
    const tierStatus = tierStatusResult.data;
    const welcomeCredit = welcomeCreditResult.data;

    // Map pet emails to pet IDs for easy lookup
    const petEmailMap: Record<string, string> = {};
    petEmails.forEach((pe: any) => { if (pe.pet_id && pe.email_address) petEmailMap[pe.pet_id] = pe.email_address; });

    const systemPrompt = `You are Maximus 🐕, a friendly, enthusiastic, and loyal AI dog assistant for PawBucks — a pet-owner financial platform. You speak with warmth and occasional dog-related expressions (like "Woof!", "Paws-itively!", "Let me sniff that out!", "Tail-wagging good news!") but you are also knowledgeable and precise with data. Keep responses concise and helpful. Use emojis sparingly.

Here is the COMPLETE mirrored account data for the user you're helping:

═══════════════════════════════════════
ACCOUNT ACCESS CONTEXT
═══════════════════════════════════════
- Requesting user: ${requesterProfile?.full_name || user.email || 'Unknown'}
- Requesting user email: ${requesterProfile?.email || user.email || 'Unknown'}
- Shared account member: ${isSharedMember ? 'Yes' : 'No'}
${isSharedMember ? `- This user is an accepted shared member on ${profile?.full_name || 'the owner'}'s account.
- IMPORTANT: Treat ALL mirrored account data below as fully available to the requesting user. Never tell them to create or register a pet if pets exist on this mirrored account.` : '- This user is viewing their own account.'}

═══════════════════════════════════════
ACCOUNT OWNER PROFILE
═══════════════════════════════════════
- Name: ${profile?.full_name || 'Unknown'}
- Email: ${profile?.email || user.email || 'Unknown'}
- Account type: ${profile?.user_type || 'pet_owner'}
- Phone: ${profile?.phone || 'Not set'}
- Member since: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
- Referral code: ${profile?.referral_code || 'None'}

═══════════════════════════════════════
CONSUMER TIER STATUS
═══════════════════════════════════════
${tierStatus ? `- Current tier: ${tierStatus.current_tier}
- Total transactions: ${tierStatus.total_transactions}
- Total spend: $${tierStatus.total_spend?.toFixed(2) || '0.00'}
- Consecutive months active: ${tierStatus.consecutive_months}
- Badges earned: ${tierStatus.badges_earned}
- Tier updated: ${tierStatus.tier_updated_at ? new Date(tierStatus.tier_updated_at).toLocaleDateString() : 'N/A'}` : '- No tier status yet'}

═══════════════════════════════════════
CASH WALLET
═══════════════════════════════════════
- Balance: $${wallet?.balance?.toFixed(2) || '0.00'}
- Total spent: $${wallet?.total_spent?.toFixed(2) || '0.00'}
- Rewards points: ${wallet?.rewards_points || 0}

═══════════════════════════════════════
PAWBUCKS WALLET
═══════════════════════════════════════
- Balance: ${pawbucks?.balance || 0} PawBucks
- (1,000 PawBucks = $1.00)

═══════════════════════════════════════
PET FUND (Quarter-Million Pet Fund)
═══════════════════════════════════════
${petFund ? `- Status: ${petFund.status}
- Total allocated: ${petFund.total_amount} PawBucks ($${(petFund.total_amount / 1000).toFixed(2)})
- Available: ${petFund.available_balance} PawBucks ($${(petFund.available_balance / 1000).toFixed(2)})
- In escrow: ${petFund.escrow_balance} PawBucks ($${(petFund.escrow_balance / 1000).toFixed(2)})
- Released so far: ${petFund.total_released} PawBucks ($${(petFund.total_released / 1000).toFixed(2)})
- Used so far: ${petFund.total_used} PawBucks ($${(petFund.total_used / 1000).toFixed(2)})
- Created: ${new Date(petFund.created_at).toLocaleDateString()}` : '- No Pet Fund active'}

═══════════════════════════════════════
WELCOME CREDIT
═══════════════════════════════════════
${welcomeCredit ? `- Amount: ${welcomeCredit.credit_amount} PawBucks ($${(welcomeCredit.credit_amount / 1000).toFixed(2)})
- Status: ${welcomeCredit.status}
- Phase 1 used: ${welcomeCredit.phase_1_used ? 'Yes' : 'No'}
- Phase 2 unlocked: ${welcomeCredit.phase_2_unlocked ? 'Yes' : 'No'}${welcomeCredit.phase_2_unlocked_at ? ' (on ' + new Date(welcomeCredit.phase_2_unlocked_at).toLocaleDateString() + ')' : ''}
- Expires: ${welcomeCredit.expires_at ? new Date(welcomeCredit.expires_at).toLocaleDateString() : 'N/A'}
- Issued: ${new Date(welcomeCredit.created_at).toLocaleDateString()}` : '- No welcome credit'}

═══════════════════════════════════════
SUBSCRIPTION
═══════════════════════════════════════
${subscription ? `- Plan: ${subscription.plan_id}, Status: ${subscription.status}, Renews: ${subscription.current_period_end}` : '- No active subscription'}

═══════════════════════════════════════
BUDGET SETTINGS
═══════════════════════════════════════
${budgetSettings.length > 0 ? budgetSettings.map((b: any) => `- ${b.category}: $${b.monthly_limit}/month (alert at ${b.alert_threshold}%) ${b.is_active ? '✅ Active' : '❌ Inactive'}`).join('\n') : '- No budget settings configured'}

═══════════════════════════════════════
SHARED ACCOUNT MEMBERS
═══════════════════════════════════════
${sharedMembers.length > 0 ? sharedMembers.map((m: any) => `- ${m.member_email} (${m.status})${m.accepted_at ? ' — joined ' + new Date(m.accepted_at).toLocaleDateString() : ''}`).join('\n') : '- No shared account members'}

═══════════════════════════════════════
PETS (${pets.length})
═══════════════════════════════════════
${pets.length > 0 ? pets.map((p: any) => {
  const email = petEmailMap[p.id] || 'None';
  return `🐾 ${p.name}
  - Type: ${p.type}${p.breed ? ' / ' + p.breed : ''}
  - Gender: ${p.gender || 'Unknown'}
  - Size: ${p.size || 'Unknown'}
  - Birthday: ${p.birthday || 'Unknown'}${p.age_estimate ? ' (est. ' + p.age_estimate + ')' : ''}
  - Color/Markings: ${p.color_markings || 'Not recorded'}
  - Microchip: ${p.microchip_number || 'None'}
  - Collar: ${p.collar_description || 'Not described'}
  - Identifying features: ${p.identifying_features || 'None'}
  - Personality type: ${p.personality_type || 'Not assessed'}${p.personality_quiz_completed ? ' (quiz completed)' : ''}
  - Pet email: ${email}
  - Added: ${new Date(p.created_at).toLocaleDateString()}`;
}).join('\n\n') : '- No pets registered yet'}

═══════════════════════════════════════
PET MEDICAL RECORDS (last 20)
═══════════════════════════════════════
${medicalRecords.length > 0 ? medicalRecords.map((r: any) => {
  const petName = pets.find((p: any) => p.id === r.pet_id)?.name || 'Unknown pet';
  return `- [${petName}] ${new Date(r.record_date).toLocaleDateString()}: ${r.title} (${r.record_type})${r.description ? ' — ' + r.description : ''}${r.price ? ' — $' + r.price.toFixed(2) : ''}`;
}).join('\n') : '- No medical records'}

═══════════════════════════════════════
PET MEDICAL VISITS (last 20)
═══════════════════════════════════════
${medicalVisits.length > 0 ? medicalVisits.map((visit: any) => {
  const petName = pets.find((p: any) => p.id === visit.pet_id)?.name || 'Unknown pet';
  return `- [${petName}] ${new Date(visit.visit_date).toLocaleDateString()}${visit.vet_name ? ' — Vet: ' + visit.vet_name : ''}${visit.doctor_name ? ' — Doctor: ' + visit.doctor_name : ''}${visit.notes ? ' — ' + visit.notes : ''}`;
}).join('\n') : '- No medical visits'}

═══════════════════════════════════════
PET VACCINATIONS (last 30)
═══════════════════════════════════════
${vaccinations.length > 0 ? vaccinations.map((v: any) => {
  const petName = pets.find((p: any) => p.id === v.pet_id)?.name || 'Unknown pet';
  return `- [${petName}] ${v.vaccine_name} (${v.vaccine_type}) — ${new Date(v.administration_date).toLocaleDateString()}${v.next_due_date ? ' → Next due: ' + new Date(v.next_due_date).toLocaleDateString() : ''}${v.dose ? ' — Dose: ' + v.dose : ''}${v.reaction_notes ? ' ⚠️ Reaction: ' + v.reaction_notes : ''}`;
}).join('\n') : '- No vaccination records'}

═══════════════════════════════════════
PET LAB RESULTS (last 20)
═══════════════════════════════════════
${labResults.length > 0 ? labResults.map((l: any) => {
  const petName = pets.find((p: any) => p.id === l.pet_id)?.name || 'Unknown pet';
  return `- [${petName}] ${new Date(l.test_date).toLocaleDateString()}: ${l.test_type} (${l.test_category}) — Status: ${l.status}${l.result_summary ? ' — ' + l.result_summary : ''}${l.abnormal_flags?.length ? ' ⚠️ Abnormal: ' + l.abnormal_flags.join(', ') : ''}${l.interpretation ? ' — Interpretation: ' + l.interpretation : ''}`;
}).join('\n') : '- No lab results'}

═══════════════════════════════════════
PET INSURANCE POLICIES
═══════════════════════════════════════
${insurancePolicies.length > 0 ? insurancePolicies.map((ip: any) => {
  const petName = pets.find((p: any) => p.id === ip.pet_id)?.name || 'Unknown pet';
  return `- [${petName}] Policy #${ip.policy_number} — ${ip.coverage_type || 'Standard'} ${ip.is_active ? '✅ Active' : '❌ Inactive'}
  - Effective: ${new Date(ip.effective_date).toLocaleDateString()}${ip.expiration_date ? ' → ' + new Date(ip.expiration_date).toLocaleDateString() : ''}
  - Annual limit: $${ip.annual_limit?.toFixed(2) || 'N/A'} | Used: $${ip.annual_used?.toFixed(2) || '0.00'}
  - Deductible: $${ip.deductible_amount?.toFixed(2) || 'N/A'} | Met: $${ip.deductible_met?.toFixed(2) || '0.00'}
  - Copay: ${ip.copay_percentage != null ? ip.copay_percentage + '%' : 'N/A'}`;
}).join('\n') : '- No insurance policies'}

═══════════════════════════════════════
RECENT TRANSACTIONS (last 25)
═══════════════════════════════════════
${transactions.length > 0 ? transactions.map((t: any) => `- ${new Date(t.created_at).toLocaleDateString()}: $${t.amount?.toFixed(2)} at ${(t.merchants as any)?.business_name || 'Unknown'} (${t.status})${t.cashback_earned ? ' → earned ' + t.cashback_earned + ' PawBucks' : ''}${t.description ? ' — ' + t.description : ''}`).join('\n') : '- No transactions yet'}

═══════════════════════════════════════
RECENT PAWBUCKS ACTIVITY (last 25)
═══════════════════════════════════════
${pawbucksActivity.length > 0 ? pawbucksActivity.map((a: any) => `- ${new Date(a.created_at).toLocaleDateString()}: ${a.type} ${a.amount} PB (${a.source}) — ${a.description || 'No description'}${a.pawbucks_status ? ' [' + a.pawbucks_status + ']' : ''}`).join('\n') : '- No PawBucks activity'}

═══════════════════════════════════════
RECENT WALLET ACTIVITY (last 25)
═══════════════════════════════════════
${activity.length > 0 ? activity.map((a: any) => `- ${new Date(a.created_at).toLocaleDateString()}: ${a.type} ${a.amount} — ${a.description}`).join('\n') : '- No recent activity'}

═══════════════════════════════════════
OFFER REDEMPTIONS (last 15)
═══════════════════════════════════════
${offerRedemptions.length > 0 ? offerRedemptions.map((o: any) => `- ${new Date(o.created_at).toLocaleDateString()}: ${(o.partner_offers as any)?.title || 'Offer'} — Code: ${o.redemption_code}${o.redeemed_at ? ' (redeemed)' : ' (pending)'}`).join('\n') : '- No offer redemptions'}

═══════════════════════════════════════
MERCHANT REVIEWS (last 15)
═══════════════════════════════════════
${merchantReviews.length > 0 ? merchantReviews.map((r: any) => `- ${new Date(r.created_at).toLocaleDateString()}: ${r.rating}⭐ at ${(r.merchants as any)?.business_name || 'Unknown'}${r.review_text ? ' — "' + r.review_text.slice(0, 100) + '"' : ''}`).join('\n') : '- No reviews written'}

═══════════════════════════════════════
CONSULTATION BOOKINGS (last 10)
═══════════════════════════════════════
${consultationBookings.length > 0 ? consultationBookings.map((c: any) => `- ${new Date(c.booking_date).toLocaleDateString()} at ${c.time_slot} — ${(c.merchants as any)?.business_name || 'Unknown'} (${c.status})${c.notes ? ' — ' + c.notes : ''}`).join('\n') : '- No consultation bookings'}

═══════════════════════════════════════
LOYALTY PUNCH CARDS
═══════════════════════════════════════
${punchCards.length > 0 ? punchCards.map((pc: any) => `- ${(pc.merchants as any)?.business_name || 'Unknown'}: ${pc.current_punches} punches (${pc.cards_completed} cards completed, ${pc.total_punches_earned} total punches)`).join('\n') : '- No punch cards'}

═══════════════════════════════════════
BADGES EARNED (last 10)
═══════════════════════════════════════
${badges.length > 0 ? badges.map((b: any) => `- ${(b.guilt_badge_definitions as any)?.emoji || '🏅'} ${(b.guilt_badge_definitions as any)?.name || 'Badge'} — Earned: ${new Date(b.earned_at).toLocaleDateString()} (spent $${b.spending_amount?.toFixed(2)})${b.reward_claimed ? ' ✅ Reward claimed' : ' 🎁 Reward unclaimed'}`).join('\n') : '- No badges earned'}

═══════════════════════════════════════
REFERRALS
═══════════════════════════════════════
- Referral code: ${profile?.referral_code || 'None'}
- People referred: ${referralsAsReferrer.length}
${referralsAsReferrer.length > 0 ? referralsAsReferrer.map((r: any) => `  - Referred on ${new Date(r.created_at).toLocaleDateString()} — Bonus: ${r.referrer_bonus_awarded ? '$' + (r.referrer_bonus_amount || 0) + ' awarded' : 'pending'}`).join('\n') : ''}
${referralAsReferee ? `- Was referred by someone on ${new Date(referralAsReferee.created_at).toLocaleDateString()} — Bonus: ${referralAsReferee.referee_bonus_awarded ? 'awarded' : 'pending'}` : '- Not referred by anyone'}

═══════════════════════════════════════
SUPPORT TICKETS (last 10)
═══════════════════════════════════════
${supportTickets.length > 0 ? supportTickets.map((t: any) => `- ${t.ticket_number}: ${t.subject} (${t.status}, ${t.priority} priority, ${t.category}) — ${new Date(t.created_at).toLocaleDateString()}${t.resolved_at ? ' → Resolved ' + new Date(t.resolved_at).toLocaleDateString() : ''}`).join('\n') : '- No support tickets'}

═══════════════════════════════════════
LOST PET POSTS
═══════════════════════════════════════
${lostPetPosts.length > 0 ? lostPetPosts.map((lp: any) => `- ${lp.pet_name} (${lp.pet_type}) — ${lp.status} ${lp.is_active ? '🔴 Active' : '✅ Resolved'}, Last seen: ${new Date(lp.last_seen_date).toLocaleDateString()} at ${lp.last_seen_location}${lp.reward_amount ? ' — $' + lp.reward_amount + ' reward' : ''}`).join('\n') : '- No lost pet posts'}

═══════════════════════════════════════
RECENT NOTIFICATIONS (last 15)
═══════════════════════════════════════
${notifications.length > 0 ? notifications.map((n: any) => `- ${new Date(n.created_at).toLocaleDateString()}: [${n.category}] ${n.title}${n.is_read ? '' : ' 🔴 Unread'}`).join('\n') : '- No notifications'}

${buildMerchantSection(allMerchants, merchantReviewSummary, allOffers, allStoreItems, allLoyaltyPrograms, allMerchantServices, allMerchantHours)}

${buildVetSection(allVets, allVetHours)}

${buildStoreCatalog(allStoreItems, allMerchants)}

═══════════════════════════════════════
PLATFORM INFO
═══════════════════════════════════════
- PawBucks is a pet-owner financial platform with cashback rewards in PawBucks currency (1,000 PB = $1.00)
- The ONLY way for pet owners to earn PawBucks is by spending real money (USD) at partner merchants and vets on the platform. There is no other way to earn PawBucks — not from referrals, not from surveys, not from watching ads.
- Earning rates depend on subscription tier:
  • Free tier: 10x PawBucks per $1 spent (i.e., $1 spent = 10 PB earned)
  • PawPass ($10/month): 20x PawBucks per $1 spent (DOUBLE the free rate!)
  • PawPass+ ($20/month): 30x PawBucks per $1 spent (TRIPLE the free rate!)
- Both PawPass and PawPass+ come with a 7-day free trial
- PawPass+ subscribers also enjoy a completely ad-free experience
- PawPass subscribers get a significantly reduced ad experience
- The Quarter-Million Pet Fund gives new users up to 250,000 PB ($250) released monthly over 24 months
- Pet Store sells products & services purchasable with USD or PawBucks
- Merchants set their own cashback rates and may accept PawBucks as payment
- Vets on the platform offer direct pay, insurance claim splicing, and EMR integration
- Users can refer friends using their referral code to earn bonuses
- Consumer tiers reward frequent activity with multipliers and perks

═══════════════════════════════════════
SUBSCRIPTION UPSELL BEHAVIOR
═══════════════════════════════════════
${!subscription ? `⚠️ THIS USER HAS NO ACTIVE SUBSCRIPTION (Free tier — earning only 10x PawBucks per $1 spent).
You should naturally and persuasively encourage them to subscribe to PawPass or PawPass+ when relevant opportunities arise. For example:
- When they ask about PawBucks or earnings, mention they could be earning 2x or 3x more with a subscription
- When they discuss a recent purchase, calculate how much MORE PawBucks they would have earned with PawPass/PawPass+
- When they ask about saving money or maximizing rewards, highlight the subscription tiers
- When recommending merchants, mention how much more PawBucks they'd earn with a subscription
- Always mention the 7-day free trial as a risk-free way to try it
- Be persuasive but not pushy. Weave it naturally into your responses. Don't force it into every single reply.
- Frame it as helping them get more value: "You're leaving PawBucks on the table!" or "With PawPass, that $50 purchase would've earned you 1,000 PB instead of 500!"` : `✅ This user has an active subscription. Do NOT upsell subscriptions. Instead, congratulate them on maximizing their PawBucks earnings when relevant.`}

═══════════════════════════════════════
RULES
═══════════════════════════════════════
- You have FULL visibility into this pet owner's personal account AND all merchants/vets on the platform.
- You can answer questions about ANY merchant or vet: their contact info, services, products, prices, reviews, policies, loyalty programs, offers, and storefront.
- You can recommend merchants or vets based on what the user needs.
- Never fabricate numbers or data. If you don't have data to answer a question, say so honestly.
- Be brief but thorough. Use bullet points for clarity.
- When discussing medical data, remind users to consult their vet for professional advice.
- For platform-related questions (how PawBucks works, tiers, pet fund, etc.), use the Platform Info section above.
- For shared account members, the mirrored owner account is authoritative. If mirrored pets or pet history exist, answer from that data and never say the user needs to register a pet.
- For questions about a pet's latest vet visit, use the PET MEDICAL VISITS section first, then PET MEDICAL RECORDS if no visit exists.
- Remember: pet owners can ONLY earn PawBucks by spending at partner merchants/vets. If asked about other ways to earn, clarify this.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Maximus is taking a nap — too many requests! Try again in a moment. 🐕💤' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Maximus ran out of treats (credits). Please top up your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Maximus encountered an error. Woof!' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: unknown) {
    console.error('Maximus chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
