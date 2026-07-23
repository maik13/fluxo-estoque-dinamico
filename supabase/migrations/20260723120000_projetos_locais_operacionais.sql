-- Separa o conceito de projeto do conceito de local operacional.
-- Um projeto pode ter vários locais/frentes: processamento, fábrica, estoque,
-- logística, execução, manutenção e outros.

BEGIN;

DROP INDEX IF EXISTS public.producao_projetos_local_utilizacao_unique;

CREATE TABLE IF NOT EXISTS public.producao_projeto_locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.producao_projetos(id) ON DELETE CASCADE,
  local_utilizacao_id UUID NULL REFERENCES public.locais_utilizacao(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro'
    CHECK (tipo IN ('processamento','fabrica','estoque','logistica','execucao','manutencao','outro')),
  cidade TEXT NULL,
  uf TEXT NULL,
  endereco TEXT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_projeto_local_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT producao_projeto_local_uf_valida CHECK (uf IS NULL OR length(btrim(uf)) = 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_projeto_locais_nome_unique
  ON public.producao_projeto_locais(projeto_id, lower(nome))
  WHERE ativo = true;
CREATE UNIQUE INDEX IF NOT EXISTS producao_projeto_locais_principal_unique
  ON public.producao_projeto_locais(projeto_id)
  WHERE principal = true AND ativo = true;
CREATE INDEX IF NOT EXISTS producao_projeto_locais_projeto_idx
  ON public.producao_projeto_locais(projeto_id, ativo, tipo);
CREATE INDEX IF NOT EXISTS producao_projeto_locais_local_utilizacao_idx
  ON public.producao_projeto_locais(local_utilizacao_id)
  WHERE local_utilizacao_id IS NOT NULL;

-- Preserva projetos legados: o antigo local único passa a ser apenas um dos
-- locais operacionais do projeto.
INSERT INTO public.producao_projeto_locais (
  projeto_id, local_utilizacao_id, nome, tipo, cidade, uf, endereco, principal, ativo
)
SELECT
  p.id,
  p.local_utilizacao_id,
  COALESCE(NULLIF(btrim(p.local_execucao), ''), l.nome, p.nome),
  CASE
    WHEN lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%fábrica%'
      OR lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%fabrica%' THEN 'fabrica'
    WHEN lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%estoque%' THEN 'estoque'
    WHEN lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%process%' THEN 'processamento'
    WHEN lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%logíst%'
      OR lower(COALESCE(l.nome, p.local_execucao, '')) LIKE '%logist%' THEN 'logistica'
    ELSE 'execucao'
  END,
  p.cidade,
  p.uf,
  p.endereco_execucao,
  true,
  p.ativo
FROM public.producao_projetos p
LEFT JOIN public.locais_utilizacao l ON l.id = p.local_utilizacao_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.producao_projeto_locais pl WHERE pl.projeto_id = p.id
);

ALTER TABLE public.producao_processos
  ADD COLUMN IF NOT EXISTS projeto_local_id UUID NULL
    REFERENCES public.producao_projeto_locais(id) ON DELETE RESTRICT;

UPDATE public.producao_processos processo
SET projeto_local_id = local.id
FROM public.producao_projeto_locais local
WHERE processo.projeto_id = local.projeto_id
  AND processo.projeto_local_id IS NULL
  AND local.principal = true
  AND local.ativo = true;

CREATE INDEX IF NOT EXISTS producao_processos_projeto_local_idx
  ON public.producao_processos(projeto_local_id, status, sequencia);

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS projeto_id UUID NULL
    REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS projeto_local_operacional_id UUID NULL
    REFERENCES public.producao_projeto_locais(id) ON DELETE RESTRICT;

UPDATE public.producao_apontamentos a
SET projeto_id = p.projeto_id,
    projeto_local_operacional_id = p.projeto_local_id
FROM public.producao_processos p
WHERE a.processo_id = p.id
  AND (a.projeto_id IS NULL OR a.projeto_local_operacional_id IS NULL);

UPDATE public.producao_apontamentos a
SET projeto_id = pl.projeto_id,
    projeto_local_operacional_id = pl.id
FROM public.producao_projeto_locais pl
WHERE a.processo_id IS NULL
  AND a.projeto_local_id IS NOT NULL
  AND pl.local_utilizacao_id = a.projeto_local_id
  AND pl.ativo = true
  AND a.projeto_local_operacional_id IS NULL;

ALTER TABLE public.producao_apontamentos
  DROP CONSTRAINT IF EXISTS producao_apontamentos_origem_mutuamente_exclusiva;
ALTER TABLE public.producao_apontamentos
  ADD CONSTRAINT producao_apontamentos_origem_operacional_valida CHECK (
    (processo_id IS NOT NULL AND projeto_id IS NOT NULL AND projeto_local_operacional_id IS NOT NULL)
    OR
    (processo_id IS NULL AND projeto_id IS NOT NULL AND projeto_local_operacional_id IS NOT NULL)
    OR
    (processo_id IS NULL AND projeto_local_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS producao_apontamentos_projeto_operacional_idx
  ON public.producao_apontamentos(projeto_id, projeto_local_operacional_id, data);

ALTER TABLE public.producao_projeto_locais ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'producao_projeto_locais'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.producao_projeto_locais', v_policy.policyname);
  END LOOP;
END $$;
CREATE POLICY producao_projeto_locais_leitura
  ON public.producao_projeto_locais FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE OR REPLACE FUNCTION public.sincronizar_origem_apontamento_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.processo_id IS NOT NULL THEN
    SELECT p.projeto_id, p.projeto_local_id
    INTO NEW.projeto_id, NEW.projeto_local_operacional_id
    FROM public.producao_processos p
    WHERE p.id = NEW.processo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
    NEW.projeto_local_id := NULL;
  ELSIF NEW.projeto_local_operacional_id IS NOT NULL THEN
    SELECT pl.projeto_id INTO NEW.projeto_id
    FROM public.producao_projeto_locais pl
    WHERE pl.id = NEW.projeto_local_operacional_id AND pl.ativo = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Local operacional inexistente ou inativo'; END IF;
    NEW.projeto_local_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producao_apontamento_origem_operacional ON public.producao_apontamentos;
CREATE TRIGGER trg_producao_apontamento_origem_operacional
BEFORE INSERT OR UPDATE OF processo_id, projeto_local_operacional_id
ON public.producao_apontamentos
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_origem_apontamento_producao();

CREATE OR REPLACE FUNCTION public.salvar_projeto_producao_operacional(
  p_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_cliente TEXT DEFAULT NULL,
  p_cidade_destino TEXT DEFAULT NULL,
  p_uf_destino TEXT DEFAULT NULL,
  p_local_destino TEXT DEFAULT NULL,
  p_endereco_destino TEXT DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT true,
  p_locais JSONB DEFAULT '[]'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_user_nome TEXT;
  v_projeto_id UUID;
  v_item JSONB;
  v_local_id UUID;
  v_local_utilizacao_id UUID;
  v_nome_local TEXT;
  v_tipo TEXT;
  v_ordem INTEGER := 0;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar projetos de produção';
  END IF;
  IF btrim(COALESCE(p_nome, '')) = '' THEN RAISE EXCEPTION 'Nome do projeto obrigatório'; END IF;
  IF p_uf_destino IS NOT NULL AND btrim(p_uf_destino) <> '' AND length(btrim(p_uf_destino)) <> 2 THEN
    RAISE EXCEPTION 'UF de destino deve possuir 2 caracteres';
  END IF;
  IF jsonb_typeof(COALESCE(p_locais, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Locais operacionais inválidos';
  END IF;
  IF jsonb_array_length(COALESCE(p_locais, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um local operacional';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_user_nome FROM auth.users WHERE id = v_user;

  IF p_id IS NULL THEN
    INSERT INTO public.producao_projetos (
      nome, descricao, cliente, cidade, uf, local_execucao, endereco_execucao,
      responsavel_nome_snapshot, ativo, criado_por_id, criado_por_nome_snapshot,
      atualizado_por_id, atualizado_por_nome_snapshot, local_utilizacao_id
    ) VALUES (
      btrim(p_nome), NULLIF(btrim(p_descricao), ''), NULLIF(btrim(p_cliente), ''),
      NULLIF(btrim(p_cidade_destino), ''), upper(NULLIF(btrim(p_uf_destino), '')),
      NULLIF(btrim(p_local_destino), ''), NULLIF(btrim(p_endereco_destino), ''),
      NULLIF(btrim(p_responsavel_nome), ''), COALESCE(p_ativo, true), v_user, v_user_nome,
      v_user, v_user_nome, NULL
    ) RETURNING id INTO v_projeto_id;
  ELSE
    PERFORM 1 FROM public.producao_projetos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
    UPDATE public.producao_projetos SET
      nome = btrim(p_nome),
      descricao = NULLIF(btrim(p_descricao), ''),
      cliente = NULLIF(btrim(p_cliente), ''),
      cidade = NULLIF(btrim(p_cidade_destino), ''),
      uf = upper(NULLIF(btrim(p_uf_destino), '')),
      local_execucao = NULLIF(btrim(p_local_destino), ''),
      endereco_execucao = NULLIF(btrim(p_endereco_destino), ''),
      responsavel_nome_snapshot = NULLIF(btrim(p_responsavel_nome), ''),
      ativo = COALESCE(p_ativo, true),
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_user_nome,
      updated_at = now()
    WHERE id = p_id;
    v_projeto_id := p_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_locais, '[]'::jsonb)) LOOP
    v_ordem := v_ordem + 1;
    v_local_id := NULLIF(v_item->>'id', '')::UUID;
    v_local_utilizacao_id := NULLIF(v_item->>'local_utilizacao_id', '')::UUID;
    v_tipo := COALESCE(NULLIF(v_item->>'tipo', ''), 'outro');
    IF v_tipo NOT IN ('processamento','fabrica','estoque','logistica','execucao','manutencao','outro') THEN
      RAISE EXCEPTION 'Tipo de local operacional inválido: %', v_tipo;
    END IF;

    IF v_local_utilizacao_id IS NOT NULL THEN
      SELECT nome INTO v_nome_local FROM public.locais_utilizacao
      WHERE id = v_local_utilizacao_id AND ativo = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'Local do aplicativo inexistente ou inativo'; END IF;
    ELSE
      v_nome_local := NULL;
    END IF;
    v_nome_local := COALESCE(NULLIF(btrim(v_item->>'nome'), ''), v_nome_local);
    IF v_nome_local IS NULL THEN RAISE EXCEPTION 'Nome do local operacional obrigatório'; END IF;

    IF v_local_id IS NULL THEN
      INSERT INTO public.producao_projeto_locais (
        projeto_id, local_utilizacao_id, nome, tipo, cidade, uf, endereco, principal, ativo
      ) VALUES (
        v_projeto_id, v_local_utilizacao_id, v_nome_local, v_tipo,
        NULLIF(btrim(v_item->>'cidade'), ''), upper(NULLIF(btrim(v_item->>'uf'), '')),
        NULLIF(btrim(v_item->>'endereco'), ''),
        CASE WHEN v_ordem = 1 THEN true ELSE COALESCE((v_item->>'principal')::BOOLEAN, false) END,
        COALESCE((v_item->>'ativo')::BOOLEAN, true)
      );
    ELSE
      UPDATE public.producao_projeto_locais SET
        local_utilizacao_id = v_local_utilizacao_id,
        nome = v_nome_local,
        tipo = v_tipo,
        cidade = NULLIF(btrim(v_item->>'cidade'), ''),
        uf = upper(NULLIF(btrim(v_item->>'uf'), '')),
        endereco = NULLIF(btrim(v_item->>'endereco'), ''),
        principal = COALESCE((v_item->>'principal')::BOOLEAN, false),
        ativo = COALESCE((v_item->>'ativo')::BOOLEAN, true),
        updated_at = now()
      WHERE id = v_local_id AND projeto_id = v_projeto_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Local operacional não pertence ao projeto'; END IF;
    END IF;
  END LOOP;

  RETURN v_projeto_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.salvar_projeto_producao_operacional(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_projeto_producao_operacional(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB) TO authenticated;

-- Nova sobrecarga: projeto e local operacional são parâmetros independentes.
CREATE OR REPLACE FUNCTION public.criar_etapa_producao(
  p_projeto_id UUID,
  p_projeto_local_operacional_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL,
  p_data_inicio_desejada DATE DEFAULT NULL,
  p_data_limite DATE DEFAULT NULL,
  p_grupo_cronograma TEXT DEFAULT NULL,
  p_sequencia INTEGER DEFAULT 0,
  p_capacidade_diaria NUMERIC DEFAULT NULL,
  p_pessoas_necessarias NUMERIC DEFAULT NULL,
  p_aceita_producao_proporcional BOOLEAN DEFAULT false,
  p_dependencias JSONB DEFAULT '[]'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_user_nome TEXT;
  v_codigo TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para criar etapas';
  END IF;
  IF btrim(COALESCE(p_nome, '')) = '' THEN RAISE EXCEPTION 'Nome da etapa obrigatório'; END IF;
  IF p_prioridade NOT IN ('baixa','normal','alta','urgente') THEN RAISE EXCEPTION 'Prioridade inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.producao_projetos WHERE id = p_projeto_id AND ativo = true) THEN
    RAISE EXCEPTION 'Projeto inexistente ou inativo';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.producao_projeto_locais
    WHERE id = p_projeto_local_operacional_id AND projeto_id = p_projeto_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Local operacional não pertence ao projeto ou está inativo';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_user_nome FROM auth.users WHERE id = v_user;
  v_codigo := COALESCE(NULLIF(btrim(p_codigo), ''),
    'PRD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.producao_processo_codigo_seq')::TEXT, 6, '0'));

  INSERT INTO public.producao_processos (
    codigo, projeto_id, projeto_local_id, nome, descricao, produto_entregavel,
    unidade_medida, quantidade_planejada, prioridade, criado_por_id,
    criado_por_nome_snapshot, grupo_cronograma, sequencia, capacidade_diaria,
    pessoas_necessarias, aceita_producao_proporcional, data_inicio_desejada, data_limite
  ) VALUES (
    v_codigo, p_projeto_id, p_projeto_local_operacional_id, btrim(p_nome),
    NULLIF(btrim(p_descricao), ''), NULLIF(btrim(p_produto_entregavel), ''),
    NULLIF(btrim(p_unidade_medida), ''), p_quantidade_planejada, p_prioridade,
    v_user, v_user_nome, NULLIF(btrim(p_grupo_cronograma), ''),
    GREATEST(COALESCE(p_sequencia, 0), 0), p_capacidade_diaria,
    p_pessoas_necessarias, COALESCE(p_aceita_producao_proporcional, false),
    p_data_inicio_desejada, p_data_limite
  ) RETURNING id INTO v_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, novo_status, usuario_responsavel_id,
    nome_usuario_snapshot, valores_posteriores
  ) VALUES (
    v_id, 'etapa_criada', 'planejado', v_user, v_user_nome,
    jsonb_build_object('codigo', v_codigo, 'nome', btrim(p_nome),
      'projeto_id', p_projeto_id, 'projeto_local_id', p_projeto_local_operacional_id)
  );

  PERFORM public.salvar_planejamento_etapa_producao(
    v_id, p_data_inicio_desejada, p_data_limite, p_grupo_cronograma,
    p_sequencia, p_capacidade_diaria, p_pessoas_necessarias,
    p_aceita_producao_proporcional, p_dependencias
  );
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_etapa_producao(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,DATE,DATE,TEXT,INTEGER,NUMERIC,NUMERIC,BOOLEAN,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_etapa_producao(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,DATE,DATE,TEXT,INTEGER,NUMERIC,NUMERIC,BOOLEAN,JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.listar_gantt_producao();
CREATE FUNCTION public.listar_gantt_producao()
RETURNS TABLE (
  etapa_id UUID, codigo TEXT, etapa_nome TEXT,
  projeto_id UUID, projeto_nome TEXT, cidade TEXT, uf TEXT,
  local_operacional_id UUID, local_operacional_nome TEXT, local_operacional_tipo TEXT,
  local_operacional_cidade TEXT, local_operacional_uf TEXT,
  grupo_cronograma TEXT, sequencia INTEGER, unidade_medida TEXT,
  quantidade_planejada NUMERIC, quantidade_realizada NUMERIC, percentual_realizado NUMERIC,
  status TEXT, prioridade TEXT, data_inicio_desejada DATE, data_limite DATE,
  data_inicio_prevista DATE, data_fim_prevista DATE, data_inicio_real DATE, data_fim_real DATE,
  capacidade_diaria NUMERIC, pessoas_necessarias NUMERIC, alocacoes JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    p.id, p.codigo, p.nome,
    p.projeto_id, pr.nome, pr.cidade, pr.uf,
    pl.id, pl.nome, pl.tipo, pl.cidade, pl.uf,
    p.grupo_cronograma, p.sequencia, p.unidade_medida, p.quantidade_planejada,
    COALESCE(r.realizado, 0),
    CASE WHEN COALESCE(p.quantidade_planejada, 0) <= 0 THEN 0
      ELSE LEAST(100, ROUND((COALESCE(r.realizado, 0) / p.quantidade_planejada) * 100, 2)) END,
    p.status, p.prioridade, p.data_inicio_desejada, p.data_limite,
    p.data_inicio_prevista, p.data_fim_prevista, p.data_inicio_real, p.data_fim_real,
    p.capacidade_diaria, p.pessoas_necessarias,
    COALESCE(a.alocacoes, '[]'::jsonb)
  FROM public.producao_processos p
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN public.producao_projeto_locais pl ON pl.id = p.projeto_local_id
  LEFT JOIN (
    SELECT processo_id, COALESCE(SUM(quantidade_produzida), 0) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id
  ) r ON r.processo_id = p.id
  LEFT JOIN (
    SELECT processo_id, jsonb_agg(jsonb_build_object(
      'data', data, 'quantidade_planejada', quantidade_planejada,
      'pessoas_planejadas', pessoas_planejadas
    ) ORDER BY data) AS alocacoes
    FROM public.producao_alocacoes_diarias GROUP BY processo_id
  ) a ON a.processo_id = p.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome, pl.tipo, pl.nome, p.sequencia, p.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

DROP FUNCTION IF EXISTS public.listar_plano_diario_producao(DATE, INTEGER);
CREATE FUNCTION public.listar_plano_diario_producao(p_data_inicio DATE, p_dias INTEGER DEFAULT 60)
RETURNS TABLE (
  etapa_id UUID, codigo TEXT, etapa_nome TEXT,
  projeto_id UUID, projeto_nome TEXT,
  local_operacional_id UUID, local_operacional_nome TEXT, local_operacional_tipo TEXT,
  grupo_cronograma TEXT, unidade_medida TEXT, data DATE,
  quantidade_planejada NUMERIC, pessoas_planejadas NUMERIC,
  quantidade_realizada NUMERIC, status TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    p.id, p.codigo, p.nome, p.projeto_id, pr.nome,
    pl.id, pl.nome, pl.tipo,
    p.grupo_cronograma, p.unidade_medida, a.data,
    a.quantidade_planejada, a.pessoas_planejadas,
    COALESCE(r.quantidade_realizada, 0), p.status
  FROM public.producao_alocacoes_diarias a
  JOIN public.producao_processos p ON p.id = a.processo_id
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN public.producao_projeto_locais pl ON pl.id = p.projeto_local_id
  LEFT JOIN (
    SELECT processo_id, data, SUM(quantidade_produzida) AS quantidade_realizada
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id, data
  ) r ON r.processo_id = a.processo_id AND r.data = a.data
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND a.data >= p_data_inicio
    AND a.data < p_data_inicio + LEAST(GREATEST(COALESCE(p_dias, 60), 1), 180)
  ORDER BY pr.nome, pl.tipo, pl.nome, p.sequencia, a.data;
$$;
REVOKE EXECUTE ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_operacional(
  p_data DATE,
  p_processo_id UUID,
  p_projeto_id UUID,
  p_projeto_local_operacional_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[]
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_id UUID;
  v_membro RECORD;
  v_processo public.producao_processos%ROWTYPE;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('lancar') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF p_minutos_produtivos + p_minutos_improdutivos <> p_duracao_minutos THEN RAISE EXCEPTION 'Tempos não fecham'; END IF;
  IF p_minutos_improdutivos > 0 AND btrim(COALESCE(p_motivo_improdutivo,'')) = '' THEN RAISE EXCEPTION 'Motivo improdutivo obrigatório'; END IF;
  IF COALESCE(array_length(p_membros,1),0) = 0 THEN RAISE EXCEPTION 'Informe membros'; END IF;

  IF p_processo_id IS NOT NULL THEN
    SELECT * INTO v_processo FROM public.producao_processos WHERE id = p_processo_id FOR SHARE;
    IF NOT FOUND OR v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Etapa não está em andamento'; END IF;
    p_projeto_id := v_processo.projeto_id;
    p_projeto_local_operacional_id := v_processo.projeto_local_id;
  ELSE
    IF p_projeto_id IS NULL OR p_projeto_local_operacional_id IS NULL THEN
      RAISE EXCEPTION 'Informe projeto e local operacional';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.producao_projeto_locais
      WHERE id = p_projeto_local_operacional_id AND projeto_id = p_projeto_id AND ativo = true
    ) THEN RAISE EXCEPTION 'Local operacional não pertence ao projeto'; END IF;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome
  FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_apontamentos (
    data, processo_id, projeto_id, projeto_local_operacional_id, projeto_local_id,
    tarefa_id, local_tipo, quantidade_produzida, inicio, termino, duracao_minutos,
    minutos_produtivos, minutos_improdutivos, motivo_improdutivo, observacoes,
    criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    p_data, p_processo_id, p_projeto_id, p_projeto_local_operacional_id, NULL,
    p_tarefa_id, p_local_tipo, p_quantidade_produzida, p_inicio, p_termino,
    p_duracao_minutos, p_minutos_produtivos, p_minutos_improdutivos,
    NULLIF(btrim(p_motivo_improdutivo), ''), NULLIF(btrim(p_observacoes), ''),
    v_user, v_nome
  ) RETURNING id INTO v_id;

  FOR v_membro IN
    SELECT id, nome, valor_hora FROM public.producao_membros
    WHERE id = ANY(p_membros) AND ativo = true
  LOOP
    INSERT INTO public.producao_apontamento_membros(apontamento_id,membro_id,nome_snapshot,valor_hora_snapshot)
    VALUES(v_id,v_membro.id,v_membro.nome,v_membro.valor_hora);
  END LOOP;
  IF (SELECT count(*) FROM public.producao_apontamento_membros WHERE apontamento_id=v_id) <> cardinality(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  ) VALUES (
    v_id, 'criacao', v_user, v_nome,
    jsonb_build_object('processo_id', p_processo_id, 'projeto_id', p_projeto_id,
      'projeto_local_operacional_id', p_projeto_local_operacional_id)::TEXT
  );
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_apontamento_producao_operacional(DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_operacional(DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.editar_apontamento_producao_operacional(
  p_apontamento_id UUID,
  p_data DATE,
  p_processo_id UUID,
  p_projeto_id UUID,
  p_projeto_local_operacional_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[]
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_atual public.producao_apontamentos%ROWTYPE;
  v_processo public.producao_processos%ROWTYPE;
  v_membro RECORD;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('editar_apontamento') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_atual FROM public.producao_apontamentos WHERE id = p_apontamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_atual.status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento pendente pode ser editado'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF p_minutos_produtivos + p_minutos_improdutivos <> p_duracao_minutos THEN RAISE EXCEPTION 'Tempos não fecham'; END IF;
  IF COALESCE(array_length(p_membros,1),0) = 0 THEN RAISE EXCEPTION 'Informe membros'; END IF;

  IF p_processo_id IS NOT NULL THEN
    SELECT * INTO v_processo FROM public.producao_processos WHERE id = p_processo_id FOR SHARE;
    IF NOT FOUND OR v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Etapa não está em andamento'; END IF;
    p_projeto_id := v_processo.projeto_id;
    p_projeto_local_operacional_id := v_processo.projeto_local_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.producao_projeto_locais
    WHERE id = p_projeto_local_operacional_id AND projeto_id = p_projeto_id AND ativo = true
  ) THEN RAISE EXCEPTION 'Local operacional não pertence ao projeto'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome
  FROM auth.users WHERE id = v_user;
  v_antes := to_jsonb(v_atual) - 'updated_at';

  UPDATE public.producao_apontamentos SET
    data = p_data, processo_id = p_processo_id, projeto_id = p_projeto_id,
    projeto_local_operacional_id = p_projeto_local_operacional_id, projeto_local_id = NULL,
    tarefa_id = p_tarefa_id, local_tipo = p_local_tipo,
    quantidade_produzida = p_quantidade_produzida, inicio = p_inicio, termino = p_termino,
    duracao_minutos = p_duracao_minutos, minutos_produtivos = p_minutos_produtivos,
    minutos_improdutivos = p_minutos_improdutivos,
    motivo_improdutivo = NULLIF(btrim(p_motivo_improdutivo), ''),
    observacoes = NULLIF(btrim(p_observacoes), ''),
    ultima_edicao_por_id = v_user, ultima_edicao_por_nome_snapshot = v_nome,
    ultima_edicao_em = now(), updated_at = now()
  WHERE id = p_apontamento_id;

  DELETE FROM public.producao_apontamento_membros WHERE apontamento_id = p_apontamento_id;
  FOR v_membro IN SELECT id,nome,valor_hora FROM public.producao_membros WHERE id=ANY(p_membros) AND ativo=true LOOP
    INSERT INTO public.producao_apontamento_membros(apontamento_id,membro_id,nome_snapshot,valor_hora_snapshot)
    VALUES(p_apontamento_id,v_membro.id,v_membro.nome,v_membro.valor_hora);
  END LOOP;
  IF (SELECT count(*) FROM public.producao_apontamento_membros WHERE apontamento_id=p_apontamento_id) <> cardinality(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  SELECT to_jsonb(a) - 'updated_at' INTO v_depois FROM public.producao_apontamentos a WHERE a.id = p_apontamento_id;
  INSERT INTO public.producao_apontamento_eventos(apontamento_id,evento,usuario_id,nome_usuario_snapshot,valor_anterior,valor_novo)
  VALUES(p_apontamento_id,'edicao',v_user,v_nome,v_antes::TEXT,v_depois::TEXT);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.editar_apontamento_producao_operacional(UUID,DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_apontamento_producao_operacional(UUID,DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) TO authenticated;

COMMIT;
