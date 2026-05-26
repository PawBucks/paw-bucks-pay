import { useEffect, useState } from "react";
import { BirthdayPet, getAgeTurning, getSpeciesEmoji } from "./birthdayUtils";

export function BirthdayOverlay({
  pets,
  onDismiss,
}: {
  pets: BirthdayPet[];
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 3800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      onClick={close}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center px-6 text-center cursor-pointer transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background:
          "radial-gradient(circle at center, hsl(var(--background) / 0.92), hsl(var(--background) / 0.98))",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="text-7xl mb-4 animate-bounce">🎂</div>
      {pets.length === 1 ? (
        <>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Happy Birthday, {pets[0].name}!
          </h2>
          <p className="text-muted-foreground text-lg">
            {getSpeciesEmoji(pets[0].type)}
            {getAgeTurning(pets[0]) != null && ` Turning ${getAgeTurning(pets[0])} today`}
          </p>
        </>
      ) : (
        <>
          <h2 className="text-3xl font-bold text-foreground mb-4">Double Birthday! 🎉</h2>
          <div className="flex gap-6 flex-wrap justify-center">
            {pets.map((p) => (
              <div key={p.id} className="flex flex-col items-center">
                <div className="text-4xl mb-1">{getSpeciesEmoji(p.type)}</div>
                <div className="font-semibold text-foreground">{p.name}</div>
                {getAgeTurning(p) != null && (
                  <div className="text-sm text-muted-foreground">Turns {getAgeTurning(p)}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-8 text-xs text-muted-foreground uppercase tracking-wider">
        Tap to continue
      </p>
    </div>
  );
}