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
      active_sessions: {
        Row: {
          created_at: string
          id: string
          role: string
          token: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          token: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          token?: string
          username?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          blocked: boolean
          created_at: string
          display_name: string | null
          id: string
          password: string
          role: string
          username: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          password: string
          role?: string
          username: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          password?: string
          role?: string
          username?: string
        }
        Relationships: []
      }
      audience_snapshots: {
        Row: {
          bitrate: number | null
          created_at: string
          hour: number
          id: string
          listeners: number
          peak_listeners: number
          recorded_at: string
          station_id: string
          title: string | null
        }
        Insert: {
          bitrate?: number | null
          created_at?: string
          hour: number
          id?: string
          listeners?: number
          peak_listeners?: number
          recorded_at?: string
          station_id: string
          title?: string | null
        }
        Update: {
          bitrate?: number | null
          created_at?: string
          hour?: number
          id?: string
          listeners?: number
          peak_listeners?: number
          recorded_at?: string
          station_id?: string
          title?: string | null
        }
        Relationships: []
      }
      current_status: {
        Row: {
          bitrate: number | null
          last_checked: string
          listeners: number
          online: boolean
          peak_listeners: number
          station_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          bitrate?: number | null
          last_checked?: string
          listeners?: number
          online?: boolean
          peak_listeners?: number
          station_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          bitrate?: number | null
          last_checked?: string
          listeners?: number
          online?: boolean
          peak_listeners?: number
          station_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_averages: {
        Row: {
          avg_listeners: number
          created_at: string
          date: string
          id: string
          peak_hour: number | null
          peak_listeners: number
          station_id: string
          total_snapshots: number
        }
        Insert: {
          avg_listeners?: number
          created_at?: string
          date: string
          id?: string
          peak_hour?: number | null
          peak_listeners?: number
          station_id: string
          total_snapshots?: number
        }
        Update: {
          avg_listeners?: number
          created_at?: string
          date?: string
          id?: string
          peak_hour?: number | null
          peak_listeners?: number
          station_id?: string
          total_snapshots?: number
        }
        Relationships: []
      }
      monthly_averages: {
        Row: {
          avg_listeners: number
          created_at: string
          id: string
          month: string
          peak_hour: number | null
          peak_listeners: number
          station_id: string
          total_days: number
        }
        Insert: {
          avg_listeners?: number
          created_at?: string
          id?: string
          month: string
          peak_hour?: number | null
          peak_listeners?: number
          station_id: string
          total_days?: number
        }
        Update: {
          avg_listeners?: number
          created_at?: string
          id?: string
          month?: string
          peak_hour?: number | null
          peak_listeners?: number
          station_id?: string
          total_days?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
