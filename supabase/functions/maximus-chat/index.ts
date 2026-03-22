import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildMerchantSection(merchants: any[], reviewSummary: Record<string, any>, offers: any[], items: any[], loyalty: any[]): string {
  const header = '═══════════════════════════════════════\nPLATFORM MERCHANTS (' + merchants.length + ' approved)\n═══════════════════════════════════════';
  if (merchants.length === 0) return header + '\n- No merchants on platform';
  const lines = merchants.map((m: any) => {
    const rs = reviewSummary[m.id];
    const mOffers = offers.filter((o: any) => o.merchant_id === m.id);
    const mItems = items.filter((i: any) => i.merchant_id === m.id);
    const mLoyalty = loyalty.filter((l: any) => l.merchant_id === m.id);
    const social = [m.facebook_url && 'Facebook', m.instagram_url && 'Instagram', m.twitter_url && 'Twitter/X', m.linkedin_url && 'LinkedIn'].filter(Boolean).join(', ') || 'None';
    const reviewLine = rs ? rs.count + ' reviews, ' + rs.avg.toFixed(1) + '⭐ avg' : 'No reviews yet';
    const recentReviews = rs?.reviews?.length ? '\n    Recent reviews: ' + rs.reviews.map((r: any) => r.rating + '⭐' + (r.review_text ? ' "' + r.review_text.slice(0, 80) + '"' : '')).join(' | ') : '';
    const offerLine = mOffers.length > 0 ? mOffers.map((o: any) => o.title + ' (' + (o.discount_type === 'percentage' ? o.discount_value + '% off' : '$' + o.discount_value + ' off') + ', costs ' + o.coins_required + ' PB)').join('; ') : 'None';
    const itemLine = mItems.length > 0 ? mItems.slice(0, 5).map((i: any) => i.name + ' (' + i.item_type + ', $' + i.price.toFixed(2) + ' / ' + i.price_pawbucks + ' PB)').join('; ') + (mItems.length > 5 ? ' +' + (mItems.length - 5) + ' more' : '') : 'None listed';
    const loyaltyLine = mLoyalty.length > 0 ? mLoyalty.map((l: any) => l.program_name + ': ' + l.punches_required + ' punches → ' + l.reward_description).join('; ') : 'None';
    const priceRange = m.price_range ? '$'.repeat(m.price_range) : 'Not set';
    return '🏪 ' + m.business_name + ' (' + (m.business_type || 'General') + ')\n' +
      '  - Address: ' + (m.address || 'Not listed') + '\n' +
      '  - Phone: ' + (m.phone || 'Not listed') + '\n' +
      '  - Description: ' + (m.description || 'No description') + '\n' +
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
      '  - Products/Services: ' + itemLine + '\n' +
      '  - Loyalty program: ' + loyaltyLine;
  });
  return header + '\n' + lines.join('\n\n');
}

