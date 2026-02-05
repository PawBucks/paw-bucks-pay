/**
 * Main App component with routing and providers
 * Cache bust: 2026-02-04T22:05:00Z
 */
import { Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { usePerformance } from "@/hooks/usePerformance";
import { useMobileOptimizations } from "@/hooks/useMobileOptimizations";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDataPrefetch } from "@/hooks/useDataPrefetch";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { PageTransition } from "@/components/PageTransition";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { FeedbackButton } from "@/components/FeedbackButton";
import { lazyWithRetry, clearChunkReloadFlag } from "@/lib/lazyWithRetry";

// Critical pages - loaded immediately
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy-loaded pages with retry logic for resilient loading after deploys
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const CreatePetProfile = lazyWithRetry(() => import("./pages/CreatePetProfile"), "CreatePetProfile");
const Discover = lazyWithRetry(() => import("./pages/Discover"), "Discover");
const Wallet = lazyWithRetry(() => import("./pages/Wallet"), "Wallet");
const Referrals = lazyWithRetry(() => import("./pages/Referrals"), "Referrals");
const Profile = lazyWithRetry(() => import("./pages/Profile"), "Profile");
const SubscriptionSuccess = lazyWithRetry(() => import("./pages/SubscriptionSuccess"), "SubscriptionSuccess");
const MerchantLanding = lazyWithRetry(() => import("./pages/MerchantLanding"), "MerchantLanding");
const MerchantOnboarding = lazyWithRetry(() => import("./pages/MerchantOnboarding"), "MerchantOnboarding");
const MerchantDashboard = lazyWithRetry(() => import("./pages/MerchantDashboard"), "MerchantDashboard");
const MerchantTransactions = lazyWithRetry(() => import("./pages/MerchantTransactions"), "MerchantTransactions");
const VetLoanApply = lazyWithRetry(() => import("./pages/VetLoanApply"), "VetLoanApply");
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"), "AdminDashboard");
const AdminLogin = lazyWithRetry(() => import("./pages/AdminLogin"), "AdminLogin");
const AdminResetPassword = lazyWithRetry(() => import("./pages/AdminResetPassword"), "AdminResetPassword");
const AdminMerchantServices = lazyWithRetry(() => import("./pages/AdminMerchantServices"), "AdminMerchantServices");
const PetHealth = lazyWithRetry(() => import("./pages/PetHealth"), "PetHealth");
const VetDashboard = lazyWithRetry(() => import("./pages/VetDashboard"), "VetDashboard");
const VetLanding = lazyWithRetry(() => import("./pages/VetLanding"), "VetLanding");
const VetOnboarding = lazyWithRetry(() => import("./pages/VetOnboarding"), "VetOnboarding");
const PawBucksWallet = lazyWithRetry(() => import("./pages/PawBucksWallet"), "PawBucksWallet");
const PawBucksRedeem = lazyWithRetry(() => import("./pages/PawBucksRedeem"), "PawBucksRedeem");
const PetStore = lazyWithRetry(() => import("./pages/PetStore"), "PetStore");
const PetStoreAdmin = lazyWithRetry(() => import("./pages/PetStoreAdmin"), "PetStoreAdmin");
const MerchantProducts = lazyWithRetry(() => import("./pages/MerchantProducts"), "MerchantProducts");
const Storefront = lazyWithRetry(() => import("./pages/Storefront"), "Storefront");
const CheckoutSuccess = lazyWithRetry(() => import("./pages/CheckoutSuccess"), "CheckoutSuccess");
const Install = lazyWithRetry(() => import("./pages/Install"), "Install");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const MerchantOffers = lazyWithRetry(() => import("./pages/MerchantOffers"), "MerchantOffers");
const MerchantOfferEditor = lazyWithRetry(() => import("./pages/MerchantOfferEditor"), "MerchantOfferEditor");
const MerchantOfferDetails = lazyWithRetry(() => import("./pages/MerchantOfferDetails"), "MerchantOfferDetails");
const MerchantOfferRedemptions = lazyWithRetry(() => import("./pages/MerchantOfferRedemptions"), "MerchantOfferRedemptions");
const MerchantOfferCodes = lazyWithRetry(() => import("./pages/MerchantOfferCodes"), "MerchantOfferCodes");
const MerchantAnalytics = lazyWithRetry(() => import("./pages/MerchantAnalytics"), "MerchantAnalytics");
const MerchantProfile = lazyWithRetry(() => import("./pages/MerchantProfile"), "MerchantProfile");
const MerchantDirectory = lazyWithRetry(() => import("./pages/MerchantDirectory"), "MerchantDirectory");
const MerchantMarket = lazyWithRetry(() => import("./pages/MerchantMarket"), "MerchantMarket");
const NotificationPreferences = lazyWithRetry(() => import("./pages/NotificationPreferences"), "NotificationPreferences");
const NotificationHistory = lazyWithRetry(() => import("./pages/NotificationHistory"), "NotificationHistory");
const SpendingBreakdown = lazyWithRetry(() => import("./pages/SpendingBreakdown"), "SpendingBreakdown");
const LostPets = lazyWithRetry(() => import("./pages/LostPets"), "LostPets");
const LostPetDetail = lazyWithRetry(() => import("./pages/LostPetDetail"), "LostPetDetail");
const MerchantPOSIntegration = lazyWithRetry(() => import("./pages/MerchantPOSIntegration"), "MerchantPOSIntegration");
const MerchantScheduling = lazyWithRetry(() => import("./pages/MerchantScheduling"), "MerchantScheduling");
const MerchantTaxVault = lazyWithRetry(() => import("./pages/MerchantTaxVault"), "MerchantTaxVault");
const MerchantPawBucksWalletPage = lazyWithRetry(() => import("./pages/MerchantPawBucksWallet"), "MerchantPawBucksWallet");
const DirectCheckout = lazyWithRetry(() => import("./pages/DirectCheckout"), "DirectCheckout");
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "ResetPassword");
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"), "AuthCallback");
const MySubscriptions = lazyWithRetry(() => import("./pages/MySubscriptions"), "MySubscriptions");
const AccountantPortal = lazyWithRetry(() => import("./pages/AccountantPortal"), "AccountantPortal");
const MerchantInvoicing = lazyWithRetry(() => import("./pages/MerchantInvoicing"), "MerchantInvoicing");
const InvoicePayment = lazyWithRetry(() => import("./pages/InvoicePayment"), "InvoicePayment");
const InvoicePaymentSuccess = lazyWithRetry(() => import("./pages/InvoicePaymentSuccess"), "InvoicePaymentSuccess");
const MerchantSubscriptionPlans = lazyWithRetry(() => import("./pages/MerchantSubscriptionPlans"), "MerchantSubscriptionPlans");
const MerchantAvailableBalance = lazyWithRetry(() => import("./pages/MerchantAvailableBalance"), "MerchantAvailableBalance");
const MerchantPendingBalance = lazyWithRetry(() => import("./pages/MerchantPendingBalance"), "MerchantPendingBalance");
const MerchantTotalEarnings = lazyWithRetry(() => import("./pages/MerchantTotalEarnings"), "MerchantTotalEarnings");

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 1; // Reduced from 2 to 1 for faster failure
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      networkMode: 'offlineFirst', // Use cached data first for instant loading
      structuralSharing: true, // Optimize re-renders
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<PageTransition><Index /></PageTransition>} />
      <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
      <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
      <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
      <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
      <Route path="/create-pet-profile" element={<PageTransition><CreatePetProfile /></PageTransition>} />
      <Route path="/discover" element={<PageTransition><Discover /></PageTransition>} />
      <Route path="/wallet" element={<PageTransition><Wallet /></PageTransition>} />
      <Route path="/referrals" element={<PageTransition><Referrals /></PageTransition>} />
      <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
      <Route path="/my-subscriptions" element={<PageTransition><MySubscriptions /></PageTransition>} />
      <Route path="/subscription-success" element={<PageTransition><SubscriptionSuccess /></PageTransition>} />
      <Route path="/merchants" element={<PageTransition><MerchantLanding /></PageTransition>} />
      <Route path="/merchant-onboarding" element={<PageTransition><MerchantOnboarding /></PageTransition>} />
      <Route path="/merchant-dashboard" element={<PageTransition><MerchantDashboard /></PageTransition>} />
      <Route path="/merchant/transactions" element={<PageTransition><MerchantTransactions /></PageTransition>} />
      <Route path="/vet-loan/apply" element={<PageTransition><VetLoanApply /></PageTransition>} />
      <Route path="/pet-health/:petId" element={<PageTransition><PetHealth /></PageTransition>} />
      <Route path="/vet-dashboard" element={<PageTransition><VetDashboard /></PageTransition>} />
      <Route path="/vets" element={<PageTransition><VetLanding /></PageTransition>} />
      <Route path="/vet-onboarding" element={<PageTransition><VetOnboarding /></PageTransition>} />
      <Route path="/admin" element={<PageTransition><AdminLogin /></PageTransition>} />
      <Route path="/admin/reset-password" element={<PageTransition><AdminResetPassword /></PageTransition>} />
      <Route path="/admin/dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} />
      <Route path="/admin/merchant-services" element={<PageTransition><AdminMerchantServices /></PageTransition>} />
      <Route path="/pawbucks/wallet" element={<PageTransition><PawBucksWallet /></PageTransition>} />
      <Route path="/pawbucks/redeem" element={<PageTransition><PawBucksRedeem /></PageTransition>} />
      <Route path="/pet-store" element={<PageTransition><PetStore /></PageTransition>} />
      <Route path="/admin/pet-store" element={<PageTransition><PetStoreAdmin /></PageTransition>} />
      <Route path="/merchant/products" element={<PageTransition><MerchantProducts /></PageTransition>} />
      <Route path="/merchant/offers" element={<PageTransition><MerchantOffers /></PageTransition>} />
      <Route path="/merchant/offers/new" element={<PageTransition><MerchantOfferEditor /></PageTransition>} />
      <Route path="/merchant/offers/:id" element={<PageTransition><MerchantOfferDetails /></PageTransition>} />
      <Route path="/merchant/offers/:id/edit" element={<PageTransition><MerchantOfferEditor /></PageTransition>} />
      <Route path="/merchant/offers/:id/redemptions" element={<PageTransition><MerchantOfferRedemptions /></PageTransition>} />
      <Route path="/merchant/offers/:id/codes" element={<PageTransition><MerchantOfferCodes /></PageTransition>} />
      <Route path="/merchant-analytics" element={<PageTransition><MerchantAnalytics /></PageTransition>} />
      <Route path="/merchant/:merchantId" element={<PageTransition><MerchantProfile /></PageTransition>} />
      <Route path="/directory" element={<PageTransition><MerchantDirectory /></PageTransition>} />
      <Route path="/merchant/market" element={<PageTransition><MerchantMarket /></PageTransition>} />
      <Route path="/merchant/pos-integration" element={<PageTransition><MerchantPOSIntegration /></PageTransition>} />
      <Route path="/merchant/scheduling" element={<PageTransition><MerchantScheduling /></PageTransition>} />
      <Route path="/merchant/tax-vault" element={<PageTransition><MerchantTaxVault /></PageTransition>} />
      <Route path="/merchant/pawbucks" element={<PageTransition><MerchantPawBucksWalletPage /></PageTransition>} />
      <Route path="/storefront/:accountId" element={<PageTransition><Storefront /></PageTransition>} />
      <Route path="/store/:accountId" element={<PageTransition><Storefront /></PageTransition>} />
      <Route path="/checkout-success" element={<PageTransition><CheckoutSuccess /></PageTransition>} />
      <Route path="/install" element={<PageTransition><Install /></PageTransition>} />
      <Route path="/notification-preferences" element={<PageTransition><NotificationPreferences /></PageTransition>} />
      <Route path="/notifications" element={<PageTransition><NotificationHistory /></PageTransition>} />
      <Route path="/spending-breakdown" element={<PageTransition><SpendingBreakdown /></PageTransition>} />
      <Route path="/lost-pets" element={<PageTransition><LostPets /></PageTransition>} />
      <Route path="/lost-pets/:id" element={<PageTransition><LostPetDetail /></PageTransition>} />
      <Route path="/pay/:merchantId" element={<PageTransition><DirectCheckout /></PageTransition>} />
      <Route path="/accountant-portal/:token" element={<PageTransition><AccountantPortal /></PageTransition>} />
      <Route path="/merchant/invoicing" element={<PageTransition><MerchantInvoicing /></PageTransition>} />
      <Route path="/merchant/subscription-plans" element={<PageTransition><MerchantSubscriptionPlans /></PageTransition>} />
      <Route path="/merchant/available-balance" element={<PageTransition><MerchantAvailableBalance /></PageTransition>} />
      <Route path="/merchant/pending-balance" element={<PageTransition><MerchantPendingBalance /></PageTransition>} />
      <Route path="/merchant/total-earnings" element={<PageTransition><MerchantTotalEarnings /></PageTransition>} />
      <Route path="/invoice/:invoiceId/pay" element={<PageTransition><InvoicePayment /></PageTransition>} />
      <Route path="/invoice/:invoiceId/success" element={<PageTransition><InvoicePaymentSuccess /></PageTransition>} />
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
  // Initialize QueryClient inside component to ensure proper React lifecycle
  const [queryClient] = useState(() => createQueryClient());
  
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
            <FeedbackButton />
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;