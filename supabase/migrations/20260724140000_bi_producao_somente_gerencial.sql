-- Atualiza somente os nomes e agrupamentos exibidos no painel individual.
-- As chaves, campos e permissões já salvas permanecem inalterados.

BEGIN;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios') THEN
    RAISE EXCEPTION 'Sem permissão para consultar acessos de outro usuário';
  END IF;

  SELECT tipo_usuario
  INTO v_tipo
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  RETURN QUERY
  WITH catalogo(chave, modulo, grupo, nome, descricao, ordem) AS (
    VALUES
      ('pode_cadastrar_itens','Estoque','Gestão de Itens','Cadastrar itens','Cadastra novos itens no estoque.',10),
      ('pode_editar_itens','Estoque','Gestão de Itens','Editar itens','Altera dados cadastrais dos itens.',20),
      ('pode_excluir_itens','Estoque','Gestão de Itens','Excluir itens','Exclui itens quando permitido.',30),
      ('pode_registrar_movimentacoes','Estoque','Movimentações diretas','Registrar movimentações','Permissão geral para registrar movimentações.',40),
      ('pode_solicitar_material','Estoque','Retirada e devolução','Retirada de Material','Libera o cartão verde Retirada de Material para solicitar itens existentes no estoque e encaminhá-los para aprovação.',50),
      ('pode_devolver_material','Estoque','Retirada e devolução','Devolver material','Permite registrar devoluções de materiais retirados.',60),
      ('pode_registrar_entrada','Estoque','Movimentações diretas','Registrar entrada','Registra entradas no estoque.',70),
      ('pode_registrar_saida','Estoque','Movimentações diretas','Registrar saída','Registra saídas diretas do estoque.',80),
      ('pode_transferir','Estoque','Movimentações diretas','Transferir entre estoques','Transfere materiais entre estoques.',90),
      ('pode_editar_movimentacoes','Estoque','Movimentações diretas','Editar movimentações','Corrige movimentações existentes.',100),
      ('pode_solicitacao_material','Estoque','Solicitações e Compras','Solicitação de Material','Libera o cartão laranja Solicitação de Material, inclusive para itens sem saldo ou ainda não cadastrados, com encaminhamento ao fluxo de compras.',110),
      ('pode_pedido_compra','Compras','Solicitações e Compras','Pedido de compra','Acessa pedidos de compra.',120),
      ('pode_apontar_producao','Produção','Produção','Apontar Produção','Registra apontamentos de produção.',130),
      ('pode_conferir_producao','Produção','Produção','Conferir Produção','Confere apontamentos de produção.',140),
      ('pode_ver_bi_producao','Gerencial','BI Produção','Ver somente BI Produção','Libera exclusivamente o BI Produção dentro do Gerencial, sem liberar o Gerencial de Almoxarifado nem o módulo Produção.',150),
      ('pode_configurar_producao','Produção','Produção','Configurar Produção','Gerencia configurações da Produção.',160),
      ('pode_gerenciar_configuracoes','Administração','Administração','Gerenciar configurações','Altera configurações gerais.',170),
      ('pode_gerenciar_usuarios','Administração','Administração','Gerenciar usuários','Cria, edita e ativa usuários e acessos.',180),
      ('pode_ver_relatorios','Administração','Administração','Ver relatórios','Acessa relatórios.',190),
      ('pode_acessar_gerencial','Gerencial','Gerencial de Almoxarifado','Acessar Gerencial de Almoxarifado','Permite acessar indicadores, saldos, devoluções e pendências do almoxarifado.',200),
      ('pode_acessar_projetos','Administração','Administração','Acessar projetos','Acessa a área de projetos.',210)
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
    CASE
      WHEN v_tipo = 'administrador' THEN 'administrador'
      WHEN up.efeito IS NOT NULL THEN 'individual'
      ELSE 'perfil'
    END
  FROM catalogo c
  LEFT JOIN public.usuario_permissoes_individuais up
    ON up.user_id = p_user_id
   AND up.permissao = c.chave
  ORDER BY c.ordem;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_permissoes_usuario(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_usuario(UUID) TO authenticated;

COMMIT;