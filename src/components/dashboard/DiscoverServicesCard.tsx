import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";

export const DiscoverServicesCard = memo(() => {
  const navigate = useNavigate();

  return (
    <GradientCard className="md:col-span-3">
      <h3 className="text-xl font-semibold mb-4">Discover Pet Services</h3>
      <p className="text-muted-foreground">
        Find nearby pet stores, groomers, and trainers to earn cashback on your purchases.
      </p>
      <div className="mt-4 flex gap-4">
        <Button onClick={() => navigate("/discover")}>Discover Services</Button>
        <Button variant="outline" onClick={() => navigate("/wallet")}>
          View Wallet
        </Button>
      </div>
    </GradientCard>
  );
});

DiscoverServicesCard.displayName = "DiscoverServicesCard";
