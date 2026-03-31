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
      attendance_records: {
        Row: {
          attendance_date: string
          attendance_time: string
          attendance_timestamp: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          notification_email: string | null
          notification_sent: boolean
          record_type: string
          school_id: string
          status: string
          token_id: string | null
        }
        Insert: {
          attendance_date?: string
          attendance_time?: string
          attendance_timestamp?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          notification_email?: string | null
          notification_sent?: boolean
          record_type?: string
          school_id: string
          status?: string
          token_id?: string | null
        }
        Update: {
          attendance_date?: string
          attendance_time?: string
          attendance_timestamp?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notification_email?: string | null
          notification_sent?: boolean
          record_type?: string
          school_id?: string
          status?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "attendance_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_tokens: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_active: boolean
          school_id: string
          token: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_active?: boolean
          school_id: string
          token?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          school_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_tokens_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      carnet_config: {
        Row: {
          created_at: string
          id: string
          layout_config: Json
          primary_color: string
          school_id: string
          secondary_color: string
          updated_at: string
          watermark_opacity: number
          watermark_size: number
          watermark_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          layout_config?: Json
          primary_color?: string
          school_id: string
          secondary_color?: string
          updated_at?: string
          watermark_opacity?: number
          watermark_size?: number
          watermark_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          layout_config?: Json
          primary_color?: string
          school_id?: string
          secondary_color?: string
          updated_at?: string
          watermark_opacity?: number
          watermark_size?: number
          watermark_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carnet_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
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
      delinquency_config: {
        Row: {
          created_at: string
          id: string
          overdue_after_day: number
          reminder_days_of_month: Json | null
          reminder_days_of_week: Json | null
          reminder_mode: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          overdue_after_day?: number
          reminder_days_of_month?: Json | null
          reminder_days_of_week?: Json | null
          reminder_mode?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          overdue_after_day?: number
          reminder_days_of_month?: Json | null
          reminder_days_of_week?: Json | null
          reminder_mode?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delinquency_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      delinquency_notifications: {
        Row: {
          concepts_detail: Json
          created_at: string
          email_sent_to: string
          error_message: string | null
          family_id: string
          id: string
          school_id: string
          sent_at: string
          status: string
          student_id: string
          total_owed_ves: number
        }
        Insert: {
          concepts_detail?: Json
          created_at?: string
          email_sent_to: string
          error_message?: string | null
          family_id: string
          id?: string
          school_id: string
          sent_at?: string
          status?: string
          student_id: string
          total_owed_ves?: number
        }
        Update: {
          concepts_detail?: Json
          created_at?: string
          email_sent_to?: string
          error_message?: string | null
          family_id?: string
          id?: string
          school_id?: string
          sent_at?: string
          status?: string
          student_id?: string
          total_owed_ves?: number
        }
        Relationships: [
          {
            foreignKeyName: "delinquency_notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          content_html: string
          created_at: string
          id: string
          name: string
          school_id: string
          signature_lines: Json
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          name: string
          school_id: string
          signature_lines?: Json
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          signature_lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          body_html: string
          created_at: string
          error_message: string | null
          id: string
          recipient_count: number
          recipients: Json
          school_id: string
          sent_by: string
          status: string
          subject: string
        }
        Insert: {
          body_html: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_count?: number
          recipients?: Json
          school_id: string
          sent_by: string
          status?: string
          subject: string
        }
        Update: {
          body_html?: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_count?: number
          recipients?: Json
          school_id?: string
          sent_by?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_display_config: {
        Row: {
          created_at: string
          display_order: number
          field_label: string
          field_name: string
          id: string
          is_visible: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_label: string
          field_name: string
          id?: string
          is_visible?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_label?: string
          field_name?: string
          id?: string
          is_visible?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_display_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_planilla_sections: {
        Row: {
          created_at: string
          display_order: number
          field_names: Json
          id: string
          school_id: string
          section_text: string | null
          section_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_names?: Json
          id?: string
          school_id: string
          section_text?: string | null
          section_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_names?: Json
          id?: string
          school_id?: string
          section_text?: string | null
          section_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_planilla_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          enrolled_at: string
          enrollment_date: string | null
          enrollment_type: string | null
          id: string
          observations: string | null
          school_id: string
          school_year_id: string
          section_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrolled_at?: string
          enrollment_date?: string | null
          enrollment_type?: string | null
          id?: string
          observations?: string | null
          school_id: string
          school_year_id: string
          section_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrolled_at?: string
          enrollment_date?: string | null
          enrollment_type?: string | null
          id?: string
          observations?: string | null
          school_id?: string
          school_year_id?: string
          section_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_plan_items: {
        Row: {
          assignment_id: string
          created_at: string
          description: string
          display_order: number
          id: string
          momento: number
          percentage: number | null
          school_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          description: string
          display_order?: number
          id?: string
          momento?: number
          percentage?: number | null
          school_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          momento?: number
          percentage?: number | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_plan_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_plan_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          currency: string
          id: string
          rate_to_ves: number
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          currency: string
          id?: string
          rate_to_ves?: number
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          currency?: string
          id?: string
          rate_to_ves?: number
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          additional_phone: string | null
          address: string | null
          city_id: string | null
          contact_phone: string | null
          created_at: string
          dependents_count: number | null
          emergency_contact: string | null
          father_last_name: string | null
          housing_details: string | null
          housing_sector: string | null
          housing_type: string | null
          id: string
          income_contributor: string | null
          is_suspended: boolean
          monthly_housing_payment: string | null
          monthly_income: number | null
          mother_last_name: string | null
          municipality_id: string | null
          parents_marital_status: string | null
          parish_id: string | null
          property_ownership: string | null
          religion: string | null
          rooms_count: number | null
          state_id: string | null
          transport_companion: string | null
          transport_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_phone?: string | null
          address?: string | null
          city_id?: string | null
          contact_phone?: string | null
          created_at?: string
          dependents_count?: number | null
          emergency_contact?: string | null
          father_last_name?: string | null
          housing_details?: string | null
          housing_sector?: string | null
          housing_type?: string | null
          id?: string
          income_contributor?: string | null
          is_suspended?: boolean
          monthly_housing_payment?: string | null
          monthly_income?: number | null
          mother_last_name?: string | null
          municipality_id?: string | null
          parents_marital_status?: string | null
          parish_id?: string | null
          property_ownership?: string | null
          religion?: string | null
          rooms_count?: number | null
          state_id?: string | null
          transport_companion?: string | null
          transport_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_phone?: string | null
          address?: string | null
          city_id?: string | null
          contact_phone?: string | null
          created_at?: string
          dependents_count?: number | null
          emergency_contact?: string | null
          father_last_name?: string | null
          housing_details?: string | null
          housing_sector?: string | null
          housing_type?: string | null
          id?: string
          income_contributor?: string | null
          is_suspended?: boolean
          monthly_housing_payment?: string | null
          monthly_income?: number | null
          mother_last_name?: string | null
          municipality_id?: string | null
          parents_marital_status?: string | null
          parish_id?: string | null
          property_ownership?: string | null
          religion?: string | null
          rooms_count?: number | null
          state_id?: string | null
          transport_companion?: string | null
          transport_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      family_schools: {
        Row: {
          created_at: string
          family_id: string
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          school_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_schools_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      final_grades: {
        Row: {
          absence_count: number
          adjustment_points: number
          assignment_id: string
          attendance_count: number
          created_at: string
          final_status: string | null
          grade_value: string | null
          id: string
          momento: number
          observation: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          absence_count?: number
          adjustment_points?: number
          assignment_id: string
          attendance_count?: number
          created_at?: string
          final_status?: string | null
          grade_value?: string | null
          id?: string
          momento?: number
          observation?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          absence_count?: number
          adjustment_points?: number
          assignment_id?: string
          attendance_count?: number
          created_at?: string
          final_status?: string | null
          grade_value?: string | null
          id?: string
          momento?: number
          observation?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_groups: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          form_type: Database["public"]["Enums"]["form_type"]
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_field_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
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
            foreignKeyName: "form_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "form_field_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      gcrp_assignment_students: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          school_id: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gcrp_assignment_students_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gcrp_assignment_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gcrp_assignment_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades_config: {
        Row: {
          created_at: string
          id: string
          preschool_report_type: string
          preschool_template: string
          primary_report_type: string
          primary_template: string
          school_id: string
          secondary_template: string
          updated_at: string
          use_percentage_plan: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          preschool_report_type?: string
          preschool_template?: string
          primary_report_type?: string
          primary_template?: string
          school_id: string
          secondary_template?: string
          updated_at?: string
          use_percentage_plan?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          preschool_report_type?: string
          preschool_template?: string
          primary_report_type?: string
          primary_template?: string
          school_id?: string
          secondary_template?: string
          updated_at?: string
          use_percentage_plan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "grades_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
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
      payment_concepts: {
        Row: {
          concept_type: string
          created_at: string
          default_amount: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          concept_type?: string
          created_at?: string
          default_amount?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          concept_type?: string
          created_at?: string
          default_amount?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_concepts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_items: {
        Row: {
          amount_ves: number
          created_at: string
          id: string
          is_partial: boolean
          payment_id: string
          plan_concept_id: string
        }
        Insert: {
          amount_ves?: number
          created_at?: string
          id?: string
          is_partial?: boolean
          payment_id: string
          plan_concept_id: string
        }
        Update: {
          amount_ves?: number
          created_at?: string
          id?: string
          is_partial?: boolean
          payment_id?: string
          plan_concept_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_items_plan_concept_id_fkey"
            columns: ["plan_concept_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_entries: {
        Row: {
          amount_original: number
          amount_ves: number
          bank_name: string | null
          created_at: string
          currency: string
          details: string | null
          exchange_rate: number
          id: string
          method: string
          payment_date: string
          payment_id: string
          reference_code: string | null
        }
        Insert: {
          amount_original?: number
          amount_ves?: number
          bank_name?: string | null
          created_at?: string
          currency?: string
          details?: string | null
          exchange_rate?: number
          id?: string
          method?: string
          payment_date?: string
          payment_id: string
          reference_code?: string | null
        }
        Update: {
          amount_original?: number
          amount_ves?: number
          bank_name?: string | null
          created_at?: string
          currency?: string
          details?: string | null
          exchange_rate?: number
          id?: string
          method?: string
          payment_date?: string
          payment_id?: string
          reference_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_concepts: {
        Row: {
          amount: number
          concept_id: string
          created_at: string
          display_order: number
          due_day: number | null
          id: string
          is_mandatory: boolean
          is_recurring: boolean
          plan_id: string
        }
        Insert: {
          amount?: number
          concept_id: string
          created_at?: string
          display_order?: number
          due_day?: number | null
          id?: string
          is_mandatory?: boolean
          is_recurring?: boolean
          plan_id: string
        }
        Update: {
          amount?: number
          concept_id?: string
          created_at?: string
          display_order?: number
          due_day?: number | null
          id?: string
          is_mandatory?: boolean
          is_recurring?: boolean
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "payment_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_concepts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_address: string | null
          invoice_name: string | null
          invoice_phone: string | null
          invoice_rif: string | null
          observations: string | null
          payment_date: string
          school_id: string
          school_year_id: string
          status: string
          student_id: string
          total_amount_ves: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_address?: string | null
          invoice_name?: string | null
          invoice_phone?: string | null
          invoice_rif?: string | null
          observations?: string | null
          payment_date?: string
          school_id: string
          school_year_id: string
          status?: string
          student_id: string
          total_amount_ves?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_address?: string | null
          invoice_name?: string | null
          invoice_phone?: string | null
          invoice_rif?: string | null
          observations?: string | null
          payment_date?: string
          school_id?: string
          school_year_id?: string
          status?: string
          student_id?: string
          total_amount_ves?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      planilla_general_config: {
        Row: {
          created_at: string
          footer_config: Json
          header_config: Json
          id: string
          school_id: string
          signature_lines: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          footer_config?: Json
          header_config?: Json
          id?: string
          school_id: string
          signature_lines?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          footer_config?: Json
          header_config?: Json
          id?: string
          school_id?: string
          signature_lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planilla_general_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_component_indicators: {
        Row: {
          component_id: string
          created_at: string
          description: string
          display_order: number
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_component_indicators_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "preschool_indicator_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_component_indicators_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_final_indicator_grades: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          indicator_id: string
          momento: number
          scale_id: string | null
          school_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          indicator_id: string
          momento: number
          scale_id?: string | null
          school_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          indicator_id?: string
          momento?: number
          scale_id?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preschool_final_indicator_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_indicator_grades_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "preschool_component_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_indicator_grades_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "preschool_grading_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_indicator_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_indicator_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_final_reports: {
        Row: {
          absence_count: number | null
          assignment_id: string
          attendance_count: number | null
          created_at: string | null
          descriptive_report: string | null
          final_status: string | null
          id: string
          literal: string | null
          momento: number
          project_name: string | null
          school_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          absence_count?: number | null
          assignment_id: string
          attendance_count?: number | null
          created_at?: string | null
          descriptive_report?: string | null
          final_status?: string | null
          id?: string
          literal?: string | null
          momento?: number
          project_name?: string | null
          school_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          absence_count?: number | null
          assignment_id?: string
          attendance_count?: number | null
          created_at?: string | null
          descriptive_report?: string | null
          final_status?: string | null
          id?: string
          literal?: string | null
          momento?: number
          project_name?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preschool_final_reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_final_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_grading_scales: {
        Row: {
          abbreviation: string
          created_at: string
          description: string
          display_order: number
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_indicator_components: {
        Row: {
          created_at: string
          display_order: number
          id: string
          level: string
          momento: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          level: string
          momento: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          level?: string
          momento?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_indicator_components_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_final_indicator_grades: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          indicator_id: string
          momento: number
          scale_id: string | null
          school_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          indicator_id: string
          momento: number
          scale_id?: string | null
          school_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          indicator_id?: string
          momento?: number
          scale_id?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "primary_final_indicator_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_indicator_grades_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "primary_grade_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_indicator_grades_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "primary_grading_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_indicator_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_indicator_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_final_reports: {
        Row: {
          absence_count: number | null
          assignment_id: string
          attendance_count: number | null
          created_at: string | null
          descriptive_report: string | null
          final_status: string | null
          id: string
          literal: string | null
          momento: number
          project_name: string | null
          school_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          absence_count?: number | null
          assignment_id: string
          attendance_count?: number | null
          created_at?: string | null
          descriptive_report?: string | null
          final_status?: string | null
          id?: string
          literal?: string | null
          momento?: number
          project_name?: string | null
          school_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          absence_count?: number | null
          assignment_id?: string
          attendance_count?: number | null
          created_at?: string | null
          descriptive_report?: string | null
          final_status?: string | null
          id?: string
          literal?: string | null
          momento?: number
          project_name?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "primary_final_reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_final_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_grade_indicators: {
        Row: {
          area_id: string | null
          area_name: string
          created_at: string
          description: string
          display_order: number
          grade_level: string
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          area_name: string
          created_at?: string
          description?: string
          display_order?: number
          grade_level: string
          id?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          area_name?: string
          created_at?: string
          description?: string
          display_order?: number
          grade_level?: string
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_grade_indicators_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "primary_indicator_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_grade_indicators_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_grading_scales: {
        Row: {
          abbreviation: string
          created_at: string
          description: string
          display_order: number
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_indicator_areas: {
        Row: {
          created_at: string
          display_order: number
          grade_level: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          grade_level: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          grade_level?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_indicator_areas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      representatives: {
        Row: {
          created_at: string
          document_id: string | null
          email: string | null
          family_id: string
          form_data: Json | null
          id: string
          is_primary: boolean
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          family_id: string
          form_data?: Json | null
          id?: string
          is_primary?: boolean
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          family_id?: string
          form_data?: Json | null
          id?: string
          is_primary?: boolean
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representatives_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      school_payment_methods: {
        Row: {
          config: Json
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          method_type: string
          school_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          method_type: string
          school_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          method_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_payment_methods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subjects: {
        Row: {
          abbreviation: string
          created_at: string
          display_order: number
          evaluation_type: string
          id: string
          is_suspended: boolean
          name: string
          school_id: string
          show_in_planilla: boolean
          show_in_report_card: boolean
          subject_type: string
          updated_at: string
        }
        Insert: {
          abbreviation?: string
          created_at?: string
          display_order?: number
          evaluation_type?: string
          id?: string
          is_suspended?: boolean
          name: string
          school_id: string
          show_in_planilla?: boolean
          show_in_report_card?: boolean
          subject_type?: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          display_order?: number
          evaluation_type?: string
          id?: string
          is_suspended?: boolean
          name?: string
          school_id?: string
          show_in_planilla?: boolean
          show_in_report_card?: boolean
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      sections: {
        Row: {
          created_at: string
          grade_level: Database["public"]["Enums"]["grade_level"]
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_level: Database["public"]["Enums"]["grade_level"]
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_level?: Database["public"]["Enums"]["grade_level"]
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      student_concept_balances: {
        Row: {
          balance: number
          id: string
          last_payment_date: string | null
          paid_amount: number
          plan_concept_id: string
          school_id: string
          school_year_id: string
          status: string
          student_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          last_payment_date?: string | null
          paid_amount?: number
          plan_concept_id: string
          school_id: string
          school_year_id: string
          status?: string
          student_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          last_payment_date?: string | null
          paid_amount?: number
          plan_concept_id?: string
          school_id?: string
          school_year_id?: string
          status?: string
          student_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_concept_balances_plan_concept_id_fkey"
            columns: ["plan_concept_id"]
            isOneToOne: false
            referencedRelation: "payment_plan_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_concept_balances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_concept_balances_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_concept_balances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_grades: {
        Row: {
          assignment_id: string
          created_at: string
          evaluation_plan_item_id: string
          grade_value: string | null
          id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          evaluation_plan_item_id: string
          grade_value?: string | null
          id?: string
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          evaluation_plan_item_id?: string
          grade_value?: string | null
          id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "subject_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_evaluation_plan_item_id_fkey"
            columns: ["evaluation_plan_item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payment_plans: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          plan_id: string
          school_id: string
          school_year_id: string
          student_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          plan_id: string
          school_id: string
          school_year_id: string
          student_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          plan_id?: string
          school_id?: string
          school_year_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_plans_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_schools: {
        Row: {
          created_at: string
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_schools_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          document_id: string | null
          family_id: string
          form_data: Json | null
          id: string
          photo_url: string | null
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          family_id: string
          form_data?: Json | null
          id?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          family_id?: string
          form_data?: Json | null
          id?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_teacher_assignments: {
        Row: {
          created_at: string
          id: string
          is_suspended: boolean
          school_id: string
          school_year_id: string
          section_id: string | null
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_suspended?: boolean
          school_id: string
          school_year_id: string
          section_id?: string | null
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_suspended?: boolean
          school_id?: string
          school_year_id?: string
          section_id?: string | null
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_teacher_assignments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_teacher_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          document_id: string | null
          email: string | null
          form_data: Json | null
          id: string
          is_suspended: boolean
          phone: string | null
          photo_url: string | null
          school_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          form_data?: Json | null
          id?: string
          is_suspended?: boolean
          phone?: string | null
          photo_url?: string | null
          school_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          form_data?: Json | null
          id?: string
          is_suspended?: boolean
          phone?: string | null
          photo_url?: string | null
          school_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      populate_default_primary_indicators: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      user_has_school_access_to_family: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_school_access_to_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      user_shares_school: {
        Args: { requesting_user_id: string; target_school_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "school" | "representative" | "teacher"
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
      form_type: "representative" | "student" | "teacher"
      grade_level:
        | "pre_maternal"
        | "maternal"
        | "inicial"
        | "primaria"
        | "media_general"
        | "media_tecnica"
        | "i_nivel"
        | "ii_nivel"
        | "iii_nivel"
        | "1_grado"
        | "2_grado"
        | "3_grado"
        | "4_grado"
        | "5_grado"
        | "6_grado"
        | "1_ano"
        | "2_ano"
        | "3_ano"
        | "4_ano"
        | "5_ano"
        | "6_ano"
      institution_type: "public" | "private" | "subsidized" | "other"
      student_status: "active" | "suspended" | "graduated" | "completed"
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
      app_role: ["admin", "school", "representative", "teacher"],
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
      form_type: ["representative", "student", "teacher"],
      grade_level: [
        "pre_maternal",
        "maternal",
        "inicial",
        "primaria",
        "media_general",
        "media_tecnica",
        "i_nivel",
        "ii_nivel",
        "iii_nivel",
        "1_grado",
        "2_grado",
        "3_grado",
        "4_grado",
        "5_grado",
        "6_grado",
        "1_ano",
        "2_ano",
        "3_ano",
        "4_ano",
        "5_ano",
        "6_ano",
      ],
      institution_type: ["public", "private", "subsidized", "other"],
      student_status: ["active", "suspended", "graduated", "completed"],
    },
  },
} as const
