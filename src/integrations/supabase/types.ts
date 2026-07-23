export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abandoned_cart_notifications: {
        Row: {
          cart_id: string
          id: string
          items_snapshot: Json | null
          notification_type: string
          sent_at: string
          total_value_pawbucks: number | null
          total_value_usd: number | null
          user_id: string
        }
        Insert: {
          cart_id: string
          id?: string
          items_snapshot?: Json | null
          notification_type?: string
          sent_at?: string
          total_value_pawbucks?: number | null
          total_value_usd?: number | null
          user_id: string
        }
        Update: {
          cart_id?: string
          id?: string
          items_snapshot?: Json | null
          notification_type?: string
          sent_at?: string
          total_value_pawbucks?: number | null
          total_value_usd?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_cart_notifications_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "shopping_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          invitation_id: string
          merchant_id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          invitation_id: string
          merchant_id: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invitation_id?: string
          merchant_id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_activity_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "accountant_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_activity_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_activity_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_expense_notes: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          invitation_id: string
          note: string
          suggested_category: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          invitation_id: string
          note: string
          suggested_category?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          invitation_id?: string
          note?: string
          suggested_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_expense_notes_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "merchant_tax_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_expense_notes_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "accountant_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_invitations: {
        Row: {
          accepted_at: string | null
          access_token: string
          accountant_email: string
          accountant_name: string | null
          created_at: string
          expires_at: string
          id: string
          invited_at: string
          last_accessed_at: string | null
          merchant_id: string
          permissions: Json
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_token: string
          accountant_email: string
          accountant_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_at?: string
          last_accessed_at?: string | null
          merchant_id: string
          permissions?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_token?: string
          accountant_email?: string
          accountant_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_at?: string
          last_accessed_at?: string | null
          merchant_id?: string
          permissions?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_invitations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invoice_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          display_order: number
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          display_order?: number
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "admin_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method: string
          recorded_by: string
          reference_number: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          recorded_by: string
          reference_number?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          recorded_by?: string
          reference_number?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "admin_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invoices: {
        Row: {
          access_token: string
          amount_due: number | null
          amount_paid: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          discount_amount: number | null
          due_date: string
          id: string
          invoice_number: string
          invoice_type: string | null
          issue_date: string
          notes: string | null
          paid_at: string | null
          recipient_email: string | null
          recipient_id: string
          recipient_name: string
          recipient_type: string
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          title: string | null
          total: number
          updated_at: string
        }
        Insert: {
          access_token?: string
          amount_due?: number | null
          amount_paid?: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_number: string
          invoice_type?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          recipient_email?: string | null
          recipient_id: string
          recipient_name: string
          recipient_type: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          amount_due?: number | null
          amount_paid?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          recipient_email?: string | null
          recipient_id?: string
          recipient_name?: string
          recipient_type?: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_soap_drafts: {
        Row: {
          ai_objective: string | null
          ai_subjective: string | null
          ai_suggested_assessment: string | null
          ai_suggested_plan: string | null
          applied_at: string | null
          audio_duration_seconds: number | null
          audio_url: string | null
          created_at: string
          extracted_observations: Json | null
          extracted_symptoms: Json | null
          extracted_vitals: Json | null
          id: string
          model_used: string | null
          pet_id: string
          processing_time_ms: number | null
          soap_note_id: string | null
          status: string
          transcription: string | null
          transcription_confidence: number | null
          updated_at: string
          vet_id: string
        }
        Insert: {
          ai_objective?: string | null
          ai_subjective?: string | null
          ai_suggested_assessment?: string | null
          ai_suggested_plan?: string | null
          applied_at?: string | null
          audio_duration_seconds?: number | null
          audio_url?: string | null
          created_at?: string
          extracted_observations?: Json | null
          extracted_symptoms?: Json | null
          extracted_vitals?: Json | null
          id?: string
          model_used?: string | null
          pet_id: string
          processing_time_ms?: number | null
          soap_note_id?: string | null
          status?: string
          transcription?: string | null
          transcription_confidence?: number | null
          updated_at?: string
          vet_id: string
        }
        Update: {
          ai_objective?: string | null
          ai_subjective?: string | null
          ai_suggested_assessment?: string | null
          ai_suggested_plan?: string | null
          applied_at?: string | null
          audio_duration_seconds?: number | null
          audio_url?: string | null
          created_at?: string
          extracted_observations?: Json | null
          extracted_symptoms?: Json | null
          extracted_vitals?: Json | null
          id?: string
          model_used?: string | null
          pet_id?: string
          processing_time_ms?: number | null
          soap_note_id?: string | null
          status?: string
          transcription?: string | null
          transcription_confidence?: number | null
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_soap_drafts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_soap_note_id_fkey"
            columns: ["soap_note_id"]
            isOneToOne: false
            referencedRelation: "pet_soap_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_soap_drafts_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_id: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      auth_security_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      badge_collections: {
        Row: {
          completion_reward_description: string | null
          completion_reward_type: string | null
          completion_reward_value: number | null
          created_at: string
          description: string
          emoji: string
          end_date: string | null
          id: string
          is_active: boolean
          is_seasonal: boolean
          name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          completion_reward_description?: string | null
          completion_reward_type?: string | null
          completion_reward_value?: number | null
          created_at?: string
          description: string
          emoji: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_seasonal?: boolean
          name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          completion_reward_description?: string | null
          completion_reward_type?: string | null
          completion_reward_value?: number | null
          created_at?: string
          description?: string
          emoji?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_seasonal?: boolean
          name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      badge_promotion_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_promotion_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pet_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badge_promotion_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "badge_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_promotions: {
        Row: {
          badge_id: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_percentage: number
          duration_hours: number
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percentage: number
          duration_hours?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_percentage?: number
          duration_hours?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_promotions_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "guilt_badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intake_answers: {
        Row: {
          answer_text: string | null
          booking_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer_text?: string | null
          booking_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer_text?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intake_answers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "booking_intake_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intake_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          merchant_id: string
          options: Json | null
          question_text: string
          question_type: string
          service_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          merchant_id: string
          options?: Json | null
          question_text: string
          question_type?: string
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          merchant_id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intake_questions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_questions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_questions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_waitlist: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          merchant_id: string
          notes: string | null
          notified_at: string | null
          preferred_date: string
          preferred_time_end: string | null
          preferred_time_start: string | null
          service_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          notified_at?: string | null
          preferred_date: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          service_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          service_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_accounts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          brand_name: string
          business_type: string | null
          city: string | null
          company_size: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          country: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          industry_category: string | null
          invitation_claimed_at: string | null
          invitation_email: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          legal_business_name: string | null
          logo_url: string | null
          marketing_preferences: Json | null
          postal_code: string | null
          setup_completed_at: string | null
          social_links: Json | null
          state: string | null
          status: string
          tax_id: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
          year_founded: number | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brand_name: string
          business_type?: string | null
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          industry_category?: string | null
          invitation_claimed_at?: string | null
          invitation_email?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          legal_business_name?: string | null
          logo_url?: string | null
          marketing_preferences?: Json | null
          postal_code?: string | null
          setup_completed_at?: string | null
          social_links?: Json | null
          state?: string | null
          status?: string
          tax_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brand_name?: string
          business_type?: string | null
          city?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          industry_category?: string | null
          invitation_claimed_at?: string | null
          invitation_email?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          legal_business_name?: string | null
          logo_url?: string | null
          marketing_preferences?: Json | null
          postal_code?: string | null
          setup_completed_at?: string | null
          social_links?: Json | null
          state?: string | null
          status?: string
          tax_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Relationships: []
      }
      brand_campaign_auto_enroll_rules: {
        Row: {
          business_category: string | null
          campaign_id: string
          center_zip: string | null
          created_at: string
          enrolled_count: number
          id: string
          is_active: boolean
          max_merchants: number | null
          updated_at: string
          zip_radius_miles: number | null
        }
        Insert: {
          business_category?: string | null
          campaign_id: string
          center_zip?: string | null
          created_at?: string
          enrolled_count?: number
          id?: string
          is_active?: boolean
          max_merchants?: number | null
          updated_at?: string
          zip_radius_miles?: number | null
        }
        Update: {
          business_category?: string | null
          campaign_id?: string
          center_zip?: string | null
          created_at?: string
          enrolled_count?: number
          id?: string
          is_active?: boolean
          max_merchants?: number | null
          updated_at?: string
          zip_radius_miles?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_auto_enroll_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaign_daily_stats: {
        Row: {
          campaign_id: string
          checkins: number
          created_at: string
          date: string
          id: string
          pawbucks_distributed: number
          pawbucks_redeemed: number
          redemptions: number
          spend_usd: number
          unique_merchants: number
          unique_users: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          checkins?: number
          created_at?: string
          date: string
          id?: string
          pawbucks_distributed?: number
          pawbucks_redeemed?: number
          redemptions?: number
          spend_usd?: number
          unique_merchants?: number
          unique_users?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          checkins?: number
          created_at?: string
          date?: string
          id?: string
          pawbucks_distributed?: number
          pawbucks_redeemed?: number
          redemptions?: number
          spend_usd?: number
          unique_merchants?: number
          unique_users?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_daily_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaign_hourly_stats: {
        Row: {
          campaign_id: string
          checkins: number
          created_at: string
          hour_bucket: string
          id: string
          pawbucks_distributed: number
          pawbucks_redeemed: number
          redemptions: number
          spend_usd: number
          unique_merchants: number
          unique_users: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          checkins?: number
          created_at?: string
          hour_bucket: string
          id?: string
          pawbucks_distributed?: number
          pawbucks_redeemed?: number
          redemptions?: number
          spend_usd?: number
          unique_merchants?: number
          unique_users?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          checkins?: number
          created_at?: string
          hour_bucket?: string
          id?: string
          pawbucks_distributed?: number
          pawbucks_redeemed?: number
          redemptions?: number
          spend_usd?: number
          unique_merchants?: number
          unique_users?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_hourly_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaign_invitations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          invited_at: string
          merchant_id: string
          message: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          invited_at?: string
          merchant_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          merchant_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_invitations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_invitations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaign_join_requests: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          merchant_id: string
          message: string | null
          requested_at: string
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          response_message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          merchant_id: string
          message?: string | null
          requested_at?: string
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          merchant_id?: string
          message?: string | null
          requested_at?: string
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_join_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_join_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_join_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaign_merchants: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          joined_at: string | null
          merchant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          merchant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          merchant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_merchants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_merchants_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_merchants_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaigns: {
        Row: {
          admin_invoice_id: string | null
          auto_pause_threshold_pct: number | null
          auto_replenish_amount_usd: number | null
          auto_replenish_enabled: boolean
          auto_replenish_threshold: number | null
          brand_id: string
          budget_usd: number
          campaign_color: string | null
          campaign_logo_url: string | null
          created_at: string
          creative_cta: string | null
          creative_headline: string | null
          creative_subtext: string | null
          daily_spend_cap: number | null
          description: string | null
          end_date: string | null
          enforce_product_gate: boolean
          funded_at: string | null
          funding_method: string
          id: string
          last_auto_replenish_at: string | null
          last_guardrail_check_at: string | null
          min_purchase_usd: number
          name: string
          paused_reason: string | null
          pawbucks_per_checkin: number
          pawbucks_pool: number
          start_date: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          targeting_notes: string | null
          targeting_rules: Json
          total_checkins: number
          total_distributed: number
          total_redeemed: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          admin_invoice_id?: string | null
          auto_pause_threshold_pct?: number | null
          auto_replenish_amount_usd?: number | null
          auto_replenish_enabled?: boolean
          auto_replenish_threshold?: number | null
          brand_id: string
          budget_usd?: number
          campaign_color?: string | null
          campaign_logo_url?: string | null
          created_at?: string
          creative_cta?: string | null
          creative_headline?: string | null
          creative_subtext?: string | null
          daily_spend_cap?: number | null
          description?: string | null
          end_date?: string | null
          enforce_product_gate?: boolean
          funded_at?: string | null
          funding_method?: string
          id?: string
          last_auto_replenish_at?: string | null
          last_guardrail_check_at?: string | null
          min_purchase_usd?: number
          name: string
          paused_reason?: string | null
          pawbucks_per_checkin?: number
          pawbucks_pool?: number
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          targeting_notes?: string | null
          targeting_rules?: Json
          total_checkins?: number
          total_distributed?: number
          total_redeemed?: number
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          admin_invoice_id?: string | null
          auto_pause_threshold_pct?: number | null
          auto_replenish_amount_usd?: number | null
          auto_replenish_enabled?: boolean
          auto_replenish_threshold?: number | null
          brand_id?: string
          budget_usd?: number
          campaign_color?: string | null
          campaign_logo_url?: string | null
          created_at?: string
          creative_cta?: string | null
          creative_headline?: string | null
          creative_subtext?: string | null
          daily_spend_cap?: number | null
          description?: string | null
          end_date?: string | null
          enforce_product_gate?: boolean
          funded_at?: string | null
          funding_method?: string
          id?: string
          last_auto_replenish_at?: string | null
          last_guardrail_check_at?: string | null
          min_purchase_usd?: number
          name?: string
          paused_reason?: string | null
          pawbucks_per_checkin?: number
          pawbucks_pool?: number
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          targeting_notes?: string | null
          targeting_rules?: Json
          total_checkins?: number
          total_distributed?: number
          total_redeemed?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaigns_admin_invoice_id_fkey"
            columns: ["admin_invoice_id"]
            isOneToOne: false
            referencedRelation: "admin_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_payment_methods: {
        Row: {
          brand_id: string
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string
          id: string
          is_default: boolean
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_payment_methods_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      branded_pawbucks_activity: {
        Row: {
          actor_user_id: string | null
          amount: number
          batch_id: string | null
          campaign_id: string
          checkin_id: string | null
          created_at: string
          description: string | null
          id: string
          merchant_id: string | null
          source: string | null
          transaction_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          batch_id?: string | null
          campaign_id: string
          checkin_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string | null
          source?: string | null
          transaction_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          batch_id?: string | null
          campaign_id?: string
          checkin_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string | null
          source?: string | null
          transaction_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branded_pawbucks_activity_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branded_pawbucks_activity_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branded_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branded_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      branded_pawbucks_ledger: {
        Row: {
          balance: number
          campaign_id: string
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          campaign_id: string
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          campaign_id?: string
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branded_pawbucks_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_settings: {
        Row: {
          alert_threshold: number
          category: string
          created_at: string
          id: string
          is_active: boolean
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: number
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkin_followups: {
        Row: {
          answered_at: string | null
          attempt_number: number
          checkin_id: string
          created_at: string
          entity_name: string
          id: string
          merchant_id: string | null
          notified_at: string | null
          notify_at: string
          response: string | null
          status: string
          updated_at: string
          user_id: string
          vet_id: string | null
          visit_purpose: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_number?: number
          checkin_id: string
          created_at?: string
          entity_name: string
          id?: string
          merchant_id?: string | null
          notified_at?: string | null
          notify_at: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vet_id?: string | null
          visit_purpose?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_number?: number
          checkin_id?: string
          created_at?: string
          entity_name?: string
          id?: string
          merchant_id?: string | null
          notified_at?: string | null
          notify_at?: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vet_id?: string | null
          visit_purpose?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_followups_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_followups_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_followups_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_followups_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_followups_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          checked_in_at: string
          checkin_token: string
          created_at: string
          id: string
          merchant_id: string | null
          user_id: string
          vet_id: string | null
        }
        Insert: {
          checked_in_at?: string
          checkin_token: string
          created_at?: string
          id?: string
          merchant_id?: string | null
          user_id: string
          vet_id?: string | null
        }
        Update: {
          checked_in_at?: string
          checkin_token?: string
          created_at?: string
          id?: string
          merchant_id?: string | null
          user_id?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_payment_plans: {
        Row: {
          created_at: string | null
          id: string
          installment_amount: number
          installments: number
          next_due_date: string | null
          owner_id: string
          paid_installments: number | null
          slice_id: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          installment_amount: number
          installments?: number
          next_due_date?: string | null
          owner_id: string
          paid_installments?: number | null
          slice_id: string
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          installment_amount?: number
          installments?: number
          next_due_date?: string | null
          owner_id?: string
          paid_installments?: number | null
          slice_id?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_payment_plans_slice_id_fkey"
            columns: ["slice_id"]
            isOneToOne: false
            referencedRelation: "invoice_slices"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_recovery_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          details: Json | null
          id: string
          slice_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          slice_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          slice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_recovery_log_slice_id_fkey"
            columns: ["slice_id"]
            isOneToOne: false
            referencedRelation: "invoice_slices"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content: {
        Row: {
          content: Json
          content_type: string
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: Json
          content_type: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_id: string
          author_name: string
          author_photo_url: string | null
          author_role: Database["public"]["Enums"]["community_author_role"]
          created_at: string
          id: string
          post_id: string
          text: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_photo_url?: string | null
          author_role?: Database["public"]["Enums"]["community_author_role"]
          created_at?: string
          id?: string
          post_id: string
          text: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_photo_url?: string | null
          author_role?: Database["public"]["Enums"]["community_author_role"]
          created_at?: string
          id?: string
          post_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          author_name: string
          author_photo_url: string | null
          author_role: Database["public"]["Enums"]["community_author_role"]
          category: Database["public"]["Enums"]["community_category"]
          comments_count: number
          created_at: string
          id: string
          likes_count: number
          media_type: string | null
          media_url: string | null
          shares_count: number
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_photo_url?: string | null
          author_role?: Database["public"]["Enums"]["community_author_role"]
          category?: Database["public"]["Enums"]["community_category"]
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          shares_count?: number
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_photo_url?: string | null
          author_role?: Database["public"]["Enums"]["community_author_role"]
          category?: Database["public"]["Enums"]["community_category"]
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          shares_count?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reminder_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          reminder_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          reminder_id: string
          sent_at?: string | null
          status: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          reminder_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reminder_logs_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "compliance_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reminders: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          next_reminder_at: string | null
          pet_id: string
          push_enabled: boolean | null
          recurrence_months: number | null
          reminder_type: string
          sms_enabled: boolean | null
          title: string
          updated_at: string | null
          vet_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          next_reminder_at?: string | null
          pet_id: string
          push_enabled?: boolean | null
          recurrence_months?: number | null
          reminder_type: string
          sms_enabled?: boolean | null
          title: string
          updated_at?: string | null
          vet_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          next_reminder_at?: string | null
          pet_id?: string
          push_enabled?: boolean | null
          recurrence_months?: number | null
          reminder_type?: string
          sms_enabled?: boolean | null
          title?: string
          updated_at?: string | null
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reminders_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reminders_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reminders_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_bookings: {
        Row: {
          booking_date: string
          created_at: string
          id: string
          merchant_id: string | null
          notes: string | null
          status: string
          time_slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          id?: string
          merchant_id?: string | null
          notes?: string | null
          status?: string
          time_slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          id?: string
          merchant_id?: string | null
          notes?: string | null
          status?: string
          time_slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_bookings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_bookings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_tier_definitions: {
        Row: {
          annual_free_credit_value: number
          created_at: string
          description: string
          display_name: string
          emoji: string
          exclusive_perks: Json | null
          id: string
          min_badges_per_year: number
          min_cash_per_transaction: number
          min_consecutive_months: number
          min_transactions_per_year: number
          priority_offers: boolean
          reward_multiplier: number
          tier: Database["public"]["Enums"]["consumer_tier"]
          updated_at: string
        }
        Insert: {
          annual_free_credit_value?: number
          created_at?: string
          description: string
          display_name: string
          emoji: string
          exclusive_perks?: Json | null
          id?: string
          min_badges_per_year?: number
          min_cash_per_transaction?: number
          min_consecutive_months?: number
          min_transactions_per_year?: number
          priority_offers?: boolean
          reward_multiplier?: number
          tier: Database["public"]["Enums"]["consumer_tier"]
          updated_at?: string
        }
        Update: {
          annual_free_credit_value?: number
          created_at?: string
          description?: string
          display_name?: string
          emoji?: string
          exclusive_perks?: Json | null
          id?: string
          min_badges_per_year?: number
          min_cash_per_transaction?: number
          min_consecutive_months?: number
          min_transactions_per_year?: number
          priority_offers?: boolean
          reward_multiplier?: number
          tier?: Database["public"]["Enums"]["consumer_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      customer_punch_cards: {
        Row: {
          cards_completed: number
          created_at: string
          current_punches: number
          id: string
          merchant_id: string
          program_id: string
          total_punches_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cards_completed?: number
          created_at?: string
          current_punches?: number
          id?: string
          merchant_id: string
          program_id: string
          total_punches_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cards_completed?: number
          created_at?: string
          current_punches?: number
          id?: string
          merchant_id?: string
          program_id?: string
          total_punches_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_punch_cards_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_punch_cards_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_punch_cards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "merchant_loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_ai_analyses: {
        Row: {
          ai_anomalies_detected: Json | null
          ai_confidence_score: number | null
          ai_findings: Json
          ai_measurements: Json | null
          ai_recommendations: string | null
          ai_summary: string | null
          analysis_type: string
          anomaly_regions: Json | null
          created_at: string
          external_imaging_id: string | null
          external_lab_id: string | null
          id: string
          image_urls: string[] | null
          imaging_record_id: string | null
          lab_result_id: string | null
          model_used: string | null
          pet_id: string
          processing_time_ms: number | null
          reviewed_at: string | null
          severity_assessment: string | null
          status: string
          updated_at: string
          vet_additional_findings: string | null
          vet_agrees: boolean | null
          vet_corrections: string | null
          vet_id: string
        }
        Insert: {
          ai_anomalies_detected?: Json | null
          ai_confidence_score?: number | null
          ai_findings?: Json
          ai_measurements?: Json | null
          ai_recommendations?: string | null
          ai_summary?: string | null
          analysis_type: string
          anomaly_regions?: Json | null
          created_at?: string
          external_imaging_id?: string | null
          external_lab_id?: string | null
          id?: string
          image_urls?: string[] | null
          imaging_record_id?: string | null
          lab_result_id?: string | null
          model_used?: string | null
          pet_id: string
          processing_time_ms?: number | null
          reviewed_at?: string | null
          severity_assessment?: string | null
          status?: string
          updated_at?: string
          vet_additional_findings?: string | null
          vet_agrees?: boolean | null
          vet_corrections?: string | null
          vet_id: string
        }
        Update: {
          ai_anomalies_detected?: Json | null
          ai_confidence_score?: number | null
          ai_findings?: Json
          ai_measurements?: Json | null
          ai_recommendations?: string | null
          ai_summary?: string | null
          analysis_type?: string
          anomaly_regions?: Json | null
          created_at?: string
          external_imaging_id?: string | null
          external_lab_id?: string | null
          id?: string
          image_urls?: string[] | null
          imaging_record_id?: string | null
          lab_result_id?: string | null
          model_used?: string | null
          pet_id?: string
          processing_time_ms?: number | null
          reviewed_at?: string | null
          severity_assessment?: string | null
          status?: string
          updated_at?: string
          vet_additional_findings?: string | null
          vet_agrees?: boolean | null
          vet_corrections?: string | null
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_ai_analyses_external_imaging_id_fkey"
            columns: ["external_imaging_id"]
            isOneToOne: false
            referencedRelation: "external_imaging_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_external_lab_id_fkey"
            columns: ["external_lab_id"]
            isOneToOne: false
            referencedRelation: "external_lab_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_imaging_record_id_fkey"
            columns: ["imaging_record_id"]
            isOneToOne: false
            referencedRelation: "pet_imaging_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_lab_result_id_fkey"
            columns: ["lab_result_id"]
            isOneToOne: false
            referencedRelation: "pet_lab_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_ai_analyses_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_payments: {
        Row: {
          amount: number
          application_fee: number
          connected_account_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          last_error: string | null
          merchant_id: string | null
          metadata: Json | null
          pawbucks_earned: number | null
          status: string
          stripe_payment_intent_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          application_fee: number
          connected_account_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          last_error?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          pawbucks_earned?: number | null
          status?: string
          stripe_payment_intent_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          application_fee?: number
          connected_account_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          last_error?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          pawbucks_earned?: number | null
          status?: string
          stripe_payment_intent_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_payments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_payments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json | null
          recipient: string | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json | null
          recipient?: string | null
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json | null
          recipient?: string | null
          source?: string
        }
        Relationships: []
      }
      external_imaging_results: {
        Row: {
          body_part: string | null
          created_at: string
          dicom_viewer_url: string | null
          emr_imaging_id: string | null
          external_patient_id: string | null
          external_study_id: string
          findings: Json | null
          id: string
          image_count: number | null
          is_reviewed: boolean | null
          lab_integration_id: string | null
          lab_vendor: string
          linked_to_emr: boolean | null
          modality: string
          notes: string | null
          pet_id: string | null
          radiologist_report: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          study_date: string
          study_description: string | null
          thumbnail_url: string | null
          updated_at: string
          vet_id: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          dicom_viewer_url?: string | null
          emr_imaging_id?: string | null
          external_patient_id?: string | null
          external_study_id: string
          findings?: Json | null
          id?: string
          image_count?: number | null
          is_reviewed?: boolean | null
          lab_integration_id?: string | null
          lab_vendor: string
          linked_to_emr?: boolean | null
          modality: string
          notes?: string | null
          pet_id?: string | null
          radiologist_report?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          study_date: string
          study_description?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          vet_id: string
        }
        Update: {
          body_part?: string | null
          created_at?: string
          dicom_viewer_url?: string | null
          emr_imaging_id?: string | null
          external_patient_id?: string | null
          external_study_id?: string
          findings?: Json | null
          id?: string
          image_count?: number | null
          is_reviewed?: boolean | null
          lab_integration_id?: string | null
          lab_vendor?: string
          linked_to_emr?: boolean | null
          modality?: string
          notes?: string | null
          pet_id?: string | null
          radiologist_report?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          study_date?: string
          study_description?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_imaging_results_emr_imaging_id_fkey"
            columns: ["emr_imaging_id"]
            isOneToOne: false
            referencedRelation: "pet_imaging_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_lab_integration_id_fkey"
            columns: ["lab_integration_id"]
            isOneToOne: false
            referencedRelation: "vet_lab_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imaging_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      external_lab_results: {
        Row: {
          abnormal_flags: string[] | null
          created_at: string
          emr_lab_result_id: string | null
          external_order_id: string
          external_patient_id: string | null
          has_abnormal_values: boolean | null
          id: string
          is_reviewed: boolean | null
          lab_integration_id: string | null
          lab_vendor: string
          linked_to_emr: boolean | null
          notes: string | null
          pdf_url: string | null
          pet_id: string | null
          raw_data: Json | null
          reference_ranges: Json | null
          result_date: string
          results: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          test_category: string | null
          test_code: string | null
          test_name: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          abnormal_flags?: string[] | null
          created_at?: string
          emr_lab_result_id?: string | null
          external_order_id: string
          external_patient_id?: string | null
          has_abnormal_values?: boolean | null
          id?: string
          is_reviewed?: boolean | null
          lab_integration_id?: string | null
          lab_vendor: string
          linked_to_emr?: boolean | null
          notes?: string | null
          pdf_url?: string | null
          pet_id?: string | null
          raw_data?: Json | null
          reference_ranges?: Json | null
          result_date: string
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          test_category?: string | null
          test_code?: string | null
          test_name: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          abnormal_flags?: string[] | null
          created_at?: string
          emr_lab_result_id?: string | null
          external_order_id?: string
          external_patient_id?: string | null
          has_abnormal_values?: boolean | null
          id?: string
          is_reviewed?: boolean | null
          lab_integration_id?: string | null
          lab_vendor?: string
          linked_to_emr?: boolean | null
          notes?: string | null
          pdf_url?: string | null
          pet_id?: string | null
          raw_data?: Json | null
          reference_ranges?: Json | null
          result_date?: string
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          test_category?: string | null
          test_code?: string | null
          test_name?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_lab_results_emr_lab_result_id_fkey"
            columns: ["emr_lab_result_id"]
            isOneToOne: false
            referencedRelation: "pet_lab_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_lab_integration_id_fkey"
            columns: ["lab_integration_id"]
            isOneToOne: false
            referencedRelation: "vet_lab_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_lab_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          feedback: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          feedback: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          feedback?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      flash_sale_notifications: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          notification_type: string
          recipients_count: number | null
          sent_at: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          notification_type?: string
          recipients_count?: number | null
          sent_at?: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          notification_type?: string
          recipients_count?: number | null
          sent_at?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sale_notifications_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_notifications_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_notifications_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_50_badges: {
        Row: {
          awarded_at: string
          badge_number: number
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_number: number
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_number?: number
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      funding_deals: {
        Row: {
          amount_funded: number
          created_at: string
          id: string
          merchant_id: string
          repayment_rate: number
          start_date: string
          status: string
          total_repaid: number
          updated_at: string
        }
        Insert: {
          amount_funded: number
          created_at?: string
          id?: string
          merchant_id: string
          repayment_rate?: number
          start_date?: string
          status?: string
          total_repaid?: number
          updated_at?: string
        }
        Update: {
          amount_funded?: number
          created_at?: string
          id?: string
          merchant_id?: string
          repayment_rate?: number
          start_date?: string
          status?: string
          total_repaid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_deals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_deals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_requests: {
        Row: {
          created_at: string
          estimated_monthly_sales: number
          id: string
          merchant_id: string | null
          reason: string
          requested_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_monthly_sales: number
          id?: string
          merchant_id?: string | null
          reason: string
          requested_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_monthly_sales?: number
          id?: string
          merchant_id?: string | null
          reason?: string
          requested_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cell_service_limits: {
        Row: {
          business_category: string | null
          created_at: string
          geo_cell_id: string
          id: string
          is_active: boolean
          max_slots: number
          service_id: string
          time_window_days: number
          updated_at: string
        }
        Insert: {
          business_category?: string | null
          created_at?: string
          geo_cell_id: string
          id?: string
          is_active?: boolean
          max_slots?: number
          service_id: string
          time_window_days?: number
          updated_at?: string
        }
        Update: {
          business_category?: string | null
          created_at?: string
          geo_cell_id?: string
          id?: string
          is_active?: boolean
          max_slots?: number
          service_id?: string
          time_window_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_cell_service_limits_geo_cell_id_fkey"
            columns: ["geo_cell_id"]
            isOneToOne: false
            referencedRelation: "geo_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_service_limits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cell_service_total_caps: {
        Row: {
          created_at: string
          geo_cell_id: string
          id: string
          max_total_slots: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          geo_cell_id: string
          id?: string
          max_total_slots?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          geo_cell_id?: string
          id?: string
          max_total_slots?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_cell_service_total_caps_geo_cell_id_fkey"
            columns: ["geo_cell_id"]
            isOneToOne: false
            referencedRelation: "geo_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_service_total_caps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cell_slot_reservations: {
        Row: {
          business_category: string | null
          created_at: string
          expires_at: string
          geo_cell_id: string
          id: string
          is_active: boolean
          merchant_id: string
          purchase_id: string | null
          reserved_at: string
          rotation_week: number | null
          service_id: string
          waitlist_id: string | null
        }
        Insert: {
          business_category?: string | null
          created_at?: string
          expires_at: string
          geo_cell_id: string
          id?: string
          is_active?: boolean
          merchant_id: string
          purchase_id?: string | null
          reserved_at?: string
          rotation_week?: number | null
          service_id: string
          waitlist_id?: string | null
        }
        Update: {
          business_category?: string | null
          created_at?: string
          expires_at?: string
          geo_cell_id?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          purchase_id?: string | null
          reserved_at?: string
          rotation_week?: number | null
          service_id?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_cell_slot_reservations_geo_cell_id_fkey"
            columns: ["geo_cell_id"]
            isOneToOne: false
            referencedRelation: "geo_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_slot_reservations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_slot_reservations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_slot_reservations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "merchant_service_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_slot_reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_slot_reservations_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "geo_cell_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cell_waitlist: {
        Row: {
          activated_at: string | null
          business_category: string
          created_at: string
          deactivated_at: string | null
          geo_cell_id: string
          id: string
          joined_at: string
          merchant_id: string
          position: number
          purchase_id: string | null
          rotation_window_end: string | null
          rotation_window_start: string | null
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          business_category: string
          created_at?: string
          deactivated_at?: string | null
          geo_cell_id: string
          id?: string
          joined_at?: string
          merchant_id: string
          position?: number
          purchase_id?: string | null
          rotation_window_end?: string | null
          rotation_window_start?: string | null
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          business_category?: string
          created_at?: string
          deactivated_at?: string | null
          geo_cell_id?: string
          id?: string
          joined_at?: string
          merchant_id?: string
          position?: number
          purchase_id?: string | null
          rotation_window_end?: string | null
          rotation_window_start?: string | null
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_cell_waitlist_geo_cell_id_fkey"
            columns: ["geo_cell_id"]
            isOneToOne: false
            referencedRelation: "geo_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_waitlist_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "merchant_service_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_cell_waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cells: {
        Row: {
          center_latitude: number
          center_longitude: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          radius_miles: number
          slug: string
          updated_at: string
        }
        Insert: {
          center_latitude: number
          center_longitude: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          radius_miles?: number
          slug: string
          updated_at?: string
        }
        Update: {
          center_latitude?: number
          center_longitude?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          radius_miles?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      groomer_vaccine_requirements: {
        Row: {
          created_at: string
          description: string | null
          enforcement_level: string
          id: string
          is_active: boolean
          max_age_months: number
          merchant_id: string
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enforcement_level?: string
          id?: string
          is_active?: boolean
          max_age_months?: number
          merchant_id: string
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enforcement_level?: string
          id?: string
          is_active?: boolean
          max_age_months?: number
          merchant_id?: string
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groomer_vaccine_requirements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groomer_vaccine_requirements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_breed_profiles: {
        Row: {
          breed_name: string
          coat_type: string
          created_at: string
          duration_minutes_override: number | null
          grooming_notes: string | null
          id: string
          is_active: boolean
          merchant_id: string
          price_override: number | null
          size_category: string
          updated_at: string
        }
        Insert: {
          breed_name: string
          coat_type?: string
          created_at?: string
          duration_minutes_override?: number | null
          grooming_notes?: string | null
          id?: string
          is_active?: boolean
          merchant_id: string
          price_override?: number | null
          size_category?: string
          updated_at?: string
        }
        Update: {
          breed_name?: string
          coat_type?: string
          created_at?: string
          duration_minutes_override?: number | null
          grooming_notes?: string | null
          id?: string
          is_active?: boolean
          merchant_id?: string
          price_override?: number | null
          size_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_breed_profiles_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_breed_profiles_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_pet_details: {
        Row: {
          adjusted_duration_minutes: number | null
          adjusted_price: number | null
          booking_id: string
          breed: string | null
          coat_condition: string | null
          coat_type: string | null
          created_at: string
          id: string
          pet_id: string | null
          special_instructions: string | null
          temperament_notes: string | null
          updated_at: string
          vaccine_status: Json | null
          weight_lbs: number | null
        }
        Insert: {
          adjusted_duration_minutes?: number | null
          adjusted_price?: number | null
          booking_id: string
          breed?: string | null
          coat_condition?: string | null
          coat_type?: string | null
          created_at?: string
          id?: string
          pet_id?: string | null
          special_instructions?: string | null
          temperament_notes?: string | null
          updated_at?: string
          vaccine_status?: Json | null
          weight_lbs?: number | null
        }
        Update: {
          adjusted_duration_minutes?: number | null
          adjusted_price?: number | null
          booking_id?: string
          breed?: string | null
          coat_condition?: string | null
          coat_type?: string | null
          created_at?: string
          id?: string
          pet_id?: string | null
          special_instructions?: string | null
          temperament_notes?: string | null
          updated_at?: string
          vaccine_status?: Json | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grooming_pet_details_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_pet_details_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_rebook_log: {
        Row: {
          created_at: string
          id: string
          last_booking_id: string | null
          merchant_id: string
          message_sent_at: string
          pet_id: string | null
          rebook_booking_id: string | null
          reminder_number: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_booking_id?: string | null
          merchant_id: string
          message_sent_at?: string
          pet_id?: string | null
          rebook_booking_id?: string | null
          reminder_number?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_booking_id?: string | null
          merchant_id?: string
          message_sent_at?: string
          pet_id?: string | null
          rebook_booking_id?: string | null
          reminder_number?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_rebook_log_last_booking_id_fkey"
            columns: ["last_booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_rebook_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_rebook_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_rebook_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_rebook_log_rebook_booking_id_fkey"
            columns: ["rebook_booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_rebook_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          max_reminders_per_cycle: number
          merchant_id: string
          message_template: string
          rebook_interval_days: number
          reminder_channels: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_reminders_per_cycle?: number
          merchant_id: string
          message_template?: string
          rebook_interval_days?: number
          reminder_channels?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_reminders_per_cycle?: number
          merchant_id?: string
          message_template?: string
          rebook_interval_days?: number
          reminder_channels?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_rebook_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_rebook_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_report_cards: {
        Row: {
          behavior_notes: string | null
          booking_id: string | null
          created_at: string
          customer_user_id: string
          id: string
          merchant_id: string
          overall_notes: string | null
          pet_id: string | null
          pet_name: string | null
          recommendations: string | null
          sent_at: string | null
          services_performed: string[] | null
          skin_coat_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          behavior_notes?: string | null
          booking_id?: string | null
          created_at?: string
          customer_user_id: string
          id?: string
          merchant_id: string
          overall_notes?: string | null
          pet_id?: string | null
          pet_name?: string | null
          recommendations?: string | null
          sent_at?: string | null
          services_performed?: string[] | null
          skin_coat_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          behavior_notes?: string | null
          booking_id?: string | null
          created_at?: string
          customer_user_id?: string
          id?: string
          merchant_id?: string
          overall_notes?: string | null
          pet_id?: string | null
          pet_name?: string | null
          recommendations?: string | null
          sent_at?: string | null
          services_performed?: string[] | null
          skin_coat_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_report_cards_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_report_cards_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_report_cards_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_report_cards_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grooming_report_photos: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          photo_url: string
          report_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          photo_url: string
          report_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          photo_url?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grooming_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "grooming_report_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      guilt_badge_definitions: {
        Row: {
          badge_key: string
          category: string
          collection_id: string | null
          contributes_to_milestone: boolean | null
          created_at: string
          description: string
          display_order: number | null
          emoji: string
          fixed_reward_amount: number | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_streak_badge: boolean | null
          name: string
          reward_description: string | null
          reward_duration_hours: number | null
          reward_expires_hours: number | null
          reward_type: string | null
          reward_value: number | null
          streak_required_count: number
          threshold_amount: number
          threshold_period: string
          updated_at: string
        }
        Insert: {
          badge_key: string
          category: string
          collection_id?: string | null
          contributes_to_milestone?: boolean | null
          created_at?: string
          description: string
          display_order?: number | null
          emoji: string
          fixed_reward_amount?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_streak_badge?: boolean | null
          name: string
          reward_description?: string | null
          reward_duration_hours?: number | null
          reward_expires_hours?: number | null
          reward_type?: string | null
          reward_value?: number | null
          streak_required_count?: number
          threshold_amount: number
          threshold_period?: string
          updated_at?: string
        }
        Update: {
          badge_key?: string
          category?: string
          collection_id?: string | null
          contributes_to_milestone?: boolean | null
          created_at?: string
          description?: string
          display_order?: number | null
          emoji?: string
          fixed_reward_amount?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_streak_badge?: boolean | null
          name?: string
          reward_description?: string | null
          reward_duration_hours?: number | null
          reward_expires_hours?: number | null
          reward_type?: string | null
          reward_value?: number | null
          streak_required_count?: number
          threshold_amount?: number
          threshold_period?: string
          updated_at?: string
        }
        Relationships: []
      }
      guilt_badge_progress: {
        Row: {
          badge_id: string
          current_amount: number
          id: string
          last_updated: string
          period_end: string
          period_start: string
          user_id: string
        }
        Insert: {
          badge_id: string
          current_amount?: number
          id?: string
          last_updated?: string
          period_end: string
          period_start: string
          user_id: string
        }
        Update: {
          badge_id?: string
          current_amount?: number
          id?: string
          last_updated?: string
          period_end?: string
          period_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guilt_badge_progress_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "guilt_badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      guilt_badge_rewards: {
        Row: {
          badge_id: string
          created_at: string
          expires_at: string
          id: string
          reward_code: string | null
          reward_type: string
          reward_value: number
          status: string
          updated_at: string
          used_at: string | null
          used_on_transaction_id: string | null
          user_badge_id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          expires_at: string
          id?: string
          reward_code?: string | null
          reward_type: string
          reward_value: number
          status?: string
          updated_at?: string
          used_at?: string | null
          used_on_transaction_id?: string | null
          user_badge_id: string
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          reward_code?: string | null
          reward_type?: string
          reward_value?: number
          status?: string
          updated_at?: string
          used_at?: string | null
          used_on_transaction_id?: string | null
          user_badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guilt_badge_rewards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "guilt_badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guilt_badge_rewards_user_badge_id_fkey"
            columns: ["user_badge_id"]
            isOneToOne: false
            referencedRelation: "user_guilt_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          attachments: string[] | null
          claim_data: Json | null
          claim_date: string | null
          claim_number: string | null
          copay_amount: number | null
          covered_amount: number | null
          created_at: string | null
          deductible_applied: number | null
          denial_reason: string | null
          diagnosis_codes: string[] | null
          id: string
          invoice_id: string | null
          notes: string | null
          owner_responsibility: number | null
          paid_at: string | null
          payment_reference: string | null
          policy_id: string
          procedure_codes: string[] | null
          processed_at: string | null
          service_date: string
          status: string | null
          submission_method: string | null
          submitted_at: string | null
          total_amount: number
          updated_at: string | null
          vet_id: string
        }
        Insert: {
          attachments?: string[] | null
          claim_data?: Json | null
          claim_date?: string | null
          claim_number?: string | null
          copay_amount?: number | null
          covered_amount?: number | null
          created_at?: string | null
          deductible_applied?: number | null
          denial_reason?: string | null
          diagnosis_codes?: string[] | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          owner_responsibility?: number | null
          paid_at?: string | null
          payment_reference?: string | null
          policy_id: string
          procedure_codes?: string[] | null
          processed_at?: string | null
          service_date: string
          status?: string | null
          submission_method?: string | null
          submitted_at?: string | null
          total_amount: number
          updated_at?: string | null
          vet_id: string
        }
        Update: {
          attachments?: string[] | null
          claim_data?: Json | null
          claim_date?: string | null
          claim_number?: string | null
          copay_amount?: number | null
          covered_amount?: number | null
          created_at?: string | null
          deductible_applied?: number | null
          denial_reason?: string | null
          diagnosis_codes?: string[] | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          owner_responsibility?: number | null
          paid_at?: string | null
          payment_reference?: string | null
          policy_id?: string
          procedure_codes?: string[] | null
          processed_at?: string | null
          service_date?: string
          status?: string | null
          submission_method?: string | null
          submitted_at?: string | null
          total_amount?: number
          updated_at?: string | null
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "pet_insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_activity: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          ip_address: string | null
          metadata: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activity_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_catalog_items: {
        Row: {
          brand_id: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          merchant_id: string
          name: string
          sku: string | null
          tax_rate: number | null
          unit_price: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id: string
          name: string
          sku?: string | null
          tax_rate?: number | null
          unit_price?: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id?: string
          name?: string
          sku?: string | null
          tax_rate?: number | null
          unit_price?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_catalog_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_catalog_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_catalog_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          merchant_id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          merchant_id: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          merchant_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_clients_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_clients_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          brand_id: string | null
          catalog_item_id: string | null
          created_at: string
          description: string
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          invoice_id: string
          quantity: number
          service_id: string | null
          sort_order: number | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          unit_price: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          catalog_item_id?: string | null
          created_at?: string
          description: string
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          invoice_id: string
          quantity?: number
          service_id?: string | null
          sort_order?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_price: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          catalog_item_id?: string | null
          created_at?: string
          description?: string
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          invoice_id?: string
          quantity?: number
          service_id?: string | null
          sort_order?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_price?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          processing_fee: number | null
          recorded_by: string | null
          reference_number: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          processing_fee?: number | null
          recorded_by?: string | null
          reference_number?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          processing_fee?: number | null
          recorded_by?: string | null
          reference_number?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          invoice_id: string
          name: string | null
          recipient_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invoice_id: string
          name?: string | null
          recipient_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invoice_id?: string
          name?: string | null
          recipient_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_recipients_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          accent_color: string | null
          bank_account_name: string | null
          bank_account_number_last4: string | null
          bank_name: string | null
          bank_routing_number: string | null
          created_at: string
          default_currency: string | null
          default_footer: string | null
          default_notes: string | null
          default_payment_terms: number | null
          default_tax_rate: number | null
          id: string
          invoice_prefix: string | null
          late_fee_amount: number | null
          late_fee_enabled: boolean | null
          late_fee_grace_days: number | null
          late_fee_type: string | null
          logo_url: string | null
          merchant_id: string
          next_invoice_number: number | null
          overdue_reminder_days: number[] | null
          paypal_email: string | null
          reminder_days_before: number[] | null
          reminder_enabled: boolean | null
          updated_at: string
          venmo_handle: string | null
        }
        Insert: {
          accent_color?: string | null
          bank_account_name?: string | null
          bank_account_number_last4?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          created_at?: string
          default_currency?: string | null
          default_footer?: string | null
          default_notes?: string | null
          default_payment_terms?: number | null
          default_tax_rate?: number | null
          id?: string
          invoice_prefix?: string | null
          late_fee_amount?: number | null
          late_fee_enabled?: boolean | null
          late_fee_grace_days?: number | null
          late_fee_type?: string | null
          logo_url?: string | null
          merchant_id: string
          next_invoice_number?: number | null
          overdue_reminder_days?: number[] | null
          paypal_email?: string | null
          reminder_days_before?: number[] | null
          reminder_enabled?: boolean | null
          updated_at?: string
          venmo_handle?: string | null
        }
        Update: {
          accent_color?: string | null
          bank_account_name?: string | null
          bank_account_number_last4?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          created_at?: string
          default_currency?: string | null
          default_footer?: string | null
          default_notes?: string | null
          default_payment_terms?: number | null
          default_tax_rate?: number | null
          id?: string
          invoice_prefix?: string | null
          late_fee_amount?: number | null
          late_fee_enabled?: boolean | null
          late_fee_grace_days?: number | null
          late_fee_type?: string | null
          logo_url?: string | null
          merchant_id?: string
          next_invoice_number?: number | null
          overdue_reminder_days?: number[] | null
          paypal_email?: string | null
          reminder_days_before?: number[] | null
          reminder_enabled?: boolean | null
          updated_at?: string
          venmo_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_slices: {
        Row: {
          actual_amount: number
          claim_id: string | null
          created_at: string | null
          funded_at: string | null
          gap_amount: number | null
          id: string
          invoice_id: string
          notes: string | null
          notification_sent_at: string | null
          option_selected_at: string | null
          original_amount: number
          recovery_option: string | null
          recovery_status: string | null
          slice_type: string
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number
          claim_id?: string | null
          created_at?: string | null
          funded_at?: string | null
          gap_amount?: number | null
          id?: string
          invoice_id: string
          notes?: string | null
          notification_sent_at?: string | null
          option_selected_at?: string | null
          original_amount?: number
          recovery_option?: string | null
          recovery_status?: string | null
          slice_type: string
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number
          claim_id?: string | null
          created_at?: string | null
          funded_at?: string | null
          gap_amount?: number | null
          id?: string
          invoice_id?: string
          notes?: string | null
          notification_sent_at?: string | null
          option_selected_at?: string | null
          original_amount?: number
          recovery_option?: string | null
          recovery_status?: string | null
          slice_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_slices_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurance_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_slices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          allow_partial_payments: boolean | null
          created_at: string
          default_items: Json | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          footer: string | null
          id: string
          is_default: boolean | null
          merchant_id: string
          name: string
          notes: string | null
          payment_terms: number | null
          tax_rate: number | null
          terms_conditions: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          allow_partial_payments?: boolean | null
          created_at?: string
          default_items?: Json | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          footer?: string | null
          id?: string
          is_default?: boolean | null
          merchant_id: string
          name: string
          notes?: string | null
          payment_terms?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          allow_partial_payments?: boolean | null
          created_at?: string
          default_items?: Json | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          footer?: string | null
          id?: string
          is_default?: boolean | null
          merchant_id?: string
          name?: string
          notes?: string | null
          payment_terms?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_templates_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accept_bank_transfer: boolean | null
          accept_credit_card: boolean | null
          accept_pawbucks: boolean | null
          access_token: string
          allow_partial_payments: boolean | null
          allow_tips: boolean | null
          amount_due: number | null
          amount_paid: number | null
          attachment_urls: string[] | null
          client_address: string | null
          client_company: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          currency: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          due_date: string
          footer: string | null
          id: string
          invoice_number: string
          is_recurring: boolean | null
          issue_date: string
          merchant_id: string
          next_invoice_date: string | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          payment_terms: number | null
          recurring_end_date: string | null
          recurring_interval: string | null
          sent_at: string | null
          shipping_amount: number | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          title: string | null
          total: number
          updated_at: string
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          accept_bank_transfer?: boolean | null
          accept_credit_card?: boolean | null
          accept_pawbucks?: boolean | null
          access_token?: string
          allow_partial_payments?: boolean | null
          allow_tips?: boolean | null
          amount_due?: number | null
          amount_paid?: number | null
          attachment_urls?: string[] | null
          client_address?: string | null
          client_company?: string | null
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date: string
          footer?: string | null
          id?: string
          invoice_number: string
          is_recurring?: boolean | null
          issue_date?: string
          merchant_id: string
          next_invoice_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_terms?: number | null
          recurring_end_date?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          shipping_amount?: number | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          accept_bank_transfer?: boolean | null
          accept_credit_card?: boolean | null
          accept_pawbucks?: boolean | null
          access_token?: string
          allow_partial_payments?: boolean | null
          allow_tips?: boolean | null
          amount_due?: number | null
          amount_paid?: number | null
          attachment_urls?: string[] | null
          client_address?: string | null
          client_company?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string
          footer?: string | null
          id?: string
          invoice_number?: string
          is_recurring?: boolean | null
          issue_date?: string
          merchant_id?: string
          next_invoice_date?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_terms?: number | null
          recurring_end_date?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          shipping_amount?: number | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "invoice_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      irs_mileage_rates: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          notes: string | null
          rate_per_mile: number
          source_url: string | null
          tax_year: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          notes?: string | null
          rate_per_mile: number
          source_url?: string | null
          tax_year: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          notes?: string | null
          rate_per_mile?: number
          source_url?: string | null
          tax_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      launch_clusters: {
        Row: {
          areas: string[]
          created_at: string
          id: string
          is_active: boolean
          max_pet_fund_spots: number
          name: string
          pet_fund_spots_used: number
          series_a_max: number
          series_a_used: number
          series_b_max: number
          series_b_used: number
          series_c_max: number
          series_c_used: number
          updated_at: string
        }
        Insert: {
          areas?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          max_pet_fund_spots?: number
          name: string
          pet_fund_spots_used?: number
          series_a_max?: number
          series_a_used?: number
          series_b_max?: number
          series_b_used?: number
          series_c_max?: number
          series_c_used?: number
          updated_at?: string
        }
        Update: {
          areas?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          max_pet_fund_spots?: number
          name?: string
          pet_fund_spots_used?: number
          series_a_max?: number
          series_a_used?: number
          series_b_max?: number
          series_b_used?: number
          series_c_max?: number
          series_c_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      loan_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          loan_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          loan_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          loan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_activity_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "vet_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_pet_posts: {
        Row: {
          additional_notes: string | null
          age_estimate: string | null
          breed: string | null
          collar_description: string | null
          color_markings: string
          contact_email: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          deletion_warning_sent_at: string | null
          gender: string | null
          id: string
          identifying_features: string | null
          is_active: boolean
          last_seen_area_description: string | null
          last_seen_date: string
          last_seen_location: string
          last_seen_time: string | null
          microchip_number: string | null
          pet_name: string
          pet_type: string
          photo_url: string | null
          photo_urls: string[] | null
          reward_amount: number | null
          size: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          age_estimate?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings: string
          contact_email?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          deletion_warning_sent_at?: string | null
          gender?: string | null
          id?: string
          identifying_features?: string | null
          is_active?: boolean
          last_seen_area_description?: string | null
          last_seen_date: string
          last_seen_location: string
          last_seen_time?: string | null
          microchip_number?: string | null
          pet_name: string
          pet_type: string
          photo_url?: string | null
          photo_urls?: string[] | null
          reward_amount?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          age_estimate?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          deletion_warning_sent_at?: string | null
          gender?: string | null
          id?: string
          identifying_features?: string | null
          is_active?: boolean
          last_seen_area_description?: string | null
          last_seen_date?: string
          last_seen_location?: string
          last_seen_time?: string | null
          microchip_number?: string | null
          pet_name?: string
          pet_type?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          reward_amount?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          credit_value: number
          current_count: number
          id: string
          merchant_contribution: number
          merchant_id: string | null
          milestone_type: string
          period_end: string
          period_start: string
          platform_contribution: number
          status: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credit_value?: number
          current_count?: number
          id?: string
          merchant_contribution?: number
          merchant_id?: string | null
          milestone_type?: string
          period_end: string
          period_start: string
          platform_contribution?: number
          status?: string
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credit_value?: number
          current_count?: number
          id?: string
          merchant_contribution?: number
          merchant_id?: string | null
          milestone_type?: string
          period_end?: string
          period_start?: string
          platform_contribution?: number
          status?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_milestones_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_milestones_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_reward_redemptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          merchant_id: string
          program_id: string
          punch_card_id: string
          redeemed_at: string | null
          redeemed_transaction_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          merchant_id: string
          program_id: string
          punch_card_id: string
          redeemed_at?: string | null
          redeemed_transaction_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          merchant_id?: string
          program_id?: string
          punch_card_id?: string
          redeemed_at?: string | null
          redeemed_transaction_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_reward_redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_redemptions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "merchant_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_redemptions_punch_card_id_fkey"
            columns: ["punch_card_id"]
            isOneToOne: false
            referencedRelation: "customer_punch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_redemptions_redeemed_transaction_id_fkey"
            columns: ["redeemed_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_warnings: {
        Row: {
          action_deadline: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          is_dismissed: boolean
          message: string
          notification_sent: boolean
          notification_sent_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          urgency: string
          user_id: string
          warning_type: string
        }
        Insert: {
          action_deadline?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean
          message: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          urgency?: string
          user_id: string
          warning_type: string
        }
        Update: {
          action_deadline?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean
          message?: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          urgency?: string
          user_id?: string
          warning_type?: string
        }
        Relationships: []
      }
      merchant_account_type_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_fee_model: string
          id: string
          merchant_id: string
          reason: string | null
          requested_fee_model: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_fee_model: string
          id?: string
          merchant_id: string
          reason?: string | null
          requested_fee_model: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_fee_model?: string
          id?: string
          merchant_id?: string
          reason?: string | null
          requested_fee_model?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_account_type_change_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_account_type_change_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_analytics_products: {
        Row: {
          billing_period: string | null
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_pawbucks: number
          price_usd: number
          product_type: string
          updated_at: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_pawbucks: number
          price_usd: number
          product_type: string
          updated_at?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_pawbucks?: number
          price_usd?: number
          product_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_analytics_purchases: {
        Row: {
          amount_paid: number
          created_at: string | null
          id: string
          merchant_id: string
          payment_method: string
          product_id: string
          purchase_date: string | null
          report_data: Json | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          id?: string
          merchant_id: string
          payment_method: string
          product_id: string
          purchase_date?: string | null
          report_data?: Json | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          id?: string
          merchant_id?: string
          payment_method?: string
          product_id?: string
          purchase_date?: string | null
          report_data?: Json | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_analytics_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_analytics_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_analytics_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_analytics_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_analytics_subscriptions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          merchant_id: string
          next_billing_date: string | null
          payment_method: string
          product_id: string
          start_date: string | null
          status: string
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          merchant_id: string
          next_billing_date?: string | null
          payment_method: string
          product_id: string
          start_date?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          merchant_id?: string
          next_billing_date?: string | null
          payment_method?: string
          product_id?: string
          start_date?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_analytics_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_analytics_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_analytics_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_analytics_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          merchant_id: string
          slot_duration_minutes: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          merchant_id: string
          slot_duration_minutes?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_availability_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_availability_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_availability_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_available: boolean
          merchant_id: string
          override_date: string
          reason: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          merchant_id: string
          override_date: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          merchant_id?: string
          override_date?: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_availability_overrides_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_availability_overrides_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_business_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          merchant_id: string
          open_time: string
          updated_at: string
        }
        Insert: {
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          merchant_id: string
          open_time?: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          merchant_id?: string
          open_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_business_hours_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_business_hours_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "merchant_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_campaigns: {
        Row: {
          channel: string
          created_at: string
          failed_count: number
          id: string
          merchant_id: string
          message: string
          recipient_count: number
          recipient_type: string
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          failed_count?: number
          id?: string
          merchant_id: string
          message: string
          recipient_count?: number
          recipient_type?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          failed_count?: number
          id?: string
          merchant_id?: string
          message?: string
          recipient_count?: number
          recipient_type?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_campaigns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_campaigns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_customer_analytics: {
        Row: {
          average_order_value: number | null
          cohort_month: string | null
          created_at: string | null
          first_transaction_date: string | null
          id: string
          last_transaction_date: string | null
          lifetime_value: number | null
          merchant_id: string
          retention_rate: number | null
          total_spent: number | null
          total_transactions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_order_value?: number | null
          cohort_month?: string | null
          created_at?: string | null
          first_transaction_date?: string | null
          id?: string
          last_transaction_date?: string | null
          lifetime_value?: number | null
          merchant_id: string
          retention_rate?: number | null
          total_spent?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_order_value?: number | null
          cohort_month?: string | null
          created_at?: string | null
          first_transaction_date?: string | null
          id?: string
          last_transaction_date?: string | null
          lifetime_value?: number | null
          merchant_id?: string
          retention_rate?: number | null
          total_spent?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_customer_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_customer_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_daily_summaries: {
        Row: {
          created_at: string
          email_sent: boolean
          id: string
          merchant_id: string
          summary_date: string
          total_pawbucks_credits: number
          total_sales: number
          total_usd_processed: number
          transaction_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          id?: string
          merchant_id: string
          summary_date: string
          total_pawbucks_credits?: number
          total_sales?: number
          total_usd_processed?: number
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          id?: string
          merchant_id?: string
          summary_date?: string
          total_pawbucks_credits?: number
          total_sales?: number
          total_usd_processed?: number
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_daily_summaries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_daily_summaries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_funding_waitlist: {
        Row: {
          additional_notes: string | null
          business_name: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          merchant_id: string
          monthly_revenue_range: string
          notified_at: string | null
          position: number | null
          requested_amount_usd: number
          status: string
          time_in_business: string
          updated_at: string
          urgency: string
          use_of_funds: string
          use_of_funds_details: string | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          business_name: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          monthly_revenue_range: string
          notified_at?: string | null
          position?: number | null
          requested_amount_usd: number
          status?: string
          time_in_business: string
          updated_at?: string
          urgency?: string
          use_of_funds: string
          use_of_funds_details?: string | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          business_name?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          monthly_revenue_range?: string
          notified_at?: string | null
          position?: number | null
          requested_amount_usd?: number
          status?: string
          time_in_business?: string
          updated_at?: string
          urgency?: string
          use_of_funds?: string
          use_of_funds_details?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_funding_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_funding_waitlist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_loyalty_programs: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          exclude_pawbucks_only: boolean
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          punches_required: number
          qualifying_categories: string[]
          qualifying_description: string | null
          qualifying_service_ids: string[]
          reward_description: string
          reward_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          exclude_pawbucks_only?: boolean
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          punches_required: number
          qualifying_categories?: string[]
          qualifying_description?: string | null
          qualifying_service_ids?: string[]
          reward_description: string
          reward_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          exclude_pawbucks_only?: boolean
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          punches_required?: number
          qualifying_categories?: string[]
          qualifying_description?: string | null
          qualifying_service_ids?: string[]
          reward_description?: string
          reward_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_loyalty_programs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_loyalty_programs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_market_services: {
        Row: {
          billing_type: string
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_new: boolean | null
          is_popular: boolean | null
          name: string
          price_pawbucks: number
          price_usd: number
          short_description: string | null
          updated_at: string | null
        }
        Insert: {
          billing_type?: string
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_new?: boolean | null
          is_popular?: boolean | null
          name: string
          price_pawbucks?: number
          price_usd?: number
          short_description?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_type?: string
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_new?: boolean | null
          is_popular?: boolean | null
          name?: string
          price_pawbucks?: number
          price_usd?: number
          short_description?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_message_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "merchant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          merchant_id: string
          message: string
          read_at: string | null
          sender_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          merchant_id: string
          message: string
          read_at?: string | null
          sender_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          merchant_id?: string
          message?: string
          read_at?: string | null
          sender_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_messages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_mileage_log: {
        Row: {
          created_at: string
          description: string | null
          destination: string | null
          end_location: string | null
          end_odometer: number | null
          id: string
          merchant_id: string
          miles: number
          start_location: string | null
          start_odometer: number | null
          tax_year: number
          trip_date: string
          trip_type: string
          updated_at: string
          vehicle_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          destination?: string | null
          end_location?: string | null
          end_odometer?: number | null
          id?: string
          merchant_id: string
          miles: number
          start_location?: string | null
          start_odometer?: number | null
          tax_year: number
          trip_date: string
          trip_type: string
          updated_at?: string
          vehicle_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          destination?: string | null
          end_location?: string | null
          end_odometer?: number | null
          id?: string
          merchant_id?: string
          miles?: number
          start_location?: string | null
          start_odometer?: number | null
          tax_year?: number
          trip_date?: string
          trip_type?: string
          updated_at?: string
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_mileage_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_mileage_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_pawbucks_activity: {
        Row: {
          amount: number
          created_at: string
          customer_user_id: string | null
          description: string | null
          id: string
          merchant_id: string
          source: string
          transaction_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_user_id?: string | null
          description?: string | null
          id?: string
          merchant_id: string
          source: string
          transaction_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_user_id?: string | null
          description?: string | null
          id?: string
          merchant_id?: string
          source?: string
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_pawbucks_wallet: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_updated: string
          merchant_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          merchant_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pawbucks_wallet_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_pawbucks_wallet_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_pos_integrations: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          clover_access_token: string | null
          clover_merchant_id: string | null
          clover_refresh_token: string | null
          clover_token_expires_at: string | null
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          merchant_id: string
          name: string
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          clover_access_token?: string | null
          clover_merchant_id?: string | null
          clover_refresh_token?: string | null
          clover_token_expires_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          merchant_id: string
          name?: string
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          clover_access_token?: string | null
          clover_merchant_id?: string | null
          clover_refresh_token?: string | null
          clover_token_expires_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          merchant_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pos_integrations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_pos_integrations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_reviews: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_route_plans: {
        Row: {
          created_at: string | null
          estimated_savings_minutes: number | null
          id: string
          mapbox_route_geometry: string | null
          merchant_id: string
          optimized_order: Json | null
          route_date: string
          start_address: string | null
          start_latitude: number | null
          start_longitude: number | null
          status: string
          total_distance_miles: number | null
          total_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_savings_minutes?: number | null
          id?: string
          mapbox_route_geometry?: string | null
          merchant_id: string
          optimized_order?: Json | null
          route_date: string
          start_address?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          status?: string
          total_distance_miles?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_savings_minutes?: number | null
          id?: string
          mapbox_route_geometry?: string | null
          merchant_id?: string
          optimized_order?: Json | null
          route_date?: string
          start_address?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          status?: string
          total_distance_miles?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_route_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_route_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_sale_confirmations: {
        Row: {
          amount: number
          confirmation_code: string
          confirmed_by: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          id: string
          merchant_id: string
          notes: string | null
          receipt_submission_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmation_code?: string
          confirmed_by?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          receipt_submission_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmation_code?: string
          confirmed_by?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          receipt_submission_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_sale_confirmations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_sale_confirmations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_sale_confirmations_receipt_submission_id_fkey"
            columns: ["receipt_submission_id"]
            isOneToOne: false
            referencedRelation: "receipt_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_search_analytics: {
        Row: {
          clicks: number | null
          conversions: number | null
          created_at: string | null
          date: string
          id: string
          merchant_id: string
          search_term: string
          views: number | null
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          id?: string
          merchant_id: string
          search_term: string
          views?: number | null
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          id?: string
          merchant_id?: string
          search_term?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_search_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_search_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_service_purchases: {
        Row: {
          amount_paid_pawbucks: number | null
          amount_paid_usd: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          merchant_id: string
          service_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid_pawbucks?: number | null
          amount_paid_usd?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          merchant_id: string
          service_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid_pawbucks?: number | null
          amount_paid_usd?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          merchant_id?: string
          service_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_service_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_service_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_service_purchases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_services: {
        Row: {
          allow_recurring: boolean
          brand_id: string | null
          buffer_minutes: number
          cancellation_policy_hours: number
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          deposit_amount: number | null
          description: string | null
          duration_minutes: number
          flash_sale_end_at: string | null
          flash_sale_pawbucks_price: number | null
          flash_sale_start_at: string | null
          id: string
          is_active: boolean
          is_flash_sale: boolean
          is_mobile_service: boolean | null
          max_capacity: number
          merchant_id: string
          min_notice_hours: number
          name: string
          no_show_fee_amount: number | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          price: number
          require_deposit: boolean | null
          requires_pet: boolean
          updated_at: string
        }
        Insert: {
          allow_recurring?: boolean
          brand_id?: string | null
          buffer_minutes?: number
          cancellation_policy_hours?: number
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_minutes?: number
          flash_sale_end_at?: string | null
          flash_sale_pawbucks_price?: number | null
          flash_sale_start_at?: string | null
          id?: string
          is_active?: boolean
          is_flash_sale?: boolean
          is_mobile_service?: boolean | null
          max_capacity?: number
          merchant_id: string
          min_notice_hours?: number
          name: string
          no_show_fee_amount?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          require_deposit?: boolean | null
          requires_pet?: boolean
          updated_at?: string
        }
        Update: {
          allow_recurring?: boolean
          brand_id?: string | null
          buffer_minutes?: number
          cancellation_policy_hours?: number
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          duration_minutes?: number
          flash_sale_end_at?: string | null
          flash_sale_pawbucks_price?: number | null
          flash_sale_start_at?: string | null
          id?: string
          is_active?: boolean
          is_flash_sale?: boolean
          is_mobile_service?: boolean | null
          max_capacity?: number
          merchant_id?: string
          min_notice_hours?: number
          name?: string
          no_show_fee_amount?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          require_deposit?: boolean | null
          requires_pet?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_services_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_services_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_services_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_store_rewards_funding_activity: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          merchant_id: string
          pb_amount: number | null
          stripe_payment_intent_id: string | null
          transaction_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id: string
          pb_amount?: number | null
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string
          pb_amount?: number | null
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_store_rewards_funding_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_store_rewards_funding_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_store_rewards_wallet: {
        Row: {
          auto_reload_amount_cents: number | null
          auto_reload_enabled: boolean
          balance_cents: number
          created_at: string
          id: string
          lifetime_funded_cents: number
          lifetime_issued_pb: number
          lifetime_redeemed_pb: number
          low_balance_alert_sent_at: string | null
          low_balance_threshold_cents: number
          merchant_id: string
          updated_at: string
        }
        Insert: {
          auto_reload_amount_cents?: number | null
          auto_reload_enabled?: boolean
          balance_cents?: number
          created_at?: string
          id?: string
          lifetime_funded_cents?: number
          lifetime_issued_pb?: number
          lifetime_redeemed_pb?: number
          low_balance_alert_sent_at?: string | null
          low_balance_threshold_cents?: number
          merchant_id: string
          updated_at?: string
        }
        Update: {
          auto_reload_amount_cents?: number | null
          auto_reload_enabled?: boolean
          balance_cents?: number
          created_at?: string
          id?: string
          lifetime_funded_cents?: number
          lifetime_issued_pb?: number
          lifetime_redeemed_pb?: number
          low_balance_alert_sent_at?: string | null
          low_balance_threshold_cents?: number
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_store_rewards_wallet_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_store_rewards_wallet_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscription_events: {
        Row: {
          amount: number | null
          created_at: string
          event_type: string
          failure_reason: string | null
          id: string
          metadata: Json | null
          payment_intent_id: string | null
          subscription_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event_type: string
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscription_plans: {
        Row: {
          amount: number
          billing_interval: string
          billing_interval_count: number
          created_at: string
          currency: string
          current_subscribers: number | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_subscribers: number | null
          merchant_id: string
          name: string
          sort_order: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_interval?: string
          billing_interval_count?: number
          created_at?: string
          currency?: string
          current_subscribers?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_subscribers?: number | null
          merchant_id: string
          name: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_interval?: string
          billing_interval_count?: number
          created_at?: string
          currency?: string
          current_subscribers?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_subscribers?: number | null
          merchant_id?: string
          name?: string
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscription_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscription_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscriptions: {
        Row: {
          amount: number
          application_fee_percent: number
          billing_interval: string
          billing_interval_count: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          connected_account_id: string
          created_at: string
          currency: string
          current_period_end: string
          current_period_start: string
          failed_payment_count: number
          id: string
          last_payment_date: string | null
          last_payment_intent_id: string | null
          last_payment_status: string | null
          merchant_id: string
          metadata: Json | null
          next_billing_date: string
          product_name: string
          status: string
          stripe_customer_id_on_connected: string
          stripe_price_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          application_fee_percent?: number
          billing_interval?: string
          billing_interval_count?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          connected_account_id: string
          created_at?: string
          currency?: string
          current_period_end: string
          current_period_start?: string
          failed_payment_count?: number
          id?: string
          last_payment_date?: string | null
          last_payment_intent_id?: string | null
          last_payment_status?: string | null
          merchant_id: string
          metadata?: Json | null
          next_billing_date: string
          product_name: string
          status?: string
          stripe_customer_id_on_connected: string
          stripe_price_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          application_fee_percent?: number
          billing_interval?: string
          billing_interval_count?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          connected_account_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          failed_payment_count?: number
          id?: string
          last_payment_date?: string | null
          last_payment_intent_id?: string | null
          last_payment_status?: string | null
          merchant_id?: string
          metadata?: Json | null
          next_billing_date?: string
          product_name?: string
          status?: string
          stripe_customer_id_on_connected?: string
          stripe_price_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_tax_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["tax_expense_category"]
          created_at: string
          description: string | null
          expense_date: string
          id: string
          is_auto_logged: boolean | null
          merchant_id: string
          original_price: number | null
          receipt_url: string | null
          savings_amount: number | null
          source_purchase_id: string | null
          tax_year: number
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["tax_expense_category"]
          created_at?: string
          description?: string | null
          expense_date: string
          id?: string
          is_auto_logged?: boolean | null
          merchant_id: string
          original_price?: number | null
          receipt_url?: string | null
          savings_amount?: number | null
          source_purchase_id?: string | null
          tax_year: number
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["tax_expense_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_auto_logged?: boolean | null
          merchant_id?: string
          original_price?: number | null
          receipt_url?: string | null
          savings_amount?: number | null
          source_purchase_id?: string | null
          tax_year?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_tax_expenses_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_tax_expenses_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_training_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          merchant_id: string
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          merchant_id: string
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          merchant_id?: string
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_training_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "training_course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_training_progress_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_training_progress_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_twilio_settings: {
        Row: {
          created_at: string
          id: string
          is_verified: boolean
          merchant_id: string
          twilio_account_sid: string
          twilio_auth_token: string
          twilio_phone_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_verified?: boolean
          merchant_id: string
          twilio_account_sid: string
          twilio_auth_token: string
          twilio_phone_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_verified?: boolean
          merchant_id?: string
          twilio_account_sid?: string
          twilio_auth_token?: string
          twilio_phone_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_twilio_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_twilio_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_vehicle_expenses: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          merchant_id: string
          tax_year: number
          updated_at: string
          vehicle_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          expense_date: string
          expense_type: string
          id?: string
          merchant_id: string
          tax_year: number
          updated_at?: string
          vehicle_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          merchant_id?: string
          tax_year?: number
          updated_at?: string
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_vehicle_expenses_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_vehicle_expenses_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_webhooks: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          merchant_id: string
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          merchant_id: string
          name?: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          merchant_id?: string
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_webhooks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_webhooks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          accepts_pawbucks: boolean
          accepts_welcome_credit: boolean | null
          acquisition_fee_rate: number
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          business_categories: string[]
          business_name: string
          business_type: string
          cashback_rate: number
          checkin_qr_token: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          denial_reason: string | null
          description: string | null
          email: string | null
          entity_type: string | null
          facebook_url: string | null
          fee_model: string
          funding_status: string | null
          id: string
          instagram_url: string | null
          intro_video_url: string | null
          is_paused: boolean
          is_sponsored: boolean | null
          last_notified_status: string | null
          latitude: number | null
          linkedin_url: string | null
          logo_url: string | null
          longitude: number | null
          onboarding_complete: boolean | null
          owner_name: string | null
          pause_reason: string | null
          paused_at: string | null
          paused_by: string | null
          pawbucks_cap_enabled: boolean
          pawbucks_cap_pct: number | null
          pawbucks_promo_cap_pct: number | null
          pawbucks_promo_ends_at: string | null
          pawbucks_promo_starts_at: string | null
          phone: string | null
          price_range: number | null
          privacy_policy_url: string | null
          search_keywords: string[] | null
          service_area_radius_miles: number | null
          shipping_returns_policy_url: string | null
          sponsored_until: string | null
          state_of_incorporation: string | null
          storefront_slug: string
          stripe_account_id: string | null
          stripe_account_status: string | null
          submission_email_sent_at: string | null
          timezone: string
          tos_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          welcome_credit_opted_in_at: string | null
          working_style: string | null
        }
        Insert: {
          accepts_pawbucks?: boolean
          accepts_welcome_credit?: boolean | null
          acquisition_fee_rate?: number
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          business_categories?: string[]
          business_name: string
          business_type: string
          cashback_rate?: number
          checkin_qr_token?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          denial_reason?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string | null
          facebook_url?: string | null
          fee_model?: string
          funding_status?: string | null
          id?: string
          instagram_url?: string | null
          intro_video_url?: string | null
          is_paused?: boolean
          is_sponsored?: boolean | null
          last_notified_status?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          owner_name?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          pawbucks_cap_enabled?: boolean
          pawbucks_cap_pct?: number | null
          pawbucks_promo_cap_pct?: number | null
          pawbucks_promo_ends_at?: string | null
          pawbucks_promo_starts_at?: string | null
          phone?: string | null
          price_range?: number | null
          privacy_policy_url?: string | null
          search_keywords?: string[] | null
          service_area_radius_miles?: number | null
          shipping_returns_policy_url?: string | null
          sponsored_until?: string | null
          state_of_incorporation?: string | null
          storefront_slug: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          submission_email_sent_at?: string | null
          timezone?: string
          tos_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          welcome_credit_opted_in_at?: string | null
          working_style?: string | null
        }
        Update: {
          accepts_pawbucks?: boolean
          accepts_welcome_credit?: boolean | null
          acquisition_fee_rate?: number
          address?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          business_categories?: string[]
          business_name?: string
          business_type?: string
          cashback_rate?: number
          checkin_qr_token?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          denial_reason?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string | null
          facebook_url?: string | null
          fee_model?: string
          funding_status?: string | null
          id?: string
          instagram_url?: string | null
          intro_video_url?: string | null
          is_paused?: boolean
          is_sponsored?: boolean | null
          last_notified_status?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          owner_name?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          pawbucks_cap_enabled?: boolean
          pawbucks_cap_pct?: number | null
          pawbucks_promo_cap_pct?: number | null
          pawbucks_promo_ends_at?: string | null
          pawbucks_promo_starts_at?: string | null
          phone?: string | null
          price_range?: number | null
          privacy_policy_url?: string | null
          search_keywords?: string[] | null
          service_area_radius_miles?: number | null
          shipping_returns_policy_url?: string | null
          sponsored_until?: string | null
          state_of_incorporation?: string | null
          storefront_slug?: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          submission_email_sent_at?: string | null
          timezone?: string
          tos_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          welcome_credit_opted_in_at?: string | null
          working_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          milestone_id: string
          transaction_date: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          milestone_id: string
          transaction_date: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          milestone_id?: string
          transaction_date?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_transactions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "loyalty_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      no_show_charges: {
        Row: {
          amount: number
          booking_id: string
          charged_by: string | null
          created_at: string
          id: string
          merchant_id: string
          reason: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          charged_by?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          reason?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          charged_by?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          reason?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "no_show_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          delivery_method: string
          id: string
          marketing: boolean
          security_alerts: boolean
          transactional: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_method?: string
          id?: string
          marketing?: boolean
          security_alerts?: boolean
          transactional?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_method?: string
          id?: string
          marketing?: boolean
          security_alerts?: boolean
          transactional?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_read: boolean | null
          link_url: string | null
          message: string
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          message: string
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          message?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      offer_activity: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          details: Json | null
          id: string
          merchant_id: string
          offer_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          merchant_id: string
          offer_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          merchant_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_activity_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "partner_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_redemptions: {
        Row: {
          created_at: string | null
          id: string
          offer_id: string
          partner_confirmed: boolean | null
          redeemed_at: string | null
          redemption_code: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          offer_id: string
          partner_confirmed?: boolean | null
          redeemed_at?: string | null
          redemption_code: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          offer_id?: string
          partner_confirmed?: boolean | null
          redeemed_at?: string | null
          redemption_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_redemptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "partner_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_offers: {
        Row: {
          accepts_pawbucks: boolean
          accepts_usd: boolean
          brand_id: string | null
          cash_equivalent: number | null
          coins_required: number
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          offer_type: string
          partner_id: string
          per_user_limit: number | null
          product_id: string | null
          redemption_cap: number | null
          redemption_count: number | null
          require_approval: boolean | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          accepts_pawbucks?: boolean
          accepts_usd?: boolean
          brand_id?: string | null
          cash_equivalent?: number | null
          coins_required: number
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          offer_type?: string
          partner_id: string
          per_user_limit?: number | null
          product_id?: string | null
          redemption_cap?: number | null
          redemption_count?: number | null
          require_approval?: boolean | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          accepts_pawbucks?: boolean
          accepts_usd?: boolean
          brand_id?: string | null
          cash_equivalent?: number | null
          coins_required?: number
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          offer_type?: string
          partner_id?: string
          per_user_limit?: number | null
          product_id?: string | null
          redemption_cap?: number | null
          redemption_count?: number | null
          require_approval?: boolean | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_offers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_offers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_offers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_vets: {
        Row: {
          accepting_new_patients: boolean | null
          accreditations: string[] | null
          agreed_to_splicing_liability: boolean | null
          agreed_to_splicing_liability_at: string | null
          agreed_to_tos: boolean | null
          agreed_to_tos_at: string | null
          agreed_to_vet_addendum: boolean
          agreed_to_vet_addendum_at: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          checkin_qr_token: string | null
          clinic_bio: string | null
          clinic_name: string | null
          clinic_phone: string | null
          contact_email: string
          created_at: string
          data_sync_enabled: boolean | null
          dba_name: string | null
          denial_reason: string | null
          direct_pay_enabled: boolean | null
          emergency_phone: string | null
          emergency_protocol: string | null
          id: string
          insurance_partners: string[] | null
          is_verified: boolean | null
          last_notified_status: string | null
          license_number: string | null
          license_state: string | null
          location: string
          logo_url: string | null
          medical_director_name: string | null
          name: string
          npi_number: string | null
          pims_software: string | null
          practice_type: string | null
          preferred_referrals: string | null
          privacy_policy_url: string | null
          services_provided: string[] | null
          shipping_returns_policy_url: string | null
          sms_enabled: boolean | null
          splicing_fee: number | null
          splicing_preference: string | null
          stripe_account_id: string | null
          stripe_connect_account_id: string | null
          submission_email_sent_at: string | null
          subscription_tier: string | null
          tax_id: string | null
          tos_url: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          agreed_to_splicing_liability?: boolean | null
          agreed_to_splicing_liability_at?: string | null
          agreed_to_tos?: boolean | null
          agreed_to_tos_at?: string | null
          agreed_to_vet_addendum?: boolean
          agreed_to_vet_addendum_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          checkin_qr_token?: string | null
          clinic_bio?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          contact_email: string
          created_at?: string
          data_sync_enabled?: boolean | null
          dba_name?: string | null
          denial_reason?: string | null
          direct_pay_enabled?: boolean | null
          emergency_phone?: string | null
          emergency_protocol?: string | null
          id?: string
          insurance_partners?: string[] | null
          is_verified?: boolean | null
          last_notified_status?: string | null
          license_number?: string | null
          license_state?: string | null
          location: string
          logo_url?: string | null
          medical_director_name?: string | null
          name: string
          npi_number?: string | null
          pims_software?: string | null
          practice_type?: string | null
          preferred_referrals?: string | null
          privacy_policy_url?: string | null
          services_provided?: string[] | null
          shipping_returns_policy_url?: string | null
          sms_enabled?: boolean | null
          splicing_fee?: number | null
          splicing_preference?: string | null
          stripe_account_id?: string | null
          stripe_connect_account_id?: string | null
          submission_email_sent_at?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tos_url?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          agreed_to_splicing_liability?: boolean | null
          agreed_to_splicing_liability_at?: string | null
          agreed_to_tos?: boolean | null
          agreed_to_tos_at?: string | null
          agreed_to_vet_addendum?: boolean
          agreed_to_vet_addendum_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          checkin_qr_token?: string | null
          clinic_bio?: string | null
          clinic_name?: string | null
          clinic_phone?: string | null
          contact_email?: string
          created_at?: string
          data_sync_enabled?: boolean | null
          dba_name?: string | null
          denial_reason?: string | null
          direct_pay_enabled?: boolean | null
          emergency_phone?: string | null
          emergency_protocol?: string | null
          id?: string
          insurance_partners?: string[] | null
          is_verified?: boolean | null
          last_notified_status?: string | null
          license_number?: string | null
          license_state?: string | null
          location?: string
          logo_url?: string | null
          medical_director_name?: string | null
          name?: string
          npi_number?: string | null
          pims_software?: string | null
          practice_type?: string | null
          preferred_referrals?: string | null
          privacy_policy_url?: string | null
          services_provided?: string[] | null
          shipping_returns_policy_url?: string | null
          sms_enabled?: boolean | null
          splicing_fee?: number | null
          splicing_preference?: string | null
          stripe_account_id?: string | null
          stripe_connect_account_id?: string | null
          submission_email_sent_at?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tos_url?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      pawbucks_activity: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expires_at: string | null
          expiry_reminder_sent_days: number[] | null
          id: string
          offer_id: string | null
          partner_id: string | null
          pawbucks_status: string | null
          receipt_id: string | null
          redemption_code: string | null
          redemption_used: boolean | null
          slice_id: string | null
          source: string
          stripe_payment_intent_id: string | null
          transaction_id: string | null
          type: string
          user_id: string
          vest_date: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_reminder_sent_days?: number[] | null
          id?: string
          offer_id?: string | null
          partner_id?: string | null
          pawbucks_status?: string | null
          receipt_id?: string | null
          redemption_code?: string | null
          redemption_used?: boolean | null
          slice_id?: string | null
          source: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          type: string
          user_id: string
          vest_date?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_reminder_sent_days?: number[] | null
          id?: string
          offer_id?: string | null
          partner_id?: string | null
          pawbucks_status?: string | null
          receipt_id?: string | null
          redemption_code?: string | null
          redemption_used?: boolean | null
          slice_id?: string | null
          source?: string
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          type?: string
          user_id?: string
          vest_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pawbucks_activity_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "partner_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pawbucks_activity_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pawbucks_activity_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pawbucks_activity_slice_id_fkey"
            columns: ["slice_id"]
            isOneToOne: false
            referencedRelation: "invoice_slices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pawbucks_activity_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pawbucks_wallet: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          last_updated: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          last_updated?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          last_updated?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pending_onboarding: {
        Row: {
          accepting_new_patients: boolean | null
          accreditations: string[] | null
          admin_splicing_fee: number | null
          agreed_to_splicing_liability: boolean | null
          agreed_to_tos: boolean | null
          agreed_to_vet_addendum: boolean
          city: string | null
          clinic_bio: string | null
          completed_at: string | null
          created_at: string
          current_step: number
          data_sync_permission: boolean | null
          dba_name: string | null
          direct_pay_capability: boolean | null
          dvm_license_number: string | null
          dvm_license_state: string | null
          emergency_phone: string | null
          emergency_protocol: string | null
          form_data: Json | null
          id: string
          insurance_partners: string[] | null
          legal_practice_name: string | null
          medical_director_name: string | null
          npi_number: string | null
          onboarding_type: string
          physical_address: string | null
          pims_software: string | null
          practice_type: string | null
          preferred_referral_partners: string | null
          primary_phone: string | null
          services_provided: string[] | null
          sms_capability: boolean | null
          splicing_preference: string | null
          state: string | null
          stripe_account_id: string | null
          subscription_tier: string | null
          tax_id_ein: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
          zip_code: string | null
        }
        Insert: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          admin_splicing_fee?: number | null
          agreed_to_splicing_liability?: boolean | null
          agreed_to_tos?: boolean | null
          agreed_to_vet_addendum?: boolean
          city?: string | null
          clinic_bio?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          data_sync_permission?: boolean | null
          dba_name?: string | null
          direct_pay_capability?: boolean | null
          dvm_license_number?: string | null
          dvm_license_state?: string | null
          emergency_phone?: string | null
          emergency_protocol?: string | null
          form_data?: Json | null
          id?: string
          insurance_partners?: string[] | null
          legal_practice_name?: string | null
          medical_director_name?: string | null
          npi_number?: string | null
          onboarding_type?: string
          physical_address?: string | null
          pims_software?: string | null
          practice_type?: string | null
          preferred_referral_partners?: string | null
          primary_phone?: string | null
          services_provided?: string[] | null
          sms_capability?: boolean | null
          splicing_preference?: string | null
          state?: string | null
          stripe_account_id?: string | null
          subscription_tier?: string | null
          tax_id_ein?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Update: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          admin_splicing_fee?: number | null
          agreed_to_splicing_liability?: boolean | null
          agreed_to_tos?: boolean | null
          agreed_to_vet_addendum?: boolean
          city?: string | null
          clinic_bio?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          data_sync_permission?: boolean | null
          dba_name?: string | null
          direct_pay_capability?: boolean | null
          dvm_license_number?: string | null
          dvm_license_state?: string | null
          emergency_phone?: string | null
          emergency_protocol?: string | null
          form_data?: Json | null
          id?: string
          insurance_partners?: string[] | null
          legal_practice_name?: string | null
          medical_director_name?: string | null
          npi_number?: string | null
          onboarding_type?: string
          physical_address?: string | null
          pims_software?: string | null
          practice_type?: string | null
          preferred_referral_partners?: string | null
          primary_phone?: string | null
          services_provided?: string[] | null
          sms_capability?: boolean | null
          splicing_preference?: string | null
          state?: string | null
          stripe_account_id?: string | null
          subscription_tier?: string | null
          tax_id_ein?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      personality_evolutions: {
        Row: {
          base_personality: string
          bonus_perks: Json | null
          created_at: string
          duration_days: number
          evolution_name: string
          evolved_personality: string
          id: string
          is_active: boolean
          trigger_threshold: Json
          trigger_type: string
        }
        Insert: {
          base_personality: string
          bonus_perks?: Json | null
          created_at?: string
          duration_days?: number
          evolution_name: string
          evolved_personality: string
          id?: string
          is_active?: boolean
          trigger_threshold: Json
          trigger_type: string
        }
        Update: {
          base_personality?: string
          bonus_perks?: Json | null
          created_at?: string
          duration_days?: number
          evolution_name?: string
          evolved_personality?: string
          id?: string
          is_active?: boolean
          trigger_threshold?: Json
          trigger_type?: string
        }
        Relationships: []
      }
      personality_perks: {
        Row: {
          created_at: string
          description: string
          emoji: string
          id: string
          is_active: boolean
          name: string
          perk_type: string
          perk_value: number | null
          perk_value_type: string
          personality_type: string
          service_category: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          emoji: string
          id?: string
          is_active?: boolean
          name: string
          perk_type: string
          perk_value?: number | null
          perk_value_type: string
          personality_type: string
          service_category?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          perk_type?: string
          perk_value?: number | null
          perk_value_type?: string
          personality_type?: string
          service_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pet_allergies: {
        Row: {
          allergy_name: string
          allergy_type: string
          created_at: string
          first_observed_date: string | null
          id: string
          is_active: boolean
          notes: string | null
          pet_id: string
          reaction_description: string | null
          severity: string
          updated_at: string
          vet_id: string | null
        }
        Insert: {
          allergy_name: string
          allergy_type: string
          created_at?: string
          first_observed_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pet_id: string
          reaction_description?: string | null
          severity?: string
          updated_at?: string
          vet_id?: string | null
        }
        Update: {
          allergy_name?: string
          allergy_type?: string
          created_at?: string
          first_observed_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pet_id?: string
          reaction_description?: string | null
          severity?: string
          updated_at?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_allergies_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_allergies_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_allergies_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_consent_requests: {
        Row: {
          access_token: string
          consent_type: string
          cost_range_max: number | null
          cost_range_min: number | null
          created_at: string
          description: string
          estimated_cost: number | null
          expires_at: string
          id: string
          owner_id: string
          pet_id: string
          procedure_details: string | null
          reminder_sent_at: string | null
          risks_disclosed: string | null
          sent_via: string | null
          signature_data: string | null
          signed_at: string | null
          signed_name: string | null
          signer_ip_address: string | null
          signer_user_agent: string | null
          status: Database["public"]["Enums"]["consent_status"]
          template_id: string | null
          title: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          access_token?: string
          consent_type: string
          cost_range_max?: number | null
          cost_range_min?: number | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          expires_at?: string
          id?: string
          owner_id: string
          pet_id: string
          procedure_details?: string | null
          reminder_sent_at?: string | null
          risks_disclosed?: string | null
          sent_via?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          signer_ip_address?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          access_token?: string
          consent_type?: string
          cost_range_max?: number | null
          cost_range_min?: number | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          expires_at?: string
          id?: string
          owner_id?: string
          pet_id?: string
          procedure_details?: string | null
          reminder_sent_at?: string | null
          risks_disclosed?: string | null
          sent_via?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          signer_ip_address?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_consent_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_consent_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_consent_requests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_consent_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vet_consent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_consent_requests_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_consent_requests_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_email_addresses: {
        Row: {
          created_at: string
          email_address: string
          id: string
          is_active: boolean
          pet_id: string
          short_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_address: string
          id?: string
          is_active?: boolean
          pet_id: string
          short_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_address?: string
          id?: string
          is_active?: boolean
          pet_id?: string
          short_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_email_addresses_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_fund_ledgers: {
        Row: {
          available_balance: number
          cluster_id: string | null
          created_at: string
          device_fingerprint: string | null
          escrow_balance: number
          id: string
          ip_address: string | null
          referred_by: string | null
          series_tier: string
          status: string
          total_amount: number
          total_released: number
          total_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          cluster_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          escrow_balance?: number
          id?: string
          ip_address?: string | null
          referred_by?: string | null
          series_tier?: string
          status?: string
          total_amount?: number
          total_released?: number
          total_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          cluster_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          escrow_balance?: number
          id?: string
          ip_address?: string | null
          referred_by?: string | null
          series_tier?: string
          status?: string
          total_amount?: number
          total_released?: number
          total_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_fund_referrer_bonuses: {
        Row: {
          amount: number
          created_at: string
          first_purchase_at: string | null
          id: string
          referee_id: string
          referrer_id: string
          release_at: string | null
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          first_purchase_at?: string | null
          id?: string
          referee_id: string
          referrer_id: string
          release_at?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          first_purchase_at?: string | null
          id?: string
          referee_id?: string
          referrer_id?: string
          release_at?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pet_fund_releases: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          expiry_reminder_sent_days: number[]
          id: string
          ledger_id: string
          min_transaction_usd: number
          month_number: number
          released_at: string | null
          scheduled_at: string
          status: string
          used_at: string | null
          used_transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          expiry_reminder_sent_days?: number[]
          id?: string
          ledger_id: string
          min_transaction_usd?: number
          month_number: number
          released_at?: string | null
          scheduled_at: string
          status?: string
          used_at?: string | null
          used_transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          expiry_reminder_sent_days?: number[]
          id?: string
          ledger_id?: string
          min_transaction_usd?: number
          month_number?: number
          released_at?: string | null
          scheduled_at?: string
          status?: string
          used_at?: string | null
          used_transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_fund_releases_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "pet_fund_ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_health_access_codes: {
        Row: {
          access_code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          owner_id: string
          pet_id: string
          vet_clinic: string | null
          vet_email: string | null
          vet_name: string
        }
        Insert: {
          access_code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          owner_id: string
          pet_id: string
          vet_clinic?: string | null
          vet_email?: string | null
          vet_name: string
        }
        Update: {
          access_code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          owner_id?: string
          pet_id?: string
          vet_clinic?: string | null
          vet_email?: string | null
          vet_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_health_access_codes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_imaging_records: {
        Row: {
          body_region: string
          created_at: string
          findings: string | null
          follow_up_recommended: boolean | null
          id: string
          image_urls: string[]
          imaging_date: string
          imaging_type: Database["public"]["Enums"]["imaging_type"]
          indication: string
          interpretation: string | null
          is_abnormal: boolean | null
          pet_id: string
          radiologist_notes: string | null
          soap_note_id: string | null
          thumbnail_url: string | null
          updated_at: string
          vet_id: string | null
          views: string[] | null
        }
        Insert: {
          body_region: string
          created_at?: string
          findings?: string | null
          follow_up_recommended?: boolean | null
          id?: string
          image_urls?: string[]
          imaging_date?: string
          imaging_type: Database["public"]["Enums"]["imaging_type"]
          indication: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          pet_id: string
          radiologist_notes?: string | null
          soap_note_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          vet_id?: string | null
          views?: string[] | null
        }
        Update: {
          body_region?: string
          created_at?: string
          findings?: string | null
          follow_up_recommended?: boolean | null
          id?: string
          image_urls?: string[]
          imaging_date?: string
          imaging_type?: Database["public"]["Enums"]["imaging_type"]
          indication?: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          pet_id?: string
          radiologist_notes?: string | null
          soap_note_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          vet_id?: string | null
          views?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_imaging_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_imaging_records_soap_note_id_fkey"
            columns: ["soap_note_id"]
            isOneToOne: false
            referencedRelation: "pet_soap_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_imaging_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_imaging_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_inbound_documents: {
        Row: {
          ai_confidence: number | null
          ai_summary: string | null
          category: string
          created_at: string
          email_id: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          is_reviewed: boolean
          pet_id: string
          sender_email: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_summary?: string | null
          category?: string
          created_at?: string
          email_id?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_reviewed?: boolean
          pet_id: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_summary?: string | null
          category?: string
          created_at?: string
          email_id?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_reviewed?: boolean
          pet_id?: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_inbound_documents_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "pet_inbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_inbound_documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_inbound_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          pet_email_id: string
          pet_id: string
          processing_status: string
          received_at: string
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          pet_email_id: string
          pet_id: string
          processing_status?: string
          received_at?: string
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          pet_email_id?: string
          pet_id?: string
          processing_status?: string
          received_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_inbound_emails_pet_email_id_fkey"
            columns: ["pet_email_id"]
            isOneToOne: false
            referencedRelation: "pet_email_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_inbound_emails_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_insurance_policies: {
        Row: {
          annual_limit: number | null
          annual_used: number | null
          copay_percentage: number | null
          coverage_type: string | null
          created_at: string | null
          deductible_amount: number | null
          deductible_met: number | null
          effective_date: string
          expiration_date: string | null
          group_number: string | null
          id: string
          is_active: boolean | null
          member_id: string | null
          pet_id: string
          policy_holder_email: string | null
          policy_holder_name: string | null
          policy_holder_phone: string | null
          policy_number: string
          provider_id: string
          updated_at: string | null
        }
        Insert: {
          annual_limit?: number | null
          annual_used?: number | null
          copay_percentage?: number | null
          coverage_type?: string | null
          created_at?: string | null
          deductible_amount?: number | null
          deductible_met?: number | null
          effective_date: string
          expiration_date?: string | null
          group_number?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          pet_id: string
          policy_holder_email?: string | null
          policy_holder_name?: string | null
          policy_holder_phone?: string | null
          policy_number: string
          provider_id: string
          updated_at?: string | null
        }
        Update: {
          annual_limit?: number | null
          annual_used?: number | null
          copay_percentage?: number | null
          coverage_type?: string | null
          created_at?: string | null
          deductible_amount?: number | null
          deductible_met?: number | null
          effective_date?: string
          expiration_date?: string | null
          group_number?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          pet_id?: string
          policy_holder_email?: string | null
          policy_holder_name?: string | null
          policy_holder_phone?: string | null
          policy_number?: string
          provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_insurance_policies_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_insurance_policies_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "vet_insurance_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_lab_results: {
        Row: {
          abnormal_flags: string[] | null
          created_at: string
          file_url: string | null
          id: string
          interpretation: string | null
          lab_name: string | null
          notes: string | null
          pet_id: string
          result_summary: string | null
          results: Json
          reviewed_at: string | null
          reviewed_by: string | null
          soap_note_id: string | null
          status: Database["public"]["Enums"]["lab_result_status"]
          test_category: string
          test_date: string
          test_type: string
          updated_at: string
          vet_id: string | null
        }
        Insert: {
          abnormal_flags?: string[] | null
          created_at?: string
          file_url?: string | null
          id?: string
          interpretation?: string | null
          lab_name?: string | null
          notes?: string | null
          pet_id: string
          result_summary?: string | null
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          soap_note_id?: string | null
          status?: Database["public"]["Enums"]["lab_result_status"]
          test_category: string
          test_date?: string
          test_type: string
          updated_at?: string
          vet_id?: string | null
        }
        Update: {
          abnormal_flags?: string[] | null
          created_at?: string
          file_url?: string | null
          id?: string
          interpretation?: string | null
          lab_name?: string | null
          notes?: string | null
          pet_id?: string
          result_summary?: string | null
          results?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          soap_note_id?: string | null
          status?: Database["public"]["Enums"]["lab_result_status"]
          test_category?: string
          test_date?: string
          test_type?: string
          updated_at?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_lab_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lab_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lab_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lab_results_soap_note_id_fkey"
            columns: ["soap_note_id"]
            isOneToOne: false
            referencedRelation: "pet_soap_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lab_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_lab_results_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_medical_records: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          pet_id: string
          price: number | null
          quantity: number | null
          record_date: string
          record_type: Database["public"]["Enums"]["medical_record_type"]
          title: string
          updated_at: string
          user_id: string
          vet_id: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          pet_id: string
          price?: number | null
          quantity?: number | null
          record_date: string
          record_type: Database["public"]["Enums"]["medical_record_type"]
          title: string
          updated_at?: string
          user_id: string
          vet_id?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          pet_id?: string
          price?: number | null
          quantity?: number | null
          record_date?: string
          record_type?: Database["public"]["Enums"]["medical_record_type"]
          title?: string
          updated_at?: string
          user_id?: string
          vet_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_medical_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_medical_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_medical_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_medical_records_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "pet_medical_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_medical_visits: {
        Row: {
          created_at: string
          doctor_name: string | null
          id: string
          notes: string | null
          pet_id: string
          updated_at: string
          user_id: string
          vet_id: string | null
          vet_name: string | null
          visit_date: string
        }
        Insert: {
          created_at?: string
          doctor_name?: string | null
          id?: string
          notes?: string | null
          pet_id: string
          updated_at?: string
          user_id: string
          vet_id?: string | null
          vet_name?: string | null
          visit_date: string
        }
        Update: {
          created_at?: string
          doctor_name?: string | null
          id?: string
          notes?: string | null
          pet_id?: string
          updated_at?: string
          user_id?: string
          vet_id?: string | null
          vet_name?: string | null
          visit_date?: string
        }
        Relationships: []
      }
      pet_personality_types: {
        Row: {
          avatar_style: string
          badge_text: string
          color_primary: string
          color_secondary: string
          created_at: string
          description: string
          emoji: string
          id: string
          is_active: boolean | null
          name: string
          tagline: string
          tips: string[]
          traits: string[]
          type_key: string
        }
        Insert: {
          avatar_style: string
          badge_text: string
          color_primary: string
          color_secondary: string
          created_at?: string
          description: string
          emoji: string
          id?: string
          is_active?: boolean | null
          name: string
          tagline: string
          tips?: string[]
          traits?: string[]
          type_key: string
        }
        Update: {
          avatar_style?: string
          badge_text?: string
          color_primary?: string
          color_secondary?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tagline?: string
          tips?: string[]
          traits?: string[]
          type_key?: string
        }
        Relationships: []
      }
      pet_profiles: {
        Row: {
          age_estimate: string | null
          birthday: string | null
          breed: string | null
          collar_description: string | null
          color_markings: string | null
          created_at: string
          digital_id_token: string | null
          gender: string | null
          id: string
          identifying_features: string | null
          microchip_number: string | null
          name: string
          personality_completed_at: string | null
          personality_quiz_answers: Json | null
          personality_quiz_completed: boolean | null
          personality_type: string | null
          photo_url: string | null
          size: string | null
          type: Database["public"]["Enums"]["pet_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          age_estimate?: string | null
          birthday?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings?: string | null
          created_at?: string
          digital_id_token?: string | null
          gender?: string | null
          id?: string
          identifying_features?: string | null
          microchip_number?: string | null
          name: string
          personality_completed_at?: string | null
          personality_quiz_answers?: Json | null
          personality_quiz_completed?: boolean | null
          personality_type?: string | null
          photo_url?: string | null
          size?: string | null
          type: Database["public"]["Enums"]["pet_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          age_estimate?: string | null
          birthday?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings?: string | null
          created_at?: string
          digital_id_token?: string | null
          gender?: string | null
          id?: string
          identifying_features?: string | null
          microchip_number?: string | null
          name?: string
          personality_completed_at?: string | null
          personality_quiz_answers?: Json | null
          personality_quiz_completed?: boolean | null
          personality_type?: string | null
          photo_url?: string | null
          size?: string | null
          type?: Database["public"]["Enums"]["pet_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_soap_notes: {
        Row: {
          amended_at: string | null
          amendment_reason: string | null
          assessment_differential_diagnoses: string[] | null
          assessment_primary_diagnosis: string
          assessment_prognosis: string | null
          created_at: string
          finalized_at: string | null
          id: string
          objective_body_condition_score: number | null
          objective_findings: string | null
          objective_heart_rate: number | null
          objective_physical_exam: string
          objective_respiratory_rate: number | null
          objective_temperature: number | null
          objective_weight: number | null
          pet_id: string
          plan_client_education: string | null
          plan_follow_up: string | null
          plan_medications: string | null
          plan_referral: string | null
          plan_treatment: string
          status: Database["public"]["Enums"]["soap_note_status"]
          subjective_chief_complaint: string
          subjective_duration: string | null
          subjective_history: string | null
          subjective_owner_observations: string | null
          updated_at: string
          vet_id: string | null
          visit_date: string
        }
        Insert: {
          amended_at?: string | null
          amendment_reason?: string | null
          assessment_differential_diagnoses?: string[] | null
          assessment_primary_diagnosis: string
          assessment_prognosis?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          objective_body_condition_score?: number | null
          objective_findings?: string | null
          objective_heart_rate?: number | null
          objective_physical_exam: string
          objective_respiratory_rate?: number | null
          objective_temperature?: number | null
          objective_weight?: number | null
          pet_id: string
          plan_client_education?: string | null
          plan_follow_up?: string | null
          plan_medications?: string | null
          plan_referral?: string | null
          plan_treatment: string
          status?: Database["public"]["Enums"]["soap_note_status"]
          subjective_chief_complaint: string
          subjective_duration?: string | null
          subjective_history?: string | null
          subjective_owner_observations?: string | null
          updated_at?: string
          vet_id?: string | null
          visit_date?: string
        }
        Update: {
          amended_at?: string | null
          amendment_reason?: string | null
          assessment_differential_diagnoses?: string[] | null
          assessment_primary_diagnosis?: string
          assessment_prognosis?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          objective_body_condition_score?: number | null
          objective_findings?: string | null
          objective_heart_rate?: number | null
          objective_physical_exam?: string
          objective_respiratory_rate?: number | null
          objective_temperature?: number | null
          objective_weight?: number | null
          pet_id?: string
          plan_client_education?: string | null
          plan_follow_up?: string | null
          plan_medications?: string | null
          plan_referral?: string | null
          plan_treatment?: string
          status?: Database["public"]["Enums"]["soap_note_status"]
          subjective_chief_complaint?: string
          subjective_duration?: string | null
          subjective_history?: string | null
          subjective_owner_observations?: string | null
          updated_at?: string
          vet_id?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_soap_notes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_soap_notes_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_soap_notes_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_store_items: {
        Row: {
          brand_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_active: boolean
          item_type: string
          merchant_id: string | null
          name: string
          price: number
          price_pawbucks: number
          rating_avg: number | null
          rating_count: number | null
          sku: string | null
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          item_type?: string
          merchant_id?: string | null
          name: string
          price: number
          price_pawbucks?: number
          rating_avg?: number | null
          rating_count?: number | null
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          item_type?: string
          merchant_id?: string | null
          name?: string
          price?: number
          price_pawbucks?: number
          rating_avg?: number | null
          rating_count?: number | null
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_store_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_store_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_store_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_store_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          order_id: string
          price_per_item: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          order_id: string
          price_per_item: number
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          order_id?: string
          price_per_item?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_store_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pet_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pet_store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_store_orders: {
        Row: {
          created_at: string
          id: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_store_reviews: {
        Row: {
          body: string | null
          created_at: string
          helpful_count: number
          id: string
          is_verified_purchase: boolean
          item_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          item_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          item_id?: string
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_store_reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pet_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_surgical_notes: {
        Row: {
          anesthesia_duration_minutes: number | null
          anesthesia_type: string | null
          complications: string | null
          created_at: string
          follow_up_date: string | null
          follow_up_required: boolean
          id: string
          operative_notes: string
          outcome: string
          pet_id: string
          post_op_notes: string | null
          pre_op_notes: string | null
          procedure_code: string | null
          procedure_name: string
          surgery_date: string
          updated_at: string
          vet_id: string | null
        }
        Insert: {
          anesthesia_duration_minutes?: number | null
          anesthesia_type?: string | null
          complications?: string | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          operative_notes: string
          outcome?: string
          pet_id: string
          post_op_notes?: string | null
          pre_op_notes?: string | null
          procedure_code?: string | null
          procedure_name: string
          surgery_date: string
          updated_at?: string
          vet_id?: string | null
        }
        Update: {
          anesthesia_duration_minutes?: number | null
          anesthesia_type?: string | null
          complications?: string | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_required?: boolean
          id?: string
          operative_notes?: string
          outcome?: string
          pet_id?: string
          post_op_notes?: string | null
          pre_op_notes?: string | null
          procedure_code?: string | null
          procedure_name?: string
          surgery_date?: string
          updated_at?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_surgical_notes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_surgical_notes_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_surgical_notes_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_timeline_moments: {
        Row: {
          amount: number | null
          created_at: string
          emoji: string
          id: string
          merchant_category: string | null
          merchant_name: string | null
          moment_date: string
          moment_type: string
          mood: string | null
          narrative: string
          pawbucks_earned: number | null
          pet_id: string
          photo_prompt: string | null
          photo_url: string | null
          title: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          emoji?: string
          id?: string
          merchant_category?: string | null
          merchant_name?: string | null
          moment_date?: string
          moment_type?: string
          mood?: string | null
          narrative: string
          pawbucks_earned?: number | null
          pet_id: string
          photo_prompt?: string | null
          photo_url?: string | null
          title: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          emoji?: string
          id?: string
          merchant_category?: string | null
          merchant_name?: string | null
          moment_date?: string
          moment_type?: string
          mood?: string | null
          narrative?: string
          pawbucks_earned?: number | null
          pet_id?: string
          photo_prompt?: string | null
          photo_url?: string | null
          title?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_timeline_moments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_timeline_moments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_vaccinations: {
        Row: {
          administered_by: string | null
          administration_date: string
          administration_site: string | null
          certificate_url: string | null
          created_at: string
          dose: string | null
          expiration_date: string | null
          id: string
          lot_number: string | null
          manufacturer: string | null
          next_due_date: string | null
          pet_id: string
          reaction_notes: string | null
          route: string | null
          serial_number: string | null
          updated_at: string
          vaccine_name: string
          vaccine_type: string
          vet_id: string | null
        }
        Insert: {
          administered_by?: string | null
          administration_date: string
          administration_site?: string | null
          certificate_url?: string | null
          created_at?: string
          dose?: string | null
          expiration_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          pet_id: string
          reaction_notes?: string | null
          route?: string | null
          serial_number?: string | null
          updated_at?: string
          vaccine_name: string
          vaccine_type: string
          vet_id?: string | null
        }
        Update: {
          administered_by?: string | null
          administration_date?: string
          administration_site?: string | null
          certificate_url?: string | null
          created_at?: string
          dose?: string | null
          expiration_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          pet_id?: string
          reaction_notes?: string | null
          route?: string | null
          serial_number?: string | null
          updated_at?: string
          vaccine_name?: string
          vaccine_type?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_vaccinations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_vaccinations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          phone: string
          token_expires_at: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          phone: string
          token_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          phone?: string
          token_expires_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      platform_notification_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      platform_promotion_invitations: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string
          message: string | null
          promotion_id: string
          recipient_id: string
          recipient_type: string
          responded_at: string | null
          status: Database["public"]["Enums"]["platform_promotion_invitation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          message?: string | null
          promotion_id: string
          recipient_id: string
          recipient_type: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["platform_promotion_invitation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          message?: string | null
          promotion_id?: string
          recipient_id?: string
          recipient_type?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["platform_promotion_invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_promotion_invitations_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "platform_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_promotions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          perks: string | null
          recipient_type: Database["public"]["Enums"]["platform_promotion_recipient_type"]
          reward_amount_usd: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["platform_promotion_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          perks?: string | null
          recipient_type?: Database["public"]["Enums"]["platform_promotion_recipient_type"]
          reward_amount_usd?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["platform_promotion_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          perks?: string | null
          recipient_type?: Database["public"]["Enums"]["platform_promotion_recipient_type"]
          reward_amount_usd?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["platform_promotion_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      pms_field_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          is_active: boolean | null
          pawbucks_entity: string
          pawbucks_field: string
          pms_entity: string
          pms_field: string
          transform_function: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          is_active?: boolean | null
          pawbucks_entity: string
          pawbucks_field: string
          pms_entity: string
          pms_field: string
          transform_function?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          is_active?: boolean | null
          pawbucks_entity?: string
          pawbucks_field?: string
          pms_entity?: string
          pms_field?: string
          transform_function?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pms_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "vet_pms_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_sync_logs: {
        Row: {
          completed_at: string | null
          details: Json | null
          direction: string
          error_message: string | null
          id: string
          integration_id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          direction: string
          error_message?: string | null
          id?: string
          integration_id: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          direction?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pms_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "vet_pms_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_phone: string | null
          error_message: string | null
          external_transaction_id: string | null
          id: string
          integration_id: string
          items: Json | null
          matched_user_id: string | null
          merchant_id: string
          pawbucks_awarded: number | null
          pos_timestamp: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_phone?: string | null
          error_message?: string | null
          external_transaction_id?: string | null
          id?: string
          integration_id: string
          items?: Json | null
          matched_user_id?: string | null
          merchant_id: string
          pawbucks_awarded?: number | null
          pos_timestamp?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_phone?: string | null
          error_message?: string | null
          external_transaction_id?: string | null
          id?: string
          integration_id?: string
          items?: Json | null
          matched_user_id?: string | null
          merchant_id?: string
          pawbucks_awarded?: number | null
          pos_timestamp?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "merchant_pos_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_refill_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          current_dosage: string | null
          fulfillment_notes: string | null
          fulfillment_type: string | null
          id: string
          medication_name: string
          pet_id: string
          quantity_requested: number | null
          reason: string | null
          status: string
          updated_at: string | null
          user_id: string
          vet_id: string
          vet_notes: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          current_dosage?: string | null
          fulfillment_notes?: string | null
          fulfillment_type?: string | null
          id?: string
          medication_name: string
          pet_id: string
          quantity_requested?: number | null
          reason?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          vet_id: string
          vet_notes?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          current_dosage?: string | null
          fulfillment_notes?: string | null
          fulfillment_type?: string | null
          id?: string
          medication_name?: string
          pet_id?: string
          quantity_requested?: number | null
          reason?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          vet_id?: string
          vet_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_refill_requests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_refill_requests_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_refill_requests_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_redeem_max_apply_pct: number
          auto_redeem_min_coverage_pct: number
          auto_redeem_mode: string
          auto_redeem_pawbucks: boolean
          avatar_url: string | null
          banned_at: string | null
          banned_by: string | null
          banned_reason: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_banned: boolean
          normalized_email: string | null
          phone: string | null
          phone_verified: boolean
          referral_code: string | null
          stripe_customer_id: string | null
          timezone: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
          welcome_email_sent_at: string | null
        }
        Insert: {
          auto_redeem_max_apply_pct?: number
          auto_redeem_min_coverage_pct?: number
          auto_redeem_mode?: string
          auto_redeem_pawbucks?: boolean
          avatar_url?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_banned?: boolean
          normalized_email?: string | null
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_type: Database["public"]["Enums"]["user_type"]
          welcome_email_sent_at?: string | null
        }
        Update: {
          auto_redeem_max_apply_pct?: number
          auto_redeem_min_coverage_pct?: number
          auto_redeem_mode?: string
          auto_redeem_pawbucks?: boolean
          avatar_url?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_banned?: boolean
          normalized_email?: string | null
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      punch_card_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          punch_card_id: string
          punches_added: number
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          punch_card_id: string
          punches_added?: number
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          punch_card_id?: string
          punches_added?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_card_events_punch_card_id_fkey"
            columns: ["punch_card_id"]
            isOneToOne: false
            referencedRelation: "customer_punch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_card_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_submissions: {
        Row: {
          admin_notes: string | null
          confirmation_id: string | null
          created_at: string
          credit_rate_percent: number | null
          decision_reason: string | null
          id: string
          merchant_id: string | null
          merchant_name: string
          pawbucks_awarded: number | null
          purchase_amount: number
          receipt_date: string
          receipt_image_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_type: string
          subscription_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          confirmation_id?: string | null
          created_at?: string
          credit_rate_percent?: number | null
          decision_reason?: string | null
          id?: string
          merchant_id?: string | null
          merchant_name: string
          pawbucks_awarded?: number | null
          purchase_amount: number
          receipt_date: string
          receipt_image_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_type?: string
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          confirmation_id?: string | null
          created_at?: string
          credit_rate_percent?: number | null
          decision_reason?: string | null
          id?: string
          merchant_id?: string | null
          merchant_name?: string
          pawbucks_awarded?: number | null
          purchase_amount?: number
          receipt_date?: string
          receipt_image_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_type?: string
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_submissions_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "merchant_sale_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_submissions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_submissions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referee_bonus_amount: number | null
          referee_bonus_awarded: boolean | null
          referee_id: string
          referral_code: string
          referrer_bonus_amount: number | null
          referrer_bonus_awarded: boolean | null
          referrer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          referee_bonus_amount?: number | null
          referee_bonus_awarded?: boolean | null
          referee_id: string
          referral_code: string
          referrer_bonus_amount?: number | null
          referrer_bonus_awarded?: boolean | null
          referrer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          referee_bonus_amount?: number | null
          referee_bonus_awarded?: boolean | null
          referee_id?: string
          referral_code?: string
          referrer_bonus_amount?: number | null
          referrer_bonus_awarded?: boolean | null
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_attempts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          initiated_by: string | null
          merchant_id: string | null
          note: string | null
          pawbucks_earned_reversed: number
          pawbucks_spent_returned: number
          reason: string | null
          refund_amount: number
          status: string
          stripe_refund_id: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          initiated_by?: string | null
          merchant_id?: string | null
          note?: string | null
          pawbucks_earned_reversed?: number
          pawbucks_spent_returned?: number
          reason?: string | null
          refund_amount: number
          status?: string
          stripe_refund_id?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          initiated_by?: string | null
          merchant_id?: string | null
          note?: string | null
          pawbucks_earned_reversed?: number
          pawbucks_spent_returned?: number
          reason?: string | null
          refund_amount?: number
          status?: string
          stripe_refund_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_attempts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_attempts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_attempts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "merchant_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "merchant_reviews_public"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          address: string
          booking_id: string | null
          created_at: string | null
          customer_name: string | null
          drive_distance_miles: number | null
          drive_duration_minutes: number | null
          estimated_arrival: string | null
          estimated_departure: string | null
          id: string
          latitude: number
          longitude: number
          route_plan_id: string
          service_name: string | null
          status: string
          stop_order: number
          updated_at: string | null
        }
        Insert: {
          address: string
          booking_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          drive_distance_miles?: number | null
          drive_duration_minutes?: number | null
          estimated_arrival?: string | null
          estimated_departure?: string | null
          id?: string
          latitude: number
          longitude: number
          route_plan_id: string
          service_name?: string | null
          status?: string
          stop_order: number
          updated_at?: string | null
        }
        Update: {
          address?: string
          booking_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          drive_distance_miles?: number | null
          drive_duration_minutes?: number | null
          estimated_arrival?: string | null
          estimated_departure?: string | null
          id?: string
          latitude?: number
          longitude?: number
          route_plan_id?: string
          service_name?: string | null
          status?: string
          stop_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "merchant_route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      search_boost_config: {
        Row: {
          created_at: string
          id: string
          impression_window_days: number
          max_boosted_in_top_n: number
          max_impression_share_pct: number
          service_id: string
          top_n_results: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          impression_window_days?: number
          max_boosted_in_top_n?: number
          max_impression_share_pct?: number
          service_id: string
          top_n_results?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          impression_window_days?: number
          max_boosted_in_top_n?: number
          max_impression_share_pct?: number
          service_id?: string
          top_n_results?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_boost_config_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      search_ranking_analytics: {
        Row: {
          category_match: boolean | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          is_boosted: boolean | null
          local_match: boolean | null
          merchant_id: string
          position: number | null
          search_term: string | null
          session_id: string | null
          source_page: string
          user_id: string | null
        }
        Insert: {
          category_match?: boolean | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          is_boosted?: boolean | null
          local_match?: boolean | null
          merchant_id: string
          position?: number | null
          search_term?: string | null
          session_id?: string | null
          source_page: string
          user_id?: string | null
        }
        Update: {
          category_match?: boolean | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          is_boosted?: boolean | null
          local_match?: boolean | null
          merchant_id?: string
          position?: number | null
          search_term?: string | null
          session_id?: string | null
          source_page?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_ranking_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_ranking_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      search_ranking_daily_stats: {
        Row: {
          avg_position: number | null
          best_position: number | null
          category_impressions: number
          clicks: number
          conversions: number
          created_at: string
          date: string
          id: string
          impressions: number
          local_impressions: number
          merchant_id: string
          top_search_terms: Json | null
          unique_searchers: number
          updated_at: string
        }
        Insert: {
          avg_position?: number | null
          best_position?: number | null
          category_impressions?: number
          clicks?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          local_impressions?: number
          merchant_id: string
          top_search_terms?: Json | null
          unique_searchers?: number
          updated_at?: string
        }
        Update: {
          avg_position?: number | null
          best_position?: number | null
          category_impressions?: number
          clicks?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          local_impressions?: number
          merchant_id?: string
          top_search_terms?: Json | null
          unique_searchers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_ranking_daily_stats_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_ranking_daily_stats_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          details: Json | null
          email: string | null
          id: string
          ip_address: string | null
          is_resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: string
          ip_address?: string | null
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: string
          ip_address?: string | null
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      service_bookings: {
        Row: {
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cash_due: number | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_amount: number | null
          deposit_status: string | null
          end_time: string
          id: string
          is_recurring: boolean
          location_notes: string | null
          merchant_id: string
          no_show_at: string | null
          notes: string | null
          pawbucks_applied: number
          pawbucks_discount_usd: number
          payment_status: string
          pet_id: string | null
          recurring_end_date: string | null
          recurring_interval: string | null
          recurring_parent_id: string | null
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          rescheduled_from_id: string | null
          service_address: string | null
          service_id: string
          service_latitude: number | null
          service_longitude: number | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id: string | null
          stripe_payment_method_id: string | null
          stripe_setup_intent_id: string | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cash_due?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean
          location_notes?: string | null
          merchant_id: string
          no_show_at?: string | null
          notes?: string | null
          pawbucks_applied?: number
          pawbucks_discount_usd?: number
          payment_status?: string
          pet_id?: string | null
          recurring_end_date?: string | null
          recurring_interval?: string | null
          recurring_parent_id?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          rescheduled_from_id?: string | null
          service_address?: string | null
          service_id: string
          service_latitude?: number | null
          service_longitude?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cash_due?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean
          location_notes?: string | null
          merchant_id?: string
          no_show_at?: string | null
          notes?: string | null
          pawbucks_applied?: number
          pawbucks_discount_usd?: number
          payment_status?: string
          pet_id?: string | null
          recurring_end_date?: string | null
          recurring_interval?: string | null
          recurring_parent_id?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          rescheduled_from_id?: string | null
          service_address?: string | null
          service_id?: string
          service_latitude?: number | null
          service_longitude?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_recurring_parent_id_fkey"
            columns: ["recurring_parent_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_conversion_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          merchant_id: string
          metadata: Json | null
          service_name: string
          session_id: string | null
          source_page: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          merchant_id: string
          metadata?: Json | null
          service_name: string
          session_id?: string | null
          source_page?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          merchant_id?: string
          metadata?: Json | null
          service_name?: string
          session_id?: string | null
          source_page?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_conversion_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_conversion_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      service_credit_usage: {
        Row: {
          amount_used: number
          credit_id: string
          id: string
          transaction_id: string | null
          used_at: string
        }
        Insert: {
          amount_used: number
          credit_id: string
          id?: string
          transaction_id?: string | null
          used_at?: string
        }
        Update: {
          amount_used?: number
          credit_id?: string
          id?: string
          transaction_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_credit_usage_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "service_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_credit_usage_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_credits: {
        Row: {
          created_at: string
          credit_value: number
          description: string
          expires_at: string
          id: string
          merchant_id: string | null
          remaining_value: number
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_value: number
          description: string
          expires_at: string
          id?: string
          merchant_id?: string | null
          remaining_value: number
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_value?: number
          description?: string
          expires_at?: string
          id?: string
          merchant_id?: string | null
          remaining_value?: number
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_credits_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_credits_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      service_global_caps: {
        Row: {
          created_at: string
          enforce_per_category_max: number | null
          id: string
          max_total_slots: number
          service_id: string
          time_window_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enforce_per_category_max?: number | null
          id?: string
          max_total_slots: number
          service_id: string
          time_window_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enforce_per_category_max?: number | null
          id?: string
          max_total_slots?: number
          service_id?: string
          time_window_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_global_caps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_performance_daily: {
        Row: {
          bookings: number | null
          clicks: number | null
          created_at: string
          date: string
          id: string
          impressions: number | null
          merchant_id: string
          profile_views: number | null
          reviews: number | null
          service_name: string
          transaction_revenue: number | null
          transactions: number | null
          updated_at: string
        }
        Insert: {
          bookings?: number | null
          clicks?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          merchant_id: string
          profile_views?: number | null
          reviews?: number | null
          service_name: string
          transaction_revenue?: number | null
          transactions?: number | null
          updated_at?: string
        }
        Update: {
          bookings?: number | null
          clicks?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          merchant_id?: string
          profile_views?: number | null
          reviews?: number | null
          service_name?: string
          transaction_revenue?: number | null
          transactions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_performance_daily_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_performance_daily_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_account_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string | null
          invited_at: string
          member_email: string
          member_id: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          member_email: string
          member_id?: string | null
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          member_email?: string
          member_id?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopping_cart_items: {
        Row: {
          added_at: string
          cart_id: string
          id: string
          item_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          added_at?: string
          cart_id: string
          id?: string
          item_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          added_at?: string
          cart_id?: string
          id?: string
          item_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "shopping_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_cart_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pet_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_carts: {
        Row: {
          abandoned_at: string | null
          converted_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abandoned_at?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abandoned_at?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsored_placement_analytics: {
        Row: {
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          merchant_id: string
          position: number | null
          search_query: string | null
          session_id: string | null
          source_page: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          merchant_id: string
          position?: number | null
          search_query?: string | null
          session_id?: string | null
          source_page: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          merchant_id?: string
          position?: number | null
          search_query?: string | null
          session_id?: string | null
          source_page?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_placement_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placement_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_placement_daily_stats: {
        Row: {
          avg_position: number | null
          clicks: number
          conversions: number
          created_at: string
          date: string
          id: string
          impressions: number
          merchant_id: string
          source_page: string
          unique_viewers: number
          updated_at: string
        }
        Insert: {
          avg_position?: number | null
          clicks?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          merchant_id: string
          source_page: string
          unique_viewers?: number
          updated_at?: string
        }
        Update: {
          avg_position?: number | null
          clicks?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          merchant_id?: string
          source_page?: string
          unique_viewers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_placement_daily_stats_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placement_daily_stats_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_locked_pawbucks: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_activity_at: string | null
          lifetime_earned: number
          lifetime_redeemed: number
          merchant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          lifetime_earned?: number
          lifetime_redeemed?: number
          merchant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          lifetime_earned?: number
          lifetime_redeemed?: number
          merchant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locked_pawbucks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_locked_pawbucks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_locked_pawbucks_activity: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          merchant_id: string
          transaction_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id: string
          transaction_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string
          transaction_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locked_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_locked_pawbucks_activity_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          event_type: string
          id: string
          subscription_id: string
          timestamp: string
        }
        Insert: {
          event_type: string
          id?: string
          subscription_id: string
          timestamp?: string
        }
        Update: {
          event_type?: string
          id?: string
          subscription_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          expires_at: string | null
          id: string
          is_manual_upgrade: boolean | null
          reminder_24_hours_sent: boolean | null
          reminder_7_days_sent: boolean | null
          start_date: string
          status: string
          stripe_subscription_id: string | null
          subscription_tier: string | null
          updated_at: string | null
          upgraded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          is_manual_upgrade?: boolean | null
          reminder_24_hours_sent?: boolean | null
          reminder_7_days_sent?: boolean | null
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          upgraded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          is_manual_upgrade?: boolean | null
          reminder_24_hours_sent?: boolean | null
          reminder_7_days_sent?: boolean | null
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          upgraded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          attachment_urls: string[] | null
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          actual_behavior: string | null
          affected_feature: string | null
          assigned_to: string | null
          browser_info: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          description: string
          expected_behavior: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id: string | null
          related_merchant_id: string | null
          related_transaction_id: string | null
          related_vet_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_urls: string[] | null
          status: Database["public"]["Enums"]["ticket_status"]
          steps_to_reproduce: string | null
          subject: string
          submitter_type: Database["public"]["Enums"]["ticket_submitter_type"]
          ticket_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_behavior?: string | null
          affected_feature?: string | null
          assigned_to?: string | null
          browser_info?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description: string
          expected_behavior?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id?: string | null
          related_merchant_id?: string | null
          related_transaction_id?: string | null
          related_vet_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_urls?: string[] | null
          status?: Database["public"]["Enums"]["ticket_status"]
          steps_to_reproduce?: string | null
          subject: string
          submitter_type?: Database["public"]["Enums"]["ticket_submitter_type"]
          ticket_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_behavior?: string | null
          affected_feature?: string | null
          assigned_to?: string | null
          browser_info?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          description?: string
          expected_behavior?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id?: string | null
          related_merchant_id?: string | null
          related_transaction_id?: string | null
          related_vet_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_urls?: string[] | null
          status?: Database["public"]["Enums"]["ticket_status"]
          steps_to_reproduce?: string | null
          subject?: string
          submitter_type?: Database["public"]["Enums"]["ticket_submitter_type"]
          ticket_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_merchant_id_fkey"
            columns: ["related_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_merchant_id_fkey"
            columns: ["related_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_vet_id_fkey"
            columns: ["related_vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_vet_id_fkey"
            columns: ["related_vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_library: {
        Row: {
          category: string
          created_at: string
          follow_up_questions: Json | null
          id: string
          is_active: boolean | null
          species_applicable: string[] | null
          symptom_description: string | null
          symptom_name: string
          urgency_weight: number | null
        }
        Insert: {
          category: string
          created_at?: string
          follow_up_questions?: Json | null
          id?: string
          is_active?: boolean | null
          species_applicable?: string[] | null
          symptom_description?: string | null
          symptom_name: string
          urgency_weight?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          follow_up_questions?: Json | null
          id?: string
          is_active?: boolean | null
          species_applicable?: string[] | null
          symptom_description?: string | null
          symptom_name?: string
          urgency_weight?: number | null
        }
        Relationships: []
      }
      symptom_triage_assessments: {
        Row: {
          additional_notes: string | null
          affected_body_areas: Json | null
          ai_differential_considerations: Json | null
          ai_recommended_diagnostics: Json | null
          ai_recommended_questions: Json | null
          ai_summary: string | null
          ai_triage_reasoning: string | null
          ai_urgency_level: string | null
          ai_urgency_score: number | null
          appointment_id: string | null
          bathroom_habits: string | null
          behavioral_changes: Json | null
          chief_complaint: string
          created_at: string
          current_medications: string | null
          drinking_status: string | null
          eating_status: string | null
          energy_level: string | null
          id: string
          known_allergies: string | null
          model_used: string | null
          owner_id: string
          pet_id: string
          photo_urls: string[] | null
          processing_time_ms: number | null
          recent_changes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          symptom_duration: string | null
          symptom_onset: string | null
          symptom_progression: string | null
          symptoms: Json
          updated_at: string
          vet_id: string | null
          vet_notes: string | null
        }
        Insert: {
          additional_notes?: string | null
          affected_body_areas?: Json | null
          ai_differential_considerations?: Json | null
          ai_recommended_diagnostics?: Json | null
          ai_recommended_questions?: Json | null
          ai_summary?: string | null
          ai_triage_reasoning?: string | null
          ai_urgency_level?: string | null
          ai_urgency_score?: number | null
          appointment_id?: string | null
          bathroom_habits?: string | null
          behavioral_changes?: Json | null
          chief_complaint: string
          created_at?: string
          current_medications?: string | null
          drinking_status?: string | null
          eating_status?: string | null
          energy_level?: string | null
          id?: string
          known_allergies?: string | null
          model_used?: string | null
          owner_id: string
          pet_id: string
          photo_urls?: string[] | null
          processing_time_ms?: number | null
          recent_changes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          symptom_duration?: string | null
          symptom_onset?: string | null
          symptom_progression?: string | null
          symptoms?: Json
          updated_at?: string
          vet_id?: string | null
          vet_notes?: string | null
        }
        Update: {
          additional_notes?: string | null
          affected_body_areas?: Json | null
          ai_differential_considerations?: Json | null
          ai_recommended_diagnostics?: Json | null
          ai_recommended_questions?: Json | null
          ai_summary?: string | null
          ai_triage_reasoning?: string | null
          ai_urgency_level?: string | null
          ai_urgency_score?: number | null
          appointment_id?: string | null
          bathroom_habits?: string | null
          behavioral_changes?: Json | null
          chief_complaint?: string
          created_at?: string
          current_medications?: string | null
          drinking_status?: string | null
          eating_status?: string | null
          energy_level?: string | null
          id?: string
          known_allergies?: string | null
          model_used?: string | null
          owner_id?: string
          pet_id?: string
          photo_urls?: string[] | null
          processing_time_ms?: number | null
          recent_changes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          symptom_duration?: string | null
          symptom_onset?: string | null
          symptom_progression?: string | null
          symptoms?: Json
          updated_at?: string
          vet_id?: string | null
          vet_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "symptom_triage_assessments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptom_triage_assessments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      text_campaigns: {
        Row: {
          created_at: string
          created_by: string
          failed_count: number
          id: string
          message: string
          recipient_count: number
          recipient_type: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          message: string
          recipient_count?: number
          recipient_type?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          message?: string
          recipient_count?: number
          recipient_type?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      text_message_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          phone_number: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "text_message_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "text_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      training_course_lessons: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          module_id: string
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id: string
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id?: string
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_course_modules: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      training_course_resources: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          download_url: string | null
          id: string
          is_active: boolean | null
          resource_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          download_url?: string | null
          id?: string
          is_active?: boolean | null
          resource_type?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          download_url?: string | null
          id?: string
          is_active?: boolean | null
          resource_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          inventory_decremented: boolean
          merchant_id: string
          name: string
          quantity: number
          sku: string | null
          source_id: string | null
          source_type: string
          total: number | null
          transaction_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory_decremented?: boolean
          merchant_id: string
          name: string
          quantity?: number
          sku?: string | null
          source_id?: string | null
          source_type: string
          total?: number | null
          transaction_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory_decremented?: boolean
          merchant_id?: string
          name?: string
          quantity?: number
          sku?: string | null
          source_id?: string | null
          source_type?: string
          total?: number | null
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_reconciliation_log: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          details: Json
          error_message: string | null
          id: string
          merchant_id: string | null
          restored_transaction_id: string | null
          run_id: string
          stripe_account_id: string | null
          stripe_payment_intent_id: string | null
          target_table: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          merchant_id?: string | null
          restored_transaction_id?: string | null
          run_id: string
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          merchant_id?: string | null
          restored_transaction_id?: string | null
          run_id?: string
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          amount_refunded: number
          application_fee: number | null
          cashback_earned: number
          created_at: string
          description: string | null
          id: string
          merchant_id: string | null
          pawbucks_refunded: number
          pawbucks_used: number | null
          payment_method: string | null
          rewards_earned: number
          status: string
          stripe_amount: number | null
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          amount_refunded?: number
          application_fee?: number | null
          cashback_earned?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string | null
          pawbucks_refunded?: number
          pawbucks_used?: number | null
          payment_method?: string | null
          rewards_earned?: number
          status?: string
          stripe_amount?: number | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          amount_refunded?: number
          application_fee?: number | null
          cashback_earned?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string | null
          pawbucks_refunded?: number
          pawbucks_used?: number | null
          payment_method?: string | null
          rewards_earned?: number
          status?: string
          stripe_amount?: number | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badge_collection_progress: {
        Row: {
          badges_earned: number
          collection_id: string
          completed_at: string | null
          created_at: string
          id: string
          reward_claimed: boolean
          total_badges: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badges_earned?: number
          collection_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          reward_claimed?: boolean
          total_badges: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badges_earned?: number
          collection_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          reward_claimed?: boolean
          total_badges?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badge_collection_progress_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "badge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badge_promotions: {
        Row: {
          activated_at: string
          expires_at: string
          id: string
          is_used: boolean
          promotion_id: string
          used_at: string | null
          user_badge_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          promotion_id: string
          used_at?: string | null
          user_badge_id: string
          user_id: string
        }
        Update: {
          activated_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          promotion_id?: string
          used_at?: string | null
          user_badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badge_promotions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "badge_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badge_promotions_user_badge_id_fkey"
            columns: ["user_badge_id"]
            isOneToOne: false
            referencedRelation: "user_guilt_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badge_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_earned_date: string | null
          longest_streak: number
          streak_start_date: string | null
          streak_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_earned_date?: string | null
          longest_streak?: number
          streak_start_date?: string | null
          streak_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_earned_date?: string | null
          longest_streak?: number
          streak_start_date?: string | null
          streak_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_guilt_badges: {
        Row: {
          badge_id: string
          created_at: string
          earned_at: string
          id: string
          metadata: Json | null
          period_end: string
          period_start: string
          reward_claimed: boolean
          reward_claimed_at: string | null
          reward_expires_at: string | null
          spending_amount: number
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          period_end: string
          period_start: string
          reward_claimed?: boolean
          reward_claimed_at?: string | null
          reward_expires_at?: string | null
          spending_amount: number
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          period_end?: string
          period_start?: string
          reward_claimed?: boolean
          reward_claimed_at?: string | null
          reward_expires_at?: string | null
          spending_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_guilt_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "guilt_badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_personality_badges: {
        Row: {
          badge_earned_at: string
          created_at: string
          id: string
          is_displayed: boolean | null
          personality_type: string
          pet_id: string
          user_id: string
        }
        Insert: {
          badge_earned_at?: string
          created_at?: string
          id?: string
          is_displayed?: boolean | null
          personality_type: string
          pet_id: string
          user_id: string
        }
        Update: {
          badge_earned_at?: string
          created_at?: string
          id?: string
          is_displayed?: boolean | null
          personality_type?: string
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personality_badges_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_personality_evolutions: {
        Row: {
          created_at: string
          evolution_id: string
          expires_at: string
          id: string
          is_active: boolean
          pet_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evolution_id: string
          expires_at: string
          id?: string
          is_active?: boolean
          pet_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evolution_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          pet_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personality_evolutions_evolution_id_fkey"
            columns: ["evolution_id"]
            isOneToOne: false
            referencedRelation: "personality_evolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_personality_evolutions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_personality_perks: {
        Row: {
          claimed_at: string | null
          created_at: string
          eligible_at: string
          expires_at: string
          id: string
          perk_id: string
          pet_id: string | null
          status: string
          updated_at: string
          used_at: string | null
          used_on_transaction_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          eligible_at: string
          expires_at: string
          id?: string
          perk_id: string
          pet_id?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          used_on_transaction_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          eligible_at?: string
          expires_at?: string
          id?: string
          perk_id?: string
          pet_id?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
          used_on_transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personality_perks_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "personality_perks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_personality_perks_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_personality_perks_used_on_transaction_id_fkey"
            columns: ["used_on_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tier_history: {
        Row: {
          created_at: string
          id: string
          new_tier: Database["public"]["Enums"]["consumer_tier"]
          old_tier: Database["public"]["Enums"]["consumer_tier"] | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_tier: Database["public"]["Enums"]["consumer_tier"]
          old_tier?: Database["public"]["Enums"]["consumer_tier"] | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_tier?: Database["public"]["Enums"]["consumer_tier"]
          old_tier?: Database["public"]["Enums"]["consumer_tier"] | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tier_status: {
        Row: {
          badges_earned_this_year: number
          consecutive_active_months: number
          created_at: string
          current_tier: Database["public"]["Enums"]["consumer_tier"]
          id: string
          last_active_month: string | null
          tier_paused: boolean
          tier_paused_at: string | null
          tier_start_date: string
          transactions_this_year: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badges_earned_this_year?: number
          consecutive_active_months?: number
          created_at?: string
          current_tier?: Database["public"]["Enums"]["consumer_tier"]
          id?: string
          last_active_month?: string | null
          tier_paused?: boolean
          tier_paused_at?: string | null
          tier_start_date?: string
          transactions_this_year?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badges_earned_this_year?: number
          consecutive_active_months?: number
          created_at?: string
          current_tier?: Database["public"]["Enums"]["consumer_tier"]
          id?: string
          last_active_month?: string | null
          tier_paused?: boolean
          tier_paused_at?: string | null
          tier_start_date?: string
          transactions_this_year?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_welcome_credits: {
        Row: {
          cluster_id: string | null
          created_at: string
          credit_amount: number
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: string | null
          phase_1_amount: number
          phase_1_used: boolean
          phase_1_used_at: string | null
          phase_1_used_in_transaction_id: string | null
          phase_1_used_with_merchant_id: string | null
          phase_2_amount: number
          phase_2_unlocked: boolean
          phase_2_unlocked_at: string | null
          promotion_type: string
          revocation_reason: string | null
          status: string
          transaction_total_cents: number | null
          updated_at: string
          used_at: string | null
          used_in_transaction_id: string | null
          used_with_merchant_id: string | null
          user_id: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          credit_amount?: number
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          phase_1_amount?: number
          phase_1_used?: boolean
          phase_1_used_at?: string | null
          phase_1_used_in_transaction_id?: string | null
          phase_1_used_with_merchant_id?: string | null
          phase_2_amount?: number
          phase_2_unlocked?: boolean
          phase_2_unlocked_at?: string | null
          promotion_type?: string
          revocation_reason?: string | null
          status?: string
          transaction_total_cents?: number | null
          updated_at?: string
          used_at?: string | null
          used_in_transaction_id?: string | null
          used_with_merchant_id?: string | null
          user_id: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          credit_amount?: number
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          phase_1_amount?: number
          phase_1_used?: boolean
          phase_1_used_at?: string | null
          phase_1_used_in_transaction_id?: string | null
          phase_1_used_with_merchant_id?: string | null
          phase_2_amount?: number
          phase_2_unlocked?: boolean
          phase_2_unlocked_at?: string | null
          promotion_type?: string
          revocation_reason?: string | null
          status?: string
          transaction_total_cents?: number | null
          updated_at?: string
          used_at?: string | null
          used_in_transaction_id?: string | null
          used_with_merchant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_welcome_credits_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "launch_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_phase_1_used_with_merchant_id_fkey"
            columns: ["phase_1_used_with_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_phase_1_used_with_merchant_id_fkey"
            columns: ["phase_1_used_with_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_used_with_merchant_id_fkey"
            columns: ["used_with_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_used_with_merchant_id_fkey"
            columns: ["used_with_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_welcome_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccine_reminder_log: {
        Row: {
          channel: string
          id: string
          milestone: string
          next_due_date: string | null
          pet_id: string
          sent_at: string
          user_id: string
          vaccination_id: string
        }
        Insert: {
          channel: string
          id?: string
          milestone: string
          next_due_date?: string | null
          pet_id: string
          sent_at?: string
          user_id: string
          vaccination_id: string
        }
        Update: {
          channel?: string
          id?: string
          milestone?: string
          next_due_date?: string | null
          pet_id?: string
          sent_at?: string
          user_id?: string
          vaccination_id?: string
        }
        Relationships: []
      }
      verification_answers: {
        Row: {
          answer: string
          answered_by: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          question_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          answered_by: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          question_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          answered_by?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "verification_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_questions: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          entity_type: string
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          entity_type: string
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          entity_type?: string
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      vet_bonus_offers: {
        Row: {
          bonus_amount: number
          created_at: string
          expires_at: string
          id: string
          message: string | null
          pet_id: string
          redeemed_at: string | null
          service_type: string
          status: string
          updated_at: string
          user_id: string
          vet_id: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          pet_id: string
          redeemed_at?: string | null
          service_type: string
          status?: string
          updated_at?: string
          user_id: string
          vet_id: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          pet_id?: string
          redeemed_at?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_bonus_offers_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_bonus_offers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_bonus_offers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_bonus_offers_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_bonus_offers_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_business_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_business_hours_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_business_hours_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_care_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          merchant_id: string
          notes: string | null
          pet_id: string
          share_type: string
          shared_data: Json | null
          updated_at: string
          vet_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id: string
          notes?: string | null
          pet_id: string
          share_type: string
          shared_data?: Json | null
          updated_at?: string
          vet_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          merchant_id?: string
          notes?: string | null
          pet_id?: string
          share_type?: string
          shared_data?: Json | null
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_care_shares_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_care_shares_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_care_shares_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_care_shares_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_care_shares_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_consent_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          requires_witness: boolean
          template_name: string
          template_type: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          requires_witness?: boolean
          template_name: string
          template_type: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          requires_witness?: boolean
          template_name?: string
          template_type?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_consent_templates_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_consent_templates_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_insurance_providers: {
        Row: {
          api_endpoint: string | null
          average_processing_days: number | null
          claim_form_url: string | null
          claim_submission_email: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          supported_species: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          api_endpoint?: string | null
          average_processing_days?: number | null
          claim_form_url?: string | null
          claim_submission_email?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          supported_species?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          api_endpoint?: string | null
          average_processing_days?: number | null
          claim_form_url?: string | null
          claim_submission_email?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          supported_species?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      vet_lab_integrations: {
        Row: {
          account_id: string | null
          api_endpoint: string | null
          api_key_encrypted: string | null
          auto_import: boolean | null
          created_at: string
          id: string
          is_active: boolean | null
          lab_name: string
          lab_vendor: string
          last_import_at: string | null
          settings: Json | null
          supports_dicom: boolean | null
          updated_at: string
          vet_id: string
        }
        Insert: {
          account_id?: string | null
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          auto_import?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lab_name: string
          lab_vendor: string
          last_import_at?: string | null
          settings?: Json | null
          supports_dicom?: boolean | null
          updated_at?: string
          vet_id: string
        }
        Update: {
          account_id?: string | null
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          auto_import?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lab_name?: string
          lab_vendor?: string
          last_import_at?: string | null
          settings?: Json | null
          supports_dicom?: boolean | null
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_lab_integrations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_lab_integrations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_loans: {
        Row: {
          created_at: string
          id: string
          invoice_amount: number
          invoice_url: string | null
          purpose: string | null
          repayment_schedule: Json | null
          requested_amount: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
          vet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_amount: number
          invoice_url?: string | null
          purpose?: string | null
          repayment_schedule?: Json | null
          requested_amount: number
          status?: string
          term_months: number
          updated_at?: string
          user_id: string
          vet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_amount?: number
          invoice_url?: string | null
          purpose?: string | null
          repayment_schedule?: Json | null
          requested_amount?: number
          status?: string
          term_months?: number
          updated_at?: string
          user_id?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_loans_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_loans_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_lost_pet_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          id: string
          is_acknowledged: boolean | null
          lost_pet_post_id: string
          notes: string | null
          pet_id: string | null
          vet_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean | null
          lost_pet_post_id: string
          notes?: string | null
          pet_id?: string | null
          vet_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean | null
          lost_pet_post_id?: string
          notes?: string | null
          pet_id?: string | null
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_lost_pet_alerts_lost_pet_post_id_fkey"
            columns: ["lost_pet_post_id"]
            isOneToOne: false
            referencedRelation: "lost_pet_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_lost_pet_alerts_lost_pet_post_id_fkey"
            columns: ["lost_pet_post_id"]
            isOneToOne: false
            referencedRelation: "lost_pet_posts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_lost_pet_alerts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_lost_pet_alerts_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_lost_pet_alerts_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_message_attachments: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "vet_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          pet_id: string | null
          read_at: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          user_id: string
          vet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          pet_id?: string | null
          read_at?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          user_id: string
          vet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          pet_id?: string | null
          read_at?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          user_id?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_messages_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_messages_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_messages_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_pms_integrations: {
        Row: {
          api_endpoint: string | null
          api_key_encrypted: string | null
          client_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          practice_id: string | null
          provider: string
          provider_name: string
          settings: Json | null
          sync_direction: string
          sync_frequency_minutes: number | null
          updated_at: string
          vet_id: string
          webhook_secret: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          practice_id?: string | null
          provider: string
          provider_name: string
          settings?: Json | null
          sync_direction?: string
          sync_frequency_minutes?: number | null
          updated_at?: string
          vet_id: string
          webhook_secret?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          practice_id?: string | null
          provider?: string
          provider_name?: string
          settings?: Json | null
          sync_direction?: string
          sync_frequency_minutes?: number | null
          updated_at?: string
          vet_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_pms_integrations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_pms_integrations_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_prescription_fulfillments: {
        Row: {
          approved_at: string | null
          created_at: string
          dosage: string
          id: string
          instructions: string | null
          medication_name: string
          notes: string | null
          pet_id: string
          product_price: number | null
          quantity: number
          refill_request_id: string | null
          shipped_at: string | null
          status: string
          store_item_id: string | null
          tracking_number: string | null
          updated_at: string
          user_id: string
          vet_earnings: number | null
          vet_id: string
          vet_margin_percent: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          dosage: string
          id?: string
          instructions?: string | null
          medication_name: string
          notes?: string | null
          pet_id: string
          product_price?: number | null
          quantity?: number
          refill_request_id?: string | null
          shipped_at?: string | null
          status?: string
          store_item_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
          vet_earnings?: number | null
          vet_id: string
          vet_margin_percent?: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          dosage?: string
          id?: string
          instructions?: string | null
          medication_name?: string
          notes?: string | null
          pet_id?: string
          product_price?: number | null
          quantity?: number
          refill_request_id?: string | null
          shipped_at?: string | null
          status?: string
          store_item_id?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
          vet_earnings?: number | null
          vet_id?: string
          vet_margin_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "vet_prescription_fulfillments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_refill_request_id_fkey"
            columns: ["refill_request_id"]
            isOneToOne: false
            referencedRelation: "prescription_refill_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_store_item_id_fkey"
            columns: ["store_item_id"]
            isOneToOne: false
            referencedRelation: "pet_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_prescription_fulfillments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_wellness_plan_services: {
        Row: {
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          plan_id: string
          quantity_included: number | null
          retail_value: number
          service_category: string | null
          service_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          plan_id: string
          quantity_included?: number | null
          retail_value: number
          service_category?: string | null
          service_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          plan_id?: string
          quantity_included?: number | null
          retail_value?: number
          service_category?: string | null
          service_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_wellness_plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vet_wellness_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_wellness_plans: {
        Row: {
          age_category: string | null
          annual_price: number | null
          billing_interval: string | null
          cancellation_policy: string | null
          commitment_months: number | null
          created_at: string
          current_subscribers: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          max_subscribers: number | null
          merchant_id: string | null
          monthly_price: number | null
          name: string
          pet_type: string
          price_pawbucks: number
          price_usd: number
          savings_percentage: number | null
          services: Json
          setup_fee: number | null
          species: string[] | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          terms_conditions: string | null
          total_value: number | null
          updated_at: string
          vet_id: string
        }
        Insert: {
          age_category?: string | null
          annual_price?: number | null
          billing_interval?: string | null
          cancellation_policy?: string | null
          commitment_months?: number | null
          created_at?: string
          current_subscribers?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          max_subscribers?: number | null
          merchant_id?: string | null
          monthly_price?: number | null
          name: string
          pet_type: string
          price_pawbucks: number
          price_usd: number
          savings_percentage?: number | null
          services?: Json
          setup_fee?: number | null
          species?: string[] | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          terms_conditions?: string | null
          total_value?: number | null
          updated_at?: string
          vet_id: string
        }
        Update: {
          age_category?: string | null
          annual_price?: number | null
          billing_interval?: string | null
          cancellation_policy?: string | null
          commitment_months?: number | null
          created_at?: string
          current_subscribers?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          max_subscribers?: number | null
          merchant_id?: string | null
          monthly_price?: number | null
          name?: string
          pet_type?: string
          price_pawbucks?: number
          price_usd?: number
          savings_percentage?: number | null
          services?: Json
          setup_fee?: number | null
          species?: string[] | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          terms_conditions?: string | null
          total_value?: number | null
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_wellness_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_wellness_plans_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_wellness_plans_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_wellness_plans_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_activity: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          transaction_id: string | null
          type: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_id?: string | null
          type: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_id?: string | null
          type?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_activity_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_activity_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_updated: string
          rewards_points: number
          total_spent: number
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          rewards_points?: number
          total_spent?: number
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          rewards_points?: number
          total_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "merchant_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
        }
        Relationships: []
      }
      welcome_credit_abuse_signals: {
        Row: {
          created_at: string
          id: string
          severity: string
          signal_data: Json | null
          signal_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          severity?: string
          signal_data?: Json | null
          signal_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          severity?: string
          signal_data?: Json | null
          signal_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_credit_abuse_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_credit_abuse_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_credit_analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          merchant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          merchant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          merchant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_credit_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_credit_analytics_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_credit_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_credit_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_credit_reminders: {
        Row: {
          channel: string
          id: string
          reminder_type: string
          sent_at: string
          welcome_credit_id: string
        }
        Insert: {
          channel?: string
          id?: string
          reminder_type: string
          sent_at?: string
          welcome_credit_id: string
        }
        Update: {
          channel?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          welcome_credit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_credit_reminders_welcome_credit_id_fkey"
            columns: ["welcome_credit_id"]
            isOneToOne: false
            referencedRelation: "user_welcome_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_plan_payments: {
        Row: {
          amount: number
          created_at: string | null
          failure_reason: string | null
          id: string
          pawbucks_earned: number | null
          pawbucks_used: number | null
          payment_date: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          pawbucks_earned?: number | null
          pawbucks_used?: number | null
          payment_date?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          pawbucks_earned?: number | null
          pawbucks_used?: number | null
          payment_date?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_plan_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "wellness_plan_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_plan_purchases: {
        Row: {
          amount_pawbucks: number | null
          amount_usd: number | null
          created_at: string
          id: string
          payment_method: string
          pet_id: string
          plan_id: string
          purchased_at: string
          services_used: Json | null
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
          vet_id: string
        }
        Insert: {
          amount_pawbucks?: number | null
          amount_usd?: number | null
          created_at?: string
          id?: string
          payment_method: string
          pet_id: string
          plan_id: string
          purchased_at?: string
          services_used?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
          vet_id: string
        }
        Update: {
          amount_pawbucks?: number | null
          amount_usd?: number | null
          created_at?: string
          id?: string
          payment_method?: string
          pet_id?: string
          plan_id?: string
          purchased_at?: string
          services_used?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_plan_purchases_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vet_wellness_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_purchases_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_purchases_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "partner_vets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_plan_subscriptions: {
        Row: {
          auto_renew: boolean | null
          cancellation_date: string | null
          cancellation_reason: string | null
          created_at: string | null
          end_date: string | null
          id: string
          monthly_amount: number
          next_billing_date: string | null
          pet_id: string
          plan_id: string
          services_used: Json | null
          start_date: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_paid: number | null
          total_rewards_earned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_amount: number
          next_billing_date?: string | null
          pet_id: string
          plan_id: string
          services_used?: Json | null
          start_date?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_paid?: number | null
          total_rewards_earned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_amount?: number
          next_billing_date?: string | null
          pet_id?: string
          plan_id?: string
          services_used?: Json | null
          start_date?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_paid?: number | null
          total_rewards_earned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_plan_subscriptions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_plan_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vet_wellness_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      consultation_slot_availability: {
        Row: {
          booking_date: string | null
          bookings_count: number | null
          time_slot: string | null
        }
        Relationships: []
      }
      founding_50_badges_public: {
        Row: {
          awarded_at: string | null
          badge_number: number | null
          entity_id: string | null
          entity_type: string | null
        }
        Insert: {
          awarded_at?: string | null
          badge_number?: number | null
          entity_id?: string | null
          entity_type?: string | null
        }
        Update: {
          awarded_at?: string | null
          badge_number?: number | null
          entity_id?: string | null
          entity_type?: string | null
        }
        Relationships: []
      }
      lost_pet_posts_public: {
        Row: {
          additional_notes: string | null
          age_estimate: string | null
          breed: string | null
          collar_description: string | null
          color_markings: string | null
          created_at: string | null
          deletion_warning_sent_at: string | null
          gender: string | null
          id: string | null
          identifying_features: string | null
          is_active: boolean | null
          last_seen_area_description: string | null
          last_seen_date: string | null
          last_seen_location: string | null
          last_seen_time: string | null
          pet_name: string | null
          pet_type: string | null
          photo_url: string | null
          photo_urls: string[] | null
          reward_amount: number | null
          size: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          age_estimate?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings?: string | null
          created_at?: string | null
          deletion_warning_sent_at?: string | null
          gender?: string | null
          id?: string | null
          identifying_features?: string | null
          is_active?: boolean | null
          last_seen_area_description?: string | null
          last_seen_date?: string | null
          last_seen_location?: string | null
          last_seen_time?: string | null
          pet_name?: string | null
          pet_type?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          reward_amount?: number | null
          size?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          age_estimate?: string | null
          breed?: string | null
          collar_description?: string | null
          color_markings?: string | null
          created_at?: string | null
          deletion_warning_sent_at?: string | null
          gender?: string | null
          id?: string | null
          identifying_features?: string | null
          is_active?: boolean | null
          last_seen_area_description?: string | null
          last_seen_date?: string | null
          last_seen_location?: string | null
          last_seen_time?: string | null
          pet_name?: string | null
          pet_type?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          reward_amount?: number | null
          size?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      merchant_active_services_public: {
        Row: {
          expires_at: string | null
          merchant_id: string | null
          service_id: string | null
          service_name: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_service_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_service_purchases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_service_purchases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_market_services"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_reviews_public: {
        Row: {
          created_at: string | null
          id: string | null
          merchant_id: string | null
          rating: number | null
          review_text: string | null
          reviewer_avatar: string | null
          reviewer_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_twilio_settings_safe: {
        Row: {
          created_at: string | null
          id: string | null
          is_verified: boolean | null
          merchant_id: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_verified?: boolean | null
          merchant_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: never
          twilio_phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_verified?: boolean | null
          merchant_id?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: never
          twilio_phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_twilio_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_twilio_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants_public: {
        Row: {
          accepts_pawbucks: boolean | null
          accepts_welcome_credit: boolean | null
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          business_categories: string[] | null
          business_name: string | null
          business_type: string | null
          cashback_rate: number | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          entity_type: string | null
          facebook_url: string | null
          fee_model: string | null
          id: string | null
          instagram_url: string | null
          intro_video_url: string | null
          is_paused: boolean | null
          is_sponsored: boolean | null
          latitude: number | null
          linkedin_url: string | null
          logo_url: string | null
          longitude: number | null
          onboarding_complete: boolean | null
          owner_name: string | null
          pawbucks_cap_enabled: boolean | null
          pawbucks_cap_pct: number | null
          pawbucks_promo_cap_pct: number | null
          pawbucks_promo_ends_at: string | null
          pawbucks_promo_starts_at: string | null
          phone: string | null
          price_range: number | null
          privacy_policy_url: string | null
          search_keywords: string[] | null
          service_area_radius_miles: number | null
          shipping_returns_policy_url: string | null
          sponsored_until: string | null
          state_of_incorporation: string | null
          storefront_slug: string | null
          stripe_account_status: string | null
          timezone: string | null
          tos_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          website_url: string | null
          welcome_credit_opted_in_at: string | null
          working_style: string | null
        }
        Insert: {
          accepts_pawbucks?: boolean | null
          accepts_welcome_credit?: boolean | null
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          business_categories?: string[] | null
          business_name?: string | null
          business_type?: string | null
          cashback_rate?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string | null
          facebook_url?: string | null
          fee_model?: string | null
          id?: string | null
          instagram_url?: string | null
          intro_video_url?: string | null
          is_paused?: boolean | null
          is_sponsored?: boolean | null
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          owner_name?: string | null
          pawbucks_cap_enabled?: boolean | null
          pawbucks_cap_pct?: number | null
          pawbucks_promo_cap_pct?: number | null
          pawbucks_promo_ends_at?: string | null
          pawbucks_promo_starts_at?: string | null
          phone?: string | null
          price_range?: number | null
          privacy_policy_url?: string | null
          search_keywords?: string[] | null
          service_area_radius_miles?: number | null
          shipping_returns_policy_url?: string | null
          sponsored_until?: string | null
          state_of_incorporation?: string | null
          storefront_slug?: string | null
          stripe_account_status?: string | null
          timezone?: string | null
          tos_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
          welcome_credit_opted_in_at?: string | null
          working_style?: string | null
        }
        Update: {
          accepts_pawbucks?: boolean | null
          accepts_welcome_credit?: boolean | null
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          business_categories?: string[] | null
          business_name?: string | null
          business_type?: string | null
          cashback_rate?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          entity_type?: string | null
          facebook_url?: string | null
          fee_model?: string | null
          id?: string | null
          instagram_url?: string | null
          intro_video_url?: string | null
          is_paused?: boolean | null
          is_sponsored?: boolean | null
          latitude?: number | null
          linkedin_url?: string | null
          logo_url?: string | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          owner_name?: string | null
          pawbucks_cap_enabled?: boolean | null
          pawbucks_cap_pct?: number | null
          pawbucks_promo_cap_pct?: number | null
          pawbucks_promo_ends_at?: string | null
          pawbucks_promo_starts_at?: string | null
          phone?: string | null
          price_range?: number | null
          privacy_policy_url?: string | null
          search_keywords?: string[] | null
          service_area_radius_miles?: number | null
          shipping_returns_policy_url?: string | null
          sponsored_until?: string | null
          state_of_incorporation?: string | null
          storefront_slug?: string | null
          stripe_account_status?: string | null
          timezone?: string | null
          tos_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
          welcome_credit_opted_in_at?: string | null
          working_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "reviewer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_vets_public: {
        Row: {
          accepting_new_patients: boolean | null
          accreditations: string[] | null
          clinic_name: string | null
          direct_pay_enabled: boolean | null
          emergency_protocol: string | null
          id: string | null
          insurance_partners: string[] | null
          location: string | null
          name: string | null
          practice_type: string | null
          privacy_policy_url: string | null
          shipping_returns_policy_url: string | null
          tos_url: string | null
          website_url: string | null
        }
        Insert: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          clinic_name?: string | null
          direct_pay_enabled?: boolean | null
          emergency_protocol?: string | null
          id?: string | null
          insurance_partners?: string[] | null
          location?: string | null
          name?: string | null
          practice_type?: string | null
          privacy_policy_url?: string | null
          shipping_returns_policy_url?: string | null
          tos_url?: string | null
          website_url?: string | null
        }
        Update: {
          accepting_new_patients?: boolean | null
          accreditations?: string[] | null
          clinic_name?: string | null
          direct_pay_enabled?: boolean | null
          emergency_protocol?: string | null
          id?: string | null
          insurance_partners?: string[] | null
          location?: string | null
          name?: string | null
          practice_type?: string | null
          privacy_policy_url?: string | null
          shipping_returns_policy_url?: string | null
          tos_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      reviewer_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _verify_gaa: { Args: never; Returns: Json }
      admin_bulk_grant_branded_pawbucks: {
        Args: {
          p_actor_user_id: string
          p_amount: number
          p_batch_id: string
          p_campaign_id: string
          p_description?: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      admin_delete_brand_account: {
        Args: { p_brand_id: string }
        Returns: Json
      }
      admin_grant_branded_pawbucks: {
        Args: {
          p_amount: number
          p_campaign_id: string
          p_description?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_reconciliation_report: {
        Args: never
        Returns: {
          amount: number
          business_name: string
          detail: string
          kind: string
          merchant_id: string
          occurred_at: string
          reference_id: string
        }[]
      }
      admin_set_user_ban: {
        Args: { _banned: boolean; _reason?: string; _target_user_id: string }
        Returns: Json
      }
      admin_update_brand_campaign: {
        Args: { p_campaign_id: string; p_updates: Json }
        Returns: Json
      }
      aggregate_brand_campaign_daily_stats: {
        Args: { target_date?: string }
        Returns: undefined
      }
      aggregate_brand_campaign_hourly_stats: {
        Args: { target_hour?: string }
        Returns: undefined
      }
      aggregate_search_ranking_stats: {
        Args: { target_date?: string }
        Returns: undefined
      }
      aggregate_service_performance: {
        Args: { target_date?: string }
        Returns: undefined
      }
      aggregate_sponsored_stats: {
        Args: { target_date?: string }
        Returns: undefined
      }
      bulk_invite_to_promotion: {
        Args: {
          p_message?: string
          p_promotion_id: string
          p_recipient_ids?: string[]
          p_recipient_type: string
          p_scope: string
        }
        Returns: {
          invited: number
          skipped: number
        }[]
      }
      check_welcome_credit_abuse: {
        Args: { p_email: string; p_ip?: string; p_phone?: string }
        Returns: {
          is_abusive: boolean
          reason: string
        }[]
      }
      check_welcome_credit_eligibility: {
        Args: { p_merchant_id: string; p_user_id: string }
        Returns: {
          credit_amount: number
          expires_at: string
          is_eligible: boolean
          reason: string
        }[]
      }
      checkin_date: { Args: { ts: string }; Returns: string }
      claim_brand_account: { Args: { p_token: string }; Returns: Json }
      claim_pet_fund_spot: { Args: { p_cluster_id: string }; Returns: string }
      complete_brand_setup: {
        Args: { p_brand_id: string; p_payload: Json }
        Returns: Json
      }
      compute_brand_redeemable_cents: {
        Args: { p_line_items: Json; p_merchant_id: string; p_user_id: string }
        Returns: Json
      }
      credit_branded_pawbucks: {
        Args: {
          p_amount: number
          p_brand_name: string
          p_campaign_id: string
          p_checkin_id: string
          p_description: string
          p_merchant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      default_pawbucks_cap_pct: {
        Args: { p_business_type: string }
        Returns: number
      }
      expire_pawbucks: { Args: never; Returns: number }
      expire_unused_pet_fund_credits: { Args: never; Returns: number }
      find_merchant_by_qr_token: {
        Args: { p_token: string }
        Returns: {
          business_name: string
          id: string
          latitude: number
          longitude: number
        }[]
      }
      generate_admin_invoice_number: { Args: never; Returns: string }
      generate_checkin_qr_token: { Args: never; Returns: string }
      generate_claim_number: { Args: never; Returns: string }
      generate_invoice_number: {
        Args: { p_merchant_id: string }
        Returns: string
      }
      generate_pet_email_short_code: { Args: never; Returns: string }
      generate_redemption_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_storefront_slug: {
        Args: { business_name: string }
        Returns: string
      }
      generate_ticket_number: { Args: never; Returns: string }
      get_accountant_invitation_token: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      get_active_promotion: {
        Args: { p_cluster_id?: string }
        Returns: {
          cluster_id: string
          cluster_name: string
          promotion_type: string
          series_tier: string
          spots_remaining: number
        }[]
      }
      get_admin_analytics: {
        Args: never
        Returns: {
          attributed_redeemed_pb: number
          cross_merchant_redeemed_pb: number
          cross_merchant_redemption_rate: number
          pawbucks_spend_rate: number
          platform_revenue: number
          repeat_redeemers: number
          repeat_redemption_rate: number
          total_gmv: number
          total_merchants: number
          total_pawbucks_earned: number
          total_pawbucks_spent: number
          total_redeemers: number
          total_refunded_amount: number
          total_refunded_transactions: number
          total_rewards: number
          total_transactions: number
          total_users: number
        }[]
      }
      get_available_brand_campaigns: {
        Args: { p_merchant_id: string }
        Returns: {
          brand_description: string
          brand_id: string
          brand_logo_url: string
          brand_name: string
          brand_website_url: string
          budget_usd: number
          campaign_color: string
          campaign_logo_url: string
          description: string
          end_date: string
          existing_invitation_status: string
          existing_request_status: string
          id: string
          min_purchase_usd: number
          name: string
          pawbucks_per_checkin: number
          pawbucks_pool: number
          start_date: string
          status: string
          targeting_notes: string
          trigger_type: string
        }[]
      }
      get_brand_by_invitation_token: {
        Args: { p_token: string }
        Returns: {
          brand_name: string
          id: string
          invitation_claimed_at: string
          invitation_email: string
        }[]
      }
      get_brand_invitation_token: {
        Args: { p_brand_id: string }
        Returns: string
      }
      get_checkin_user_emails: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_user_ids: string[]
        }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_current_user_email: { Args: never; Returns: string }
      get_customer_profiles_for_merchant: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      get_effective_pawbucks_cap_pct: {
        Args: { p_merchant_id: string }
        Returns: number
      }
      get_geo_cell_availability:
        | {
            Args: { p_geo_cell_id: string; p_service_id: string }
            Returns: {
              available_slots: number
              max_slots: number
              time_window_days: number
              used_slots: number
            }[]
          }
        | {
            Args: {
              p_business_category?: string
              p_geo_cell_id: string
              p_service_id: string
            }
            Returns: {
              available_slots: number
              business_category: string
              max_slots: number
              time_window_days: number
              used_slots: number
            }[]
          }
      get_locked_pawbucks: {
        Args: { p_user_id: string }
        Returns: {
          items: Json
          total_locked: number
        }[]
      }
      get_lost_pet_contact: {
        Args: { _post_id: string }
        Returns: {
          contact_email: string
          contact_name: string
          contact_phone: string
        }[]
      }
      get_marketplace_merchants: {
        Args: { p_category?: string; p_limit?: number; p_search?: string }
        Returns: {
          accepts_pawbucks: boolean
          address: string
          business_categories: string[]
          business_name: string
          business_type: string
          cashback_rate: number
          description: string
          id: string
          logo_url: string
        }[]
      }
      get_merchant_analytics: {
        Args: { p_merchant_id: string }
        Returns: {
          avg_transaction_amount: number
          refunded_amount: number
          refunded_transactions: number
          total_cashback: number
          total_customers: number
          total_earnings: number
          total_fees: number
          total_pawbucks_received: number
          total_sales: number
          transaction_count: number
        }[]
      }
      get_merchant_checkout_context: {
        Args: { p_merchant_id: string }
        Returns: {
          accepts_pawbucks: boolean
          business_name: string
          cashback_rate: number
          id: string
          onboarding_complete: boolean
          stripe_account_id: string
          stripe_account_status: string
          timezone: string
        }[]
      }
      get_merchant_customer_contacts: {
        Args: { p_merchant_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          last_transaction_at: string
          merchant_id: string
          phone: string
          stripe_customer_id: string
          total_spent: number
          transaction_count: number
        }[]
      }
      get_merchant_geo_cell: {
        Args: { p_merchant_id: string }
        Returns: string
      }
      get_monthly_non_partner_pawbucks: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_my_bank_routing_number: {
        Args: { p_merchant_id: string }
        Returns: string
      }
      get_pawbucks_breakdown: {
        Args: { p_user_id: string }
        Returns: {
          available_balance: number
          pending_balance: number
          total_balance: number
        }[]
      }
      get_pet_digital_id: { Args: { p_token: string }; Returns: Json }
      get_reviewer_display_name: {
        Args: { reviewer_id: string }
        Returns: string
      }
      get_reviewer_profile: {
        Args: { reviewer_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      get_spendable_pawbucks: { Args: { p_user_id: string }; Returns: number }
      get_underwriting_signals: {
        Args: { p_merchant_id: string }
        Returns: {
          avg_days_between_tx: number
          avg_review_score: number
          customer_repeat_rate_pct: number
          five_star_pct: number
          one_time_customers: number
          redemption_rate_pct: number
          redemption_velocity_avg_hours: number
          repeat_customers: number
          review_count: number
          total_unique_customers: number
          tx_frequency_30d: number
          tx_frequency_90d: number
        }[]
      }
      get_user_access_info: { Args: { p_user_id: string }; Returns: Json }
      get_user_vet_ids: { Args: { check_user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_pet_fund: {
        Args: {
          p_cluster_id?: string
          p_referred_by?: string
          p_series_tier?: string
          p_user_id: string
        }
        Returns: string
      }
      is_offer_valid: { Args: { offer_uuid: string }; Returns: boolean }
      is_returning_customer: {
        Args: { p_merchant_id: string; p_user_id: string }
        Returns: boolean
      }
      is_shared_member_of: { Args: { owner_user_id: string }; Returns: boolean }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      issue_store_locked_pawbucks: {
        Args: {
          p_amount_pb: number
          p_description?: string
          p_merchant_id: string
          p_transaction_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      issue_welcome_credit: {
        Args: {
          p_device_fingerprint?: string
          p_ip_address?: string
          p_user_id: string
        }
        Returns: {
          credit_amount: number
          credit_id: string
          expires_at: string
          message: string
          success: boolean
        }[]
      }
      log_admin_action: {
        Args: {
          _action: string
          _changes: Json
          _entity_id: string
          _entity_type: string
          _ip_address?: string
        }
        Returns: undefined
      }
      merchant_has_store_rewards_pro: {
        Args: { p_merchant_id: string }
        Returns: boolean
      }
      merchant_items_sold_report: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          name: string
          sku: string
          source_type: string
          total_quantity: number
          total_revenue: number
          transaction_count: number
        }[]
      }
      normalize_email: { Args: { raw_email: string }; Returns: string }
      process_checkin: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          checkin_id: string
          entity_name: string
          entity_type: string
          merchant_id: string
          message: string
          success: boolean
          vet_id: string
        }[]
      }
      process_checkin_by_entity: {
        Args: { p_entity_id: string; p_entity_type: string; p_user_id: string }
        Returns: {
          entity_name: string
          message: string
          success: boolean
        }[]
      }
      recompute_pawbucks_wallet: {
        Args: { p_user_id: string }
        Returns: number
      }
      redeem_branded_pawbucks: {
        Args: {
          p_amount: number
          p_description?: string
          p_merchant_id: string
          p_transaction_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      redeem_branded_pawbucks_v2: {
        Args: {
          p_amount: number
          p_description?: string
          p_line_items: Json
          p_merchant_id: string
          p_transaction_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      redeem_store_locked_pawbucks: {
        Args: {
          p_amount_pb: number
          p_description?: string
          p_merchant_id: string
          p_transaction_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      redeem_welcome_credit: {
        Args: {
          p_merchant_id: string
          p_transaction_id?: string
          p_transaction_total_cents: number
          p_user_id: string
        }
        Returns: {
          credit_applied: number
          message: string
          success: boolean
        }[]
      }
      regenerate_pet_digital_id_token: {
        Args: { p_pet_id: string }
        Returns: Json
      }
      release_pet_fund_installment: {
        Args: { p_release_id: string }
        Returns: undefined
      }
      release_referrer_bonus: {
        Args: { p_bonus_id: string }
        Returns: undefined
      }
      respond_to_brand_campaign_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: Json
      }
      respond_to_brand_campaign_join_request: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_response_message?: string
        }
        Returns: Json
      }
      respond_to_promotion_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string
          message: string | null
          promotion_id: string
          recipient_id: string
          recipient_type: string
          responded_at: string | null
          status: Database["public"]["Enums"]["platform_promotion_invitation_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_promotion_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_transaction_inventory: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      revoke_pet_digital_id_token: { Args: { p_pet_id: string }; Returns: Json }
      send_pawbucks_expiry_reminders: { Args: never; Returns: number }
      send_pet_fund_expiry_reminders: { Args: never; Returns: number }
      set_system_config: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
      use_pet_fund_credit: {
        Args: { p_amount: number; p_transaction_id?: string; p_user_id: string }
        Returns: boolean
      }
      user_has_vet_relationship: {
        Args: { check_user_id: string; check_vet_id: string }
        Returns: boolean
      }
      user_owns_brand_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_merchant: {
        Args: { check_merchant_id: string }
        Returns: boolean
      }
      user_owns_vet: {
        Args: { check_user_id: string; vet_user_id: string }
        Returns: boolean
      }
      user_participates_in_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      validate_accountant_access_token: {
        Args: { token_param: string }
        Returns: string
      }
      validate_invoice_access: {
        Args: { invoice_id: string; token: string }
        Returns: boolean
      }
      verify_internal_trigger_secret: {
        Args: { _provided: string }
        Returns: boolean
      }
      vest_pending_pawbucks: { Args: never; Returns: number }
      vet_can_view_pet: {
        Args: { pet_id: string; vet_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin"
      approval_status: "pending" | "approved" | "denied"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      community_author_role: "pet_owner" | "merchant"
      community_category:
        | "health"
        | "events"
        | "lostfound"
        | "training"
        | "general"
      consent_status: "pending" | "signed" | "declined" | "expired"
      consumer_tier: "silver" | "gold" | "platinum"
      imaging_type:
        | "xray"
        | "ultrasound"
        | "mri"
        | "ct_scan"
        | "endoscopy"
        | "other"
      lab_result_status: "pending" | "completed" | "reviewed"
      medical_record_type:
        | "vaccination"
        | "checkup"
        | "surgery"
        | "lab_results"
        | "prescription"
        | "dental"
        | "emergency"
        | "other"
      message_sender_type: "owner" | "vet"
      payment_type: "pay_at_booking" | "pay_at_service" | "both"
      pet_type: "dog" | "cat" | "other"
      platform_promotion_invitation_status: "pending" | "accepted" | "declined"
      platform_promotion_recipient_type: "merchant" | "vet" | "both"
      platform_promotion_status: "draft" | "active" | "archived"
      service_category:
        | "daycare"
        | "boarding"
        | "grooming"
        | "walking"
        | "training"
        | "veterinary"
        | "pet_sitting"
        | "other"
      soap_note_status: "draft" | "finalized" | "amended"
      tax_expense_category:
        | "gas_mileage"
        | "pet_supplies_treats"
        | "equipment"
        | "insurance"
        | "marketing_advertising"
        | "professional_services"
        | "office_supplies"
        | "software_subscriptions"
        | "training_education"
        | "other"
        | "inventory_supplies"
        | "specialized_equipment"
        | "merchant_market"
        | "platform_fees"
        | "processing_fees"
      ticket_category:
        | "technical_issue"
        | "billing_payments"
        | "account_profile"
        | "feature_request"
        | "general"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "awaiting_response"
        | "resolved"
        | "closed"
      ticket_submitter_type: "pet_owner" | "merchant" | "vet"
      user_type: "pet_owner" | "merchant" | "admin" | "brand"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "superadmin"],
      approval_status: ["pending", "approved", "denied"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      community_author_role: ["pet_owner", "merchant"],
      community_category: [
        "health",
        "events",
        "lostfound",
        "training",
        "general",
      ],
      consent_status: ["pending", "signed", "declined", "expired"],
      consumer_tier: ["silver", "gold", "platinum"],
      imaging_type: [
        "xray",
        "ultrasound",
        "mri",
        "ct_scan",
        "endoscopy",
        "other",
      ],
      lab_result_status: ["pending", "completed", "reviewed"],
      medical_record_type: [
        "vaccination",
        "checkup",
        "surgery",
        "lab_results",
        "prescription",
        "dental",
        "emergency",
        "other",
      ],
      message_sender_type: ["owner", "vet"],
      payment_type: ["pay_at_booking", "pay_at_service", "both"],
      pet_type: ["dog", "cat", "other"],
      platform_promotion_invitation_status: ["pending", "accepted", "declined"],
      platform_promotion_recipient_type: ["merchant", "vet", "both"],
      platform_promotion_status: ["draft", "active", "archived"],
      service_category: [
        "daycare",
        "boarding",
        "grooming",
        "walking",
        "training",
        "veterinary",
        "pet_sitting",
        "other",
      ],
      soap_note_status: ["draft", "finalized", "amended"],
      tax_expense_category: [
        "gas_mileage",
        "pet_supplies_treats",
        "equipment",
        "insurance",
        "marketing_advertising",
        "professional_services",
        "office_supplies",
        "software_subscriptions",
        "training_education",
        "other",
        "inventory_supplies",
        "specialized_equipment",
        "merchant_market",
        "platform_fees",
        "processing_fees",
      ],
      ticket_category: [
        "technical_issue",
        "billing_payments",
        "account_profile",
        "feature_request",
        "general",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "awaiting_response",
        "resolved",
        "closed",
      ],
      ticket_submitter_type: ["pet_owner", "merchant", "vet"],
      user_type: ["pet_owner", "merchant", "admin", "brand"],
    },
  },
} as const
