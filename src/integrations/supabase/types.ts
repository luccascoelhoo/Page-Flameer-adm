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
      profiles: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          email: string | null
          birth_year: number | null
          role: 'user' | 'professional' | 'admin'
          streak: number
          xp: number
          level: number
          public_profile: boolean
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          avatar_url?: string | null
          email?: string | null
          birth_year?: number | null
          role?: 'user' | 'professional' | 'admin'
          streak?: number
          xp?: number
          level?: number
          public_profile?: boolean
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          avatar_url?: string | null
          email?: string | null
          birth_year?: number | null
          role?: 'user' | 'professional' | 'admin'
          streak?: number
          xp?: number
          level?: number
          public_profile?: boolean
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_health_profile: {
        Row: {
          user_id: string
          injuries: string[]
          allergies: string[]
          professional_reviewed: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          injuries?: string[]
          allergies?: string[]
          professional_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          injuries?: string[]
          allergies?: string[]
          professional_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          updated_at?: string | null
        }
      }
      challenges: {
        Row: {
          id: string
          title: string
          subtitle: string | null
          tier: 'admin' | 'influencer' | 'premium_user' | 'free_user'
          visibility: 'public' | 'private'
          category: string
          duration_days: number
          prize: string | null
          icon_name: string
          theme_colors: string[]
          cover_image_url: string | null
          creator_id: string | null
          share_code: string
          start_date: string | null
          end_date: string | null
          is_featured: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          subtitle?: string | null
          tier?: 'admin' | 'influencer' | 'premium_user' | 'free_user'
          visibility?: 'public' | 'private'
          category: string
          duration_days?: number
          prize?: string | null
          icon_name: string
          theme_colors?: string[]
          cover_image_url?: string | null
          creator_id?: string | null
          share_code: string
          start_date?: string | null
          end_date?: string | null
          is_featured?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          subtitle?: string | null
          tier?: 'admin' | 'influencer' | 'premium_user' | 'free_user'
          visibility?: 'public' | 'private'
          category?: string
          duration_days?: number
          prize?: string | null
          icon_name?: string
          theme_colors?: string[]
          cover_image_url?: string | null
          creator_id?: string | null
          share_code?: string
          start_date?: string | null
          end_date?: string | null
          is_featured?: boolean
          created_at?: string | null
        }
      }
      challenge_enrollments: {
        Row: {
          user_id: string
          challenge_id: string
          joined_at: string
          completed_at: string | null
          current_day: number
          active: boolean
        }
        Insert: {
          user_id: string
          challenge_id: string
          joined_at?: string
          completed_at?: string | null
          current_day?: number
          active?: boolean
        }
        Update: {
          user_id?: string
          challenge_id?: string
          joined_at?: string
          completed_at?: string | null
          current_day?: number
          active?: boolean
        }
      }
      habits: {
        Row: {
          id: string
          user_id: string
          label: string
          icon_name: string
          color: string
          fixed: boolean
          kind: 'units' | 'quantity' | 'single'
          unit: string | null
          target: number
          challenge_id: string | null
          is_locked_by_challenge: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          icon_name: string
          color: string
          fixed?: boolean
          kind: 'units' | 'quantity' | 'single'
          unit?: string | null
          target?: number
          challenge_id?: string | null
          is_locked_by_challenge?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          icon_name?: string
          color?: string
          fixed?: boolean
          kind?: 'units' | 'quantity' | 'single'
          unit?: string | null
          target?: number
          challenge_id?: string | null
          is_locked_by_challenge?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      daily_habit_logs: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          date: string
          current: number
          done: boolean
          pontos_ganhos: number
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          date?: string
          current?: number
          done?: boolean
          pontos_ganhos?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          date?: string
          current?: number
          done?: boolean
          pontos_ganhos?: number
          created_at?: string | null
        }
      }
      workouts: {
        Row: {
          id: string
          title: string
          duration_minutes: number
          focus: string
          creator_id: string | null
          challenge_id: string | null
          is_template: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          duration_minutes?: number
          focus: string
          creator_id?: string | null
          challenge_id?: string | null
          is_template?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          duration_minutes?: number
          focus?: string
          creator_id?: string | null
          challenge_id?: string | null
          is_template?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      workout_days: {
        Row: {
          id: string
          workout_id: string
          day_of_week: number
          order_index: number
        }
        Insert: {
          id?: string
          workout_id: string
          day_of_week: number
          order_index?: number
        }
        Update: {
          id?: string
          workout_id?: string
          day_of_week?: number
          order_index?: number
        }
      }
      exercises: {
        Row: {
          id: string
          workout_id: string
          name: string
          muscle: string
          rest_seconds: number
          order_index: number
        }
        Insert: {
          id?: string
          workout_id: string
          name: string
          muscle: string
          rest_seconds?: number
          order_index?: number
        }
        Update: {
          id?: string
          workout_id?: string
          name?: string
          muscle?: string
          rest_seconds?: number
          order_index?: number
        }
      }
      exercise_sets: {
        Row: {
          id: string
          exercise_id: string
          reps: string
          weight: string
          order_index: number
        }
        Insert: {
          id?: string
          exercise_id: string
          reps: string
          weight: string
          order_index?: number
        }
        Update: {
          id?: string
          exercise_id?: string
          reps?: string
          weight?: string
          order_index?: number
        }
      }
      workout_logs: {
        Row: {
          id: string
          user_id: string
          workout_id: string | null
          date: string
          completed_at: string | null
          elapsed_seconds: number
          total_volume_kg: number
          pontos_ganhos: number
        }
        Insert: {
          id?: string
          user_id: string
          workout_id?: string | null
          date?: string
          completed_at?: string | null
          elapsed_seconds?: number
          total_volume_kg?: number
          pontos_ganhos?: number
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string | null
          date?: string
          completed_at?: string | null
          elapsed_seconds?: number
          total_volume_kg?: number
          pontos_ganhos?: number
        }
      }
      workout_adaptations: {
        Row: {
          id: string
          user_id: string
          original_exercise_id: string
          adapted_exercise_name: string
          adapted_rest_seconds: number
          comments: string | null
          review_status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          original_exercise_id: string
          adapted_exercise_name: string
          adapted_rest_seconds?: number
          comments?: string | null
          review_status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          original_exercise_id?: string
          adapted_exercise_name?: string
          adapted_rest_seconds?: number
          comments?: string | null
          review_status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      diets: {
        Row: {
          id: string
          title: string
          creator_id: string | null
          challenge_id: string | null
          is_template: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          creator_id?: string | null
          challenge_id?: string | null
          is_template?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          creator_id?: string | null
          challenge_id?: string | null
          is_template?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      meals: {
        Row: {
          id: string
          diet_id: string
          name: string
          time: string
          calories: number
          protein: number
          carbs: number
          fat: number
          order_index: number
        }
        Insert: {
          id?: string
          diet_id: string
          name: string
          time: string
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          order_index?: number
        }
        Update: {
          id?: string
          diet_id?: string
          name?: string
          time?: string
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          order_index?: number
        }
      }
      meal_items: {
        Row: {
          id: string
          meal_id: string
          name: string
          quantity: string
          order_index: number
        }
        Insert: {
          id?: string
          meal_id: string
          name: string
          quantity: string
          order_index?: number
        }
        Update: {
          id?: string
          meal_id?: string
          name?: string
          quantity?: string
          order_index?: number
        }
      }
      diet_logs: {
        Row: {
          id: string
          user_id: string
          meal_id: string
          date: string
          consumed: boolean
          consumed_at: string | null
          swapped_with_meal_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          meal_id: string
          date?: string
          consumed?: boolean
          consumed_at?: string | null
          swapped_with_meal_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          meal_id?: string
          date?: string
          consumed?: boolean
          consumed_at?: string | null
          swapped_with_meal_id?: string | null
          created_at?: string | null
        }
      }
      user_reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string | null
          post_id: string | null
          comment_id: string | null
          reason: string
          status: 'pending' | 'resolved' | 'dismissed'
          created_at: string | null
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_user_id?: string | null
          post_id?: string | null
          comment_id?: string | null
          reason: string
          status?: 'pending' | 'resolved' | 'dismissed'
          created_at?: string | null
        }
        Update: {
          id?: string
          reporter_id?: string
          reported_user_id?: string | null
          post_id?: string | null
          comment_id?: string | null
          reason?: string
          status?: 'pending' | 'resolved' | 'dismissed'
          created_at?: string | null
        }
      }
      weekly_leaderboard: {
        Row: {
          year: number
          week_number: number
          user_id: string
          pontos_ganhos: number
          rank: number | null
          last_updated_at: string
        }
        Insert: {
          year: number
          week_number: number
          user_id: string
          pontos_ganhos?: number
          rank?: number | null
          last_updated_at?: string
        }
        Update: {
          year?: number
          week_number?: number
          user_id?: string
          pontos_ganhos?: number
          rank?: number | null
          last_updated_at?: string
        }
      }
      daily_scores: {
        Row: {
          user_id: string
          date: string
          pontos_ganhos: number
        }
        Insert: {
          user_id: string
          date: string
          pontos_ganhos?: number
        }
        Update: {
          user_id?: string
          date?: string
          pontos_ganhos?: number
        }
      }
      badges: {
        Row: {
          id: string
          name: string
          description: string | null
          icon_name: string
          challenge_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon_name: string
          challenge_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon_name?: string
          challenge_id?: string
          created_at?: string | null
        }
      }
      user_badges: {
        Row: {
          user_id: string
          badge_id: string
          earned_at: string
        }
        Insert: {
          user_id: string
          badge_id: string
          earned_at?: string
        }
        Update: {
          user_id?: string
          badge_id?: string
          earned_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          author_id: string
          image_url: string
          caption: string | null
          attached_challenge_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          author_id: string
          image_url: string
          caption?: string | null
          attached_challenge_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          author_id?: string
          image_url?: string
          caption?: string | null
          attached_challenge_id?: string | null
          created_at?: string | null
        }
      }
      post_likes: {
        Row: {
          user_id: string
          post_id: string
          created_at: string | null
        }
        Insert: {
          user_id: string
          post_id: string
          created_at?: string | null
        }
        Update: {
          user_id?: string
          post_id?: string
          created_at?: string | null
        }
      }
      post_comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          content: string
          created_at: string | null
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          content: string
          created_at?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          content?: string
          created_at?: string | null
        }
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
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? DefaultSchemaTableNameOrOptions
    : never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchemaTableNameOrOptions
    : never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchemaTableNameOrOptions
    : never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchemaEnumNameOrOptions
    : never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never
