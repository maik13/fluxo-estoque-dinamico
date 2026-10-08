BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.cotacoes_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.cotacoes_numero_seq'),
  tipo text NOT NULL CHECK (tipo IN ('insumo','frete','global')),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_validacao','confirmada','escolhida','rejeitada','convertida_pn')),
  origem_cadastro text NOT NULL DEFAULT 'manual'
    CHECK (origem_cadastro IN ('manual','pdf')),
  fornecedor_nome text,
  fornecedor_cnpj text,
  fornecedor_endereco text,
  fornecedor_contato text,
  numero_proposta text,
  data_cotacao date,
  validade_data date,
  validade_dias integer,
  condicao_pagamento text,
  descricao text,
  projeto_centro_custo text,
  valor_subtotal numeric(14,2),
  valor_frete numeric(14,2),
  valor_impostos numeric(14,2),
  valor_desconto numeric(14,2),
  valor_total numeric(14,2),
  origem_frete text,
  destino_frete text,
  peso_kg numeric(14,3),
  cubagem_m3 numeric(14,3),
  volumes integer,
  tipo_veiculo text,
  prazo_dias integer,
  arquivo_nome text,
  arquivo_path text,
  arquivo_mime text,
  texto_extraido text,
  leitura_status text NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (leitura_status IN ('nao_aplicavel','pendente','processando','concluida','falhou','sem_texto')),
  leitura_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  leitura_erro text,
  financeiro_necessidade_id uuid REFERENCES public.financeiro_necessidades(id),
  criado_por uuid DEFAULT auth.uid(),
  criado_por_nome text,
  confirmado_por uuid,
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(numero)
);

CREATE TABLE IF NOT EXISTS public.cotacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id),
  codigo_item text,
  descricao text NOT NULL,
  marca text,
  especificacao text,
  quantidade numeric(14,3),
  unidade text,
  valor_unitario numeric(14,4),
  valor_total numeric(14,2),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacoes_tipo_data_idx
  ON public.cotacoes(tipo, data_cotacao DESC);
CREATE INDEX IF NOT EXISTS cotacoes_fornecedor_idx
  ON public.cotacoes(lower(fornecedor_nome));
CREATE INDEX IF NOT EXISTS cotacoes_status_idx
  ON public.cotacoes(status);
CREATE INDEX IF NOT EXISTS cotacao_itens_cotacao_idx
  ON public.cotacao_itens(cotacao_id);
CREATE INDEX IF NOT EXISTS cotacao_itens_item_idx
  ON public.cotacao_itens(item_id);

ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotacoes_select ON public.cotacoes;
CREATE POLICY cotacoes_select ON public.cotacoes
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
);

DROP POLICY IF EXISTS cotacoes_insert ON public.cotacoes;
CREATE POLICY cotacoes_insert ON public.cotacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
);

DROP POLICY IF EXISTS cotacoes_update ON public.cotacoes;
CREATE POLICY cotacoes_update ON public.cotacoes
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
)
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
);

DROP POLICY IF EXISTS cotacoes_delete ON public.cotacoes;
CREATE POLICY cotacoes_delete ON public.cotacoes
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
);

DROP POLICY IF EXISTS cotacao_itens_select ON public.cotacao_itens;
CREATE POLICY cotacao_itens_select ON public.cotacao_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id=cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_insert ON public.cotacao_itens;
CREATE POLICY cotacao_itens_insert ON public.cotacao_itens
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id=cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_update ON public.cotacao_itens;
CREATE POLICY cotacao_itens_update ON public.cotacao_itens
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id=cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_delete ON public.cotacao_itens;
CREATE POLICY cotacao_itens_delete ON public.cotacao_itens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id=cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
      )
  )
);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('cotacoes-documentos','cotacoes-documentos',false,20971520,ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET public=false,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS cotacoes_documentos_select ON storage.objects;
CREATE POLICY cotacoes_documentos_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_insert ON storage.objects;
CREATE POLICY cotacoes_documentos_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_update ON storage.objects;
CREATE POLICY cotacoes_documentos_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  )
)
WITH CHECK (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_delete ON storage.objects;
CREATE POLICY cotacoes_documentos_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  )
);

CREATE OR REPLACE FUNCTION public.cotacao_converter_em_pn_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_profile record;
  v_pn_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR public.permissao_individual_efetiva(v_user,'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para converter cotação em PN';
  END IF;

  SELECT * INTO v_cotacao
  FROM public.cotacoes
  WHERE id=p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF v_cotacao.financeiro_necessidade_id IS NOT NULL THEN
    RETURN v_cotacao.financeiro_necessidade_id;
  END IF;

  IF v_cotacao.status NOT IN ('confirmada','escolhida') THEN
    RAISE EXCEPTION 'A cotação precisa estar confirmada ou escolhida antes de gerar PN';
  END IF;

  IF COALESCE(v_cotacao.valor_total,0) <= 0 THEN
    RAISE EXCEPTION 'Informe o valor total antes de converter em PN';
  END IF;

  SELECT nome,email INTO v_profile
  FROM public.profiles
  WHERE user_id=v_user
  LIMIT 1;

  INSERT INTO public.financeiro_necessidades(
    origem_tipo,
    origem_modulo,
    descricao,
    solicitante_id,
    solicitante_nome,
    valor_estimado,
    estimativa_incompleta,
    base_estimativa,
    projeto_centro_custo,
    categoria,
    criado_automaticamente,
    criado_por_id,
    criado_por_nome,
    especificacao,
    justificativa
  )
  VALUES (
    'manual',
    'cotacoes',
    COALESCE(v_cotacao.descricao,'Cotação #'||v_cotacao.numero::text)
      || CASE WHEN v_cotacao.fornecedor_nome IS NOT NULL THEN ' · '||v_cotacao.fornecedor_nome ELSE '' END,
    v_user,
    COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    v_cotacao.valor_total,
    false,
    'Cotação #'||v_cotacao.numero::text,
    v_cotacao.projeto_centro_custo,
    CASE v_cotacao.tipo
      WHEN 'frete' THEN 'Frete'
      WHEN 'insumo' THEN 'Insumo'
      ELSE 'Orçamento global'
    END,
    false,
    v_user,
    COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    COALESCE(v_cotacao.descricao,'Cotação aprovada'),
    'Originada da Central de Cotações. Documento original preservado na cotação #'||v_cotacao.numero::text
  )
  RETURNING id INTO v_pn_id;

  UPDATE public.cotacoes
  SET financeiro_necessidade_id=v_pn_id,
      status='convertida_pn',
      updated_at=now()
  WHERE id=p_cotacao_id;

  RETURN v_pn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) TO authenticated;

COMMIT;