import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { Download, Users, Calendar, Search, Clock, Mail, Phone, User } from "lucide-react";
import { format, subMonths, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

type CheckIn = {
  id: string;
  user_id: string;
  checked_in_at: string;
  profile?: {
    full_name: string | null;
    email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
};

type CheckInDashboardProps = {
  entityId: string;
  entityType: "merchant" | "vet";
  entityName: string;
};

export function CheckInDashboard({ entityId, entityType, entityName }: CheckInDashboardProps) {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const qrRef = useRef<HTMLDivElement>(null);

  const loadQrToken = useCallback(async () => {
    const table = entityType === "merchant" ? "merchants" : "partner_vets";
    const { data, error } = await supabase
      .from(table)
      .select("checkin_qr_token")
      .eq("id", entityId)
      .single();

    if (!error && data) {
      setQrToken((data as any).checkin_qr_token);
    }
  }, [entityId, entityType]);

  const loadCheckins = useCallback(async () => {
    setLoading(true);
    try {
      const idCol = entityType === "merchant" ? "merchant_id" : "vet_id";
      
      // Calculate date range: from 24 months ago to now
      const startDate = subMonths(new Date(), 24).toISOString();
      
      const { data, error } = await supabase
        .from("checkins")
        .select("id, user_id, checked_in_at")
        .eq(idCol, entityId)
        .gte("checked_in_at", startDate)
        .order("checked_in_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for all unique user_ids
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        
        // Fetch profiles and emails in parallel
        const [profilesResult, emailsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, phone, avatar_url")
            .in("id", userIds),
          supabase.rpc("get_checkin_user_emails", {
            p_user_ids: userIds,
            p_entity_id: entityId,
            p_entity_type: entityType,
          }),
        ]);

        const profileMap = new Map(
          (profilesResult.data || []).map(p => [p.id, p])
        );
        const emailMap = new Map(
          (emailsResult.data || []).map((e: any) => [e.user_id, e.email])
        );

        const enriched = data.map(c => ({
          ...c,
          profile: {
            full_name: profileMap.get(c.user_id)?.full_name ?? null,
            phone: profileMap.get(c.user_id)?.phone ?? null,
            avatar_url: profileMap.get(c.user_id)?.avatar_url ?? null,
            email: emailMap.get(c.user_id) ?? null,
          },
        }));

        setCheckins(enriched);
      } else {
        setCheckins([]);
      }
    } catch (error) {
      console.error("Error loading check-ins:", error);
      toast.error("Failed to load check-ins");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    loadQrToken();
    loadCheckins();
  }, [loadQrToken, loadCheckins]);

  const todayCheckins = checkins.filter(c => {
    const today = new Date();
    const checkinDate = new Date(c.checked_in_at);
    return checkinDate >= startOfDay(today) && checkinDate <= endOfDay(today);
  });

  const monthCheckins = checkins.filter(c => {
    return format(new Date(c.checked_in_at), "yyyy-MM") === selectedMonth;
  });

  const filteredCheckins = (list: CheckIn[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(c =>
      c.profile?.full_name?.toLowerCase().includes(q) ||
      c.profile?.phone?.toLowerCase().includes(q) ||
      c.profile?.email?.toLowerCase().includes(q)
    );
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    canvas.width = 800;
    canvas.height = 900;

    img.onload = () => {
      if (!ctx) return;
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR code centered
      ctx.drawImage(img, 100, 40, 600, 600);

      // Draw text
      ctx.fillStyle = "#000000";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Scan to Check In", canvas.width / 2, 700);
      ctx.font = "24px Arial";
      ctx.fillText(entityName, canvas.width / 2, 745);

      // PawBucks branding
      ctx.font = "18px Arial";
      ctx.fillStyle = "#666666";
      ctx.fillText("Powered by PawBucks", canvas.width / 2, 850);

      const link = document.createElement("a");
      link.download = `${entityName.replace(/\s+/g, "-")}-checkin-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Generate months for selector (last 24 months)
  const months = Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const qrValue = qrToken ? `https://pawbucks.app/checkin?token=${qrToken}` : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* QR Code Card */}
        <GradientCard className="p-6 flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold mb-4">Your Check-In QR Code</h3>
          {qrToken ? (
            <>
              <div ref={qrRef} className="bg-white p-4 rounded-xl shadow-inner mb-4">
                <QRCodeSVG
                  value={qrValue}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Print and display this QR code for pet owners to scan when they arrive.
              </p>
              <Button onClick={handleDownloadQR} size="sm" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Printable QR
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Loading QR code...</p>
          )}
        </GradientCard>

        {/* Today's Stats */}
        <GradientCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCheckins.length}</p>
              <p className="text-sm text-muted-foreground">Today's Check-Ins</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </GradientCard>

        {/* All-Time Stats */}
        <GradientCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{checkins.length}</p>
              <p className="text-sm text-muted-foreground">Total Check-Ins (24 months)</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Set(checkins.map(c => c.user_id)).size} unique visitors
          </p>
        </GradientCard>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <TabsContent value="today">
          <CheckInList checkins={filteredCheckins(todayCheckins)} loading={loading} emptyMessage="No check-ins today yet" />
        </TabsContent>

        <TabsContent value="history">
          <div className="mb-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto border rounded-md px-3 py-2 text-sm bg-background"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <CheckInList checkins={filteredCheckins(monthCheckins)} loading={loading} emptyMessage={`No check-ins in ${months.find(m => m.value === selectedMonth)?.label || selectedMonth}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CheckInList({ checkins, loading, emptyMessage }: { checkins: CheckIn[]; loading: boolean; emptyMessage: string }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <GradientCard className="p-8 text-center">
        <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </GradientCard>
    );
  }

  return (
    <div className="space-y-2">
      {checkins.map(checkin => (
        <GradientCard key={checkin.id} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {checkin.profile?.avatar_url ? (
                  <img src={checkin.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {checkin.profile?.full_name || "Pet Owner"}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {checkin.profile?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {checkin.profile.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {format(new Date(checkin.checked_in_at), "h:mm a")}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(checkin.checked_in_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </GradientCard>
      ))}
    </div>
  );
}
