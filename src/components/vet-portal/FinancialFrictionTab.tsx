import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WellnessPlanArchitect } from "./WellnessPlanArchitect";
import { InsuranceClaimSplitter } from "./InsuranceClaimSplitter";
import { Heart, Shield } from "lucide-react";

interface FinancialFrictionTabProps {
  vetId: string;
}

export function FinancialFrictionTab({ vetId }: FinancialFrictionTabProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="wellness" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="wellness" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Wellness Plans
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Insurance Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wellness">
          <WellnessPlanArchitect vetId={vetId} />
        </TabsContent>

        <TabsContent value="insurance">
          <InsuranceClaimSplitter vetId={vetId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
