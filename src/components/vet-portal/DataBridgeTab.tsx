import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { PMSIntegrationManager } from "./PMSIntegrationManager";
import { LabIntegrationManager } from "./LabIntegrationManager";
import { UniversalLabDashboard } from "./UniversalLabDashboard";
import {
  Database,
  FlaskConical,
  Settings,
  ArrowRightLeft,
} from "lucide-react";

interface DataBridgeTabProps {
  vetId: string;
}

export function DataBridgeTab({ vetId }: DataBridgeTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Data Bridge (Interoperability)
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect your practice systems for automatic data synchronization
        </p>
      </div>

      <Tabs defaultValue="lab-results" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lab-results" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="pms" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            PMS Integration
          </TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Lab Connections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab-results">
          <UniversalLabDashboard vetId={vetId} />
        </TabsContent>

        <TabsContent value="pms">
          <PMSIntegrationManager vetId={vetId} />
        </TabsContent>

        <TabsContent value="labs">
          <LabIntegrationManager vetId={vetId} />
        </TabsContent>
      </Tabs>

      {/* Integration Info */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              Seamless Data Flow
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              The Data Bridge eliminates manual data entry by automatically syncing patient records 
              between your practice management system and PawBucks.
            </p>
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <div className="flex items-start gap-2">
                <Database className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">PMS Sync</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Updates from IDEXX Cornerstone, Neo, AVImark automatically sync to owner health trackers
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900 dark:text-purple-100">Lab Integration</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Bloodwork and DICOM imaging from Antech, IDEXX, Zoetis imported automatically
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
