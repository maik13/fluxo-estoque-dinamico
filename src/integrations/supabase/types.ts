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
      _backup_recovery_producao_20260912: {
        Row: {
          backed_up_at: string
          pk: string
          row_data: Json
          table_name: string
        }
        Insert: {
          backed_up_at?: string
          pk: string
          row_data: Json
          table_name: string
        }
        Update: {
          backed_up_at?: string
          pk?: string
          row_data?: Json
          table_name?: string
        }
        Relationships: []
      }
      action_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      appcontrole_usuarios_importacao: {
        Row: {
          ativo: boolean
          destino_user_id: string | null
          email: string
          erro: string | null
          migrado_em: string | null
          nome: string | null
          source_permissions: Json
          source_role: string | null
          source_user_id: string
          status: string
        }
        Insert: {
          ativo?: boolean
          destino_user_id?: string | null
          email: string
          erro?: string | null
          migrado_em?: string | null
          nome?: string | null
          source_permissions?: Json
          source_role?: string | null
          source_user_id: string
          status?: string
        }
        Update: {
          ativo?: boolean
          destino_user_id?: string | null
          email?: string
          erro?: string | null
          migrado_em?: string | null
          nome?: string | null
          source_permissions?: Json
          source_role?: string | null
          source_user_id?: string
          status?: string
        }
        Relationships: []
      }
      backup_inventory_movements_20260930_auditoria100: {
        Row: {
          created_at: string | null
          data_hora: string | null
          dedupe_key: string | null
          destinatario: string | null
          estoque_id: string | null
          id: string | null
          item_id: string | null
          item_snapshot: Json | null
          local_utilizacao_id: string | null
          observacoes: string | null
          quantidade: number | null
          quantidade_anterior: number | null
          quantidade_atual: number | null
          solicitacao_id: string | null
          tipo: string | null
          tipo_operacao_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_hora?: string | null
          dedupe_key?: string | null
          destinatario?: string | null
          estoque_id?: string | null
          id?: string | null
          item_id?: string | null
          item_snapshot?: Json | null
          local_utilizacao_id?: string | null
          observacoes?: string | null
          quantidade?: number | null
          quantidade_anterior?: number | null
          quantidade_atual?: number | null
          solicitacao_id?: string | null
          tipo?: string | null
          tipo_operacao_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_hora?: string | null
          dedupe_key?: string | null
          destinatario?: string | null
          estoque_id?: string | null
          id?: string | null
          item_id?: string | null
          item_snapshot?: Json | null
          local_utilizacao_id?: string | null
          observacoes?: string | null
          quantidade?: number | null
          quantidade_anterior?: number | null
          quantidade_atual?: number | null
          solicitacao_id?: string | null
          tipo?: string | null
          tipo_operacao_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_rh_colaboradores_pre_import_20260930: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          controla_ponto: boolean | null
          cpf_cnpj: string | null
          created_at: string | null
          data_admissao: string | null
          data_nascimento: string | null
          departamento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          hora_extra_gera_valor: boolean | null
          id: string | null
          importado_em: string | null
          jornada_id: string | null
          nome: string | null
          origem_id: string | null
          origem_sistema: string | null
          origem_user_id: string | null
          pis: string | null
          pista_ativo_legado: boolean | null
          rh_ativo: boolean | null
          rh_cadastrado: boolean | null
          salario: number | null
          telefone: string | null
          tipo_contrato: string | null
          updated_at: string | null
          user_id: string | null
          valor_contrato: number | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          controla_ponto?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          hora_extra_gera_valor?: boolean | null
          id?: string | null
          importado_em?: string | null
          jornada_id?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          origem_user_id?: string | null
          pis?: string | null
          pista_ativo_legado?: boolean | null
          rh_ativo?: boolean | null
          rh_cadastrado?: boolean | null
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_contrato?: number | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          controla_ponto?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          hora_extra_gera_valor?: boolean | null
          id?: string | null
          importado_em?: string | null
          jornada_id?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          origem_user_id?: string | null
          pis?: string | null
          pista_ativo_legado?: boolean | null
          rh_ativo?: boolean | null
          rh_cadastrado?: boolean | null
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_contrato?: number | null
        }
        Relationships: []
      }
      backup_rh_feriados_pre_import_20260930: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data: string | null
          id: string | null
          importado_em: string | null
          nome: string | null
          origem_id: string | null
          origem_sistema: string | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          importado_em?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          importado_em?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      backup_rh_jornadas_pre_import_20260930: {
        Row: {
          ativo: boolean | null
          carga_horaria_semanal: number | null
          created_at: string | null
          descricao: string | null
          domingo_entrada_1: string | null
          domingo_entrada_2: string | null
          domingo_saida_1: string | null
          domingo_saida_2: string | null
          feriado_entrada_1: string | null
          feriado_entrada_2: string | null
          feriado_saida_1: string | null
          feriado_saida_2: string | null
          id: string | null
          importado_em: string | null
          nome: string | null
          origem_id: string | null
          origem_sistema: string | null
          personalizada_para_colaborador_id: string | null
          quarta_entrada_1: string | null
          quarta_entrada_2: string | null
          quarta_saida_1: string | null
          quarta_saida_2: string | null
          quinta_entrada_1: string | null
          quinta_entrada_2: string | null
          quinta_saida_1: string | null
          quinta_saida_2: string | null
          sabado_entrada_1: string | null
          sabado_entrada_2: string | null
          sabado_saida_1: string | null
          sabado_saida_2: string | null
          segunda_entrada_1: string | null
          segunda_entrada_2: string | null
          segunda_saida_1: string | null
          segunda_saida_2: string | null
          sexta_entrada_1: string | null
          sexta_entrada_2: string | null
          sexta_saida_1: string | null
          sexta_saida_2: string | null
          terca_entrada_1: string | null
          terca_entrada_2: string | null
          terca_saida_1: string | null
          terca_saida_2: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          carga_horaria_semanal?: number | null
          created_at?: string | null
          descricao?: string | null
          domingo_entrada_1?: string | null
          domingo_entrada_2?: string | null
          domingo_saida_1?: string | null
          domingo_saida_2?: string | null
          feriado_entrada_1?: string | null
          feriado_entrada_2?: string | null
          feriado_saida_1?: string | null
          feriado_saida_2?: string | null
          id?: string | null
          importado_em?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          personalizada_para_colaborador_id?: string | null
          quarta_entrada_1?: string | null
          quarta_entrada_2?: string | null
          quarta_saida_1?: string | null
          quarta_saida_2?: string | null
          quinta_entrada_1?: string | null
          quinta_entrada_2?: string | null
          quinta_saida_1?: string | null
          quinta_saida_2?: string | null
          sabado_entrada_1?: string | null
          sabado_entrada_2?: string | null
          sabado_saida_1?: string | null
          sabado_saida_2?: string | null
          segunda_entrada_1?: string | null
          segunda_entrada_2?: string | null
          segunda_saida_1?: string | null
          segunda_saida_2?: string | null
          sexta_entrada_1?: string | null
          sexta_entrada_2?: string | null
          sexta_saida_1?: string | null
          sexta_saida_2?: string | null
          terca_entrada_1?: string | null
          terca_entrada_2?: string | null
          terca_saida_1?: string | null
          terca_saida_2?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          carga_horaria_semanal?: number | null
          created_at?: string | null
          descricao?: string | null
          domingo_entrada_1?: string | null
          domingo_entrada_2?: string | null
          domingo_saida_1?: string | null
          domingo_saida_2?: string | null
          feriado_entrada_1?: string | null
          feriado_entrada_2?: string | null
          feriado_saida_1?: string | null
          feriado_saida_2?: string | null
          id?: string | null
          importado_em?: string | null
          nome?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          personalizada_para_colaborador_id?: string | null
          quarta_entrada_1?: string | null
          quarta_entrada_2?: string | null
          quarta_saida_1?: string | null
          quarta_saida_2?: string | null
          quinta_entrada_1?: string | null
          quinta_entrada_2?: string | null
          quinta_saida_1?: string | null
          quinta_saida_2?: string | null
          sabado_entrada_1?: string | null
          sabado_entrada_2?: string | null
          sabado_saida_1?: string | null
          sabado_saida_2?: string | null
          segunda_entrada_1?: string | null
          segunda_entrada_2?: string | null
          segunda_saida_1?: string | null
          segunda_saida_2?: string | null
          sexta_entrada_1?: string | null
          sexta_entrada_2?: string | null
          sexta_saida_1?: string | null
          sexta_saida_2?: string | null
          terca_entrada_1?: string | null
          terca_entrada_2?: string | null
          terca_saida_1?: string | null
          terca_saida_2?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_rh_ponto_dias_pagos_pre_import_20260930: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data: string | null
          id: string | null
          importado_em: string | null
          origem_id: string | null
          origem_pago_por: string | null
          origem_sistema: string | null
          pago_em: string | null
          pago_por: string | null
          updated_at: string | null
          valor_adicionais: number | null
          valor_diaria: number | null
          valor_total: number | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          importado_em?: string | null
          origem_id?: string | null
          origem_pago_por?: string | null
          origem_sistema?: string | null
          pago_em?: string | null
          pago_por?: string | null
          updated_at?: string | null
          valor_adicionais?: number | null
          valor_diaria?: number | null
          valor_total?: number | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          importado_em?: string | null
          origem_id?: string | null
          origem_pago_por?: string | null
          origem_sistema?: string | null
          pago_em?: string | null
          pago_por?: string | null
          updated_at?: string | null
          valor_adicionais?: number | null
          valor_diaria?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      backup_rh_registros_ponto_pre_import_20260930: {
        Row: {
          adicional_noturno_snapshot: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          colaborador_id: string | null
          created_at: string | null
          criado_por: string | null
          data: string | null
          hora_entrada_1: string | null
          hora_entrada_2: string | null
          hora_entrada_3: string | null
          hora_saida_1: string | null
          hora_saida_2: string | null
          hora_saida_3: string | null
          horas_atraso_snapshot: number | null
          horas_extras_100_snapshot: number | null
          horas_extras_50_snapshot: number | null
          horas_falta_snapshot: number | null
          horas_trabalhadas_snapshot: number | null
          id: string | null
          importado_em: string | null
          is_domingo_snapshot: boolean | null
          is_feriado_snapshot: boolean | null
          observacao: string | null
          origem_aprovado_por: string | null
          origem_created_by: string | null
          origem_id: string | null
          origem_sistema: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adicional_noturno_snapshot?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string | null
          hora_entrada_1?: string | null
          hora_entrada_2?: string | null
          hora_entrada_3?: string | null
          hora_saida_1?: string | null
          hora_saida_2?: string | null
          hora_saida_3?: string | null
          horas_atraso_snapshot?: number | null
          horas_extras_100_snapshot?: number | null
          horas_extras_50_snapshot?: number | null
          horas_falta_snapshot?: number | null
          horas_trabalhadas_snapshot?: number | null
          id?: string | null
          importado_em?: string | null
          is_domingo_snapshot?: boolean | null
          is_feriado_snapshot?: boolean | null
          observacao?: string | null
          origem_aprovado_por?: string | null
          origem_created_by?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adicional_noturno_snapshot?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string | null
          hora_entrada_1?: string | null
          hora_entrada_2?: string | null
          hora_entrada_3?: string | null
          hora_saida_1?: string | null
          hora_saida_2?: string | null
          hora_saida_3?: string | null
          horas_atraso_snapshot?: number | null
          horas_extras_100_snapshot?: number | null
          horas_extras_50_snapshot?: number | null
          horas_falta_snapshot?: number | null
          horas_trabalhadas_snapshot?: number | null
          id?: string | null
          importado_em?: string | null
          is_domingo_snapshot?: boolean | null
          is_feriado_snapshot?: boolean | null
          observacao?: string | null
          origem_aprovado_por?: string | null
          origem_created_by?: string | null
          origem_id?: string | null
          origem_sistema?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backups_sistema: {
        Row: {
          criado_em: string
          descricao: string | null
          escopo: Json
          id: string
          nome: string
          schema_backup: string
          status: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          escopo?: Json
          id?: string
          nome: string
          schema_backup: string
          status?: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          escopo?: Json
          id?: string
          nome?: string
          schema_backup?: string
          status?: string
        }
        Relationships: []
      }
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
      financeiro_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string
          id: string
          lancamento_id: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade: string
          entidade_id: string
          id?: string
          lancamento_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string
          entidade_id?: string
          id?: string
          lancamento_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      financeiro_categoria_subcategorias: {
        Row: {
          categoria_id: string
          created_at: string
          origem_planilha: boolean
          subcategoria_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          origem_planilha?: boolean
          subcategoria_id: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          origem_planilha?: boolean
          subcategoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_categoria_subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_categoria_subcategorias_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          observacao: string | null
          ordem: number
          origem_planilha: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          ordem?: number
          origem_planilha?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          ordem?: number
          origem_planilha?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_conciliacoes: {
        Row: {
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string
          created_at: string
          data: string
          data_prevista: string | null
          estava_previsto: boolean | null
          historico_beneficiario: string
          id: string
          lancamento_id: string | null
          prazo_regularizacao: string | null
          registrado_por_id: string | null
          registrado_por_nome: string | null
          responsavel_regularizacao: string | null
          tipo: string
          tratamento_observacao: string | null
          tratamento_status: string
          updated_at: string
          valor: number
          valor_previsto: number | null
        }
        Insert: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id: string
          created_at?: string
          data: string
          data_prevista?: string | null
          estava_previsto?: boolean | null
          historico_beneficiario: string
          id?: string
          lancamento_id?: string | null
          prazo_regularizacao?: string | null
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          responsavel_regularizacao?: string | null
          tipo: string
          tratamento_observacao?: string | null
          tratamento_status?: string
          updated_at?: string
          valor: number
          valor_previsto?: number | null
        }
        Update: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          data_prevista?: string | null
          estava_previsto?: boolean | null
          historico_beneficiario?: string
          id?: string
          lancamento_id?: string | null
          prazo_regularizacao?: string | null
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          responsavel_regularizacao?: string | null
          tipo?: string
          tratamento_observacao?: string | null
          tratamento_status?: string
          updated_at?: string
          valor?: number
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_conciliacoes_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_conciliacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_conciliacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pagina54_exportacao_pendente"
            referencedColumns: ["lancamento_id"]
          },
        ]
      }
      financeiro_contas_bancarias: {
        Row: {
          ativa: boolean
          banco: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string | null
        }
        Insert: {
          ativa?: boolean
          banco: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string | null
        }
        Update: {
          ativa?: boolean
          banco?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string | null
        }
        Relationships: []
      }
      financeiro_importacao_pagina54: {
        Row: {
          aba: string
          anotacao: string | null
          autor_ultima_alteracao: string | null
          bb_invest_original: string | null
          bb_original: string | null
          categoria_original: string | null
          cores_originais: Json
          credito_original: string | null
          data_posicao_original: string | null
          data_prevista_original: string | null
          data_realizada_original: string | null
          debito_original: string | null
          descricao: string | null
          id: string
          importado_em: string
          integracao_id: string | null
          inter_invest_original: string | null
          inter_original: string | null
          linha: number
          motivos_revisao: Json
          origem_alteracao: string | null
          resultado_original: string | null
          revisao_pendente: boolean
          saldo_dia_original: string | null
          saldo_original: string | null
          sicoob_invest_original: string | null
          sicoob_original: string | null
          sicredi_original: string | null
          sinalizacao_cor: string | null
          situacao: string | null
          spreadsheet_id: string
          spreadsheet_titulo: string | null
          subcategoria_original: string | null
          sync_em: string | null
          sync_erro: string | null
          sync_status: string
          ultima_atualizacao_planilha: string | null
          valor_a: string | null
          valores_originais: Json
        }
        Insert: {
          aba?: string
          anotacao?: string | null
          autor_ultima_alteracao?: string | null
          bb_invest_original?: string | null
          bb_original?: string | null
          categoria_original?: string | null
          cores_originais?: Json
          credito_original?: string | null
          data_posicao_original?: string | null
          data_prevista_original?: string | null
          data_realizada_original?: string | null
          debito_original?: string | null
          descricao?: string | null
          id?: string
          importado_em?: string
          integracao_id?: string | null
          inter_invest_original?: string | null
          inter_original?: string | null
          linha: number
          motivos_revisao?: Json
          origem_alteracao?: string | null
          resultado_original?: string | null
          revisao_pendente?: boolean
          saldo_dia_original?: string | null
          saldo_original?: string | null
          sicoob_invest_original?: string | null
          sicoob_original?: string | null
          sicredi_original?: string | null
          sinalizacao_cor?: string | null
          situacao?: string | null
          spreadsheet_id: string
          spreadsheet_titulo?: string | null
          subcategoria_original?: string | null
          sync_em?: string | null
          sync_erro?: string | null
          sync_status?: string
          ultima_atualizacao_planilha?: string | null
          valor_a?: string | null
          valores_originais?: Json
        }
        Update: {
          aba?: string
          anotacao?: string | null
          autor_ultima_alteracao?: string | null
          bb_invest_original?: string | null
          bb_original?: string | null
          categoria_original?: string | null
          cores_originais?: Json
          credito_original?: string | null
          data_posicao_original?: string | null
          data_prevista_original?: string | null
          data_realizada_original?: string | null
          debito_original?: string | null
          descricao?: string | null
          id?: string
          importado_em?: string
          integracao_id?: string | null
          inter_invest_original?: string | null
          inter_original?: string | null
          linha?: number
          motivos_revisao?: Json
          origem_alteracao?: string | null
          resultado_original?: string | null
          revisao_pendente?: boolean
          saldo_dia_original?: string | null
          saldo_original?: string | null
          sicoob_invest_original?: string | null
          sicoob_original?: string | null
          sicredi_original?: string | null
          sinalizacao_cor?: string | null
          situacao?: string | null
          spreadsheet_id?: string
          spreadsheet_titulo?: string | null
          subcategoria_original?: string | null
          sync_em?: string | null
          sync_erro?: string | null
          sync_status?: string
          ultima_atualizacao_planilha?: string | null
          valor_a?: string | null
          valores_originais?: Json
        }
        Relationships: []
      }
      financeiro_lancamentos: {
        Row: {
          categoria: string | null
          created_at: string
          credito_original: string | null
          criado_por_id: string | null
          data_prevista: string | null
          data_realizada: string | null
          debito_original: string | null
          descricao: string
          descricao_original: string | null
          id: string
          importacao_pagina54_id: string | null
          liberado_programacao_em: string | null
          liberado_programacao_por_id: string | null
          liberado_programacao_por_nome: string | null
          motivos_revisao: Json
          necessidade_id: string | null
          numero: number
          observacoes: string | null
          origem_id: string | null
          origem_tipo: string | null
          pagina54_autor_alteracao: string | null
          pagina54_integracao_id: string | null
          pagina54_precisa_exportar: boolean
          pagina54_sync_em: string | null
          pagina54_sync_erro: string | null
          pagina54_sync_status: string
          pagina54_ultima_atualizacao: string | null
          pagina54_ultima_origem: string | null
          parcela_numero: number
          parcela_total: number
          planilha_linha: number | null
          producao_projeto_id: string | null
          projeto_centro_custo: string | null
          revisao_pendente: boolean
          saldo_original: string | null
          sinalizacao_cor: string | null
          situacao_original: string | null
          status: string
          subcategoria: string | null
          tipo: string
          updated_at: string
          valor_previsto: number | null
          valor_realizado: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          credito_original?: string | null
          criado_por_id?: string | null
          data_prevista?: string | null
          data_realizada?: string | null
          debito_original?: string | null
          descricao: string
          descricao_original?: string | null
          id?: string
          importacao_pagina54_id?: string | null
          liberado_programacao_em?: string | null
          liberado_programacao_por_id?: string | null
          liberado_programacao_por_nome?: string | null
          motivos_revisao?: Json
          necessidade_id?: string | null
          numero?: number
          observacoes?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          pagina54_autor_alteracao?: string | null
          pagina54_integracao_id?: string | null
          pagina54_precisa_exportar?: boolean
          pagina54_sync_em?: string | null
          pagina54_sync_erro?: string | null
          pagina54_sync_status?: string
          pagina54_ultima_atualizacao?: string | null
          pagina54_ultima_origem?: string | null
          parcela_numero?: number
          parcela_total?: number
          planilha_linha?: number | null
          producao_projeto_id?: string | null
          projeto_centro_custo?: string | null
          revisao_pendente?: boolean
          saldo_original?: string | null
          sinalizacao_cor?: string | null
          situacao_original?: string | null
          status?: string
          subcategoria?: string | null
          tipo: string
          updated_at?: string
          valor_previsto?: number | null
          valor_realizado?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          credito_original?: string | null
          criado_por_id?: string | null
          data_prevista?: string | null
          data_realizada?: string | null
          debito_original?: string | null
          descricao?: string
          descricao_original?: string | null
          id?: string
          importacao_pagina54_id?: string | null
          liberado_programacao_em?: string | null
          liberado_programacao_por_id?: string | null
          liberado_programacao_por_nome?: string | null
          motivos_revisao?: Json
          necessidade_id?: string | null
          numero?: number
          observacoes?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          pagina54_autor_alteracao?: string | null
          pagina54_integracao_id?: string | null
          pagina54_precisa_exportar?: boolean
          pagina54_sync_em?: string | null
          pagina54_sync_erro?: string | null
          pagina54_sync_status?: string
          pagina54_ultima_atualizacao?: string | null
          pagina54_ultima_origem?: string | null
          parcela_numero?: number
          parcela_total?: number
          planilha_linha?: number | null
          producao_projeto_id?: string | null
          projeto_centro_custo?: string | null
          revisao_pendente?: boolean
          saldo_original?: string | null
          sinalizacao_cor?: string | null
          situacao_original?: string | null
          status?: string
          subcategoria?: string | null
          tipo?: string
          updated_at?: string
          valor_previsto?: number | null
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_importacao_pagina54_id_fkey"
            columns: ["importacao_pagina54_id"]
            isOneToOne: false
            referencedRelation: "financeiro_importacao_pagina54"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_necessidade_id_fkey"
            columns: ["necessidade_id"]
            isOneToOne: false
            referencedRelation: "financeiro_necessidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_producao_projeto_id_fkey"
            columns: ["producao_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_necessidade_historico: {
        Row: {
          alteracao: string
          created_at: string
          id: string
          necessidade_id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          valor_previsto: number | null
        }
        Insert: {
          alteracao: string
          created_at?: string
          id?: string
          necessidade_id: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          valor_previsto?: number | null
        }
        Update: {
          alteracao?: string
          created_at?: string
          id?: string
          necessidade_id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_necessidade_historico_necessidade_id_fkey"
            columns: ["necessidade_id"]
            isOneToOne: false
            referencedRelation: "financeiro_necessidades"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_necessidades: {
        Row: {
          area_solicitante: string | null
          base_estimativa: string | null
          categoria: string | null
          created_at: string
          criado_automaticamente: boolean
          criado_por_id: string | null
          criado_por_nome: string | null
          data_identificacao: string
          data_necessidade: string | null
          data_prevista_desembolso: string | null
          descricao: string
          especificacao: string | null
          estimativa_incompleta: boolean
          id: string
          item_id: string | null
          justificativa: string | null
          numero: number
          ordem_producao_id: string | null
          origem_modulo: string | null
          origem_tipo: string
          processo_id: string | null
          producao_projeto_id: string | null
          projeto_centro_custo: string | null
          quantidade: number | null
          registro_katia: string | null
          registro_katia_em: string | null
          requisicao_compra_id: string | null
          solicitacao_material_id: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status: string
          subcategoria: string | null
          unidade: string | null
          updated_at: string
          updated_by: string | null
          urgencia: string
          valor_estimado: number | null
        }
        Insert: {
          area_solicitante?: string | null
          base_estimativa?: string | null
          categoria?: string | null
          created_at?: string
          criado_automaticamente?: boolean
          criado_por_id?: string | null
          criado_por_nome?: string | null
          data_identificacao?: string
          data_necessidade?: string | null
          data_prevista_desembolso?: string | null
          descricao: string
          especificacao?: string | null
          estimativa_incompleta?: boolean
          id?: string
          item_id?: string | null
          justificativa?: string | null
          numero?: number
          ordem_producao_id?: string | null
          origem_modulo?: string | null
          origem_tipo?: string
          processo_id?: string | null
          producao_projeto_id?: string | null
          projeto_centro_custo?: string | null
          quantidade?: number | null
          registro_katia?: string | null
          registro_katia_em?: string | null
          requisicao_compra_id?: string | null
          solicitacao_material_id?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: string
          subcategoria?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          urgencia?: string
          valor_estimado?: number | null
        }
        Update: {
          area_solicitante?: string | null
          base_estimativa?: string | null
          categoria?: string | null
          created_at?: string
          criado_automaticamente?: boolean
          criado_por_id?: string | null
          criado_por_nome?: string | null
          data_identificacao?: string
          data_necessidade?: string | null
          data_prevista_desembolso?: string | null
          descricao?: string
          especificacao?: string | null
          estimativa_incompleta?: boolean
          id?: string
          item_id?: string | null
          justificativa?: string | null
          numero?: number
          ordem_producao_id?: string | null
          origem_modulo?: string | null
          origem_tipo?: string
          processo_id?: string | null
          producao_projeto_id?: string | null
          projeto_centro_custo?: string | null
          quantidade?: number | null
          registro_katia?: string | null
          registro_katia_em?: string | null
          requisicao_compra_id?: string | null
          solicitacao_material_id?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: string
          subcategoria?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          urgencia?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_necessidades_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_necessidades_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_necessidades_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_necessidades_producao_projeto_id_fkey"
            columns: ["producao_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_necessidades_requisicao_compra_id_fkey"
            columns: ["requisicao_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_necessidades_solicitacao_material_id_fkey"
            columns: ["solicitacao_material_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_material"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pc_parcelas: {
        Row: {
          conciliado: boolean
          created_at: string
          data_conciliado: string | null
          data_pago: string | null
          data_programada: string | null
          id: string
          lancamento_id: string | null
          observacoes: string | null
          pago: boolean
          parcela_numero: number
          pedido_compra_formal_id: string
          programado_no_banco: boolean
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          conciliado?: boolean
          created_at?: string
          data_conciliado?: string | null
          data_pago?: string | null
          data_programada?: string | null
          id?: string
          lancamento_id?: string | null
          observacoes?: string | null
          pago?: boolean
          parcela_numero: number
          pedido_compra_formal_id: string
          programado_no_banco?: boolean
          updated_at?: string
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          conciliado?: boolean
          created_at?: string
          data_conciliado?: string | null
          data_pago?: string | null
          data_programada?: string | null
          id?: string
          lancamento_id?: string | null
          observacoes?: string | null
          pago?: boolean
          parcela_numero?: number
          pedido_compra_formal_id?: string
          programado_no_banco?: boolean
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pc_parcelas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pc_parcelas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pagina54_exportacao_pendente"
            referencedColumns: ["lancamento_id"]
          },
          {
            foreignKeyName: "financeiro_pc_parcelas_pedido_compra_formal_id_fkey"
            columns: ["pedido_compra_formal_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pedidos_compra_formais"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pedidos_compra_formais: {
        Row: {
          aprovacao_evidencia: string | null
          aprovacao_mauro_em: string | null
          compromisso_katia_em: string | null
          compromisso_status: string | null
          condicao_pagamento: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome: string | null
          descricao: string
          enviado_guto_em: string | null
          fornecedor: string
          fornecedor_contato: string | null
          fornecedor_identificacao: string | null
          frete_custos_adicionais: number
          id: string
          local_entrega: string | null
          necessidade_id: string | null
          numero: number
          prazo_entrega: string | null
          recebimento_divergencias: string | null
          recebimento_em: string | null
          recebimento_por: string | null
          requisicao_compra_id: string
          status: string
          updated_at: string
          valor_itens: number
          valor_total: number | null
        }
        Insert: {
          aprovacao_evidencia?: string | null
          aprovacao_mauro_em?: string | null
          compromisso_katia_em?: string | null
          compromisso_status?: string | null
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          descricao: string
          enviado_guto_em?: string | null
          fornecedor: string
          fornecedor_contato?: string | null
          fornecedor_identificacao?: string | null
          frete_custos_adicionais?: number
          id?: string
          local_entrega?: string | null
          necessidade_id?: string | null
          numero?: number
          prazo_entrega?: string | null
          recebimento_divergencias?: string | null
          recebimento_em?: string | null
          recebimento_por?: string | null
          requisicao_compra_id: string
          status?: string
          updated_at?: string
          valor_itens?: number
          valor_total?: number | null
        }
        Update: {
          aprovacao_evidencia?: string | null
          aprovacao_mauro_em?: string | null
          compromisso_katia_em?: string | null
          compromisso_status?: string | null
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          descricao?: string
          enviado_guto_em?: string | null
          fornecedor?: string
          fornecedor_contato?: string | null
          fornecedor_identificacao?: string | null
          frete_custos_adicionais?: number
          id?: string
          local_entrega?: string | null
          necessidade_id?: string | null
          numero?: number
          prazo_entrega?: string | null
          recebimento_divergencias?: string | null
          recebimento_em?: string | null
          recebimento_por?: string | null
          requisicao_compra_id?: string
          status?: string
          updated_at?: string
          valor_itens?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pedidos_compra_formais_necessidade_id_fkey"
            columns: ["necessidade_id"]
            isOneToOne: false
            referencedRelation: "financeiro_necessidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pedidos_compra_formais_requisicao_compra_id_fkey"
            columns: ["requisicao_compra_id"]
            isOneToOne: true
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_posicoes_diarias: {
        Row: {
          conta_bancaria_id: string
          created_at: string
          data: string
          entradas_realizadas: number
          id: string
          pagamentos_programados_nao_liquidados: number
          pendencias_proximo_dia: string | null
          recebimentos_previstos_nao_realizados: number
          responsavel: string
          saidas_nao_previstas_diferencas: number
          saidas_realizadas: number
          saldo_final_bancario: number
          saldo_financeiro_gerencial: number
          saldo_inicial_bancario: number
          updated_at: string
        }
        Insert: {
          conta_bancaria_id: string
          created_at?: string
          data: string
          entradas_realizadas?: number
          id?: string
          pagamentos_programados_nao_liquidados?: number
          pendencias_proximo_dia?: string | null
          recebimentos_previstos_nao_realizados?: number
          responsavel?: string
          saidas_nao_previstas_diferencas?: number
          saidas_realizadas?: number
          saldo_final_bancario?: number
          saldo_financeiro_gerencial?: number
          saldo_inicial_bancario?: number
          updated_at?: string
        }
        Update: {
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          entradas_realizadas?: number
          id?: string
          pagamentos_programados_nao_liquidados?: number
          pendencias_proximo_dia?: string | null
          recebimentos_previstos_nao_realizados?: number
          responsavel?: string
          saidas_nao_previstas_diferencas?: number
          saidas_realizadas?: number
          saldo_final_bancario?: number
          saldo_financeiro_gerencial?: number
          saldo_inicial_bancario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_posicoes_diarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_programacoes: {
        Row: {
          banco_conta: string | null
          beneficiario: string
          categoria: string | null
          comprovante_path: string | null
          created_at: string
          data_programada: string
          forma_pagamento: string | null
          id: string
          lancamento_id: string
          liberado_por_katia_em: string | null
          observacao: string | null
          parcela_id: string | null
          pedido_compra_formal_id: string | null
          programado_por_guto_em: string | null
          projeto_centro_custo: string | null
          registrado_por_id: string | null
          registrado_por_nome: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          banco_conta?: string | null
          beneficiario: string
          categoria?: string | null
          comprovante_path?: string | null
          created_at?: string
          data_programada: string
          forma_pagamento?: string | null
          id?: string
          lancamento_id: string
          liberado_por_katia_em?: string | null
          observacao?: string | null
          parcela_id?: string | null
          pedido_compra_formal_id?: string | null
          programado_por_guto_em?: string | null
          projeto_centro_custo?: string | null
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          status?: string
          updated_at?: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          banco_conta?: string | null
          beneficiario?: string
          categoria?: string | null
          comprovante_path?: string | null
          created_at?: string
          data_programada?: string
          forma_pagamento?: string | null
          id?: string
          lancamento_id?: string
          liberado_por_katia_em?: string | null
          observacao?: string | null
          parcela_id?: string | null
          pedido_compra_formal_id?: string | null
          programado_por_guto_em?: string | null
          projeto_centro_custo?: string | null
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_programacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_programacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pagina54_exportacao_pendente"
            referencedColumns: ["lancamento_id"]
          },
          {
            foreignKeyName: "financeiro_programacoes_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pc_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_programacoes_pedido_compra_formal_id_fkey"
            columns: ["pedido_compra_formal_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pedidos_compra_formais"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_subcategorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          observacao: string | null
          ordem: number
          origem_planilha: boolean
          revisao_pendente: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          ordem?: number
          origem_planilha?: boolean
          revisao_pendente?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          ordem?: number
          origem_planilha?: boolean
          revisao_pendente?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movement_repair_audit_20260922: {
        Row: {
          estoque_id: string | null
          item_id: string
          movement_id: string
          new_quantidade_anterior: number
          new_quantidade_atual: number
          old_quantidade_anterior: number | null
          old_quantidade_atual: number | null
          reason: string
          repair_method: string
          repaired_at: string
        }
        Insert: {
          estoque_id?: string | null
          item_id: string
          movement_id: string
          new_quantidade_anterior: number
          new_quantidade_atual: number
          old_quantidade_anterior?: number | null
          old_quantidade_atual?: number | null
          reason: string
          repair_method: string
          repaired_at?: string
        }
        Update: {
          estoque_id?: string | null
          item_id?: string
          movement_id?: string
          new_quantidade_anterior?: number
          new_quantidade_atual?: number
          old_quantidade_anterior?: number | null
          old_quantidade_atual?: number | null
          reason?: string
          repair_method?: string
          repaired_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movement_repair_audit_20260922_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movement_repair_audit_20260922_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movement_repair_audit_20260930: {
        Row: {
          estoque_id: string | null
          item_id: string
          movement_id: string
          new_quantidade_anterior: number
          new_quantidade_atual: number
          old_quantidade_anterior: number | null
          old_quantidade_atual: number | null
          reason: string
          repair_method: string
          repaired_at: string
        }
        Insert: {
          estoque_id?: string | null
          item_id: string
          movement_id: string
          new_quantidade_anterior: number
          new_quantidade_atual: number
          old_quantidade_anterior?: number | null
          old_quantidade_atual?: number | null
          reason: string
          repair_method: string
          repaired_at?: string
        }
        Update: {
          estoque_id?: string | null
          item_id?: string
          movement_id?: string
          new_quantidade_anterior?: number
          new_quantidade_atual?: number
          old_quantidade_anterior?: number | null
          old_quantidade_atual?: number | null
          reason?: string
          repair_method?: string
          repaired_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movement_repair_audit_20260930_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movement_repair_audit_20260930_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_product_count_repair_audit_20260923: {
        Row: {
          codigo_barras: number
          estoque_id: string
          item_id: string
          movement_id: string | null
          nome: string
          repaired_at: string
          saldo_anterior: number
          saldo_inventario: number
        }
        Insert: {
          codigo_barras: number
          estoque_id: string
          item_id: string
          movement_id?: string | null
          nome: string
          repaired_at?: string
          saldo_anterior: number
          saldo_inventario: number
        }
        Update: {
          codigo_barras?: number
          estoque_id?: string
          item_id?: string
          movement_id?: string | null
          nome?: string
          repaired_at?: string
          saldo_anterior?: number
          saldo_inventario?: number
        }
        Relationships: []
      }
      inventory_product_count_repair_audit_20260923_v2: {
        Row: {
          codigo_barras: number
          estoque_id: string
          item_id: string
          movement_id: string | null
          nome: string
          repaired_at: string
          saldo_anterior: number
          saldo_inventario: number
        }
        Insert: {
          codigo_barras: number
          estoque_id: string
          item_id: string
          movement_id?: string | null
          nome: string
          repaired_at?: string
          saldo_anterior: number
          saldo_inventario: number
        }
        Update: {
          codigo_barras?: number
          estoque_id?: string
          item_id?: string
          movement_id?: string | null
          nome?: string
          repaired_at?: string
          saldo_anterior?: number
          saldo_inventario?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_count_repair_audit_20260923__movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_count_repair_audit_20260923_v_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_count_repair_audit_20260923_v2_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_tool_unit_repair_audit_20260923: {
        Row: {
          codigo_barras: number | null
          item_id: string
          movement_id: string
          nome: string | null
          quantidade_anterior_original: number | null
          quantidade_atual_original: number | null
          quantidade_original: number | null
          repaired_at: string
          tipo: string | null
        }
        Insert: {
          codigo_barras?: number | null
          item_id: string
          movement_id: string
          nome?: string | null
          quantidade_anterior_original?: number | null
          quantidade_atual_original?: number | null
          quantidade_original?: number | null
          repaired_at?: string
          tipo?: string | null
        }
        Update: {
          codigo_barras?: number | null
          item_id?: string
          movement_id?: string
          nome?: string | null
          quantidade_anterior_original?: number | null
          quantidade_atual_original?: number | null
          quantidade_original?: number | null
          repaired_at?: string
          tipo?: string | null
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
          imobilizado: boolean
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
          imobilizado?: boolean
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
          imobilizado?: boolean
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
          aprovacao_executiva_em: string | null
          aprovacao_executiva_por: string | null
          condicao_pagamento: string | null
          conferencia_estoque: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome: string
          data_conclusao: string | null
          data_limite_compra: string | null
          data_necessaria: string | null
          data_pedido: string
          editado: boolean
          editado_em: string | null
          editado_por: string | null
          especificacao_confirmada_em: string | null
          especificacao_confirmada_por: string | null
          especificacao_tecnica: string | null
          estoque_conferido_em: string | null
          estoque_conferido_por: string | null
          estoque_id: string | null
          fornecedores_consultados: string | null
          frete_custos_adicionais: number | null
          id: string
          impacto_financeiro: string | null
          impacto_financeiro_registrado_em: string | null
          impacto_financeiro_registrado_por: string | null
          integrar_financeiro: boolean
          lead_time_dias: number | null
          numero: number
          observacoes: string | null
          pn_origem_id: string | null
          projeto_centro_custo: string | null
          solicitacao_material_id: string | null
          solicitacao_material_numero: number | null
          status: string
          status_financeiro_rc: string | null
          updated_at: string
          valor_estimado_cotado: number | null
        }
        Insert: {
          aprovacao_executiva_em?: string | null
          aprovacao_executiva_por?: string | null
          condicao_pagamento?: string | null
          conferencia_estoque?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome: string
          data_conclusao?: string | null
          data_limite_compra?: string | null
          data_necessaria?: string | null
          data_pedido?: string
          editado?: boolean
          editado_em?: string | null
          editado_por?: string | null
          especificacao_confirmada_em?: string | null
          especificacao_confirmada_por?: string | null
          especificacao_tecnica?: string | null
          estoque_conferido_em?: string | null
          estoque_conferido_por?: string | null
          estoque_id?: string | null
          fornecedores_consultados?: string | null
          frete_custos_adicionais?: number | null
          id?: string
          impacto_financeiro?: string | null
          impacto_financeiro_registrado_em?: string | null
          impacto_financeiro_registrado_por?: string | null
          integrar_financeiro?: boolean
          lead_time_dias?: number | null
          numero?: number
          observacoes?: string | null
          pn_origem_id?: string | null
          projeto_centro_custo?: string | null
          solicitacao_material_id?: string | null
          solicitacao_material_numero?: number | null
          status?: string
          status_financeiro_rc?: string | null
          updated_at?: string
          valor_estimado_cotado?: number | null
        }
        Update: {
          aprovacao_executiva_em?: string | null
          aprovacao_executiva_por?: string | null
          condicao_pagamento?: string | null
          conferencia_estoque?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string
          data_conclusao?: string | null
          data_limite_compra?: string | null
          data_necessaria?: string | null
          data_pedido?: string
          editado?: boolean
          editado_em?: string | null
          editado_por?: string | null
          especificacao_confirmada_em?: string | null
          especificacao_confirmada_por?: string | null
          especificacao_tecnica?: string | null
          estoque_conferido_em?: string | null
          estoque_conferido_por?: string | null
          estoque_id?: string | null
          fornecedores_consultados?: string | null
          frete_custos_adicionais?: number | null
          id?: string
          impacto_financeiro?: string | null
          impacto_financeiro_registrado_em?: string | null
          impacto_financeiro_registrado_por?: string | null
          integrar_financeiro?: boolean
          lead_time_dias?: number | null
          numero?: number
          observacoes?: string | null
          pn_origem_id?: string | null
          projeto_centro_custo?: string | null
          solicitacao_material_id?: string | null
          solicitacao_material_numero?: number | null
          status?: string
          status_financeiro_rc?: string | null
          updated_at?: string
          valor_estimado_cotado?: number | null
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
            foreignKeyName: "pedidos_compra_pn_origem_id_fkey"
            columns: ["pn_origem_id"]
            isOneToOne: false
            referencedRelation: "financeiro_necessidades"
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
          pode_acessar_financeiro: boolean
          pode_acessar_gerencial: boolean | null
          pode_acessar_projetos: boolean | null
          pode_apontar_producao: boolean
          pode_aprovar_financeiro: boolean
          pode_cadastrar_itens: boolean
          pode_conciliar_financeiro: boolean
          pode_conferir_producao: boolean
          pode_configurar_producao: boolean
          pode_devolver_material: boolean
          pode_editar_itens: boolean
          pode_editar_movimentacoes: boolean
          pode_excluir_itens: boolean
          pode_gerenciar_configuracoes: boolean
          pode_gerenciar_financeiro: boolean
          pode_gerenciar_usuarios: boolean
          pode_pedido_compra: boolean
          pode_programar_financeiro: boolean
          pode_registrar_entrada: boolean
          pode_registrar_movimentacoes: boolean
          pode_registrar_saida: boolean
          pode_solicitacao_material: boolean
          pode_solicitar_material: boolean
          pode_transferir: boolean
          pode_ver_bi_producao: boolean
          pode_ver_relatorios: boolean
          pode_ver_relatorios_financeiro: boolean
          tipo_usuario: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pode_acessar_financeiro?: boolean
          pode_acessar_gerencial?: boolean | null
          pode_acessar_projetos?: boolean | null
          pode_apontar_producao?: boolean
          pode_aprovar_financeiro?: boolean
          pode_cadastrar_itens?: boolean
          pode_conciliar_financeiro?: boolean
          pode_conferir_producao?: boolean
          pode_configurar_producao?: boolean
          pode_devolver_material?: boolean
          pode_editar_itens?: boolean
          pode_editar_movimentacoes?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_financeiro?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_pedido_compra?: boolean
          pode_programar_financeiro?: boolean
          pode_registrar_entrada?: boolean
          pode_registrar_movimentacoes?: boolean
          pode_registrar_saida?: boolean
          pode_solicitacao_material?: boolean
          pode_solicitar_material?: boolean
          pode_transferir?: boolean
          pode_ver_bi_producao?: boolean
          pode_ver_relatorios?: boolean
          pode_ver_relatorios_financeiro?: boolean
          tipo_usuario: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pode_acessar_financeiro?: boolean
          pode_acessar_gerencial?: boolean | null
          pode_acessar_projetos?: boolean | null
          pode_apontar_producao?: boolean
          pode_aprovar_financeiro?: boolean
          pode_cadastrar_itens?: boolean
          pode_conciliar_financeiro?: boolean
          pode_conferir_producao?: boolean
          pode_configurar_producao?: boolean
          pode_devolver_material?: boolean
          pode_editar_itens?: boolean
          pode_editar_movimentacoes?: boolean
          pode_excluir_itens?: boolean
          pode_gerenciar_configuracoes?: boolean
          pode_gerenciar_financeiro?: boolean
          pode_gerenciar_usuarios?: boolean
          pode_pedido_compra?: boolean
          pode_programar_financeiro?: boolean
          pode_registrar_entrada?: boolean
          pode_registrar_movimentacoes?: boolean
          pode_registrar_saida?: boolean
          pode_solicitacao_material?: boolean
          pode_solicitar_material?: boolean
          pode_transferir?: boolean
          pode_ver_bi_producao?: boolean
          pode_ver_relatorios?: boolean
          pode_ver_relatorios_financeiro?: boolean
          tipo_usuario?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_acervo_cenografico: {
        Row: {
          ano_origem: string | null
          ativo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          especificacoes: string | null
          fonte: string | null
          fonte_linha: number | null
          historico: string | null
          id: string
          nome: string
          observacoes: string | null
          quantidade_estoque: number
          status: string | null
          updated_at: string
        }
        Insert: {
          ano_origem?: string | null
          ativo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          especificacoes?: string | null
          fonte?: string | null
          fonte_linha?: number | null
          historico?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          quantidade_estoque?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          ano_origem?: string | null
          ativo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          especificacoes?: string | null
          fonte?: string | null
          fonte_linha?: number | null
          historico?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          quantidade_estoque?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      producao_acervo_reservas: {
        Row: {
          acervo_id: string
          created_at: string
          criado_por_id: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          observacoes: string | null
          project_group_id: string
          quantidade: number
          status: string
          updated_at: string
        }
        Insert: {
          acervo_id: string
          created_at?: string
          criado_por_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          project_group_id: string
          quantidade: number
          status?: string
          updated_at?: string
        }
        Update: {
          acervo_id?: string
          created_at?: string
          criado_por_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          project_group_id?: string
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_acervo_reservas_acervo_id_fkey"
            columns: ["acervo_id"]
            isOneToOne: false
            referencedRelation: "producao_acervo_cenografico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_acervo_reservas_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
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
          duracao_minutos_snapshot: number | null
          id: string
          inicio_individual: string | null
          jornada_diaria_minutos_snapshot: number | null
          membro_id: string
          minutos_improdutivos_snapshot: number | null
          minutos_produtivos_snapshot: number | null
          nome_snapshot: string
          termino_individual: string | null
          valor_hora_snapshot: number | null
        }
        Insert: {
          apontamento_id: string
          created_at?: string
          duracao_minutos_snapshot?: number | null
          id?: string
          inicio_individual?: string | null
          jornada_diaria_minutos_snapshot?: number | null
          membro_id: string
          minutos_improdutivos_snapshot?: number | null
          minutos_produtivos_snapshot?: number | null
          nome_snapshot: string
          termino_individual?: string | null
          valor_hora_snapshot?: number | null
        }
        Update: {
          apontamento_id?: string
          created_at?: string
          duracao_minutos_snapshot?: number | null
          id?: string
          inicio_individual?: string | null
          jornada_diaria_minutos_snapshot?: number | null
          membro_id?: string
          minutos_improdutivos_snapshot?: number | null
          minutos_produtivos_snapshot?: number | null
          nome_snapshot?: string
          termino_individual?: string | null
          valor_hora_snapshot?: number | null
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
          demao_numero: number | null
          duracao_minutos: number
          fechamento_retroativo: boolean
          id: string
          inicio: string
          jornada_op_id: string | null
          jornada_total_equipe_minutos_snapshot: number | null
          local_tipo: string
          minutos_improdutivos: number
          minutos_produtivos: number | null
          motivo_cancelamento: string | null
          motivo_improdutivo: string | null
          motivo_regularizacao: string | null
          motivo_ultima_retificacao: string | null
          observacoes: string | null
          ordem_producao_id: string | null
          processo_id: string | null
          projeto_local_id: string | null
          quantidade_produzida: number | null
          regularizado_em: string | null
          regularizado_por_id: string | null
          regularizado_por_nome_snapshot: string | null
          retificacoes_count: number
          retificado_em: string | null
          retificado_por_id: string | null
          retificado_por_nome_snapshot: string | null
          status: string
          tarefa_id: string
          termino: string
          termino_real_em: string | null
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
          demao_numero?: number | null
          duracao_minutos: number
          fechamento_retroativo?: boolean
          id?: string
          inicio: string
          jornada_op_id?: string | null
          jornada_total_equipe_minutos_snapshot?: number | null
          local_tipo: string
          minutos_improdutivos?: number
          minutos_produtivos?: number | null
          motivo_cancelamento?: string | null
          motivo_improdutivo?: string | null
          motivo_regularizacao?: string | null
          motivo_ultima_retificacao?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          processo_id?: string | null
          projeto_local_id?: string | null
          quantidade_produzida?: number | null
          regularizado_em?: string | null
          regularizado_por_id?: string | null
          regularizado_por_nome_snapshot?: string | null
          retificacoes_count?: number
          retificado_em?: string | null
          retificado_por_id?: string | null
          retificado_por_nome_snapshot?: string | null
          status?: string
          tarefa_id: string
          termino: string
          termino_real_em?: string | null
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
          demao_numero?: number | null
          duracao_minutos?: number
          fechamento_retroativo?: boolean
          id?: string
          inicio?: string
          jornada_op_id?: string | null
          jornada_total_equipe_minutos_snapshot?: number | null
          local_tipo?: string
          minutos_improdutivos?: number
          minutos_produtivos?: number | null
          motivo_cancelamento?: string | null
          motivo_improdutivo?: string | null
          motivo_regularizacao?: string | null
          motivo_ultima_retificacao?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          processo_id?: string | null
          projeto_local_id?: string | null
          quantidade_produzida?: number | null
          regularizado_em?: string | null
          regularizado_por_id?: string | null
          regularizado_por_nome_snapshot?: string | null
          retificacoes_count?: number
          retificado_em?: string | null
          retificado_por_id?: string | null
          retificado_por_nome_snapshot?: string | null
          status?: string
          tarefa_id?: string
          termino?: string
          termino_real_em?: string | null
          ultima_edicao_em?: string | null
          ultima_edicao_por_id?: string | null
          ultima_edicao_por_nome_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamentos_jornada_op_id_fkey"
            columns: ["jornada_op_id"]
            isOneToOne: false
            referencedRelation: "producao_op_jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamentos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
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
      producao_consumos_tinta: {
        Row: {
          apontamento_id: string | null
          cor: string | null
          created_at: string
          criado_por_id: string
          criado_por_nome_snapshot: string
          id: string
          ordem_producao_id: string
          quantidade_ml: number
          quantidade_pecas: number | null
          quantidade_unitaria_ml: number | null
        }
        Insert: {
          apontamento_id?: string | null
          cor?: string | null
          created_at?: string
          criado_por_id: string
          criado_por_nome_snapshot: string
          id?: string
          ordem_producao_id: string
          quantidade_ml: number
          quantidade_pecas?: number | null
          quantidade_unitaria_ml?: number | null
        }
        Update: {
          apontamento_id?: string | null
          cor?: string | null
          created_at?: string
          criado_por_id?: string
          criado_por_nome_snapshot?: string
          id?: string
          ordem_producao_id?: string
          quantidade_ml?: number
          quantidade_pecas?: number | null
          quantidade_unitaria_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_consumos_tinta_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_consumos_tinta_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
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
      producao_cronograma_marcos: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string | null
          origem_id: string | null
          prioridade: string | null
          project_group_id: string | null
          projeto_id: string | null
          status: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string | null
          origem_id?: string | null
          prioridade?: string | null
          project_group_id?: string | null
          projeto_id?: string | null
          status?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string | null
          origem_id?: string | null
          prioridade?: string | null
          project_group_id?: string | null
          projeto_id?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_cronograma_marcos_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_cronograma_marcos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_etapa_materiais: {
        Row: {
          atualizado_por_id: string | null
          atualizado_por_nome_snapshot: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          id: string
          item_id: string
          item_snapshot: Json
          observacoes: string | null
          processo_id: string
          quantidade_planejada: number
          unidade_snapshot: string
          updated_at: string
        }
        Insert: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          id?: string
          item_id: string
          item_snapshot: Json
          observacoes?: string | null
          processo_id: string
          quantidade_planejada: number
          unidade_snapshot: string
          updated_at?: string
        }
        Update: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          id?: string
          item_id?: string
          item_snapshot?: Json
          observacoes?: string | null
          processo_id?: string
          quantidade_planejada?: number
          unidade_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_etapa_materiais_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_etapa_materiais_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_etapas_expurgos_auditoria: {
        Row: {
          apontamentos_snapshot: Json
          codigo: string
          expurgado_em: string
          expurgado_por_id: string
          expurgado_por_nome_snapshot: string
          id: string
          justificativa: string
          nome: string
          ordens_snapshot: Json
          processo_id: string
          processo_snapshot: Json
          projeto_id: string
          totais: Json
        }
        Insert: {
          apontamentos_snapshot?: Json
          codigo: string
          expurgado_em?: string
          expurgado_por_id: string
          expurgado_por_nome_snapshot: string
          id?: string
          justificativa: string
          nome: string
          ordens_snapshot?: Json
          processo_id: string
          processo_snapshot: Json
          projeto_id: string
          totais: Json
        }
        Update: {
          apontamentos_snapshot?: Json
          codigo?: string
          expurgado_em?: string
          expurgado_por_id?: string
          expurgado_por_nome_snapshot?: string
          id?: string
          justificativa?: string
          nome?: string
          ordens_snapshot?: Json
          processo_id?: string
          processo_snapshot?: Json
          projeto_id?: string
          totais?: Json
        }
        Relationships: []
      }
      producao_led_planejado: {
        Row: {
          cordoes_por_peca: number
          created_at: string
          detalhamento: Json
          especificacao: string | null
          fonte: string
          fonte_aba: string
          fonte_linha: number
          id: string
          peca: string
          projeto_id: string | null
          quantidade_pecas: number
          referencia: string
          total_previsto: number
        }
        Insert: {
          cordoes_por_peca?: number
          created_at?: string
          detalhamento?: Json
          especificacao?: string | null
          fonte: string
          fonte_aba: string
          fonte_linha: number
          id?: string
          peca: string
          projeto_id?: string | null
          quantidade_pecas?: number
          referencia: string
          total_previsto?: number
        }
        Update: {
          cordoes_por_peca?: number
          created_at?: string
          detalhamento?: Json
          especificacao?: string | null
          fonte?: string
          fonte_aba?: string
          fonte_linha?: number
          id?: string
          peca?: string
          projeto_id?: string | null
          quantidade_pecas?: number
          referencia?: string
          total_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "producao_led_planejado_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_led_registros: {
        Row: {
          apontamento_id: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          especificacao: string | null
          id: string
          observacoes: string | null
          ordem_producao_id: string
          origem: string | null
          quantidade_cordoes: number
          status: string | null
          teste_funcional: boolean | null
          voltagem: string | null
        }
        Insert: {
          apontamento_id?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          especificacao?: string | null
          id?: string
          observacoes?: string | null
          ordem_producao_id: string
          origem?: string | null
          quantidade_cordoes: number
          status?: string | null
          teste_funcional?: boolean | null
          voltagem?: string | null
        }
        Update: {
          apontamento_id?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          especificacao?: string | null
          id?: string
          observacoes?: string | null
          ordem_producao_id?: string
          origem?: string | null
          quantidade_cordoes?: number
          status?: string | null
          teste_funcional?: boolean | null
          voltagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_led_registros_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_led_registros_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
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
          jornada_diaria_minutos: number | null
          nome: string
          nome_snapshot: string | null
          origem: Database["public"]["Enums"]["producao_membro_origem"] | null
          updated_at: string
          valor_hora: number | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          funcao?: string | null
          id?: string
          jornada_diaria_minutos?: number | null
          nome: string
          nome_snapshot?: string | null
          origem?: Database["public"]["Enums"]["producao_membro_origem"] | null
          updated_at?: string
          valor_hora?: number | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          funcao?: string | null
          id?: string
          jornada_diaria_minutos?: number | null
          nome?: string
          nome_snapshot?: string | null
          origem?: Database["public"]["Enums"]["producao_membro_origem"] | null
          updated_at?: string
          valor_hora?: number | null
        }
        Relationships: []
      }
      producao_necessidades_fabricacao: {
        Row: {
          calculo_snapshot: Json
          created_at: string
          criado_por_id: string | null
          id: string
          item_nome_snapshot: string
          observacoes: string | null
          ordem_producao_id: string | null
          planejamento_item_id: string
          processo_id: string | null
          projetos_snapshot: Json
          quantidade: number
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          calculo_snapshot?: Json
          created_at?: string
          criado_por_id?: string | null
          id?: string
          item_nome_snapshot: string
          observacoes?: string | null
          ordem_producao_id?: string | null
          planejamento_item_id: string
          processo_id?: string | null
          projetos_snapshot?: Json
          quantidade: number
          status?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          calculo_snapshot?: Json
          created_at?: string
          criado_por_id?: string | null
          id?: string
          item_nome_snapshot?: string
          observacoes?: string | null
          ordem_producao_id?: string | null
          planejamento_item_id?: string
          processo_id?: string | null
          projetos_snapshot?: Json
          quantidade?: number
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_necessidades_fabricacao_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_necessidades_fabricacao_planejamento_item_id_fkey"
            columns: ["planejamento_item_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_necessidades_fabricacao_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_nome_projeto_repair_audit_20260930: {
        Row: {
          corrigido_em: string
          entidade: string
          id: string
          motivo: string
          nome_anterior: string
          nome_novo: string
        }
        Insert: {
          corrigido_em?: string
          entidade: string
          id: string
          motivo: string
          nome_anterior: string
          nome_novo: string
        }
        Update: {
          corrigido_em?: string
          entidade?: string
          id?: string
          motivo?: string
          nome_anterior?: string
          nome_novo?: string
        }
        Relationships: []
      }
      producao_op_jornadas: {
        Row: {
          apontamento_id: string | null
          contexto_atualizado_em: string | null
          contexto_atualizado_por_id: string | null
          contexto_atualizado_por_nome_snapshot: string | null
          created_at: string
          descartada: boolean
          descartada_em: string | null
          descartada_por_id: string | null
          descartada_por_nome_snapshot: string | null
          encerrado_em: string | null
          encerrado_por_id: string | null
          encerrado_por_nome_snapshot: string | null
          encerrado_registrado_em: string | null
          fechamento_retroativo: boolean
          horarios_membros_rascunho: Json | null
          id: string
          iniciado_em: string
          iniciado_em_original: string | null
          iniciado_por_id: string | null
          iniciado_por_nome_snapshot: string | null
          inicio_ajustado: boolean
          inicio_ajustado_em: string | null
          inicio_ajustado_por_id: string | null
          inicio_ajustado_por_nome_snapshot: string | null
          inicio_ajuste_motivo: string | null
          inicio_ajuste_retroativo: boolean
          interrompida_em: string | null
          justificativa_conclusao_rascunho: string | null
          membros_ids: string[] | null
          minutos_improdutivos_rascunho: number | null
          motivo_descarte: string | null
          motivo_improdutivo_rascunho: string | null
          motivo_regularizacao: string | null
          motivo_regularizacao_rascunho: string | null
          observacoes_rascunho: string | null
          ordem_producao_id: string
          quantidade_produzida_rascunho: number | null
          status: string
          tarefa_id: string | null
          termino_rascunho: string | null
          updated_at: string
        }
        Insert: {
          apontamento_id?: string | null
          contexto_atualizado_em?: string | null
          contexto_atualizado_por_id?: string | null
          contexto_atualizado_por_nome_snapshot?: string | null
          created_at?: string
          descartada?: boolean
          descartada_em?: string | null
          descartada_por_id?: string | null
          descartada_por_nome_snapshot?: string | null
          encerrado_em?: string | null
          encerrado_por_id?: string | null
          encerrado_por_nome_snapshot?: string | null
          encerrado_registrado_em?: string | null
          fechamento_retroativo?: boolean
          horarios_membros_rascunho?: Json | null
          id?: string
          iniciado_em?: string
          iniciado_em_original?: string | null
          iniciado_por_id?: string | null
          iniciado_por_nome_snapshot?: string | null
          inicio_ajustado?: boolean
          inicio_ajustado_em?: string | null
          inicio_ajustado_por_id?: string | null
          inicio_ajustado_por_nome_snapshot?: string | null
          inicio_ajuste_motivo?: string | null
          inicio_ajuste_retroativo?: boolean
          interrompida_em?: string | null
          justificativa_conclusao_rascunho?: string | null
          membros_ids?: string[] | null
          minutos_improdutivos_rascunho?: number | null
          motivo_descarte?: string | null
          motivo_improdutivo_rascunho?: string | null
          motivo_regularizacao?: string | null
          motivo_regularizacao_rascunho?: string | null
          observacoes_rascunho?: string | null
          ordem_producao_id: string
          quantidade_produzida_rascunho?: number | null
          status?: string
          tarefa_id?: string | null
          termino_rascunho?: string | null
          updated_at?: string
        }
        Update: {
          apontamento_id?: string | null
          contexto_atualizado_em?: string | null
          contexto_atualizado_por_id?: string | null
          contexto_atualizado_por_nome_snapshot?: string | null
          created_at?: string
          descartada?: boolean
          descartada_em?: string | null
          descartada_por_id?: string | null
          descartada_por_nome_snapshot?: string | null
          encerrado_em?: string | null
          encerrado_por_id?: string | null
          encerrado_por_nome_snapshot?: string | null
          encerrado_registrado_em?: string | null
          fechamento_retroativo?: boolean
          horarios_membros_rascunho?: Json | null
          id?: string
          iniciado_em?: string
          iniciado_em_original?: string | null
          iniciado_por_id?: string | null
          iniciado_por_nome_snapshot?: string | null
          inicio_ajustado?: boolean
          inicio_ajustado_em?: string | null
          inicio_ajustado_por_id?: string | null
          inicio_ajustado_por_nome_snapshot?: string | null
          inicio_ajuste_motivo?: string | null
          inicio_ajuste_retroativo?: boolean
          interrompida_em?: string | null
          justificativa_conclusao_rascunho?: string | null
          membros_ids?: string[] | null
          minutos_improdutivos_rascunho?: number | null
          motivo_descarte?: string | null
          motivo_improdutivo_rascunho?: string | null
          motivo_regularizacao?: string | null
          motivo_regularizacao_rascunho?: string | null
          observacoes_rascunho?: string | null
          ordem_producao_id?: string
          quantidade_produzida_rascunho?: number | null
          status?: string
          tarefa_id?: string | null
          termino_rascunho?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_op_jornadas_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "producao_apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_op_jornadas_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_op_jornadas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "producao_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordem_eventos: {
        Row: {
          created_at: string
          dados: Json | null
          evento: string
          id: string
          justificativa: string | null
          nome_usuario_snapshot: string | null
          novo_status: string | null
          ordem_producao_id: string
          status_anterior: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          evento: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot?: string | null
          novo_status?: string | null
          ordem_producao_id: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          evento?: string
          id?: string
          justificativa?: string | null
          nome_usuario_snapshot?: string | null
          novo_status?: string | null
          ordem_producao_id?: string
          status_anterior?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordem_eventos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordem_materiais: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_snapshot: Json
          observacoes: string | null
          ordem_producao_id: string
          processo_material_id: string | null
          quantidade_planejada: number
          quantidade_solicitada: number
          solicitacao_material_id: string | null
          solicitacao_material_item_id: string | null
          unidade_snapshot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_snapshot: Json
          observacoes?: string | null
          ordem_producao_id: string
          processo_material_id?: string | null
          quantidade_planejada: number
          quantidade_solicitada?: number
          solicitacao_material_id?: string | null
          solicitacao_material_item_id?: string | null
          unidade_snapshot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_snapshot?: Json
          observacoes?: string | null
          ordem_producao_id?: string
          processo_material_id?: string | null
          quantidade_planejada?: number
          quantidade_solicitada?: number
          solicitacao_material_id?: string | null
          solicitacao_material_item_id?: string | null
          unidade_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordem_materiais_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordem_materiais_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordem_materiais_processo_material_id_fkey"
            columns: ["processo_material_id"]
            isOneToOne: false
            referencedRelation: "producao_etapa_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordem_materiais_solicitacao_material_id_fkey"
            columns: ["solicitacao_material_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordem_materiais_solicitacao_material_item_id_fkey"
            columns: ["solicitacao_material_item_id"]
            isOneToOne: false
            referencedRelation: "solicitacao_material_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordem_materiais_pcp_fix_audit_20260930: {
        Row: {
          corrigido_em: string
          item_id: string
          motivo: string
          numero_op: number
          ordem_material_id: string
          ordem_producao_id: string
          processo_id: string
          quantidade_antes: number
          quantidade_pcp: number
          solicitacao_material_id: string | null
          status_op: string
        }
        Insert: {
          corrigido_em?: string
          item_id: string
          motivo: string
          numero_op: number
          ordem_material_id: string
          ordem_producao_id: string
          processo_id: string
          quantidade_antes: number
          quantidade_pcp: number
          solicitacao_material_id?: string | null
          status_op: string
        }
        Update: {
          corrigido_em?: string
          item_id?: string
          motivo?: string
          numero_op?: number
          ordem_material_id?: string
          ordem_producao_id?: string
          processo_id?: string
          quantidade_antes?: number
          quantidade_pcp?: number
          solicitacao_material_id?: string | null
          status_op?: string
        }
        Relationships: []
      }
      producao_ordem_materiais_remocao_audit_20260930: {
        Row: {
          item_id: string
          item_snapshot: Json
          motivo: string
          numero_op: number
          observacoes: string | null
          ordem_material_id: string
          ordem_producao_id: string
          processo_id: string
          quantidade_planejada: number
          quantidade_solicitada: number
          removido_em: string
          solicitacao_material_id: string | null
          solicitacao_material_item_id: string | null
          unidade_snapshot: string
        }
        Insert: {
          item_id: string
          item_snapshot: Json
          motivo: string
          numero_op: number
          observacoes?: string | null
          ordem_material_id: string
          ordem_producao_id: string
          processo_id: string
          quantidade_planejada: number
          quantidade_solicitada: number
          removido_em?: string
          solicitacao_material_id?: string | null
          solicitacao_material_item_id?: string | null
          unidade_snapshot: string
        }
        Update: {
          item_id?: string
          item_snapshot?: Json
          motivo?: string
          numero_op?: number
          observacoes?: string | null
          ordem_material_id?: string
          ordem_producao_id?: string
          processo_id?: string
          quantidade_planejada?: number
          quantidade_solicitada?: number
          removido_em?: string
          solicitacao_material_id?: string | null
          solicitacao_material_item_id?: string | null
          unidade_snapshot?: string
        }
        Relationships: []
      }
      producao_ordens_etapas_auditoria: {
        Row: {
          alterado_por_id: string | null
          alterado_por_nome_snapshot: string | null
          apontamentos_reclassificados: number
          created_at: string
          etapa_destino_codigo_snapshot: string | null
          etapa_destino_id: string | null
          etapa_destino_nome_snapshot: string | null
          etapa_origem_codigo_snapshot: string | null
          etapa_origem_id: string | null
          etapa_origem_nome_snapshot: string | null
          id: string
          justificativa: string | null
          ordem_producao_id: string
          projeto_id: string
        }
        Insert: {
          alterado_por_id?: string | null
          alterado_por_nome_snapshot?: string | null
          apontamentos_reclassificados?: number
          created_at?: string
          etapa_destino_codigo_snapshot?: string | null
          etapa_destino_id?: string | null
          etapa_destino_nome_snapshot?: string | null
          etapa_origem_codigo_snapshot?: string | null
          etapa_origem_id?: string | null
          etapa_origem_nome_snapshot?: string | null
          id?: string
          justificativa?: string | null
          ordem_producao_id: string
          projeto_id: string
        }
        Update: {
          alterado_por_id?: string | null
          alterado_por_nome_snapshot?: string | null
          apontamentos_reclassificados?: number
          created_at?: string
          etapa_destino_codigo_snapshot?: string | null
          etapa_destino_id?: string | null
          etapa_destino_nome_snapshot?: string | null
          etapa_origem_codigo_snapshot?: string | null
          etapa_origem_id?: string | null
          etapa_origem_nome_snapshot?: string | null
          id?: string
          justificativa?: string | null
          ordem_producao_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordens_etapas_auditoria_etapa_destino_id_fkey"
            columns: ["etapa_destino_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_etapas_auditoria_etapa_origem_id_fkey"
            columns: ["etapa_origem_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_etapas_auditoria_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_etapas_auditoria_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_ordens_producao: {
        Row: {
          atualizado_por_id: string | null
          atualizado_por_nome_snapshot: string | null
          created_at: string
          criado_por_id: string | null
          criado_por_nome_snapshot: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          descricao: string | null
          duracao_estimada_horas: number | null
          equipe_prevista: number | null
          id: string
          instrucoes: string | null
          local_tipo: string
          motivo_cancelamento: string | null
          numero: number
          prioridade: string
          processo_id: string
          produto_entregavel: string | null
          project_group_id: string | null
          projeto_id: string
          quantidade_planejada: number
          responsavel_id: string | null
          responsavel_nome_snapshot: string | null
          status: string
          tarefa_id: string | null
          tarefa_nome_snapshot: string | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          duracao_estimada_horas?: number | null
          equipe_prevista?: number | null
          id?: string
          instrucoes?: string | null
          local_tipo: string
          motivo_cancelamento?: string | null
          numero?: number
          prioridade?: string
          processo_id: string
          produto_entregavel?: string | null
          project_group_id?: string | null
          projeto_id: string
          quantidade_planejada: number
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          status?: string
          tarefa_id?: string | null
          tarefa_nome_snapshot?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por_id?: string | null
          atualizado_por_nome_snapshot?: string | null
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome_snapshot?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          duracao_estimada_horas?: number | null
          equipe_prevista?: number | null
          id?: string
          instrucoes?: string | null
          local_tipo?: string
          motivo_cancelamento?: string | null
          numero?: number
          prioridade?: string
          processo_id?: string
          produto_entregavel?: string | null
          project_group_id?: string | null
          projeto_id?: string
          quantidade_planejada?: number
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          status?: string
          tarefa_id?: string | null
          tarefa_nome_snapshot?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_ordens_producao_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_producao_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_producao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_ordens_producao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "producao_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_parametros_padrao: {
        Row: {
          ativo: boolean
          complexidade: string | null
          created_at: string
          detalhamento: string | null
          dias_cronograma: string | null
          fonte: string
          fonte_linha: number
          gargalos_criticos: string | null
          id: string
          ritmo_padrao: string | null
          tempo_unitario_horas: number | null
          tempo_unitario_texto: string | null
          tipologia: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          complexidade?: string | null
          created_at?: string
          detalhamento?: string | null
          dias_cronograma?: string | null
          fonte: string
          fonte_linha: number
          gargalos_criticos?: string | null
          id?: string
          ritmo_padrao?: string | null
          tempo_unitario_horas?: number | null
          tempo_unitario_texto?: string | null
          tipologia: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          complexidade?: string | null
          created_at?: string
          detalhamento?: string | null
          dias_cronograma?: string | null
          fonte?: string
          fonte_linha?: number
          gargalos_criticos?: string | null
          id?: string
          ritmo_padrao?: string | null
          tempo_unitario_horas?: number | null
          tempo_unitario_texto?: string | null
          tipologia?: string
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
      producao_planejamento_agenda: {
        Row: {
          apontamento_referencia: string | null
          created_at: string
          data: string
          descricao: string | null
          fonte: string
          fonte_aba: string | null
          fonte_linha: number
          frente: string | null
          id: string
          integracao_status: string
          integrado_em: string | null
          meta: string | null
          observacoes: string | null
          ordem_producao_id: string | null
          prioridade: string | null
          processo_id: string | null
          project_group_id: string | null
          projeto_chave: string | null
          responsavel: string | null
          status: string | null
          tipo: string
          turno: string | null
          updated_at: string
        }
        Insert: {
          apontamento_referencia?: string | null
          created_at?: string
          data: string
          descricao?: string | null
          fonte: string
          fonte_aba?: string | null
          fonte_linha: number
          frente?: string | null
          id?: string
          integracao_status?: string
          integrado_em?: string | null
          meta?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          prioridade?: string | null
          processo_id?: string | null
          project_group_id?: string | null
          projeto_chave?: string | null
          responsavel?: string | null
          status?: string | null
          tipo: string
          turno?: string | null
          updated_at?: string
        }
        Update: {
          apontamento_referencia?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          fonte?: string
          fonte_aba?: string | null
          fonte_linha?: number
          frente?: string | null
          id?: string
          integracao_status?: string
          integrado_em?: string | null
          meta?: string | null
          observacoes?: string | null
          ordem_producao_id?: string | null
          prioridade?: string | null
          processo_id?: string | null
          project_group_id?: string | null
          projeto_chave?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_agenda_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_agenda_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_agenda_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_planejamento_divergencias: {
        Row: {
          created_at: string
          detalhes: Json
          diferenca: number | null
          id: string
          necessidade_fabricacao_id: string | null
          planejamento_item_id: string
          resolved_at: string | null
          status: string
          tipo: string
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          diferenca?: number | null
          id?: string
          necessidade_fabricacao_id?: string | null
          planejamento_item_id: string
          resolved_at?: string | null
          status?: string
          tipo: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          created_at?: string
          detalhes?: Json
          diferenca?: number | null
          id?: string
          necessidade_fabricacao_id?: string | null
          planejamento_item_id?: string
          resolved_at?: string | null
          status?: string
          tipo?: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_divergenci_necessidade_fabricacao_id_fkey"
            columns: ["necessidade_fabricacao_id"]
            isOneToOne: false
            referencedRelation: "producao_necessidades_fabricacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_divergencias_planejamento_item_id_fkey"
            columns: ["planejamento_item_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_planejamento_fontes: {
        Row: {
          chave: string
          created_at: string
          id: string
          modo: string
          nome: string
          status: string
          ultima_sincronizacao: string | null
          ultimo_resultado: Json | null
          updated_at: string
          url: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          modo?: string
          nome: string
          status?: string
          ultima_sincronizacao?: string | null
          ultimo_resultado?: Json | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          modo?: string
          nome?: string
          status?: string
          ultima_sincronizacao?: string | null
          ultimo_resultado?: Json | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      producao_planejamento_itens: {
        Row: {
          acervo_codigo_ref: string | null
          ativo: boolean
          codigo_producao: string
          created_at: string
          demandas: Json
          fonte: string
          fonte_linha: number
          id: string
          nome: string
          observacoes: string | null
          qtd_estoque_referencia: number
          status_planilha: string | null
          updated_at: string
        }
        Insert: {
          acervo_codigo_ref?: string | null
          ativo?: boolean
          codigo_producao: string
          created_at?: string
          demandas?: Json
          fonte: string
          fonte_linha: number
          id?: string
          nome: string
          observacoes?: string | null
          qtd_estoque_referencia?: number
          status_planilha?: string | null
          updated_at?: string
        }
        Update: {
          acervo_codigo_ref?: string | null
          ativo?: boolean
          codigo_producao?: string
          created_at?: string
          demandas?: Json
          fonte?: string
          fonte_linha?: number
          id?: string
          nome?: string
          observacoes?: string | null
          qtd_estoque_referencia?: number
          status_planilha?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      producao_planejamento_projeto_pecas: {
        Row: {
          codigo_peca: string
          created_at: string
          id: string
          local_utilizacao_id: string
          origem: string
          planejamento_item_id: string | null
          planejamento_projeto_id: string
          producao_projeto_id: string
          project_group_id: string
          quantidade_planejada: number
          updated_at: string
        }
        Insert: {
          codigo_peca: string
          created_at?: string
          id?: string
          local_utilizacao_id: string
          origem?: string
          planejamento_item_id?: string | null
          planejamento_projeto_id: string
          producao_projeto_id: string
          project_group_id: string
          quantidade_planejada?: number
          updated_at?: string
        }
        Update: {
          codigo_peca?: string
          created_at?: string
          id?: string
          local_utilizacao_id?: string
          origem?: string
          planejamento_item_id?: string | null
          planejamento_projeto_id?: string
          producao_projeto_id?: string
          project_group_id?: string
          quantidade_planejada?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_projeto_peca_planejamento_projeto_id_fkey"
            columns: ["planejamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_projeto_pecas_local_utilizacao_id_fkey"
            columns: ["local_utilizacao_id"]
            isOneToOne: false
            referencedRelation: "locais_utilizacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_projeto_pecas_planejamento_item_id_fkey"
            columns: ["planejamento_item_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_projeto_pecas_producao_projeto_id_fkey"
            columns: ["producao_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_projeto_pecas_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_planejamento_projetos: {
        Row: {
          ativo_calculo: boolean
          chave: string
          created_at: string
          fonte: string | null
          fonte_coluna: string | null
          id: string
          nome: string
          ordem: number
          project_group_id: string | null
          updated_at: string
        }
        Insert: {
          ativo_calculo?: boolean
          chave: string
          created_at?: string
          fonte?: string | null
          fonte_coluna?: string | null
          id?: string
          nome: string
          ordem?: number
          project_group_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo_calculo?: boolean
          chave?: string
          created_at?: string
          fonte?: string | null
          fonte_coluna?: string | null
          id?: string
          nome?: string
          ordem?: number
          project_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_projetos_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_planejamento_referencias_pendentes: {
        Row: {
          created_at: string
          id: string
          motivo: string
          planejamento_item_id: string
          planejamento_projeto_id: string
          project_group_id: string
          quantidade_planejada: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string
          planejamento_item_id: string
          planejamento_projeto_id: string
          project_group_id: string
          quantidade_planejada?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          planejamento_item_id?: string
          planejamento_projeto_id?: string
          project_group_id?: string
          quantidade_planejada?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_referencias__planejamento_projeto_id_fkey"
            columns: ["planejamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_referencias_pen_planejamento_item_id_fkey"
            columns: ["planejamento_item_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_planejamento_referencias_pendent_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_planejamento_sincronizacoes: {
        Row: {
          aba: string | null
          arquivo: string | null
          campo: string | null
          created_at: string
          erro: string | null
          fonte_id: string | null
          id: string
          identificador: string | null
          origem_usuario: string | null
          resultado: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          aba?: string | null
          arquivo?: string | null
          campo?: string | null
          created_at?: string
          erro?: string | null
          fonte_id?: string | null
          id?: string
          identificador?: string | null
          origem_usuario?: string | null
          resultado: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          aba?: string | null
          arquivo?: string | null
          campo?: string | null
          created_at?: string
          erro?: string | null
          fonte_id?: string | null
          id?: string
          identificador?: string | null
          origem_usuario?: string | null
          resultado?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_planejamento_sincronizacoes_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "producao_planejamento_fontes"
            referencedColumns: ["id"]
          },
        ]
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
      producao_processos_exclusoes_auditoria: {
        Row: {
          codigo: string
          excluido_em: string
          excluido_por_id: string
          excluido_por_nome_snapshot: string
          id: string
          justificativa: string
          nome: string
          processo_id: string
          processo_snapshot: Json
          projeto_id: string
          total_alertas: number
          total_alocacoes: number
          total_dependencias: number
          total_eventos: number
        }
        Insert: {
          codigo: string
          excluido_em?: string
          excluido_por_id: string
          excluido_por_nome_snapshot: string
          id?: string
          justificativa: string
          nome: string
          processo_id: string
          processo_snapshot: Json
          projeto_id: string
          total_alertas?: number
          total_alocacoes?: number
          total_dependencias?: number
          total_eventos?: number
        }
        Update: {
          codigo?: string
          excluido_em?: string
          excluido_por_id?: string
          excluido_por_nome_snapshot?: string
          id?: string
          justificativa?: string
          nome?: string
          processo_id?: string
          processo_snapshot?: Json
          projeto_id?: string
          total_alertas?: number
          total_alocacoes?: number
          total_dependencias?: number
          total_eventos?: number
        }
        Relationships: []
      }
      producao_programacao_diaria: {
        Row: {
          atividade_planejada: string
          created_at: string
          data: string
          equipe_prevista: string | null
          id: string
          meta: string | null
          ordem_producao_id: string | null
          origem: string | null
          origem_id: string | null
          prioridade: string | null
          processo_id: string | null
          project_group_id: string | null
          projeto_id: string | null
          status: string
          turno: string | null
          updated_at: string
        }
        Insert: {
          atividade_planejada: string
          created_at?: string
          data: string
          equipe_prevista?: string | null
          id?: string
          meta?: string | null
          ordem_producao_id?: string | null
          origem?: string | null
          origem_id?: string | null
          prioridade?: string | null
          processo_id?: string | null
          project_group_id?: string | null
          projeto_id?: string | null
          status?: string
          turno?: string | null
          updated_at?: string
        }
        Update: {
          atividade_planejada?: string
          created_at?: string
          data?: string
          equipe_prevista?: string | null
          id?: string
          meta?: string | null
          ordem_producao_id?: string | null
          origem?: string | null
          origem_id?: string | null
          prioridade?: string | null
          processo_id?: string | null
          project_group_id?: string | null
          projeto_id?: string | null
          status?: string
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_programacao_diaria_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_programacao_diaria_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_programacao_diaria_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_programacao_diaria_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_projeto_grupos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          origem: string
          project_group_id: string
          projeto_id: string
          quantidade_planejada: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          origem?: string
          project_group_id: string
          projeto_id: string
          quantidade_planejada?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          origem?: string
          project_group_id?: string
          projeto_id?: string
          quantidade_planejada?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_projeto_grupos_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_projeto_grupos_projeto_id_fkey"
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
          data_fim_real: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          descricao: string | null
          endereco_execucao: string | null
          excluido_em: string | null
          id: string
          local_execucao: string | null
          local_utilizacao_id: string | null
          nome: string
          observacoes: string | null
          responsavel_id: string | null
          responsavel_nome_snapshot: string | null
          status: string
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
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          endereco_execucao?: string | null
          excluido_em?: string | null
          id?: string
          local_execucao?: string | null
          local_utilizacao_id?: string | null
          nome: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          status?: string
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
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          endereco_execucao?: string | null
          excluido_em?: string | null
          id?: string
          local_execucao?: string | null
          local_utilizacao_id?: string | null
          nome?: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome_snapshot?: string | null
          status?: string
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
      producao_projetos_exclusoes_auditoria: {
        Row: {
          created_at: string
          excluido_por_id: string
          id: string
          nome: string
          projeto_id: string
          totais: Json
        }
        Insert: {
          created_at?: string
          excluido_por_id: string
          id?: string
          nome: string
          projeto_id: string
          totais: Json
        }
        Update: {
          created_at?: string
          excluido_por_id?: string
          id?: string
          nome?: string
          projeto_id?: string
          totais?: Json
        }
        Relationships: []
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
      producao_tinta_planejada: {
        Row: {
          created_at: string
          demão: string | null
          fonte: string
          fonte_aba: string
          fonte_linha: number
          id: string
          material_categoria: string
          peca: string
          projeto_id: string | null
          quantidade_pecas: number | null
          subpeca: string | null
          volume_previsto_ml: number
        }
        Insert: {
          created_at?: string
          demão?: string | null
          fonte: string
          fonte_aba: string
          fonte_linha: number
          id?: string
          material_categoria: string
          peca: string
          projeto_id?: string | null
          quantidade_pecas?: number | null
          subpeca?: string | null
          volume_previsto_ml: number
        }
        Update: {
          created_at?: string
          demão?: string | null
          fonte?: string
          fonte_aba?: string
          fonte_linha?: number
          id?: string
          material_categoria?: string
          peca?: string
          projeto_id?: string | null
          quantidade_pecas?: number | null
          subpeca?: string | null
          volume_previsto_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "producao_tinta_planejada_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          deve_trocar_senha: boolean
          email: string
          id: string
          nome: string
          senha_redefinida_em: string | null
          tipo_usuario: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deve_trocar_senha?: boolean
          email: string
          id?: string
          nome: string
          senha_redefinida_em?: string | null
          tipo_usuario?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deve_trocar_senha?: boolean
          email?: string
          id?: string
          nome?: string
          senha_redefinida_em?: string | null
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
      rh_colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cep: string | null
          cidade: string | null
          controla_ponto: boolean
          cpf_cnpj: string | null
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          departamento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          hora_extra_gera_valor: boolean
          id: string
          importado_em: string | null
          jornada_id: string | null
          nome: string
          origem_id: string | null
          origem_sistema: string
          origem_user_id: string | null
          pis: string | null
          pista_ativo_legado: boolean
          rh_ativo: boolean
          rh_cadastrado: boolean
          salario: number | null
          telefone: string | null
          tipo_contrato: string | null
          updated_at: string
          user_id: string | null
          valor_contrato: number | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          controla_ponto?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          hora_extra_gera_valor?: boolean
          id?: string
          importado_em?: string | null
          jornada_id?: string | null
          nome: string
          origem_id?: string | null
          origem_sistema?: string
          origem_user_id?: string | null
          pis?: string | null
          pista_ativo_legado?: boolean
          rh_ativo?: boolean
          rh_cadastrado?: boolean
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string
          user_id?: string | null
          valor_contrato?: number | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          controla_ponto?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          hora_extra_gera_valor?: boolean
          id?: string
          importado_em?: string | null
          jornada_id?: string | null
          nome?: string
          origem_id?: string | null
          origem_sistema?: string
          origem_user_id?: string | null
          pis?: string | null
          pista_ativo_legado?: boolean
          rh_ativo?: boolean
          rh_cadastrado?: boolean
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string
          user_id?: string | null
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_colaboradores_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "rh_jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_feriados: {
        Row: {
          ativo: boolean
          created_at: string
          data: string
          id: string
          importado_em: string | null
          nome: string
          origem_id: string | null
          origem_sistema: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data: string
          id?: string
          importado_em?: string | null
          nome: string
          origem_id?: string | null
          origem_sistema?: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data?: string
          id?: string
          importado_em?: string | null
          nome?: string
          origem_id?: string | null
          origem_sistema?: string
          tipo?: string | null
        }
        Relationships: []
      }
      rh_importacoes_auditoria: {
        Row: {
          acao: string
          created_at: string
          destino_id: string | null
          detalhes: Json
          entidade: string
          id: string
          origem_id: string | null
          origem_sistema: string
        }
        Insert: {
          acao: string
          created_at?: string
          destino_id?: string | null
          detalhes?: Json
          entidade: string
          id?: string
          origem_id?: string | null
          origem_sistema: string
        }
        Update: {
          acao?: string
          created_at?: string
          destino_id?: string | null
          detalhes?: Json
          entidade?: string
          id?: string
          origem_id?: string | null
          origem_sistema?: string
        }
        Relationships: []
      }
      rh_jornadas: {
        Row: {
          ativo: boolean
          carga_horaria_semanal: number | null
          created_at: string
          descricao: string | null
          domingo_entrada_1: string | null
          domingo_entrada_2: string | null
          domingo_saida_1: string | null
          domingo_saida_2: string | null
          feriado_entrada_1: string | null
          feriado_entrada_2: string | null
          feriado_saida_1: string | null
          feriado_saida_2: string | null
          id: string
          importado_em: string | null
          nome: string
          origem_id: string | null
          origem_sistema: string
          personalizada_para_colaborador_id: string | null
          quarta_entrada_1: string | null
          quarta_entrada_2: string | null
          quarta_saida_1: string | null
          quarta_saida_2: string | null
          quinta_entrada_1: string | null
          quinta_entrada_2: string | null
          quinta_saida_1: string | null
          quinta_saida_2: string | null
          sabado_entrada_1: string | null
          sabado_entrada_2: string | null
          sabado_saida_1: string | null
          sabado_saida_2: string | null
          segunda_entrada_1: string | null
          segunda_entrada_2: string | null
          segunda_saida_1: string | null
          segunda_saida_2: string | null
          sexta_entrada_1: string | null
          sexta_entrada_2: string | null
          sexta_saida_1: string | null
          sexta_saida_2: string | null
          terca_entrada_1: string | null
          terca_entrada_2: string | null
          terca_saida_1: string | null
          terca_saida_2: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carga_horaria_semanal?: number | null
          created_at?: string
          descricao?: string | null
          domingo_entrada_1?: string | null
          domingo_entrada_2?: string | null
          domingo_saida_1?: string | null
          domingo_saida_2?: string | null
          feriado_entrada_1?: string | null
          feriado_entrada_2?: string | null
          feriado_saida_1?: string | null
          feriado_saida_2?: string | null
          id?: string
          importado_em?: string | null
          nome: string
          origem_id?: string | null
          origem_sistema?: string
          personalizada_para_colaborador_id?: string | null
          quarta_entrada_1?: string | null
          quarta_entrada_2?: string | null
          quarta_saida_1?: string | null
          quarta_saida_2?: string | null
          quinta_entrada_1?: string | null
          quinta_entrada_2?: string | null
          quinta_saida_1?: string | null
          quinta_saida_2?: string | null
          sabado_entrada_1?: string | null
          sabado_entrada_2?: string | null
          sabado_saida_1?: string | null
          sabado_saida_2?: string | null
          segunda_entrada_1?: string | null
          segunda_entrada_2?: string | null
          segunda_saida_1?: string | null
          segunda_saida_2?: string | null
          sexta_entrada_1?: string | null
          sexta_entrada_2?: string | null
          sexta_saida_1?: string | null
          sexta_saida_2?: string | null
          terca_entrada_1?: string | null
          terca_entrada_2?: string | null
          terca_saida_1?: string | null
          terca_saida_2?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carga_horaria_semanal?: number | null
          created_at?: string
          descricao?: string | null
          domingo_entrada_1?: string | null
          domingo_entrada_2?: string | null
          domingo_saida_1?: string | null
          domingo_saida_2?: string | null
          feriado_entrada_1?: string | null
          feriado_entrada_2?: string | null
          feriado_saida_1?: string | null
          feriado_saida_2?: string | null
          id?: string
          importado_em?: string | null
          nome?: string
          origem_id?: string | null
          origem_sistema?: string
          personalizada_para_colaborador_id?: string | null
          quarta_entrada_1?: string | null
          quarta_entrada_2?: string | null
          quarta_saida_1?: string | null
          quarta_saida_2?: string | null
          quinta_entrada_1?: string | null
          quinta_entrada_2?: string | null
          quinta_saida_1?: string | null
          quinta_saida_2?: string | null
          sabado_entrada_1?: string | null
          sabado_entrada_2?: string | null
          sabado_saida_1?: string | null
          sabado_saida_2?: string | null
          segunda_entrada_1?: string | null
          segunda_entrada_2?: string | null
          segunda_saida_1?: string | null
          segunda_saida_2?: string | null
          sexta_entrada_1?: string | null
          sexta_entrada_2?: string | null
          sexta_saida_1?: string | null
          sexta_saida_2?: string | null
          terca_entrada_1?: string | null
          terca_entrada_2?: string | null
          terca_saida_1?: string | null
          terca_saida_2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_jornadas_personalizada_colaborador_fkey"
            columns: ["personalizada_para_colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_jornadas_personalizada_colaborador_fkey"
            columns: ["personalizada_para_colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores_operacionais_v"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ponto_dias_pagos: {
        Row: {
          colaborador_id: string
          created_at: string
          data: string
          id: string
          importado_em: string | null
          origem_id: string | null
          origem_pago_por: string | null
          origem_sistema: string
          pago_em: string
          pago_por: string | null
          updated_at: string
          valor_adicionais: number
          valor_diaria: number
          valor_total: number
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data: string
          id?: string
          importado_em?: string | null
          origem_id?: string | null
          origem_pago_por?: string | null
          origem_sistema?: string
          pago_em?: string
          pago_por?: string | null
          updated_at?: string
          valor_adicionais?: number
          valor_diaria?: number
          valor_total?: number
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data?: string
          id?: string
          importado_em?: string | null
          origem_id?: string | null
          origem_pago_por?: string | null
          origem_sistema?: string
          pago_em?: string
          pago_por?: string | null
          updated_at?: string
          valor_adicionais?: number
          valor_diaria?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_ponto_dias_pagos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_ponto_dias_pagos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores_operacionais_v"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_registros_ponto: {
        Row: {
          adicional_noturno_snapshot: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          colaborador_id: string
          created_at: string
          criado_por: string | null
          data: string
          hora_entrada_1: string | null
          hora_entrada_2: string | null
          hora_entrada_3: string | null
          hora_saida_1: string | null
          hora_saida_2: string | null
          hora_saida_3: string | null
          horas_atraso_snapshot: number | null
          horas_extras_100_snapshot: number | null
          horas_extras_50_snapshot: number | null
          horas_falta_snapshot: number | null
          horas_trabalhadas_snapshot: number | null
          id: string
          importado_em: string | null
          is_domingo_snapshot: boolean | null
          is_feriado_snapshot: boolean | null
          observacao: string | null
          origem_aprovado_por: string | null
          origem_created_by: string | null
          origem_id: string | null
          origem_sistema: string
          status: string
          updated_at: string
        }
        Insert: {
          adicional_noturno_snapshot?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          colaborador_id: string
          created_at?: string
          criado_por?: string | null
          data?: string
          hora_entrada_1?: string | null
          hora_entrada_2?: string | null
          hora_entrada_3?: string | null
          hora_saida_1?: string | null
          hora_saida_2?: string | null
          hora_saida_3?: string | null
          horas_atraso_snapshot?: number | null
          horas_extras_100_snapshot?: number | null
          horas_extras_50_snapshot?: number | null
          horas_falta_snapshot?: number | null
          horas_trabalhadas_snapshot?: number | null
          id?: string
          importado_em?: string | null
          is_domingo_snapshot?: boolean | null
          is_feriado_snapshot?: boolean | null
          observacao?: string | null
          origem_aprovado_por?: string | null
          origem_created_by?: string | null
          origem_id?: string | null
          origem_sistema?: string
          status?: string
          updated_at?: string
        }
        Update: {
          adicional_noturno_snapshot?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          colaborador_id?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          hora_entrada_1?: string | null
          hora_entrada_2?: string | null
          hora_entrada_3?: string | null
          hora_saida_1?: string | null
          hora_saida_2?: string | null
          hora_saida_3?: string | null
          horas_atraso_snapshot?: number | null
          horas_extras_100_snapshot?: number | null
          horas_extras_50_snapshot?: number | null
          horas_falta_snapshot?: number | null
          horas_trabalhadas_snapshot?: number | null
          id?: string
          importado_em?: string | null
          is_domingo_snapshot?: boolean | null
          is_feriado_snapshot?: boolean | null
          observacao?: string | null
          origem_aprovado_por?: string | null
          origem_created_by?: string | null
          origem_id?: string | null
          origem_sistema?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_registros_ponto_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_registros_ponto_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores_operacionais_v"
            referencedColumns: ["id"]
          },
        ]
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
          data_limite_separacao: string | null
          data_necessidade: string | null
          estoque_id: string | null
          id: string
          local_origem: string | null
          local_origem_id: string | null
          numero: number
          observacoes: string | null
          ordem_producao_id: string | null
          origem_modulo: string | null
          processo_id: string | null
          producao_projeto_id: string | null
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
          data_limite_separacao?: string | null
          data_necessidade?: string | null
          estoque_id?: string | null
          id?: string
          local_origem?: string | null
          local_origem_id?: string | null
          numero?: number
          observacoes?: string | null
          ordem_producao_id?: string | null
          origem_modulo?: string | null
          processo_id?: string | null
          producao_projeto_id?: string | null
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
          data_limite_separacao?: string | null
          data_necessidade?: string | null
          estoque_id?: string | null
          id?: string
          local_origem?: string | null
          local_origem_id?: string | null
          numero?: number
          observacoes?: string | null
          ordem_producao_id?: string | null
          origem_modulo?: string | null
          processo_id?: string | null
          producao_projeto_id?: string | null
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
            foreignKeyName: "solicitacoes_material_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "producao_ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_material_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "producao_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_material_producao_projeto_id_fkey"
            columns: ["producao_projeto_id"]
            isOneToOne: false
            referencedRelation: "producao_projetos"
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
      financeiro_pagina54_exportacao_pendente: {
        Row: {
          anotacao: string | null
          categoria: string | null
          credito: string | null
          data_prevista: string | null
          data_realizada: string | null
          debito: string | null
          descricao: string | null
          integracao_id: string | null
          lancamento_id: string | null
          linha: number | null
          origem_alteracao: string | null
          situacao: string | null
          subcategoria: string | null
          ultima_atualizacao: string | null
        }
        Insert: {
          anotacao?: string | null
          categoria?: string | null
          credito?: never
          data_prevista?: never
          data_realizada?: never
          debito?: never
          descricao?: string | null
          integracao_id?: string | null
          lancamento_id?: string | null
          linha?: number | null
          origem_alteracao?: never
          situacao?: never
          subcategoria?: string | null
          ultima_atualizacao?: never
        }
        Update: {
          anotacao?: string | null
          categoria?: string | null
          credito?: never
          data_prevista?: never
          data_realizada?: never
          debito?: never
          descricao?: string | null
          integracao_id?: string | null
          lancamento_id?: string | null
          linha?: number | null
          origem_alteracao?: never
          situacao?: never
          subcategoria?: string | null
          ultima_atualizacao?: never
        }
        Relationships: []
      }
      rh_colaboradores_operacionais_v: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          controla_ponto: boolean | null
          departamento: string | null
          email: string | null
          id: string | null
          jornada_id: string | null
          nome: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          controla_ponto?: boolean | null
          departamento?: string | null
          email?: string | null
          id?: string | null
          jornada_id?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          controla_ponto?: boolean | null
          departamento?: string | null
          email?: string | null
          id?: string | null
          jornada_id?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_colaboradores_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "rh_jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adicionar_itens_solicitacao_material: {
        Args: { p_itens: Json; p_solicitacao_id: string }
        Returns: {
          created_at: string
          id: string
          item_id: string | null
          item_snapshot: Json | null
          nome_item: string
          observacoes: string | null
          quantidade: number
          solicitacao_material_id: string
          unidade: string
        }[]
        SetofOptions: {
          from: "*"
          to: "solicitacao_material_itens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_create_profile: {
        Args: {
          email: string
          nome: string
          target_user_id: string
          tipo: string
        }
        Returns: undefined
      }
      ajustar_inicio_jornada_op_v1: {
        Args: {
          p_jornada_id: string
          p_motivo: string
          p_nova_data: string
          p_novo_inicio: string
        }
        Returns: Json
      }
      atualizar_planejamento_projeto_v1: {
        Args: { p_ativo_calculo: boolean; p_projeto_id: string }
        Returns: undefined
      }
      atualizar_status_ordem_producao: {
        Args: { p_ordem_id: string }
        Returns: undefined
      }
      can_create_items: { Args: never; Returns: boolean }
      can_manage_inventory: { Args: never; Returns: boolean }
      cancelar_apontamento_producao: {
        Args: { p_apontamento_id: string; p_justificativa: string }
        Returns: undefined
      }
      cancelar_necessidade_fabricacao_v1: {
        Args: { p_necessidade_id: string }
        Returns: undefined
      }
      cancelar_ordem_vazia_producao_admin: {
        Args: { p_ordem_producao_id: string }
        Returns: boolean
      }
      cancelar_reserva_acervo_v1: {
        Args: { p_reserva_id: string }
        Returns: undefined
      }
      concluir_primeiro_acesso: { Args: never; Returns: undefined }
      conferir_apontamento_producao: {
        Args: { p_apontamento_id: string }
        Returns: undefined
      }
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
      configurar_projeto_producao: {
        Args: {
          p_ativo?: boolean
          p_cidade?: string
          p_cliente?: string
          p_descricao?: string
          p_endereco_execucao?: string
          p_local_execucao?: string
          p_local_utilizacao_id: string
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_uf?: string
        }
        Returns: string
      }
      configurar_projeto_producao_v2: {
        Args: {
          p_ativo?: boolean
          p_cidade?: string
          p_cliente?: string
          p_data_fim_prevista?: string
          p_data_inicio_prevista?: string
          p_descricao?: string
          p_endereco_execucao?: string
          p_local_execucao?: string
          p_local_utilizacao_id: string
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_uf?: string
        }
        Returns: string
      }
      consultar_ferramenta_producao_v1: {
        Args: { p_codigo: string }
        Returns: Json
      }
      converter_solicitacao_material_retirada_v1: {
        Args: { p_solicitacao_material_id: string }
        Returns: Json
      }
      create_visualizador_message_thread: {
        Args: {
          p_initial_message: string
          p_recipient_id: string
          p_viewer_id: string
        }
        Returns: string
      }
      criar_apontamento_producao:
        | {
            Args: {
              p_data: string
              p_duracao_minutos: number
              p_inicio: string
              p_local_tipo: string
              p_membros: string[]
              p_minutos_improdutivos: number
              p_minutos_produtivos: number
              p_motivo_improdutivo: string
              p_observacoes: string
              p_ordem_producao_id: string
              p_processo_id: string
              p_projeto_local_id: string
              p_quantidade_produzida: number
              p_tarefa_id: string
              p_termino: string
            }
            Returns: string
          }
        | {
            Args: {
              p_data: string
              p_duracao_minutos: number
              p_inicio: string
              p_local_tipo: string
              p_membros: string[]
              p_minutos_improdutivos: number
              p_minutos_produtivos: number
              p_motivo_improdutivo: string
              p_observacoes: string
              p_processo_id: string
              p_projeto_local_id: string
              p_quantidade_produzida: number
              p_tarefa_id: string
              p_termino: string
            }
            Returns: string
          }
      criar_apontamento_producao_com_consumos_tinta_v1: {
        Args: {
          p_consumos_tinta: Json
          p_data: string
          p_duracao_minutos: number
          p_inicio: string
          p_local_tipo: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_minutos_produtivos: number
          p_motivo_improdutivo: string
          p_observacoes: string
          p_ordem_producao_id: string
          p_processo_id: string
          p_projeto_local_id: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: string
      }
      criar_apontamento_producao_com_consumos_tinta_v2: {
        Args: {
          p_consumos_tinta: Json
          p_data: string
          p_demao_numero: number
          p_duracao_minutos: number
          p_inicio: string
          p_local_tipo: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_minutos_produtivos: number
          p_motivo_improdutivo: string
          p_observacoes: string
          p_ordem_producao_id: string
          p_processo_id: string
          p_projeto_local_id: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: string
      }
      criar_apontamento_producao_com_horarios: {
        Args: {
          p_data: string
          p_duracao_minutos: number
          p_horarios_membros?: Json
          p_inicio: string
          p_local_tipo: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_minutos_produtivos: number
          p_motivo_improdutivo: string
          p_observacoes: string
          p_ordem_producao_id: string
          p_processo_id: string
          p_projeto_local_id: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: string
      }
      criar_cidade_planejamento_v1: { Args: { p_nome: string }; Returns: Json }
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
      criar_ordem_producao: {
        Args: {
          p_data_fim_prevista: string
          p_data_inicio_prevista: string
          p_descricao?: string
          p_equipe_prevista?: number
          p_instrucoes?: string
          p_local_tipo: string
          p_prioridade?: string
          p_processo_id: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
        }
        Returns: string
      }
      criar_ordem_producao_planejada_v1: {
        Args: {
          p_data_fim_prevista?: string
          p_data_inicio_prevista?: string
          p_descricao?: string
          p_duracao_estimada_horas: number
          p_equipe_prevista: number
          p_instrucoes?: string
          p_local_tipo: string
          p_prioridade?: string
          p_processo_id: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_tarefa_id: string
        }
        Returns: string
      }
      criar_ordem_producao_sem_limite_v2: {
        Args: {
          p_data_fim_prevista: string
          p_data_inicio_prevista: string
          p_descricao?: string
          p_equipe_prevista?: number
          p_instrucoes?: string
          p_local_tipo: string
          p_prioridade?: string
          p_processo_id: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
        }
        Returns: string
      }
      criar_ordem_producao_sem_limite_v3: {
        Args: {
          p_data_fim_prevista: string
          p_data_inicio_prevista: string
          p_descricao?: string
          p_equipe_prevista?: number
          p_instrucoes?: string
          p_local_tipo: string
          p_prioridade?: string
          p_processo_id: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_tarefa_id: string
        }
        Returns: string
      }
      criar_peca_planejamento_v1: {
        Args: {
          p_codigo?: string
          p_nome: string
          p_planejamento_projeto_id?: string
          p_quantidade?: number
        }
        Returns: Json
      }
      criar_perfil_acesso: { Args: { p_tipo_usuario: string }; Returns: string }
      criar_processo_producao: {
        Args: {
          p_codigo?: string
          p_descricao?: string
          p_nome: string
          p_prioridade?: string
          p_produto_entregavel?: string
          p_projeto_id: string
          p_quantidade_planejada?: number
          p_unidade_medida?: string
        }
        Returns: string
      }
      criar_tarefa_producao: {
        Args: { p_categoria?: string; p_nome: string }
        Returns: string
      }
      descartar_jornada_op_v1: {
        Args: { p_jornada_id: string; p_motivo: string }
        Returns: Json
      }
      diagnosticar_integridade_modulo_producao: { Args: never; Returns: Json }
      editar_apontamento_producao: {
        Args: {
          p_apontamento_id: string
          p_data: string
          p_duracao_minutos: number
          p_inicio: string
          p_local_tipo: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_minutos_produtivos: number
          p_motivo_improdutivo: string
          p_observacoes: string
          p_processo_id: string
          p_projeto_local_id: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: undefined
      }
      editar_movimentacao_v1: {
        Args: {
          p_local_utilizacao_id: string
          p_movimento_id: string
          p_quantidade: number
        }
        Returns: Json
      }
      editar_ordem_producao_planejamento_v1: {
        Args: {
          p_data_fim_prevista?: string
          p_data_inicio_prevista?: string
          p_descricao?: string
          p_duracao_estimada_horas: number
          p_equipe_prevista: number
          p_instrucoes?: string
          p_justificativa?: string
          p_local_tipo: string
          p_ordem_producao_id: string
          p_prioridade?: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_tarefa_id?: string
        }
        Returns: undefined
      }
      editar_ordem_producao_v1: {
        Args: {
          p_data_fim_prevista: string
          p_data_inicio_prevista: string
          p_descricao?: string
          p_equipe_prevista?: number
          p_instrucoes?: string
          p_justificativa?: string
          p_local_tipo: string
          p_ordem_producao_id: string
          p_prioridade?: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
        }
        Returns: undefined
      }
      editar_ordem_producao_v2: {
        Args: {
          p_data_fim_prevista: string
          p_data_inicio_prevista: string
          p_descricao?: string
          p_equipe_prevista?: number
          p_instrucoes?: string
          p_justificativa?: string
          p_local_tipo: string
          p_ordem_producao_id: string
          p_prioridade?: string
          p_quantidade_planejada: number
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_tarefa_id?: string
        }
        Returns: undefined
      }
      enviar_necessidade_fabricacao_v1: {
        Args: {
          p_observacoes?: string
          p_planejamento_item_id: string
          p_quantidade?: number
        }
        Returns: string
      }
      excluir_apontamento_producao_admin: {
        Args: { p_apontamento_id: string }
        Returns: undefined
      }
      excluir_movimentacao_v1: {
        Args: { p_movimento_id: string }
        Returns: Json
      }
      excluir_processo_producao: {
        Args: {
          p_codigo_confirmacao: string
          p_justificativa: string
          p_processo_id: string
        }
        Returns: undefined
      }
      excluir_projeto_producao_v1: {
        Args: { p_nome_confirmacao: string; p_projeto_id: string }
        Returns: Json
      }
      finalizar_jornada_op_com_consumos_v1: {
        Args: {
          p_concluir_op: boolean
          p_consumos_tinta: Json
          p_horarios_membros: Json
          p_jornada_id: string
          p_justificativa_conclusao: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_motivo_improdutivo: string
          p_motivo_regularizacao: string
          p_observacoes: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: Json
      }
      finalizar_jornada_op_com_consumos_v2: {
        Args: {
          p_concluir_op: boolean
          p_consumos_tinta: Json
          p_demao_numero: number
          p_horarios_membros: Json
          p_jornada_id: string
          p_justificativa_conclusao: string
          p_membros: string[]
          p_minutos_improdutivos: number
          p_motivo_improdutivo: string
          p_motivo_regularizacao: string
          p_observacoes: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: Json
      }
      finalizar_jornada_op_v1: {
        Args: {
          p_concluir_op?: boolean
          p_horarios_membros?: Json
          p_jornada_id: string
          p_justificativa_conclusao?: string
          p_membros?: string[]
          p_minutos_improdutivos?: number
          p_motivo_improdutivo?: string
          p_motivo_regularizacao?: string
          p_observacoes?: string
          p_quantidade_produzida: number
          p_tarefa_id: string
          p_termino: string
        }
        Returns: Json
      }
      finalizar_ordem_producao_com_conferencia_v1: {
        Args: { p_justificativa?: string; p_ordem_producao_id: string }
        Returns: Json
      }
      financeiro_criar_necessidade_manual: {
        Args: {
          p_categoria?: string
          p_data_necessidade?: string
          p_data_prevista_desembolso?: string
          p_descricao: string
          p_projeto_centro_custo?: string
          p_subcategoria?: string
          p_urgencia?: string
          p_valor_estimado?: number
        }
        Returns: string
      }
      financeiro_liberar_programacao: {
        Args: { p_lancamento_id: string }
        Returns: undefined
      }
      financeiro_pagina54_extrair_cor: {
        Args: { p_dados: Json }
        Returns: string
      }
      financeiro_pagina54_marcar_exportado: {
        Args: { p_erro?: string; p_integracao_id: string; p_ok: boolean }
        Returns: Json
      }
      financeiro_pagina54_normalizar_cor: {
        Args: { p_cor: string }
        Returns: string
      }
      financeiro_pagina54_receber_linha: {
        Args: {
          p_aba: string
          p_dados: Json
          p_linha: number
          p_spreadsheet_id: string
          p_spreadsheet_titulo: string
        }
        Returns: Json
      }
      financeiro_pagina54_situacao: {
        Args: { p_status: string }
        Returns: string
      }
      financeiro_pagina54_status: {
        Args: { p_situacao: string }
        Returns: string
      }
      financeiro_parse_data_br: { Args: { p_texto: string }; Returns: string }
      financeiro_parse_moeda_br: { Args: { p_texto: string }; Returns: number }
      financeiro_parse_timestamp_pagina54: {
        Args: { p_texto: string }
        Returns: string
      }
      financeiro_registrar_auditoria: {
        Args: {
          p_acao: string
          p_detalhes?: Json
          p_entidade: string
          p_entidade_id: string
          p_lancamento_id: string
        }
        Returns: undefined
      }
      financeiro_sincronizar_rc: {
        Args: { p_pedido_id: string }
        Returns: string
      }
      financeiro_usuario_nome: { Args: { p_user_id: string }; Returns: string }
      gerar_proximo_codigo: { Args: never; Returns: string }
      gerar_solicitacao_material_op: {
        Args: { p_estoque_id: string; p_ordem_producao_id: string }
        Returns: {
          created_at: string
          data_limite_separacao: string
          ja_existia: boolean
          numero: number
          solicitacao_id: string
          status: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      ignorar_programacao_planejamento_v1: {
        Args: { p_agenda_id: string }
        Returns: undefined
      }
      incorporar_materiais_pcp_op: {
        Args: { p_ordem_producao_id: string }
        Returns: number
      }
      iniciar_jornada_op_com_equipe_v1: {
        Args: { p_membros: string[]; p_ordem_producao_id: string }
        Returns: Json
      }
      iniciar_jornada_op_v1: {
        Args: { p_ordem_producao_id: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_gestor_or_admin: { Args: never; Returns: boolean }
      listar_consumo_tinta_por_projeto_v1: {
        Args: never
        Returns: {
          consumo_tinta_ml: number
          projeto_id: string
          registros_tinta: number
        }[]
      }
      listar_consumos_tinta_historico_v1: {
        Args: never
        Returns: {
          apontamento_id: string
          cor: string
          created_at: string
          id: string
          ordem_producao_id: string
          quantidade_ml: number
        }[]
      }
      listar_divergencias_planejamento_v1: {
        Args: never
        Returns: {
          created_at: string
          detalhes: Json
          diferenca: number
          id: string
          item_nome: string
          planejamento_item_id: string
          status: string
          tipo: string
          valor_anterior: number
          valor_novo: number
        }[]
      }
      listar_estimativas_ops_v1: {
        Args: never
        Returns: {
          duracao_estimada_horas: number
          esforco_estimado_horas_homem: number
          ordem_producao_id: string
        }[]
      }
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
          ordens: Json
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
      listar_jornada_producao_gerencial: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_membro_id?: string
        }
        Returns: {
          aproveitamento_percentual: number
          data: string
          eficiencia_percentual: number
          jornada_prevista_minutos: number
          membro_id: string
          membro_nome: string
          minutos_apontados: number
          minutos_extras: number
          minutos_improdutivos: number
          minutos_produtivos: number
          minutos_sem_apontamento: number
          ocupacao_percentual: number
        }[]
      }
      listar_jornadas_op_abertas_v1: {
        Args: never
        Returns: {
          contexto_atualizado_em: string
          horarios_membros_rascunho: Json
          id: string
          iniciado_em: string
          iniciado_por_id: string
          iniciado_por_nome_snapshot: string
          justificativa_conclusao_rascunho: string
          membros_ids: string[]
          minutos_improdutivos_rascunho: number
          motivo_improdutivo_rascunho: string
          motivo_regularizacao_rascunho: string
          observacoes_rascunho: string
          ordem_producao_id: string
          pendente_dia_anterior: boolean
          quantidade_produzida_rascunho: number
          tarefa_id: string
          termino_rascunho: string
        }[]
      }
      listar_jornadas_op_abertas_v2: {
        Args: never
        Returns: {
          contexto_atualizado_em: string
          horarios_membros_rascunho: Json
          id: string
          iniciado_em: string
          iniciado_por_id: string
          iniciado_por_nome_snapshot: string
          interrompida_em: string
          justificativa_conclusao_rascunho: string
          membros_ids: string[]
          minutos_improdutivos_rascunho: number
          motivo_improdutivo_rascunho: string
          motivo_regularizacao_rascunho: string
          observacoes_rascunho: string
          ordem_producao_id: string
          pendente_dia_anterior: boolean
          quantidade_produzida_rascunho: number
          tarefa_id: string
          termino_rascunho: string
        }[]
      }
      listar_led_previsto_real_v1: {
        Args: never
        Returns: {
          projeto_id: string
          projeto_nome: string
          registros: number
          saldo: number
          testes_ok: number
          total_aplicado: number
          total_previsto: number
        }[]
      }
      listar_membros_ocupados_jornadas_v1: {
        Args: never
        Returns: {
          atividade: string
          iniciado_em: string
          jornada_id: string
          membro_id: string
          membro_nome: string
          ordem_numero: number
          ordem_producao_id: string
        }[]
      }
      listar_movimentacoes_paginadas_v1: {
        Args: {
          p_busca?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_estoque_id?: string
          p_incluir_sem_estoque?: boolean
          p_limite?: number
          p_local_utilizacao_id?: string
          p_pagina?: number
          p_subcategoria_ids?: string[]
          p_tipo?: string
          p_tipo_item?: string
          p_tipo_operacao_id?: string
          p_visualizacao?: string
        }
        Returns: Json
      }
      listar_movimentacoes_paginadas_v2: {
        Args: {
          p_busca?: string
          p_categoria_id?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_estoque_id?: string
          p_incluir_sem_estoque?: boolean
          p_limite?: number
          p_local_utilizacao_id?: string
          p_pagina?: number
          p_subcategoria_ids?: string[]
          p_tipo?: string
          p_tipo_item?: string
          p_tipo_operacao_id?: string
          p_visualizacao?: string
        }
        Returns: Json
      }
      listar_necessidades_fabricacao_v1: {
        Args: never
        Returns: {
          calculo_snapshot: Json
          created_at: string
          id: string
          item_nome: string
          observacoes: string
          ordem_numero: number
          ordem_producao_id: string
          planejamento_item_id: string
          processo_id: string
          processo_nome: string
          projetos_snapshot: Json
          quantidade: number
          status: string
        }[]
      }
      listar_ops_pintura_pendentes_v1: {
        Args: never
        Returns: {
          ordem_producao_id: string
        }[]
      }
      listar_ordens_producao: {
        Args: { p_processo_id?: string; p_status?: string }
        Returns: {
          created_at: string
          criado_por_id: string
          criado_por_nome_snapshot: string
          data_fim_prevista: string
          data_fim_real: string
          data_inicio_prevista: string
          data_inicio_real: string
          descricao: string
          equipe_prevista: number
          id: string
          instrucoes: string
          local_tipo: string
          motivo_cancelamento: string
          numero: number
          percentual_realizado: number
          prioridade: string
          processo_codigo: string
          processo_id: string
          processo_nome: string
          produto_entregavel: string
          projeto_cidade: string
          projeto_id: string
          projeto_nome: string
          projeto_uf: string
          quantidade_planejada: number
          quantidade_realizada: number
          responsavel_id: string
          responsavel_nome_snapshot: string
          status: string
          unidade_medida: string
          updated_at: string
        }[]
      }
      listar_ordens_producao_v2: {
        Args: { p_processo_id?: string; p_status?: string }
        Returns: {
          created_at: string
          criado_por_id: string
          criado_por_nome_snapshot: string
          data_fim_prevista: string
          data_fim_real: string
          data_inicio_prevista: string
          data_inicio_real: string
          descricao: string
          equipe_prevista: number
          id: string
          instrucoes: string
          local_tipo: string
          motivo_cancelamento: string
          numero: number
          percentual_realizado: number
          prioridade: string
          processo_codigo: string
          processo_id: string
          processo_nome: string
          produto_entregavel: string
          projeto_cidade: string
          projeto_id: string
          projeto_nome: string
          projeto_uf: string
          quantidade_planejada: number
          quantidade_realizada: number
          responsavel_id: string
          responsavel_nome_snapshot: string
          status: string
          tarefa_id: string
          tarefa_nome_snapshot: string
          unidade_medida: string
          updated_at: string
        }[]
      }
      listar_painel_gerencial_producao_v1: {
        Args: never
        Returns: {
          cliente: string
          custo_mao_obra: number
          custo_mao_obra_incompleto: boolean
          custo_materiais: number
          custo_materiais_incompleto: boolean
          data_fim_prevista: string
          data_inicio_prevista: string
          etapas: Json
          etapas_concluidas: number
          etapas_total: number
          horas_homem: number
          local_utilizacao_id: string
          membros_distintos: number
          ops_concluidas: number
          ops_total: number
          percentual_realizado: number
          projeto_id: string
          projeto_nome: string
          ultima_atualizacao: string
        }[]
      }
      listar_painel_gerencial_producao_v2: { Args: never; Returns: Json }
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
      listar_planejamento_producao_v1: { Args: never; Returns: Json }
      listar_planejamento_producao_v2: { Args: never; Returns: Json }
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
      listar_posicoes_estoque_exportacao_v1: {
        Args: {
          p_estoque_id: string
          p_incluir_sem_estoque?: boolean
          p_item_ids?: string[]
        }
        Returns: {
          item_id: string
          saldo_atual: number
          ultima_movimentacao: Json
        }[]
      }
      listar_programacao_diaria_integrada_v1: {
        Args: { p_data_inicio: string; p_dias?: number }
        Returns: {
          atividade_planejada: string
          data: string
          equipe_prevista: string
          id: string
          meta: string
          ordem_numero: number
          ordem_producao_id: string
          prioridade: string
          processo_id: string
          processo_nome: string
          projeto_id: string
          projeto_nome: string
          status: string
          turno: string
        }[]
      }
      listar_reservas_acervo_v1: {
        Args: never
        Returns: {
          acervo_codigo: string
          acervo_id: string
          acervo_nome: string
          data_fim: string
          data_inicio: string
          id: string
          observacoes: string
          project_group_id: string
          projeto_nome: string
          quantidade: number
          status: string
        }[]
      }
      listar_resumo_demaos_pintura_v1: {
        Args: never
        Returns: {
          demaos_registradas: number
          ordem_producao_id: string
          proxima_demao: number
          ultima_demao: number
        }[]
      }
      listar_saldos_estoque_v1: {
        Args: { p_estoque_id?: string; p_incluir_sem_estoque?: boolean }
        Returns: {
          item_id: string
          saldo_atual: number
          ultima_movimentacao: Json
        }[]
      }
      listar_tinta_previsto_real_v1: {
        Args: never
        Returns: {
          desvio_ml: number
          material_categoria: string
          projeto_id: string
          projeto_nome: string
          volume_previsto_ml: number
          volume_real_ml: number
        }[]
      }
      make_user_admin_by_email: {
        Args: { user_email: string }
        Returns: undefined
      }
      membros_ultimo_apontamento_op_v1: {
        Args: { p_ordem_producao_id: string }
        Returns: string[]
      }
      nome_usuario_producao: { Args: { p_user_id: string }; Returns: string }
      normalizar_nome_peca_v1: { Args: { p_valor: string }; Returns: string }
      obter_minhas_permissoes: { Args: never; Returns: Json }
      obter_proximo_codigo_etapa_producao: { Args: never; Returns: string }
      obter_resumo_exclusao_processo_producao: {
        Args: { p_processo_id: string }
        Returns: {
          codigo: string
          motivo_bloqueio: string
          nome: string
          pode_excluir: boolean
          processo_id: string
          status: string
          total_alertas: number
          total_alocacoes: number
          total_apontamentos: number
          total_apontamentos_conferidos: number
          total_dependencias: number
          total_eventos: number
        }[]
      }
      obter_resumo_finalizacao_processo: {
        Args: { p_processo_id: string }
        Returns: {
          apontamentos_pendentes: number
          horas_homem: number
          minutos_improdutivos: number
          minutos_produtivos: number
          minutos_totais: number
          percentual_conclusao: number
          quantidade_planejada: number
          quantidade_realizada: number
          total_apontamentos: number
        }[]
      }
      ordem_producao_e_pintura_v1: {
        Args: { p_ordem_producao_id: string }
        Returns: boolean
      }
      permissao_individual_efetiva: {
        Args: { p_permissao: string; p_user_id: string }
        Returns: boolean
      }
      permissao_individual_efetiva_por_perfil: {
        Args: { p_permissao: string; p_tipo: string }
        Returns: boolean
      }
      pode_acessar_modulo_producao_atual: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      promote_user_to_admin: {
        Args: { target_email: string }
        Returns: undefined
      }
      proxima_demao_pintura_v1: {
        Args: { p_ordem_producao_id: string }
        Returns: number
      }
      proximo_codigo_etapa_producao_definitivo: { Args: never; Returns: string }
      proximo_numero_ordem_producao: { Args: never; Returns: number }
      recalcular_cronograma_producao: { Args: never; Returns: string }
      recalcular_cronograma_producao_interno: {
        Args: { p_usuario_id: string; p_usuario_nome: string }
        Returns: string
      }
      recalcular_status_projeto_producao: {
        Args: { p_projeto_id: string }
        Returns: undefined
      }
      reclassificar_ordem_producao_etapa_v1: {
        Args: {
          p_justificativa?: string
          p_nova_etapa_id: string
          p_ordem_producao_id: string
        }
        Returns: Json
      }
      recovery_import_production_20260912: {
        Args: { p_rows: Json; p_table: string; p_token: string }
        Returns: Json
      }
      registrar_anexo_producao: {
        Args: {
          p_apontamento_id: string
          p_file_name: string
          p_file_path: string
          p_mime_type: string
          p_size_bytes: number
        }
        Returns: string
      }
      registrar_consumos_tinta_op_v1: {
        Args: {
          p_apontamento_id: string
          p_consumos: Json
          p_ordem_producao_id: string
        }
        Returns: Json
      }
      registrar_devolucao_lote_v1: {
        Args: { p_dados: Json; p_requisicao_id: string }
        Returns: Json
      }
      registrar_led_op_v1: {
        Args: {
          p_apontamento_id?: string
          p_especificacao?: string
          p_observacoes?: string
          p_ordem_producao_id: string
          p_origem?: string
          p_quantidade_cordoes: number
          p_status?: string
          p_teste_funcional?: boolean
          p_voltagem?: string
        }
        Returns: string
      }
      regularizar_estimativa_esforco_op_v1: {
        Args: {
          p_duracao_estimada_horas: number
          p_equipe_prevista: number
          p_ordem_producao_id: string
        }
        Returns: undefined
      }
      remover_anexo_producao: {
        Args: { p_anexo_id: string }
        Returns: {
          file_path: string
        }[]
      }
      resolver_divergencia_planejamento_v1: {
        Args: { p_acao: string; p_divergencia_id: string }
        Returns: undefined
      }
      resumo_exclusao_projeto_producao_v1: {
        Args: { p_projeto_id: string }
        Returns: Json
      }
      retificar_apontamento_producao_com_consumos_tinta_v1: {
        Args: {
          p_apontamento_id: string
          p_consumos_tinta?: Json
          p_data: string
          p_horarios_membros?: Json
          p_inicio: string
          p_membros?: string[]
          p_minutos_improdutivos?: number
          p_motivo_improdutivo?: string
          p_motivo_retificacao?: string
          p_observacoes?: string
          p_quantidade_produzida: number
          p_termino: string
        }
        Returns: Json
      }
      retificar_apontamento_producao_com_consumos_tinta_v2: {
        Args: {
          p_apontamento_id: string
          p_consumos_tinta?: Json
          p_data: string
          p_demao_numero?: number
          p_horarios_membros?: Json
          p_inicio: string
          p_membros?: string[]
          p_minutos_improdutivos?: number
          p_motivo_improdutivo?: string
          p_motivo_retificacao?: string
          p_observacoes?: string
          p_quantidade_produzida: number
          p_termino: string
        }
        Returns: Json
      }
      retificar_apontamento_producao_v2: {
        Args: {
          p_apontamento_id: string
          p_data: string
          p_horarios_membros?: Json
          p_inicio: string
          p_membros?: string[]
          p_minutos_improdutivos?: number
          p_motivo_improdutivo?: string
          p_motivo_retificacao?: string
          p_observacoes?: string
          p_quantidade_produzida: number
          p_termino: string
        }
        Returns: Json
      }
      retificar_etapa_producao: {
        Args: {
          p_aceita_producao_proporcional?: boolean
          p_capacidade_diaria?: number
          p_data_inicio_desejada?: string
          p_data_limite?: string
          p_dependencias?: Json
          p_descricao?: string
          p_grupo_cronograma?: string
          p_justificativa?: string
          p_nome: string
          p_pessoas_necessarias?: number
          p_prioridade?: string
          p_processo_id: string
          p_produto_entregavel?: string
          p_quantidade_planejada?: number
          p_sequencia?: number
          p_unidade_medida?: string
        }
        Returns: undefined
      }
      rh_atualizar_status_ponto: {
        Args: { p_registro_id: string; p_status: string }
        Returns: Json
      }
      rh_current_user_colaborador_id: { Args: never; Returns: string }
      rh_delete_colaborador: {
        Args: { p_colaborador_id: string }
        Returns: string
      }
      rh_get_meu_ponto_snapshot: { Args: { p_mes: string }; Returns: Json }
      rh_meu_ponto_disponivel: { Args: never; Returns: boolean }
      rh_registrar_meu_ponto_agora: { Args: never; Returns: Json }
      rh_remover_feriado: { Args: { p_id: string }; Returns: string }
      rh_remover_jornada: { Args: { p_id: string }; Returns: string }
      rh_salvar_colaborador: {
        Args: {
          p_ativo?: boolean
          p_cargo?: string
          p_cep?: string
          p_cidade?: string
          p_controla_ponto?: boolean
          p_cpf_cnpj?: string
          p_data_admissao?: string
          p_data_nascimento?: string
          p_departamento?: string
          p_email?: string
          p_endereco?: string
          p_estado?: string
          p_hora_extra_gera_valor?: boolean
          p_id?: string
          p_jornada_id?: string
          p_nome?: string
          p_pis?: string
          p_rh_ativo?: boolean
          p_salario?: number
          p_telefone?: string
          p_tipo_contrato?: string
          p_valor_contrato?: number
        }
        Returns: string
      }
      rh_set_colaborador_contextos: {
        Args: {
          p_colaborador_id: string
          p_pista_ativo: boolean
          p_rh_ativo: boolean
        }
        Returns: undefined
      }
      rh_update_colaborador_fields: {
        Args: {
          p_cargo: string
          p_cep: string
          p_cidade: string
          p_colaborador_id: string
          p_controla_ponto: boolean
          p_cpf_cnpj: string
          p_data_admissao: string
          p_data_nascimento: string
          p_departamento: string
          p_email: string
          p_endereco: string
          p_estado: string
          p_hora_extra_gera_valor: boolean
          p_jornada_id: string
          p_nome: string
          p_pis: string
          p_salario: number
          p_telefone: string
          p_tipo_contrato: string
          p_valor_contrato: number
        }
        Returns: undefined
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
      salvar_contexto_jornada_op_v1: {
        Args: {
          p_horarios_membros?: Json
          p_jornada_id: string
          p_justificativa_conclusao?: string
          p_membros?: string[]
          p_minutos_improdutivos?: number
          p_motivo_improdutivo?: string
          p_motivo_regularizacao?: string
          p_observacoes?: string
          p_quantidade_produzida?: number
          p_tarefa_id: string
          p_termino?: string
        }
        Returns: undefined
      }
      salvar_horarios_membros_apontamento: {
        Args: { p_apontamento_id: string; p_horarios?: Json }
        Returns: undefined
      }
      salvar_materiais_etapa_producao: {
        Args: { p_materiais?: Json; p_processo_id: string }
        Returns: undefined
      }
      salvar_membro_producao:
        | {
            Args: {
              p_apelido?: string
              p_ativo?: boolean
              p_funcao?: string
              p_id?: string
              p_nome?: string
              p_valor_hora?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_apelido?: string
              p_ativo?: boolean
              p_funcao?: string
              p_id?: string
              p_jornada_diaria_minutos?: number
              p_nome?: string
              p_valor_hora?: number
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
      salvar_reserva_acervo_v1: {
        Args: {
          p_acervo_id: string
          p_data_fim?: string
          p_data_inicio?: string
          p_observacoes?: string
          p_project_group_id: string
          p_quantidade: number
          p_reserva_id: string
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
      sincronizar_materiais_ordem_producao: {
        Args: { p_ordem_producao_id: string }
        Returns: undefined
      }
      sincronizar_planejamento_payload_v1: {
        Args: {
          p_aba: string
          p_arquivo: string
          p_origem_usuario?: string
          p_payload: Json
        }
        Returns: Json
      }
      start_user_message_thread: {
        Args: {
          p_message: string
          p_recipient_id: string
          p_requested_date?: string
        }
        Returns: string
      }
      transicao_ordem_producao: {
        Args: {
          p_acao: string
          p_justificativa?: string
          p_ordem_producao_id: string
        }
        Returns: undefined
      }
      transicao_processo_producao: {
        Args: {
          p_acao: string
          p_justificativa?: string
          p_processo_id: string
        }
        Returns: undefined
      }
      usuario_pode_editar_movimentacoes_v1: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      usuario_tem_permissao_producao: {
        Args: { p_permissao: string }
        Returns: boolean
      }
      validar_demao_pintura_lote_v1: {
        Args: {
          p_demao_numero: number
          p_ordem_producao_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      vincular_material_producao: {
        Args: {
          p_apontamento_id?: string
          p_movement_id: string
          p_observacoes?: string
          p_projeto_local_id: string
        }
        Returns: string
      }
      vincular_programacao_planejamento_v1: {
        Args: {
          p_agenda_id: string
          p_ordem_producao_id?: string
          p_processo_id: string
        }
        Returns: string
      }
    }
    Enums: {
      producao_membro_origem: "solicitante" | "producao" | "legado_pendente"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      producao_membro_origem: ["solicitante", "producao", "legado_pendente"],
    },
  },
} as const
