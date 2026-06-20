import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { useUserEarnRate } from "@/hooks/useUserEarnRate";
import { format } from "date-fns";

// In-app Receipt screen — opened from Activity (/receipt/:txId).
// Visual style is intentionally handoff-faithful (inline styles + hex)
// so it stands apart from the standard app chrome.

const C = {
  teal: "#12a8b3", tealDark: "#0a8f9a",
  ink: "#0f172a", muted: "#475569",
  border: "#e8edf2",
  white: "#fff", bg: "#f8f9fa", dark: "#0a1f26",
  gold: "#d4a017",
};

const I = ({ d, size = 16, stroke = 2, color = "currentColor" }: { d: string; size?: number; stroke?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

type ItemRow = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type ReceiptData = {
  id: string;
  created_at: string;
  amount: number;
  stripe_amount: number;
  pawbucks_used: number;
  cashback_earned: number;
  application_fee: number | null;
  merchant: {
    id: string;
    business_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    logo_url: string | null;
  } | null;
  items: ItemRow[];
};

const PB_TO_USD = 0.001;

export default function Receipt() {
  const { txId } = useParams<{ txId: string }>();
  const navigate = useNavigate();
  const { rate: earnRate } = useUserEarnRate();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!txId) return;
      const { data: tx } = await supabase
        .from("transactions")
        .select("id, created_at, amount, stripe_amount, pawbucks_used, cashback_earned, application_fee, merchant_id")
        .eq("id", txId)
        .maybeSingle();
      if (!tx || !active) { setLoading(false); return; }

      const [{ data: merchant }, { data: items }] = await Promise.all([
        supabase
          .from("merchants_public")
          .select("id, business_name, address, latitude, longitude, logo_url, phone, storefront_slug")
          .eq("id", tx.merchant_id)
          .maybeSingle(),
        supabase
          .from("transaction_items")
          .select("name, quantity, unit_price, total")
          .eq("transaction_id", tx.id),
      ]);

      if (!active) return;
      setData({
        id: tx.id,
        created_at: tx.created_at,
        amount: Number(tx.amount ?? 0),
        stripe_amount: Number(tx.stripe_amount ?? 0),
        pawbucks_used: Number(tx.pawbucks_used ?? 0),
        cashback_earned: Number(tx.cashback_earned ?? 0),
        application_fee: tx.application_fee == null ? null : Number(tx.application_fee),
        merchant: merchant ? {
          id: merchant.id,
          business_name: merchant.business_name,
          address: merchant.address,
          latitude: merchant.latitude == null ? null : Number(merchant.latitude),
          longitude: merchant.longitude == null ? null : Number(merchant.longitude),
          logo_url: merchant.logo_url,
        } : null,
        items: (items ?? []).map((r) => ({
          name: r.name ?? "Item",
          quantity: Number(r.quantity ?? 1),
          unit_price: Number(r.unit_price ?? 0),
          total: Number(r.total ?? 0),
        })),
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [txId]);

  // Mapbox token (already used elsewhere in the app)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: tok } = await supabase.functions.invoke("get-mapbox-token");
        if (active && tok?.token) setMapboxToken(tok.token as string);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const mapImg = useMemo(() => {
    const lat = data?.merchant?.latitude;
    const lng = data?.merchant?.longitude;
    if (!mapboxToken || lat == null || lng == null) return null;
    const pin = `pin-l-marker+d4a017(${lng},${lat})`;
    return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pin}/${lng},${lat},14,0/600x340@2x?access_token=${mapboxToken}`;
  }, [mapboxToken, data?.merchant?.latitude, data?.merchant?.longitude]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "'Inter', system-ui, sans-serif" }}>
        Loading receipt…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>
        <div>Receipt not found</div>
        <button onClick={() => navigate("/activity")} style={{ padding: "10px 16px", borderRadius: 10, background: C.teal, color: "#fff", border: "none", fontWeight: 600 }}>Back to Activity</button>
      </div>
    );
  }

  const m = data.merchant;
  const dateObj = new Date(data.created_at);
  const pbAppliedUsd = data.pawbucks_used * PB_TO_USD;
  const itemsTotal = data.items.reduce((s, it) => s + (it.total || it.unit_price * it.quantity), 0);
  const feesAndTip = Math.max(0, data.amount - itemsTotal - (data.application_fee ?? 0));
  const showFees = (data.application_fee ?? 0) > 0 || feesAndTip > 0.005;

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Receipt — ${m?.business_name ?? "PawBucks"}`,
          text: `My ${m?.business_name ?? ""} receipt: $${data.amount.toFixed(2)}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch { /* dismissed */ }
  };

  const onViewMerchant = () => m && navigate(`/merchant/${m.id}`);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: C.ink, background: C.bg, minHeight: "100vh" }}>
      <SEO title={`Receipt — ${m?.business_name ?? "PawBucks"}`} noIndex />

      {/* HERO */}
      <div style={{ height: 240, position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #e8c9a0 0%, #c9986b 40%, #a87a52 100%)" }}>
        {m?.logo_url && (
          <img src={m.logo_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 70%, rgba(0,0,0,0.25) 0%, transparent 60%)" }} />

        <button onClick={() => navigate(-1)} aria-label="Back" style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(10,31,38,0.45)", backdropFilter: "blur(4px)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I d="M19 12H5M12 19l-7-7 7-7" size={18} stroke={2.5} />
        </button>
        <button onClick={onShare} aria-label="Share" style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(10,31,38,0.45)", backdropFilter: "blur(4px)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" size={16} stroke={2.2} />
        </button>

        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(10,31,38,0.7)", backdropFilter: "blur(2px)", border: "1.5px solid rgba(255,255,255,0.5)", padding: "14px 22px", textAlign: "center", maxWidth: "78%" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "0.02em", lineHeight: 1.3 }}>
            {m?.business_name ?? "Merchant"}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div style={{ background: C.dark, padding: "28px 24px 0", marginTop: -1 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            {format(dateObj, "h:mm a")} &nbsp;·&nbsp; {format(dateObj, "MMMM d, yyyy")}
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>
            ${data.amount.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Bill Total</div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "22px 0" }} />
        <div style={{ textAlign: "center", paddingBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{m?.business_name}</div>
          {m?.address && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{m.address}</div>
          )}
        </div>
      </div>

      {/* ITEMS */}
      {data.items.length > 0 && (
        <div style={{ background: C.dark, padding: "4px 24px 28px" }}>
          {data.items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < data.items.length - 1 ? 18 : 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                {item.quantity}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", textTransform: "uppercase" }}>{item.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0, marginLeft: 10 }}>${(item.total || item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BREAKDOWN */}
      <div style={{ padding: "16px 16px 0" }}>
        {data.pawbucks_used > 0 && (
          <div style={{ background: C.dark, borderRadius: 14, padding: "2px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
              <span style={{ fontSize: 14, color: "#6ab8c0" }}>🐾 PawBucks Applied</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.teal }}>−${pbAppliedUsd.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ background: C.dark, borderRadius: 14, padding: "2px 18px", marginBottom: 12 }}>
          <div style={{ padding: "14px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Charged to Card</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>${data.stripe_amount.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Bill (Service)</div>
          </div>
        </div>

        {showFees && (
          <div style={{ background: C.dark, borderRadius: 14, padding: "2px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Tip, Gratuity &amp; Fees</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>${(feesAndTip + (data.application_fee ?? 0)).toFixed(2)}</span>
            </div>
          </div>
        )}

        {data.cashback_earned > 0 && (
          <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              🐾
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>+{Math.round(data.cashback_earned).toLocaleString()} PawBucks Earned</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>{earnRate}x rewards rate · added to your wallet</div>
            </div>
          </div>
        )}
      </div>

      {/* MAP */}
      {m?.latitude != null && m?.longitude != null && (
        <div style={{ padding: "0 16px 16px" }}>
          <div onClick={onViewMerchant} style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 170, cursor: "pointer", border: `1px solid ${C.border}`, background: "#dde6e8" }}>
            {mapImg ? (
              <img src={mapImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12 }}>Map preview</div>
            )}
            {m.address && (
              <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, background: "rgba(255,255,255,0.95)", borderRadius: 9, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <I d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" size={14} color={C.teal} />
                <span style={{ fontSize: 12, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.address}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div style={{ padding: "0 16px 40px", display: "flex", gap: 10 }}>
        <button onClick={onViewMerchant} disabled={!m} style={{ flex: 1, padding: "13px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, color: C.ink, fontSize: 13, fontWeight: 600, cursor: m ? "pointer" : "default", fontFamily: "inherit", opacity: m ? 1 : 0.6 }}>
          View Merchant
        </button>
        <button onClick={onShare} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Share Receipt
        </button>
      </div>
    </div>
  );
}