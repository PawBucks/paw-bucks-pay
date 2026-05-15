import { Formatters } from "@/utils/formatters";

/** Distance between two lat/lon points in miles (Haversine). */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth radius (miles)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(distance?: number): string {
  if (distance === undefined || distance === null) return "";
  if (distance < 0.1) return "< 0.1 mi";
  if (distance < 10) return `${Formatters.decimal(distance, 1)} mi`;
  return `${Math.round(distance)} mi`;
}