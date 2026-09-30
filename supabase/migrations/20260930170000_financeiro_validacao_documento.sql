BEGIN;

-- Financeiro Fase 2: camada de validação visual do procedimento oficial.
-- Complementa a Fase 1 sem alterar estoque, movements, retiradas ou Produção.

-- =========================
-- PN: campos do Anexo A
-- =========================
ALTER TABLE public.financeiro_necessidades
  ADD COLUMN IF NOT EXISTS data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS area_solicitante TEXT NULL,
  ADD COLUMN IF NOT EXISTS especificacao TEXT NULL,
  ADD COLUMN IF NOT EXISTS justificativa TEXT NULL,
  ADD COLUMN IF NOT EXISTS registro_katia TEXT NULL,
  ADD COLUMN IF NOT EXISTS registro_katia_em TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_necessidade_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  necessidade_id UUID NOT NULL REFERENCES public.financeiro_necessidades(id) ON DELETE CASCADE,
  responsavel_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome TEXT NULL,
  alteracao TEXT NOT NULL,
  valor_previsto NUMERIC(14,2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_necessidade_historico_idx
  ON public.financeiro_necessidade_historico(necessidade_id, created_at DESC);

-- =========================
-- RC: campos do Anexo B no objeto operacional existente
-- =========================
ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS pn_origem_id UUID NULL REFERENCES public.financeiro_necessidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS projeto_centro_custo TEXT NULL,
  ADD COLUMN IF NOT EXISTS especificacao_tecnica TEXT NULL,
  ADD COLUMN IF NOT EXISTS data_necessaria DATE NULL,
  ADD COLUMN IF NOT EXISTS conferencia_estoque TEXT NULL,
  ADD COLUMN IF NOT EXISTS fornecedores_consultados TEXT NULL,
  ADD COLUMN IF NOT EXISTS valor_estimado_cotado NUMERIC(14,2) NULL,
  ADD COLUMN IF NOT EXISTS frete_custos_adicionais NUMERIC(14,2) NULL,
  ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT NULL,
  ADD COLUMN IF NOT EXISTS lead_time_dias INTEGER NULL,
  ADD COLUMN IF NOT EXISTS data_limite_compra DATE NULL,
  ADD COLUMN IF NOT EXISTS impacto_financeiro TEXT NULL,
  ADD COLUMN IF NOT EXISTS status_financeiro_rc TEXT NOT NULL DEFAULT 'em_cotacao'
    CHECK (status_financeiro_rc IN ('em_cotacao','aguardando_aprovacao','aprovada','rejeitada','convertida_em_pc')),
  ADD COLUMN IF NOT EXISTS estoque_conferido_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS estoque_conferido_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS especificacao_confirmada_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS especificacao_confirmada_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS impacto_financeiro_registrado_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS impacto_financeiro_registrado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_executiva_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_executiva_em TIMESTAMPTZ NULL;

-- Vincula RCs já sincronizadas às respectivas PNs.
UPDATE public.pedidos_compra pc
SET pn_origem_id = fn.id
FROM public.financeiro_necessidades fn
WHERE fn.requisicao_compra_id = pc.id
  AND pc.pn_origem_id IS NULL;

-- =========================
-- PC formal: Anexo C
-- =========================
CREATE SEQUENCE IF NOT EXISTS public.financeiro_pc_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.financeiro_pedidos_compra_formais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('public.financeiro_pc_numero_seq'::regclass),
  requisicao_compra_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE RESTRICT,
  necessidade_id UUID NULL REFERENCES public.financeiro_necessidades(id) ON DELETE SET NULL,
  fornecedor TEXT NOT NULL,
  fornecedor_identificacao TEXT NULL,
  fornecedor_contato TEXT NULL,
  descricao TEXT NOT NULL,
  valor_itens NUMERIC(14,2) NOT NULL DEFAULT 0,
  frete_custos_adicionais NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) GENERATED ALWAYS AS (valor_itens + frete_custos_adicionais) STORED,
  condicao_pagamento TEXT NULL,
  prazo_entrega TEXT NULL,
  local_entrega TEXT NULL,
  aprovacao_mauro_em TIMESTAMPTZ NULL,
  aprovacao_evidencia TEXT NULL,
  confirmado_por TEXT NULL,
  confirmado_em TIMESTAMPTZ NULL,
  compromisso_katia_em TIMESTAMPTZ NULL,
  compromisso_status TEXT NULL,
  enviado_guto_em TIMESTAMPTZ NULL,
  recebimento_por TEXT NULL,
  recebimento_em TIMESTAMPTZ NULL,
  recebimento_divergencias TEXT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','confirmado','recebido','concluido','cancelado')),
  criado_por_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requisicao_compra_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_pc_numero_uidx
  ON public.financeiro_pedidos_compra_formais(numero);

