import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { PetPersonalityQuiz } from "@/components/personality-quiz";
import { Loader2 } from "lucide-react";

const PetPersonalityQuizPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  
  const petId = searchParams.get("petId") || undefined;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleComplete = () => {
    navigate("/dashboard");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <SEO 
        title="Pet Personality Quiz | PawBucks" 
        description="Discover your pet's unique personality type and earn exclusive badges!"
      />
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl lg:max-w-6xl">
        <PetPersonalityQuiz petId={petId} onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default PetPersonalityQuizPage;
