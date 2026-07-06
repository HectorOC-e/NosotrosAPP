export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          api_key_secret_id: string | null
          couple_id: string
          id: string
          model: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key_secret_id?: string | null
          couple_id: string
          id?: string
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key_secret_id?: string | null
          couple_id?: string
          id?: string
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: true
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          label: string
          limit_amount: number
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          label?: string
          limit_amount?: number
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          label?: string
          limit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string | null
        }
        Relationships: []
      }
      date_ideas: {
        Row: {
          cost: string | null
          couple_id: string
          created_at: string
          created_by: string | null
          id: string
          is_favorite: boolean
          text: string
          vibe: string | null
        }
        Insert: {
          cost?: string | null
          couple_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_favorite?: boolean
          text: string
          vibe?: string | null
        }
        Update: {
          cost?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_favorite?: boolean
          text?: string
          vibe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "date_ideas_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          done: boolean
          event_date: string | null
          id: string
          title: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          event_date?: string | null
          id?: string
          title: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          event_date?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          budget_id: string
          couple_id: string
          created_at: string
          description: string
          id: string
          profile_id: string | null
        }
        Insert: {
          amount: number
          budget_id: string
          couple_id: string
          created_at?: string
          description: string
          id?: string
          profile_id?: string | null
        }
        Update: {
          amount?: number
          budget_id?: string
          couple_id?: string
          created_at?: string
          description?: string
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moods: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          mood_date: string
          mood_emoji: string
          note: string | null
          profile_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          mood_date?: string
          mood_emoji: string
          note?: string | null
          profile_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          mood_date?: string
          mood_emoji?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moods_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          couple_id: string | null
          created_at: string
          display_name: string
          id: string
          partner_role: string | null
        }
        Insert: {
          couple_id?: string | null
          created_at?: string
          display_name?: string
          id: string
          partner_role?: string | null
        }
        Update: {
          couple_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          partner_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_couple_id: { Args: Record<PropertyKey, never>; Returns: string }
      join_couple_by_code: {
        Args: { p_code: string; p_display_name?: string }
        Returns: string
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

// ── Convenience row aliases ───────────────────────────────────────────
export type Profile = Tables<"profiles">
export type Couple = Tables<"couples">
export type EventRow = Tables<"events">
export type Budget = Tables<"budgets">
export type Expense = Tables<"expenses">
export type Mood = Tables<"moods">
export type DateIdea = Tables<"date_ideas">
export type AiSettings = Tables<"ai_settings">

export type PartnerRole = "creador" | "invitado"
