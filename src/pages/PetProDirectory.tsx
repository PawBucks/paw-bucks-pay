import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { PetProDirectory } from "@/components/pros/PetProDirectory";
export default function PetProDirectoryPage() {
  const { user, signOut } = useAuth();
  return <><SEO title="Pet Pro Directory | PawBucks" description="Find local groomers, veterinarians, trainers and pet businesses. Browse PawBucks providers and public business listings." canonical="/directory" /><Header isAuthenticated={!!user} onLogout={user ? signOut : undefined} /><main className="min-h-screen bg-background pb-24"><PetProDirectory /></main>{user && <BottomNav />}</>;
}
