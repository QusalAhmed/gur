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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      storefront_inquiries: {
        Row: {
          id: string
          ref_code: string
          channel: string
          customer_phone: string | null
          fbp: string | null
          fbc: string | null
          client_ip: string | null
          user_agent: string | null
          event_source_url: string | null
          meta_tracking: Json | null
          status: string
          converted_order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ref_code: string
          channel?: string
          customer_phone?: string | null
          fbp?: string | null
          fbc?: string | null
          client_ip?: string | null
          user_agent?: string | null
          event_source_url?: string | null
          meta_tracking?: Json | null
          status?: string
          converted_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ref_code?: string
          channel?: string
          customer_phone?: string | null
          fbp?: string | null
          fbc?: string | null
          client_ip?: string | null
          user_agent?: string | null
          event_source_url?: string | null
          meta_tracking?: Json | null
          status?: string
          converted_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_inquiries_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_line: string
          business_id: string | null
          country_code: string
          created_at: string
          district_id: number | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          latitude: number | null
          longitude: number | null
          phone: string
          postal_code: string | null
          recipient_name: string
          upazila: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line: string
          business_id?: string | null
          country_code?: string
          created_at?: string
          district_id?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone: string
          postal_code?: string | null
          recipient_name: string
          upazila?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line?: string
          business_id?: string | null
          country_code?: string
          created_at?: string
          district_id?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string
          postal_code?: string | null
          recipient_name?: string
          upazila?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          ash_pct: number | null
          best_before: string | null
          brix: number | null
          created_at: string
          density_kg_per_l: number | null
          id: string
          lot_code: string
          moisture_pct: number | null
          notes: string | null
          ph: number | null
          produced_on: string | null
          product_id: string
          received_on: string | null
          status: Database["public"]["Enums"]["batch_status"]
          supplier_id: string | null
          tested_by: string | null
          tested_on: string | null
          total_sugar_pct: number | null
          updated_at: string
        }
        Insert: {
          ash_pct?: number | null
          best_before?: string | null
          brix?: number | null
          created_at?: string
          density_kg_per_l?: number | null
          id?: string
          lot_code: string
          moisture_pct?: number | null
          notes?: string | null
          ph?: number | null
          produced_on?: string | null
          product_id: string
          received_on?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          supplier_id?: string | null
          tested_by?: string | null
          tested_on?: string | null
          total_sugar_pct?: number | null
          updated_at?: string
        }
        Update: {
          ash_pct?: number | null
          best_before?: string | null
          brix?: number | null
          created_at?: string
          density_kg_per_l?: number | null
          id?: string
          lot_code?: string
          moisture_pct?: number | null
          notes?: string | null
          ph?: number | null
          produced_on?: string | null
          product_id?: string
          received_on?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          supplier_id?: string | null
          tested_by?: string | null
          tested_on?: string | null
          total_sugar_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_accounts: {
        Row: {
          address_line: string | null
          approved_at: string | null
          approved_by: string | null
          bin: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          district_id: number | null
          id: string
          industry: string | null
          name: string
          payment_terms_days: number
          status: Database["public"]["Enums"]["business_status"]
          tin: string | null
          trade_license_no: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bin?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          district_id?: number | null
          id?: string
          industry?: string | null
          name: string
          payment_terms_days?: number
          status?: Database["public"]["Enums"]["business_status"]
          tin?: string | null
          trade_license_no?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bin?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          district_id?: number | null
          id?: string
          industry?: string | null
          name?: string
          payment_terms_days?: number
          status?: Database["public"]["Enums"]["business_status"]
          tin?: string | null
          trade_license_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_accounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_accounts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          quantity: number
          updated_at: string
          user_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          quantity: number
          updated_at?: string
          user_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          description_bn: string | null
          google_product_category: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          name_bn: string | null
          parent_id: string | null
          product_type: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_bn?: string | null
          google_product_category?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          name_bn?: string | null
          parent_id?: string | null
          product_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_bn?: string | null
          google_product_category?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          name_bn?: string | null
          parent_id?: string | null
          product_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_phone: string | null
          discount_amount: number
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_phone?: string | null
          discount_amount?: number
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          business_only: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_order_amount: number
          starts_at: string | null
          updated_at: string
          usage_limit_per_customer: number
          usage_limit_total: number | null
          used_count: number
          value: number
        }
        Insert: {
          business_only?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit_per_customer?: number
          usage_limit_total?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          business_only?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit_per_customer?: number
          usage_limit_total?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      courier_webhook_logs: {
        Row: {
          consignment_id: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          invoice: string | null
          notification_type: string
          order_id: string | null
          order_number: string | null
          payload: Json
          response_data: Json | null
          status: string
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          invoice?: string | null
          notification_type: string
          order_id?: string | null
          order_number?: string | null
          payload?: Json
          response_data?: Json | null
          status?: string
        }
        Update: {
          consignment_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          invoice?: string | null
          notification_type?: string
          order_id?: string | null
          order_number?: string | null
          payload?: Json
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_webhook_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_webhook_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_delivery_reports: {
        Row: {
          cancellation_ratio: number | null
          cancelled_count: number | null
          delivered_count: number | null
          delivery_ratio: number | null
          doubtful_reports: boolean | null
          fraud_categories: Json | null
          phone: string
          raw_response: Json | null
          return_ratio: number | null
          stored_at: string
          total_reports: number | null
          updated_at: string
          volume_band: string | null
          volume_range: string | null
        }
        Insert: {
          cancellation_ratio?: number | null
          cancelled_count?: number | null
          delivered_count?: number | null
          delivery_ratio?: number | null
          doubtful_reports?: boolean | null
          fraud_categories?: Json | null
          phone: string
          raw_response?: Json | null
          return_ratio?: number | null
          stored_at?: string
          total_reports?: number | null
          updated_at?: string
          volume_band?: string | null
          volume_range?: string | null
        }
        Update: {
          cancellation_ratio?: number | null
          cancelled_count?: number | null
          delivered_count?: number | null
          delivery_ratio?: number | null
          doubtful_reports?: boolean | null
          fraud_categories?: Json | null
          phone?: string
          raw_response?: Json | null
          return_ratio?: number | null
          stored_at?: string
          total_reports?: number | null
          updated_at?: string
          volume_band?: string | null
          volume_range?: string | null
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          id: number
          is_active: boolean
          name: string
          name_bn: string | null
        }
        Insert: {
          id?: never
          is_active?: boolean
          name: string
          name_bn?: string | null
        }
        Update: {
          id?: never
          is_active?: boolean
          name?: string
          name_bn?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          is_public: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          product_id: string | null
          storage_path: string
          title: string
          title_bn: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          product_id?: string | null
          storage_path: string
          title: string
          title_bn?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["document_kind"]
          product_id?: string | null
          storage_path?: string
          title?: string
          title_bn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_batch_stock"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          answer_bn: string | null
          created_at: string
          id: string
          is_active: boolean
          question: string
          question_bn: string | null
          sort_order: number
          topic: string | null
          updated_at: string
        }
        Insert: {
          answer: string
          answer_bn?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          question_bn?: string | null
          sort_order?: number
          topic?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          answer_bn?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          question_bn?: string | null
          sort_order?: number
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      geo_districts: {
        Row: {
          division_id: number
          id: number
          name: string
          name_bn: string | null
          zone_id: number | null
        }
        Insert: {
          division_id: number
          id?: never
          name: string
          name_bn?: string | null
          zone_id?: number | null
        }
        Update: {
          division_id?: number
          id?: never
          name?: string
          name_bn?: string | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_districts_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "geo_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_districts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_divisions: {
        Row: {
          id: number
          name: string
          name_bn: string | null
        }
        Insert: {
          id?: never
          name: string
          name_bn?: string | null
        }
        Update: {
          id?: never
          name?: string
          name_bn?: string | null
        }
        Relationships: []
      }
      inventory_levels: {
        Row: {
          available: number | null
          on_hand: number
          reorder_point: number
          reserved: number
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          available?: number | null
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          available?: number | null
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["outbox_channel"]
          created_at: string
          id: number
          last_error: string | null
          payload: Json
          recipient: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          template: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["outbox_channel"]
          created_at?: string
          id?: never
          last_error?: string | null
          payload?: Json
          recipient: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["outbox_channel"]
          created_at?: string
          id?: never
          last_error?: string | null
          payload?: Json
          recipient?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_value: string | null
          id: number
          message: string | null
          order_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_value?: string | null
          id?: never
          message?: string | null
          order_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: never
          message?: string | null
          order_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_subtotal: number | null
          line_total: number | null
          net_quantity: number | null
          net_unit: Database["public"]["Enums"]["uom"] | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          shipped_quantity: number
          sku: string
          tax_amount: number
          tax_rate: number
          unit_price: number
          variant_id: string | null
          variant_name: string
          warehouse_id: string | null
          weight_grams: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_subtotal?: number | null
          line_total?: number | null
          net_quantity?: number | null
          net_unit?: Database["public"]["Enums"]["uom"] | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          shipped_quantity?: number
          sku: string
          tax_amount?: number
          tax_rate?: number
          unit_price: number
          variant_id?: string | null
          variant_name: string
          warehouse_id?: string | null
          weight_grams?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_subtotal?: number | null
          line_total?: number | null
          net_quantity?: number | null
          net_unit?: Database["public"]["Enums"]["uom"] | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          shipped_quantity?: number
          sku?: string
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string
          warehouse_id?: string | null
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author: string
          created_at: string
          id: string
          note: string
          order_id: string | null
          order_number: string
          type: Database["public"]["Enums"]["order_note_type"]
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          note: string
          order_id?: string | null
          order_number: string
          type?: Database["public"]["Enums"]["order_note_type"]
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          note?: string
          order_id?: string | null
          order_number?: string
          type?: Database["public"]["Enums"]["order_note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number
          attribution: Json
          billing_address: Json | null
          business_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          channel: string
          confirmed_at: string | null
          coupon_code: string | null
          courier_consignment_id: string | null
          courier_delivery_charge: number | null
          courier_invoice: string | null
          courier_payload_snapshot: Json | null
          courier_tracking_code: string | null
          courier_tracking_url: string | null
          created_at: string
          currency: string
          customer_alternative_phone: string | null
          customer_email: string | null
          customer_name: string | null
          customer_note: string | null
          customer_phone: string | null
          delivered_at: string | null
          discount_total: number
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          order_number: string
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          printed_at: string | null
          printed_courier_snapshot: Json | null
          public_token: string
          quote_request_id: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_method_id: string | null
          shipping_method_name: string | null
          shipping_phone: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          total_weight_kg: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number
          attribution?: Json
          billing_address?: Json | null
          business_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          confirmed_at?: string | null
          coupon_code?: string | null
          courier_consignment_id?: string | null
          courier_delivery_charge?: number | null
          courier_invoice?: string | null
          courier_payload_snapshot?: Json | null
          courier_tracking_code?: string | null
          courier_tracking_url?: string | null
          created_at?: string
          currency?: string
          customer_alternative_phone?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          order_number: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          printed_at?: string | null
          printed_courier_snapshot?: Json | null
          public_token?: string
          quote_request_id?: string | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_method_id?: string | null
          shipping_method_name?: string | null
          shipping_phone?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total?: number
          total_weight_kg?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          attribution?: Json
          billing_address?: Json | null
          business_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          confirmed_at?: string | null
          coupon_code?: string | null
          courier_consignment_id?: string | null
          courier_delivery_charge?: number | null
          courier_invoice?: string | null
          courier_payload_snapshot?: Json | null
          courier_tracking_code?: string | null
          courier_tracking_url?: string | null
          created_at?: string
          currency?: string
          customer_alternative_phone?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          order_number?: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          printed_at?: string | null
          printed_courier_snapshot?: Json | null
          public_token?: string
          quote_request_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_method_id?: string | null
          shipping_method_name?: string | null
          shipping_phone?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          total_weight_kg?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string | null
          dispatched_at: string | null
          event_name: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          payload: Json
          retry_count: number
          status: string
          updated_at: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type?: string
          created_at?: string | null
          dispatched_at?: string | null
          event_name: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string | null
          dispatched_at?: string | null
          event_name?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          created_at: string
          event: string
          id: number
          payload: Json
          payment_id: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          payload: Json
          payment_id?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          payload?: Json
          payment_id?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          failure_reason: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at: string | null
          payer_account: string | null
          provider: string | null
          provider_payment_id: string | null
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["payment_txn_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at?: string | null
          payer_account?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          paid_at?: string | null
          payer_account?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_name: string | null
          body: string
          body_bn: string | null
          cover_image_path: string | null
          created_at: string
          excerpt: string | null
          excerpt_bn: string | null
          id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          tags: string[]
          title: string
          title_bn: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body?: string
          body_bn?: string | null
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_bn?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          title: string
          title_bn?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          body_bn?: string | null
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_bn?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          title?: string
          title_bn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      price_tiers: {
        Row: {
          created_at: string
          id: string
          min_qty: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_qty: number
          unit_price: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_qty?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          alt_text_bn: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          alt_text_bn?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          alt_text_bn?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_verified_purchase: boolean
          product_id: string
          rating: number
          reviewer_name: string
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          product_id: string
          rating: number
          reviewer_name?: string
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          product_id?: string
          rating?: number
          reviewer_name?: string
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          allow_backorder: boolean
          barcode: string | null
          compare_at_price: number | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          low_stock_threshold: number
          max_order_qty: number | null
          min_order_qty: number
          name: string
          name_bn: string | null
          net_quantity: number
          net_unit: Database["public"]["Enums"]["uom"]
          order_qty_step: number
          pack_type: Database["public"]["Enums"]["pack_type"]
          price: number
          product_id: string
          sku: string
          sort_order: number
          stock_status: Database["public"]["Enums"]["stock_status"]
          track_inventory: boolean
          updated_at: string
          weight_grams: number
        }
        Insert: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          low_stock_threshold?: number
          max_order_qty?: number | null
          min_order_qty?: number
          name: string
          name_bn?: string | null
          net_quantity: number
          net_unit?: Database["public"]["Enums"]["uom"]
          order_qty_step?: number
          pack_type?: Database["public"]["Enums"]["pack_type"]
          price: number
          product_id: string
          sku: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"]
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          low_stock_threshold?: number
          max_order_qty?: number | null
          min_order_qty?: number
          name?: string
          name_bn?: string | null
          net_quantity?: number
          net_unit?: Database["public"]["Enums"]["uom"]
          order_qty_step?: number
          pack_type?: Database["public"]["Enums"]["pack_type"]
          price?: number
          product_id?: string
          sku?: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"]
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          certifications: string[]
          created_at: string
          description: string | null
          description_bn: string | null
          google_product_category: string | null
          grade: string | null
          id: string
          ingredients: string | null
          is_featured: boolean
          name: string
          name_bn: string | null
          nutrition: Json
          origin: string | null
          product_type: string | null
          published_at: string | null
          rating_avg: number
          rating_count: number
          search: unknown
          seo_description: string | null
          seo_title: string | null
          shelf_life_days: number | null
          slug: string
          sort_order: number
          specifications: Json
          status: Database["public"]["Enums"]["product_status"]
          storage_instructions: string | null
          summary: string | null
          summary_bn: string | null
          tags: string[]
          tax_rate: number
          updated_at: string
          uses: Database["public"]["Enums"]["product_use"][]
        }
        Insert: {
          category_id?: string | null
          certifications?: string[]
          created_at?: string
          description?: string | null
          description_bn?: string | null
          google_product_category?: string | null
          grade?: string | null
          id?: string
          ingredients?: string | null
          is_featured?: boolean
          name: string
          name_bn?: string | null
          nutrition?: Json
          origin?: string | null
          product_type?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          search?: unknown
          seo_description?: string | null
          seo_title?: string | null
          shelf_life_days?: number | null
          slug: string
          sort_order?: number
          specifications?: Json
          status?: Database["public"]["Enums"]["product_status"]
          storage_instructions?: string | null
          summary?: string | null
          summary_bn?: string | null
          tags?: string[]
          tax_rate?: number
          updated_at?: string
          uses?: Database["public"]["Enums"]["product_use"][]
        }
        Update: {
          category_id?: string | null
          certifications?: string[]
          created_at?: string
          description?: string | null
          description_bn?: string | null
          google_product_category?: string | null
          grade?: string | null
          id?: string
          ingredients?: string | null
          is_featured?: boolean
          name?: string
          name_bn?: string | null
          nutrition?: Json
          origin?: string | null
          product_type?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          search?: unknown
          seo_description?: string | null
          seo_title?: string | null
          shelf_life_days?: number | null
          slug?: string
          sort_order?: number
          specifications?: Json
          status?: Database["public"]["Enums"]["product_status"]
          storage_instructions?: string | null
          summary?: string | null
          summary_bn?: string | null
          tags?: string[]
          tax_rate?: number
          updated_at?: string
          uses?: Database["public"]["Enums"]["product_use"][]
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          marketing_opt_in: boolean
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          assigned_to: string | null
          business_id: string | null
          company_name: string | null
          contact_name: string
          created_at: string
          delivery_address: string | null
          delivery_district_id: number | null
          email: string | null
          id: string
          items: Json
          message: string | null
          phone: string
          quote_reply: string | null
          quote_valid_until: string | null
          quoted_total: number | null
          reference_no: string
          required_by: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_id?: string | null
          company_name?: string | null
          contact_name: string
          created_at?: string
          delivery_address?: string | null
          delivery_district_id?: number | null
          email?: string | null
          id?: string
          items: Json
          message?: string | null
          phone: string
          quote_reply?: string | null
          quote_valid_until?: string | null
          quoted_total?: number | null
          reference_no: string
          required_by?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string | null
          company_name?: string | null
          contact_name?: string
          created_at?: string
          delivery_address?: string | null
          delivery_district_id?: number | null
          email?: string | null
          id?: string
          items?: Json
          message?: string | null
          phone?: string
          quote_reply?: string | null
          quote_valid_until?: string | null
          quoted_total?: number | null
          reference_no?: string
          required_by?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_delivery_district_id_fkey"
            columns: ["delivery_district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_batch_stock"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "shipment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vehicle_no: string | null
          warehouse_id: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vehicle_no?: string | null
          warehouse_id?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vehicle_no?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          code: string
          created_at: string
          description: string | null
          description_bn: string | null
          id: string
          is_active: boolean
          is_pickup: boolean
          name: string
          name_bn: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          description_bn?: string | null
          id?: string
          is_active?: boolean
          is_pickup?: boolean
          name: string
          name_bn?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          description_bn?: string | null
          id?: string
          is_active?: boolean
          is_pickup?: boolean
          name?: string
          name_bn?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          base_fee: number
          created_at: string
          eta_days_max: number | null
          eta_days_min: number | null
          free_over_amount: number | null
          id: string
          is_active: boolean
          max_weight_kg: number | null
          method_id: string
          min_weight_kg: number
          per_kg_fee: number
          updated_at: string
          zone_id: number | null
        }
        Insert: {
          base_fee?: number
          created_at?: string
          eta_days_max?: number | null
          eta_days_min?: number | null
          free_over_amount?: number | null
          id?: string
          is_active?: boolean
          max_weight_kg?: number | null
          method_id: string
          min_weight_kg?: number
          per_kg_fee?: number
          updated_at?: string
          zone_id?: number | null
        }
        Update: {
          base_fee?: number
          created_at?: string
          eta_days_max?: number | null
          eta_days_min?: number | null
          free_over_amount?: number | null
          id?: string
          is_active?: boolean
          max_weight_kg?: number | null
          method_id?: string
          min_weight_kg?: number
          per_kg_fee?: number
          updated_at?: string
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          api_response: Json | null
          campaign_cost: number | null
          created_at: string | null
          error_message: string | null
          gateway: string | null
          id: string
          is_success: boolean
          message_text: string
          order_id: string | null
          order_number: string | null
          recipient_phone: string
          response_code: number | null
          sender_id: string | null
          status_event: string
        }
        Insert: {
          api_response?: Json | null
          campaign_cost?: number | null
          created_at?: string | null
          error_message?: string | null
          gateway?: string | null
          id?: string
          is_success?: boolean
          message_text: string
          order_id?: string | null
          order_number?: string | null
          recipient_phone: string
          response_code?: number | null
          sender_id?: string | null
          status_event: string
        }
        Update: {
          api_response?: Json | null
          campaign_cost?: number | null
          created_at?: string | null
          error_message?: string | null
          gateway?: string | null
          id?: string
          is_success?: boolean
          message_text?: string
          order_id?: string | null
          order_number?: string | null
          recipient_phone?: string
          response_code?: number | null
          sender_id?: string | null
          status_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          created_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: number
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          order_id: string | null
          quantity_delta: number
          shipment_id: string | null
          unit_cost: number | null
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          order_id?: string | null
          quantity_delta: number
          shipment_id?: string | null
          unit_cost?: number | null
          variant_id: string
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          order_id?: string | null
          quantity_delta?: number
          shipment_id?: string | null
          unit_cost?: number | null
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_batch_stock"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_low_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          purchase_id: string | null
          reference: string | null
          status: string
          supplier_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string
          purchase_id?: string | null
          reference?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string
          purchase_id?: string | null
          reference?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "supplier_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchase_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number | null
          product_id: string | null
          purchase_id: string
          quantity: number
          stock_movement_id: number | null
          unit: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total?: number | null
          product_id?: string | null
          purchase_id: string
          quantity: number
          stock_movement_id?: number | null
          unit?: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number | null
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          stock_movement_id?: number | null
          unit?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "supplier_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchases: {
        Row: {
          created_at: string
          created_by: string | null
          discount_amount: number
          extra_charges: number
          id: string
          notes: string | null
          purchase_date: string
          purchase_number: string
          status: string
          subtotal: number
          supplier_id: string
          total_amount: number | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          extra_charges?: number
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number?: string
          status?: string
          subtotal?: number
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          extra_charges?: number
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          district_id: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          supplier_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          district_id?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          supplier_type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          district_id?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          supplier_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          district_id: number | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          district_id?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          district_id?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "geo_districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_batch_stock: {
        Row: {
          ash_pct: number | null
          batch_id: string | null
          batch_status: Database["public"]["Enums"]["batch_status"] | null
          best_before: string | null
          brix: number | null
          density_kg_per_l: number | null
          lot_code: string | null
          moisture_pct: number | null
          ph: number | null
          product_id: string | null
          product_name: string | null
          received_on: string | null
          remaining_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_incomplete_orders: {
        Row: {
          age_hours: number | null
          attribution: Json | null
          campaign: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          district_name: string | null
          grand_total: number | null
          id: string | null
          item_count: number | null
          items_summary: Json | null
          order_number: string | null
          shipping_address: Json | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          age_hours?: never
          attribution?: Json | null
          campaign?: never
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          district_name?: never
          grand_total?: number | null
          id?: string | null
          item_count?: never
          items_summary?: never
          order_number?: string | null
          shipping_address?: Json | null
          source?: never
          updated_at?: string | null
        }
        Update: {
          age_hours?: never
          attribution?: Json | null
          campaign?: never
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          district_name?: never
          grand_total?: number | null
          id?: string | null
          item_count?: never
          items_summary?: never
          order_number?: string | null
          shipping_address?: Json | null
          source?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_low_stock: {
        Row: {
          available: number | null
          on_hand: number | null
          product_name: string | null
          reorder_point: number | null
          reserved: number | null
          sku: string | null
          variant_id: string | null
          variant_name: string | null
          warehouse: string | null
        }
        Relationships: []
      }
      admin_sales_daily: {
        Row: {
          avg_order_value: number | null
          cancelled: number | null
          collected: number | null
          day: string | null
          orders: number | null
          revenue: number | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          author: string | null
          created_at: string | null
          id: string | null
          note: string | null
          order_id: string | null
          order_number: string | null
          type: Database["public"]["Enums"]["order_note_type"] | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          order_number?: string | null
          type?: Database["public"]["Enums"]["order_note_type"] | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          order_id?: string | null
          order_number?: string | null
          type?: Database["public"]["Enums"]["order_note_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_incomplete_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_cards: {
        Row: {
          category_id: string | null
          category_name: string | null
          category_name_bn: string | null
          category_slug: string | null
          certifications: string[] | null
          grade: string | null
          id: string | null
          image_path: string | null
          in_stock: boolean | null
          is_featured: boolean | null
          name: string | null
          name_bn: string | null
          price_from: number | null
          published_at: string | null
          rating_avg: number | null
          rating_count: number | null
          slug: string | null
          sort_order: number | null
          summary: string | null
          summary_bn: string | null
          uses: Database["public"]["Enums"]["product_use"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_balances: {
        Row: {
          last_activity_date: string | null
          net_balance: number | null
          opening_balance: number | null
          payment_count: number | null
          purchase_count: number | null
          supplier_id: string | null
          total_paid: number | null
          total_purchased: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_kpis: { Args: { p_from?: string; p_to?: string }; Returns: Json }
      admin_sales_breakdown: {
        Args: { p_dimension?: string; p_from?: string; p_to?: string }
        Returns: {
          dimension_key: string
          dimension_label: string
          orders_count: number
          revenue: number
        }[]
      }
      admin_sales_series: {
        Args: { p_bucket?: string; p_from?: string; p_to?: string }
        Returns: {
          bucket_label: string
          bucket_time: string
          collected: number
          orders_count: number
          revenue: number
        }[]
      }
      admin_top_products: {
        Args: { p_from?: string; p_limit?: number; p_to?: string }
        Returns: {
          order_count: number
          product_id: string
          product_name: string
          revenue: number
          units_sold: number
        }[]
      }
      assign_invoice_number: { Args: { p_order_id: string }; Returns: string }
      build_order_courier_snapshot: {
        Args: { p_order: Database["public"]["Tables"]["orders"]["Row"] }
        Returns: Json
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      cleanup_old_notifications: { Args: never; Returns: number }
      get_order_by_token: { Args: { p_token: string }; Returns: Json }
      get_order_courier_print_diff: {
        Args: { p_current: Json; p_printed: Json }
        Returns: Json
      }
      lot_lookup: {
        Args: { p_lot_code: string }
        Returns: {
          ash_pct: number
          best_before: string
          brix: number
          density_kg_per_l: number
          lot_code: string
          moisture_pct: number
          ph: number
          produced_on: string
          product_name: string
          product_name_bn: string
          product_slug: string
          status: Database["public"]["Enums"]["batch_status"]
          tested_on: string
          total_sugar_pct: number
        }[]
      }
      mark_orders_as_printed: {
        Args: { p_order_numbers: string[] }
        Returns: number
      }
      place_order: {
        Args: {
          p_attribution?: Json
          p_billing_address?: Json
          p_business_id?: string
          p_channel?: string
          p_coupon_code?: string
          p_customer: Json
          p_customer_note?: string
          p_for_user?: string
          p_items: Json
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_price_overrides?: Json
          p_quote_request_id?: string
          p_shipping_address: Json
          p_shipping_method_id: string
        }
        Returns: Json
      }
      preview_cart: {
        Args: {
          p_business_id?: string
          p_coupon_code?: string
          p_district_id?: number
          p_items: Json
          p_shipping_method_id?: string
        }
        Returns: Json
      }
      process_storefront_order: {
        Args: {
          p_address_line?: string
          p_courier_name?: string
          p_customer_name?: string
          p_customer_note?: string
          p_customer_phone?: string
          p_delivery_zone?: string
          p_district?: string
          p_division?: string
          p_items?: Json
          p_order_id?: string
          p_status?: string
        }
        Returns: Json
      }
      search_products: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          category_id: string | null
          category_name: string | null
          category_name_bn: string | null
          category_slug: string | null
          certifications: string[] | null
          grade: string | null
          id: string | null
          image_path: string | null
          in_stock: boolean | null
          is_featured: boolean | null
          name: string | null
          name_bn: string | null
          price_from: number | null
          published_at: string | null
          rating_avg: number | null
          rating_count: number | null
          slug: string | null
          sort_order: number | null
          summary: string | null
          summary_bn: string | null
          uses: Database["public"]["Enums"]["product_use"][] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_order_items: {
        Args: { p_items: Json; p_order_id: string; p_price_overrides?: Json }
        Returns: Json
      }
      track_order: {
        Args: { p_order_number: string; p_phone: string }
        Returns: Json
      }
    }
    Enums: {
      account_type: "individual" | "business"
      app_role: "owner" | "admin" | "manager" | "editor" | "support"
      batch_status: "quarantine" | "released" | "blocked" | "expired"
      business_member_role: "owner" | "buyer" | "accountant"
      business_status: "pending" | "approved" | "suspended"
      discount_type: "percentage" | "fixed_amount" | "free_shipping"
      document_kind:
        | "coa"
        | "spec_sheet"
        | "msds"
        | "certificate"
        | "brochure"
        | "other"
      fulfillment_status: "unfulfilled" | "partial" | "fulfilled"
      message_status: "new" | "read" | "replied" | "spam"
      notification_type:
        | "order_created"
        | "order_status_changed"
        | "low_stock"
        | "customer_inquiry"
        | "system_alert"
      order_note_type:
        | "internal"
        | "delivery"
        | "packaging"
        | "internal_staff_note"
        | "delivery_note"
        | "packaging_note"
        | "system"
        | "system_note"
      order_status:
        | "incomplete_order"
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
      outbox_channel: "sms" | "email" | "whatsapp" | "webhook"
      outbox_status: "pending" | "sent" | "failed" | "cancelled"
      pack_type:
        | "bottle"
        | "jar"
        | "pouch"
        | "pail"
        | "jerrycan"
        | "drum"
        | "ibc_tote"
        | "bag"
        | "block"
        | "tanker"
        | "bulk"
        | "other"
        | "foil"
        | "box"
      payment_kind: "charge" | "refund"
      payment_method:
        | "cod"
        | "bkash"
        | "nagad"
        | "rocket"
        | "card"
        | "bank_transfer"
        | "cash"
        | "credit_terms"
      payment_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "partially_refunded"
        | "refunded"
      payment_txn_status:
        | "initiated"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
      post_status: "draft" | "published" | "archived"
      product_status: "draft" | "active" | "archived"
      product_use:
        | "edible"
        | "animal_feed"
        | "industrial"
        | "agricultural"
        | "cosmetic"
      quote_status:
        | "new"
        | "in_review"
        | "quoted"
        | "accepted"
        | "declined"
        | "expired"
        | "converted"
      review_status: "pending" | "approved" | "rejected"
      shipment_status:
        | "preparing"
        | "in_transit"
        | "delivered"
        | "failed"
        | "returned"
      stock_movement_type:
        | "receipt"
        | "sale"
        | "return"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
        | "write_off"
      stock_status: "in_stock" | "low_stock" | "out_of_stock" | "backorder"
      uom: "g" | "kg" | "ml" | "l" | "t" | "pcs"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["individual", "business"],
      app_role: ["owner", "admin", "manager", "editor", "support"],
      batch_status: ["quarantine", "released", "blocked", "expired"],
      business_member_role: ["owner", "buyer", "accountant"],
      business_status: ["pending", "approved", "suspended"],
      discount_type: ["percentage", "fixed_amount", "free_shipping"],
      document_kind: [
        "coa",
        "spec_sheet",
        "msds",
        "certificate",
        "brochure",
        "other",
      ],
      fulfillment_status: ["unfulfilled", "partial", "fulfilled"],
      message_status: ["new", "read", "replied", "spam"],
      notification_type: [
        "order_created",
        "order_status_changed",
        "low_stock",
        "customer_inquiry",
        "system_alert",
      ],
      order_note_type: [
        "internal",
        "delivery",
        "packaging",
        "internal_staff_note",
        "delivery_note",
        "packaging_note",
        "system",
        "system_note",
      ],
      order_status: [
        "incomplete_order",
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      outbox_channel: ["sms", "email", "whatsapp", "webhook"],
      outbox_status: ["pending", "sent", "failed", "cancelled"],
      pack_type: [
        "bottle",
        "jar",
        "pouch",
        "pail",
        "jerrycan",
        "drum",
        "ibc_tote",
        "bag",
        "block",
        "tanker",
        "bulk",
        "other",
        "foil",
        "box",
      ],
      payment_kind: ["charge", "refund"],
      payment_method: [
        "cod",
        "bkash",
        "nagad",
        "rocket",
        "card",
        "bank_transfer",
        "cash",
        "credit_terms",
      ],
      payment_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "partially_refunded",
        "refunded",
      ],
      payment_txn_status: [
        "initiated",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
      ],
      post_status: ["draft", "published", "archived"],
      product_status: ["draft", "active", "archived"],
      product_use: [
        "edible",
        "animal_feed",
        "industrial",
        "agricultural",
        "cosmetic",
      ],
      quote_status: [
        "new",
        "in_review",
        "quoted",
        "accepted",
        "declined",
        "expired",
        "converted",
      ],
      review_status: ["pending", "approved", "rejected"],
      shipment_status: [
        "preparing",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ],
      stock_movement_type: [
        "receipt",
        "sale",
        "return",
        "adjustment",
        "transfer_in",
        "transfer_out",
        "write_off",
      ],
      stock_status: ["in_stock", "low_stock", "out_of_stock", "backorder"],
      uom: ["g", "kg", "ml", "l", "t", "pcs"],
    },
  },
} as const
