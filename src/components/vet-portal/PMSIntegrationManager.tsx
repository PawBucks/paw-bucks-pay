import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  Plus,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PMSIntegrationManagerProps {
  vetId: string;
}

const PMS_PROVIDERS = [
  { value: "idexx_cornerstone", label: "IDEXX Cornerstone", logo: "🏥" },
  { value: "idexx_neo", label: "IDEXX Neo", logo: "🔷" },
  { value: "avimark", label: "AVImark", logo: "📊" },
  { value: "evetpractice", label: "eVetPractice", logo: "💻" },
  { value: "vetspire", label: "Vetspire", logo: "✨" },
  { value: "other", label: "Other PMS", logo: "🔧" },
];

export function PMSIntegrationManager({ vetId }: PMSIntegrationManagerProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [formData, setFormData] = useState({
    provider: "",
    provider_name: "",
    api_endpoint: "",
    client_id: "",
    practice_id: "",
    sync_direction: "bidirectional",
    sync_frequency_minutes: 60,
  });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["pms-integrations", vetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_pms_integrations")
        .select("*")
        .eq("vet_id", vetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: syncLogs } = useQuery({
    queryKey: ["pms-sync-logs", selectedIntegration?.id],
    queryFn: async () => {
      if (!selectedIntegration) return [];
      const { data, error } = await supabase
        .from("pms_sync_logs")
        .select("*")
        .eq("integration_id", selectedIntegration.id)
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedIntegration,
  });

  const addIntegrationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("vet_pms_integrations").insert({
        vet_id: vetId,
        provider: data.provider,
        provider_name: data.provider_name || PMS_PROVIDERS.find(p => p.value === data.provider)?.label || "Unknown",
        api_endpoint: data.api_endpoint || null,
        client_id: data.client_id || null,
        practice_id: data.practice_id || null,
        sync_direction: data.sync_direction,
        sync_frequency_minutes: data.sync_frequency_minutes,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pms-integrations", vetId] });
      setIsAddDialogOpen(false);
      setFormData({
        provider: "",
        provider_name: "",
        api_endpoint: "",
        client_id: "",
        practice_id: "",
        sync_direction: "bidirectional",
        sync_frequency_minutes: 60,
      });
      toast.success("PMS integration added successfully");
    },
    onError: () => {
      toast.error("Failed to add integration");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("vet_pms_integrations")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pms-integrations", vetId] });
      toast.success("Integration status updated");
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vet_pms_integrations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pms-integrations", vetId] });
      setSelectedIntegration(null);
      toast.success("Integration removed");
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      // In production, this would call an edge function to trigger sync
      const { error } = await supabase.from("pms_sync_logs").insert({
        integration_id: integrationId,
        sync_type: "incremental",
        direction: "inbound",
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pms-sync-logs"] });
      toast.success("Sync initiated - this may take a few minutes");
    },
  });

  const getSyncDirectionIcon = (direction: string) => {
    switch (direction) {
      case "bidirectional":
        return <ArrowLeftRight className="h-4 w-4" />;
      case "read_only":
        return <ArrowLeft className="h-4 w-4" />;
      case "write_only":
        return <ArrowRight className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />In Progress</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Practice Management System (PMS) Integrations
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect your PMS to sync patient records automatically
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add PMS Integration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>PMS Provider</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(v) => setFormData({ ...formData, provider: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PMS_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.logo} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.provider === "other" && (
                <div>
                  <Label>Provider Name</Label>
                  <Input
                    value={formData.provider_name}
                    onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                    placeholder="Enter PMS name"
                  />
                </div>
              )}

              <div>
                <Label>API Endpoint (if applicable)</Label>
                <Input
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  placeholder="https://api.yourpms.com/v1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client ID</Label>
                  <Input
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    placeholder="Client ID"
                  />
                </div>
                <div>
                  <Label>Practice ID</Label>
                  <Input
                    value={formData.practice_id}
                    onChange={(e) => setFormData({ ...formData, practice_id: e.target.value })}
                    placeholder="Practice ID"
                  />
                </div>
              </div>

              <div>
                <Label>Sync Direction</Label>
                <Select
                  value={formData.sync_direction}
                  onValueChange={(v) => setFormData({ ...formData, sync_direction: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bidirectional">↔️ Bidirectional (Read & Write)</SelectItem>
                    <SelectItem value="read_only">← Read Only (PMS → PawBucks)</SelectItem>
                    <SelectItem value="write_only">→ Write Only (PawBucks → PMS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Sync Frequency (minutes)</Label>
                <Select
                  value={formData.sync_frequency_minutes.toString()}
                  onValueChange={(v) => setFormData({ ...formData, sync_frequency_minutes: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="1440">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={() => addIntegrationMutation.mutate(formData)}
                disabled={!formData.provider || addIntegrationMutation.isPending}
              >
                {addIntegrationMutation.isPending ? "Adding..." : "Add Integration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Integrations List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="p-6 col-span-full text-center text-muted-foreground">
            Loading integrations...
          </Card>
        ) : integrations && integrations.length > 0 ? (
          integrations.map((integration) => {
            const provider = PMS_PROVIDERS.find((p) => p.value === integration.provider);
            return (
              <Card
                key={integration.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedIntegration?.id === integration.id
                    ? "ring-2 ring-primary"
                    : "hover:shadow-md"
                }`}
                onClick={() => setSelectedIntegration(integration)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{provider?.logo || "🔧"}</div>
                    <div>
                      <h4 className="font-medium">{integration.provider_name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {getSyncDirectionIcon(integration.sync_direction)}
                        {integration.sync_direction.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={integration.is_active ? "default" : "secondary"}>
                    {integration.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {integration.last_sync_at ? (
                    <span>Last sync: {format(new Date(integration.last_sync_at), "MMM d, HH:mm")}</span>
                  ) : (
                    <span>Never synced</span>
                  )}
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-8 col-span-full text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h4 className="font-medium mb-2">No PMS Integrations</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Practice Management System to sync patient records automatically
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Integration
            </Button>
          </Card>
        )}
      </div>

      {/* Selected Integration Details */}
      {selectedIntegration && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Integration Details: {selectedIntegration.provider_name}
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerSyncMutation.mutate(selectedIntegration.id)}
                disabled={!selectedIntegration.is_active}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
              <Button
                variant={selectedIntegration.is_active ? "secondary" : "default"}
                size="sm"
                onClick={() =>
                  toggleActiveMutation.mutate({
                    id: selectedIntegration.id,
                    isActive: !selectedIntegration.is_active,
                  })
                }
              >
                {selectedIntegration.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteIntegrationMutation.mutate(selectedIntegration.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div>
              <p className="text-xs text-muted-foreground">Sync Frequency</p>
              <p className="font-medium">Every {selectedIntegration.sync_frequency_minutes} min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Practice ID</p>
              <p className="font-medium">{selectedIntegration.practice_id || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">API Endpoint</p>
              <p className="font-medium text-xs truncate">{selectedIntegration.api_endpoint || "Not configured"}</p>
            </div>
          </div>

          {/* Sync History */}
          <h5 className="font-medium mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Sync Activity
          </h5>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncLogs && syncLogs.length > 0 ? (
                syncLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.started_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.sync_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.direction === "inbound" ? (
                        <span className="flex items-center gap-1 text-sm">
                          <ArrowLeft className="h-3 w-3" /> Inbound
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm">
                          <ArrowRight className="h-3 w-3" /> Outbound
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm">
                      {log.records_processed > 0 ? (
                        <span>
                          {log.records_created} new, {log.records_updated} updated
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No sync history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              How PMS Integration Works
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Once connected, patient records sync automatically. When you update a vaccine in your PMS, 
              it updates the owner's PawBucks Health Tracker. Conversely, if an owner shares medical records 
              from another vet, you'll see them in your system.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
