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
          merchant_id: string
          reason: string
          requested_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_monthly_sales: number
          id?: string
          merchant_id: string
          reason: string
          requested_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_monthly_sales?: number
          id?: string
          merchant_id?: string
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
      merchant_pos_integrations: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
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
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          max_capacity: number
          merchant_id: string
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          price: number
          requires_pet: boolean
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          merchant_id: string
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          requires_pet?: boolean
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          merchant_id?: string
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          requires_pet?: boolean
          updated_at?: string
        }
        Relationships: [
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
      merchant_tax_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["tax_expense_category"]
          created_at: string
          description: string | null
          expense_date: string
          id: string
          merchant_id: string
          receipt_url: string | null
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
          merchant_id: string
          receipt_url?: string | null
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
          merchant_id?: string
          receipt_url?: string | null
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
          address: string | null
          business_name: string
          business_type: string
          cashback_rate: number
          contact_person: string | null
          created_at: string
          description: string | null
          email: string | null
          funding_status: string | null
          id: string
          is_sponsored: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          owner_name: string | null
          phone: string | null
          price_range: number | null
          sponsored_until: string | null
          storefront_slug: string
          stripe_account_id: string | null
          stripe_account_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_pawbucks?: boolean
          address?: string | null
          business_name: string
          business_type: string
          cashback_rate?: number
          contact_person?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          funding_status?: string | null
          id?: string
          is_sponsored?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          owner_name?: string | null
          phone?: string | null
          price_range?: number | null
          sponsored_until?: string | null
          storefront_slug: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_pawbucks?: boolean
          address?: string | null
          business_name?: string
          business_type?: string
          cashback_rate?: number
          contact_person?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          funding_status?: string | null
          id?: string
          is_sponsored?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          owner_name?: string | null
          phone?: string | null
          price_range?: number | null
          sponsored_until?: string | null
          storefront_slug?: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
          user_id?: string
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
          message: string
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
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
          cash_equivalent: number | null
          coins_required: number
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
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
          cash_equivalent?: number | null
          coins_required: number
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
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
          cash_equivalent?: number | null
          coins_required?: number
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
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
          contact_email: string
          created_at: string
          id: string
          location: string
          name: string
          stripe_account_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_email: string
          created_at?: string
          id?: string
          location: string
          name: string
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pawbucks_activity: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          partner_id: string | null
          pawbucks_status: string | null
          receipt_id: string | null
          redemption_code: string | null
          redemption_used: boolean | null
          source: string
          transaction_id: string | null
          type: string
          user_id: string
          vest_date: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          pawbucks_status?: string | null
          receipt_id?: string | null
          redemption_code?: string | null
          redemption_used?: boolean | null
          source: string
          transaction_id?: string | null
          type: string
          user_id: string
          vest_date?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          pawbucks_status?: string | null
          receipt_id?: string | null
          redemption_code?: string | null
          redemption_used?: boolean | null
          source?: string
          transaction_id?: string | null
          type?: string
          user_id?: string
          vest_date?: string | null
        }
        Relationships: [
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
      pet_profiles: {
        Row: {
          age_estimate: string | null
          birthday: string | null
          breed: string | null
          collar_description: string | null
          color_markings: string | null
          created_at: string
          gender: string | null
          id: string
          identifying_features: string | null
          microchip_number: string | null
          name: string
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
          gender?: string | null
          id?: string
          identifying_features?: string | null
          microchip_number?: string | null
          name: string
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
          gender?: string | null
          id?: string
          identifying_features?: string | null
          microchip_number?: string | null
          name?: string
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
      pet_store_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          merchant_id: string | null
          name: string
          price: number
          price_pawbucks: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id?: string | null
          name: string
          price: number
          price_pawbucks?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id?: string | null
          name?: string
          price?: number
          price_pawbucks?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          auto_redeem_pawbucks: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          referral_code: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          auto_redeem_pawbucks?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          referral_code?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          auto_redeem_pawbucks?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          referral_code?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      receipt_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          decision_reason: string | null
          id: string
          merchant_name: string
          pawbucks_awarded: number | null
          purchase_amount: number
          receipt_date: string
          receipt_image_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          merchant_name: string
          pawbucks_awarded?: number | null
          purchase_amount: number
          receipt_date: string
          receipt_image_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          merchant_name?: string
          pawbucks_awarded?: number | null
          purchase_amount?: number
          receipt_date?: string
          receipt_image_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          end_time: string
          id: string
          merchant_id: string
          notes: string | null
          payment_status: string
          pet_id: string | null
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id: string | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_time: string
          id?: string
          merchant_id: string
          notes?: string | null
          payment_status?: string
          pet_id?: string | null
          service_id: string
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_time?: string
          id?: string
          merchant_id?: string
          notes?: string | null
          payment_status?: string
          pet_id?: string | null
          service_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
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
            foreignKeyName: "service_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "merchant_services"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          start_date: string
          status: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          cashback_earned: number
          created_at: string
          description: string | null
          id: string
          merchant_id: string
          rewards_earned: number
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cashback_earned?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id: string
          rewards_earned?: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cashback_earned?: number
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string
          rewards_earned?: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "transactions_pet_owner_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_pet_owner_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "reviewer_profiles"
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
          vet_id: string
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
          vet_id: string
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
          vet_id?: string
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
      vet_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          pet_id: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          user_id: string
          vet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          pet_id?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          user_id: string
          vet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          pet_id?: string | null
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
      merchants_public: {
        Row: {
          accepts_pawbucks: boolean | null
          address: string | null
          business_name: string | null
          business_type: string | null
          cashback_rate: number | null
          created_at: string | null
          description: string | null
          id: string | null
          is_sponsored: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          phone: string | null
          price_range: number | null
          sponsored_until: string | null
          storefront_slug: string | null
        }
        Insert: {
          accepts_pawbucks?: boolean | null
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          cashback_rate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_sponsored?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          phone?: string | null
          price_range?: number | null
          sponsored_until?: string | null
          storefront_slug?: string | null
        }
        Update: {
          accepts_pawbucks?: boolean | null
          address?: string | null
          business_name?: string | null
          business_type?: string | null
          cashback_rate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_sponsored?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          phone?: string | null
          price_range?: number | null
          sponsored_until?: string | null
          storefront_slug?: string | null
        }
        Relationships: []
      }
      partner_vets_public: {
        Row: {
          created_at: string | null
          id: string | null
          location: string | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
        }
        Relationships: []
      }
      reviewer_profiles: {
        Row: {
          full_name: string | null
          id: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aggregate_search_ranking_stats: {
        Args: { target_date?: string }
        Returns: undefined
      }
      aggregate_sponsored_stats: {
        Args: { target_date?: string }
        Returns: undefined
      }
      generate_redemption_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_storefront_slug: {
        Args: { business_name: string }
        Returns: string
      }
      get_admin_analytics: {
        Args: never
        Returns: {
          total_cashback_distributed: number
          total_gmv: number
          total_merchants: number
          total_transactions: number
          total_users: number
        }[]
      }
      get_merchant_analytics: {
        Args: { _merchant_id: string }
        Returns: {
          avg_transaction_amount: number
          business_name: string
          funding_deal_status: string
          merchant_id: string
          remaining_balance: number
          repayment_rate: number
          total_cashback_paid: number
          total_customers: number
          total_earnings: number
          total_transactions: number
        }[]
      }
      get_monthly_non_partner_pawbucks: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_pawbucks_breakdown: {
        Args: { p_user_id: string }
        Returns: {
          available_balance: number
          pending_balance: number
          total_balance: number
        }[]
      }
      get_user_vet_ids: { Args: { check_user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_offer_valid: { Args: { offer_uuid: string }; Returns: boolean }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
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
      user_has_vet_relationship: {
        Args: { check_user_id: string; check_vet_id: string }
        Returns: boolean
      }
      user_owns_vet: {
        Args: { check_user_id: string; vet_user_id: string }
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
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
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
      service_category:
        | "daycare"
        | "boarding"
        | "grooming"
        | "walking"
        | "training"
        | "veterinary"
        | "pet_sitting"
        | "other"
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
      user_type: "pet_owner" | "merchant"
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
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
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
      ],
      user_type: ["pet_owner", "merchant"],
    },
  },
} as const
