import { useState, useEffect } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from"@/integrations/supabase/client";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { SEO } from"@/components/SEO";
import { useAuth } from"@/hooks/useAuth";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Switch } from"@/components/ui/switch";
import { ArrowLeft, Save } from"lucide-react";
import { ProductImageUpload } from"@/components/shared/ProductImageUpload";
import { toast } from"sonner";
import { ErrorHandler } from"@/utils/errorHandler";
import { BrandSelector } from"@/components/brand/BrandSelector";
import { useMerchantContext } from"@/hooks/useMerchantContext";
import { Sparkles } from"lucide-react";

export default function MerchantOfferEditor() {
 const navigate = useNavigate();
 const { id } = useParams();
 const isEditMode = !!id;
 const { signOut: globalSignOut } = useAuth();
  const { merchantId } = useMerchantContext();

 const [user, setUser] = useState<any>(null);
 const [loading, setLoading] = useState(false);
  const [isAcquisitionOnly, setIsAcquisitionOnly] = useState(false);
 const [formData, setFormData] = useState({
 title:"",
 description:"",
 coins_required:"" as string | number,
 cash_equivalent:"" as string | number,
 product_id:"",
 image_url:"",
 start_date:"",
 end_date:"",
 redemption_cap:"" as string | number,
 per_user_limit:"" as string | number,
  require_approval: false,
  brand_id: null as string | null,
    offer_type: "pawbucks_redemption" as "pawbucks_redemption" | "new_customer",
     accepts_pawbucks: true,
     accepts_usd: false,
 });

 useEffect(() => {
 const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
 setUser(session?.user ?? null);
 });

 supabase.auth.getSession().then(({ data: { session } }) => {
 setUser(session?.user ?? null);
 });

 return () => subscription.unsubscribe();
 }, []);

  // Detect acquisition-only merchants — they may only create New Customer Deals.
  useEffect(() => {
    if (!merchantId) return;
    supabase
      .from("merchants")
      .select("fee_model")
      .eq("id", merchantId)
      .maybeSingle()
      .then(({ data }) => {
        const acquisitionOnly = data?.fee_model === "acquisition_only";
        setIsAcquisitionOnly(acquisitionOnly);
        if (acquisitionOnly) {
          setFormData((prev) => ({
            ...prev,
            offer_type: "new_customer",
            coins_required: 0,
            cash_equivalent: "",
            brand_id: null,
          }));
        }
      });
  }, [merchantId]);

 useEffect(() => {
 if (isEditMode && user) {
 fetchOffer();
 }
 }, [isEditMode, user, id]);

 const fetchOffer = async () => {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session) {
 throw new Error("Not authenticated");
 }

 const { data, error } = await supabase.functions.invoke(`merchant-get-offer/${id}`, {
 headers: {
 Authorization: `Bearer ${session.access_token}`
 }
 });

 if (error) throw error;

 setFormData({
 title: data.title,
 description: data.description,
 coins_required: data.coins_required,
 cash_equivalent: data.cash_equivalent || 0,
 product_id: data.product_id ||"",
 image_url: data.image_url ||"",
 start_date: data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) :"",
 end_date: data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) :"",
 redemption_cap: data.redemption_cap || 0,
 per_user_limit: data.per_user_limit || 1,
  require_approval: data.require_approval || false,
  brand_id: data.brand_id ?? null,
        offer_type: (data.offer_type as any) || "pawbucks_redemption",
        accepts_pawbucks: data.accepts_pawbucks ?? true,
        accepts_usd: data.accepts_usd ?? false,
 });
 } catch (error) {
 ErrorHandler.handle(error);
 navigate("/merchant/offers");
 }
 };

  const getFunctionErrorMessage = async (error: unknown, fallback = "Unable to save offer. Please check the form and try again.") => {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        return body?.error || body?.message || fallback;
      } catch {
        return fallback;
      }
    }
    return error instanceof Error && error.message ? error.message : fallback;
  };

  const normalizeOptionalImageUrl = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

    const isNewCustomer = isAcquisitionOnly || formData.offer_type === "new_customer";
    const coinsRequired = isNewCustomer
      ? 0
      : (typeof formData.coins_required === 'string'
          ? parseInt(formData.coins_required)
          : formData.coins_required);

    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isNewCustomer && (!coinsRequired || coinsRequired <= 0)) {
      toast.error("PawBucks required must be greater than 0");
      return;
    }
    if (!isNewCustomer && !formData.accepts_pawbucks && !formData.accepts_usd) {
      toast.error("Choose at least one redemption method (PawBucks or USD).");
      return;
    }
    const cashEquivalent = isNewCustomer
      ? null
      : (formData.cash_equivalent
          ? (typeof formData.cash_equivalent === 'string'
              ? parseFloat(formData.cash_equivalent)
              : formData.cash_equivalent)
          : null);
    if (!isNewCustomer && formData.accepts_usd && (!cashEquivalent || cashEquivalent <= 0)) {
      toast.error("Cash Equivalent (USD) must be greater than 0 when USD redemption is enabled.");
      return;
    }
    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast.error("Start date must be before end date.");
      return;
    }

 try {
 setLoading(true);
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session) {
 throw new Error("Not authenticated");
 }

 const payload = {
 ...formData,
  title: formData.title.trim(),
  description: formData.description.trim(),
 coins_required: coinsRequired,
        cash_equivalent: cashEquivalent,
 redemption_cap: formData.redemption_cap ? (typeof formData.redemption_cap ==='string' ? parseInt(formData.redemption_cap) : formData.redemption_cap) : null,
 per_user_limit: formData.per_user_limit ? (typeof formData.per_user_limit ==='string' ? parseInt(formData.per_user_limit) : formData.per_user_limit) : 1,
  image_url: normalizeOptionalImageUrl(formData.image_url),
  product_id: formData.product_id.trim() || null,
  start_date: formData.start_date || null,
   end_date: formData.end_date || null,
        brand_id: isNewCustomer ? null : (formData.brand_id || null),
        offer_type: isNewCustomer ? "new_customer" : "pawbucks_redemption",
        accepts_pawbucks: isNewCustomer ? false : formData.accepts_pawbucks,
        accepts_usd: isNewCustomer ? false : formData.accepts_usd,
 };

 if (isEditMode) {
 const { data, error } = await supabase.functions.invoke(`merchant-update-offer/${id}`, {
 body: payload,
 headers: {
 Authorization: `Bearer ${session.access_token}`,
 },
 });

  if (error) {
  console.error("Update offer error:", error, data);
  throw new Error(data?.error || await getFunctionErrorMessage(error));
  }

 toast.success("Offer updated successfully");
 } else {
 const { data, error } = await supabase.functions.invoke("merchant-create-offer", {
 body: payload,
 headers: {
 Authorization: `Bearer ${session.access_token}`,
 },
 });

  if (error) {
  console.error("Create offer error:", error, data);
  throw new Error(data?.error || await getFunctionErrorMessage(error));
  }

 toast.success("Offer created successfully");
 }

 navigate("/merchant/offers");
 } catch (error) {
 ErrorHandler.handle(error);
 } finally {
 setLoading(false);
 }
 };