CREATE TABLE IF NOT EXISTS public.financeiro_pc_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_compra_formal_id UUID NOT NULL REFERENCES public.financeiro_pedidos_compra_formais(id) ON DELETE CASCADE,
  parcela_numero INTEGER NOT NULL CHECK (parcela_numero > 0),
  vencimento DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  lancamento_id UUID NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  programado_no_banco BOOLEAN NOT NULL DEFAULT false,
  data_programada DATE NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  data_pago DATE NULL,
  valor_pago NUMERIC(14,2) NULL,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  data_conciliado DATE NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_compra_formal_id, parcela_numero)
);

-- =========================
-- Programação bancária
-- =========================
CREATE TABLE IF NOT EXISTS public.financeiro_programacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  pedido_compra_formal_id UUID NULL REFERENCES public.financeiro_pedidos_compra_formais(id) ON DELETE SET NULL,
  parcela_id UUID NULL REFERENCES public.financeiro_pc_parcelas(id) ON DELETE SET NULL,
  beneficiario TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  vencimento DATE NULL,
  data_programada DATE NOT NULL,
  banco_conta TEXT NULL,
  forma_pagamento TEXT NULL,
  categoria TEXT NULL,
  projeto_centro_custo TEXT NULL,
  observacao TEXT NULL,
  liberado_por_katia_em TIMESTAMPTZ NULL,
  programado_por_guto_em TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_programacao'
    CHECK (status IN ('aguardando_programacao','programado','rejeitado_banco','cancelado','liquidado')),
  comprovante_path TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_programacoes_status_idx
  ON public.financeiro_programacoes(status, data_programada);

-- =========================
-- Contas e posição diária de caixa
-- =========================
CREATE TABLE IF NOT EXISTS public.financeiro_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  banco TEXT NOT NULL,
  tipo TEXT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.financeiro_contas_bancarias(nome,banco,tipo,ordem)
VALUES
  ('Inter','Inter','Conta corrente',10),
  ('Inter: Investimentos','Inter','Investimentos',20),
  ('Sicoob','Sicoob','Conta corrente',30),
  ('Sicoob: Investimentos','Sicoob','Investimentos',40),
  ('Sicredi','Sicredi','Conta corrente',50),
  ('BB','Banco do Brasil','Conta corrente',60),
  ('BB: Rende Fácil','Banco do Brasil','Investimentos',70)
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.financeiro_posicoes_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  conta_bancaria_id UUID NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  responsavel TEXT NOT NULL DEFAULT 'Kátia',
  saldo_inicial_bancario NUMERIC(14,2) NOT NULL DEFAULT 0,
  entradas_realizadas NUMERIC(14,2) NOT NULL DEFAULT 0,
  saidas_realizadas NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_final_bancario NUMERIC(14,2) NOT NULL DEFAULT 0,
  pagamentos_programados_nao_liquidados NUMERIC(14,2) NOT NULL DEFAULT 0,
  recebimentos_previstos_nao_realizados NUMERIC(14,2) NOT NULL DEFAULT 0,
  saidas_nao_previstas_diferencas NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_financeiro_gerencial NUMERIC(14,2) NOT NULL DEFAULT 0,
  pendencias_proximo_dia TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data, conta_bancaria_id)
);

-- =========================
-- Conciliação e desvios: Anexo E
-- =========================
CREATE TABLE IF NOT EXISTS public.financeiro_conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  conta_bancaria_id UUID NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  lancamento_id UUID NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  historico_beneficiario TEXT NOT NULL,
  estava_previsto BOOLEAN NULL,
  valor NUMERIC(14,2) NOT NULL,
  valor_previsto NUMERIC(14,2) NULL,
  data_prevista DATE NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  tratamento_status TEXT NOT NULL DEFAULT 'em_apuracao'
    CHECK (tratamento_status IN ('em_apuracao','identificado','regularizado','conciliado')),
  tratamento_observacao TEXT NULL,
  responsavel_regularizacao TEXT NULL,
  prazo_regularizacao DATE NULL,
  conciliado_por TEXT NULL,
  conciliado_em TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_conciliacoes_data_idx
  ON public.financeiro_conciliacoes(data DESC, tratamento_status);

