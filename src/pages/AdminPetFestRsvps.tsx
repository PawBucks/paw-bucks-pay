import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Search, Users, PawPrint, CalendarDays } from "lucide-react";
import { formatDateOnly } from "@/lib/timezone";

interface Rsvp {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  pet_count: number;
  pet_name: string;
  pet_breed: string | null;
  pet_birthday: string | null;
  created_at: string;
}

const RANGES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const AdminPetFestRsvps = () => {
  const [rows, setRows] = useState<Rsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [petFilter, setPetFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const load = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      const { data, error } = await supabase
        .from("petfest_rsvps")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("Failed to load PetFest RSVPs", error);
        toast.error("Could not load RSVPs");
      } else {
        setRows((data ?? []) as Rsvp[]);
      }
      setLoading(false);
    };
    load(true);

    const channel = supabase
      .channel("petfest-rsvps-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "petfest_rsvps" },
        () => load(),
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, []);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff =
      range === "all" ? null : Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (petFilter === "multi" && (r.pet_count ?? 1) < 2) return false;
      if (petFilter === "single" && (r.pet_count ?? 1) !== 1) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.phone, r.pet_name, r.pet_breed]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, range, petFilter]);

  const totalPets = useMemo(
    () => filtered.reduce((sum, r) => sum + (r.pet_count ?? 1), 0),
    [filtered],
  );

  const exportCsv = () => {
    if (!filtered.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Pet Count",
      "Pet Name",
      "Pet Breed",
      "Pet Birthday",
      "RSVP Date",
    ];
    const lines = [
      headers.join(","),
      ...filtered.map((r) =>
        [
          r.full_name,
          r.email,
          r.phone,
          r.pet_count,
          r.pet_name,
          r.pet_breed ?? "",
          r.pet_birthday ? formatDateOnly(r.pet_birthday) : "",
          new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }),
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petfest-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} RSVP${filtered.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="PetFest RSVPs | PawBucks Admin" noIndex />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link to="/admin/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">PetFest RSVPs</h1>
            <p className="text-sm text-muted-foreground">
              Registrations for PetFest 2027 — March 20, 2027, West LA
            </p>
          </div>
          <Button onClick={exportCsv} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> RSVPs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PawPrint className="w-4 h-4" /> Pets Attending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalPets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Latest RSVP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">
                {filtered[0]
                  ? new Date(filtered[0].created_at).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, email, phone, pet…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={petFilter} onValueChange={setPetFilter}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pet counts</SelectItem>
                  <SelectItem value="single">1 pet</SelectItem>
                  <SelectItem value="multi">2+ pets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">No RSVPs match your filters.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {filtered.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{r.full_name}</p>
                        <Badge variant="secondary">{r.pet_count} pet{r.pet_count === 1 ? "" : "s"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{r.email}</p>
                      <p className="text-sm text-muted-foreground">{r.phone}</p>
                      <p className="text-sm">
                        {r.pet_name}
                        {r.pet_breed ? ` · ${r.pet_breed}` : ""}
                        {r.pet_birthday ? ` · ${formatDateOnly(r.pet_birthday)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-3 font-medium">Name</th>
                        <th className="py-2 pr-3 font-medium">Email</th>
                        <th className="py-2 pr-3 font-medium">Phone</th>
                        <th className="py-2 pr-3 font-medium">Pets</th>
                        <th className="py-2 pr-3 font-medium">Pet</th>
                        <th className="py-2 pr-3 font-medium">Breed</th>
                        <th className="py-2 pr-3 font-medium">Pet Birthday</th>
                        <th className="py-2 font-medium">RSVP Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{r.full_name}</td>
                          <td className="py-2 pr-3 break-all">{r.email}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.phone}</td>
                          <td className="py-2 pr-3">{r.pet_count}</td>
                          <td className="py-2 pr-3">{r.pet_name}</td>
                          <td className="py-2 pr-3">{r.pet_breed || "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {r.pet_birthday ? formatDateOnly(r.pet_birthday) : "—"}
                          </td>
                          <td className="py-2 whitespace-nowrap text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("en-US", {
                              timeZone: "America/New_York",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPetFestRsvps;
