BEGIN;

-- Gênesis: preserva a tentativa anterior antes de qualquer correção.
CREATE SCHEMA IF NOT EXISTS backup_genesis_planejamento_20260928;

CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_acervo_cenografico
AS TABLE public.producao_acervo_cenografico WITH DATA;
CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_planejamento_projetos
AS TABLE public.producao_planejamento_projetos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_planejamento_itens
AS TABLE public.producao_planejamento_itens WITH DATA;
CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_planejamento_agenda
AS TABLE public.producao_planejamento_agenda WITH DATA;
CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_parametros_padrao
AS TABLE public.producao_parametros_padrao WITH DATA;
CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.producao_planejamento_fontes
AS TABLE public.producao_planejamento_fontes WITH DATA;

CREATE TABLE IF NOT EXISTS backup_genesis_planejamento_20260928.metadados (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);
INSERT INTO backup_genesis_planejamento_20260928.metadados (id, motivo)
VALUES (1, 'Backup anterior à execução do Prompt Gênesis em 28/09/2026')
ON CONFLICT (id) DO NOTHING;

-- A tabela de Agenda passa a ser staging técnico. Não é uma entidade operacional.
ALTER TABLE public.producao_planejamento_agenda
  ADD COLUMN IF NOT EXISTS project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_producao_id uuid REFERENCES public.producao_ordens_producao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integracao_status text NOT NULL DEFAULT 'pendente'
    CHECK (integracao_status IN ('pendente','vinculado','ignorado','migrado')),
  ADD COLUMN IF NOT EXISTS integrado_em timestamptz;

UPDATE public.producao_planejamento_agenda a
SET project_group_id = pp.project_group_id
FROM public.producao_planejamento_projetos pp
WHERE pp.chave = a.projeto_chave
  AND a.project_group_id IS NULL
  AND pp.project_group_id IS NOT NULL;

-- Linhas completamente vazias não são programação.
DELETE FROM public.producao_planejamento_agenda
WHERE tipo = 'turno'
  AND NULLIF(BTRIM(COALESCE(frente, '')), '') IS NULL
  AND NULLIF(BTRIM(COALESCE(descricao, '')), '') IS NULL
  AND NULLIF(BTRIM(COALESCE(meta, '')), '') IS NULL;

-- Reservas do acervo: disponibilidade real = físico - reservado.
CREATE TABLE IF NOT EXISTS public.producao_acervo_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acervo_id uuid NOT NULL REFERENCES public.producao_acervo_cenografico(id) ON DELETE RESTRICT,
  project_group_id uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  data_inicio date,
  data_fim date,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada','encerrada')),
  observacoes text,
  criado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS producao_acervo_reservas_acervo_idx
  ON public.producao_acervo_reservas(acervo_id);
CREATE INDEX IF NOT EXISTS producao_acervo_reservas_grupo_idx
  ON public.producao_acervo_reservas(project_group_id);
CREATE INDEX IF NOT EXISTS producao_acervo_reservas_status_idx
  ON public.producao_acervo_reservas(status);

ALTER TABLE public.producao_acervo_reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_acervo_reservas_leitura ON public.producao_acervo_reservas;
CREATE POLICY producao_acervo_reservas_leitura
ON public.producao_acervo_reservas
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

-- Marcos são entidade oficial do Cronograma; deixam de depender da Agenda de staging.
CREATE TABLE IF NOT EXISTS public.producao_cronograma_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'marco' CHECK (tipo IN ('marco','gargalo')),
  titulo text NOT NULL,
  descricao text,
  prioridade text,
  status text,
  origem text,
  origem_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS producao_cronograma_marcos_origem_unique
  ON public.producao_cronograma_marcos(origem, origem_id)
  WHERE origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS producao_cronograma_marcos_data_idx
  ON public.producao_cronograma_marcos(data);

ALTER TABLE public.producao_cronograma_marcos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_cronograma_marcos_leitura ON public.producao_cronograma_marcos;
CREATE POLICY producao_cronograma_marcos_leitura
ON public.producao_cronograma_marcos
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

