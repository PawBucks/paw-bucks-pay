import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { useAuth } from"@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Textarea } from"@/components/ui/textarea";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Plus, Building2, Megaphone, Users, DollarSign, TrendingUp, Store, Eye, CheckCircle2, Clock, Loader2, Mail, Trash2, Settings } from"lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from"@/components/ui/alert-dialog";
import { toast } from"sonner";
import { supabase } from"@/integrations/supabase/client";
import { CampaignBriefCard } from"./CampaignBriefCard";
import { AdminCampaignManageDialog } from"./AdminCampaignManageDialog";
import {
 getAllBrandAccounts,
 getAllBrandCampaigns,
 createBrandAccount,
 updateBrandCampaignStatus,
 getCampaignMerchants,
 getCampaignActivity,
 addMerchantToCampaign,
 calculatePawbucksFromBudget,
 calculateEstimatedReach,
 type BrandAccount,
 type BrandCampaign,
 type BrandCampaignMerchant,
 type BrandedPawbucksActivity,
} from"@/services/api/brandCampaigns.service";

const statusColors: Record<string, string> = {
 draft:"bg-muted text-muted-foreground",
 pending_payment:"bg-warning/15 text-warning",
 active:"bg-success/15 text-success dark:text-success",
 paused:"bg-warning/10 text-warning",
 completed:"bg-info/15 text-info dark:text-info",
 expired:"bg-destructive/15 text-destructive dark:text-destructive",
};

