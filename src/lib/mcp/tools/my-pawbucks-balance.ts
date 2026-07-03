import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

function supabaseFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "my_pawbucks_balance",
  title: "Get my PawBucks balance",
  description: "Return the signed-in user's PawBucks wallet balance and USD equivalent.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseFor(ctx);
    const { data, error } = await sb
      .from("wallets")
      .select("balance")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const balance = Number(data?.balance ?? 0);
    const usd = (balance / 1000).toFixed(2);
    return {
      content: [{ type: "text", text: `Balance: ${balance} PawBucks ($${usd} USD)` }],
      structuredContent: { pawbucks: balance, usd: Number(usd) },
    };
  },
});