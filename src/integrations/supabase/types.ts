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
      backup_log: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          id: string
          period_end: string
          period_start: string
          rows_exported: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number
          id?: string
          period_end: string
          period_start: string
          rows_exported?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          period_end?: string
          period_start?: string
          rows_exported?: number
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
      pracas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          state?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          active: boolean
          category: string
          created_at: string
          display_order: number
          frequency: string
          id: string
          logo_url: string
          name: string
          praca_id: string | null
          stream_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          display_order?: number
          frequency?: string
          id: string
          logo_url?: string
          name: string
          praca_id?: string | null
          stream_url?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          display_order?: number
          frequency?: string
          id?: string
          logo_url?: string
          name?: string
          praca_id?: string | null
          stream_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "pracas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pracas: {
        Row: {
          created_at: string
          id: string
          praca_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          praca_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          praca_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pracas_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "pracas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pracas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      blend_dow_avg: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_listeners: number
          dow: number
          station_id: string
        }[]
      }
      blend_hourly_avg: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_listeners: number
          hour: number
          station_id: string
        }[]
      }
      station_dow_avg: {
        Args: { p_from: string; p_station_id: string; p_to: string }
        Returns: {
          avg_listeners: number
          dow: number
          samples: number
        }[]
      }
      station_hourly_avg: {
        Args: {
          p_dow_filter?: string
          p_from: string
          p_station_id: string
          p_to: string
        }
        Returns: {
          avg_listeners: number
          hour: number
          samples: number
        }[]
      }
      station_month_avg: {
        Args: { p_from: string; p_station_id: string; p_to: string }
        Returns: {
          avg_listeners: number
          month: string
          samples: number
        }[]
      }
      station_peak_min: {
        Args: {
          p_dow_filter?: string
          p_from: string
          p_station_id: string
          p_to: string
        }
        Returns: {
          min_at: string
          min_listeners: number
          peak_at: string
          peak_listeners: number
          samples: number
        }[]
      }
      station_today_realtime: {
        Args: { p_station_id: string }
        Returns: {
          hour: number
          listeners: number
          recorded_at: string
        }[]
      }
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
