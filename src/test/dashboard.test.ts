import { describe, it, expect, vi, beforeEach } from"vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
 supabase: {
 from: vi.fn(() => ({
 select: vi.fn().mockReturnThis(),
 eq: vi.fn().mockReturnThis(),
 single: vi.fn().mockResolvedValue({ data: { user_type:"pet_owner", full_name:"Test User" }, error: null }),
 maybeSingle: vi.fn().mockResolvedValue({ data: { balance: 5000 }, error: null }),
 order: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 not: vi.fn().mockReturnThis(),
 throwOnError: vi.fn().mockResolvedValue({ data: { user_type:"pet_owner", full_name:"Test User" }, error: null }),
 })),
 auth: {
 getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
 onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
 },
 channel: vi.fn(() => ({
 on: vi.fn().mockReturnThis(),
 subscribe: vi.fn().mockReturnThis(),
 })),
 },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
 useAuth: () => ({
 user: { id:"test-user-id", email:"test@example.com" },
 session: {},
 loading: false,
 signOut: vi.fn(),
 }),
}));

// Mock useSharedAccount
vi.mock("@/hooks/useSharedAccount", () => ({
 useSharedAccount: () => ({
 isLoading: false,
 isSharedMember: false,
 ownerId: null,
 ownerName: null,
 }),
 getEffectiveWalletUserId: (userId: string | undefined) => userId,
}));

describe("useDashboardData hook", () => {
 it("should export useDashboardData function", async () => {
 const module = await import("@/hooks/useDashboardData");
 expect(module.useDashboardData).toBeDefined();
 expect(typeof module.useDashboardData).toBe("function");
 });
});

describe("Dashboard page module", () => {
 it("should export default component", async () => {
 // Just verify the module can be imported without errors
 const module = await import("@/pages/Dashboard");
 expect(module.default).toBeDefined();
 });
});
