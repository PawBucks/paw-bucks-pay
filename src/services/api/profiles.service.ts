import { supabase, ServiceResult, handleError } from"./base.service";
import type { Tables, TablesUpdate } from"@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;

export const profilesService = {
 async getById(userId: string): Promise<ServiceResult<Profile>> {
 const { data, error } = await supabase
 .from("profiles")
 .select("*")
 .eq("id", userId)
 .maybeSingle();
 return { data, error };
 },

 async getByEmail(email: string): Promise<ServiceResult<Profile>> {
 const { data, error } = await supabase
 .from("profiles")
 .select("*")
 .eq("email", email)
 .maybeSingle();
 return { data, error };
 },

 async getByReferralCode(code: string): Promise<ServiceResult<Profile>> {
 const { data, error } = await supabase
 .from("profiles")
 .select("*")
 .eq("referral_code", code)
 .maybeSingle();
 return { data, error };
 },

 async update(userId: string, updates: ProfileUpdate): Promise<ServiceResult<Profile>> {
 const { data, error } = await supabase
 .from("profiles")
 .update(updates)
 .eq("id", userId)
 .select()
 .single();
 return { data, error };
 },

 async checkUserRole(userId: string, role:"admin" |"user"): Promise<boolean> {
 const { data } = await supabase.rpc("has_role", {
 _user_id: userId,
 _role: role,
 });
 return !!data;
 },
};
