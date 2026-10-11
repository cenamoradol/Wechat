export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          default_currency: string;
          onboarding_step: number;
          storage_limit_bytes: number;
          storage_unlimited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          logo_url?: string | null;
          default_currency?: string;
          onboarding_step?: number;
          storage_limit_bytes?: number;
          storage_unlimited?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          default_currency?: string;
          onboarding_step?: number;
          storage_limit_bytes?: number;
          storage_unlimited?: boolean;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["workspace_role"];
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["workspace_role"];
        };
        Update: {
          role?: Database["public"]["Enums"]["workspace_role"];
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: Database["public"]["Enums"]["workspace_role"];
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["workspace_role"];
          token: string;
          invited_by?: string | null;
          expires_at: string;
        };
        Update: {
          email?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [];
      };
      channels: {
        Row: {
          id: string;
          workspace_id: string;
          type: Database["public"]["Enums"]["channel_type"];
          external_id: string;
          display_name: string;
          access_token_enc: string; // text (base64-encoded AES-GCM ciphertext)
          webhook_secret_enc: string | null;
          meta: Record<string, unknown> | null;
          status: string;
          last_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          type: Database["public"]["Enums"]["channel_type"];
          external_id: string;
          display_name: string;
          access_token_enc: string;
          webhook_secret_enc?: string | null;
          meta?: Record<string, unknown> | null;
          status?: string;
          last_verified_at?: string | null;
        };
        Update: {
          display_name?: string;
          access_token_enc?: string;
          webhook_secret_enc?: string | null;
          meta?: Record<string, unknown> | null;
          status?: string;
          last_verified_at?: string | null;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          channel_id: string | null;
          type: string;
          processed: boolean;
          payload: Record<string, unknown>;
          error: string | null;
          received_at: string;
        };
        Insert: {
          channel_id?: string | null;
          type: string;
          processed?: boolean;
          payload: Record<string, unknown>;
          error?: string | null;
        };
        Update: {
          processed?: boolean;
          error?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string;
          full_name: string | null;
          email: string | null;
          phone_e164: string | null;
          avatar_url: string | null;
          metadata: Record<string, unknown>;
          tags: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          full_name?: string | null;
          email?: string | null;
          phone_e164?: string | null;
          avatar_url?: string | null;
          metadata?: Record<string, unknown>;
          tags?: string[];
          notes?: string | null;
        };
        Update: Partial<{
          full_name: string | null;
          email: string | null;
          phone_e164: string | null;
          avatar_url: string | null;
          metadata: Record<string, unknown>;
          tags: string[];
          notes: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey";
            columns: ["id"];
            referencedRelation: "contact_channels";
            referencedColumns: ["contact_id"];
          },
        ];
      };
      contact_channels: {
        Row: {
          id: string;
          contact_id: string;
          channel_id: string;
          external_user_id: string;
          profile: Record<string, unknown>;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          contact_id: string;
          channel_id: string;
          external_user_id: string;
          profile?: Record<string, unknown>;
          last_seen_at?: string | null;
        };
        Update: Partial<{
          profile: Record<string, unknown>;
          last_seen_at: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "contact_channels_channel_id_fkey";
            columns: ["channel_id"];
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          workspace_id: string;
          contact_channel_id: string;
          status: Database["public"]["Enums"]["conversation_status"];
          assigned_to: string | null;
          last_message_at: string;
          last_message_preview: string | null;
          unread_count: number;
          ai_agent_id: string | null;
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          contact_channel_id: string;
          status?: Database["public"]["Enums"]["conversation_status"];
          assigned_to?: string | null;
          last_message_at?: string;
          last_message_preview?: string | null;
          unread_count?: number;
          ai_agent_id?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
        };
        Update: Partial<{
          status: Database["public"]["Enums"]["conversation_status"];
          assigned_to: string | null;
          last_message_at: string;
          last_message_preview: string | null;
          unread_count: number;
          ai_agent_id: string | null;
          archived_at: string | null;
          archived_by: string | null;
        }>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          external_id: string | null;
          direction: Database["public"]["Enums"]["message_direction"];
          type: Database["public"]["Enums"]["message_type"];
          text: string | null;
          media_url: string | null;
          media_mime: string | null;
          media_filename: string | null;
          media_size_bytes: number | null;
          media_duration_seconds: number | null;
          media_thumbnail_url: string | null;
          media_meta_id: string | null;
          template_id: string | null;
          template_vars: Record<string, unknown> | null;
          reactions: unknown[];
          status: string;
          error_code: string | null;
          error_message: string | null;
          raw_payload: Record<string, unknown> | null;
          sent_by: string | null;
          read_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          external_id?: string | null;
          direction: Database["public"]["Enums"]["message_direction"];
          type?: Database["public"]["Enums"]["message_type"];
          text?: string | null;
          media_url?: string | null;
          media_mime?: string | null;
          media_filename?: string | null;
          media_size_bytes?: number | null;
          media_duration_seconds?: number | null;
          media_thumbnail_url?: string | null;
          media_meta_id?: string | null;
          template_id?: string | null;
          template_vars?: Record<string, unknown> | null;
          reactions?: unknown[];
          status?: string;
          error_code?: string | null;
          error_message?: string | null;
          raw_payload?: Record<string, unknown> | null;
          sent_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<{
          external_id: string | null;
          status: string;
          error_code: string | null;
          error_message: string | null;
          read_at: string | null;
          media_url: string | null;
          media_meta_id: string | null;
          text: string | null;
          deleted_at: string | null;
          sent_by: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "messages_sent_by_fkey";
            columns: ["sent_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: {
          id: string;
          channel_id: string;
          external_id: string;
          name: string;
          language: string;
          status: string;
          category: string | null;
          components: unknown[];
          last_synced_at: string;
        };
        Insert: {
          channel_id: string;
          external_id: string;
          name: string;
          language: string;
          status: string;
          category?: string | null;
          components: unknown[];
          last_synced_at?: string;
        };
        Update: Partial<{
          status: string;
          category: string | null;
          last_synced_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      recompute_unread_count: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
    };
    Enums: {
      workspace_role: "owner" | "admin" | "agent" | "viewer";
      channel_type: "whatsapp" | "facebook" | "instagram";
      conversation_status: "open" | "pending" | "closed";
      message_direction: "in" | "out";
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "document"
        | "template"
        | "interactive"
        | "reaction"
        | "story_reply"
        | "system";
    };
    CompositeTypes: Record<string, never>;
  };
};