function buildVetSection(vets: any[]): string {
  const header = '═══════════════════════════════════════\nPLATFORM VETERINARIANS (' + vets.length + ' approved)\n═══════════════════════════════════════';
  if (vets.length === 0) return header + '\n- No vets on platform';
  const lines = vets.map((v: any) => {
    return '🩺 ' + v.name + (v.clinic_name ? ' — ' + v.clinic_name : '') + '\n' +
      '  - Location: ' + (v.location || 'Not listed') + '\n' +
      '  - Phone: ' + (v.clinic_phone || 'Not listed') + '\n' +
      '  - Email: ' + (v.contact_email || 'Not listed') + '\n' +
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
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase environment is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    const userScopedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error('Messages array required');

    // Fetch ALL user account data in parallel for comprehensive context
    const [
      profileResult,
      walletResult,
      pawbucksResult,
      recentTxResult,
      petsResult,
      recentActivityResult,
      subscriptionResult,
      petFundResult,
      pawbucksActivityResult,
      medicalRecordsResult,
      vaccinationsResult,
      labResultsResult,
      insurancePoliciesResult,
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
      petEmailsResult,
    ] = await Promise.all([
      userScopedClient.from('profiles').select('full_name, user_type, phone, referral_code, created_at, email, avatar_url').eq('id', user.id).maybeSingle(),
      userScopedClient.from('wallets').select('balance, total_spent, rewards_points, last_updated').eq('user_id', user.id).maybeSingle(),
      userScopedClient.from('pawbucks_wallet').select('balance, last_updated').eq('user_id', user.id).maybeSingle(),
      userScopedClient.from('transactions').select('id, amount, status, description, created_at, cashback_earned, rewards_earned, merchants!transactions_merchant_id_fkey(business_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25),
      userScopedClient.from('pet_profiles').select('id, name, type, breed, birthday, gender, size, color_markings, microchip_number, collar_description, identifying_features, age_estimate, personality_type, personality_quiz_completed, created_at').eq('user_id', user.id),
      userScopedClient.from('wallet_activity').select('type, amount, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25),
      userScopedClient.from('subscriptions').select('plan_id, status, current_period_end').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      userScopedClient.from('pet_fund_ledgers').select('total_amount, available_balance, escrow_balance, total_released, total_used, status, created_at').eq('user_id', user.id).maybeSingle(),
      userScopedClient.from('pawbucks_activity').select('type, amount, source, description, created_at, pawbucks_status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25),
      userScopedClient.from('pet_medical_records').select('id, pet_id, title, record_type, record_date, description, price, vet_id').eq('user_id', user.id).order('record_date', { ascending: false }).limit(20),
      userScopedClient.from('pet_vaccinations').select('id, pet_id, vaccine_name, vaccine_type, administration_date, next_due_date, dose, manufacturer, reaction_notes').order('administration_date', { ascending: false }).limit(30),
      userScopedClient.from('pet_lab_results').select('id, pet_id, test_type, test_category, test_date, status, result_summary, interpretation, abnormal_flags').order('test_date', { ascending: false }).limit(20),
      userScopedClient.from('pet_insurance_policies').select('id, pet_id, policy_number, coverage_type, effective_date, expiration_date, is_active, annual_limit, annual_used, deductible_amount, deductible_met, copay_percentage').limit(10),
      userScopedClient.from('support_tickets').select('id, ticket_number, subject, status, priority, category, created_at, resolved_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      userScopedClient.from('referrals').select('id, referee_id, referrer_bonus_awarded, referrer_bonus_amount, created_at').eq('referrer_id', user.id).limit(20),
      userScopedClient.from('referrals').select('id, referrer_id, referee_bonus_awarded, referee_bonus_amount, created_at').eq('referee_id', user.id).maybeSingle(),
      userScopedClient.from('budget_settings').select('category, monthly_limit, alert_threshold, is_active').eq('user_id', user.id),
      userScopedClient.from('offer_redemptions').select('id, offer_id, redemption_code, redeemed_at, created_at, partner_offers(title, coins_required)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
      userScopedClient.from('merchant_reviews').select('id, merchant_id, rating, review_text, created_at, merchants!merchant_reviews_merchant_id_fkey(business_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
      userScopedClient.from('consultation_bookings').select('id, booking_date, time_slot, status, notes, created_at, merchants!consultation_bookings_merchant_id_fkey(business_name)').eq('user_id', user.id).order('booking_date', { ascending: false }).limit(10),
      userScopedClient.from('shared_account_members').select('id, member_email, status, invited_at, accepted_at').eq('owner_id', user.id),
      userScopedClient.from('notifications').select('id, title, message, category, is_read, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
      userScopedClient.from('lost_pet_posts').select('id, pet_name, pet_type, status, last_seen_date, last_seen_location, reward_amount, is_active, created_at').eq('user_id', user.id).limit(10),
      userScopedClient.from('customer_punch_cards').select('id, merchant_id, current_punches, cards_completed, total_punches_earned, merchants!customer_punch_cards_merchant_id_fkey(business_name)').eq('user_id', user.id).limit(10),
      userScopedClient.from('user_guilt_badges').select('id, badge_id, earned_at, spending_amount, reward_claimed, guilt_badge_definitions(name, emoji, description)').eq('user_id', user.id).order('earned_at', { ascending: false }).limit(10),
      userScopedClient.from('user_tier_status').select('current_tier, total_transactions, total_spend, consecutive_months, badges_earned, tier_updated_at').eq('user_id', user.id).maybeSingle(),
      userScopedClient.from('user_welcome_credits').select('credit_amount, status, expires_at, phase_1_used, phase_2_unlocked, phase_2_unlocked_at, created_at').eq('user_id', user.id).maybeSingle(),
      userScopedClient.from('pet_email_addresses').select('pet_id, email_address, is_active').limit(10),
    ]);

    // ═══ PLATFORM-WIDE DATA (using service role to bypass RLS for public info) ═══
    const platformClient = createClient(supabaseUrl, supabaseServiceKey);

    const [
      allMerchantsResult,
      allVetsResult,
      allStoreItemsResult,
      allMerchantReviewsResult,
      allOffersResult,
      allLoyaltyProgramsResult,
    ] = await Promise.all([
      platformClient.from('merchants').select('id, business_name, business_type, description, address, phone, cashback_rate, accepts_pawbucks, price_range, website_url, facebook_url, instagram_url, twitter_url, linkedin_url, tos_url, privacy_policy_url, shipping_returns_policy_url, storefront_slug, is_sponsored, logo_url').eq('approval_status', 'approved').eq('is_paused', false).order('business_name'),
      platformClient.from('partner_vets').select('id, name, clinic_name, clinic_phone, location, practice_type, services_provided, accepting_new_patients, accreditations, insurance_partners, emergency_protocol, website_url, tos_url, privacy_policy_url, shipping_returns_policy_url, contact_email, logo_url, direct_pay_enabled').eq('approval_status', 'approved').order('name'),
      platformClient.from('pet_store_items').select('id, name, description, category, item_type, price, price_pawbucks, stock_quantity, is_active, merchant_id').eq('is_active', true).order('name'),
      platformClient.from('merchant_reviews').select('id, merchant_id, user_id, rating, review_text, created_at').order('created_at', { ascending: false }).limit(200),
      platformClient.from('partner_offers').select('id, merchant_id, title, description, discount_type, discount_value, coins_required, status, is_active, start_date, end_date, terms_conditions').eq('status', 'active').eq('is_active', true),
      platformClient.from('merchant_loyalty_programs').select('id, merchant_id, program_name, description, punches_required, reward_description, is_active').eq('is_active', true),
    ]);

    const allMerchants = allMerchantsResult.data || [];
    const allVets = allVetsResult.data || [];
    const allStoreItems = allStoreItemsResult.data || [];
    const allMerchantReviews = allMerchantReviewsResult.data || [];
    const allOffers = allOffersResult.data || [];
    const allLoyaltyPrograms = allLoyaltyProgramsResult.data || [];

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

    const profile = profileResult.data;
    const wallet = walletResult.data;
    const pawbucks = pawbucksResult.data;
    const transactions = recentTxResult.data || [];
    const pets = petsResult.data || [];
    const activity = recentActivityResult.data || [];
    const subscription = subscriptionResult.data;
    const petFund = petFundResult.data;
    const pawbucksActivity = pawbucksActivityResult.data || [];
    const medicalRecords = medicalRecordsResult.data || [];
    const vaccinations = vaccinationsResult.data || [];
    const labResults = labResultsResult.data || [];
    const insurancePolicies = insurancePoliciesResult.data || [];
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
    const petEmails = petEmailsResult.data || [];

    // Map pet emails to pet IDs for easy lookup
    const petEmailMap: Record<string, string> = {};
    petEmails.forEach((pe: any) => { if (pe.pet_id && pe.email_address) petEmailMap[pe.pet_id] = pe.email_address; });

    const systemPrompt = `You are Maximus 🐕, a friendly, enthusiastic, and loyal AI dog assistant for PawBucks — a pet-owner financial platform. You speak with warmth and occasional dog-related expressions (like "Woof!", "Paws-itively!", "Let me sniff that out!", "Tail-wagging good news!") but you are also knowledgeable and precise with data. Keep responses concise and helpful. Use emojis sparingly.

Here is the COMPLETE account data for the user you're helping:

═══════════════════════════════════════
OWNER PROFILE
═══════════════════════════════════════
- Name: ${profile?.full_name || 'Unknown'}
- Email: ${user.email || 'Unknown'}
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

${buildMerchantSection(allMerchants, merchantReviewSummary, allOffers, allStoreItems, allLoyaltyPrograms)}

${buildVetSection(allVets)}

${buildStoreCatalog(allStoreItems, allMerchants)}

═══════════════════════════════════════
PLATFORM INFO
═══════════════════════════════════════
- PawBucks is a pet-owner financial platform with cashback rewards in PawBucks currency (1,000 PB = $1.00)
- Pet owners earn PawBucks from transactions at partner merchants
- The Quarter-Million Pet Fund gives new users up to 250,000 PB ($250) released monthly over 24 months
- Pet Store sells products & services purchasable with USD or PawBucks
- Merchants set their own cashback rates and may accept PawBucks as payment
- Vets on the platform offer direct pay, insurance claim splicing, and EMR integration
- Users can refer friends using their referral code to earn bonuses
- Consumer tiers reward frequent activity with multipliers and perks

═══════════════════════════════════════
RULES
═══════════════════════════════════════
- You have FULL visibility into this pet owner's personal account AND all merchants/vets on the platform.
- You can answer questions about ANY merchant or vet: their contact info, services, products, prices, reviews, policies, loyalty programs, offers, and storefront.
- You can recommend merchants or vets based on what the user needs.
- Never fabricate numbers or data. If you don't have data to answer a question, say so honestly.
- Be brief but thorough. Use bullet points for clarity.
- When discussing medical data, remind users to consult their vet for professional advice.
- For platform-related questions (how PawBucks works, tiers, pet fund, etc.), use the Platform Info section above.\`;

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
