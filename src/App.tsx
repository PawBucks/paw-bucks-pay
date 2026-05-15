/**
 * Main App component with routing and providers
 * Cache bust: 2026-03-30T17:15:00Z
 */
import { Suspense, useEffect } from"react";
import { Toaster } from"@/components/ui/toaster";
import { Toaster as Sonner } from"@/components/ui/sonner";
import { TooltipProvider } from"@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from"@tanstack/react-query";
import { BrowserRouter, Routes, Route } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useAutoLogout } from"@/hooks/useAutoLogout";
import { usePerformance } from"@/hooks/usePerformance";
import { useMobileOptimizations } from"@/hooks/useMobileOptimizations";
import { usePageTracking } from"@/hooks/usePageTracking";
import { useKeyboardShortcuts } from"@/hooks/useKeyboardShortcuts";
import { useDataPrefetch } from"@/hooks/useDataPrefetch";
import { useScrollToTop } from"@/hooks/useScrollToTop";
import { ErrorBoundary } from"@/components/ErrorBoundary";
import { PageLoader } from"@/components/PageLoader";
import { PageTransition } from"@/components/PageTransition";
import { PWAInstallBanner } from"@/components/PWAInstallBanner";
import { NetworkStatus } from"@/components/NetworkStatus";
import { UpdatePrompt } from"@/components/UpdatePrompt";

import { lazyWithRetry, clearChunkReloadFlag } from"@/lib/lazyWithRetry";
import { ProtectedRoute } from"@/components/ProtectedRoute";
import { PublicOrAuthRoute } from"@/components/PublicOrAuthRoute";

// Critical pages - Auth loaded immediately, Index lazy (734 lines + heavy images)
import Auth from"./pages/Auth";
const Index = lazyWithRetry(() => import("./pages/Index"),"Index");

