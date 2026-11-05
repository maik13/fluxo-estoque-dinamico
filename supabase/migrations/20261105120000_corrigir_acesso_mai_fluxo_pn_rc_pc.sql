BEGIN;

-- Permissão própria para a consulta do fluxo operacional. Ela não equivale a
-- acesso ao Financeiro e não libera a Central de Cotações.
DO $$
DECLARE
  v_definicao text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO v_definicao
  FROM pg_constraint
  WHERE conrelid = 'public.usuario_permissoes_individuais'::regclass
    AND conname = 'usuario_permissoes_individuais_permissao_valida';

  IF position('pode_visualizar_fluxo_compras' in v_definicao) = 0 THEN
    v_definicao := replace(
      v_definicao,
      '''orcamento_solicitar''::text',
      '''orcamento_solicitar''::text, ''pode_visualizar_fluxo_compras''::text'
    );
    ALTER TABLE public.usuario_permissoes_individuais
      DROP CONSTRAINT usuario_permissoes_individuais_permissao_valida;
    EXECUTE 'ALTER TABLE public.usuario_permissoes_individuais ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida ' || v_definicao;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pode_visualizar_fluxo_compras()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.permissao_individual_efetiva(auth.uid(), 'pode_visualizar_fluxo_compras');
$$;

REVOKE ALL ON FUNCTION public.pode_visualizar_fluxo_compras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_visualizar_fluxo_compras() TO authenticated;

-- Corrige o acesso dado por engano: remove o Financeiro e concede somente a
-- leitura dos três cards PN, RC e PC à Mai Pavan.
DO $$
DECLARE
  v_user_id uuid;
  v_financeiro_anterior text;
  v_fluxo_anterior text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'mayarapavan.arqeurb@gmail.com'
    AND ativo IS TRUE
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo da Mai Pavan não encontrado';
  END IF;

  SELECT efeito INTO v_financeiro_anterior
  FROM public.usuario_permissoes_individuais
  WHERE user_id = v_user_id AND permissao = 'pode_acessar_financeiro';

  SELECT efeito INTO v_fluxo_anterior
  FROM public.usuario_permissoes_individuais
  WHERE user_id = v_user_id AND permissao = 'pode_visualizar_fluxo_compras';

  DELETE FROM public.usuario_permissoes_individuais
  WHERE user_id = v_user_id AND permissao = 'pode_acessar_financeiro';

  INSERT INTO public.usuario_permissoes_individuais (
    user_id, permissao, efeito, criado_por, atualizado_por
  ) VALUES (
    v_user_id, 'pode_visualizar_fluxo_compras', 'permitir', NULL, NULL
  )
  ON CONFLICT (user_id, permissao) DO UPDATE
    SET efeito = 'permitir', atualizado_por = NULL, updated_at = now();

  IF v_financeiro_anterior IS NOT NULL THEN
    INSERT INTO public.usuario_permissoes_individuais_auditoria (
      user_id, permissao, estado_anterior, estado_novo, alterado_por, alterado_por_nome
    ) VALUES (
      v_user_id, 'pode_acessar_financeiro', v_financeiro_anterior, 'herdar', NULL,
      'Correção de escopo: acesso ao Financeiro removido'
    );
  END IF;

  IF v_fluxo_anterior IS DISTINCT FROM 'permitir' THEN
    INSERT INTO public.usuario_permissoes_individuais_auditoria (
      user_id, permissao, estado_anterior, estado_novo, alterado_por, alterado_por_nome
    ) VALUES (
      v_user_id, 'pode_visualizar_fluxo_compras', coalesce(v_fluxo_anterior, 'herdar'), 'permitir', NULL,
      'Acesso somente leitura aos cards PN, RC e PC'
    );
  END IF;
END;
$$;

-- Revoga as policies de Cotações que tinham sido concedidas por engano.
DROP POLICY IF EXISTS cotacoes_visualizacao_financeira_select ON public.cotacoes;
DROP POLICY IF EXISTS cotacao_solicitacoes_visualizacao_financeira_select ON public.cotacao_solicitacoes;
DROP POLICY IF EXISTS cotacao_itens_visualizacao_financeira_select ON public.cotacao_itens;
DROP POLICY IF EXISTS cotacao_solicitacao_itens_visualizacao_financeira_select ON public.cotacao_solicitacao_itens;
DROP POLICY IF EXISTS cotacao_solicitacoes_vinculos_visualizacao_financeira_select ON public.cotacao_solicitacoes_vinculos;
DROP POLICY IF EXISTS cotacoes_documentos_visualizacao_financeira_select ON storage.objects;

-- A leitura fica explicitamente limitada à Mai, aos dados exibidos nos cards
-- PN e PC. RC já possui policy de SELECT para usuários autenticados.
DROP POLICY IF EXISTS mai_pavan_fluxo_pn_select ON public.financeiro_necessidades;
CREATE POLICY mai_pavan_fluxo_pn_select
ON public.financeiro_necessidades FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS mai_pavan_fluxo_pn_itens_select ON public.financeiro_necessidade_itens;
CREATE POLICY mai_pavan_fluxo_pn_itens_select
ON public.financeiro_necessidade_itens FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS mai_pavan_fluxo_pc_select ON public.financeiro_pedidos_compra_formais;
CREATE POLICY mai_pavan_fluxo_pc_select
ON public.financeiro_pedidos_compra_formais FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

COMMIT;
