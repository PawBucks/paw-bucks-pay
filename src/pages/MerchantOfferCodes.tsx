import { useState, useEffect } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { ArrowLeft, Plus, Copy, Download } from"lucide-react";
import { toast } from"sonner";
import { ErrorHandler } from"@/utils/errorHandler";

export default function MerchantOfferCodes() {
 const navigate = useNavigate();
 const { id } = useParams();
 const [user, setUser] = useState<any>(null);
 const [codes, setCodes] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [codeCount, setCodeCount] = useState(10);
 const [dialogOpen, setDialogOpen] = useState(false);

 useEffect(() => {
 const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
 setUser(session?.user ?? null);
 });

 supabase.auth.getSession().then(({ data: { session } }) => {
 setUser(session?.user ?? null);
 });

 return () => subscription.unsubscribe();
 }, []);

 const handleGenerateCodes = async () => {
 if (codeCount < 1 || codeCount > 1000) {
 toast.error("Code count must be between 1 and 1000");
 return;
 }

 try {
 setLoading(true);
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session) {
 throw new Error("Not authenticated");
 }

 const { data, error } = await supabase.functions.invoke("merchant-generate-codes", {
 body: { offer_id: id, count: codeCount },
 headers: {
 Authorization: `Bearer ${session.access_token}`
 }
 });

 if (error) throw error;

 setCodes(data.codes || []);
 toast.success(`Generated ${data.count} codes successfully`);
 setDialogOpen(false);
 } catch (error) {
 ErrorHandler.handle(error);
 } finally {
 setLoading(false);
 }
 };

 const handleCopyCode = (code: string) => {
 navigator.clipboard.writeText(code);
 toast.success("Code copied to clipboard");
 };

 const handleCopyAll = () => {
 navigator.clipboard.writeText(codes.join("\n"));
 toast.success("All codes copied to clipboard");
 };

 const handleDownloadCodes = () => {
 const csv = ["Redemption Code"].concat(codes).join("\n");
 const blob = new Blob([csv], { type:"text/csv" });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `offer-${id}-codes.csv`;
 a.click();
 window.URL.revokeObjectURL(url);
 toast.success("Codes downloaded successfully");
 };

 const handleSignOut = async () => { await signOut(); };

 return (
 <>
 <SEO 
 title="Redemption Codes | PawBucks Merchant"
 description="Generate and manage redemption codes for your offer"
 keywords={["merchant","codes","redemption"]}
 />
 <div className="min-h-screen bg-background">
 <Header isAuthenticated={!!user} onLogout={handleSignOut} userId={user?.id} variant="merchant" />
 
 <main className="container mx-auto px-4 py-8 pb-24 max-w-4xl lg:max-w-6xl">
 <Button variant="ghost" onClick={() => navigate(`/merchant/offers/${id}`)} className="mb-4">
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Offer Details
 </Button>

 <div className="flex flex-col gap-6">
 {/* Header */}
 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <h1 className="text-3xl font-bold">Redemption Codes</h1>
 <p className="text-muted-foreground mt-1">
 Generate codes for customers to redeem this offer
 </p>
 </div>
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="mr-2 h-4 w-4" />
 Generate Codes
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Generate Redemption Codes</DialogTitle>
 <DialogDescription>
 Create unique codes that customers can use to redeem this offer
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="count">Number of Codes (1-1000)</Label>
 <Input
 id="count"
 type="number"
 min="1"
 max="1000"
 value={codeCount}
 onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleGenerateCodes} disabled={loading}>
 {loading ?"Generating..." :"Generate"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>

 {/* Generated Codes */}
 {codes.length > 0 ? (
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Generated Codes</CardTitle>
 <CardDescription>{codes.length} codes ready to use</CardDescription>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={handleCopyAll}>
 <Copy className="mr-2 h-4 w-4" />
 Copy All
 </Button>
 <Button variant="outline" size="sm" onClick={handleDownloadCodes}>
 <Download className="mr-2 h-4 w-4" />
 Download CSV
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
 {codes.map((code, index) => (
 <div
 key={index}
 className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
 >
 <code className="font-mono text-sm">{code}</code>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleCopyCode(code)}
 >
 <Copy className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 ) : (
 <Card>
 <CardContent className="py-12 text-center">
 <p className="text-muted-foreground mb-4">
 No codes generated yet. Click the button above to generate redemption codes.
 </p>
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="mr-2 h-4 w-4" />
 Generate First Codes
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Generate Redemption Codes</DialogTitle>
 <DialogDescription>
 Create unique codes that customers can use to redeem this offer
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="count">Number of Codes (1-1000)</Label>
 <Input
 id="count"
 type="number"
 min="1"
 max="1000"
 value={codeCount}
 onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleGenerateCodes} disabled={loading}>
 {loading ?"Generating..." :"Generate"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </CardContent>
 </Card>
 )}

 {/* Instructions */}
 <Card>
 <CardHeader>
 <CardTitle>How It Works</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm text-muted-foreground">
 <p>1. Generate redemption codes using the button above</p>
 <p>2. Share codes with your customers via email, social media, or in-store</p>
 <p>3. Customers redeem codes on the PawBucks platform</p>
 <p>4. You confirm redemptions when customers present the code</p>
 <p>5. Track all redemptions in the Redemptions tab</p>
 </CardContent>
 </Card>
 </div>
 </main>
 </div>
 </>
 );
}
