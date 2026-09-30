BEGIN;

-- Fase 1 do Financeiro integrado:
-- 1) cria PN/necessidades e lançamentos previstos;
-- 2) reaproveita pedidos_compra como RC operacional sem renomear a tabela;
-- 3) sincroniza novas RCs com PN/Fluxo;
-- 4) acrescenta permissões financeiras ao mecanismo já existente.
-- Não altera movements, saldos, retiradas ou o motor de Produção.

CREATE SEQUENCE IF NOT EXISTS public.financeiro_necessidades_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.financeiro_lancamentos_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.financeiro_necessidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('public.financeiro_necessidades_numero_seq'::regclass),
  status TEXT NOT NULL DEFAULT 'previsto'
    CHECK (status IN ('previsto','em_definicao','em_cotacao','aguardando_aprovacao','aprovado','comprometido','cancelado')),
  origem_tipo TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem_tipo IN ('manual','rc','solicitacao_material','pcp','contrato','folha','imposto','servico','outro')),
  origem_modulo TEXT NULL,
  descricao TEXT NOT NULL,
  solicitante_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome TEXT NULL,
  solicitacao_material_id UUID NULL REFERENCES public.solicitacoes_material(id) ON DELETE SET NULL,
  requisicao_compra_id UUID NULL REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  producao_projeto_id UUID NULL REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  processo_id UUID NULL REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ordem_producao_id UUID NULL REFERENCES public.producao_ordens_producao(id) ON DELETE SET NULL,
  item_id UUID NULL REFERENCES public.items(id) ON DELETE SET NULL,
  quantidade NUMERIC NULL,
  unidade TEXT NULL,
  valor_estimado NUMERIC(14,2) NULL CHECK (valor_estimado IS NULL OR valor_estimado >= 0),
  estimativa_incompleta BOOLEAN NOT NULL DEFAULT false,
  base_estimativa TEXT NULL,
  data_necessidade DATE NULL,
  data_prevista_desembolso DATE NULL,
  urgencia TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgencia IN ('baixa','normal','alta','urgente')),
  projeto_centro_custo TEXT NULL,
  categoria TEXT NULL,
  subcategoria TEXT NULL,
  criado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  criado_por_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome TEXT NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_necessidades_numero_uidx
  ON public.financeiro_necessidades(numero);
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_necessidades_rc_uidx
  ON public.financeiro_necessidades(requisicao_compra_id)
  WHERE requisicao_compra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS financeiro_necessidades_status_idx
  ON public.financeiro_necessidades(status, data_prevista_desembolso);
CREATE INDEX IF NOT EXISTS financeiro_necessidades_origem_idx
  ON public.financeiro_necessidades(origem_modulo, ordem_producao_id, solicitacao_material_id);

CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('public.financeiro_lancamentos_numero_seq'::regclass),
  necessidade_id UUID NULL REFERENCES public.financeiro_necessidades(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  status TEXT NOT NULL DEFAULT 'previsto'
    CHECK (status IN ('previsto','solicitado','em_cotacao','aguardando_aprovacao','aprovado','comprometido','programado','pago','conciliado','cancelado')),
  descricao TEXT NOT NULL,
  categoria TEXT NULL,
  subcategoria TEXT NULL,
  projeto_centro_custo TEXT NULL,
  producao_projeto_id UUID NULL REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  data_prevista DATE NULL,
  data_realizada DATE NULL,
  valor_previsto NUMERIC(14,2) NULL,
  valor_realizado NUMERIC(14,2) NULL,
  parcela_numero INTEGER NOT NULL DEFAULT 1 CHECK (parcela_numero > 0),
  parcela_total INTEGER NOT NULL DEFAULT 1 CHECK (parcela_total > 0),
  origem_tipo TEXT NULL,
  origem_id UUID NULL,
  observacoes TEXT NULL,
  criado_por_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (necessidade_id, parcela_numero)
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_lancamentos_numero_uidx
  ON public.financeiro_lancamentos(numero);
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_fluxo_idx
  ON public.financeiro_lancamentos(data_prevista, status, tipo);

ALTER TABLE public.permissoes_tipo_usuario
  ADD COLUMN IF NOT EXISTS pode_acessar_financeiro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_financeiro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_aprovar_financeiro BOOLEAN NOT NULL DEFAULT false;

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
      'pode_acessar_financeiro','pode_gerenciar_financeiro','pode_aprovar_financeiro'
    )
  );

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
      ('pode_gerenciar_financeiro','Financeiro','Operação','Gerenciar Financeiro','Cria e ajusta PN, previsões e lançamentos financeiros.',310),
      ('pode_aprovar_financeiro','Financeiro','Aprovação','Aprovar compromissos','Permite aprovar ou rejeitar compromissos financeiros.',320)
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
    'financeiro.aprovar', public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
  );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_sincronizar_rc(p_pedido_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_compra%ROWTYPE;
  v_sol public.solicitacoes_material%ROWTYPE;
  v_necessidade_id UUID;
  v_descricao TEXT;
  v_valor NUMERIC(14,2);
  v_total_itens INTEGER;
  v_itens_sem_valor INTEGER;
  v_status TEXT;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_pedido.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = v_pedido.solicitacao_material_id;
  END IF;

  SELECT
    COALESCE('RC #' || v_pedido.numero || ' - ' ||
      string_agg(COALESCE(pci.nome_item, pci.item_snapshot->>'nome', i.nome, 'Item'), ', ' ORDER BY pci.created_at),
      'RC #' || v_pedido.numero),
    COALESCE(SUM(CASE WHEN i.valor IS NOT NULL THEN pci.quantidade * i.valor ELSE 0 END),0),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE pci.item_id IS NULL OR i.valor IS NULL)::integer
  INTO v_descricao, v_valor, v_total_itens, v_itens_sem_valor
  FROM public.pedido_compra_itens pci
  LEFT JOIN public.items i ON i.id = pci.item_id
  WHERE pci.pedido_id = p_pedido_id;

  v_status := CASE WHEN v_pedido.status = 'cancelado' THEN 'cancelado' ELSE 'previsto' END;

  SELECT id INTO v_necessidade_id
  FROM public.financeiro_necessidades
  WHERE requisicao_compra_id = p_pedido_id;

  IF v_necessidade_id IS NULL THEN
    INSERT INTO public.financeiro_necessidades(
      status, origem_tipo, origem_modulo, descricao,
      solicitante_id, solicitante_nome,
      solicitacao_material_id, requisicao_compra_id,
      producao_projeto_id, processo_id, ordem_producao_id,
      valor_estimado, estimativa_incompleta, base_estimativa,
      data_necessidade, data_prevista_desembolso,
      projeto_centro_custo, criado_automaticamente,
      criado_por_id, criado_por_nome
    ) VALUES (
      v_status, 'rc', COALESCE(v_sol.origem_modulo,'estoque'),
      v_descricao,
      COALESCE(v_sol.solicitante_id, v_pedido.criado_por_id),
      COALESCE(v_sol.solicitante_nome, v_pedido.criado_por_nome),
      v_pedido.solicitacao_material_id, v_pedido.id,
      v_sol.producao_projeto_id, v_sol.processo_id, v_sol.ordem_producao_id,
      CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END,
      COALESCE(v_itens_sem_valor,0) > 0,
      CASE WHEN v_total_itens = 0 THEN 'RC ainda sem itens'
           WHEN v_itens_sem_valor > 0 THEN 'Estimativa parcial pelos valores cadastrados no estoque'
           ELSE 'Quantidade da RC x valor cadastrado do item' END,
      v_sol.data_necessidade,
      v_sol.data_necessidade,
      v_sol.local_origem,
      true,
      v_pedido.criado_por_id,
      v_pedido.criado_por_nome
    )
    RETURNING id INTO v_necessidade_id;
  ELSE
    UPDATE public.financeiro_necessidades
    SET status = v_status,
        descricao = v_descricao,
        solicitacao_material_id = v_pedido.solicitacao_material_id,
        origem_modulo = COALESCE(v_sol.origem_modulo, origem_modulo, 'estoque'),
        producao_projeto_id = COALESCE(v_sol.producao_projeto_id, producao_projeto_id),
        processo_id = COALESCE(v_sol.processo_id, processo_id),
        ordem_producao_id = COALESCE(v_sol.ordem_producao_id, ordem_producao_id),
        valor_estimado = CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END,
        estimativa_incompleta = COALESCE(v_itens_sem_valor,0) > 0,
        base_estimativa = CASE WHEN v_total_itens = 0 THEN 'RC ainda sem itens'
                              WHEN v_itens_sem_valor > 0 THEN 'Estimativa parcial pelos valores cadastrados no estoque'
                              ELSE 'Quantidade da RC x valor cadastrado do item' END,
        data_necessidade = COALESCE(v_sol.data_necessidade, data_necessidade),
        data_prevista_desembolso = COALESCE(v_sol.data_necessidade, data_prevista_desembolso),
        projeto_centro_custo = COALESCE(v_sol.local_origem, projeto_centro_custo),
        updated_at = now()
    WHERE id = v_necessidade_id;
  END IF;

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id, tipo, status, descricao,
    projeto_centro_custo, producao_projeto_id,
    data_prevista, valor_previsto,
    origem_tipo, origem_id, criado_por_id
  )
  SELECT
    v_necessidade_id,
    'saida',
    CASE WHEN v_status = 'cancelado' THEN 'cancelado' ELSE 'previsto' END,
    v_descricao,
    COALESCE(v_sol.local_origem, fn.projeto_centro_custo),
    v_sol.producao_projeto_id,
    COALESCE(v_sol.data_necessidade, fn.data_prevista_desembolso),
    fn.valor_estimado,
    'rc',
    v_pedido.id,
    v_pedido.criado_por_id
  FROM public.financeiro_necessidades fn
  WHERE fn.id = v_necessidade_id
  ON CONFLICT (necessidade_id, parcela_numero)
  DO UPDATE SET
    status = EXCLUDED.status,
    descricao = EXCLUDED.descricao,
    projeto_centro_custo = EXCLUDED.projeto_centro_custo,
    producao_projeto_id = EXCLUDED.producao_projeto_id,
    data_prevista = EXCLUDED.data_prevista,
    valor_previsto = EXCLUDED.valor_previsto,
    updated_at = now();

  RETURN v_necessidade_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;
  PERFORM public.financeiro_sincronizar_rc(v_id);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.financeiro_sincronizar_rc(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pedido_compra_itens_sync ON public.pedido_compra_itens;
CREATE TRIGGER trg_financeiro_pedido_compra_itens_sync
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_rc();

DROP TRIGGER IF EXISTS trg_financeiro_pedidos_compra_sync ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_pedidos_compra_sync
AFTER INSERT OR UPDATE OF status, solicitacao_material_id ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_pedido();

CREATE OR REPLACE FUNCTION public.financeiro_criar_necessidade_manual(
  p_descricao TEXT,
  p_valor_estimado NUMERIC DEFAULT NULL,
  p_data_necessidade DATE DEFAULT NULL,
  p_data_prevista_desembolso DATE DEFAULT NULL,
  p_urgencia TEXT DEFAULT 'normal',
  p_projeto_centro_custo TEXT DEFAULT NULL,
  p_categoria TEXT DEFAULT NULL,
  p_subcategoria TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nome TEXT;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR (
    NOT public.is_admin()
    AND NOT public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar necessidade financeira';
  END IF;

  IF COALESCE(trim(p_descricao),'') = '' THEN
    RAISE EXCEPTION 'Descrição é obrigatória';
  END IF;

  SELECT COALESCE(nome,email,'Usuário') INTO v_nome
  FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.financeiro_necessidades(
    status, origem_tipo, origem_modulo, descricao,
    solicitante_id, solicitante_nome,
    valor_estimado, estimativa_incompleta, base_estimativa,
    data_necessidade, data_prevista_desembolso,
    urgencia, projeto_centro_custo, categoria, subcategoria,
    criado_automaticamente, criado_por_id, criado_por_nome
  ) VALUES (
    'previsto','manual','financeiro',trim(p_descricao),
    auth.uid(),v_nome,
    p_valor_estimado,false,
    CASE WHEN p_valor_estimado IS NULL THEN 'Valor ainda não informado' ELSE 'Informado manualmente' END,
    p_data_necessidade,COALESCE(p_data_prevista_desembolso,p_data_necessidade),
    COALESCE(p_urgencia,'normal'),p_projeto_centro_custo,p_categoria,p_subcategoria,
    false,auth.uid(),v_nome
  ) RETURNING id INTO v_id;

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id,tipo,status,descricao,categoria,subcategoria,
    projeto_centro_custo,data_prevista,valor_previsto,
    origem_tipo,origem_id,criado_por_id
  ) VALUES (
    v_id,'saida','previsto',trim(p_descricao),p_categoria,p_subcategoria,
    p_projeto_centro_custo,COALESCE(p_data_prevista_desembolso,p_data_necessidade),
    p_valor_estimado,'manual',v_id,auth.uid()
  );

  RETURN v_id;
END;
$$;

ALTER TABLE public.financeiro_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_necessidades_select ON public.financeiro_necessidades;
CREATE POLICY financeiro_necessidades_select
ON public.financeiro_necessidades FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
);

DROP POLICY IF EXISTS financeiro_necessidades_insert ON public.financeiro_necessidades;
CREATE POLICY financeiro_necessidades_insert
ON public.financeiro_necessidades FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
);

DROP POLICY IF EXISTS financeiro_necessidades_update ON public.financeiro_necessidades;
CREATE POLICY financeiro_necessidades_update
ON public.financeiro_necessidades FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
)
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
);

DROP POLICY IF EXISTS financeiro_lancamentos_select ON public.financeiro_lancamentos;
CREATE POLICY financeiro_lancamentos_select
ON public.financeiro_lancamentos FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
);

DROP POLICY IF EXISTS financeiro_lancamentos_insert ON public.financeiro_lancamentos;
CREATE POLICY financeiro_lancamentos_insert
ON public.financeiro_lancamentos FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
);

DROP POLICY IF EXISTS financeiro_lancamentos_update ON public.financeiro_lancamentos;
CREATE POLICY financeiro_lancamentos_update
ON public.financeiro_lancamentos FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
)
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
);

REVOKE ALL ON FUNCTION public.financeiro_sincronizar_rc(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_criar_necessidade_manual(TEXT,NUMERIC,DATE,DATE,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_criar_necessidade_manual(TEXT,NUMERIC,DATE,DATE,TEXT,TEXT,TEXT,TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_permissoes_usuario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_minhas_permissoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_minhas_permissoes() TO authenticated;

COMMIT;
