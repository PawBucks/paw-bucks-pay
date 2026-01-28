// Vet Portal EMR Types
export type SOAPNoteStatus = 'draft' | 'finalized' | 'amended';
export type ConsentStatus = 'pending' | 'signed' | 'declined' | 'expired';
export type LabResultStatus = 'pending' | 'completed' | 'reviewed';
export type ImagingType = 'xray' | 'ultrasound' | 'mri' | 'ct_scan' | 'endoscopy' | 'other';

export interface PetAllergy {
  id: string;
  pet_id: string;
  vet_id: string | null;
  allergy_name: string;
  allergy_type: string;
  severity: string;
  reaction_description: string | null;
  first_observed_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurgicalNote {
  id: string;
  pet_id: string;
  vet_id: string;
  surgery_date: string;
  procedure_name: string;
  procedure_code: string | null;
  anesthesia_type: string | null;
  anesthesia_duration_minutes: number | null;
  pre_op_notes: string | null;
  operative_notes: string;
  post_op_notes: string | null;
  complications: string | null;
  outcome: string;
  follow_up_required: boolean;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SOAPNote {
  id: string;
  pet_id: string;
  vet_id: string;
  visit_date: string;
  subjective_chief_complaint: string;
  subjective_history: string | null;
  subjective_duration: string | null;
  subjective_owner_observations: string | null;
  objective_temperature: number | null;
  objective_weight: number | null;
  objective_heart_rate: number | null;
  objective_respiratory_rate: number | null;
  objective_body_condition_score: number | null;
  objective_physical_exam: string;
  objective_findings: string | null;
  assessment_primary_diagnosis: string;
  assessment_differential_diagnoses: string[] | null;
  assessment_prognosis: string | null;
  plan_treatment: string;
  plan_medications: string | null;
  plan_follow_up: string | null;
  plan_client_education: string | null;
  plan_referral: string | null;
  status: SOAPNoteStatus;
  finalized_at: string | null;
  amended_at: string | null;
  amendment_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id: string;
  pet_id: string;
  vet_id: string;
  soap_note_id: string | null;
  test_date: string;
  lab_name: string | null;
  test_type: string;
  test_category: string;
  results: Record<string, any>;
  result_summary: string | null;
  abnormal_flags: string[] | null;
  interpretation: string | null;
  file_url: string | null;
  status: LabResultStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImagingRecord {
  id: string;
  pet_id: string;
  vet_id: string;
  soap_note_id: string | null;
  imaging_date: string;
  imaging_type: ImagingType;
  body_region: string;
  views: string[] | null;
  indication: string;
  findings: string | null;
  interpretation: string | null;
  radiologist_notes: string | null;
  image_urls: string[];
  thumbnail_url: string | null;
  is_abnormal: boolean | null;
  follow_up_recommended: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentTemplate {
  id: string;
  vet_id: string;
  template_name: string;
  template_type: string;
  content: string;
  requires_witness: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentRequest {
  id: string;
  pet_id: string;
  vet_id: string;
  template_id: string | null;
  owner_id: string;
  consent_type: string;
  title: string;
  description: string;
  procedure_details: string | null;
  risks_disclosed: string | null;
  estimated_cost: number | null;
  cost_range_min: number | null;
  cost_range_max: number | null;
  status: ConsentStatus;
  signature_data: string | null;
  signed_name: string | null;
  signed_at: string | null;
  signer_ip_address: string | null;
  signer_user_agent: string | null;
  access_token: string;
  expires_at: string;
  sent_via: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  pet_profiles?: { name: string; type: string };
  profiles?: { full_name: string; email: string };
}

export interface Vaccination {
  id: string;
  pet_id: string;
  vet_id: string | null;
  vaccine_name: string;
  vaccine_type: string;
  manufacturer: string | null;
  lot_number: string | null;
  serial_number: string | null;
  administration_date: string;
  expiration_date: string | null;
  next_due_date: string | null;
  administration_site: string | null;
  route: string | null;
  dose: string | null;
  reaction_notes: string | null;
  administered_by: string | null;
  certificate_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EMRPatient {
  pet_id: string;
  pet_name: string;
  pet_type: string;
  pet_breed?: string;
  owner_id: string;
  owner_name: string;
  owner_email?: string;
  owner_phone?: string;
  last_visit?: string;
}