INSERT INTO public.producao_cronograma_marcos (
  project_group_id, data, tipo, titulo, descricao, prioridade, status, origem, origem_id
)
SELECT
  a.project_group_id,
  a.data,
  a.tipo,
  COALESCE(NULLIF(BTRIM(a.frente), ''), NULLIF(BTRIM(a.descricao), ''), 'Marco'),
  CASE WHEN NULLIF(BTRIM(a.frente), '') IS NOT NULL THEN a.descricao ELSE NULL END,
  a.prioridade,
  a.status,
  'BRUSQUE - 2026',
  a.id
FROM public.producao_planejamento_agenda a
WHERE a.tipo IN ('marco','gargalo')
  AND (
    NULLIF(BTRIM(COALESCE(a.frente, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(a.descricao, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(a.meta, '')), '') IS NOT NULL
  )
ON CONFLICT DO NOTHING;

UPDATE public.producao_planejamento_agenda
SET integracao_status = 'migrado', integrado_em = COALESCE(integrado_em, now())
WHERE tipo IN ('marco','gargalo')
  AND EXISTS (
    SELECT 1
    FROM public.producao_cronograma_marcos m
    WHERE m.origem = 'BRUSQUE - 2026'
      AND m.origem_id = producao_planejamento_agenda.id
  );

-- Programação diária oficial, vinculável a Etapa/OP. Staging não vira execução.
CREATE TABLE IF NOT EXISTS public.producao_programacao_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ordem_producao_id uuid REFERENCES public.producao_ordens_producao(id) ON DELETE SET NULL,
  data date NOT NULL,
  turno text,
  atividade_planejada text NOT NULL,
  meta text,
  equipe_prevista text,
  prioridade text,
  status text NOT NULL DEFAULT 'planejado',
  origem text,
  origem_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (processo_id IS NOT NULL OR ordem_producao_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS producao_programacao_diaria_origem_unique
  ON public.producao_programacao_diaria(origem, origem_id)
  WHERE origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS producao_programacao_diaria_data_idx
  ON public.producao_programacao_diaria(data);

ALTER TABLE public.producao_programacao_diaria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_programacao_diaria_leitura ON public.producao_programacao_diaria;
CREATE POLICY producao_programacao_diaria_leitura
ON public.producao_programacao_diaria
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

-- Log auditável de sincronização.
CREATE TABLE IF NOT EXISTS public.producao_planejamento_sincronizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id uuid REFERENCES public.producao_planejamento_fontes(id) ON DELETE SET NULL,
  arquivo text,
  aba text,
  identificador text,
  campo text,
  valor_anterior jsonb,
  valor_novo jsonb,
  resultado text NOT NULL,
  erro text,
  origem_usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS producao_planejamento_sync_created_idx
  ON public.producao_planejamento_sincronizacoes(created_at DESC);

ALTER TABLE public.producao_planejamento_sincronizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_planejamento_sync_leitura ON public.producao_planejamento_sincronizacoes;
CREATE POLICY producao_planejamento_sync_leitura
ON public.producao_planejamento_sincronizacoes
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

-- Planejamento V2: acrescenta reservas e disponibilidade real sem quebrar a V1.
CREATE OR REPLACE FUNCTION public.listar_planejamento_producao_v2()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('visualizar')
      THEN jsonb_build_object('projetos','[]'::jsonb,'itens','[]'::jsonb,'fonte',NULL)
    ELSE jsonb_build_object(
      'projetos',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'chave', p.chave,
          'nome', p.nome,
          'ativoCalculo', p.ativo_calculo,
          'ordem', p.ordem,
          'projectGroupId', p.project_group_id
        ) ORDER BY p.ordem, p.nome)
        FROM public.producao_planejamento_projetos p
      ), '[]'::jsonb),
      'itens',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id,
          'fonteLinha', i.fonte_linha,
          'nome', i.nome,
          'acervoCodigo', i.acervo_codigo_ref,
          'qtdEstoqueReferencia', i.qtd_estoque_referencia,
          'qtdEstoqueAtual', COALESCE(a.quantidade_estoque, 0),
          'qtdReservada', COALESCE(r.quantidade_reservada, 0),
          'qtdDisponivelAtual', GREATEST(COALESCE(a.quantidade_estoque, 0) - COALESCE(r.quantidade_reservada, 0), 0),
          'statusPlanilha', i.status_planilha,
          'demandas', i.demandas,
          'acervoId', a.id,
          'acervoNome', a.nome,
          'acervoCategoria', a.categoria
        ) ORDER BY i.fonte_linha)
        FROM public.producao_planejamento_itens i
        LEFT JOIN public.producao_acervo_cenografico a
          ON a.codigo = i.acervo_codigo_ref
         AND a.ativo = TRUE
        LEFT JOIN (
          SELECT acervo_id, SUM(quantidade) AS quantidade_reservada
          FROM public.producao_acervo_reservas
          WHERE status = 'ativa'
          GROUP BY acervo_id
        ) r ON r.acervo_id = a.id
        WHERE i.ativo = TRUE
      ), '[]'::jsonb),
      'fonte',
      (
        SELECT jsonb_build_object(
          'chave', f.chave,
          'nome', f.nome,
          'url', f.url,
          'modo', f.modo,
          'status', f.status,
          'ultimaSincronizacao', f.ultima_sincronizacao,
          'ultimoResultado', f.ultimo_resultado
        )
        FROM public.producao_planejamento_fontes f
        WHERE f.chave = 'brusque_2026'
        LIMIT 1
      )
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.listar_planejamento_producao_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v2() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_reservas_acervo_v1()
RETURNS TABLE (
  id uuid,
  acervo_id uuid,
  acervo_codigo text,
  acervo_nome text,
  project_group_id uuid,
  projeto_nome text,
  quantidade numeric,
  data_inicio date,
  data_fim date,
  status text,
  observacoes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id, r.acervo_id, a.codigo, a.nome,
    r.project_group_id, g.nome, r.quantidade,
    r.data_inicio, r.data_fim, r.status, r.observacoes
  FROM public.producao_acervo_reservas r
  JOIN public.producao_acervo_cenografico a ON a.id = r.acervo_id
  JOIN public.project_groups g ON g.id = r.project_group_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY r.status, g.nome, a.nome;
$$;
REVOKE ALL ON FUNCTION public.listar_reservas_acervo_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_reservas_acervo_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_reserva_acervo_v1(
  p_reserva_id uuid,
  p_acervo_id uuid,
  p_project_group_id uuid,
  p_quantidade numeric,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_estoque numeric;
  v_outras_reservas numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para reservar acervo';
  END IF;
  IF COALESCE(p_quantidade, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantidade da reserva deve ser maior que zero';
  END IF;
  IF p_data_fim IS NOT NULL AND p_data_inicio IS NOT NULL AND p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'Período da reserva inválido';
  END IF;

  SELECT quantidade_estoque INTO v_estoque
  FROM public.producao_acervo_cenografico
  WHERE id = p_acervo_id AND ativo = TRUE;

  IF v_estoque IS NULL THEN
    RAISE EXCEPTION 'Item do acervo não encontrado';
  END IF;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_outras_reservas
  FROM public.producao_acervo_reservas
  WHERE acervo_id = p_acervo_id
    AND status = 'ativa'
    AND (p_reserva_id IS NULL OR id <> p_reserva_id);

  IF v_outras_reservas + p_quantidade > v_estoque THEN
    RAISE EXCEPTION 'Reserva excede a quantidade física disponível no acervo';
  END IF;

  IF p_reserva_id IS NULL THEN
    INSERT INTO public.producao_acervo_reservas (
      acervo_id, project_group_id, quantidade, data_inicio, data_fim,
      observacoes, criado_por_id
    ) VALUES (
      p_acervo_id, p_project_group_id, p_quantidade, p_data_inicio, p_data_fim,
      p_observacoes, auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.producao_acervo_reservas
    SET acervo_id = p_acervo_id,
        project_group_id = p_project_group_id,
        quantidade = p_quantidade,
        data_inicio = p_data_inicio,
        data_fim = p_data_fim,
        observacoes = p_observacoes,
        status = 'ativa',
        updated_at = now()
    WHERE id = p_reserva_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_reserva_acervo_v1(uuid,uuid,uuid,numeric,date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_reserva_acervo_v1(uuid,uuid,uuid,numeric,date,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_reserva_acervo_v1(p_reserva_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar reserva de acervo';
  END IF;
  UPDATE public.producao_acervo_reservas
  SET status = 'cancelada', updated_at = now()
  WHERE id = p_reserva_id AND status = 'ativa';
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva ativa não encontrada'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cancelar_reserva_acervo_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_acervo_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vincular_programacao_planejamento_v1(
  p_agenda_id uuid,
  p_processo_id uuid,
  p_ordem_producao_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_agenda public.producao_planejamento_agenda%ROWTYPE;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_projeto_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para integrar programação';
  END IF;

  SELECT * INTO v_agenda
  FROM public.producao_planejamento_agenda
  WHERE id = p_agenda_id AND tipo = 'turno';

  IF v_agenda.id IS NULL THEN RAISE EXCEPTION 'Programação de staging não encontrada'; END IF;
  IF NULLIF(BTRIM(COALESCE(v_agenda.frente, '')), '') IS NULL
     AND NULLIF(BTRIM(COALESCE(v_agenda.descricao, '')), '') IS NULL
     AND NULLIF(BTRIM(COALESCE(v_agenda.meta, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Linha vazia não pode ser integrada';
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.producao_processos
  WHERE id = p_processo_id;
  IF v_projeto_id IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  IF p_ordem_producao_id IS NOT NULL THEN
    SELECT * INTO v_op
    FROM public.producao_ordens_producao
    WHERE id = p_ordem_producao_id;
    IF v_op.id IS NULL OR v_op.processo_id <> p_processo_id THEN
      RAISE EXCEPTION 'OP não pertence à Etapa informada';
    END IF;
  END IF;

  INSERT INTO public.producao_programacao_diaria (
    project_group_id, projeto_id, processo_id, ordem_producao_id,
    data, turno, atividade_planejada, meta, equipe_prevista,
    prioridade, status, origem, origem_id
  ) VALUES (
    v_agenda.project_group_id, v_projeto_id, p_processo_id, p_ordem_producao_id,
    v_agenda.data, v_agenda.turno,
    COALESCE(NULLIF(BTRIM(v_agenda.descricao), ''), NULLIF(BTRIM(v_agenda.frente), ''), v_agenda.meta),
    v_agenda.meta, v_agenda.responsavel,
    v_agenda.prioridade, COALESCE(v_agenda.status, 'planejado'),
    'BRUSQUE - 2026', v_agenda.id
  )
  ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
  DO UPDATE SET
    projeto_id = EXCLUDED.projeto_id,
    processo_id = EXCLUDED.processo_id,
    ordem_producao_id = EXCLUDED.ordem_producao_id,
    data = EXCLUDED.data,
    turno = EXCLUDED.turno,
    atividade_planejada = EXCLUDED.atividade_planejada,
    meta = EXCLUDED.meta,
    equipe_prevista = EXCLUDED.equipe_prevista,
    prioridade = EXCLUDED.prioridade,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id INTO v_id;

  UPDATE public.producao_planejamento_agenda
  SET processo_id = p_processo_id,
      ordem_producao_id = p_ordem_producao_id,
      integracao_status = 'vinculado',
      integrado_em = now(),
      updated_at = now()
  WHERE id = p_agenda_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.vincular_programacao_planejamento_v1(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_programacao_planejamento_v1(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_programacao_diaria_integrada_v1(
  p_data_inicio date,
  p_dias integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  projeto_id uuid,
  projeto_nome text,
  processo_id uuid,
  processo_nome text,
  ordem_producao_id uuid,
  ordem_numero bigint,
  data date,
  turno text,
  atividade_planejada text,
  meta text,
  equipe_prevista text,
  prioridade text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    d.id,
    d.projeto_id,
    pr.nome,
    d.processo_id,
    p.nome,
    d.ordem_producao_id,
    o.numero,
    d.data,
    d.turno,
    d.atividade_planejada,
    d.meta,
    d.equipe_prevista,
    d.prioridade,
    d.status
  FROM public.producao_programacao_diaria d
  JOIN public.producao_projetos pr ON pr.id = d.projeto_id
  JOIN public.producao_processos p ON p.id = d.processo_id
  LEFT JOIN public.producao_ordens_producao o ON o.id = d.ordem_producao_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND d.data >= p_data_inicio
    AND d.data < p_data_inicio + LEAST(GREATEST(COALESCE(p_dias, 60), 1), 180)
  ORDER BY d.data, pr.nome, p.sequencia, d.turno;
$$;
REVOKE ALL ON FUNCTION public.listar_programacao_diaria_integrada_v1(date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_programacao_diaria_integrada_v1(date,integer) TO authenticated;

COMMIT;
