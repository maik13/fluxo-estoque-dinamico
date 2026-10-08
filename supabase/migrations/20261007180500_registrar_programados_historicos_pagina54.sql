-- Registra exclusivamente os lançamentos históricos já marcados como
-- "programado" na Página54 importada da planilha oficial. Não altera o
-- fluxo futuro de aprovação ou programação do sistema.

UPDATE public.financeiro_lancamentos
SET liberado_programacao_em = COALESCE(liberado_programacao_em, now()),
    liberado_programacao_por_nome = COALESCE(
      liberado_programacao_por_nome,
      'Importação Página54'
    ),
    updated_at = now()
WHERE origem_tipo = 'pagina54'
  AND status = 'programado'
  AND tipo = 'saida';

INSERT INTO public.financeiro_programacoes(
  lancamento_id,
  beneficiario,
  valor,
  vencimento,
  data_programada,
  categoria,
  projeto_centro_custo,
  observacao,
  status,
  programado_por_guto_em,
  registrado_por_nome
)
SELECT
  l.id,
  COALESCE(NULLIF(l.descricao, ''), 'Lançamento Página54'),
  COALESCE(l.valor_previsto, 0),
  l.data_prevista,
  COALESCE(l.data_prevista, CURRENT_DATE),
  l.categoria,
  l.projeto_centro_custo,
  'Programação histórica importada da Página54',
  'programado',
  now(),
  'Importação Página54'
FROM public.financeiro_lancamentos l
WHERE l.origem_tipo = 'pagina54'
  AND l.status = 'programado'
  AND l.tipo = 'saida'
  AND NOT EXISTS (
    SELECT 1
    FROM public.financeiro_programacoes p
    WHERE p.lancamento_id = l.id
      AND p.status IN ('aguardando_programacao', 'programado')
  );
