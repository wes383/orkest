export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      progresses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          goal_value: number;
          goal_unit: string;
          tracking_mode: "count" | "percentage" | "manual";
          manual_value: number;
          color: string | null;
          status: "active" | "completed" | "archived";
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          goal_value: number;
          goal_unit?: string;
          tracking_mode?: "count" | "percentage" | "manual";
          manual_value?: number;
          color?: string | null;
          status?: "active" | "completed" | "archived";
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          goal_value?: number;
          goal_unit?: string;
          tracking_mode?: "count" | "percentage" | "manual";
          manual_value?: number;
          color?: string | null;
          status?: "active" | "completed" | "archived";
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      progress_tasks: {
        Row: {
          id: string;
          progress_id: string;
          item_id: string;
          weight: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          progress_id: string;
          item_id: string;
          weight?: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          progress_id?: string;
          item_id?: string;
          weight?: number;
          added_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          user_id: string;
          uid: string;
          title: string;
          description: string | null;
          has_time: boolean;
          start_date: string | null;
          start_time: string | null;
          end_date: string | null;
          end_time: string | null;
          all_day: boolean;
          timezone: string | null;
          due_date: string | null;
          recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
          recurrence_interval: number;
          days_of_week: number[];
          recurrence_end_type: "never" | "on_date" | "after_count";
          recurrence_end_date: string | null;
          recurrence_count: number | null;
          recurrence_bysetpos: number | null;
          priority: "low" | "medium" | "high" | "urgent" | null;
          estimate_minutes: number | null;
          tags: string[] | null;
          parent_id: string | null;
          completed_occurrence_keys: string[] | null;
          rrule: string | null;
          exdates: string[] | null;
          completed_occurrences: string[] | null;
          reopened_occurrences: string[] | null;
          deferred_until: string | null;
          dismissed_today_dates: string[] | null;
          planned_today_dates: string[] | null;
          now_override_date: string | null;
          project_id: string | null;
          status: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          google_event_id: string | null;
          google_calendar_id: string | null;
          last_google_sync_at: string | null;
          reminders: Json[];
        };
        Insert: {
          id?: string;
          user_id: string;
          uid: string;
          title: string;
          description?: string | null;
          has_time?: boolean;
          start_date?: string | null;
          start_time?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          all_day?: boolean;
          timezone?: string | null;
          due_date?: string | null;
          recurrence_type?: "none" | "daily" | "weekly" | "monthly" | "yearly";
          recurrence_interval?: number;
          days_of_week?: number[];
          recurrence_end_type?: "never" | "on_date" | "after_count";
          recurrence_end_date?: string | null;
          recurrence_count?: number | null;
          recurrence_bysetpos?: number | null;
          priority?: "low" | "medium" | "high" | "urgent" | null;
          estimate_minutes?: number | null;
          tags?: string[] | null;
          parent_id?: string | null;
          completed_occurrence_keys?: string[] | null;
          rrule?: string | null;
          exdates?: string[] | null;
          completed_occurrences?: string[] | null;
          reopened_occurrences?: string[] | null;
          deferred_until?: string | null;
          dismissed_today_dates?: string[] | null;
          planned_today_dates?: string[] | null;
          now_override_date?: string | null;
          project_id?: string | null;
          status?: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          google_event_id?: string | null;
          google_calendar_id?: string | null;
          last_google_sync_at?: string | null;
          reminders?: Json[];
        };
        Update: {
          id?: string;
          user_id?: string;
          uid?: string;
          title?: string;
          description?: string | null;
          has_time?: boolean;
          start_date?: string | null;
          start_time?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          all_day?: boolean;
          timezone?: string | null;
          due_date?: string | null;
          recurrence_type?: "none" | "daily" | "weekly" | "monthly" | "yearly";
          recurrence_interval?: number;
          days_of_week?: number[];
          recurrence_end_type?: "never" | "on_date" | "after_count";
          recurrence_end_date?: string | null;
          recurrence_count?: number | null;
          recurrence_bysetpos?: number | null;
          priority?: "low" | "medium" | "high" | "urgent" | null;
          estimate_minutes?: number | null;
          tags?: string[] | null;
          parent_id?: string | null;
          completed_occurrence_keys?: string[] | null;
          rrule?: string | null;
          exdates?: string[] | null;
          completed_occurrences?: string[] | null;
          reopened_occurrences?: string[] | null;
          deferred_until?: string | null;
          dismissed_today_dates?: string[] | null;
          planned_today_dates?: string[] | null;
          now_override_date?: string | null;
          project_id?: string | null;
          status?: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          google_event_id?: string | null;
          google_calendar_id?: string | null;
          last_google_sync_at?: string | null;
          reminders?: Json[];
        };
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          google_user_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          scope: string;
          calendar_id: string;
          calendar_name: string | null;
          sync_enabled: boolean;
          last_sync_at: string | null;
          last_sync_token: string | null;
          notification_channel_id: string | null;
          notification_channel_token: string | null;
          notification_channel_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_user_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          scope: string;
          calendar_id?: string;
          calendar_name?: string | null;
          sync_enabled?: boolean;
          last_sync_at?: string | null;
          last_sync_token?: string | null;
          notification_channel_id?: string | null;
          notification_channel_token?: string | null;
          notification_channel_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_user_id?: string;
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          scope?: string;
          calendar_id?: string;
          calendar_name?: string | null;
          sync_enabled?: boolean;
          last_sync_at?: string | null;
          last_sync_token?: string | null;
          notification_channel_id?: string | null;
          notification_channel_token?: string | null;
          notification_channel_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      embeddings: {
        Row: {
          id: string;
          item_id: string;
          user_id: string;
          embedding: number[] | null;
          item_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          user_id: string;
          embedding?: number[] | null;
          item_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          user_id?: string;
          embedding?: number[] | null;
          item_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "embeddings_item_id_fkey";
            columns: ["item_id"];
            isRelationOneToOne: true;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          item_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          completed: boolean;
          tags: string[] | null;
          task_title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          duration_seconds: number;
          completed?: boolean;
          tags?: string[] | null;
          task_title?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_seconds?: number;
          completed?: boolean;
          tags?: string[] | null;
          task_title?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: string;
          content?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isRelationOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_user_memory: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: string;
          category: string;
          confidence: number;
          source: string | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value: string;
          category: string;
          confidence?: number;
          source?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          value?: string;
          category?: string;
          confidence?: number;
          source?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_ai_limits: {
        Row: {
          user_id: string;
          daily_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          daily_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          daily_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: {
          user_id: string;
          subscription_id: string | null;
          status: string | null;
          price_id: string | null;
          customer_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          subscription_id?: string | null;
          status?: string | null;
          price_id?: string | null;
          customer_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          subscription_id?: string | null;
          status?: string | null;
          price_id?: string | null;
          customer_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_ai_usage: {
        Row: {
          user_id: string;
          usage_date: string;
          usage_count: number;
        };
        Insert: {
          user_id: string;
          usage_date?: string;
          usage_count?: number;
        };
        Update: {
          user_id?: string;
          usage_date?: string;
          usage_count?: number;
        };
        Relationships: [];
      };
      daily_digests: {
        Row: {
          user_id: string;
          digest_date: string;
          motivational_message: string | null;
          generated_at: string;
        };
        Insert: {
          user_id: string;
          digest_date?: string;
          motivational_message?: string | null;
          generated_at?: string;
        };
        Update: {
          user_id?: string;
          digest_date?: string;
          motivational_message?: string | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_digests_user_id_fkey";
            columns: ["user_id"];
            isRelationOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_digest_email: {
        Row: {
          user_id: string;
          enabled: boolean;
          send_hour: number;
          timezone_offset: number;
          last_sent_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          send_hour?: number;
          timezone_offset?: number;
          last_sent_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          send_hour?: number;
          timezone_offset?: number;
          last_sent_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_quote_translations: {
        Row: {
          quote_date: string;
          locale: string;
          quote: string;
          author: string;
          category: string[];
          source_id: number;
          fetched_at: string;
        };
        Insert: {
          quote_date: string;
          locale: string;
          quote: string;
          author: string;
          category?: string[];
          source_id: number;
          fetched_at?: string;
        };
        Update: {
          quote_date?: string;
          locale?: string;
          quote?: string;
          author?: string;
          category?: string[];
          source_id?: number;
          fetched_at?: string;
        };
        Relationships: [];
      };
      daily_onthisday_translations: {
        Row: {
          event_date: string;
          locale: string;
          events: Json;
          fetched_at: string;
        };
        Insert: {
          event_date: string;
          locale: string;
          events: Json;
          fetched_at?: string;
        };
        Update: {
          event_date?: string;
          locale?: string;
          events?: Json;
          fetched_at?: string;
        };
        Relationships: [];
      };
      daily_book_translations: {
        Row: {
          book_date: string;
          locale: string;
          title: string;
          author: string;
          year: number;
          language: string;
          recommendation: string;
          source_id: number;
          fetched_at: string;
        };
        Insert: {
          book_date: string;
          locale: string;
          title: string;
          author: string;
          year: number;
          language: string;
          recommendation: string;
          source_id: number;
          fetched_at?: string;
        };
        Update: {
          book_date?: string;
          locale?: string;
          title?: string;
          author?: string;
          year?: number;
          language?: string;
          recommendation?: string;
          source_id?: number;
          fetched_at?: string;
        };
        Relationships: [];
      };
      daily_movie_translations: {
        Row: {
          movie_date: string;
          locale: string;
          title: string;
          year: number;
          genres: string;
          directors: string;
          recommendation: string;
          imdb_id: string;
          source_id: number;
          fetched_at: string;
        };
        Insert: {
          movie_date: string;
          locale: string;
          title: string;
          year: number;
          genres: string;
          directors: string;
          recommendation: string;
          imdb_id: string;
          source_id: number;
          fetched_at?: string;
        };
        Update: {
          movie_date?: string;
          locale?: string;
          title?: string;
          year?: number;
          genres?: string;
          directors?: string;
          recommendation?: string;
          imdb_id?: string;
          source_id?: number;
          fetched_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      item_status: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
      item_priority: "low" | "medium" | "high" | "urgent";
      recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
      recurrence_end_type: "never" | "on_date" | "after_count";
    };
  };
};

type PublicSchema = Database["public"];
type TableName = keyof PublicSchema["Tables"];

export type TablesInsert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = PublicSchema["Tables"][T]["Update"];
export type TablesRow<T extends TableName> = PublicSchema["Tables"][T]["Row"];