-- =========================
-- Permissões adicionais
-- =========================
ALTER TABLE public.permissoes_tipo_usuario
  ADD COLUMN IF NOT EXISTS pode_programar_financeiro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_conciliar_financeiro BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT IF EXISTS usuario_permissoes_individuais_permissao_valida;

ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK (
    permissao IN (
      'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens',
      'pode_registrar_movimentacoes','pode_solicitar_material','pode_devolver_material',
      'pode_registrar_entrada','pode_registrar_saida','pode_transferir',
      'pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
      'pode_apontar_producao','pode_conferir_producao','pode_ver_bi_producao',
      'pode_configurar_producao','pode_gerenciar_configuracoes','pode_gerenciar_usuarios',
      'pode_ver_relatorios','pode_acessar_gerencial','pode_acessar_projetos',
      'pode_acessar_financeiro','pode_gerenciar_financeiro','pode_aprovar_financeiro',
      'pode_programar_financeiro','pode_conciliar_financeiro'
    )
  );

-- Recria as funções de permissão incluindo Programação e Conciliação.
CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva(
  p_user_id UUID,
  p_permissao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tipo TEXT;
  v_efeito TEXT;
  v_perfil public.permissoes_tipo_usuario%ROWTYPE;
  v_padrao BOOLEAN := false;
BEGIN
  SELECT tipo_usuario INTO v_tipo
  FROM public.profiles
  WHERE user_id = p_user_id AND COALESCE(ativo, true) = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_tipo = 'administrador' THEN RETURN true; END IF;

  SELECT efeito INTO v_efeito
  FROM public.usuario_permissoes_individuais
  WHERE user_id = p_user_id AND permissao = p_permissao;

  IF v_efeito = 'permitir' THEN RETURN true; END IF;
  IF v_efeito = 'negar' THEN RETURN false; END IF;

  SELECT * INTO v_perfil
  FROM public.permissoes_tipo_usuario
  WHERE tipo_usuario = v_tipo
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  v_padrao := CASE p_permissao
    WHEN 'pode_cadastrar_itens' THEN v_perfil.pode_cadastrar_itens
    WHEN 'pode_editar_itens' THEN v_perfil.pode_editar_itens
    WHEN 'pode_excluir_itens' THEN v_perfil.pode_excluir_itens
    WHEN 'pode_registrar_movimentacoes' THEN v_perfil.pode_registrar_movimentacoes
    WHEN 'pode_solicitar_material' THEN v_perfil.pode_solicitar_material
    WHEN 'pode_devolver_material' THEN v_perfil.pode_devolver_material
    WHEN 'pode_registrar_entrada' THEN v_perfil.pode_registrar_entrada
    WHEN 'pode_registrar_saida' THEN v_perfil.pode_registrar_saida
    WHEN 'pode_transferir' THEN v_perfil.pode_transferir
    WHEN 'pode_editar_movimentacoes' THEN v_perfil.pode_editar_movimentacoes
    WHEN 'pode_solicitacao_material' THEN v_perfil.pode_solicitacao_material
    WHEN 'pode_pedido_compra' THEN v_perfil.pode_pedido_compra
    WHEN 'pode_apontar_producao' THEN v_perfil.pode_apontar_producao
    WHEN 'pode_conferir_producao' THEN v_perfil.pode_conferir_producao
    WHEN 'pode_ver_bi_producao' THEN v_perfil.pode_ver_bi_producao
    WHEN 'pode_configurar_producao' THEN v_perfil.pode_configurar_producao
    WHEN 'pode_gerenciar_configuracoes' THEN v_perfil.pode_gerenciar_configuracoes
    WHEN 'pode_gerenciar_usuarios' THEN v_perfil.pode_gerenciar_usuarios
    WHEN 'pode_ver_relatorios' THEN v_perfil.pode_ver_relatorios
    WHEN 'pode_acessar_gerencial' THEN v_perfil.pode_acessar_gerencial
    WHEN 'pode_acessar_projetos' THEN v_perfil.pode_acessar_projetos
    WHEN 'pode_acessar_financeiro' THEN v_perfil.pode_acessar_financeiro
    WHEN 'pode_gerenciar_financeiro' THEN v_perfil.pode_gerenciar_financeiro
    WHEN 'pode_aprovar_financeiro' THEN v_perfil.pode_aprovar_financeiro
    WHEN 'pode_programar_financeiro' THEN v_perfil.pode_programar_financeiro
    WHEN 'pode_conciliar_financeiro' THEN v_perfil.pode_conciliar_financeiro
    ELSE false
  END;

  RETURN COALESCE(v_padrao, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva_por_perfil(
  p_tipo TEXT,
  p_permissao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE v public.permissoes_tipo_usuario%ROWTYPE;
BEGIN
  IF p_tipo = 'administrador' THEN RETURN true; END IF;
  SELECT * INTO v FROM public.permissoes_tipo_usuario WHERE tipo_usuario = p_tipo LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN COALESCE(CASE p_permissao
    WHEN 'pode_cadastrar_itens' THEN v.pode_cadastrar_itens
    WHEN 'pode_editar_itens' THEN v.pode_editar_itens
    WHEN 'pode_excluir_itens' THEN v.pode_excluir_itens
    WHEN 'pode_registrar_movimentacoes' THEN v.pode_registrar_movimentacoes
    WHEN 'pode_solicitar_material' THEN v.pode_solicitar_material
    WHEN 'pode_devolver_material' THEN v.pode_devolver_material
    WHEN 'pode_registrar_entrada' THEN v.pode_registrar_entrada
    WHEN 'pode_registrar_saida' THEN v.pode_registrar_saida
    WHEN 'pode_transferir' THEN v.pode_transferir
    WHEN 'pode_editar_movimentacoes' THEN v.pode_editar_movimentacoes
    WHEN 'pode_solicitacao_material' THEN v.pode_solicitacao_material
    WHEN 'pode_pedido_compra' THEN v.pode_pedido_compra
    WHEN 'pode_apontar_producao' THEN v.pode_apontar_producao
    WHEN 'pode_conferir_producao' THEN v.pode_conferir_producao
    WHEN 'pode_ver_bi_producao' THEN v.pode_ver_bi_producao
    WHEN 'pode_configurar_producao' THEN v.pode_configurar_producao
    WHEN 'pode_gerenciar_configuracoes' THEN v.pode_gerenciar_configuracoes
    WHEN 'pode_gerenciar_usuarios' THEN v.pode_gerenciar_usuarios
    WHEN 'pode_ver_relatorios' THEN v.pode_ver_relatorios
    WHEN 'pode_acessar_gerencial' THEN v.pode_acessar_gerencial
    WHEN 'pode_acessar_projetos' THEN v.pode_acessar_projetos
    WHEN 'pode_acessar_financeiro' THEN v.pode_acessar_financeiro
    WHEN 'pode_gerenciar_financeiro' THEN v.pode_gerenciar_financeiro
    WHEN 'pode_aprovar_financeiro' THEN v.pode_aprovar_financeiro
    WHEN 'pode_programar_financeiro' THEN v.pode_programar_financeiro
    WHEN 'pode_conciliar_financeiro' THEN v.pode_conciliar_financeiro
    ELSE false END, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_permissoes_usuario(p_user_id UUID)
RETURNS TABLE (
  permissao_id UUID,
  chave TEXT,
  modulo TEXT,
  grupo TEXT,
  nome TEXT,
  descricao TEXT,
  ordem INTEGER,
  perfil_permitido BOOLEAN,
  estado_individual TEXT,
  permitido_efetivo BOOLEAN,
  origem TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios') THEN
    RAISE EXCEPTION 'Sem permissão para consultar acessos de outro usuário';
  END IF;

  SELECT tipo_usuario INTO v_tipo FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;

  RETURN QUERY
  WITH catalogo(chave, modulo, grupo, nome, descricao, ordem) AS (
    VALUES
      ('pode_cadastrar_itens','Estoque','Gestão de Itens','Cadastrar itens','Cadastra novos itens no estoque.',10),
      ('pode_editar_itens','Estoque','Gestão de Itens','Editar itens','Altera dados cadastrais dos itens.',20),
      ('pode_excluir_itens','Estoque','Gestão de Itens','Excluir itens','Exclui itens quando permitido.',30),
      ('pode_registrar_movimentacoes','Estoque','Movimentações diretas','Registrar movimentações','Permissão geral para registrar movimentações.',40),
      ('pode_solicitar_material','Estoque','Retirada e devolução','Retirada de Material','Solicita itens existentes no estoque.',50),
      ('pode_devolver_material','Estoque','Retirada e devolução','Devolver material','Registra devoluções.',60),
      ('pode_registrar_entrada','Estoque','Movimentações diretas','Registrar entrada','Registra entradas no estoque.',70),
      ('pode_registrar_saida','Estoque','Movimentações diretas','Registrar saída','Registra saídas diretas do estoque.',80),
      ('pode_transferir','Estoque','Movimentações diretas','Transferir entre estoques','Transfere materiais entre estoques.',90),
      ('pode_editar_movimentacoes','Estoque','Movimentações diretas','Editar movimentações','Corrige movimentações existentes.',100),
      ('pode_solicitacao_material','Estoque','Solicitações e Compras','Solicitação de Material','Gerencia solicitações, inclusive itens sem saldo ou não cadastrados.',110),
      ('pode_pedido_compra','Compras','Solicitações e Compras','Requisição de compra (RC)','Acessa e gerencia requisições de compra.',120),
      ('pode_apontar_producao','Produção','Produção','Apontar Produção','Registra apontamentos de produção.',130),
      ('pode_conferir_producao','Produção','Produção','Conferir Produção','Confere apontamentos de produção.',140),
      ('pode_ver_bi_producao','Gerencial','BI Produção','Ver somente BI Produção','Libera exclusivamente o BI Produção.',150),
      ('pode_configurar_producao','Produção','Produção','Configurar Produção','Gerencia configurações da Produção.',160),
      ('pode_gerenciar_configuracoes','Administração','Administração','Gerenciar configurações','Altera configurações gerais.',170),
      ('pode_gerenciar_usuarios','Administração','Administração','Gerenciar usuários','Cria, edita e ativa usuários e acessos.',180),
      ('pode_ver_relatorios','Administração','Administração','Ver relatórios','Acessa relatórios.',190),
      ('pode_acessar_gerencial','Gerencial','Gerencial de Almoxarifado','Acessar Gerencial de Almoxarifado','Acessa indicadores gerenciais.',200),
      ('pode_acessar_projetos','Administração','Administração','Acessar projetos','Acessa a área de projetos.',210),
      ('pode_acessar_financeiro','Financeiro','Acesso','Acessar Financeiro','Visualiza o módulo Financeiro e seus dados permitidos.',300),
      ('pode_gerenciar_financeiro','Financeiro','Operação','Gerenciar Financeiro','Cria e ajusta PN, previsões, RCs e PCs.',310),
      ('pode_aprovar_financeiro','Financeiro','Aprovação','Aprovar compromissos','Permite aprovar ou rejeitar compromissos financeiros.',320),
      ('pode_programar_financeiro','Financeiro','Programação bancária','Programar pagamentos','Permite registrar a programação bancária operacional.',330),
      ('pode_conciliar_financeiro','Financeiro','Conciliação','Conciliar banco','Permite fechar posição bancária e tratar divergências.',340)
  )
  SELECT
    md5(c.chave)::uuid,
    c.chave,
    c.modulo,
    c.grupo,
    c.nome,
    c.descricao,
    c.ordem,
    public.permissao_individual_efetiva_por_perfil(v_tipo, c.chave),
    COALESCE(up.efeito, 'herdar'),
    public.permissao_individual_efetiva(p_user_id, c.chave),
    CASE WHEN v_tipo = 'administrador' THEN 'administrador'
         WHEN up.efeito IS NOT NULL THEN 'individual'
         ELSE 'perfil' END
  FROM catalogo c
  LEFT JOIN public.usuario_permissoes_individuais up
    ON up.user_id = p_user_id AND up.permissao = c.chave
  ORDER BY c.ordem;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'estoque.itens.criar', public.permissao_individual_efetiva(auth.uid(),'pode_cadastrar_itens'),
    'estoque.itens.editar', public.permissao_individual_efetiva(auth.uid(),'pode_editar_itens'),
    'estoque.itens.excluir', public.permissao_individual_efetiva(auth.uid(),'pode_excluir_itens'),
    'estoque.movimentacoes.registrar', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_movimentacoes'),
    'estoque.movimentacoes.entrada', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_entrada'),
    'estoque.movimentacoes.saida', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_saida'),
    'estoque.movimentacoes.transferir', public.permissao_individual_efetiva(auth.uid(),'pode_transferir'),
    'estoque.movimentacoes.editar', public.permissao_individual_efetiva(auth.uid(),'pode_editar_movimentacoes'),
    'estoque.solicitacoes.solicitar', public.permissao_individual_efetiva(auth.uid(),'pode_solicitar_material'),
    'estoque.solicitacoes.devolver', public.permissao_individual_efetiva(auth.uid(),'pode_devolver_material'),
    'estoque.solicitacoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_solicitacao_material'),
    'compras.pedidos.criar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'compras.pedidos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'projetos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_projetos'),
    'gerencial.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_gerencial'),
    'relatorios.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios'),
    'producao.acessar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.apontamentos.criar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao'),
    'producao.apontamentos.editar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao'),
    'producao.apontamentos.conferir', public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao'),
    'producao.bi.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao'),
    'producao.configuracoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.projetos.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.etapas.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.cronograma.configurar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'administracao.configuracoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_configuracoes'),
    'administracao.usuarios.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.criar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.editar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.ativar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.permissoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'financeiro.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro'),
    'financeiro.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'),
    'financeiro.aprovar', public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro'),
    'financeiro.programar', public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro'),
    'financeiro.conciliar', public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro')
  );
