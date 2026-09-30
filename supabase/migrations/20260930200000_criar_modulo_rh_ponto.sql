-- Fundação do módulo RH + Controle de Ponto.
-- Adaptada ao modelo de permissões realmente ativo em produção:
-- usuario_permissoes_individuais + permissao_individual_efetiva().
-- IDs históricos do App Controle podem ser preservados e origem_sistema/origem_id
-- garantem rastreabilidade da migração.

BEGIN;

-- ---------------------------------------------------------------------------
-- Jornadas: fonte canônica para RH/Ponto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NULL,
  domingo_entrada_1 time NULL,
  domingo_saida_1 time NULL,
  domingo_entrada_2 time NULL,
  domingo_saida_2 time NULL,
  segunda_entrada_1 time NULL,
  segunda_saida_1 time NULL,
  segunda_entrada_2 time NULL,
  segunda_saida_2 time NULL,
  terca_entrada_1 time NULL,
  terca_saida_1 time NULL,
  terca_entrada_2 time NULL,
  terca_saida_2 time NULL,
  quarta_entrada_1 time NULL,
  quarta_saida_1 time NULL,
  quarta_entrada_2 time NULL,
  quarta_saida_2 time NULL,
  quinta_entrada_1 time NULL,
  quinta_saida_1 time NULL,
  quinta_entrada_2 time NULL,
  quinta_saida_2 time NULL,
  sexta_entrada_1 time NULL,
  sexta_saida_1 time NULL,
  sexta_entrada_2 time NULL,
  sexta_saida_2 time NULL,
  sabado_entrada_1 time NULL,
  sabado_saida_1 time NULL,
  sabado_entrada_2 time NULL,
  sabado_saida_2 time NULL,
  feriado_entrada_1 time NULL,
  feriado_saida_1 time NULL,
  feriado_entrada_2 time NULL,
  feriado_saida_2 time NULL,
  carga_horaria_semanal numeric NULL DEFAULT 40,
  ativo boolean NOT NULL DEFAULT true,
  personalizada_para_colaborador_id uuid NULL,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_jornadas_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_jornadas_origem_unique UNIQUE (origem_sistema, origem_id)
);

-- ---------------------------------------------------------------------------
-- Colaboradores: identidade canônica do RH.
-- Um colaborador pode existir sem login; user_id é opcional.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text NULL,
  departamento text NULL,
  ativo boolean NOT NULL DEFAULT true,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NULL,
  cpf_cnpj text NULL,
  telefone text NULL,
  data_nascimento date NULL,
  endereco text NULL,
  cidade text NULL,
  estado text NULL,
  cep text NULL,
  salario numeric NULL,
  data_admissao date NULL,
  pis text NULL,
  jornada_id uuid NULL REFERENCES public.rh_jornadas(id) ON DELETE SET NULL,
  tipo_contrato text NULL DEFAULT 'clt',
  valor_contrato numeric NULL,
  controla_ponto boolean NOT NULL DEFAULT false,
  hora_extra_gera_valor boolean NOT NULL DEFAULT true,
  rh_ativo boolean NOT NULL DEFAULT true,
  rh_cadastrado boolean NOT NULL DEFAULT false,
  pista_ativo_legado boolean NOT NULL DEFAULT false,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_colaboradores_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_colaboradores_tipo_contrato CHECK (
    tipo_contrato IS NULL OR lower(btrim(tipo_contrato)) IN ('clt','pj','diarista','horista')
  ),
  CONSTRAINT rh_colaboradores_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_user_unique
  ON public.rh_colaboradores(user_id)
  WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rh_jornadas_personalizada_colaborador_fkey'
  ) THEN
    ALTER TABLE public.rh_jornadas
      ADD CONSTRAINT rh_jornadas_personalizada_colaborador_fkey
      FOREIGN KEY (personalizada_para_colaborador_id)
      REFERENCES public.rh_colaboradores(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Visão operacional sem salário, CPF/CNPJ, endereço ou demais dados sensíveis.
CREATE OR REPLACE VIEW public.rh_colaboradores_operacionais_v
WITH (security_invoker = true)
AS
SELECT id, nome, cargo, departamento, ativo, user_id, email, jornada_id, controla_ponto
FROM public.rh_colaboradores;

-- ---------------------------------------------------------------------------
-- Feriados.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data date NOT NULL,
  tipo text NULL DEFAULT 'nacional',
  ativo boolean NOT NULL DEFAULT true,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_feriados_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_feriados_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE INDEX IF NOT EXISTS rh_feriados_data_idx ON public.rh_feriados(data);

-- ---------------------------------------------------------------------------
-- Registro diário de ponto, compatível com App Controle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada_1 time NULL,
  hora_saida_1 time NULL,
  hora_entrada_2 time NULL,
  hora_saida_2 time NULL,
  hora_entrada_3 time NULL,
  hora_saida_3 time NULL,
  observacao text NULL,
  status text NOT NULL DEFAULT 'pendente',
  criado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz NULL,
  horas_trabalhadas_snapshot integer NULL DEFAULT 0,
  horas_extras_50_snapshot integer NULL DEFAULT 0,
  horas_extras_100_snapshot integer NULL DEFAULT 0,
  horas_falta_snapshot integer NULL DEFAULT 0,
  horas_atraso_snapshot integer NULL DEFAULT 0,
  adicional_noturno_snapshot integer NULL DEFAULT 0,
  is_feriado_snapshot boolean NULL DEFAULT false,
  is_domingo_snapshot boolean NULL DEFAULT false,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_registros_ponto_status CHECK (status IN ('pendente','aprovado','rejeitado')),
  CONSTRAINT rh_registros_ponto_dia_unique UNIQUE (colaborador_id, data),
  CONSTRAINT rh_registros_ponto_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE INDEX IF NOT EXISTS rh_registros_ponto_colaborador_data_idx
  ON public.rh_registros_ponto(colaborador_id, data DESC);
CREATE INDEX IF NOT EXISTS rh_registros_ponto_status_idx
  ON public.rh_registros_ponto(status, data DESC);

-- ---------------------------------------------------------------------------
-- Dias pagos: preserva a informação histórica já existente no App Controle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_ponto_dias_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  data date NOT NULL,
  valor_diaria numeric NOT NULL DEFAULT 0,
  valor_adicionais numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  pago_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_ponto_dias_pagos_unique UNIQUE (colaborador_id, data),
  CONSTRAINT rh_ponto_dias_pagos_origem_unique UNIQUE (origem_sistema, origem_id)
);

