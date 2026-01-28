import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, ClipboardCheck, Scan } from "lucide-react";
import { AutoSOAPGenerator } from "./AutoSOAPGenerator";
import { SymptomTriageQueue } from "./SymptomTriageQueue";
import { DiagnosticOverlayTool } from "./DiagnosticOverlayTool";

interface AIClinicalAssistantProps {
  vetId: string;
}

export const AIClinicalAssistant = ({ vetId }: AIClinicalAssistantProps) => {
  const [activeTab, setActiveTab] = useState("soap");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Scan className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Smart Clinical Assistant</h2>
          <p className="text-muted-foreground">AI-powered tools to enhance clinical efficiency</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="soap" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Auto-SOAP
          </TabsTrigger>
          <TabsTrigger value="triage" className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Symptom Triage
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Diagnostic AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="soap" className="mt-6">
          <AutoSOAPGenerator vetId={vetId} />
        </TabsContent>

        <TabsContent value="triage" className="mt-6">
          <SymptomTriageQueue vetId={vetId} />
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-6">
          <DiagnosticOverlayTool vetId={vetId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
