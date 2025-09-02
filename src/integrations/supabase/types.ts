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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      items: {
        Row: {
          caixa_organizador: string | null
          categoria: string | null
          codigo_barras: string
          comprimento_lixa: number | null
          condicao: string | null
          created_at: string
          data_criacao: string
          especificacao: string | null
          id: string
          localizacao: string | null
          marca: string | null
          metragem: number | null
          nome: string
          origem: string | null
          peso: number | null
          polaridade_disjuntor: string | null
          quantidade: number
          quantidade_minima: number | null
          responsavel: string | null
          sub_destino: string | null
          subcategoria: string | null
          tipo_servico: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          caixa_organizador?: string | null
          categoria?: string | null
          codigo_barras: string
          comprimento_lixa?: number | null
          condicao?: string | null
          created_at?: string
          data_criacao?: string
          especificacao?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          metragem?: number | null
          nome: string
          origem?: string | null
          peso?: number | null
          polaridade_disjuntor?: string | null
          quantidade?: number
          quantidade_minima?: number | null
          responsavel?: string | null
          sub_destino?: string | null
          subcategoria?: string | null
          tipo_servico?: string | null
          unidade: string
          updated_at?: string
        }
        Update: {
          caixa_organizador?: string | null
          categoria?: string | null
          codigo_barras?: string
          comprimento_lixa?: number | null
          condicao?: string | null
          created_at?: string
          data_criacao?: string
          especificacao?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          metragem?: number | null
          nome?: string
          origem?: string | null
          peso?: number | null
          polaridade_disjuntor?: string | null
          quantidade?: number
          quantidade_minima?: number | null
          responsavel?: string | null
          sub_destino?: string | null
          subcategoria?: string | null
          tipo_servico?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          created_at: string
          data_hora: string
          id: string
          item_id: string
          item_snapshot: Json
          observacoes: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          responsavel: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          id?: string
          item_id: string
          item_snapshot: Json
          observacoes?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          responsavel: string
          tipo: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          id?: string
          item_id?: string
          item_snapshot?: Json
          observacoes?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_atual?: number
          responsavel?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          tipo_usuario: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          tipo_usuario?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          tipo_usuario?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_items: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_manage_inventory: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_gestor_or_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      make_user_admin_by_email: {
        Args: { user_email: string }
        Returns: undefined
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
