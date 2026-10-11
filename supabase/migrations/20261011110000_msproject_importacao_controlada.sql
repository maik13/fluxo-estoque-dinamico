-- Integração controlada do Microsoft Project.
-- Esta migration cria somente a área de pré-importação auditável. Ela não
-- cria, altera ou cancela Projetos, Etapas, OPs, Apontamentos ou movimentos.

BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_msproject_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome TEXT NOT NULL,
  arquivo_hash_sha256 TEXT NOT NULL,
  versao_origem TEXT NULL,
  fuso_horario_origem TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  inicio_planejado_original TIMESTAMPTZ NULL,
  fim_planejado_original TIMESTAMPTZ NULL,
  total_tarefas INTEGER NOT NULL DEFAULT 0 CHECK (total_tarefas >= 0),
  status TEXT NOT NULL DEFAULT 'aguardando_conciliacao'
    CHECK (status IN ('aguardando_conciliacao', 'em_conciliacao', 'aprovada', 'arquivada')),
  observacoes TEXT NULL,
  criado_por_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_msproject_importacoes_hash_valido
    CHECK (arquivo_hash_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_msproject_importacoes_hash_ativo_unique
  ON public.producao_msproject_importacoes(arquivo_hash_sha256)
  WHERE status <> 'arquivada';

CREATE TABLE IF NOT EXISTS public.producao_msproject_mapeamentos_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_msproject TEXT NOT NULL,
  cidade_msproject TEXT NOT NULL,
  projeto_id UUID NOT NULL REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  aprovado_por_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_msproject_mapeamentos_referencia_nao_vazia
    CHECK (btrim(referencia_msproject) <> ''),
  CONSTRAINT producao_msproject_mapeamentos_cidade_nao_vazia
    CHECK (btrim(cidade_msproject) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_msproject_mapeamentos_chave_unique
  ON public.producao_msproject_mapeamentos_projetos(
    upper(btrim(referencia_msproject)),
    upper(btrim(cidade_msproject))
  );

CREATE TABLE IF NOT EXISTS public.producao_msproject_tarefas_importadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.producao_msproject_importacoes(id) ON DELETE CASCADE,
  uid_origem BIGINT NOT NULL,
  uid_pai_origem BIGINT NULL,
  nivel_estrutura INTEGER NOT NULL CHECK (nivel_estrutura >= 0),
  caminho_estrutura TEXT[] NOT NULL DEFAULT '{}',
  nome TEXT NOT NULL,
  referencia_msproject TEXT NULL,
  cidade_msproject TEXT NULL,
  grupo_origem TEXT NULL,
  inicio_planejado_original TIMESTAMPTZ NOT NULL,
  fim_planejado_original TIMESTAMPTZ NOT NULL,
  duracao_minutos_origem INTEGER NULL CHECK (duracao_minutos_origem IS NULL OR duracao_minutos_origem >= 0),
  marco BOOLEAN NOT NULL DEFAULT false,
  percentual_concluido_origem NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (percentual_concluido_origem >= 0 AND percentual_concluido_origem <= 100),
  inicio_real_origem TIMESTAMPTZ NULL,
  fim_real_origem TIMESTAMPTZ NULL,
  predecessoras_origem JSONB NOT NULL DEFAULT '[]'::jsonb,
  etapa_sugerida SMALLINT NULL CHECK (etapa_sugerida BETWEEN 1 AND 5),
  justificativa_etapa_sugerida TEXT NULL,
  projeto_id_sugerido UUID NULL REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  situacao_conciliacao TEXT NOT NULL DEFAULT 'pendente'
    CHECK (situacao_conciliacao IN ('pendente', 'mapeada', 'sem_projeto', 'conflito', 'descartada', 'aprovada')),
  observacao_conciliacao TEXT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_msproject_tarefas_datas_validas
    CHECK (fim_planejado_original >= inicio_planejado_original),
  CONSTRAINT producao_msproject_tarefas_uid_unico_por_importacao
    UNIQUE (importacao_id, uid_origem)
);

CREATE INDEX IF NOT EXISTS producao_msproject_tarefas_importacao_idx
  ON public.producao_msproject_tarefas_importadas(importacao_id, situacao_conciliacao);
CREATE INDEX IF NOT EXISTS producao_msproject_tarefas_referencia_cidade_idx
  ON public.producao_msproject_tarefas_importadas(referencia_msproject, cidade_msproject);
CREATE INDEX IF NOT EXISTS producao_msproject_tarefas_projeto_sugerido_idx
  ON public.producao_msproject_tarefas_importadas(projeto_id_sugerido)
  WHERE projeto_id_sugerido IS NOT NULL;

ALTER TABLE public.producao_msproject_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_msproject_mapeamentos_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_msproject_tarefas_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY producao_msproject_importacoes_leitura
  ON public.producao_msproject_importacoes FOR SELECT TO authenticated
  USING (public.is_admin() OR public.usuario_tem_permissao_producao('processos'));

CREATE POLICY producao_msproject_mapeamentos_leitura
  ON public.producao_msproject_mapeamentos_projetos FOR SELECT TO authenticated
  USING (public.is_admin() OR public.usuario_tem_permissao_producao('processos'));

CREATE POLICY producao_msproject_tarefas_leitura
  ON public.producao_msproject_tarefas_importadas FOR SELECT TO authenticated
  USING (public.is_admin() OR public.usuario_tem_permissao_producao('processos'));

CREATE OR REPLACE FUNCTION public.registrar_importacao_msproject(
  p_arquivo_nome TEXT,
  p_arquivo_hash_sha256 TEXT,
  p_versao_origem TEXT,
  p_fuso_horario_origem TEXT,
  p_inicio_planejado_original TIMESTAMPTZ,
  p_fim_planejado_original TIMESTAMPTZ,
  p_tarefas JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_importacao_id UUID;
  v_usuario_id UUID := auth.uid();
  v_total_tarefas INTEGER;
BEGIN
  IF v_usuario_id IS NULL
     OR NOT (public.is_admin() OR public.usuario_tem_permissao_producao('processos')) THEN
    RAISE EXCEPTION 'Sem permissão para importar planejamento do Microsoft Project';
  END IF;

  IF NULLIF(btrim(p_arquivo_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do arquivo de origem';
  END IF;

  IF COALESCE(p_arquivo_hash_sha256, '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Hash SHA-256 do arquivo de origem é inválido';
  END IF;

  IF p_tarefas IS NULL OR jsonb_typeof(p_tarefas) <> 'array' THEN
    RAISE EXCEPTION 'A carga precisa conter uma lista de tarefas';
  END IF;

  v_total_tarefas := jsonb_array_length(p_tarefas);
  IF v_total_tarefas < 1 OR v_total_tarefas > 10000 THEN
    RAISE EXCEPTION 'A carga deve conter entre 1 e 10.000 tarefas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_tarefas) AS t(
      uid_origem BIGINT,
      nome TEXT,
      inicio_planejado_original TIMESTAMPTZ,
      fim_planejado_original TIMESTAMPTZ,
      nivel_estrutura INTEGER
    )
    WHERE t.uid_origem IS NULL
       OR NULLIF(btrim(t.nome), '') IS NULL
       OR t.inicio_planejado_original IS NULL
       OR t.fim_planejado_original IS NULL
       OR t.fim_planejado_original < t.inicio_planejado_original
       OR COALESCE(t.nivel_estrutura, -1) < 0
  ) THEN
    RAISE EXCEPTION 'Existem tarefas sem UID, nome, nível ou período planejado válido';
  END IF;

  INSERT INTO public.producao_msproject_importacoes (
    arquivo_nome,
    arquivo_hash_sha256,
    versao_origem,
    fuso_horario_origem,
    inicio_planejado_original,
    fim_planejado_original,
    total_tarefas,
    criado_por_id
  ) VALUES (
    btrim(p_arquivo_nome),
    p_arquivo_hash_sha256,
    NULLIF(btrim(p_versao_origem), ''),
    COALESCE(NULLIF(btrim(p_fuso_horario_origem), ''), 'America/Sao_Paulo'),
    p_inicio_planejado_original,
    p_fim_planejado_original,
    v_total_tarefas,
    v_usuario_id
  ) RETURNING id INTO v_importacao_id;

  INSERT INTO public.producao_msproject_tarefas_importadas (
    importacao_id,
    uid_origem,
    uid_pai_origem,
    nivel_estrutura,
    caminho_estrutura,
    nome,
    referencia_msproject,
    cidade_msproject,
    grupo_origem,
    inicio_planejado_original,
    fim_planejado_original,
    duracao_minutos_origem,
    marco,
    percentual_concluido_origem,
    inicio_real_origem,
    fim_real_origem,
    predecessoras_origem,
    etapa_sugerida,
    justificativa_etapa_sugerida,
    situacao_conciliacao
  )
  SELECT
    v_importacao_id,
    t.uid_origem,
    t.uid_pai_origem,
    t.nivel_estrutura,
    COALESCE(t.caminho_estrutura, '{}'),
    btrim(t.nome),
    NULLIF(btrim(t.referencia_msproject), ''),
    NULLIF(btrim(t.cidade_msproject), ''),
    NULLIF(btrim(t.grupo_origem), ''),
    t.inicio_planejado_original,
    t.fim_planejado_original,
    t.duracao_minutos_origem,
    COALESCE(t.marco, false),
    COALESCE(t.percentual_concluido_origem, 0),
    t.inicio_real_origem,
    t.fim_real_origem,
    COALESCE(t.predecessoras_origem, '[]'::jsonb),
    t.etapa_sugerida,
    NULLIF(btrim(t.justificativa_etapa_sugerida), ''),
    CASE
      WHEN NULLIF(btrim(t.referencia_msproject), '') IS NULL
        OR NULLIF(btrim(t.cidade_msproject), '') IS NULL THEN 'conflito'
      ELSE 'pendente'
    END
  FROM jsonb_to_recordset(p_tarefas) AS t(
    uid_origem BIGINT,
    uid_pai_origem BIGINT,
    nivel_estrutura INTEGER,
    caminho_estrutura TEXT[],
    nome TEXT,
    referencia_msproject TEXT,
    cidade_msproject TEXT,
    grupo_origem TEXT,
    inicio_planejado_original TIMESTAMPTZ,
    fim_planejado_original TIMESTAMPTZ,
    duracao_minutos_origem INTEGER,
    marco BOOLEAN,
    percentual_concluido_origem NUMERIC,
    inicio_real_origem TIMESTAMPTZ,
    fim_real_origem TIMESTAMPTZ,
    predecessoras_origem JSONB,
    etapa_sugerida SMALLINT,
    justificativa_etapa_sugerida TEXT
  );

  RETURN v_importacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_importacao_msproject(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_importacao_msproject(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;

COMMIT;