// Lazy-loaded pages with retry logic for resilient loading after deploys
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"),"Dashboard");
const SimpleHome = lazyWithRetry(() => import("./pages/SimpleHome"),"SimpleHome");
const SimpleSavings = lazyWithRetry(() => import("./pages/SimpleSavings"),"SimpleSavings");
const SimplePay = lazyWithRetry(() => import("./pages/SimplePay"),"SimplePay");
const SimpleSuccess = lazyWithRetry(() => import("./pages/SimpleSuccess"),"SimpleSuccess");
const CreatePetProfile = lazyWithRetry(() => import("./pages/CreatePetProfile"),"CreatePetProfile");
const Discover = lazyWithRetry(() => import("./pages/Discover"),"Discover");
const Wallet = lazyWithRetry(() => import("./pages/Wallet"),"Wallet");
const Referrals = lazyWithRetry(() => import("./pages/Referrals"),"Referrals");
const Profile = lazyWithRetry(() => import("./pages/Profile"),"Profile");
const SubscriptionSuccess = lazyWithRetry(() => import("./pages/SubscriptionSuccess"),"SubscriptionSuccess");
const MerchantLanding = lazyWithRetry(() => import("./pages/MerchantLanding"),"MerchantLanding");
const MerchantOnboarding = lazyWithRetry(() => import("./pages/MerchantOnboarding"),"MerchantOnboarding");
const MerchantDashboard = lazyWithRetry(() => import("./pages/MerchantDashboard"),"MerchantDashboard");
const MerchantWorkspace = lazyWithRetry(() => import("./pages/MerchantWorkspace"),"MerchantWorkspace");
const MerchantSupport = lazyWithRetry(() => import("./pages/MerchantSupport"),"MerchantSupport");
const MerchantSaleConfirmations = lazyWithRetry(() => import("./pages/MerchantSaleConfirmations"),"MerchantSaleConfirmations");
const MerchantCheckIns = lazyWithRetry(() => import("./pages/MerchantCheckIns"),"MerchantCheckIns");
const MerchantSubscribers = lazyWithRetry(() => import("./pages/MerchantSubscribers"),"MerchantSubscribers");
const MerchantSalesReport = lazyWithRetry(() => import("./pages/MerchantSalesReport"),"MerchantSalesReport");
const MerchantDailyHistory = lazyWithRetry(() => import("./pages/MerchantDailyHistory"),"MerchantDailyHistory");
const MerchantLoyalty = lazyWithRetry(() => import("./pages/MerchantLoyalty"),"MerchantLoyalty");
const MerchantPromotions = lazyWithRetry(() => import("./pages/MerchantPromotions"),"MerchantPromotions");
const MerchantBrandCampaigns = lazyWithRetry(() => import("./pages/MerchantBrandCampaigns"),"MerchantBrandCampaigns");
const MerchantPremiumServices = lazyWithRetry(() => import("./pages/MerchantPremiumServices"),"MerchantPremiumServices");
const MerchantBusinessProfile = lazyWithRetry(() => import("./pages/MerchantBusinessProfile"),"MerchantBusinessProfile");
const MerchantTransactions = lazyWithRetry(() => import("./pages/MerchantTransactions"),"MerchantTransactions");
const VetLoanApply = lazyWithRetry(() => import("./pages/VetLoanApply"),"VetLoanApply");
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"),"AdminDashboard");
const AdminLogin = lazyWithRetry(() => import("./pages/AdminLogin"),"AdminLogin");
const AdminResetPassword = lazyWithRetry(() => import("./pages/AdminResetPassword"),"AdminResetPassword");
const AdminMerchantServices = lazyWithRetry(() => import("./pages/AdminMerchantServices"),"AdminMerchantServices");
const AdminUserDetail = lazyWithRetry(() => import("./pages/AdminUserDetail"),"AdminUserDetail");
const PetHealth = lazyWithRetry(() => import("./pages/PetHealth"),"PetHealth");
const VetDashboard = lazyWithRetry(() => import("./pages/VetDashboard"),"VetDashboard");
const VetLanding = lazyWithRetry(() => import("./pages/VetLanding"),"VetLanding");
const VetOnboarding = lazyWithRetry(() => import("./pages/VetOnboarding"),"VetOnboarding");
const PawBucksWallet = lazyWithRetry(() => import("./pages/PawBucksWallet"),"PawBucksWallet");
const PawBucksRedeem = lazyWithRetry(() => import("./pages/PawBucksRedeem"),"PawBucksRedeem");
const PetStore = lazyWithRetry(() => import("./pages/PetStore"),"PetStore");
const PetStoreProduct = lazyWithRetry(() => import("./pages/PetStoreProduct"),"PetStoreProduct");
const PetStoreAdmin = lazyWithRetry(() => import("./pages/PetStoreAdmin"),"PetStoreAdmin");
const MerchantProducts = lazyWithRetry(() => import("./pages/MerchantProducts"),"MerchantProducts");
const Storefront = lazyWithRetry(() => import("./pages/Storefront"),"Storefront");
const CheckoutSuccess = lazyWithRetry(() => import("./pages/CheckoutSuccess"),"CheckoutSuccess");
const Install = lazyWithRetry(() => import("./pages/Install"),"Install");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"),"NotFound");
const BrandSetup = lazyWithRetry(() => import("./pages/BrandSetup"),"BrandSetup");
const CheckInPage = lazyWithRetry(() => import("./pages/CheckInPage"),"CheckInPage");
const MerchantOffers = lazyWithRetry(() => import("./pages/MerchantOffers"),"MerchantOffers");
const MerchantOfferEditor = lazyWithRetry(() => import("./pages/MerchantOfferEditor"),"MerchantOfferEditor");
const MerchantOfferDetails = lazyWithRetry(() => import("./pages/MerchantOfferDetails"),"MerchantOfferDetails");
const MerchantOfferRedemptions = lazyWithRetry(() => import("./pages/MerchantOfferRedemptions"),"MerchantOfferRedemptions");
const MerchantOfferCodes = lazyWithRetry(() => import("./pages/MerchantOfferCodes"),"MerchantOfferCodes");
const MerchantAnalytics = lazyWithRetry(() => import("./pages/MerchantAnalytics"),"MerchantAnalytics");
const MerchantProfile = lazyWithRetry(() => import("./pages/MerchantProfile"),"MerchantProfile");
const MerchantDirectory = lazyWithRetry(() => import("./pages/MerchantDirectory"),"MerchantDirectory");
const MerchantMarket = lazyWithRetry(() => import("./pages/MerchantMarket"),"MerchantMarket");
const NotificationPreferences = lazyWithRetry(() => import("./pages/NotificationPreferences"),"NotificationPreferences");
const NotificationHistory = lazyWithRetry(() => import("./pages/NotificationHistory"),"NotificationHistory");
const SpendingBreakdown = lazyWithRetry(() => import("./pages/SpendingBreakdown"),"SpendingBreakdown");
const LostPets = lazyWithRetry(() => import("./pages/LostPets"),"LostPets");
const LostPetDetail = lazyWithRetry(() => import("./pages/LostPetDetail"),"LostPetDetail");
const MerchantPOSIntegration = lazyWithRetry(() => import("./pages/MerchantPOSIntegration"),"MerchantPOSIntegration");
const MerchantScheduling = lazyWithRetry(() => import("./pages/MerchantScheduling"),"MerchantScheduling");
const MerchantTaxVault = lazyWithRetry(() => import("./pages/MerchantTaxVault"),"MerchantTaxVault");
const MerchantPawBucksWalletPage = lazyWithRetry(() => import("./pages/MerchantPawBucksWallet"),"MerchantPawBucksWallet");
const MerchantStoreRewards = lazyWithRetry(() => import("./pages/MerchantStoreRewards"),"MerchantStoreRewards");
const DirectCheckout = lazyWithRetry(() => import("./pages/DirectCheckout"),"DirectCheckout");
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"),"ResetPassword");
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"),"AuthCallback");
const MySubscriptions = lazyWithRetry(() => import("./pages/MySubscriptions"),"MySubscriptions");
const AccountantPortal = lazyWithRetry(() => import("./pages/AccountantPortal"),"AccountantPortal");
const MerchantInvoicing = lazyWithRetry(() => import("./pages/MerchantInvoicing"),"MerchantInvoicing");
const InvoicePayment = lazyWithRetry(() => import("./pages/InvoicePayment"),"InvoicePayment");
const InvoicePaymentSuccess = lazyWithRetry(() => import("./pages/InvoicePaymentSuccess"),"InvoicePaymentSuccess");
const MerchantSubscriptionPlans = lazyWithRetry(() => import("./pages/MerchantSubscriptionPlans"),"MerchantSubscriptionPlans");
const MerchantAvailableBalance = lazyWithRetry(() => import("./pages/MerchantAvailableBalance"),"MerchantAvailableBalance");
const MerchantPendingBalance = lazyWithRetry(() => import("./pages/MerchantPendingBalance"),"MerchantPendingBalance");
const MerchantTotalEarnings = lazyWithRetry(() => import("./pages/MerchantTotalEarnings"),"MerchantTotalEarnings");
const MerchantMessages = lazyWithRetry(() => import("./pages/MerchantMessages"),"MerchantMessages");
const MerchantCampaigns = lazyWithRetry(() => import("./pages/MerchantCampaigns"),"MerchantCampaigns");
const MyBookings = lazyWithRetry(() => import("./pages/MyBookings"),"MyBookings");
const BookingStatus = lazyWithRetry(() => import("./pages/BookingStatus"),"BookingStatus");
const PublicBookingPage = lazyWithRetry(() => import("./pages/PublicBookingPage"),"PublicBookingPage");
const PetTimelinePage = lazyWithRetry(() => import("./pages/PetTimelinePage"),"PetTimelinePage");
const BadgesPage = lazyWithRetry(() => import("./pages/BadgesPage"),"BadgesPage");
const PetPersonalityQuizPage = lazyWithRetry(() => import("./pages/PetPersonalityQuiz"),"PetPersonalityQuiz");
const LoyaltyPage = lazyWithRetry(() => import("./pages/LoyaltyPage"),"LoyaltyPage");
const LoyaltyCardsPage = lazyWithRetry(() => import("./pages/LoyaltyCardsPage"),"LoyaltyCardsPage");
const AdminInvoicePayment = lazyWithRetry(() => import("./pages/AdminInvoicePayment"),"AdminInvoicePayment");
const AdminInvoicePaymentSuccess = lazyWithRetry(() => import("./pages/AdminInvoicePaymentSuccess"),"AdminInvoicePaymentSuccess");
const BrandDashboard = lazyWithRetry(() => import("./pages/BrandDashboard"),"BrandDashboard");
const About = lazyWithRetry(() => import("./pages/About"),"About");
const Privacy = lazyWithRetry(() => import("./pages/Privacy"),"Privacy");
const Terms = lazyWithRetry(() => import("./pages/Terms"),"Terms");
const PetDigitalId = lazyWithRetry(() => import("./pages/PetDigitalId"),"PetDigitalId");
const PetDigitalIdPublic = lazyWithRetry(() => import("./pages/PetDigitalIdPublic"),"PetDigitalIdPublic");