export const BrandCampaignsTab = () => {
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const [showCreateBrand, setShowCreateBrand] = useState(false);
 const [selectedCampaign, setSelectedCampaign] = useState<BrandCampaign | null>(null);
 const [showAddMerchant, setShowAddMerchant] = useState(false);
 const [merchantSearch, setMerchantSearch] = useState("");
 const [showManage, setShowManage] = useState(false);

 // Form state for brand creation
 const [brandForm, setBrandForm] = useState({
 brand_name:"",
 contact_name:"",
 contact_email:"",
 description:"",
 website_url:"",
 });

 const { data: brands = [], isLoading: brandsLoading } = useQuery({
 queryKey: ["admin-brand-accounts"],
 queryFn: async () => {
 const { data, error } = await getAllBrandAccounts();
 if (error) throw error;
 return data;
 },
 });

 const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
 queryKey: ["admin-brand-campaigns"],
 queryFn: async () => {
 const { data, error } = await getAllBrandCampaigns();
 if (error) throw error;
 return data;
 },
 });

 const { data: campaignMerchants = [] } = useQuery({
 queryKey: ["campaign-merchants", selectedCampaign?.id],
 queryFn: async () => {
 if (!selectedCampaign) return [];
 const { data, error } = await getCampaignMerchants(selectedCampaign.id);
 if (error) throw error;
 return data;
 },
 enabled: !!selectedCampaign,
 });

 const { data: campaignActivity = [] } = useQuery({
 queryKey: ["campaign-activity", selectedCampaign?.id],
 queryFn: async () => {
 if (!selectedCampaign) return [];
 const { data, error } = await getCampaignActivity(selectedCampaign.id);
 if (error) throw error;
 return data;
 },
 enabled: !!selectedCampaign,
 });

 const { data: searchedMerchants = [] } = useQuery({
 queryKey: ["merchant-search-brand", merchantSearch],
 queryFn: async () => {
 if (!merchantSearch || merchantSearch.length < 2) return [];
 const { data } = await supabase
 .from("merchants")
 .select("id, business_name, logo_url")
 .ilike("business_name", `%${merchantSearch}%`)
 .limit(10);
 return data || [];
 },
 enabled: merchantSearch.length >= 2,
 });

 const createBrandMutation = useMutation({
 mutationFn: async () => {
 // Admin creates brand account without requiring an existing user
 // The brand rep will be invited via email to claim the account
 return createBrandAccount({
 brand_name: brandForm.brand_name,
 contact_name: brandForm.contact_name || undefined,
 contact_email: brandForm.contact_email || undefined,
 description: brandForm.description || undefined,
 website_url: brandForm.website_url || undefined,
 created_by: user!.id,
 });
 },
 onSuccess: async (result) => {
 if (result.error || !result.data) {
 toast.error("Failed to create brand account");
 return;
 }
 const brandId = result.data.id;
 const inviteUrl = `${window.location.origin}/brand-setup/${result.data.invitation_token}`;
 // Try to email the brand contact
 const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-brand-invitation", {
 body: { brandId },
 });
 if (sendErr || (sendData && (sendData as any).error)) {
 try { await navigator.clipboard.writeText(inviteUrl); } catch { /* noop */ }
 toast.success("Brand created. Invite link copied (email send failed — share manually).");
 } else {
 toast.success(`Brand created — invitation emailed to ${(sendData as any)?.sent_to || result.data.contact_email}`);
 }
 setShowCreateBrand(false);
 setBrandForm({ brand_name:"", contact_name:"", contact_email:"", description:"", website_url:"" });
 queryClient.invalidateQueries({ queryKey: ["admin-brand-accounts"] });
 },
 onError: (error: Error) => {
 toast.error(error.message);
 },
 });

 const resendInvitationMutation = useMutation({
 mutationFn: async (brandId: string) => {
 const { data, error } = await supabase.functions.invoke("send-brand-invitation", { body: { brandId } });
 if (error) throw error;
 if ((data as any)?.error) throw new Error((data as any).error);
 return data;
 },
 onSuccess: (data: any) => toast.success(`Invitation re-sent to ${data?.sent_to}`),
 onError: (e: Error) => toast.error(`Failed to resend: ${e.message}`),
 });

 const deleteBrandMutation = useMutation({
 mutationFn: async (brandId: string) => {
 const { data, error } = await supabase.rpc("admin_delete_brand_account", { p_brand_id: brandId });
 if (error) throw error;
 const r = data as { success: boolean; error?: string } | null;
 if (r && !r.success) throw new Error(r.error ||"Delete failed");
 return r;
 },
 onSuccess: () => {
 toast.success("Brand account deleted");
 queryClient.invalidateQueries({ queryKey: ["admin-brand-accounts"] });
 queryClient.invalidateQueries({ queryKey: ["admin-brand-campaigns"] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const updateStatusMutation = useMutation({
 mutationFn: async ({ campaignId, status }: { campaignId: string; status: string }) => {
 return updateBrandCampaignStatus(campaignId, status);
 },
 onSuccess: (result) => {
 if (result.error) {
 toast.error("Failed to update campaign status");
 return;
 }
 toast.success("Campaign status updated!");
 queryClient.invalidateQueries({ queryKey: ["admin-brand-campaigns"] });
 if (selectedCampaign) {
 setSelectedCampaign({ ...selectedCampaign, status: result.data!.status });
 }
 },
 });

 const addMerchantMutation = useMutation({
 mutationFn: async (merchantId: string) => {
 if (!selectedCampaign) throw new Error("No campaign selected");
 return addMerchantToCampaign(selectedCampaign.id, merchantId);
 },
 onSuccess: (result) => {
 if (result.error) {
 toast.error("Failed to invite merchant");
 return;
 }
 toast.success("Invitation sent to merchant!");
 setShowAddMerchant(false);
 setMerchantSearch("");
 queryClient.invalidateQueries({ queryKey: ["campaign-merchants", selectedCampaign?.id] });
 },
 });

 if (brandsLoading || campaignsLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 );
 }

 if (selectedCampaign) {
 const distributionPct = selectedCampaign.pawbucks_pool > 0
 ? ((selectedCampaign.total_distributed / selectedCampaign.pawbucks_pool) * 100).toFixed(1)
 :"0";
 const redemptionPct = selectedCampaign.total_distributed > 0
 ? ((selectedCampaign.total_redeemed / selectedCampaign.total_distributed) * 100).toFixed(1)
 :"0";
 const brandName = (selectedCampaign as any).brand_accounts?.brand_name ||"Brand";

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <Button variant="ghost" onClick={() => setSelectedCampaign(null)}>← Back</Button>
 <div className="flex-1">
 <h2 className="text-2xl font-bold">{selectedCampaign.name}</h2>
 <p className="text-muted-foreground">by {brandName}</p>
 </div>
 <Badge className={statusColors[selectedCampaign.status] ||""}>
 {selectedCampaign.status.replace("_","")}
 </Badge>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2 text-muted-foreground text-sm">
 <DollarSign className="h-4 w-4" />Budget
 </div>
 <p className="text-2xl font-bold">${selectedCampaign.budget_usd.toLocaleString()}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2 text-muted-foreground text-sm">
 <TrendingUp className="h-4 w-4" />Distributed
 </div>
 <p className="text-2xl font-bold">{selectedCampaign.total_distributed.toLocaleString()} PB</p>
 <p className="text-xs text-muted-foreground">{distributionPct}% of pool</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2 text-muted-foreground text-sm">
 <CheckCircle2 className="h-4 w-4" />Redeemed
 </div>
 <p className="text-2xl font-bold">{selectedCampaign.total_redeemed.toLocaleString()} PB</p>
 <p className="text-xs text-muted-foreground">{redemptionPct}% of distributed</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2 text-muted-foreground text-sm">
 <Users className="h-4 w-4" />Check-ins
 </div>
 <p className="text-2xl font-bold">{selectedCampaign.total_checkins.toLocaleString()}</p>
 </CardContent>
 </Card>
 </div>

 {/* Full Campaign Brief — every captured field from the brand */}
 <CampaignBriefCard campaign={selectedCampaign} />

 {/* Status controls */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Campaign Controls</CardTitle>
 </CardHeader>
 <CardContent className="flex flex-wrap gap-2">
 <Button variant="outline" onClick={() => setShowManage(true)}>
 <Settings className="h-4 w-4 mr-1" /> Manage Parameters & Grant PB
 </Button>
 {selectedCampaign.status ==="draft" && (
 <Button onClick={() => updateStatusMutation.mutate({ campaignId: selectedCampaign.id, status:"pending_payment" })}>
 Submit for Payment
 </Button>
 )}
 {selectedCampaign.status ==="pending_payment" && (
 <Button onClick={() => updateStatusMutation.mutate({ campaignId: selectedCampaign.id, status:"active" })} className="bg-success hover:bg-success">
 Activate Campaign (Payment Confirmed)
 </Button>
 )}
 {selectedCampaign.status ==="active" && (
 <>
 <Button variant="outline" onClick={() => updateStatusMutation.mutate({ campaignId: selectedCampaign.id, status:"paused" })}>
 Pause Campaign
 </Button>
 <Button variant="destructive" onClick={() => updateStatusMutation.mutate({ campaignId: selectedCampaign.id, status:"completed" })}>
 End Campaign
 </Button>
 </>
 )}
 {selectedCampaign.status ==="paused" && (
 <Button onClick={() => updateStatusMutation.mutate({ campaignId: selectedCampaign.id, status:"active" })} className="bg-success hover:bg-success">
 Resume Campaign
 </Button>
 )}
 </CardContent>
 </Card>

 {/* Merchants & Activity tabs */}
 <Tabs defaultValue="merchants">
 <TabsList>
 <TabsTrigger value="merchants">Participating Merchants ({campaignMerchants.length})</TabsTrigger>
 <TabsTrigger value="activity">Activity Log ({campaignActivity.length})</TabsTrigger>
 </TabsList>

 <TabsContent value="merchants" className="space-y-4">
 <div className="flex justify-end">
 <Dialog open={showAddMerchant} onOpenChange={setShowAddMerchant}>
 <DialogTrigger asChild>
 <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Merchant</Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Add Merchant to Campaign</DialogTitle>
 <DialogDescription>Search for a merchant to add to this campaign.</DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <Input
 placeholder="Search merchant name..."
 value={merchantSearch}
 onChange={(e) => setMerchantSearch(e.target.value)}
 />
 <div className="space-y-2 max-h-60 overflow-y-auto">
 {searchedMerchants.map((m: any) => (
 <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
 <div className="flex items-center gap-2">
 <Store className="h-4 w-4 text-muted-foreground" />
 <span className="font-medium">{m.business_name}</span>
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => addMerchantMutation.mutate(m.id)}
 disabled={addMerchantMutation.isPending}
 >
 Add
 </Button>
 </div>
 ))}
 {merchantSearch.length >= 2 && searchedMerchants.length === 0 && (
 <p className="text-sm text-muted-foreground text-center py-4">No merchants found</p>
 )}
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {campaignMerchants.length === 0 ? (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No merchants added yet</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-2">
 {campaignMerchants.map((cm) => (
 <Card key={cm.id}>
 <CardContent className="py-3 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Store className="h-5 w-5 text-muted-foreground" />
 <div>
 <p className="font-medium">{(cm as any).merchants?.business_name ||"Unknown"}</p>
 <p className="text-xs text-muted-foreground">
 Joined {cm.joined_at ? new Date(cm.joined_at).toLocaleDateString() :"Invited"}
 </p>
 </div>
 </div>
 <Badge variant={cm.status ==="active" ?"default" :"secondary"}>
 {cm.status}
 </Badge>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="activity">
 {campaignActivity.length === 0 ? (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No activity yet</p>
 </CardContent>
 </Card>
 ) : (
 <ScrollArea className="h-[400px]">
 <div className="space-y-2">
 {campaignActivity.map((a) => (
 <Card key={a.id}>
 <CardContent className="py-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">
 {a.type ==="earn" ?"🟢 Distributed" :"🔴 Redeemed"} {Math.abs(a.amount).toLocaleString()} PB
 </p>
 <p className="text-xs text-muted-foreground">
 {a.description} • at {(a as any).merchants?.business_name ||"Unknown"}
 </p>
 </div>
 <span className="text-xs text-muted-foreground">
 {new Date(a.created_at).toLocaleString()}
 </span>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </ScrollArea>
 )}
 </TabsContent>
 </Tabs>
 <AdminCampaignManageDialog
 open={showManage}
 onOpenChange={setShowManage}
 campaign={selectedCampaign}
 />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h2 className="text-2xl font-bold">Brand Campaigns</h2>
 <p className="text-muted-foreground">Manage brand/manufacturer funded PawBucks campaigns</p>
 </div>
 <Dialog open={showCreateBrand} onOpenChange={setShowCreateBrand}>
 <DialogTrigger asChild>
 <Button className="w-full sm:w-auto whitespace-nowrap"><Plus className="h-4 w-4 mr-2" /> Create Brand Account</Button>
 </DialogTrigger>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Create Brand Account</DialogTitle>
 <DialogDescription>Set up a new brand/manufacturer account for funded PawBucks campaigns.</DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Brand Name *</Label>
 <Input value={brandForm.brand_name} onChange={(e) => setBrandForm(f => ({ ...f, brand_name: e.target.value }))} placeholder="Acme Pet Products" />
 </div>
 <div className="space-y-2">
 <Label>Contact Name</Label>
 <Input value={brandForm.contact_name} onChange={(e) => setBrandForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" />
 </div>
 <div className="space-y-2">
 <Label>Contact Email</Label>
 <Input type="email" value={brandForm.contact_email} onChange={(e) => setBrandForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="contact@brand.com" />
 <p className="text-xs text-muted-foreground">An invitation link will be generated for the brand to complete setup</p>
 </div>
 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea value={brandForm.description} onChange={(e) => setBrandForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the brand..." />
 </div>
 <div className="space-y-2">
 <Label>Website</Label>
 <Input value={brandForm.website_url} onChange={(e) => setBrandForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://brand.com" />
 </div>
 <Button
 className="w-full"
 onClick={() => createBrandMutation.mutate()}
 disabled={!brandForm.brand_name || createBrandMutation.isPending}
 >
 {createBrandMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
 Create Brand Account & Copy Invite Link
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Brand accounts */}
 <div>
 <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
 <Building2 className="h-5 w-5" /> Brand Accounts ({brands.length})
 </h3>
 {brands.length === 0 ? (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No brand accounts yet. Create one to get started.</p>
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
 {brands.map((brand) => {
 const brandCampaigns = campaigns.filter((c) => c.brand_id === brand.id);
 const activeCampaigns = brandCampaigns.filter((c) => c.status ==="active");
 return (
 <Card key={brand.id}>
 <CardContent className="pt-4">
 <div className="flex items-start justify-between mb-2">
 <div className="min-w-0">
 <h4 className="font-bold truncate">{brand.brand_name}</h4>
 <p className="text-xs text-muted-foreground truncate">{brand.contact_email || brand.contact_name}</p>
 </div>
 <div className="flex flex-col items-end gap-1">
 <Badge variant={brand.status ==="active" ?"default" :"secondary"}>{brand.status}</Badge>
 {(brand as any).setup_completed_at ? (
 <Badge variant="outline" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Setup done</Badge>
 ) : (
 <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Setup pending</Badge>
 )}
 </div>
 </div>
 {brand.description && (
 <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{brand.description}</p>
 )}
 <div className="flex items-center gap-2 text-sm mb-3">
 <Megaphone className="h-4 w-4 text-muted-foreground" />
 <span>{brandCampaigns.length} campaign{brandCampaigns.length !== 1 ?"s" :""}</span>
 {activeCampaigns.length > 0 && (
 <Badge variant="outline" className="text-success">{activeCampaigns.length} active</Badge>
 )}
 </div>
 <div className="flex gap-2 pt-2 border-t">
 <Button
 size="sm"
 variant="outline"
 className="flex-1"
 disabled={!brand.contact_email || resendInvitationMutation.isPending}
 onClick={() => resendInvitationMutation.mutate(brand.id)}
 >
 <Mail className="h-3 w-3 mr-1" />
 {(brand as any).setup_completed_at ?"Resend" :"Send Invite"}
 </Button>
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
 <Trash2 className="h-3 w-3" />
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete {brand.brand_name}?</AlertDialogTitle>
 <AlertDialogDescription>
 This permanently removes the brand account and ALL of its campaigns ({brandCampaigns.length}).
 This cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 onClick={() => deleteBrandMutation.mutate(brand.id)}
 >
 Delete Brand
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>

 <Separator />

 {/* Campaigns */}
 <div>
 <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
 <Megaphone className="h-5 w-5" /> All Campaigns ({campaigns.length})
 </h3>
 {campaigns.length === 0 ? (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No campaigns yet. Brands can create campaigns from their dashboard.</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {campaigns.map((campaign) => {
 const poolPct = campaign.pawbucks_pool > 0
 ? ((campaign.total_distributed / campaign.pawbucks_pool) * 100).toFixed(0)
 :"0";
 return (
 <Card key={campaign.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCampaign(campaign)}>
 <CardContent className="py-4">
 <div className="flex items-center justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-bold">{campaign.name}</h4>
 <Badge className={statusColors[campaign.status] ||""}>
 {campaign.status.replace("_","")}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 by {(campaign as any).brand_accounts?.brand_name ||"Unknown"} • Budget: ${campaign.budget_usd.toLocaleString()} • Pool: {campaign.pawbucks_pool.toLocaleString()} PB
 </p>
 <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
 <span>{campaign.total_checkins} check-ins</span>
 <span>{campaign.total_distributed.toLocaleString()} PB distributed ({poolPct}%)</span>
 <span>{campaign.total_redeemed.toLocaleString()} PB redeemed</span>
 </div>
 </div>
 <Eye className="h-5 w-5 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
};
