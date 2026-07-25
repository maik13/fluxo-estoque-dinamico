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
          ativo: boolean
          caixa_organizador: string | null
          categoria_id: string | null
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
          ativo?: boolean
          caixa_organizador?: string | null
          categoria_id?: string | null
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
          ativo?: boolean
          caixa_organizador?: string | null
          categoria_id?: string | null
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
            foreignKeyName: "items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
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
          group_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locais_utilizacao_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          created_at: string
          data_hora: string
          dedupe_key: string | null
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
          dedupe_key?: string | null
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
          dedupe_key?: string | null
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
      pedido_compra_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_snapshot: Json
          nome_item: string | null
          pedido_id: string
          quantidade: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_snapshot: Json
          nome_item?: string | null
          pedido_id: string
          quantidade: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_snapshot?: Json
          nome_item?: string | null
          pedido_id?: string
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_compra_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_compra_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          created_at: string
          criado_por_id: string | null
          criado_por_nome: string
          data_conclusao: string | null
          data_pedido: string
          editado: boolean
          editado_em: string | null
          editado_por: string | null
          estoque_id: string | null
          id: string
          numero: number
          observacoes: string | null
          solicitacao_material_id: string | null
          solicitacao_material_numero: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome: string
          data_conclusao?: string | null
          data_pedido?: string
          editado?: boolean
          editado_em?: string | null
          editado_por?: string | null
          estoque_id?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          solicitacao_material_id?: string | null
          solicitacao_material_numero?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string
          data_conclusao?: string | null
          data_pedido?: string
          editado?: boolean
          editado_em?: string | null
          editado_por?: string | null
          estoque_id?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          solicitacao_material_id?: string | null
          solicitacao_material_numero?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_solicitacao_material_id_fkey"
            columns: ["solicitacao_material_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_material"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_tipo_usuario: {
        Row: {
          created_at: string
          id: string
          pode_acessar_gerencial: boolean | null
          pode_acessar_projetos: boolean | null
          pode_apontar_producao: boolean
          pode_cadastrar_itens: boolean
          pode_conferir_producao: boolean
          pode_configurar_producao: boolean
          pode_devolver_material: boolean
          pode_editar_itens: boolean
          pode_editar_movimentacoes: boolean
          pode_excluir_itens: boolean
          pode_gerenciar_configuracoes: boolean
          pode_gerenciar_usuarios: boolean
          pode_pedido_compra: boolean
          pode_registrar_entrada: boolean
          pode_registrar_movimentacoes: boolean
          pode_registrar_saida: boolean
          pode_solicitacao_material: boolean
          pode_solicitar_material: boolean
          pode_transferir: boolean
          pode_ver_bi_producao: boolean
          pode_ver_relatorios: boolean
          tipo_usuario: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pode_acessar_gerencial?: boolean | null
          pode_acessar_projetos?: boolean | null
          pode_apontar_producao?: boolean
          pode_cadastrar_itens?: boolean
          pode_conferir_producao?: boolean
          pode_configurar_producao?: boolean
          pode_devolver_material?: boolean
          pode_editar_itens?: boolean
          pode_editar_movimentacoes?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_pedido_compra?: boolean
          pode_registrar_entrada?: boolean
          pode_registrar_movimentacoes?: boolean
          pode_registrar_saida?: boolean
          pode_solicitacao_material?: boolean
          pode_solicitar_material?: boolean
          pode_transferir?: boolean
          pode_ver_bi_producao?: boolean
          pode_ver_relatorios?: boolean
          tipo_usuario: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pode_acessar_gerencial?: boolean | null
          pode_acessar_projetos?: boolean | null
          pode_apontar_producao?: boolean
          pode_cadastrar_itens?: boolean
          pode_conferir_producao?: boolean
          pode_configurar_producao?: boolean
          pode_devolver_material?: boolean
          pode_editar_itens?: boolean
          pode_editar_movimentacoes?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_pedido_compra?: boolean
          pode_registrar_entrada?: boolean
          pode_registrar_movimentacoes?: boolean
          pode_registrar_saida?: boolean
          pode_solicitacao_material?: boolean
          pode_solicitar_material?: boolean
          pode_transferir?: boolean
          pode_ver_bi_producao?: boolean
          pode_ver_relatorios?: boolean
          tipo_usuario?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_alocacoes_diarias: {
        Row: {
          calculado_em: string
          data: string
          id: string
          pessoas_planejadas: number
          processo_id: string
          quantidade_planejada: number
          versao_calculo: string
        }
        Insert: {
          calculado_em?: string
          data: string
          id?: string
          pessoas_planejadas: number
          processo_id: string
          quantidade_planejada: number
          versao_calculo: string
        }
        Update: {
          calculado_em?: string
          data?: string
          id?: string
          pessoas_planejadas?: number
          processo_id?: string
          quantidade_planejada?: number
          versao_calculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_alocacoes_diarias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_apontamento_anexos: {
        Row: {
          apontamento_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          apontamento_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          apontamento_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamento_anexos_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_apontamento_eventos: {
        Row: {
          apontamento_id: string
          campo_alterado: string | null
          data_hora: string
          evento: string
          id: string
          justificativa: string | null
          nome_usuario_snapshot: string
          usuario_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          apontamento_id: string
          campo_alterado?: string | null
          data_hora?: string
          evento: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          apontamento_id?: string
          campo_alterado?: string | null
          data_hora?: string
          evento?: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamento_eventos_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_apontamento_membros: {
        Row: {
          apontamento_id: string
          created_at: string
          id: string
          membro_id: string
          nome_snapshot: string
        }
        Insert: {
          apontamento_id: string
          created_at?: string
          id?: string
          membro_id: string
          nome_snapshot: string
        }
        Update: {
          apontamento_id?: string
          created_at?: string
          id?: string
          membro_id?: string
          nome_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamento_membros_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamento_membros_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "producao_membros"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_apontamentos: {
        Row: {
          cancelado_em: string | null
          cancelado_por_id: string | null
          cancelado_por_nome_snapshot: string | null
          conferido_em: string | null
          conferido_por_id: string | null
          conferido_por_nome_snapshot: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          data: string
          duracao_minutos: number
          id: string
          inicio: string
          local_tipo: string
          motivo_cancelamento: string | null
          observacoes: string | null
          processo_id: string | null
          projeto_local_id: string
          quantidade_produzida: number | null
          status: string
          tarefa_id: string
          termino: string
          ultima_edicao_em: string | null
          ultima_edicao_por_id: string | null
          ultima_edicao_por_nome_snapshot: string | null
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por_id?: string | null
          cancelado_por_nome_snapshot?: string | null
          conferido_em?: string | null
          conferido_por_id?: string | null
          conferido_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data: string
          duracao_minutos: number
          id?: string
          inicio: string
          local_tipo: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          processo_id?: string | null
          projeto_local_id: string
          quantidade_produzida?: number | null
          status?: string
          tarefa_id: string
          termino: string
          ultima_edicao_em?: string | null
          ultima_edicao_por_id?: string | null
          ultima_edicao_por_nome_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por_id?: string | null
          cancelado_por_nome_snapshot?: string | null
          conferido_em?: string | null
          conferido_por_id?: string | null
          conferido_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data?: string
          duracao_minutos?: number
          id?: string
          inicio?: string
          local_tipo?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          processo_id?: string | null
          projeto_local_id?: string
          quantidade_produzida?: number | null
          status?: string
          tarefa_id?: string
          termino?: string
          ultima_edicao_em?: string | null
          ultima_edicao_por_id?: string | null
          ultima_edicao_por_nome_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamentos_projeto_local_id_fkey"
            columns: ["projeto_local_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamentos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "producao_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_cronograma_alertas: {
        Row: {
          codigo: string
          created_at: string
          data: string | null
          id: string
          mensagem: string
          processo_id: string | null
          severidade: string
          versao_calculo: string
        }
        Insert: {
          codigo: string
          created_at?: string
          data?: string | null
          id?: string
          mensagem: string
          processo_id?: string | null
          severidade: string
          versao_calculo: string
        }
        Update: {
          codigo?: string
          created_at?: string
          data?: string | null
          id?: string
          mensagem?: string
          processo_id?: string | null
          severidade?: string
          versao_calculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_cronograma_alertas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_cronograma_configuracoes: {
        Row: {
          atualizado_por_id: string | null
          atualizado_por_nome_snapshot: string | null
          equipe_disponivel_por_dia: number
          horizonte_dias: number
          id: number
          trabalha_domingo: boolean
          trabalha_sabado: boolean
          updated_at: string
        }
        Insert: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          equipe_disponivel_por_dia?: number
          horizonte_dias?: number
          id?: number
          trabalha_domingo?: boolean
          trabalha_sabado?: boolean
          updated_at?: string
        }
        Update: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          equipe_disponivel_por_dia?: number
          horizonte_dias?: number
          id?: number
          trabalha_domingo?: boolean
          trabalha_sabado?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      producao_materiais_projeto: {
        Row: {
          apontamento_id: string | null
          created_at: string
          id: string
          item_id: string
          item_snapshot: Json
          movement_id: string
          observacoes_producao: string | null
          projeto_local_id: string
          quantidade: number
          tipo: string
        }
        Insert: {
          apontamento_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_snapshot: Json
          movement_id: string
          observacoes_producao?: string | null
          projeto_local_id: string
          quantidade: number
          tipo: string
        }
        Update: {
          apontamento_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_snapshot?: Json
          movement_id?: string
          observacoes_producao?: string | null
          projeto_local_id?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_materiais_projeto_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_materiais_projeto_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_materiais_projeto_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_materiais_projeto_projeto_local_id_fkey"
            columns: ["projeto_local_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_membros: {
        Row: {
          apelido: string | null
          ativo: boolean
          created_at: string
          funcao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          funcao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          funcao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_permissoes: {
        Row: {
          created_at: string
          pode_cancelar_apontamentos: boolean
          pode_conferir_apontamentos: boolean
          pode_editar_apontamentos: boolean
          pode_finalizar_processos: boolean
          pode_gerenciar_anexos: boolean
          pode_gerenciar_membros: boolean
          pode_gerenciar_processos: boolean
          pode_gerenciar_projetos: boolean
          pode_gerenciar_tarefas: boolean
          pode_lancar_apontamentos: boolean
          pode_reabrir_processos: boolean
          pode_vincular_membros: boolean
          pode_visualizar: boolean
          pode_visualizar_auditoria: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pode_cancelar_apontamentos?: boolean
          pode_conferir_apontamentos?: boolean
          pode_editar_apontamentos?: boolean
          pode_finalizar_processos?: boolean
          pode_gerenciar_anexos?: boolean
          pode_gerenciar_membros?: boolean
          pode_gerenciar_processos?: boolean
          pode_gerenciar_projetos?: boolean
          pode_gerenciar_tarefas?: boolean
          pode_lancar_apontamentos?: boolean
          pode_reabrir_processos?: boolean
          pode_vincular_membros?: boolean
          pode_visualizar?: boolean
          pode_visualizar_auditoria?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          pode_cancelar_apontamentos?: boolean
          pode_conferir_apontamentos?: boolean
          pode_editar_apontamentos?: boolean
          pode_finalizar_processos?: boolean
          pode_gerenciar_anexos?: boolean
          pode_gerenciar_membros?: boolean
          pode_gerenciar_processos?: boolean
          pode_gerenciar_projetos?: boolean
          pode_gerenciar_tarefas?: boolean
          pode_lancar_apontamentos?: boolean
          pode_reabrir_processos?: boolean
          pode_vincular_membros?: boolean
          pode_visualizar?: boolean
          pode_visualizar_auditoria?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      producao_processo_dependencias: {
        Row: {
          created_at: string
          depende_de_processo_id: string
          id: string
          processo_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          depende_de_processo_id: string
          id?: string
          processo_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          depende_de_processo_id?: string
          id?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_processo_dependencias_depende_de_processo_id_fkey"
            columns: ["depende_de_processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_processo_dependencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_processo_eventos: {
        Row: {
          dados_complementares: Json | null
          data_hora: string
          id: string
          justificativa: string | null
          nome_usuario_snapshot: string
          novo_status: string | null
          processo_id: string
          status_anterior: string | null
          tipo_evento: string
          usuario_responsavel_id: string | null
          valores_anteriores: Json | null
          valores_posteriores: Json | null
        }
        Insert: {
          dados_complementares?: Json | null
          data_hora?: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot: string
          novo_status?: string | null
          processo_id: string
          status_anterior?: string | null
          tipo_evento: string
          usuario_responsavel_id?: string | null
          valores_anteriores?: Json | null
          valores_posteriores?: Json | null
        }
        Update: {
          dados_complementares?: Json | null
          data_hora?: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot?: string
          novo_status?: string | null
          processo_id?: string
          status_anterior?: string | null
          tipo_evento?: string
          usuario_responsavel_id?: string | null
          valores_anteriores?: Json | null
          valores_posteriores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_processo_eventos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_processos: {
        Row: {
          aceita_producao_proporcional: boolean
          atualizado_por_id: string | null
          atualizado_por_nome_snapshot: string | null
          cancelado_em: string | null
          cancelado_por_id: string | null
          cancelado_por_nome_snapshot: string | null
          capacidade_diaria: number | null
          codigo: string
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio_desejada: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          data_limite: string | null
          descricao: string | null
          finalizado_em: string | null
          finalizado_por_id: string | null
          finalizado_por_nome_snapshot: string | null
          grupo_cronograma: string | null
          id: string
          motivo_bloqueio: string | null
          motivo_cancelamento: string | null
          motivo_pausa: string | null
          nome: string
          observacoes: string | null
          pessoas_necessarias: number | null
          prioridade: string
          produto_entregavel: string | null
          projeto_id: string
          quantidade_planejada: number | null
          responsavel_id: string | null
          responsavel_nome_snapshot: string | null
          sequencia: number
          status: string
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          aceita_producao_proporcional?: boolean
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          cancelado_em?: string | null
          cancelado_por_id?: string | null
          cancelado_por_nome_snapshot?: string | null
          capacidade_diaria?: number | null
          codigo: string
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_desejada?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          data_limite?: string | null
          descricao?: string | null
          finalizado_em?: string | null
          finalizado_por_id?: string | null
          finalizado_por_nome_snapshot?: string | null
          grupo_cronograma?: string | null
          id?: string
          motivo_bloqueio?: string | null
          motivo_cancelamento?: string | null
          motivo_pausa?: string | null
          nome: string
          observacoes?: string | null
          pessoas_necessarias?: number | null
          prioridade?: string
          produto_entregavel?: string | null
          projeto_id: string
          quantidade_planejada?: number | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          sequencia?: number
          status?: string
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          aceita_producao_proporcional?: boolean
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          cancelado_em?: string | null
          cancelado_por_id?: string | null
          cancelado_por_nome_snapshot?: string | null
          capacidade_diaria?: number | null
          codigo?: string
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_desejada?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          data_limite?: string | null
          descricao?: string | null
          finalizado_em?: string | null
          finalizado_por_id?: string | null
          finalizado_por_nome_snapshot?: string | null
          grupo_cronograma?: string | null
          id?: string
          motivo_bloqueio?: string | null
          motivo_cancelamento?: string | null
          motivo_pausa?: string | null
          nome?: string
          observacoes?: string | null
          pessoas_necessarias?: number | null
          prioridade?: string
          produto_entregavel?: string | null
          projeto_id?: string
          quantidade_planejada?: number | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          sequencia?: number
          status?: string
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_processos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_projetos: {
        Row: {
          ativo: boolean
          atualizado_por_id: string | null
          atualizado_por_nome_snapshot: string | null
          cidade: string | null
          cliente: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          data_fim_prevista: string | null
          data_inicio_prevista: string | null
          descricao: string | null
          endereco_execucao: string | null
          id: string
          local_execucao: string | null
          local_utilizacao_id: string | null
          nome: string
          observacoes: string | null
          responsavel_id: string | null
          responsavel_nome_snapshot: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          cidade?: string | null
          cliente?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_inicio_prevista?: string | null
          descricao?: string | null
          endereco_execucao?: string | null
          id?: string
          local_execucao?: string | null
          local_utilizacao_id?: string | null
          nome: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          cidade?: string | null
          cliente?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_inicio_prevista?: string | null
          descricao?: string | null
          endereco_execucao?: string | null
          id?: string
          local_execucao?: string | null
          local_utilizacao_id?: string | null
          nome?: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_projetos_local_utilizacao_id_fkey"
            columns: ["local_utilizacao_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_tarefas: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
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
      project_groups: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
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
      solicitacao_material_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_snapshot: Json | null
          nome_item: string
          observacoes: string | null
          quantidade: number
          solicitacao_material_id: string
          unidade: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_snapshot?: Json | null
          nome_item: string
          observacoes?: string | null
          quantidade?: number
          solicitacao_material_id: string
          unidade?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_snapshot?: Json | null
          nome_item?: string
          observacoes?: string | null
          quantidade?: number
          solicitacao_material_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_material_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_material_itens_solicitacao_material_id_fkey"
            columns: ["solicitacao_material_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_material"
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
      solicitacoes_material: {
        Row: {
          aprovado_por_id: string | null
          aprovado_por_nome: string | null
          created_at: string
          data_aprovacao: string | null
          estoque_id: string | null
          id: string
          local_origem: string | null
          local_origem_id: string | null
          numero: number
          observacoes: string | null
          solicitacao_retirada_id: string | null
          solicitante_id: string
          solicitante_nome: string
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_por_id?: string | null
          aprovado_por_nome?: string | null
          created_at?: string
          data_aprovacao?: string | null
          estoque_id?: string | null
          id?: string
          local_origem?: string | null
          local_origem_id?: string | null
          numero?: number
          observacoes?: string | null
          solicitacao_retirada_id?: string | null
          solicitante_id: string
          solicitante_nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_por_id?: string | null
          aprovado_por_nome?: string | null
          created_at?: string
          data_aprovacao?: string | null
          estoque_id?: string | null
          id?: string
          local_origem?: string | null
          local_origem_id?: string | null
          numero?: number
          observacoes?: string | null
          solicitacao_retirada_id?: string | null
          solicitante_id?: string
          solicitante_nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_material_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_material_local_origem_id_fkey"
            columns: ["local_origem_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_material_solicitacao_retirada_id_fkey"
            columns: ["solicitacao_retirada_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
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
      usuario_permissoes_individuais: {
        Row: {
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          efeito: string
          id: string
          permissao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          efeito: string
          id?: string
          permissao: string
          updated_at?: string
          user_id: string
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          efeito?: string
          id?: string
          permissao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usuario_permissoes_individuais_auditoria: {
        Row: {
          alterado_por: string | null
          alterado_por_nome: string | null
          created_at: string
          estado_anterior: string
          estado_novo: string
          id: string
          permissao: string
          user_id: string
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          created_at?: string
          estado_anterior: string
          estado_novo: string
          id?: string
          permissao: string
          user_id: string
        }
        Update: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          created_at?: string
          estado_anterior?: string
          estado_novo?: string
          id?: string
          permissao?: string
          user_id?: string
        }
        Relationships: []
      }
      viewer_message_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message: string | null
          recipient_id: string | null
          requested_date: string | null
          updated_at: string | null
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          recipient_id?: string | null
          requested_date?: string | null
          updated_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          recipient_id?: string | null
          requested_date?: string | null
          updated_at?: string | null
          viewer_id?: string | null
        }
        Relationships: []
      }
      viewer_thread_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewer_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "viewer_message_threads"
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
      configurar_planejamento_etapa_producao: {
        Args: {
          p_aceita_producao_proporcional?: boolean
          p_capacidade_diaria?: number
          p_data_fim_prevista?: string
          p_data_inicio_prevista?: string
          p_grupo_cronograma?: string
          p_pessoas_necessarias?: number
          p_processo_id: string
          p_sequencia?: number
        }
        Returns: undefined
      }
      create_visualizador_message_thread: {
        Args: {
          p_initial_message: string
          p_recipient_id: string
          p_viewer_id: string
        }
        Returns: string
      }
      criar_etapa_producao: {
        Args: {
          p_aceita_producao_proporcional?: boolean
          p_capacidade_diaria?: number
          p_codigo?: string
          p_data_inicio_desejada?: string
          p_data_limite?: string
          p_dependencias?: Json
          p_descricao?: string
          p_grupo_cronograma?: string
          p_nome: string
          p_pessoas_necessarias?: number
          p_prioridade?: string
          p_produto_entregavel?: string
          p_projeto_local_id: string
          p_quantidade_planejada?: number
          p_sequencia?: number
          p_unidade_medida?: string
        }
        Returns: string
      }
      gerar_proximo_codigo: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_gestor_or_admin: { Args: never; Returns: boolean }
      listar_gantt_producao: {
        Args: never
        Returns: {
          alocacoes: Json
          capacidade_diaria: number
          cidade: string
          codigo: string
          data_fim_prevista: string
          data_fim_real: string
          data_inicio_desejada: string
          data_inicio_prevista: string
          data_inicio_real: string
          data_limite: string
          etapa_id: string
          etapa_nome: string
          grupo_cronograma: string
          percentual_realizado: number
          pessoas_necessarias: number
          prioridade: string
          projeto_id: string
          projeto_nome: string
          quantidade_planejada: number
          quantidade_realizada: number
          sequencia: number
          status: string
          uf: string
          unidade_medida: string
        }[]
      }
      listar_permissoes_usuario: {
        Args: { p_user_id: string }
        Returns: {
          chave: string
          descricao: string
          estado_individual: string
          grupo: string
          modulo: string
          nome: string
          ordem: number
          origem: string
          perfil_permitido: boolean
          permissao_id: string
          permitido_efetivo: boolean
        }[]
      }
      listar_plano_diario_producao: {
        Args: { p_data_inicio: string; p_dias?: number }
        Returns: {
          codigo: string
          data: string
          etapa_id: string
          etapa_nome: string
          grupo_cronograma: string
          pessoas_planejadas: number
          projeto_id: string
          projeto_nome: string
          quantidade_planejada: number
          quantidade_realizada: number
          status: string
          unidade_medida: string
        }[]
      }
      make_user_admin_by_email: {
        Args: { user_email: string }
        Returns: undefined
      }
      obter_minhas_permissoes: { Args: never; Returns: Json }
      permissao_individual_efetiva: {
        Args: { p_permissao: string; p_user_id: string }
        Returns: boolean
      }
      permissao_individual_efetiva_por_perfil: {
        Args: { p_permissao: string; p_tipo: string }
        Returns: boolean
      }
      promote_user_to_admin: {
        Args: { target_email: string }
        Returns: undefined
      }
      recalcular_cronograma_producao: { Args: never; Returns: string }
      recalcular_cronograma_producao_interno: {
        Args: { p_usuario_id: string; p_usuario_nome: string }
        Returns: string
      }
      salvar_configuracao_cronograma_producao: {
        Args: {
          p_equipe_disponivel: number
          p_horizonte_dias?: number
          p_trabalha_domingo: boolean
          p_trabalha_sabado: boolean
        }
        Returns: string
      }
      salvar_permissoes_usuario: {
        Args: { p_alteracoes: Json; p_user_id: string }
        Returns: undefined
      }
      salvar_planejamento_etapa_producao: {
        Args: {
          p_aceita_producao_proporcional?: boolean
          p_capacidade_diaria?: number
          p_data_inicio_desejada?: string
          p_data_limite?: string
          p_dependencias?: Json
          p_grupo_cronograma?: string
          p_pessoas_necessarias?: number
          p_processo_id: string
          p_sequencia?: number
        }
        Returns: string
      }
      send_visualizador_message: {
        Args: { p_message: string; p_requested_date?: string }
        Returns: string
      }
      send_visualizador_thread_message: {
        Args: { p_message: string; p_thread_id: string }
        Returns: undefined
      }
      start_user_message_thread: {
        Args: {
          p_message: string
          p_recipient_id: string
          p_requested_date?: string
        }
        Returns: string
      }
      usuario_tem_permissao_producao: {
        Args: { p_permissao: string }
        Returns: boolean
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