$$;

-- =========================
-- RLS das novas estruturas
-- =========================
ALTER TABLE public.financeiro_necessidade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pedidos_compra_formais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pc_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_posicoes_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_conciliacoes ENABLE ROW LEVEL SECURITY;

-- Helpers via expressão repetida para manter transparência das policies.
DROP POLICY IF EXISTS fin_hist_select ON public.financeiro_necessidade_historico;
CREATE POLICY fin_hist_select ON public.financeiro_necessidade_historico FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));
DROP POLICY IF EXISTS fin_hist_write ON public.financeiro_necessidade_historico;
CREATE POLICY fin_hist_write ON public.financeiro_necessidade_historico FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

DROP POLICY IF EXISTS fin_pc_select ON public.financeiro_pedidos_compra_formais;
CREATE POLICY fin_pc_select ON public.financeiro_pedidos_compra_formais FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro'));
DROP POLICY IF EXISTS fin_pc_write ON public.financeiro_pedidos_compra_formais;
CREATE POLICY fin_pc_write ON public.financeiro_pedidos_compra_formais FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro'));

DROP POLICY IF EXISTS fin_parcelas_select ON public.financeiro_pc_parcelas;
CREATE POLICY fin_parcelas_select ON public.financeiro_pc_parcelas FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));
DROP POLICY IF EXISTS fin_parcelas_write ON public.financeiro_pc_parcelas;
CREATE POLICY fin_parcelas_write ON public.financeiro_pc_parcelas FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));

