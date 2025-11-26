import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { usePerformance } from "@/hooks/usePerformance";
import { useMobileOptimizations } from "@/hooks/useMobileOptimizations";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online', // Better offline support
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

const AppContent = () => {
  const { user } = useAuth();
  useAutoLogout(!!user);
  usePerformance();
  useMobileOptimizations();

  return (
    <Suspense fallback={<PageLoader message="Loading..." />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-pet-profile" element={<CreatePetProfile />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/subscription-success" element={<SubscriptionSuccess />} />
        <Route path="/merchants" element={<MerchantLanding />} />
        <Route path="/merchant-onboarding" element={<MerchantOnboarding />} />
        <Route path="/merchant-dashboard" element={<MerchantDashboard />} />
        <Route path="/merchant/transactions" element={<MerchantTransactions />} />
        <Route path="/vet-loan/apply" element={<VetLoanApply />} />
        <Route path="/pet-health/:petId" element={<PetHealth />} />
        <Route path="/vet-dashboard" element={<VetDashboard />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/pawbucks/wallet" element={<PawBucksWallet />} />
        <Route path="/pawbucks/redeem" element={<PawBucksRedeem />} />
        <Route path="/pet-store" element={<PetStore />} />
        <Route path="/admin/pet-store" element={<PetStoreAdmin />} />
        <Route path="/merchant/products" element={<MerchantProducts />} />
        <Route path="/merchant/offers" element={<MerchantOffers />} />
        <Route path="/merchant/offers/new" element={<MerchantOfferEditor />} />
        <Route path="/merchant/offers/:id" element={<MerchantOfferDetails />} />
        <Route path="/merchant/offers/:id/edit" element={<MerchantOfferEditor />} />
        <Route path="/merchant/offers/:id/redemptions" element={<MerchantOfferRedemptions />} />
        <Route path="/merchant/offers/:id/codes" element={<MerchantOfferCodes />} />
        <Route path="/storefront/:accountId" element={<Storefront />} />
        <Route path="/checkout-success" element={<CheckoutSuccess />} />
        <Route path="/install" element={<Install />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
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
}

export default App;
