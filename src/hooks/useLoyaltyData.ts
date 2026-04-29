import { useQuery } from"@tanstack/react-query";
import { loyaltyService } from"@/services/api/loyalty.service";

export function useLoyaltySummary(userId: string | undefined) {
 return useQuery({
 queryKey: ["loyalty-summary", userId],
 queryFn: () => loyaltyService.getLoyaltySummary(userId!),
 enabled: !!userId,
 staleTime: 30000, // 30 seconds
 });
}

export function useTierDefinitions() {
 return useQuery({
 queryKey: ["tier-definitions"],
 queryFn: () => loyaltyService.getTierDefinitions(),
 staleTime: 300000, // 5 minutes - these rarely change
 });
}

export function useUserTierStatus(userId: string | undefined) {
 return useQuery({
 queryKey: ["user-tier-status", userId],
 queryFn: () => loyaltyService.getUserTierStatus(userId!),
 enabled: !!userId,
 });
}

export function useUserMilestones(userId: string | undefined) {
 return useQuery({
 queryKey: ["user-milestones", userId],
 queryFn: () => loyaltyService.getUserMilestones(userId!),
 enabled: !!userId,
 });
}

export function useUserCredits(userId: string | undefined) {
 return useQuery({
 queryKey: ["user-credits", userId],
 queryFn: () => loyaltyService.getUserCredits(userId!),
 enabled: !!userId,
 });
}

export function useUserPersonalityPerks(userId: string | undefined) {
 return useQuery({
 queryKey: ["user-personality-perks", userId],
 queryFn: () => loyaltyService.getUserPersonalityPerks(userId!),
 enabled: !!userId,
 });
}

export function useBadgeCollections() {
 return useQuery({
 queryKey: ["badge-collections"],
 queryFn: () => loyaltyService.getBadgeCollections(),
 staleTime: 300000, // 5 minutes
 });
}

export function useUserStreaks(userId: string | undefined) {
 return useQuery({
 queryKey: ["user-streaks", userId],
 queryFn: () => loyaltyService.getUserStreaks(userId!),
 enabled: !!userId,
 });
}

export function useLoyaltyWarnings(userId: string | undefined) {
 return useQuery({
 queryKey: ["loyalty-warnings", userId],
 queryFn: () => loyaltyService.getActiveWarnings(userId!),
 enabled: !!userId,
 refetchInterval: 60000, // Check every minute for new warnings
 });
}
