export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      compliance_exports: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          export_type: string
          exported_by: string | null
          file_path: string | null
          id: string
          property_ids: string[] | null
          row_count: number | null
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          export_type: string
          exported_by?: string | null
          file_path?: string | null
          id?: string
          property_ids?: string[] | null
          row_count?: number | null
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          export_type?: string
          exported_by?: string | null
          file_path?: string | null
          id?: string
          property_ids?: string[] | null
          row_count?: number | null
        }
        Relationships: []
      }
      guest_profiles: {
        Row: {
          account_id: string
          country_of_residence: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          id_number_encrypted: string | null
          id_type: string | null
          last_name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          id?: string
          id_number_encrypted?: string | null
          id_type?: string | null
          last_name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          id_number_encrypted?: string | null
          id_type?: string | null
          last_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          airbnb_account_id: string | null
          anonymized_at: string | null
          billing_address: string | null
          billing_company_id: string | null
          billing_name: string | null
          billing_vat_number: string | null
          booking_com_account_id: string | null
          country_of_residence: string | null
          created_at: string
          email: string | null
          first_name: string | null
          gdpr_consent: boolean
          gdpr_consent_at: string | null
          id: string
          id_number_encrypted: string | null
          id_type: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          airbnb_account_id?: string | null
          anonymized_at?: string | null
          billing_address?: string | null
          billing_company_id?: string | null
          billing_name?: string | null
          billing_vat_number?: string | null
          booking_com_account_id?: string | null
          country_of_residence?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          id: string
          id_number_encrypted?: string | null
          id_type?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          airbnb_account_id?: string | null
          anonymized_at?: string | null
          billing_address?: string | null
          billing_company_id?: string | null
          billing_name?: string | null
          billing_vat_number?: string | null
          booking_com_account_id?: string | null
          country_of_residence?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          id?: string
          id_number_encrypted?: string | null
          id_type?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_messages: {
        Row: {
          id: string
          reservation_id: string | null
          platform: string
          platform_reservation_id: string
          message: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id?: string | null
          platform: string
          platform_reservation_id: string
          message: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string | null
          platform?: string
          platform_reservation_id?: string
          message?: string
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          checkin_review_conditions: {
            cities?: string[]
            countries?: string[]
            non_eu?: boolean
          }
          checkin_review_mode: 'auto' | 'always_review' | 'conditions'
          city: string
          created_at: string
          house_rules_url: string | null
          id: string
          lock_provider: 'nuki' | 'lockin' | 'loki'
          lockin_device_id: string | null
          name: string
          nuki_device_id: string | null
          parking_enabled: boolean
          parking_gate_id: string | null
          wifi_password: string | null
          wifi_ssid: string | null
        }
        Insert: {
          address: string
          checkin_review_conditions?: {
            cities?: string[]
            countries?: string[]
            non_eu?: boolean
          }
          checkin_review_mode?: 'auto' | 'always_review' | 'conditions'
          city: string
          created_at?: string
          house_rules_url?: string | null
          id?: string
          lock_provider?: 'nuki' | 'lockin' | 'loki'
          lockin_device_id?: string | null
          name: string
          nuki_device_id?: string | null
          parking_enabled?: boolean
          parking_gate_id?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          address?: string
          checkin_review_conditions?: {
            cities?: string[]
            countries?: string[]
            non_eu?: boolean
          }
          checkin_review_mode?: 'auto' | 'always_review' | 'conditions'
          city?: string
          created_at?: string
          house_rules_url?: string | null
          id?: string
          lock_provider?: 'nuki' | 'lockin' | 'loki'
          lockin_device_id?: string | null
          name?: string
          nuki_device_id?: string | null
          parking_enabled?: boolean
          parking_gate_id?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Relationships: []
      }
      reservation_guests: {
        Row: {
          created_at: string
          guest_profile_id: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          guest_profile_id: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          guest_profile_id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_guests_household_member_id_fkey"
            columns: ["guest_profile_id"]
            isOneToOne: false
            referencedRelation: "guest_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          check_in: string
          check_out: string
          checkin_accepted_at: string | null
          checkin_accepted_by: string | null
          checkin_submitted_at: string | null
          children: number
          city_tax_amount: number | null
          created_at: string
          currency: string
          guest_id: string | null
          id: string
          invoice_id: string | null
          invoice_sent_at: string | null
          lock_access_code: string | null
          lock_access_sent_at: string | null
          parking_access_code: string | null
          platform: string
          platform_guest_phone: string | null
          platform_pin: string | null
          platform_reservation_id: string
          property_id: string | null
          raw_payload: Json | null
          status: 'confirmed' | 'cancelled' | 'modified' | 'checkin_submitted' | 'checked_in' | 'checked_out'
          total_price: number | null
          updated_at: string
        }
        Insert: {
          adults?: number
          check_in: string
          check_out: string
          checkin_accepted_at?: string | null
          checkin_accepted_by?: string | null
          checkin_submitted_at?: string | null
          children?: number
          city_tax_amount?: number | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_sent_at?: string | null
          lock_access_code?: string | null
          lock_access_sent_at?: string | null
          parking_access_code?: string | null
          platform: string
          platform_guest_phone?: string | null
          platform_pin?: string | null
          platform_reservation_id: string
          property_id?: string | null
          raw_payload?: Json | null
          status?: 'confirmed' | 'cancelled' | 'modified' | 'checkin_submitted' | 'checked_in' | 'checked_out'
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          adults?: number
          check_in?: string
          check_out?: string
          checkin_accepted_at?: string | null
          checkin_accepted_by?: string | null
          checkin_submitted_at?: string | null
          children?: number
          city_tax_amount?: number | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_sent_at?: string | null
          lock_access_code?: string | null
          lock_access_sent_at?: string | null
          parking_access_code?: string | null
          platform?: string
          platform_guest_phone?: string | null
          platform_pin?: string | null
          platform_reservation_id?: string
          property_id?: string | null
          raw_payload?: Json | null
          status?: 'confirmed' | 'cancelled' | 'modified' | 'checkin_submitted' | 'checked_in' | 'checked_out'
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_old_guests: { Args: never; Returns: undefined }
      cleanup_old_audit_log: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