const handleSignOut = async () => {
 await globalSignOut();
 navigate("/auth");
};

 return (
 <>
 <SEO 
 title={`${isEditMode ?"Edit" :"Create"} Offer | PawBucks Merchant`}
 description="Create or edit partner offers for PawBucks redemption"
 keywords={["merchant","offers","create","edit"]}
 />
 <MerchantWorkspaceLayout>
 <WorkspacePageHeader section="Catalog & Services" title={isEditMode ? "Edit Offer" : "Create Offer"} subtitle={isEditMode ? "Update your offer details" : "Create a new PawBucks redemption offer"} />
 <main className="container mx-auto px-4 py-6 pb-24 max-w-7xl lg:max-w-7xl">
 <Button variant="ghost" onClick={() => navigate("/merchant/offers")} className="mb-4">
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Offers
 </Button>

 <Card>
 <CardHeader>
                  <CardTitle>
                    {isAcquisitionOnly
                      ? (isEditMode ? "Edit New Customer Deal" : "Create New Customer Deal")
                      : (isEditMode ? "Edit Offer" : "Create New Offer")}
                  </CardTitle>
                  <CardDescription>
                    {isAcquisitionOnly
                      ? "Acquisition-only merchants create New Customer Deals — first-visit incentives unlocked when a new customer scans your in-store QR code."
                      : (isEditMode ? "Update your offer details" : "Create a new PawBucks redemption offer for your customers")}
                  </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-6">
                    {isAcquisitionOnly && (
                      <div className="rounded-md border bg-muted/40 p-4 flex gap-3">
                        <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">New Customer Deal</p>
                          <p className="text-muted-foreground">
                            Describe the first-visit incentive — examples: "$10 off 1st visit",
                            "20% off 1st order", "Free nail trim with grooming". No PawBucks
                            price is required; the deal unlocks after a verified in-store QR scan.
                          </p>
                        </div>
                      </div>
                    )}

 <div className="space-y-2">
 <Label htmlFor="title">Title *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder={isAcquisitionOnly ? "e.g., $10 off 1st visit" : "e.g., $10 Off Grooming Service"}
 required
 />
 </div>

 <div className="space-y-2">
                      <Label htmlFor="description">
                        {isAcquisitionOnly ? "Deal Description *" : "Description *"}
                      </Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={isAcquisitionOnly
                          ? "Describe the first-visit deal customers will see after scanning..."
                          : "Describe your offer..."}
 rows={4}
 required
 />
 </div>

                    {!isAcquisitionOnly && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="coins_required">PawBucks Required *</Label>
 <Input
 id="coins_required"
 type="number"
 min="1"
 value={formData.coins_required}
 onChange={(e) => setFormData({ ...formData, coins_required: e.target.value })}
                          required={!isAcquisitionOnly}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="cash_equivalent">Cash Equivalent (USD)</Label>
 <Input
 id="cash_equivalent"
 type="number"
 min="0"
 step="0.01"
 value={formData.cash_equivalent}
 onChange={(e) => setFormData({ ...formData, cash_equivalent: e.target.value })}
 />
 </div>
 </div>
                    )}

                    {!isAcquisitionOnly && (
                      <div className="space-y-3 rounded-md border p-4">
                        <div>
                          <Label className="text-base">Accepted Redemption Methods</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Choose how customers can redeem this offer. Select one or both.
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="accepts_pawbucks">Redeemable with PawBucks</Label>
                            <p className="text-xs text-muted-foreground">Customers pay using their PawBucks balance.</p>
                          </div>
                          <Switch
                            id="accepts_pawbucks"
                            checked={formData.accepts_pawbucks}
                            onCheckedChange={(checked) => setFormData({ ...formData, accepts_pawbucks: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="accepts_usd">Redeemable with USD</Label>
                            <p className="text-xs text-muted-foreground">Customers pay the Cash Equivalent in USD at checkout.</p>
                          </div>
                          <Switch
                            id="accepts_usd"
                            checked={formData.accepts_usd}
                            onCheckedChange={(checked) => setFormData({ ...formData, accepts_usd: checked })}
                          />
                        </div>
                        {formData.accepts_usd && !formData.cash_equivalent && (
                          <p className="text-xs text-destructive">
                            Set a Cash Equivalent (USD) above so customers know the USD price.
                          </p>
                        )}
                      </div>
                    )}

 <div className="space-y-2">
                      <Label>{isAcquisitionOnly ? "Deal Image (optional)" : "Offer Image"}</Label>
 <ProductImageUpload
 imageUrls={formData.image_url ? [formData.image_url] : []}
 onChange={(urls) => setFormData({ ...formData, image_url: urls[0] ||'' })}
 folder="offers"
 maxImages={1}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="start_date">Start Date</Label>
 <Input
 id="start_date"
 type="datetime-local"
 value={formData.start_date}
 onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="end_date">End Date</Label>
 <Input
 id="end_date"
 type="datetime-local"
 value={formData.end_date}
 onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="redemption_cap">Total Redemption Cap</Label>
 <Input
 id="redemption_cap"
 type="number"
 min="0"
 value={formData.redemption_cap}
 onChange={(e) => setFormData({ ...formData, redemption_cap: e.target.value })}
 placeholder="0 = unlimited"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="per_user_limit">Per User Limit</Label>
 <Input
 id="per_user_limit"
 type="number"
 min="1"
 value={formData.per_user_limit}
 onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
 />
 </div>
 </div>

 <div className="flex items-center space-x-2">
 <Switch
 id="require_approval"
 checked={formData.require_approval}
 onCheckedChange={(checked) => setFormData({ ...formData, require_approval: checked })}
 />
 <Label htmlFor="require_approval">Require Admin Approval</Label>
 </div>

                    {!isAcquisitionOnly && (
                      <div className="space-y-2">
                        <Label htmlFor="brand_id">Brand Tag</Label>
                        <BrandSelector
                          value={formData.brand_id}
                          onChange={(brandId) => setFormData({ ...formData, brand_id: brandId })}
                          merchantId={merchantId ?? null}
                          placeholder="No brand (general offer)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Tagging this offer to a brand makes branded PawBucks from that brand's
                          campaigns redeemable here. Leave unset for general offers.
                        </p>
                      </div>
                    )}

 <div className="flex gap-4">
 <Button type="submit" disabled={loading}>
 <Save className="mr-2 h-4 w-4" />
 {loading ?"Saving..." : isEditMode ?"Update Offer" :"Create Offer"}
 </Button>
 <Button type="button" variant="outline" onClick={() => navigate("/merchant/offers")}>
 Cancel
 </Button>
 </div>
 </form>
 </CardContent>
 </Card>
 </main>
 </MerchantWorkspaceLayout>
 </>
 );
}
