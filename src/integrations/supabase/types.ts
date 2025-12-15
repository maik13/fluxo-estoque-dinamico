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
      categoria_subcategoria: {
        Row: {
          categoria_id: string
          created_at: string
          id: string
          subcategoria_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          id?: string
          subcategoria_id: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          id?: string
          subcategoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_subcategoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_subcategoria_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoques: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          caixa_organizador: string | null
          codigo_antigo: string | null
          codigo_barras: number
          condicao: string | null
          created_at: string
          especificacao: string | null
          foto_url: string | null
          id: string
          localizacao: string | null
          marca: string | null
          ncm: string | null
          nome: string
          origem: string | null
          quantidade_minima: number | null
          subcategoria_id: string | null
          tipo_item: string | null
          unidade: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          caixa_organizador?: string | null
          codigo_antigo?: string | null
          codigo_barras: number
          condicao?: string | null
          created_at?: string
          especificacao?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          ncm?: string | null
          nome: string
          origem?: string | null
          quantidade_minima?: number | null
          subcategoria_id?: string | null
          tipo_item?: string | null
          unidade: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          caixa_organizador?: string | null
          codigo_antigo?: string | null
          codigo_barras?: number
          condicao?: string | null
          created_at?: string
          especificacao?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          ncm?: string | null
          nome?: string
          origem?: string | null
          quantidade_minima?: number | null
          subcategoria_id?: string | null
          tipo_item?: string | null
          unidade?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      locais_utilizacao: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          created_at: string
          data_hora: string
          destinatario: string | null
          estoque_id: string | null
          id: string
          item_id: string
          item_snapshot: Json
          local_utilizacao_id: string | null
          observacoes: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          solicitacao_id: string | null
          tipo: string
          tipo_operacao_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_hora?: string
          destinatario?: string | null
          estoque_id?: string | null
          id?: string
          item_id: string
          item_snapshot: Json
          local_utilizacao_id?: string | null
          observacoes?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          solicitacao_id?: string | null
          tipo: string
          tipo_operacao_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_hora?: string
          destinatario?: string | null
          estoque_id?: string | null
          id?: string
          item_id?: string
          item_snapshot?: Json
          local_utilizacao_id?: string | null
          observacoes?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_atual?: number
          solicitacao_id?: string | null
          tipo?: string
          tipo_operacao_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_local_utilizacao_id_fkey"
            columns: ["local_utilizacao_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_tipo_operacao_id_fkey"
            columns: ["tipo_operacao_id"]
            isOneToOne: false
            referencedRelation: "tipos_operacao"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_tipo_usuario: {
        Row: {
          created_at: string
          id: string
          pode_cadastrar_itens: boolean
          pode_editar_itens: boolean
          pode_excluir_itens: boolean
          pode_gerenciar_configuracoes: boolean
          pode_gerenciar_usuarios: boolean
          pode_registrar_movimentacoes: boolean
          tipo_usuario: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pode_cadastrar_itens?: boolean
          pode_editar_itens?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_registrar_movimentacoes?: boolean
          tipo_usuario: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pode_cadastrar_itens?: boolean
          pode_editar_itens?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_registrar_movimentacoes?: boolean
          tipo_usuario?: string
          updated_at?: string
        }
        Relationships: []
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
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          tipo_usuario?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          tipo_usuario?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacao_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_snapshot: Json
          quantidade_aprovada: number | null
          quantidade_solicitada: number
          solicitacao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_snapshot: Json
          quantidade_aprovada?: number | null
          quantidade_solicitada: number
          solicitacao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_snapshot?: Json
          quantidade_aprovada?: number | null
          quantidade_solicitada?: number
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          aceite_separador: boolean | null
          aceite_solicitante: boolean | null
          created_at: string
          criado_por_id: string | null
          data_solicitacao: string
          destinatario: string | null
          estoque_id: string | null
          id: string
          local_utilizacao: string | null
          local_utilizacao_id: string | null
          numero: number | null
          observacoes: string | null
          responsavel_estoque: string | null
          solicitacao_origem_id: string | null
          solicitante_id: string
          solicitante_nome: string
          tipo_operacao: string | null
          tipo_operacao_id: string | null
          updated_at: string
        }
        Insert: {
          aceite_separador?: boolean | null
          aceite_solicitante?: boolean | null
          created_at?: string
          criado_por_id?: string | null
          data_solicitacao?: string
          destinatario?: string | null
          estoque_id?: string | null
          id?: string
          local_utilizacao?: string | null
          local_utilizacao_id?: string | null
          numero?: number | null
          observacoes?: string | null
          responsavel_estoque?: string | null
          solicitacao_origem_id?: string | null
          solicitante_id: string
          solicitante_nome: string
          tipo_operacao?: string | null
          tipo_operacao_id?: string | null
          updated_at?: string
        }
        Update: {
          aceite_separador?: boolean | null
          aceite_solicitante?: boolean | null
          created_at?: string
          criado_por_id?: string | null
          data_solicitacao?: string
          destinatario?: string | null
          estoque_id?: string | null
          id?: string
          local_utilizacao?: string | null
          local_utilizacao_id?: string | null
          numero?: number | null
          observacoes?: string | null
          responsavel_estoque?: string | null
          solicitacao_origem_id?: string | null
          solicitante_id?: string
          solicitante_nome?: string
          tipo_operacao?: string | null
          tipo_operacao_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_local_utilizacao_id_fkey"
            columns: ["local_utilizacao_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_solicitacao_origem_id_fkey"
            columns: ["solicitacao_origem_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_tipo_operacao_id_fkey"
            columns: ["tipo_operacao_id"]
            isOneToOne: false
            referencedRelation: "tipos_operacao"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitantes: {
        Row: {
          ativo: boolean
          codigo_barras: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_barras?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_barras?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcategorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      tipos_operacao: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      transferencia_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_snapshot: Json
          quantidade: number
          transferencia_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_snapshot: Json
          quantidade: number
          transferencia_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_snapshot?: Json
          quantidade?: number
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          created_at: string
          data_transferencia: string
          estoque_destino_id: string
          estoque_origem_id: string
          id: string
          observacoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_transferencia?: string
          estoque_destino_id: string
          estoque_origem_id: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_transferencia?: string
          estoque_destino_id?: string
          estoque_origem_id?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_estoque_destino_id_fkey"
            columns: ["estoque_destino_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_origem_id_fkey"
            columns: ["estoque_origem_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_profile: {
        Args: {
          email: string
          nome: string
          target_user_id: string
          tipo: string
        }
        Returns: undefined
      }
      can_create_items: { Args: never; Returns: boolean }
      can_manage_inventory: { Args: never; Returns: boolean }
      gerar_proximo_codigo: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_gestor_or_admin: { Args: never; Returns: boolean }
      make_user_admin_by_email: {
        Args: { user_email: string }
        Returns: undefined
      }
      promote_user_to_admin: {
        Args: { target_email: string }
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
