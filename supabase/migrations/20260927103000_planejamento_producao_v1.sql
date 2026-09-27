BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_acervo_cenografico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  categoria TEXT,
  nome TEXT NOT NULL,
  especificacoes TEXT,
  ano_origem TEXT,
  quantidade_estoque NUMERIC NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
  status TEXT,
  historico TEXT,
  observacoes TEXT,
  fonte TEXT,
  fonte_linha INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.producao_planejamento_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  project_group_id UUID REFERENCES public.project_groups(id) ON DELETE SET NULL,
  ativo_calculo BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  fonte TEXT,
  fonte_coluna TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.producao_planejamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte TEXT NOT NULL,
  fonte_linha INTEGER NOT NULL,
  nome TEXT NOT NULL,
  acervo_codigo_ref TEXT,
  qtd_estoque_referencia NUMERIC NOT NULL DEFAULT 0,
  status_planilha TEXT,
  demandas JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fonte, fonte_linha)
);

CREATE TABLE IF NOT EXISTS public.producao_planejamento_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte TEXT NOT NULL,
  fonte_aba TEXT,
  fonte_linha INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('turno','marco','gargalo')),
  data DATE NOT NULL,
  turno TEXT,
  projeto_chave TEXT,
  frente TEXT,
  descricao TEXT,
  meta TEXT,
  apontamento_referencia TEXT,
  responsavel TEXT,
  status TEXT,
  prioridade TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fonte, fonte_aba, fonte_linha, tipo)
);

CREATE TABLE IF NOT EXISTS public.producao_parametros_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte TEXT NOT NULL,
  fonte_linha INTEGER NOT NULL,
  tipologia TEXT NOT NULL,
  detalhamento TEXT,
  tempo_unitario_texto TEXT,
  tempo_unitario_horas NUMERIC,
  ritmo_padrao TEXT,
  dias_cronograma TEXT,
  complexidade TEXT,
  gargalos_criticos TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fonte, fonte_linha)
);

CREATE TABLE IF NOT EXISTS public.producao_planejamento_fontes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  url TEXT,
  modo TEXT NOT NULL DEFAULT 'importacao_manual',
  status TEXT NOT NULL DEFAULT 'ativo',
  ultima_sincronizacao TIMESTAMPTZ,
  ultimo_resultado JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planejamento_agenda_data
  ON public.producao_planejamento_agenda(data);
CREATE INDEX IF NOT EXISTS idx_planejamento_itens_acervo
  ON public.producao_planejamento_itens(acervo_codigo_ref);
CREATE INDEX IF NOT EXISTS idx_acervo_cenografico_nome
  ON public.producao_acervo_cenografico(nome);

ALTER TABLE public.producao_acervo_cenografico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_planejamento_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_planejamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_planejamento_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_parametros_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_planejamento_fontes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_tabela TEXT;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'producao_acervo_cenografico',
    'producao_planejamento_projetos',
    'producao_planejamento_itens',
    'producao_planejamento_agenda',
    'producao_parametros_padrao',
    'producao_planejamento_fontes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_tabela || '_leitura', v_tabela);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.usuario_tem_permissao_producao(''visualizar''))',
      v_tabela || '_leitura',
      v_tabela
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.listar_planejamento_producao_v1()
RETURNS JSONB
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
          'statusPlanilha', i.status_planilha,
          'demandas', i.demandas,
          'acervoNome', a.nome,
          'acervoCategoria', a.categoria
        ) ORDER BY i.fonte_linha)
        FROM public.producao_planejamento_itens i
        LEFT JOIN public.producao_acervo_cenografico a
          ON a.codigo = i.acervo_codigo_ref
         AND a.ativo = TRUE
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

REVOKE ALL ON FUNCTION public.listar_planejamento_producao_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_planejamento_projeto_v1(
  p_projeto_id UUID,
  p_ativo_calculo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o planejamento da Produção';
  END IF;

  UPDATE public.producao_planejamento_projetos
  SET ativo_calculo = p_ativo_calculo,
      updated_at = now()
  WHERE id = p_projeto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto de planejamento não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_planejamento_projeto_v1(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_planejamento_projeto_v1(UUID, BOOLEAN) TO authenticated;

COMMIT;
