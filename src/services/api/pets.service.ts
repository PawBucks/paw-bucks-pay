import { supabase, ServiceResult, ServiceListResult } from "./base.service";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type PetProfile = Tables<"pet_profiles">;
type PetProfileInsert = TablesInsert<"pet_profiles">;
type PetProfileUpdate = TablesUpdate<"pet_profiles">;
type MedicalRecord = Tables<"pet_medical_records">;
type MedicalVisit = Tables<"pet_medical_visits">;

export const petsService = {
  async getByUserId(userId: string): Promise<ServiceListResult<PetProfile>> {
    const { data, error } = await supabase
      .from("pet_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async getById(petId: string): Promise<ServiceResult<PetProfile>> {
    const { data, error } = await supabase
      .from("pet_profiles")
      .select("*")
      .eq("id", petId)
      .maybeSingle();
    return { data, error };
  },

  async create(pet: PetProfileInsert): Promise<ServiceResult<PetProfile>> {
    const { data, error } = await supabase
      .from("pet_profiles")
      .insert(pet)
      .select()
      .single();
    return { data, error };
  },

  async update(petId: string, updates: PetProfileUpdate): Promise<ServiceResult<PetProfile>> {
    const { data, error } = await supabase
      .from("pet_profiles")
      .update(updates)
      .eq("id", petId)
      .select()
      .single();
    return { data, error };
  },

  async delete(petId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from("pet_profiles")
      .delete()
      .eq("id", petId);
    return { error };
  },

  // Medical Records
  async getMedicalRecords(petId: string): Promise<ServiceListResult<MedicalRecord>> {
    const { data, error } = await supabase
      .from("pet_medical_records")
      .select("*")
      .eq("pet_id", petId)
      .order("record_date", { ascending: false });
    return { data: data || [], error };
  },

  async getMedicalVisits(petId: string): Promise<ServiceListResult<MedicalVisit>> {
    const { data, error } = await supabase
      .from("pet_medical_visits")
      .select("*")
      .eq("pet_id", petId)
      .order("visit_date", { ascending: false });
    return { data: data || [], error };
  },

  // Pet Email
  async getPetEmailAddress(petId: string): Promise<ServiceResult<{ email_address: string }>> {
    const { data, error } = await supabase
      .from("pet_email_addresses")
      .select("email_address")
      .eq("pet_id", petId)
      .eq("is_active", true)
      .maybeSingle();
    return { data, error };
  },

  // Inbound Documents
  async getInboundDocuments(petId: string): Promise<ServiceListResult<any>> {
    const { data, error } = await supabase
      .from("pet_inbound_documents")
      .select("*")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },
};