-- Auditoria de importação.
CREATE TABLE IF NOT EXISTS public.rh_importacoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_sistema text NOT NULL,
  entidade text NOT NULL,
  origem_id uuid NULL,
  destino_id uuid NULL,
  acao text NOT NULL CHECK (acao IN ('inserido','atualizado','ignorado','erro')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_importacoes_auditoria_origem_idx
  ON public.rh_importacoes_auditoria(origem_sistema, entidade, origem_id);

-- updated_at
DROP TRIGGER IF EXISTS trg_rh_jornadas_updated_at ON public.rh_jornadas;
CREATE TRIGGER trg_rh_jornadas_updated_at BEFORE UPDATE ON public.rh_jornadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated_at ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated_at BEFORE UPDATE ON public.rh_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_registros_ponto_updated_at ON public.rh_registros_ponto;
CREATE TRIGGER trg_rh_registros_ponto_updated_at BEFORE UPDATE ON public.rh_registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_ponto_dias_pagos_updated_at ON public.rh_ponto_dias_pagos;
CREATE TRIGGER trg_rh_ponto_dias_pagos_updated_at BEFORE UPDATE ON public.rh_ponto_dias_pagos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Permissões: amplia o catálogo virtual já usado pelo sistema.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
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
    'financeiro.conciliar', public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'),
    'rh.acessar', public.permissao_individual_efetiva(auth.uid(),'rh_acessar'),
    'rh.colaboradores.visualizar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_visualizar'),
    'rh.colaboradores.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar'),
    'rh.jornadas.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_jornadas_gerenciar'),
    'rh.feriados.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_feriados_gerenciar'),
    'ponto.registrar', public.permissao_individual_efetiva(auth.uid(),'ponto_registrar'),
    'ponto.visualizar', public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar'),
    'ponto.gerenciar', public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'),
    'ponto.aprovar', public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
  );
$$;

