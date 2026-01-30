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
      cities: {
        Row: {
          created_at: string
          id: string
          legacy_id: number | null
          name: string
          state_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name: string
          state_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name?: string
          state_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_label: string
          field_name: string
          field_order: number
          field_type: Database["public"]["Enums"]["field_type"]
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          is_required: boolean
          is_visible: boolean
          options: Json | null
          placeholder: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_label: string
          field_name: string
          field_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          form_type: Database["public"]["Enums"]["form_type"]
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          placeholder?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_label?: string
          field_name?: string
          field_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          placeholder?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          id: string
          legacy_id: number | null
          name: string
          state_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name: string
          state_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      parishes: {
        Row: {
          created_at: string
          id: string
          legacy_id: number | null
          municipality_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          municipality_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          municipality_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "parishes_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_years: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          school_id: string
          updated_at: string
          year_range: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          school_id: string
          updated_at?: string
          year_range: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          school_id?: string
          updated_at?: string
          year_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string
          city_id: string | null
          created_at: string
          created_by: string | null
          dea_code: string
          email: string
          fax: string | null
          id: string
          institution_type: Database["public"]["Enums"]["institution_type"]
          logo_url: string | null
          municipality_id: string | null
          name: string
          parish_id: string | null
          phone: string
          rif: string
          state_id: string | null
          statistical_code: string
          updated_at: string
          url: string | null
        }
        Insert: {
          address: string
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dea_code: string
          email: string
          fax?: string | null
          id?: string
          institution_type?: Database["public"]["Enums"]["institution_type"]
          logo_url?: string | null
          municipality_id?: string | null
          name: string
          parish_id?: string | null
          phone: string
          rif: string
          state_id?: string | null
          statistical_code: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dea_code?: string
          email?: string
          fax?: string | null
          id?: string
          institution_type?: Database["public"]["Enums"]["institution_type"]
          logo_url?: string | null
          municipality_id?: string | null
          name?: string
          parish_id?: string | null
          phone?: string
          rif?: string
          state_id?: string | null
          statistical_code?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          created_at: string
          id: string
          legacy_id: number | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_id?: number | null
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "school" | "representative"
      field_type:
        | "text"
        | "email"
        | "phone"
        | "number"
        | "date"
        | "select"
        | "textarea"
        | "checkbox"
        | "file"
      form_type: "representative" | "student"
      institution_type: "public" | "private" | "subsidized" | "other"
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
      app_role: ["admin", "school", "representative"],
      field_type: [
        "text",
        "email",
        "phone",
        "number",
        "date",
        "select",
        "textarea",
        "checkbox",
        "file",
      ],
      form_type: ["representative", "student"],
      institution_type: ["public", "private", "subsidized", "other"],
    },
  },
} as const
