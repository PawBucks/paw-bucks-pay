import { supabase, ServiceResult } from "./base.service";
import type { User, Session } from "@supabase/supabase-js";

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

  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
