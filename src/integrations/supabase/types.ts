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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      certificate_requests: {
        Row: {
          approved_at: string | null
          birth_date: string
          certificate_downloaded: boolean | null
          certificate_issued: boolean | null
          certificate_serial: string | null
          certificate_valid_from: string | null
          certificate_valid_until: string | null
          cnpj: string | null
          common_name: string
          cpf: string
          created_at: string
          document_id: string | null
          email: string
          emission_url: string | null
          id: string
          issued_at: string | null
          paid_at: string | null
          payment_status: string | null
          pfx_data: string | null
          pfx_password: string | null
          phone: string
          product_id: number
          protocol: string | null
          registration_authority_id: number
          registry_office_id: number
          rejection_reason: string | null
          responsible_name: string | null
          revoked_at: string | null
          signer_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          updated_at: string
          user_id: string
          videoconference_completed: boolean | null
        }
        Insert: {
          approved_at?: string | null
          birth_date: string
          certificate_downloaded?: boolean | null
          certificate_issued?: boolean | null
          certificate_serial?: string | null
          certificate_valid_from?: string | null
          certificate_valid_until?: string | null
          cnpj?: string | null
          common_name: string
          cpf: string
          created_at?: string
          document_id?: string | null
          email: string
          emission_url?: string | null
          id?: string
          issued_at?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pfx_data?: string | null
          pfx_password?: string | null
          phone: string
          product_id?: number
          protocol?: string | null
          registration_authority_id?: number
          registry_office_id?: number
          rejection_reason?: string | null
          responsible_name?: string | null
          revoked_at?: string | null
          signer_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
          videoconference_completed?: boolean | null
        }
        Update: {
          approved_at?: string | null
          birth_date?: string
          certificate_downloaded?: boolean | null
          certificate_issued?: boolean | null
          certificate_serial?: string | null
          certificate_valid_from?: string | null
          certificate_valid_until?: string | null
          cnpj?: string | null
          common_name?: string
          cpf?: string
          created_at?: string
          document_id?: string | null
          email?: string
          emission_url?: string | null
          id?: string
          issued_at?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pfx_data?: string | null
          pfx_password?: string | null
          phone?: string
          product_id?: number
          protocol?: string | null
          registration_authority_id?: number
          registry_office_id?: number
          rejection_reason?: string | null
          responsible_name?: string | null
          revoked_at?: string | null
          signer_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          videoconference_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_requests_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          admin_cpf: string
          admin_email: string
          admin_name: string
          admin_phone: string
          avatar_url: string | null
          cep: string | null
          city: string | null
          cnpj: string
          company_name: string
          created_at: string
          healthcare_cep: string | null
          healthcare_city: string | null
          healthcare_neighborhood: string | null
          healthcare_state: string | null
          healthcare_street: string | null
          id: string
          is_healthcare: boolean | null
          logo_url: string | null
          medical_specialty: string | null
          neighborhood: string | null
          professional_council: string | null
          professional_registration: string | null
          registration_state: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_cpf: string
          admin_email: string
          admin_name: string
          admin_phone: string
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          cnpj: string
          company_name: string
          created_at?: string
          healthcare_cep?: string | null
          healthcare_city?: string | null
          healthcare_neighborhood?: string | null
          healthcare_state?: string | null
          healthcare_street?: string | null
          id?: string
          is_healthcare?: boolean | null
          logo_url?: string | null
          medical_specialty?: string | null
          neighborhood?: string | null
          professional_council?: string | null
          professional_registration?: string | null
          registration_state?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_cpf?: string
          admin_email?: string
          admin_name?: string
          admin_phone?: string
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          healthcare_cep?: string | null
          healthcare_city?: string | null
          healthcare_neighborhood?: string | null
          healthcare_state?: string | null
          healthcare_street?: string | null
          id?: string
          is_healthcare?: boolean | null
          logo_url?: string | null
          medical_specialty?: string | null
          neighborhood?: string | null
          professional_council?: string | null
          professional_registration?: string | null
          registration_state?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_signers: {
        Row: {
          birth_date: string | null
          bry_signer_link: string | null
          bry_signer_nonce: string | null
          cpf: string | null
          created_at: string
          document_id: string
          email: string
          id: string
          is_company_signer: boolean
          name: string
          phone: string
          signature_city: string | null
          signature_country: string | null
          signature_id: string | null
          signature_ip: string | null
          signature_latitude: number | null
          signature_longitude: number | null
          signature_page: number | null
          signature_state: string | null
          signature_x: number | null
          signature_y: number | null
          signed_at: string | null
          status: string
          typed_signature: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          bry_signer_link?: string | null
          bry_signer_nonce?: string | null
          cpf?: string | null
          created_at?: string
          document_id: string
          email: string
          id?: string
          is_company_signer?: boolean
          name: string
          phone: string
          signature_city?: string | null
          signature_country?: string | null
          signature_id?: string | null
          signature_ip?: string | null
          signature_latitude?: number | null
          signature_longitude?: number | null
          signature_page?: number | null
          signature_state?: string | null
          signature_x?: number | null
          signature_y?: number | null
          signed_at?: string | null
          status?: string
          typed_signature?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          bry_signer_link?: string | null
          bry_signer_nonce?: string | null
          cpf?: string | null
          created_at?: string
          document_id?: string
          email?: string
          id?: string
          is_company_signer?: boolean
          name?: string
          phone?: string
          signature_city?: string | null
          signature_country?: string | null
          signature_id?: string | null
          signature_ip?: string | null
          signature_latitude?: number | null
          signature_longitude?: number | null
          signature_page?: number | null
          signature_state?: string | null
          signature_x?: number | null
          signature_y?: number | null
          signed_at?: string | null
          status?: string
          typed_signature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bry_document_uuid: string | null
          bry_envelope_uuid: string | null
          bry_signed_file_url: string | null
          created_at: string
          envelope_id: string | null
          file_url: string | null
          folder_id: string | null
          id: string
          name: string
          patient_name: string | null
          prescription_doc_type: string | null
          signature_mode: string | null
          signed_by: number
          signers: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bry_document_uuid?: string | null
          bry_envelope_uuid?: string | null
          bry_signed_file_url?: string | null
          created_at?: string
          envelope_id?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          name: string
          patient_name?: string | null
          prescription_doc_type?: string | null
          signature_mode?: string | null
          signed_by?: number
          signers?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bry_document_uuid?: string | null
          bry_envelope_uuid?: string | null
          bry_signed_file_url?: string | null
          created_at?: string
          envelope_id?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          name?: string
          patient_name?: string | null
          prescription_doc_type?: string | null
          signature_mode?: string | null
          signed_by?: number
          signers?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          created_at: string
          document_id: string | null
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      envelopes: {
        Row: {
          created_at: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_document_usage: {
        Row: {
          created_at: string
          document_count: number
          id: string
          limit_reached_at: string | null
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_count?: number
          id?: string
          limit_reached_at?: string | null
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_count?: number
          id?: string
          limit_reached_at?: string | null
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          member_email: string
          member_user_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          member_email: string
          member_user_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          member_email?: string
          member_user_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signer_group_members: {
        Row: {
          contact_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signer_group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signer_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "signer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      signer_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          document_limit: number
          id: string
          plan_name: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          document_limit: number
          id?: string
          plan_name: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          document_limit?: number
          id?: string
          plan_name?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_history: {
        Row: {
          created_at: string
          delivered_at: string | null
          document_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message_sid: string | null
          message_type: string
          read_at: string | null
          recipient_name: string
          recipient_phone: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          document_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_sid?: string | null
          message_type: string
          read_at?: string | null
          recipient_name: string
          recipient_phone: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          document_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_sid?: string | null
          message_type?: string
          read_at?: string | null
          recipient_name?: string
          recipient_phone?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      is_organization_admin: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      member_role: "admin" | "member"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "unpaid"
        | "trialing"
        | "incomplete"
      ticket_status: "aberto" | "em_andamento" | "resolvido" | "fechado"
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
      member_role: ["admin", "member"],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "unpaid",
        "trialing",
        "incomplete",
      ],
      ticket_status: ["aberto", "em_andamento", "resolvido", "fechado"],
    },
  },
} as const