const createQueryClient = () => new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
 gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
 retry: (failureCount, error: unknown) => {
 const maybeStatus =
 typeof error ==="object" && error !== null &&"status" in error
 ? Number((error as { status?: unknown }).status)
 : undefined;

 // Don't retry on 4xx errors
 if (typeof maybeStatus ==="number" && maybeStatus >= 400 && maybeStatus < 500) return false;
 return failureCount < 1; // Single retry for faster failure
 },
 refetchOnWindowFocus: false,
 refetchOnReconnect:"always",
 networkMode:"offlineFirst", // Use cached data first for instant loading
 structuralSharing: true, // Optimize re-renders
 // Reduce unnecessary refetches
 refetchOnMount: false,
 },
 mutations: {
 retry: 1,
 networkMode:"online",
 },
 },
});

const queryClient = createQueryClient();

const AppRoutes = () => {
 return (
 <Routes>
 {/* Public routes */}
 <Route path="/" element={<PageTransition><Index /></PageTransition>} />
 <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
 <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
 <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
 <Route path="/merchants" element={<PageTransition><MerchantLanding /></PageTransition>} />
 <Route path="/merchant-landing" element={<PageTransition><MerchantLanding /></PageTransition>} />
 <Route path="/vets" element={<PageTransition><VetLanding /></PageTransition>} />
 <Route path="/vet-landing" element={<PageTransition><VetLanding /></PageTransition>} />
 <Route path="/for-vets" element={<PageTransition><VetLanding /></PageTransition>} />
 <Route path="/for-merchants" element={<PageTransition><MerchantLanding /></PageTransition>} />
 <Route path="/install" element={<PageTransition><Install /></PageTransition>} />
 <Route path="/directory" element={<PageTransition><MerchantDirectory /></PageTransition>} />
 <Route path="/storefront/:accountId" element={<PageTransition><Storefront /></PageTransition>} />
 <Route path="/store/:accountId" element={<PageTransition><Storefront /></PageTransition>} />
 <Route path="/checkout-success" element={<PageTransition><CheckoutSuccess /></PageTransition>} />
 <Route path="/pay/:merchantId" element={<PageTransition><DirectCheckout /></PageTransition>} />
 <Route path="/accountant-portal/:token" element={<PageTransition><AccountantPortal /></PageTransition>} />
 <Route path="/invoice/:invoiceId/pay" element={<PageTransition><InvoicePayment /></PageTransition>} />
 <Route path="/invoice/:invoiceId/success" element={<PageTransition><InvoicePaymentSuccess /></PageTransition>} />
 <Route path="/merchant/:merchantId" element={<PageTransition><MerchantProfile /></PageTransition>} />
 <Route path="/book/:slug" element={<PageTransition><PublicBookingPage /></PageTransition>} />
 <Route path="/lost-pets" element={<PageTransition><LostPets /></PageTransition>} />
 <Route path="/lost-pets/:id" element={<PageTransition><LostPetDetail /></PageTransition>} />
 <Route path="/admin-invoice/:invoiceId/pay" element={<PageTransition><AdminInvoicePayment /></PageTransition>} />
 <Route path="/admin-invoice/:invoiceId/success" element={<PageTransition><AdminInvoicePaymentSuccess /></PageTransition>} />
 <Route path="/checkin" element={<PageTransition><CheckInPage /></PageTransition>} />
 <Route path="/brand-setup/:token" element={<PageTransition><BrandSetup /></PageTransition>} />
 <Route path="/about" element={<PageTransition><About /></PageTransition>} />
 <Route path="/privacy" element={<PageTransition><Privacy /></PageTransition>} />
 <Route path="/terms" element={<PageTransition><Terms /></PageTransition>} />

 {/* Authenticated pet owner routes */}
  <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['pet_owner']}><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
 <Route path="/home" element={<ProtectedRoute allowedRoles={['pet_owner']}><PageTransition><SimpleHome /></PageTransition></ProtectedRoute>} />
 <Route path="/savings" element={<ProtectedRoute allowedRoles={['pet_owner']}><PageTransition><SimpleSavings /></PageTransition></ProtectedRoute>} />
 <Route path="/pay" element={<ProtectedRoute allowedRoles={['pet_owner']}><PageTransition><SimplePay /></PageTransition></ProtectedRoute>} />
 <Route path="/saved" element={<ProtectedRoute allowedRoles={['pet_owner']}><PageTransition><SimpleSuccess /></PageTransition></ProtectedRoute>} />
 <Route path="/create-pet-profile" element={<ProtectedRoute><PageTransition><CreatePetProfile /></PageTransition></ProtectedRoute>} />
 <Route
 path="/discover"
 element={
 <PageTransition>
 <PublicOrAuthRoute
 authedElement={<ProtectedRoute><Discover /></ProtectedRoute>}
 publicElement={<MerchantDirectory />}
 />
 </PageTransition>
 }
 />
 <Route path="/wallet" element={<ProtectedRoute><PageTransition><Wallet /></PageTransition></ProtectedRoute>} />
 <Route path="/referrals" element={<ProtectedRoute><PageTransition><Referrals /></PageTransition></ProtectedRoute>} />
 <Route path="/profile" element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
 <Route path="/my-subscriptions" element={<ProtectedRoute><PageTransition><MySubscriptions /></PageTransition></ProtectedRoute>} />
 <Route path="/subscription-success" element={<ProtectedRoute><PageTransition><SubscriptionSuccess /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-health/:petId" element={<ProtectedRoute><PageTransition><PetHealth /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-id/:petId" element={<ProtectedRoute><PageTransition><PetDigitalId /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-id/public/:token" element={<PageTransition><PetDigitalIdPublic /></PageTransition>} />
 <Route path="/pawbucks/wallet" element={<ProtectedRoute><PageTransition><PawBucksWallet /></PageTransition></ProtectedRoute>} />
 <Route path="/pawbucks/redeem" element={<ProtectedRoute><PageTransition><PawBucksRedeem /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-store" element={<PageTransition><PetStore /></PageTransition>} />
 <Route path="/pet-store/:itemId" element={<PageTransition><PetStoreProduct /></PageTransition>} />
 <Route path="/notification-preferences" element={<ProtectedRoute><PageTransition><NotificationPreferences /></PageTransition></ProtectedRoute>} />
 <Route path="/notifications" element={<ProtectedRoute><PageTransition><NotificationHistory /></PageTransition></ProtectedRoute>} />
 <Route path="/spending-breakdown" element={<ProtectedRoute><PageTransition><SpendingBreakdown /></PageTransition></ProtectedRoute>} />
 <Route path="/vet-loan/apply" element={<ProtectedRoute><PageTransition><VetLoanApply /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-timeline" element={<ProtectedRoute><PageTransition><PetTimelinePage /></PageTransition></ProtectedRoute>} />
 <Route path="/badges" element={<ProtectedRoute><PageTransition><BadgesPage /></PageTransition></ProtectedRoute>} />
 <Route path="/pet-personality-quiz" element={<ProtectedRoute><PageTransition><PetPersonalityQuizPage /></PageTransition></ProtectedRoute>} />
 <Route path="/loyalty" element={<ProtectedRoute><PageTransition><LoyaltyPage /></PageTransition></ProtectedRoute>} />
 <Route path="/loyalty-cards" element={<ProtectedRoute><PageTransition><LoyaltyCardsPage /></PageTransition></ProtectedRoute>} />
 <Route path="/my-bookings" element={<ProtectedRoute><PageTransition><MyBookings /></PageTransition></ProtectedRoute>} />
 <Route path="/bookings/:id" element={<ProtectedRoute><PageTransition><BookingStatus /></PageTransition></ProtectedRoute>} />

 {/* Admin routes - requires admin or superadmin role */}
 <Route path="/admin" element={<PageTransition><AdminLogin /></PageTransition>} />
 <Route path="/admin/reset-password" element={<PageTransition><AdminResetPassword /></PageTransition>} />
 <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin','superadmin']}><PageTransition><AdminDashboard /></PageTransition></ProtectedRoute>} />
 <Route path="/admin/merchant-services" element={<ProtectedRoute allowedRoles={['admin','superadmin']}><PageTransition><AdminMerchantServices /></PageTransition></ProtectedRoute>} />
 <Route path="/admin/pet-store" element={<ProtectedRoute allowedRoles={['admin','superadmin']}><PageTransition><PetStoreAdmin /></PageTransition></ProtectedRoute>} />
 <Route path="/admin/users/:userId" element={<ProtectedRoute allowedRoles={['admin','superadmin']}><PageTransition><AdminUserDetail /></PageTransition></ProtectedRoute>} />

 {/* Merchant routes - requires merchant account */}
 <Route path="/merchant-onboarding" element={<ProtectedRoute><PageTransition><MerchantOnboarding /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant-dashboard" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantDashboard /></PageTransition></ProtectedRoute>} />
<Route path="/merchant/workspace" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantWorkspace /></PageTransition></ProtectedRoute>} />
<Route path="/merchant/support" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantSupport /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/sale-confirmations" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantSaleConfirmations /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/check-ins" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantCheckIns /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/subscribers" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantSubscribers /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/sales-report" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantSalesReport /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/daily-history" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantDailyHistory /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/loyalty" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantLoyalty /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/promotions" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantPromotions /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/brand-campaigns" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantBrandCampaigns /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/premium-services" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantPremiumServices /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/business-profile" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantBusinessProfile /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/quick-actions" element={<Navigate to="/merchant/business-profile" replace />} />
 <Route path="/merchant/transactions" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantTransactions /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/products" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantProducts /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOffers /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers/new" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOfferEditor /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers/:id" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOfferDetails /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers/:id/edit" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOfferEditor /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers/:id/redemptions" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOfferRedemptions /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/offers/:id/codes" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantOfferCodes /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant-analytics" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantAnalytics /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/market" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantMarket /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/pos-integration" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantPOSIntegration /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/scheduling" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantScheduling /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/tax-vault" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantTaxVault /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/pawbucks" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantPawBucksWalletPage /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/store-rewards" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantStoreRewards /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/invoicing" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantInvoicing /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/subscription-plans" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantSubscriptionPlans /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/available-balance" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantAvailableBalance /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/pending-balance" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantPendingBalance /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/total-earnings" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantTotalEarnings /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/messages" element={<ProtectedRoute allowedRoles={['merchant']}><PageTransition><MerchantMessages /></PageTransition></ProtectedRoute>} />
 <Route path="/merchant/campaigns" element={<ProtectedRoute allowedRoles={['merchant','vet']}><PageTransition><MerchantCampaigns /></PageTransition></ProtectedRoute>} />

 {/* Vet routes - requires vet account */}
 <Route path="/vet-onboarding" element={<ProtectedRoute><PageTransition><VetOnboarding /></PageTransition></ProtectedRoute>} />
 <Route path="/vet-dashboard" element={<ProtectedRoute allowedRoles={['vet']}><PageTransition><VetDashboard /></PageTransition></ProtectedRoute>} />

 {/* Brand routes - requires brand account */}
 <Route path="/brand-dashboard" element={<ProtectedRoute allowedRoles={['brand']}><PageTransition><BrandDashboard /></PageTransition></ProtectedRoute>} />

 <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
 </Routes>
 );
};

const AppContent = () => {
 const { user } = useAuth();
 useAutoLogout(!!user);
 usePerformance();
 useMobileOptimizations();
 usePageTracking();
 useKeyboardShortcuts();
 useDataPrefetch(); // Prefetch critical data on idle
 useScrollToTop(); // Scroll to top on route change

 // Clear chunk reload flags on successful mount (app loaded properly)
 useEffect(() => {
 clearChunkReloadFlag();
 }, []);

 return (
 <Suspense fallback={<PageLoader />}>
 <AppRoutes />
 </Suspense>
 );
};

const App = () => {
 return (
 <ErrorBoundary>
 <QueryClientProvider client={queryClient}>
 <TooltipProvider>
 <Toaster />
 <Sonner />
 <BrowserRouter>
 <NetworkStatus />
 <UpdatePrompt />
 <PWAInstallBanner />

 <AppContent />
 </BrowserRouter>
 </TooltipProvider>
 </QueryClientProvider>
 </ErrorBoundary>
 );
};

export default App;