DROP POLICY IF EXISTS fin_programacoes_select ON public.financeiro_programacoes;
CREATE POLICY fin_programacoes_select ON public.financeiro_programacoes FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro'));
DROP POLICY IF EXISTS fin_programacoes_write ON public.financeiro_programacoes;
CREATE POLICY fin_programacoes_write ON public.financeiro_programacoes FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro'));

DROP POLICY IF EXISTS fin_contas_select ON public.financeiro_contas_bancarias;
CREATE POLICY fin_contas_select ON public.financeiro_contas_bancarias FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));
DROP POLICY IF EXISTS fin_contas_write ON public.financeiro_contas_bancarias;
CREATE POLICY fin_contas_write ON public.financeiro_contas_bancarias FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

DROP POLICY IF EXISTS fin_posicoes_select ON public.financeiro_posicoes_diarias;
CREATE POLICY fin_posicoes_select ON public.financeiro_posicoes_diarias FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));
DROP POLICY IF EXISTS fin_posicoes_write ON public.financeiro_posicoes_diarias;
CREATE POLICY fin_posicoes_write ON public.financeiro_posicoes_diarias FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));

DROP POLICY IF EXISTS fin_conciliacoes_select ON public.financeiro_conciliacoes;
CREATE POLICY fin_conciliacoes_select ON public.financeiro_conciliacoes FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));
DROP POLICY IF EXISTS fin_conciliacoes_write ON public.financeiro_conciliacoes;
CREATE POLICY fin_conciliacoes_write ON public.financeiro_conciliacoes FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro') OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'));

REVOKE ALL ON FUNCTION public.listar_permissoes_usuario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_minhas_permissoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_minhas_permissoes() TO authenticated;

COMMIT;
