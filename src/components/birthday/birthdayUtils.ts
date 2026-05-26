export const SPECIES_EMOJI: Record<string, string> = {
  cat: "🐱",
  dog: "🐶",
  other: "🐾",
};

export type BirthdayPet = {
  id: string;
  name: string;
  type?: string;
  breed?: string | null;
  birthday?: string | null;
  photo_url?: string | null;
};

export function getTodayBirthdays<T extends BirthdayPet>(pets: T[]): T[] {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const key = `${mm}-${dd}`;
  return pets.filter((p) => {
    if (!p.birthday) return false;
    // birthday stored as YYYY-MM-DD
    return p.birthday.slice(5, 10) === key;
  });
}

export function getAgeTurning(pet: BirthdayPet): number | null {
  if (!pet.birthday) return null;
  const year = parseInt(pet.birthday.slice(0, 4), 10);
  if (!year) return null;
  return new Date().getFullYear() - year;
}

export function getSpeciesEmoji(type?: string): string {
  if (!type) return "🐾";
  return SPECIES_EMOJI[type.toLowerCase()] || "🐾";
}