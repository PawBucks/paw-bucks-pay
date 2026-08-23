import { supabase, ServiceResult } from"./base.service";
import type { User, Session } from"@supabase/supabase-js";
import { readPetFestBonus, trackPetFestBonusEvent } from"@/lib/petfestBonus";

export const authService = {
 async getSession(): Promise<ServiceResult<Session>> {
 const { data, error } = await supabase.auth.getSession();
 return { data: data.session, error };
 },

 async getUser(): Promise<ServiceResult<User>> {
 const { data, error } = await supabase.auth.getUser();
 return { data: data.user, error };
 },

 async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
 // Funnel analytics: a PetFest bonus reservation is pending for this browser.
 if (readPetFestBonus()) {
 trackPetFestBonusEvent("signup_started", { email });
 }
 const { data, error } = await supabase.auth.signUp({
 email,
 password,
 options: { data: metadata },
 });
 return { data, error };
 },

 async signIn(email: string, password: string) {
 const { data, error } = await supabase.auth.signInWithPassword({
 email,
 password,
 });
 return { data, error };
 },

 async signOut() {
 const { error } = await supabase.auth.signOut();
 return { error };
 },

 async resetPassword(email: string, redirectTo?: string) {
 const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
 redirectTo,
 });
 return { data, error };
 },

 async updatePassword(password: string) {
 const { data, error } = await supabase.auth.updateUser({ password });
 return { data, error };
 },

 async exchangeCodeForSession(code: string) {
 const { data, error } = await supabase.auth.exchangeCodeForSession(code);
 return { data, error };
 },

 async verifyOtp(params: { token_hash: string; type:"recovery" }) {
 const { data, error } = await supabase.auth.verifyOtp(params);
 return { data, error };
 },

 onAuthStateChange(callback: (event: string, session: Session | null) => void) {
 return supabase.auth.onAuthStateChange(callback);
 },
};
