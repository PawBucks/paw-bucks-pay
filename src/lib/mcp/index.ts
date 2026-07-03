import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchMerchants from "./tools/search-merchants";
import myPawBucksBalance from "./tools/my-pawbucks-balance";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pawbucks-mcp",
  title: "PawBucks",
  version: "0.1.0",
  instructions:
    "Tools for the PawBucks pet rewards platform. Use `search_merchants` to find local pet businesses, and `my_pawbucks_balance` to read the signed-in user's wallet balance in PawBucks and USD.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchMerchants, myPawBucksBalance],
});