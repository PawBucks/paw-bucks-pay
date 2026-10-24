import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Loader2, LogIn, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TipSelector } from "@/components/checkout/TipSelector";
import { POS_TIP_PRESETS } from "@/lib/posTicket";

type PublicSale = {
  id: string; merchant_id: string; subtotal: number; discount: number; tax: number; tip: number; total: number;
  status: string; business_name: string; logo_url: string | null; payable: boolean;
  items: { name: string; quantity: number; unit_price: number }[];
};

const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export function PosGuestCheckout({ saleId, guestSession }: { saleId: string; guestSession: string | null }) {
  const navigate = useNavigate();
  const [sale, setSale] = useState<PublicSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [tip, setTip] = useState(0);
  const total = sale ? Math.round((Number(sale.total) - Number(sale.tip || 0) + tip) * 100) / 100 : 0;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_pos_sale_public", { _sale_id: saleId });
      const s = data as unknown as PublicSale | null;
      setSale(s);
      setTip(Number(s?.tip || 0));
      if (s && guestSession) {
        const { data: v } = await supabase.functions.invoke("pos-guest-checkout", {
          body: { action: "verify", posSaleId: saleId, sessionId: guestSession },
        });
        if (v?.status === "completed") {
          setSale({ ...s, total: Number(v.total), tip: Number(v.tip) });
          setTip(Number(v.tip));
          setPaid(true);
        }
      } else if (s?.status === "completed") setPaid(true);
      setLoading(false);
    })();
  }, [saleId, guestSession]);

  const signIn = () => {
    const redirect = encodeURIComponent(`/pay/${sale?.merchant_id}?pos_sale=${saleId}&tip=${tip.toFixed(2)}`);
    navigate(`/auth?redirect=${redirect}`);
  };

  const payAsGuest = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pos-guest-checkout", { body: { action: "create", posSaleId: saleId, tipAmount: tip } });
    if (error || !data?.url) {
      toast.error(data?.error || "Couldn't start checkout. Please try again.");
      setBusy(false);
      return;
    }
    window.location.href = data.url;
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full"><CardContent className="pt-6 space-y-4">{children}</CardContent></Card>
    </div>
  );

  if (loading) return shell(<><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full" /></>);
  if (!sale) return shell(<p className="text-center text-muted-foreground">This sale is no longer available. Please ask the business for a new code.</p>);
  if (paid) return shell(
    <div className="text-center">
      <CheckCircle2 className="h-14 w-14 mx-auto text-primary mb-3" />
      <h1 className="text-2xl font-bold mb-1">Payment Successful!</h1>
      <p className="text-muted-foreground">You paid {usd(sale.total)} to {sale.business_name}. A receipt is on its way to your email.</p>
      <Button className="mt-5 w-full" onClick={() => navigate("/auth?mode=signup")}>Create an account to earn PawBucks next time</Button>
    </div>
  );

  return shell(<>
    <div className="text-center">
      {sale.logo_url && <img src={sale.logo_url} alt="" className="h-12 w-12 rounded-full mx-auto mb-2 object-cover" />}
      <h1 className="text-xl font-semibold">{sale.business_name}</h1>
      <p className="text-sm text-muted-foreground">Your purchase</p>
    </div>
    <div className="rounded-lg border divide-y text-sm">
      {sale.items.map((i, idx) => (
        <div key={idx} className="flex justify-between px-3 py-2"><span>{i.quantity} × {i.name}</span><span>{usd(i.quantity * i.unit_price)}</span></div>
      ))}
      {Number(sale.discount) > 0 && <div className="flex justify-between px-3 py-2 text-muted-foreground"><span>Discount</span><span>-{usd(sale.discount)}</span></div>}
      {Number(sale.tax) > 0 && <div className="flex justify-between px-3 py-2 text-muted-foreground"><span>Sales tax</span><span>{usd(sale.tax)}</span></div>}
      <div className="flex justify-between px-3 py-2 text-muted-foreground"><span>Tip</span><span>{usd(tip)}</span></div>
      <div className="flex justify-between px-3 py-2 font-semibold"><span>Total</span><span>{usd(total)}</span></div>
    </div>
    {!sale.payable ? (
      <p className="text-center text-muted-foreground text-sm">Card payments are temporarily unavailable for this business.</p>
    ) : (<>
      <TipSelector baseAmount={Math.max(0, Number(sale.subtotal) - Number(sale.discount))} tipAmount={tip} onTipChange={setTip} presets={POS_TIP_PRESETS} />
      <Button className="w-full" onClick={signIn}><LogIn className="mr-2 h-4 w-4" />Sign in and earn PawBucks</Button>
      <div className="rounded-lg bg-muted/50 p-3 space-y-3">
        <p className="text-sm text-muted-foreground">By paying as a guest, you will not earn any PawBucks on this purchase.</p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
          I understand I won't earn PawBucks by continuing as a guest.
        </label>
        <Button variant="outline" className="w-full" disabled={!confirmed || busy} onClick={payAsGuest}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Pay {usd(total)} as guest
        </Button>
      </div>
    </>)}
  </>);
}
