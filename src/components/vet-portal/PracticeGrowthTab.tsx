import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { GapFillerTool } from"./GapFillerTool";
import { PrescriptionFulfillmentEngine } from"./PrescriptionFulfillmentEngine";
import { Pill } from "lucide-react";

interface PracticeGrowthTabProps {
 vetId: string;
}

export function PracticeGrowthTab({ vetId }: PracticeGrowthTabProps) {
 return (
 <div className="space-y-6">
 <Tabs defaultValue="gap-filler" className="space-y-4">
 <TabsList className="grid w-full grid-cols-2 max-w-md">
 <TabsTrigger value="gap-filler" className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">📊</span>
 Gap Filler
 </TabsTrigger>
 <TabsTrigger value="prescriptions" className="flex items-center gap-2">
 <Pill className="h-4 w-4" />
 Rx Fulfillment
 </TabsTrigger>
 </TabsList>

 <TabsContent value="gap-filler">
 <GapFillerTool vetId={vetId} />
 </TabsContent>

 <TabsContent value="prescriptions">
 <PrescriptionFulfillmentEngine vetId={vetId} />
 </TabsContent>
 </Tabs>
 </div>
 );
}
