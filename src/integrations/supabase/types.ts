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
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          id: string
          note: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          note?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          note?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          currency_symbol: string
          email: string | null
          id: number
          logo_url: string | null
          name: string
          phone: string | null
          tagline: string | null
          templates: Json
          updated_at: string
          whatsapp_country_code: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          email?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          phone?: string | null
          tagline?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_country_code?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          email?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          phone?: string | null
          tagline?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_country_code?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          qty?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          issued_at: string
          member_id: string | null
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          id?: string
          issued_at?: string
          member_id?: string | null
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          issued_at?: string
          member_id?: string | null
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_activity_log: {
        Row: {
          action: string
          id: string
          imported_at: string
          member_id: string | null
          member_name: string
          occurred_at: string
          plan_type: string | null
        }
        Insert: {
          action: string
          id?: string
          imported_at?: string
          member_id?: string | null
          member_name: string
          occurred_at?: string
          plan_type?: string | null
        }
        Update: {
          action?: string
          id?: string
          imported_at?: string
          member_id?: string | null
          member_name?: string
          occurred_at?: string
          plan_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_activity_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_activity_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          amount_paid: number
          balance_due: number
          created_at: string
          dob: string | null
          email: string | null
          emergency_contact: string | null
          expiry_date: string
          frozen_at: string | null
          full_name: string
          id: string
          legacy_id: string | null
          notes: string | null
          phone: string
          phone_normalized: string
          photo_url: string | null
          plan_id: string | null
          plan_type: string | null
          start_date: string
          total_fee: number
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          amount_paid?: number
          balance_due?: number
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          expiry_date?: string
          frozen_at?: string | null
          full_name: string
          id?: string
          legacy_id?: string | null
          notes?: string | null
          phone: string
          phone_normalized: string
          photo_url?: string | null
          plan_id?: string | null
          plan_type?: string | null
          start_date?: string
          total_fee?: number
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          amount_paid?: number
          balance_due?: number
          created_at?: string
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          expiry_date?: string
          frozen_at?: string | null
          full_name?: string
          id?: string
          legacy_id?: string | null
          notes?: string | null
          phone?: string
          phone_normalized?: string
          photo_url?: string | null
          plan_id?: string | null
          plan_type?: string | null
          start_date?: string
          total_fee?: number
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_log: {
        Row: {
          body: string
          channel: string
          id: string
          member_id: string | null
          sent_at: string
          sent_by: string | null
          template_key: string | null
        }
        Insert: {
          body: string
          channel?: string
          id?: string
          member_id?: string | null
          sent_at?: string
          sent_by?: string | null
          template_key?: string | null
        }
        Update: {
          body?: string
          channel?: string
          id?: string
          member_id?: string | null
          sent_at?: string
          sent_by?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          member_id: string | null
          mode: Database["public"]["Enums"]["payment_mode"]
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          member_id?: string | null
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          member_id?: string | null
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          duration_months: number
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_months?: number
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_months?: number
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_notes: {
        Row: {
          created_at: string
          goals: string | null
          id: string
          measurements: Json | null
          member_id: string
          recorded_at: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          goals?: string | null
          id?: string
          measurements?: Json | null
          member_id: string
          recorded_at?: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          goals?: string | null
          id?: string
          measurements?: Json | null
          member_id?: string
          recorded_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_enrollments: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          member_id: string
          package_id: string | null
          sessions_total: number
          sessions_used: number
          starts_on: string
          trainer_id: string | null
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          member_id: string
          package_id?: string | null
          sessions_total?: number
          sessions_used?: number
          starts_on?: string
          trainer_id?: string | null
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          member_id?: string
          package_id?: string | null
          sessions_total?: number
          sessions_used?: number
          starts_on?: string
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pt_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_enrollments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "pt_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_enrollments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price: number
          sessions: number
          validity_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          sessions?: number
          validity_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          sessions?: number
          validity_days?: number
        }
        Relationships: []
      }
      pt_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          notes: string | null
          scheduled_at: string
          trainer_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          notes?: string | null
          scheduled_at: string
          trainer_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          notes?: string | null
          scheduled_at?: string
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pt_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pt_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          role_label: string
          shift_end: string | null
          shift_start: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          role_label?: string
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          role_label?: string
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      members_with_status: {
        Row: {
          address: string | null
          amount_paid: number | null
          balance_due: number | null
          created_at: string | null
          days_until_expiry: number | null
          dob: string | null
          email: string | null
          emergency_contact: string | null
          expiry_date: string | null
          frozen_at: string | null
          full_name: string | null
          id: string | null
          legacy_id: string | null
          notes: string | null
          phone: string | null
          phone_normalized: string | null
          photo_url: string | null
          plan_id: string | null
          plan_type: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["member_status"] | null
          total_fee: number | null
          trainer_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          days_until_expiry?: never
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          expiry_date?: string | null
          frozen_at?: string | null
          full_name?: string | null
          id?: string | null
          legacy_id?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          plan_id?: string | null
          plan_type?: string | null
          start_date?: string | null
          status?: never
          total_fee?: number | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          days_until_expiry?: never
          dob?: string | null
          email?: string | null
          emergency_contact?: string | null
          expiry_date?: string | null
          frozen_at?: string | null
          full_name?: string | null
          id?: string | null
          legacy_id?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          plan_id?: string | null
          plan_type?: string | null
          start_date?: string | null
          status?: never
          total_fee?: number | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_has_any_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "front_desk"
      invoice_status: "paid" | "partial" | "unpaid"
      member_status: "active" | "expiring_soon" | "expired" | "frozen"
      payment_mode: "cash" | "card" | "upi" | "bank_transfer" | "unknown"
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
      app_role: ["admin", "staff", "front_desk"],
      invoice_status: ["paid", "partial", "unpaid"],
      member_status: ["active", "expiring_soon", "expired", "frozen"],
      payment_mode: ["cash", "card", "upi", "bank_transfer", "unknown"],
    },
  },
} as const