CREATE OR REPLACE FUNCTION public.listar_permissoes_usuario(p_user_id uuid)
RETURNS TABLE(permissao_id uuid, chave text, modulo text, grupo text, nome text, descricao text, ordem integer, perfil_permitido boolean, estado_individual text, permitido_efetivo boolean, origem text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_tipo text;
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
      ('pode_conciliar_financeiro','Financeiro','Conciliação','Conciliar banco','Permite fechar posição bancária e tratar divergências.',340),
      ('rh_acessar','RH','Acesso','Acessar RH','Abre o módulo de Recursos Humanos.',400),
      ('rh_colaboradores_visualizar','RH','Colaboradores','Visualizar colaboradores','Consulta cadastros do RH.',410),
      ('rh_colaboradores_gerenciar','RH','Colaboradores','Gerenciar colaboradores','Cria e altera cadastros e vínculos.',420),
      ('rh_jornadas_gerenciar','RH','Jornadas','Gerenciar jornadas','Cria e altera jornadas de trabalho.',430),
      ('rh_feriados_gerenciar','RH','Feriados','Gerenciar feriados','Cria e altera feriados usados pelo ponto.',440),
      ('ponto_registrar','Ponto','Meu Ponto','Registrar o próprio ponto','Permite registrar as próprias batidas.',500),
      ('ponto_visualizar','Ponto','Controle','Visualizar ponto','Consulta registros e espelhos de ponto.',510),
      ('ponto_gerenciar','Ponto','Controle','Gerenciar ponto','Inclui e corrige registros administrativos.',520),
      ('ponto_aprovar','Ponto','Aprovação','Aprovar ponto','Aprova ou rejeita registros de ponto.',530)
  )
  SELECT
    md5(c.chave)::uuid,
    c.chave,c.modulo,c.grupo,c.nome,c.descricao,c.ordem,
    public.permissao_individual_efetiva_por_perfil(v_tipo,c.chave),
    COALESCE(up.efeito,'herdar'),
    public.permissao_individual_efetiva(p_user_id,c.chave),
    CASE WHEN v_tipo='administrador' THEN 'administrador'
         WHEN up.efeito IS NOT NULL THEN 'individual'
         ELSE 'perfil' END
  FROM catalogo c
  LEFT JOIN public.usuario_permissoes_individuais up
    ON up.user_id=p_user_id AND up.permissao=c.chave
  ORDER BY c.ordem;
END;
$$;

-- ---------------------------------------------------------------------------
-- Identidade e registro do próprio ponto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_current_user_colaborador_id()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_colaborador_id uuid;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT c.id INTO v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id=v_user_id AND c.ativo=true AND c.rh_ativo=true AND c.controla_ponto=true
  LIMIT 1;
  IF v_colaborador_id IS NOT NULL THEN RETURN v_colaborador_id; END IF;

  SELECT lower(btrim(coalesce(p.email,u.email,''))) INTO v_email
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id=u.id
  WHERE u.id=v_user_id;
  IF coalesce(v_email,'')='' THEN RETURN NULL; END IF;

  SELECT count(*), min(c.id) INTO v_count,v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id IS NULL AND c.ativo=true AND c.rh_ativo=true AND c.controla_ponto=true
    AND lower(btrim(coalesce(c.email,'')))=v_email;

  IF v_count<>1 OR v_colaborador_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.rh_colaboradores SET user_id=v_user_id
  WHERE id=v_colaborador_id AND user_id IS NULL;

  RETURN v_colaborador_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rh_current_user_colaborador_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_current_user_colaborador_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_registrar_meu_ponto_agora()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_colaborador_id uuid;
  v_nome text;
  v_timestamp timestamp without time zone;
  v_data date;
  v_hora time without time zone;
  v_entry public.rh_registros_ponto%ROWTYPE;
  v_campo text;
  v_rotulo text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user_id,'ponto_registrar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para registrar ponto';
  END IF;

  v_colaborador_id := public.rh_current_user_colaborador_id();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a colaborador ativo habilitado para ponto';
  END IF;

  SELECT nome INTO v_nome FROM public.rh_colaboradores WHERE id=v_colaborador_id;
  v_timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_data := v_timestamp::date;
  v_hora := date_trunc('minute',v_timestamp)::time;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_colaborador_id::text||':'||v_data::text,0));

  SELECT * INTO v_entry FROM public.rh_registros_ponto
  WHERE colaborador_id=v_colaborador_id AND data=v_data
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    INSERT INTO public.rh_registros_ponto(colaborador_id,data,hora_entrada_1,status,criado_por)
    VALUES(v_colaborador_id,v_data,v_hora,'pendente',v_user_id)
    RETURNING * INTO v_entry;
    v_campo:='hora_entrada_1'; v_rotulo:='Entrada 1';
  ELSE
    IF v_entry.hora_entrada_1 IS NULL THEN v_campo:='hora_entrada_1'; v_rotulo:='Entrada 1';
    ELSIF v_entry.hora_saida_1 IS NULL THEN v_campo:='hora_saida_1'; v_rotulo:='Saída 1';
    ELSIF v_entry.hora_entrada_2 IS NULL THEN v_campo:='hora_entrada_2'; v_rotulo:='Entrada 2';
    ELSIF v_entry.hora_saida_2 IS NULL THEN v_campo:='hora_saida_2'; v_rotulo:='Saída 2';
    ELSIF v_entry.hora_entrada_3 IS NULL THEN v_campo:='hora_entrada_3'; v_rotulo:='Entrada 3';
    ELSIF v_entry.hora_saida_3 IS NULL THEN v_campo:='hora_saida_3'; v_rotulo:='Saída 3';
    ELSE RAISE EXCEPTION 'Todos os horários de hoje já foram registrados';
    END IF;

    EXECUTE format(
      'UPDATE public.rh_registros_ponto SET %I=$1,status=''pendente'',aprovado_por=NULL,aprovado_em=NULL WHERE id=$2',
      v_campo
    ) USING v_hora,v_entry.id;
  END IF;

  RETURN jsonb_build_object(
    'entry_id',v_entry.id,'colaborador_id',v_colaborador_id,'colaborador_nome',v_nome,
    'data',v_data,'hora',to_char(v_hora,'HH24:MI'),'campo',v_campo,'rotulo',v_rotulo
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rh_registrar_meu_ponto_agora() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_registrar_meu_ponto_agora() TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_get_meu_ponto_snapshot(p_mes date)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_colaborador_id uuid;
  v_nome text;
  v_inicio date;
  v_fim date;
  v_entries jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user_id,'ponto_registrar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o próprio ponto';
  END IF;

  v_colaborador_id := public.rh_current_user_colaborador_id();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a colaborador ativo habilitado para ponto';
  END IF;

  SELECT nome INTO v_nome FROM public.rh_colaboradores WHERE id=v_colaborador_id;
  v_inicio := date_trunc('month',coalesce(p_mes,current_date))::date;
  v_fim := (v_inicio+interval '1 month - 1 day')::date;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.data DESC),'[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id,data,hora_entrada_1,hora_saida_1,hora_entrada_2,hora_saida_2,
           hora_entrada_3,hora_saida_3,observacao,status
    FROM public.rh_registros_ponto
    WHERE colaborador_id=v_colaborador_id AND data BETWEEN v_inicio AND v_fim
  ) x;

  RETURN jsonb_build_object(
    'colaborador',jsonb_build_object('id',v_colaborador_id,'nome',v_nome),
    'entries',v_entries
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rh_get_meu_ponto_snapshot(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_get_meu_ponto_snapshot(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.rh_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_ponto_dias_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_importacoes_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_jornadas_select ON public.rh_jornadas;
CREATE POLICY rh_jornadas_select ON public.rh_jornadas FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'rh_acessar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
);
DROP POLICY IF EXISTS rh_jornadas_write ON public.rh_jornadas;
CREATE POLICY rh_jornadas_write ON public.rh_jornadas FOR ALL TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(),'rh_jornadas_gerenciar'))
WITH CHECK (public.permissao_individual_efetiva(auth.uid(),'rh_jornadas_gerenciar'));

