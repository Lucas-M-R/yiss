// Types of the Supabase database, in the format of `supabase gen types typescript`.
// Written from supabase/schema.sql + supabase/migrations: regenerate them from the real
// project with `yarn db:types` (see package.json) after any schema change.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          partner_id: string | null
          password_hash: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          display_name: string
          avatar_url?: string | null
          partner_id?: string | null
          password_hash?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string | null
          partner_id?: string | null
          password_hash?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'users_partner_id_fkey'
            columns: ['partner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      partner_invitations: {
        Row: {
          id: string
          inviter_id: string
          invitee_email: string
          token: string
          status: string
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          inviter_id: string
          invitee_email: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          inviter_id?: string
          invitee_email?: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'partner_invitations_inviter_id_fkey'
            columns: ['inviter_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      exercises: {
        Row: {
          id: string
          name: string
          category: string
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category?: string
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: string
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'exercises_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      programs: {
        Row: {
          id: string
          name: string
          owner_id: string
          is_shared: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          is_shared?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          is_shared?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'programs_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      program_days: {
        Row: {
          id: string
          program_id: string
          label: string
          sort_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          program_id: string
          label: string
          sort_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          program_id?: string
          label?: string
          sort_order?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'program_days_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'programs'
            referencedColumns: ['id']
          }
        ]
      }
      program_day_exercises: {
        Row: {
          id: string
          program_day_id: string
          exercise_id: string
          default_sets: number
          sort_order: number
        }
        Insert: {
          id?: string
          program_day_id: string
          exercise_id: string
          default_sets?: number
          sort_order?: number
        }
        Update: {
          id?: string
          program_day_id?: string
          exercise_id?: string
          default_sets?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'program_day_exercises_program_day_id_fkey'
            columns: ['program_day_id']
            isOneToOne: false
            referencedRelation: 'program_days'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'program_day_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          }
        ]
      }
      sessions: {
        Row: {
          id: string
          session_date: string
          program_day_id: string | null
          created_by: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_date: string
          program_day_id?: string | null
          created_by: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_date?: string
          program_day_id?: string | null
          created_by?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_program_day_id_fkey'
            columns: ['program_day_id']
            isOneToOne: false
            referencedRelation: 'program_days'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      session_participants: {
        Row: {
          session_id: string
          user_id: string
        }
        Insert: {
          session_id: string
          user_id: string
        }
        Update: {
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_participants_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_participants_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      session_exercises: {
        Row: {
          id: string
          session_id: string
          exercise_id: string
          sets_count: number
          sort_order: number
          notes: string | null
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id: string
          sets_count?: number
          sort_order?: number
          notes?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          exercise_id?: string
          sets_count?: number
          sort_order?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'session_exercises_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          }
        ]
      }
      session_sets: {
        Row: {
          id: string
          session_exercise_id: string
          user_id: string
          set_number: number
          reps: number | null
          weight_kg: number | null
          duration_sec: number | null
          rest_sec: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_exercise_id: string
          user_id: string
          set_number: number
          reps?: number | null
          weight_kg?: number | null
          duration_sec?: number | null
          rest_sec?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_exercise_id?: string
          user_id?: string
          set_number?: number
          reps?: number | null
          weight_kg?: number | null
          duration_sec?: number | null
          rest_sec?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'session_sets_session_exercise_id_fkey'
            columns: ['session_exercise_id']
            isOneToOne: false
            referencedRelation: 'session_exercises'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_sets_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      exercise_stats: {
        Row: {
          user_id: string | null
          exercise_id: string | null
          exercise_name: string | null
          session_date: string | null
          max_weight: number | null
          volume: number | null
          total_sets: number | null
          total_reps: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'session_sets_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
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

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
