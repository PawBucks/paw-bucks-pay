import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Loader2, Mail, X } from "lucide-react";
import { PETFEST_VENDOR_TIERS } from "@/lib/petfestVendorTiers";

interface VendorApplication {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  business_category: string | null;
  tier: string;
  booth_count: number;
  power_needed: boolean;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const tierLabel = (tier: string) =>
  PETFEST_VENDOR_TIERS.find((t) => t.id === tier)?.name ?? tier;

const statusVariant = (status: string) =>
  status === "approved"
    ? "default"
    : status === "rejected"
      ? "destructive"
      : status === "waitlisted"
        ? "outline"
        : "secondary";

const AdminPetFestVendors = () => {
  const [rows, setRows] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("petfest_vendor_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load vendor applications", error);
      toast.error("Could not load vendor applications");
    } else {
      setRows((data ?? []) as VendorApplication[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (
    app: VendorApplication,
    status: "approved" | "rejected" | "waitlisted",
  ) => {
    setBusyId(app.id);
    try {
      const { data, error } = await supabase.functions.invoke("petfest-vendor-notify", {
        body: {
          applicationId: app.id,
          event: "decision",
          status,
          adminNotes: notes[app.id]?.trim() || undefined,
        },
      });
      if (error) throw error;
      toast.success(
        (data as { sent?: boolean })?.sent
          ? `Application ${status} — applicant notified by email`
          : `Application ${status}, but the email could not be sent`,
      );
      await load();
    } catch (err) {
      console.error("Vendor decision failed", err);
      toast.error("Could not update this application");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="PetFest Vendor Applications | Admin"
        description="Review and decide on PetFest vendor applications."
        noindex
      />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link
          to="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
        <h1 className="mb-6 text-2xl font-bold">PetFest Vendor Applications</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No vendor applications yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((app) => (
              <Card key={app.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{app.business_name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {app.contact_name} · {app.email} · {app.phone}
                    </p>
                  </div>
                  <Badge variant={statusVariant(app.status)} className="capitalize">
                    {app.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Tier:</span> {tierLabel(app.tier)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Booths:</span> {app.booth_count}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Power needed:</span>{" "}
                      {app.power_needed ? "Yes" : "No"}
                    </p>
                    <p className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(app.created_at).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                      })}
                    </p>
                    {app.business_category && (
                      <p>
                        <span className="text-muted-foreground">Category:</span>{" "}
                        {app.business_category}
                      </p>
                    )}
                    {app.website && (
                      <p className="truncate">
                        <span className="text-muted-foreground">Website:</span> {app.website}
                      </p>
                    )}
                  </div>

                  {app.notes && (
                    <p className="rounded-md bg-muted p-3 text-sm">{app.notes}</p>
                  )}
                  {app.admin_notes && (
                    <p className="text-sm text-muted-foreground">
                      Notes sent to applicant: {app.admin_notes}
                    </p>
                  )}

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Optional note to include in the applicant's email"
                      value={notes[app.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                      }
                      maxLength={2000}
                      rows={2}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === app.id}
                        onClick={() => decide(app, "approved")}
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === app.id}
                        onClick={() => decide(app, "waitlisted")}
                      >
                        <Mail className="mr-1 h-4 w-4" /> Waitlist
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === app.id}
                        onClick={() => decide(app, "rejected")}
                      >
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPetFestVendors;