DROP POLICY IF EXISTS rh_colaboradores_select ON public.rh_colaboradores;
CREATE POLICY rh_colaboradores_select ON public.rh_colaboradores FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
);
DROP POLICY IF EXISTS rh_colaboradores_write ON public.rh_colaboradores;
CREATE POLICY rh_colaboradores_write ON public.rh_colaboradores FOR ALL TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar'))
WITH CHECK (public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar'));

DROP POLICY IF EXISTS rh_feriados_select ON public.rh_feriados;
CREATE POLICY rh_feriados_select ON public.rh_feriados FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'rh_acessar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
);
DROP POLICY IF EXISTS rh_feriados_write ON public.rh_feriados;
CREATE POLICY rh_feriados_write ON public.rh_feriados FOR ALL TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(),'rh_feriados_gerenciar'))
WITH CHECK (public.permissao_individual_efetiva(auth.uid(),'rh_feriados_gerenciar'));

DROP POLICY IF EXISTS rh_registros_ponto_select ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_select ON public.rh_registros_ponto FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
);
DROP POLICY IF EXISTS rh_registros_ponto_insert_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_insert_admin ON public.rh_registros_ponto FOR INSERT TO authenticated
WITH CHECK (public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'));
DROP POLICY IF EXISTS rh_registros_ponto_update_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_update_admin ON public.rh_registros_ponto FOR UPDATE TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
)
WITH CHECK (
  public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
);
DROP POLICY IF EXISTS rh_registros_ponto_delete_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_delete_admin ON public.rh_registros_ponto FOR DELETE TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'));

DROP POLICY IF EXISTS rh_ponto_dias_pagos_select ON public.rh_ponto_dias_pagos;
CREATE POLICY rh_ponto_dias_pagos_select ON public.rh_ponto_dias_pagos FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'rh_acessar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar')
  OR public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar')
);
DROP POLICY IF EXISTS rh_ponto_dias_pagos_write ON public.rh_ponto_dias_pagos;
CREATE POLICY rh_ponto_dias_pagos_write ON public.rh_ponto_dias_pagos FOR ALL TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'))
WITH CHECK (public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'));

DROP POLICY IF EXISTS rh_importacoes_auditoria_select ON public.rh_importacoes_auditoria;
CREATE POLICY rh_importacoes_auditoria_select ON public.rh_importacoes_auditoria FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar')
  OR public.is_admin()
);

REVOKE ALL ON public.rh_importacoes_auditoria FROM anon, authenticated;
GRANT SELECT ON public.rh_importacoes_auditoria TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
