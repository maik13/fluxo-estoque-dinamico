-- Um mesmo Task UID identifica a atividade do Project. Atividades diferentes
-- podem compartilhar o nome (por exemplo, dois "Frete") na mesma etapa.
-- O bloqueio de OP legada só deve considerar OPs que não vieram deste import.
DO $migration$
DECLARE
  v_definicao text;
  v_trecho_antigo text := $antigo$
    IF EXISTS (
      SELECT 1 FROM public.producao_ordens_producao o
      WHERE o.projeto_id = v_projeto.id AND o.processo_id = v_etapa.id AND o.status <> 'cancelada'
        AND lower(btrim(coalesce(o.tarefa_nome_snapshot, o.descricao, ''))) = lower(btrim(v_tarefa.nome))
    ) THEN
      RAISE EXCEPTION 'OP correlata não confirmada para Task UID %; lote revertido para preservar OP/AP/PCP', v_task_uid;
    END IF;
$antigo$;
  v_trecho_novo text := $novo$
    IF EXISTS (
      SELECT 1 FROM public.producao_ordens_producao o
      WHERE o.projeto_id = v_projeto.id AND o.processo_id = v_etapa.id AND o.status <> 'cancelada'
        AND coalesce(o.instrucoes, '') NOT LIKE 'MSP-v24 | Task UID %'
        AND lower(btrim(coalesce(o.tarefa_nome_snapshot, o.descricao, ''))) = lower(btrim(v_tarefa.nome))
    ) THEN
      RAISE EXCEPTION 'OP correlata não confirmada para Task UID %; lote revertido para preservar OP/AP/PCP', v_task_uid;
    END IF;
$novo$;
BEGIN
  SELECT pg_get_functiondef('public.importar_ops_reais_msproject_natal_v24(jsonb)'::regprocedure)
  INTO v_definicao;

  IF position(v_trecho_antigo IN v_definicao) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a regra de conciliação da importação MSP v24';
  END IF;

  EXECUTE replace(v_definicao, v_trecho_antigo, v_trecho_novo);
END;
$migration$;

NOTIFY pgrst, 'reload schema';
