import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GuidePlace = {
  id: string;
  guide_slug: string;
  section: "parks" | "beaches" | "cafes";
  name: string;
  area: string;
  description: string;
  tag: string | null;
  tag_label: string | null;
  tip: string | null;
  tip_icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type GuideEvent = Omit<GuidePlace, "section"> & { section?: never };
export type GuideFaq = {
  id: string;
  guide_slug: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

export type GuideFeaturedMerchant = {
  id: string;
  business_name: string;
  business_type: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  storefront_slug: string | null;
  cashback_rate: number | null;
};

// LA metro rough bounding box (Long Beach → Malibu, Torrance → Pasadena)
const LA_BBOX = { minLat: 33.7, maxLat: 34.35, minLng: -118.75, maxLng: -118.05 };

export function useGuideContent(guideSlug: string) {
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<GuidePlace[]>([]);
  const [events, setEvents] = useState<GuideFaq[] & GuidePlace[]>([] as any);
  const [faqs, setFaqs] = useState<GuideFaq[]>([]);
  const [merchants, setMerchants] = useState<GuideFeaturedMerchant[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [placesRes, eventsRes, faqsRes, merchantsRes] = await Promise.all([
        supabase.from("guide_places").select("*").eq("guide_slug", guideSlug).eq("is_active", true).order("sort_order"),
        supabase.from("guide_events").select("*").eq("guide_slug", guideSlug).eq("is_active", true).order("sort_order"),
        supabase.from("guide_faqs").select("*").eq("guide_slug", guideSlug).eq("is_active", true).order("sort_order"),
        supabase
          .from("merchants")
          .select("id, business_name, business_type, description, address, logo_url, storefront_slug, cashback_rate, latitude, longitude, approval_status")
          .eq("approval_status", "approved")
          .gte("latitude", LA_BBOX.minLat)
          .lte("latitude", LA_BBOX.maxLat)
          .gte("longitude", LA_BBOX.minLng)
          .lte("longitude", LA_BBOX.maxLng)
          .order("cashback_rate", { ascending: false, nullsFirst: false })
          .limit(6),
      ]);
      if (cancelled) return;
      setPlaces((placesRes.data as GuidePlace[]) ?? []);
      setEvents((eventsRes.data as any) ?? []);
      setFaqs((faqsRes.data as GuideFaq[]) ?? []);
      setMerchants(((merchantsRes.data as any[]) ?? []) as GuideFeaturedMerchant[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [guideSlug]);

  return {
    loading,
    places,
    events: events as unknown as GuidePlace[],
    faqs,
    merchants,
    parks: places.filter((p) => p.section === "parks"),
    beaches: places.filter((p) => p.section === "beaches"),
    cafes: places.filter((p) => p.section === "cafes"),
  };
}