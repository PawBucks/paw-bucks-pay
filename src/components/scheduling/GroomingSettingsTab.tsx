import { GroomingBreedManager } from "./GroomingBreedManager";
import { GroomerVaccineSettings } from "./GroomerVaccineSettings";
import { GroomingRebookSettings } from "./GroomingRebookSettings";
import { Separator } from "@/components/ui/separator";

interface GroomingSettingsTabProps {
  merchantId: string;
}

export function GroomingSettingsTab({ merchantId }: GroomingSettingsTabProps) {
  return (
    <div className="space-y-8">
      <GroomingRebookSettings merchantId={merchantId} />
      <Separator />
      <GroomingBreedManager merchantId={merchantId} />
      <Separator />
      <GroomerVaccineSettings merchantId={merchantId} />
    </div>
  );
}
