import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { CheckCircle, Sparkles } from "lucide-react";

const SubscriptionSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to profile after 5 seconds
    const timer = setTimeout(() => {
      navigate("/profile");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] flex items-center justify-center p-4">
      <GradientCard className="max-w-md w-full text-center" gradient>
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Welcome to Premium!</h1>
        
        <div className="space-y-4 mb-6">
          <p className="text-muted-foreground">
            Your subscription is now active. Enjoy your 7-day free trial!
          </p>
          
          <div className="bg-primary/10 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 justify-center text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold">Premium Benefits:</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Enhanced cashback rewards</li>
              <li>• Exclusive merchant offers</li>
              <li>• Priority customer support</li>
              <li>• Early access to new features</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={() => navigate("/profile")} 
            className="w-full"
          >
            Go to Profile
          </Button>
          <Button 
            onClick={() => navigate("/")} 
            variant="outline"
            className="w-full"
          >
            Return to Dashboard
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Redirecting to your profile in 5 seconds...
        </p>
      </GradientCard>
    </div>
  );
};

export default SubscriptionSuccess;
