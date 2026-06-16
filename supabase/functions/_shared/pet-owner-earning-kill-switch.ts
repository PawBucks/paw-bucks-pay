// Global kill switch: SuperAdmin can disable pet-owner PawBucks earning platform-wide.
// Reads the `pet_owner_pawbucks_earning_enabled` row from `platform_settings`.
// Defaults to TRUE (enabled) if the setting is missing or unreadable, so a
// failed lookup never silently disables the program.
export async function isPetOwnerPawBucksEarningEnabled(
  supabaseAdmin: any
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "pet_owner_pawbucks_earning_enabled")
      .maybeSingle();
    if (!data) return true;
    const v: any = data.value;
    if (v == null) return true;
    if (v === true || v === "true") return true;
    if (v === false || v === "false") return false;
    if (typeof v === "object" && "enabled" in v) return v.enabled !== false;
    return true;
  } catch (_err) {
    return true;
  }
}