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
    PostgrestVersion: "14.5"
  }
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
      app_setting: {
        Row: {
          key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_setting_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      app_user_profile: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          is_active: boolean
          must_change_password: boolean
          site_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          must_change_password?: boolean
          site_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          must_change_password?: boolean
          site_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "app_user_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      company: {
        Row: {
          company_id: string
          company_name: string
          country: string | null
          created_at: string
          industry: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          company_name: string
          country?: string | null
          created_at?: string
          industry?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string
          country?: string | null
          created_at?: string
          industry?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      data_entry_permission: {
        Row: {
          can_create: boolean
          create_scope: string
          delete_scope: string
          edit_scope: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          create_scope?: string
          delete_scope?: string
          edit_scope?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          create_scope?: string
          delete_scope?: string
          edit_scope?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      emission_factor: {
        Row: {
          active: boolean
          activity_name_en: string | null
          activity_name_th: string | null
          created_at: string
          effective_year: number | null
          factor_id: string
          factor_unit: string | null
          factor_value: number
          reference_detail: string | null
          scope: number
          source: string | null
          source_code: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          activity_name_en?: string | null
          activity_name_th?: string | null
          created_at?: string
          effective_year?: number | null
          factor_id?: string
          factor_unit?: string | null
          factor_value: number
          reference_detail?: string | null
          scope: number
          source?: string | null
          source_code: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          activity_name_en?: string | null
          activity_name_th?: string | null
          created_at?: string
          effective_year?: number | null
          factor_id?: string
          factor_unit?: string | null
          factor_value?: number
          reference_detail?: string | null
          scope?: number
          source?: string | null
          source_code?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emission_factor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      emission_factor_reference: {
        Row: {
          active: boolean
          activity_code: string
          activity_name_en: string | null
          activity_name_th: string | null
          created_at: string
          effective_year: number | null
          factor: number | null
          ref_id: string
          reference_detail: string | null
          scope: number | null
          source: string | null
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          activity_code: string
          activity_name_en?: string | null
          activity_name_th?: string | null
          created_at?: string
          effective_year?: number | null
          factor?: number | null
          ref_id?: string
          reference_detail?: string | null
          scope?: number | null
          source?: string | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          activity_code?: string
          activity_name_en?: string | null
          activity_name_th?: string | null
          created_at?: string
          effective_year?: number | null
          factor?: number | null
          ref_id?: string
          reference_detail?: string | null
          scope?: number | null
          source?: string | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      esg_dimension: {
        Row: {
          created_at: string
          dimension_id: string
          dimension_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          dimension_name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          dimension_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esg_dimension_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      esg_metric: {
        Row: {
          aggregation: string
          calc_mode: string
          code: string | null
          created_at: string
          metric_id: string
          metric_name: string
          tenant_id: string
          theme_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          aggregation?: string
          calc_mode?: string
          code?: string | null
          created_at?: string
          metric_id: string
          metric_name: string
          tenant_id?: string
          theme_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          aggregation?: string
          calc_mode?: string
          code?: string | null
          created_at?: string
          metric_id?: string
          metric_name?: string
          tenant_id?: string
          theme_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esg_metric_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
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
          tenant_id: string
          theme_id: string
          theme_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          tenant_id?: string
          theme_id: string
          theme_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "esg_theme_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      ghg_calc_mapping: {
        Row: {
          created_at: string
          mapping_id: string
          source_code: string
          target_code: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          mapping_id?: string
          source_code: string
          target_code: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          mapping_id?: string
          source_code?: string
          target_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghg_calc_mapping_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      login_event: {
        Row: {
          id: string
          logged_in_at: string
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          id?: string
          logged_in_at?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      maintenance_allowed_user: {
        Row: {
          added_at: string
          added_by: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      menu_permission: {
        Row: {
          is_active: boolean
          menu_key: string
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          menu_key: string
          role: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          menu_key?: string
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_permission_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      metric_target: {
        Row: {
          created_at: string
          created_by: string | null
          metric_id: string
          note: string | null
          target_direction: string
          target_id: string
          target_value: number
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          metric_id: string
          note?: string | null
          target_direction?: string
          target_id?: string
          target_value: number
          tenant_id?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          metric_id?: string
          note?: string | null
          target_direction?: string
          target_id?: string
          target_value?: number
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_target_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "esg_metric"
            referencedColumns: ["metric_id"]
          },
          {
            foreignKeyName: "metric_target_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      metric_value: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          data_source: string | null
          last_updated: string | null
          metric_id: string
          period_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          remark: string | null
          site_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          value: number
          value_id: string
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_source?: string | null
          last_updated?: string | null
          metric_id: string
          period_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          remark?: string | null
          site_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          value: number
          value_id: string
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_source?: string | null
          last_updated?: string | null
          metric_id?: string
          period_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          remark?: string | null
          site_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "metric_value_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          allow_audit_log: boolean
          allow_export: boolean
          allow_whitelabel: boolean
          description: string | null
          max_companies: number
          max_metrics: number
          max_sites: number
          max_users: number
          plan: string
          updated_at: string
        }
        Insert: {
          allow_audit_log?: boolean
          allow_export?: boolean
          allow_whitelabel?: boolean
          description?: string | null
          max_companies?: number
          max_metrics?: number
          max_sites?: number
          max_users?: number
          plan: string
          updated_at?: string
        }
        Update: {
          allow_audit_log?: boolean
          allow_export?: boolean
          allow_whitelabel?: boolean
          description?: string | null
          max_companies?: number
          max_metrics?: number
          max_sites?: number
          max_users?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      reporting_period: {
        Row: {
          created_at: string
          month: number
          month_name: string
          period_id: string
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          month: number
          month_name: string
          period_id: string
          tenant_id?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          month?: number
          month_name?: string
          period_id?: string
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "reporting_period_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      site: {
        Row: {
          company_id: string
          created_at: string
          location: string | null
          site_id: string
          site_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          location?: string | null
          site_id: string
          site_name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          location?: string | null
          site_id?: string
          site_name?: string
          tenant_id?: string
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
          {
            foreignKeyName: "site_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      super_admin: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supervisor_site: {
        Row: {
          created_at: string
          created_by: string | null
          site_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          site_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          site_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_site_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "supervisor_site_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      system_maintenance: {
        Row: {
          enabled_at: string | null
          enabled_by: string | null
          expected_end_at: string | null
          id: number
          is_enabled: boolean
          message_en: string | null
          message_th: string | null
          updated_at: string
        }
        Insert: {
          enabled_at?: string | null
          enabled_by?: string | null
          expected_end_at?: string | null
          id?: number
          is_enabled?: boolean
          message_en?: string | null
          message_th?: string | null
          updated_at?: string
        }
        Update: {
          enabled_at?: string | null
          enabled_by?: string | null
          expected_end_at?: string | null
          id?: number
          is_enabled?: boolean
          message_en?: string | null
          message_th?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant: {
        Row: {
          contact_email: string | null
          created_at: string
          is_active: boolean
          is_trial_expired: boolean
          logo_url: string | null
          name: string
          plan: string
          primary_color: string | null
          slug: string
          tenant_id: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          is_active?: boolean
          is_trial_expired?: boolean
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string | null
          slug: string
          tenant_id?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          is_active?: boolean
          is_trial_expired?: boolean
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string | null
          slug?: string
          tenant_id?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_feature: {
        Row: {
          enabled: boolean
          feature_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_menu_allowlist: {
        Row: {
          is_allowed: boolean
          menu_key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_allowed?: boolean
          menu_key: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_allowed?: boolean
          menu_key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_menu_allowlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _snap_user: {
        Args: { p_phase: string; p_uid: string; p_who: string }
        Returns: undefined
      }
      can_review_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
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
      current_tenant_id: { Args: never; Returns: string }
      default_tenant_id: { Args: never; Returns: string }
      get_dashboard_metric_stats: { Args: never; Returns: Json }
      get_executive_summary: {
        Args: { p_company_id?: string; p_site_id?: string; p_year?: number }
        Returns: Json
      }
      get_ghg_summary: { Args: never; Returns: Json }
      get_maintenance_status: { Args: never; Returns: Json }
      get_or_create_period: {
        Args: { p_month: number; p_year: number }
        Returns: string
      }
      get_platform_overview: { Args: never; Returns: Json }
      get_review_context: { Args: { p_value_ids: string[] }; Returns: Json }
      get_tenant_activity_list: {
        Args: never
        Returns: {
          companies: number
          created_at: string
          is_active: boolean
          last_activity: string
          name: string
          plan: string
          primary_color: string
          records: number
          sites: number
          slug: string
          tenant_id: string
          trial_ends_at: string
          users: number
        }[]
      }
      get_tenant_plan_limits: {
        Args: never
        Returns: {
          allow_audit_log: boolean
          allow_export: boolean
          allow_whitelabel: boolean
          is_trial_expired: boolean
          max_companies: number
          max_metrics: number
          max_sites: number
          max_users: number
          plan: string
          trial_ends_at: string
        }[]
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
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      list_maintenance_admin_candidates: {
        Args: never
        Returns: {
          email: string
          full_name: string
          is_allowed: boolean
          role: string
          tenant_id: string
          tenant_name: string
          user_id: string
        }[]
      }
      maintenance_access_allowed: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      my_reviewable_sites: { Args: never; Returns: string[] }
      recompute_ghg_target: {
        Args: {
          p_period: string
          p_site: string
          p_target_code: string
          p_tenant: string
        }
        Returns: undefined
      }
      review_metric_values: {
        Args: { p_action: string; p_reason?: string; p_value_ids: string[] }
        Returns: Json
      }
      set_maintenance_allowed_users: {
        Args: { p_user_ids: string[] }
        Returns: number
      }
      set_maintenance_mode: {
        Args: {
          p_enabled: boolean
          p_expected_end_at?: string
          p_message_en?: string
          p_message_th?: string
        }
        Returns: Json
      }
      sync_trial_expired: { Args: never; Returns: undefined }
      tenant_feature_enabled: {
        Args: { p_key: string; p_tenant: string }
        Returns: boolean
      }
      tenant_menu_allowed: {
        Args: { _menu_key: string; _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "executive"
        | "supervisor"
        | "staff"
        | "guest"
        | "super_admin"
        | "supervisor_global"
        | "supervisor_local"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "executive",
        "supervisor",
        "staff",
        "guest",
        "super_admin",
        "supervisor_global",
        "supervisor_local",
      ],
    },
  },
} as const
