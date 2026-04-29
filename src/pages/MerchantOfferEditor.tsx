import { useState, useEffect } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
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

export default function MerchantOfferEditor() {
 const navigate = useNavigate();
 const { id } = useParams();
 const isEditMode = !!id;
 const { signOut: globalSignOut } = useAuth();

 const [user, setUser] = useState<any>(null);
 const [loading, setLoading] = useState(false);
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
 require_approval: false
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
 require_approval: data.require_approval || false
 });
 } catch (error) {
 ErrorHandler.handle(error);
 navigate("/merchant/offers");
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 const coinsRequired = typeof formData.coins_required ==='string' ? parseInt(formData.coins_required) : formData.coins_required;
 
 if (!formData.title || !formData.description || !coinsRequired || coinsRequired <= 0) {
 toast.error("Please fill in all required fields");
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
 coins_required: coinsRequired,
 cash_equivalent: formData.cash_equivalent ? (typeof formData.cash_equivalent ==='string' ? parseFloat(formData.cash_equivalent) : formData.cash_equivalent) : null,
 redemption_cap: formData.redemption_cap ? (typeof formData.redemption_cap ==='string' ? parseInt(formData.redemption_cap) : formData.redemption_cap) : null,
 per_user_limit: formData.per_user_limit ? (typeof formData.per_user_limit ==='string' ? parseInt(formData.per_user_limit) : formData.per_user_limit) : 1,
 start_date: formData.start_date || null,
 end_date: formData.end_date || null
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
 throw new Error(data?.error || error.message);
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
 throw new Error(data?.error || error.message);
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
 <div className="min-h-screen bg-background">
 <Header isAuthenticated={!!user} onLogout={handleSignOut} userId={user?.id} variant="merchant" />
 
 <main className="container mx-auto px-4 py-8 pb-24 max-w-4xl lg:max-w-6xl">
 <Button variant="ghost" onClick={() => navigate("/merchant/offers")} className="mb-4">
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Offers
 </Button>

 <Card>
 <CardHeader>
 <CardTitle>{isEditMode ?"Edit Offer" :"Create New Offer"}</CardTitle>
 <CardDescription>
 {isEditMode ?"Update your offer details" :"Create a new PawBucks redemption offer for your customers"}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="space-y-2">
 <Label htmlFor="title">Title *</Label>
 <Input
 id="title"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 placeholder="e.g., $10 Off Grooming Service"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description *</Label>
 <Textarea
 id="description"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Describe your offer..."
 rows={4}
 required
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="coins_required">PawBucks Required *</Label>
 <Input
 id="coins_required"
 type="number"
 min="1"
 value={formData.coins_required}
 onChange={(e) => setFormData({ ...formData, coins_required: e.target.value })}
 required
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

 <div className="space-y-2">
 <Label>Offer Image</Label>
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
 </div>
 </>
 );
}
