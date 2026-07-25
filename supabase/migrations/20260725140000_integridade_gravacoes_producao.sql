-- Revisão consolidada de integridade do Módulo de Produção.
-- Faz a ponte entre as permissões atuais e as RPCs/policies legadas,
-- padroniza a leitura das tabelas e cria diagnóstico de dependências.

BEGIN;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_producao(p_permissao TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_atual BOOLEAN := FALSE;
  v_legado public.producao_permissoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- Permissões atuais. BI isolado não libera o módulo operacional.
  BEGIN
    v_atual := CASE p_permissao
      WHEN 'visualizar' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_conferir_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'auditoria' THEN
        public.permissao_individual_efetiva(v_user, 'pode_conferir_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'projetos' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'processos' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'finalizar' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_conferir_producao')
      WHEN 'reabrir' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'lancar' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'editar_apontamento' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'cancelar_apontamento' THEN
        public.permissao_individual_efetiva(v_user, 'pode_conferir_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'conferir_apontamento' THEN
        public.permissao_individual_efetiva(v_user, 'pode_conferir_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'tarefas' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'membros' THEN
        public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'vincular_membros' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'anexos' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      WHEN 'materiais' THEN
        public.permissao_individual_efetiva(v_user, 'pode_apontar_producao')
        OR public.permissao_individual_efetiva(v_user, 'pode_configurar_producao')
      ELSE FALSE
    END;
  EXCEPTION WHEN undefined_function OR undefined_table THEN
    v_atual := FALSE;
  END;

  IF COALESCE(v_atual, FALSE) THEN
    RETURN TRUE;
  END IF;

  -- Compatibilidade temporária com o modelo legado.
  BEGIN
    SELECT * INTO v_legado
    FROM public.producao_permissoes
    WHERE user_id = v_user;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    RETURN CASE p_permissao
      WHEN 'visualizar' THEN v_legado.pode_visualizar OR v_legado.pode_gerenciar_processos
      WHEN 'auditoria' THEN v_legado.pode_visualizar_auditoria
      WHEN 'projetos' THEN v_legado.pode_gerenciar_projetos OR v_legado.pode_gerenciar_processos
      WHEN 'processos' THEN v_legado.pode_gerenciar_processos
      WHEN 'finalizar' THEN v_legado.pode_finalizar_processos OR v_legado.pode_gerenciar_processos
      WHEN 'reabrir' THEN v_legado.pode_reabrir_processos OR v_legado.pode_gerenciar_processos
      WHEN 'lancar' THEN v_legado.pode_lancar_apontamentos
      WHEN 'editar_apontamento' THEN v_legado.pode_editar_apontamentos
      WHEN 'cancelar_apontamento' THEN v_legado.pode_cancelar_apontamentos
      WHEN 'conferir_apontamento' THEN v_legado.pode_conferir_apontamentos
      WHEN 'tarefas' THEN v_legado.pode_gerenciar_tarefas
      WHEN 'membros' THEN v_legado.pode_gerenciar_membros
      WHEN 'vincular_membros' THEN v_legado.pode_vincular_membros
      WHEN 'anexos' THEN v_legado.pode_gerenciar_anexos
      WHEN 'materiais' THEN v_legado.pode_lancar_apontamentos OR v_legado.pode_gerenciar_processos
      ELSE FALSE
    END;
  EXCEPTION WHEN undefined_table THEN
    RETURN FALSE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_tem_permissao_producao(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao_producao(TEXT) TO authenticated;

-- Atualiza todas as policies de leitura usadas pelo módulo.
DO $$
DECLARE
  v_tabela TEXT;
  v_policy RECORD;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'producao_projetos',
    'producao_processos',
    'producao_processo_eventos',
    'producao_apontamentos',
    'producao_apontamento_eventos',
    'producao_membros',
    'producao_tarefas',
    'producao_apontamento_membros',
    'producao_apontamento_anexos',
    'producao_materiais_projeto',
    'producao_cronograma_configuracoes',
    'producao_processo_dependencias',
    'producao_alocacoes_diarias',
    'producao_cronograma_alertas'
  ]
  LOOP
    IF to_regclass('public.' || v_tabela) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabela);

      FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_tabela
          AND cmd = 'SELECT'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_tabela);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.usuario_tem_permissao_producao(''visualizar''))',
        v_tabela || '_leitura_atual',
        v_tabela
      );
    END IF;
  END LOOP;
END $$;

-- Gravação segura do vínculo de materiais; evita INSERT direto bloqueado por RLS.
CREATE OR REPLACE FUNCTION public.vincular_material_producao(
  p_movement_id UUID,
  p_projeto_local_id UUID,
  p_apontamento_id UUID DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mov public.movements%ROWTYPE;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('materiais') THEN
    RAISE EXCEPTION 'Sem permissão para vincular materiais à Produção';
  END IF;

  SELECT * INTO v_mov
  FROM public.movements
  WHERE id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A movimentação informada não existe';
  END IF;

  IF v_mov.local_utilizacao_id IS NULL OR v_mov.local_utilizacao_id <> p_projeto_local_id THEN
    RAISE EXCEPTION 'O projeto/local deve ser o mesmo da movimentação oficial';
  END IF;

  IF COALESCE(v_mov.quantidade, 0) <= 0 THEN
    RAISE EXCEPTION 'A movimentação precisa ter quantidade maior que zero';
  END IF;

  INSERT INTO public.producao_materiais_projeto (
    movement_id,
    projeto_local_id,
    apontamento_id,
    tipo,
    item_id,
    quantidade,
    item_snapshot,
    observacoes_producao
  ) VALUES (
    v_mov.id,
    v_mov.local_utilizacao_id,
    p_apontamento_id,
    v_mov.tipo,
    v_mov.item_id,
    v_mov.quantidade,
    v_mov.item_snapshot,
    NULLIF(BTRIM(p_observacoes), '')
  )
  ON CONFLICT (movement_id) DO UPDATE SET
    apontamento_id = EXCLUDED.apontamento_id,
    observacoes_producao = EXCLUDED.observacoes_producao
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_material_producao(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_material_producao(UUID, UUID, UUID, TEXT) TO authenticated;

-- Diagnóstico usado pelo frontend para detectar migrations ausentes antes de salvar.
CREATE OR REPLACE FUNCTION public.diagnosticar_integridade_modulo_producao()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_funcoes TEXT[] := ARRAY[
    'configurar_projeto_producao',
    'criar_etapa_producao',
    'salvar_planejamento_etapa_producao',
    'transicao_processo_producao',
    'obter_resumo_finalizacao_processo',
    'listar_gantt_producao',
    'listar_plano_diario_producao',
    'recalcular_cronograma_producao',
    'salvar_configuracao_cronograma_producao',
    'criar_tarefa_producao',
    'salvar_membro_producao',
    'criar_apontamento_producao',
    'editar_apontamento_producao',
    'cancelar_apontamento_producao',
    'conferir_apontamento_producao',
    'registrar_anexo_producao',
    'remover_anexo_producao',
    'vincular_material_producao',
    'obter_proximo_codigo_etapa_producao'
  ];
  v_ausentes TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT ARRAY_AGG(nome ORDER BY nome)
  INTO v_ausentes
  FROM UNNEST(v_funcoes) AS nome
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = nome
  );

  RETURN jsonb_build_object(
    'ok', COALESCE(cardinality(v_ausentes), 0) = 0,
    'funcoes_ausentes', COALESCE(to_jsonb(v_ausentes), '[]'::jsonb),
    'verificado_em', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diagnosticar_integridade_modulo_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnosticar_integridade_modulo_producao() TO authenticated;

COMMIT;
