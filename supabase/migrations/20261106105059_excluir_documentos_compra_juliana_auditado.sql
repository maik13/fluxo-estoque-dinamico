-- Exclusão lógica/auditada do fluxo PN -> RC -> PC.
-- O usuário vê a ação como "Excluir", porém documentos financeiros com histórico
-- são cancelados e preservados para rastreabilidade. O PC pode ser removido
-- fisicamente depois que seu snapshot completo é gravado na auditoria, permitindo
-- que a mesma RC gere um novo PC sem violar a chave única.

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT IF EXISTS usuario_permissoes_individuais_permissao_valida;

ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK (
    permissao = ANY (ARRAY[
      'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens',
      'pode_registrar_movimentacoes','pode_solicitar_material','pode_devolver_material',
      'pode_registrar_entrada','pode_registrar_saida','pode_transferir',
      'pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
      'pode_excluir_documentos_compra','pode_apontar_producao','pode_conferir_producao',
      'pode_ver_bi_producao','pode_configurar_producao','pode_excluir_ops',
      'pode_gerenciar_configuracoes','pode_gerenciar_usuarios','pode_ver_relatorios',
      'pode_acessar_gerencial','pode_acessar_projetos','pode_acessar_financeiro',
      'pode_gerenciar_financeiro','pode_aprovar_financeiro','pode_programar_financeiro',
      'pode_conciliar_financeiro','pode_ver_relatorios_financeiro','rh_acessar',
      'rh_colaboradores_visualizar','rh_colaboradores_gerenciar','rh_jornadas_gerenciar',
      'rh_feriados_gerenciar','ponto_registrar','ponto_visualizar','ponto_gerenciar',
      'ponto_aprovar','planejamento2_acessar','acompanhamento_acessar',
      'imagens_op_acessar','orcamento_solicitar'
    ])
  );

CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
    'compras.orcamentos.solicitar', public.permissao_individual_efetiva(auth.uid(),'orcamento_solicitar'),
    'compras.pedidos.criar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'compras.pedidos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'projetos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_projetos'),
    'gerencial.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_gerencial'),
    'relatorios.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios'),
    'producao.acessar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
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
    'financeiro.relatorios', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios_financeiro'),
    'planejamento2.acessar', public.permissao_individual_efetiva(auth.uid(),'planejamento2_acessar'),
    'acompanhamento.acessar', public.permissao_individual_efetiva(auth.uid(),'acompanhamento_acessar'),
    'imagensop.acessar', public.permissao_individual_efetiva(auth.uid(),'imagens_op_acessar'),
    'rh.acessar', public.permissao_individual_efetiva(auth.uid(),'rh_acessar'),
    'rh.colaboradores.visualizar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_visualizar'),
    'rh.colaboradores.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar'),
    'rh.jornadas.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_jornadas_gerenciar'),
    'rh.feriados.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_feriados_gerenciar'),
    'ponto.registrar', public.permissao_individual_efetiva(auth.uid(),'ponto_registrar'),
    'ponto.visualizar', public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar'),
    'ponto.gerenciar', public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'),
    'ponto.aprovar', public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
  ) || jsonb_build_object(
    'compras.documentos.excluir', public.permissao_individual_efetiva(auth.uid(),'pode_excluir_documentos_compra')
  );
$function$;

CREATE TABLE IF NOT EXISTS public.compras_documentos_exclusao_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_tipo text NOT NULL CHECK (documento_tipo IN ('pn','rc','pc')),
  documento_id uuid NOT NULL,
  documento_numero bigint,
  estado_anterior jsonb NOT NULL,
  motivo text,
  excluido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  excluido_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras_documentos_exclusao_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compras_documentos_exclusao_auditoria_select
  ON public.compras_documentos_exclusao_auditoria;
CREATE POLICY compras_documentos_exclusao_auditoria_select
  ON public.compras_documentos_exclusao_auditoria
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_excluir_documentos_compra')
  );

