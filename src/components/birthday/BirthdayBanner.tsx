import { useNavigate } from "react-router-dom";
import { X, Share2, PawPrint, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BirthdayPet, getAgeTurning, getSpeciesEmoji } from "./birthdayUtils";

export function BirthdayBanner({
  pets,
  onDismiss,
}: {
  pets: BirthdayPet[];
  onDismiss: () => void;
}) {
  const navigate = useNavigate();

  const handleShare = async () => {
    const names = pets.map((p) => p.name).join(" & ");
    const text =
      pets.length === 1
        ? `${pets[0].name} is celebrating a birthday today! 🎂🐾`
        : `${names} are both celebrating birthdays today! 🎉🐾`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Happy Birthday ${names}!`,
          text,
          url: "https://pawbucks.app",
        });
      } else {
        await navigator.clipboard.writeText(`${text} https://pawbucks.app`);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-4 shadow-[var(--shadow-medium)]">
      <button
        onClick={onDismiss}
        aria-label="Dismiss birthday banner"
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-background/50 transition-colors text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 mb-3 pr-6">
        <div className="text-3xl">🎂</div>
        <div>
          <h3 className="font-semibold text-foreground">
            {pets.length > 1 ? "Birthdays Today!" : "Birthday Today!"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {pets.length === 1
              ? `Happy Birthday, ${pets[0].name}! ${getSpeciesEmoji(pets[0].type)}`
              : `${pets.map((p) => p.name).join(" & ")} are celebrating! 🎉`}
          </p>
        </div>
      </div>

      <div className={`flex gap-2 mb-3 ${pets.length > 2 ? "flex-wrap" : ""}`}>
        {pets.map((p) => (
          <div
            key={p.id}
            className="flex-1 min-w-[140px] flex items-center gap-3 rounded-xl bg-card/60 border border-border p-3"
          >
            <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl shrink-0">
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span>{getSpeciesEmoji(p.type)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{p.name}</p>
              {p.breed && (
                <p className="text-xs text-muted-foreground truncate">{p.breed}</p>
              )}
              {getAgeTurning(p) != null && (
                <p className="text-xs text-primary inline-flex items-center gap-1 mt-0.5">
                  <PartyPopper className="h-3 w-3" />
                  Turns {getAgeTurning(p)} today
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => navigate("/discover")}
        >
          <PawPrint className="h-4 w-4 mr-1" />
          Treat {pets.length === 1 ? pets[0].name : "them"} today
        </Button>
        <Button size="sm" variant="outline" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
      </div>
    </div>
  );
}