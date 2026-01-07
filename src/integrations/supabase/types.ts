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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_user_profile: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          is_active: boolean
          site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_profile_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "app_user_profile_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          log_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          log_id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          log_id?: string
        }
        Relationships: []
      }
      company: {
        Row: {
          company_id: string
          company_name: string
          country: string | null
          created_at: string
          industry: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          company_name: string
          country?: string | null
          created_at?: string
          industry?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string
          country?: string | null
          created_at?: string
          industry?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      esg_dimension: {
        Row: {
          created_at: string
          dimension_id: string
          dimension_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          dimension_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          dimension_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      esg_metric: {
        Row: {
          created_at: string
          metric_id: string
          metric_name: string
          theme_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          metric_id: string
          metric_name: string
          theme_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          metric_id?: string
          metric_name?: string
          theme_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esg_metric_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "esg_theme"
            referencedColumns: ["theme_id"]
          },
        ]
      }
      esg_theme: {
        Row: {
          created_at: string
          dimension_id: string
          theme_id: string
          theme_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          theme_id: string
          theme_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          theme_id?: string
          theme_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esg_theme_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "esg_dimension"
            referencedColumns: ["dimension_id"]
          },
        ]
      }
      metric_value: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          data_source: string | null
          last_updated: string | null
          metric_id: string
          period_id: string
          remark: string | null
          site_id: string
          status: string
          submitted_by: string | null
          updated_at: string
          value: number
          value_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_source?: string | null
          last_updated?: string | null
          metric_id: string
          period_id: string
          remark?: string | null
          site_id: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          value: number
          value_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_source?: string | null
          last_updated?: string | null
          metric_id?: string
          period_id?: string
          remark?: string | null
          site_id?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          value?: number
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_value_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "esg_metric"
            referencedColumns: ["metric_id"]
          },
          {
            foreignKeyName: "metric_value_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "reporting_period"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "metric_value_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
        ]
      }
      reporting_period: {
        Row: {
          created_at: string
          month: number
          month_name: string
          period_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          month: number
          month_name: string
          period_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          month?: number
          month_name?: string
          period_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      site: {
        Row: {
          company_id: string
          created_at: string
          location: string | null
          site_id: string
          site_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          location?: string | null
          site_id: string
          site_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          location?: string | null
          site_id?: string
          site_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_audit_log: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: string
      }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      get_user_site: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "executive" | "supervisor" | "staff" | "guest"
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
      app_role: ["admin", "executive", "supervisor", "staff", "guest"],
    },
  },
} as const
