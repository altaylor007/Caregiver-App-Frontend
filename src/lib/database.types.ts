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
      availability: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_requests: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          message: string | null
          start_date: string
          target_user_ids: string[] | null
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          message?: string | null
          start_date: string
          target_user_ids?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          message?: string | null
          start_date?: string
          target_user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_responses: {
        Row: {
          date: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          notes?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgments: {
        Row: {
          acknowledged_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          description: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          requires_acknowledgment: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          requires_acknowledgment?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          requires_acknowledgment?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_topics: {
        Row: {
          created_at: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          topic_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          topic_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "message_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          reference_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_reports: {
        Row: {
          end_date: string
          generated_at: string
          id: string
          report_data: Json
          start_date: string
          status: string
        }
        Insert: {
          end_date: string
          generated_at?: string
          id?: string
          report_data?: Json
          start_date: string
          status?: string
        }
        Update: {
          end_date?: string
          generated_at?: string
          id?: string
          report_data?: Json
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      responsibilities: {
        Row: {
          description: string
          id: string
          last_updated: string
          title: string
        }
        Insert: {
          description: string
          id?: string
          last_updated?: string
          title: string
        }
        Update: {
          description?: string
          id?: string
          last_updated?: string
          title?: string
        }
        Relationships: []
      }
      shift_templates: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      shift_trades: {
        Row: {
          created_at: string
          id: string
          proposed_to: string | null
          requested_by: string
          shift_id: string
          sms_code: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposed_to?: string | null
          requested_by: string
          shift_id: string
          sms_code?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          proposed_to?: string | null
          requested_by?: string
          shift_id?: string
          sms_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_trades_proposed_to_fkey"
            columns: ["proposed_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trades_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trades_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          assigned_to: string | null
          created_at: string
          custom_assigned_name: string | null
          date: string
          end_time: string
          id: string
          is_open: boolean
          start_time: string
          title: string
          trade_notes: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          custom_assigned_name?: string | null
          date: string
          end_time: string
          id?: string
          is_open?: boolean
          start_time: string
          title: string
          trade_notes?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          custom_assigned_name?: string | null
          date?: string
          end_time?: string
          id?: string
          is_open?: boolean
          start_time?: string
          title?: string
          trade_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          direction: string
          error_message: string | null
          id: string
          message_body: string
          phone_number: string
          provider_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          message_body: string
          phone_number: string
          provider_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          message_body?: string
          phone_number?: string
          provider_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      unavailability: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          acknowledged_responsibilities: boolean | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_read_messages_at: string | null
          payroll_enabled: boolean
          payroll_report_contact: boolean | null
          phone: string | null
          phone_number: string | null
          role: string
          sms_enabled: boolean | null
          status: string | null
        }
        Insert: {
          acknowledged_responsibilities?: boolean | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_read_messages_at?: string | null
          payroll_enabled?: boolean
          payroll_report_contact?: boolean | null
          phone?: string | null
          phone_number?: string | null
          role?: string
          sms_enabled?: boolean | null
          status?: string | null
        }
        Update: {
          acknowledged_responsibilities?: boolean | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_read_messages_at?: string | null
          payroll_enabled?: boolean
          payroll_report_contact?: boolean | null
          phone?: string | null
          phone_number?: string | null
          role?: string
          sms_enabled?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_shift_trade: { Args: { trade_id: string }; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
