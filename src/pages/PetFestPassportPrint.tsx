import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/logo.png";
import "./PetFest.css";

interface Booth {
  id: string;
  name: string;
  booth_number: string;
  sponsor_name: string;
  pawbucks_reward: number;
}

const PetFestPassportPrint = () => {
  const { data: settings } = useQuery({
    queryKey: ["petfest-passport-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_settings")
        .select("event_label, required_stamps, completion_bonus_pawbucks")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["petfest-passport-booths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_booths")
        .select("id, name, booth_number, sponsor_name, pawbucks_reward")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as Booth[];
    },
  });

  const eventLabel = settings?.event_label || "PetFest";

  return (
    <div className="petfest">
      <SEO
        title="Printable PetFest Passport"
        description="Print your PetFest Passport, collect a stamp at every participating booth and turn it in at PawBucks HQ to claim your PawBucks."
        canonical="https://pawbucks.app/petfest/passport/print"
        noIndex
      />

      <section className="pf-form-section">
        <div className="wrap">
          <div className="pf-print-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Print this passport
            </button>
            <Link className="btn btn-secondary" to="/petfest/passport">
              Use the digital passport
            </Link>
          </div>

          <div className="pf-print-sheet">
            <header className="pf-print-head">
              <img src={brandLogo} alt="PawBucks" className="pf-print-logo" />
              <div>
                <h1>{eventLabel} Passport</h1>
                <p>Collect a stamp at each booth below, then turn this in at PawBucks HQ to claim your PawBucks.</p>
              </div>
            </header>

            <div className="pf-print-fields">
              <div>
                <span>Name</span>
                <i />
              </div>
              <div>
                <span>Email on your PawBucks account</span>
                <i />
              </div>
              <div>
                <span>Pet's name</span>
                <i />
              </div>
            </div>

            <div className="pf-print-grid">
              {booths.map((booth) => (
                <div className="pf-print-box" key={booth.id}>
                  <span className="pf-print-box-title">{booth.name}</span>
                  {booth.booth_number && <span className="pf-print-box-sub">Booth {booth.booth_number}</span>}
                  <span className="pf-print-box-stamp">Stamp here</span>
                  <span className="pf-print-box-reward">{booth.pawbucks_reward.toLocaleString()} PawBucks</span>
                </div>
              ))}
              {booths.length === 0 && (
                <p className="pf-passport-hint">Participating booths are announced closer to the festival.</p>
              )}
            </div>

            <footer className="pf-print-foot">
              <strong>
                {settings?.required_stamps ?? booths.length} stamps ={" "}
                {(settings?.completion_bonus_pawbucks ?? 0).toLocaleString()} PawBucks completion bonus
              </strong>
              <span>
                PawBucks HQ staff verify stamps and credit your wallet on the spot. One passport per PawBucks account.
              </span>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PetFestPassportPrint;
