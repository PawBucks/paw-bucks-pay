import { Suspense, lazy, useState, useEffect } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { PageTransition } from "@/components/PageTransition";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { FeedbackButton } from "@/components/FeedbackButton";

// Critical pages - loaded immediately
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy-loaded pages for optimal performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreatePetProfile = lazy(() => import("./pages/CreatePetProfile"));
const Discover = lazy(() => import("./pages/Discover"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Profile = lazy(() => import("./pages/Profile"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const MerchantLanding = lazy(() => import("./pages/MerchantLanding"));
const MerchantOnboarding = lazy(() => import("./pages/MerchantOnboarding"));
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard"));
const MerchantTransactions = lazy(() => import("./pages/MerchantTransactions"));
const VetLoanApply = lazy(() => import("./pages/VetLoanApply"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword"));
const AdminMerchantServices = lazy(() => import("./pages/AdminMerchantServices"));
const PetHealth = lazy(() => import("./pages/PetHealth"));
const VetDashboard = lazy(() => import("./pages/VetDashboard"));
const PawBucksWallet = lazy(() => import("./pages/PawBucksWallet"));
const PawBucksRedeem = lazy(() => import("./pages/PawBucksRedeem"));
const PetStore = lazy(() => import("./pages/PetStore"));
const PetStoreAdmin = lazy(() => import("./pages/PetStoreAdmin"));
const MerchantProducts = lazy(() => import("./pages/MerchantProducts"));
const Storefront = lazy(() => import("./pages/Storefront"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MerchantOffers = lazy(() => import("./pages/MerchantOffers"));
const MerchantOfferEditor = lazy(() => import("./pages/MerchantOfferEditor"));
const MerchantOfferDetails = lazy(() => import("./pages/MerchantOfferDetails"));
const MerchantOfferRedemptions = lazy(() => import("./pages/MerchantOfferRedemptions"));
const MerchantOfferCodes = lazy(() => import("./pages/MerchantOfferCodes"));
const MerchantAnalytics = lazy(() => import("./pages/MerchantAnalytics"));
const MerchantProfile = lazy(() => import("./pages/MerchantProfile"));
const MerchantDirectory = lazy(() => import("./pages/MerchantDirectory"));
const MerchantMarket = lazy(() => import("./pages/MerchantMarket"));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences"));
const NotificationHistory = lazy(() => import("./pages/NotificationHistory"));
const SpendingBreakdown = lazy(() => import("./pages/SpendingBreakdown"));
const LostPets = lazy(() => import("./pages/LostPets"));
const LostPetDetail = lazy(() => import("./pages/LostPetDetail"));
const MerchantPOSIntegration = lazy(() => import("./pages/MerchantPOSIntegration"));
const MerchantScheduling = lazy(() => import("./pages/MerchantScheduling"));
const MerchantTaxVault = lazy(() => import("./pages/MerchantTaxVault"));
const MerchantPawBucksWalletPage = lazy(() => import("./pages/MerchantPawBucksWallet"));
const DirectCheckout = lazy(() => import("./pages/DirectCheckout"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MySubscriptions = lazy(() => import("./pages/MySubscriptions"));

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