CREATE OR REPLACE FUNCTION public.compras_excluir_documento_v1(
  p_tipo text,
  p_documento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_nome text;
  v_tipo text := lower(btrim(coalesce(p_tipo,'')));
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_rc public.pedidos_compra%ROWTYPE;
  v_pc public.financeiro_pedidos_compra_formais%ROWTYPE;
  v_snapshot jsonb;
BEGIN
  IF v_user IS NULL OR NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_excluir_documentos_compra')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir PN, RC ou PC';
  END IF;

  IF v_tipo NOT IN ('pn','rc','pc') THEN
    RAISE EXCEPTION 'Tipo de documento inválido';
  END IF;

  SELECT coalesce(nome,email,'Usuário') INTO v_nome
  FROM public.profiles WHERE user_id=v_user LIMIT 1;

  IF v_tipo='pn' THEN
    SELECT * INTO v_pn FROM public.financeiro_necessidades
    WHERE id=p_documento_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PN não encontrada'; END IF;
    IF v_pn.status='cancelado' THEN
      RETURN jsonb_build_object('ok',true,'tipo','pn','numero',v_pn.numero,'status','cancelado');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.pedidos_compra rc
      WHERE (rc.id=v_pn.requisicao_compra_id OR rc.pn_origem_id=v_pn.id)
        AND rc.status<>'cancelado'
    ) THEN
      RAISE EXCEPTION 'Esta PN possui RC ativa. Exclua primeiro o PC (se houver) e depois a RC.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.financeiro_lancamentos l
      WHERE l.necessidade_id=v_pn.id
        AND (l.status IN ('pago','conciliado') OR coalesce(l.valor_realizado,0)<>0 OR l.data_realizada IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Esta PN possui pagamento ou realização financeira e não pode ser excluída.';
    END IF;

    v_snapshot := to_jsonb(v_pn);
    UPDATE public.financeiro_programacoes p SET status='cancelado',updated_at=now()
    FROM public.financeiro_lancamentos l
    WHERE p.lancamento_id=l.id AND l.necessidade_id=v_pn.id AND p.status<>'cancelado';
    UPDATE public.financeiro_lancamentos SET status='cancelado',updated_at=now()
    WHERE necessidade_id=v_pn.id AND status<>'cancelado';
    UPDATE public.financeiro_necessidades
    SET status='cancelado',updated_at=now(),updated_by=v_user,
        justificativa=concat_ws(E'\n',justificativa,'Excluída de forma auditada por '||coalesce(v_nome,'Usuário')||'.')
    WHERE id=v_pn.id;

    INSERT INTO public.compras_documentos_exclusao_auditoria
      (documento_tipo,documento_id,documento_numero,estado_anterior,motivo,excluido_por,excluido_por_nome)
    VALUES ('pn',v_pn.id,v_pn.numero,v_snapshot,nullif(btrim(p_motivo),''),v_user,v_nome);

    RETURN jsonb_build_object('ok',true,'tipo','pn','numero',v_pn.numero,'status','cancelado');
  END IF;

  IF v_tipo='rc' THEN
    SELECT * INTO v_rc FROM public.pedidos_compra
    WHERE id=p_documento_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
    IF v_rc.status='cancelado' THEN
      RETURN jsonb_build_object('ok',true,'tipo','rc','numero',v_rc.numero,'status','cancelado');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.financeiro_pedidos_compra_formais pc
      WHERE pc.requisicao_compra_id=v_rc.id AND pc.status<>'cancelado'
    ) THEN
      RAISE EXCEPTION 'Esta RC possui PC ativo. Exclua primeiro o PC.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.financeiro_lancamentos l
      JOIN public.financeiro_necessidades pn ON pn.id=l.necessidade_id
      WHERE (pn.id=v_rc.pn_origem_id OR pn.requisicao_compra_id=v_rc.id)
        AND (l.status IN ('pago','conciliado') OR coalesce(l.valor_realizado,0)<>0 OR l.data_realizada IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Esta RC possui pagamento ou realização financeira e não pode ser excluída.';
    END IF;

    v_snapshot := to_jsonb(v_rc);
    UPDATE public.financeiro_programacoes p SET status='cancelado',updated_at=now()
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_necessidades pn ON pn.id=l.necessidade_id
    WHERE p.lancamento_id=l.id
      AND (pn.id=v_rc.pn_origem_id OR pn.requisicao_compra_id=v_rc.id)
      AND p.status<>'cancelado';
    UPDATE public.financeiro_lancamentos l SET status='cancelado',updated_at=now()
    FROM public.financeiro_necessidades pn
    WHERE l.necessidade_id=pn.id
      AND (pn.id=v_rc.pn_origem_id OR pn.requisicao_compra_id=v_rc.id)
      AND l.status<>'cancelado';
    UPDATE public.financeiro_necessidades
    SET requisicao_compra_id=NULL,
        status=CASE WHEN status='cancelado' THEN status ELSE 'previsto' END,
        updated_at=now(),updated_by=v_user,
        justificativa=concat_ws(E'\n',justificativa,'RC-'||lpad(v_rc.numero::text,4,'0')||' excluída de forma auditada.')
    WHERE id=v_rc.pn_origem_id OR requisicao_compra_id=v_rc.id;
    UPDATE public.pedidos_compra
    SET status='cancelado',updated_at=now(),
        observacoes=concat_ws(E'\n',observacoes,'Excluída de forma auditada por '||coalesce(v_nome,'Usuário')||'.')
    WHERE id=v_rc.id;

    INSERT INTO public.compras_documentos_exclusao_auditoria
      (documento_tipo,documento_id,documento_numero,estado_anterior,motivo,excluido_por,excluido_por_nome)
    VALUES ('rc',v_rc.id,v_rc.numero,v_snapshot,nullif(btrim(p_motivo),''),v_user,v_nome);

    RETURN jsonb_build_object('ok',true,'tipo','rc','numero',v_rc.numero,'status','cancelado');
  END IF;

  SELECT * INTO v_pc FROM public.financeiro_pedidos_compra_formais
  WHERE id=p_documento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PC não encontrado'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.financeiro_pc_parcelas parcela
    JOIN public.financeiro_lancamentos l ON l.id=parcela.lancamento_id
    WHERE parcela.pedido_compra_formal_id=v_pc.id
      AND (l.status IN ('pago','conciliado') OR coalesce(l.valor_realizado,0)<>0 OR l.data_realizada IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_programacoes p
    WHERE p.pedido_compra_formal_id=v_pc.id AND p.status='liquidado'
  ) THEN
    RAISE EXCEPTION 'Este PC possui pagamento, conciliação ou liquidação e não pode ser excluído.';
  END IF;

  SELECT jsonb_build_object(
    'documento',to_jsonb(v_pc),
    'parcelas',coalesce(jsonb_agg(to_jsonb(parcela)) FILTER (WHERE parcela.id IS NOT NULL),'[]'::jsonb)
  ) INTO v_snapshot
  FROM public.financeiro_pc_parcelas parcela
  WHERE parcela.pedido_compra_formal_id=v_pc.id;

  UPDATE public.financeiro_programacoes SET status='cancelado',updated_at=now()
  WHERE pedido_compra_formal_id=v_pc.id AND status<>'cancelado';
  UPDATE public.financeiro_lancamentos l SET status='cancelado',updated_at=now()
  FROM public.financeiro_pc_parcelas parcela
  WHERE parcela.pedido_compra_formal_id=v_pc.id
    AND l.id=parcela.lancamento_id AND l.status<>'cancelado';

  INSERT INTO public.compras_documentos_exclusao_auditoria
    (documento_tipo,documento_id,documento_numero,estado_anterior,motivo,excluido_por,excluido_por_nome)
  VALUES ('pc',v_pc.id,v_pc.numero,v_snapshot,nullif(btrim(p_motivo),''),v_user,v_nome);

  DELETE FROM public.financeiro_pedidos_compra_formais WHERE id=v_pc.id;
  UPDATE public.pedidos_compra
  SET status='aberto',status_financeiro_rc='aprovada',updated_at=now()
  WHERE id=v_pc.requisicao_compra_id;

  RETURN jsonb_build_object('ok',true,'tipo','pc','numero',v_pc.numero,'status','excluido');
END;
$function$;

REVOKE ALL ON FUNCTION public.compras_excluir_documento_v1(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_excluir_documento_v1(text,uuid,text) TO authenticated;

-- Liberação solicitada especificamente para Juliana.
INSERT INTO public.usuario_permissoes_individuais
  (user_id,permissao,efeito,criado_por,atualizado_por)
SELECT p.user_id,'pode_excluir_documentos_compra','permitir',NULL,NULL
FROM public.profiles p
WHERE lower(p.email)=lower('juh.lauriano@gmail.com') AND coalesce(p.ativo,true)
ON CONFLICT (user_id,permissao) DO UPDATE SET
  efeito='permitir',updated_at=now(),atualizado_por=NULL;
