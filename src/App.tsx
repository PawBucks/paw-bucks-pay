import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreatePetProfile from "./pages/CreatePetProfile";
import Discover from "./pages/Discover";
import Wallet from "./pages/Wallet";
import Referrals from "./pages/Referrals";
import Profile from "./pages/Profile";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import MerchantLanding from "./pages/MerchantLanding";
import MerchantOnboarding from "./pages/MerchantOnboarding";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantTransactions from "./pages/MerchantTransactions";
import VetLoanApply from "./pages/VetLoanApply";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import PetHealth from "./pages/PetHealth";
import VetDashboard from "./pages/VetDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();
  useAutoLogout(!!user);

  return (
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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
