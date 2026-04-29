import { VetOnboardingForm } from"@/components/vet-portal/VetOnboardingForm";
import { SEO } from"@/components/SEO";

const VetOnboarding = () => {
 return (
 <>
 <SEO 
 title="Vet Practice Onboarding | PawBucks"
 description="Register your veterinary practice with PawBucks. Access AI-powered clinical tools, insurance claim processing, and grow your practice."
 />
 <VetOnboardingForm />
 </>
 );
};

export default VetOnboarding;
