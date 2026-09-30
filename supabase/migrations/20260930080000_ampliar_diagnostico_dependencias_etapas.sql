-- Mantém o diagnóstico alinhado às dependências efetivamente usadas pela aba Etapas.
-- Sem esta cobertura, uma migration parcial pode deixar o módulo aparentemente saudável,
-- mas falhar ao abrir qualquer Etapa ao consultar as OPs ou o PCP de materiais.

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
    'criar_processo_producao',
    'criar_etapa_producao',
    'salvar_planejamento_etapa_producao',
    'retificar_etapa_producao',
    'transicao_processo_producao',
    'obter_resumo_finalizacao_processo',
    'obter_resumo_exclusao_processo_producao',
    'excluir_processo_producao',
    'obter_proximo_codigo_etapa_producao',
    'criar_ordem_producao_sem_limite_v2',
    'listar_ordens_producao',
    'editar_ordem_producao_v1',
    'transicao_ordem_producao',
    'finalizar_ordem_producao_com_conferencia_v1',
    'salvar_materiais_etapa_producao',
    'incorporar_materiais_pcp_op',
    'gerar_solicitacao_material_op',
    'recalcular_cronograma_producao_interno',
    'recalcular_cronograma_producao',
    'salvar_configuracao_cronograma_producao',
    'listar_gantt_producao',
    'listar_plano_diario_producao',
    'criar_tarefa_producao',
    'salvar_membro_producao',
    'criar_apontamento_producao',
    'editar_apontamento_producao',
    'cancelar_apontamento_producao',
    'conferir_apontamento_producao',
    'registrar_anexo_producao',
    'remover_anexo_producao',
    'vincular_material_producao',
    'usuario_tem_permissao_producao'
  ];
  v_tabelas TEXT[] := ARRAY[
    'producao_projetos',
    'producao_processos',
    'producao_processo_eventos',
    'producao_ordens_producao',
    'producao_apontamentos',
    'producao_apontamento_eventos',
    'producao_membros',
    'producao_tarefas',
    'producao_apontamento_membros',
    'producao_etapa_materiais',
    'producao_ordem_materiais',
    'producao_cronograma_configuracoes',
    'producao_processo_dependencias',
    'producao_alocacoes_diarias',
    'producao_cronograma_alertas',
    'solicitacoes_material'
  ];
  v_funcoes_ausentes TEXT[];
  v_tabelas_ausentes TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT ARRAY_AGG(nome ORDER BY nome)
    INTO v_funcoes_ausentes
  FROM UNNEST(v_funcoes) AS nome
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = nome
  );

  SELECT ARRAY_AGG(nome ORDER BY nome)
    INTO v_tabelas_ausentes
  FROM UNNEST(v_tabelas) AS nome
  WHERE TO_REGCLASS('public.' || nome) IS NULL;

  RETURN JSONB_BUILD_OBJECT(
    'ok',
      COALESCE(CARDINALITY(v_funcoes_ausentes), 0) = 0
      AND COALESCE(CARDINALITY(v_tabelas_ausentes), 0) = 0,
    'funcoes_ausentes', COALESCE(TO_JSONB(v_funcoes_ausentes), '[]'::JSONB),
    'tabelas_ausentes', COALESCE(TO_JSONB(v_tabelas_ausentes), '[]'::JSONB),
    'verificado_em', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diagnosticar_integridade_modulo_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnosticar_integridade_modulo_producao() TO authenticated;
