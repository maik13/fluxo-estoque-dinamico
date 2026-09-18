BEGIN;

ALTER TABLE public.producao_ordens_etapas_auditoria
  ADD COLUMN IF NOT EXISTS etapa_origem_codigo_snapshot text,
  ADD COLUMN IF NOT EXISTS etapa_origem_nome_snapshot text,
  ADD COLUMN IF NOT EXISTS etapa_destino_codigo_snapshot text,
  ADD COLUMN IF NOT EXISTS etapa_destino_nome_snapshot text;

UPDATE public.producao_ordens_etapas_auditoria a
SET
  etapa_origem_codigo_snapshot = COALESCE(a.etapa_origem_codigo_snapshot, po.codigo),
  etapa_origem_nome_snapshot = COALESCE(a.etapa_origem_nome_snapshot, po.nome),
  etapa_destino_codigo_snapshot = COALESCE(a.etapa_destino_codigo_snapshot, pd.codigo),
  etapa_destino_nome_snapshot = COALESCE(a.etapa_destino_nome_snapshot, pd.nome)
FROM public.producao_processos po, public.producao_processos pd
WHERE po.id = a.etapa_origem_id
  AND pd.id = a.etapa_destino_id;

ALTER TABLE public.producao_ordens_etapas_auditoria
  ALTER COLUMN etapa_origem_id DROP NOT NULL,
  ALTER COLUMN etapa_destino_id DROP NOT NULL;

ALTER TABLE public.producao_ordens_etapas_auditoria
  DROP CONSTRAINT IF EXISTS producao_ordens_etapas_auditoria_etapa_origem_id_fkey,
  DROP CONSTRAINT IF EXISTS producao_ordens_etapas_auditoria_etapa_destino_id_fkey;

ALTER TABLE public.producao_ordens_etapas_auditoria
  ADD CONSTRAINT producao_ordens_etapas_auditoria_etapa_origem_id_fkey
    FOREIGN KEY (etapa_origem_id) REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ADD CONSTRAINT producao_ordens_etapas_auditoria_etapa_destino_id_fkey
    FOREIGN KEY (etapa_destino_id) REFERENCES public.producao_processos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.reclassificar_ordem_producao_etapa_v1(
  p_ordem_producao_id uuid,
  p_nova_etapa_id uuid,
  p_justificativa text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_nome_usuario text;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_etapa_origem public.producao_processos%ROWTYPE;
  v_etapa_destino public.producao_processos%ROWTYPE;
  v_qtd_apontamentos integer := 0;
  v_justificativa text := NULLIF(btrim(COALESCE(p_justificativa, '')), '');
BEGIN
  IF v_user IS NULL
     OR NOT (public.is_admin() OR public.usuario_tem_permissao_producao('processos')) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a etapa da Ordem de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  SELECT * INTO v_etapa_origem
  FROM public.producao_processos
  WHERE id = v_op.processo_id;

  SELECT * INTO v_etapa_destino
  FROM public.producao_processos
  WHERE id = p_nova_etapa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de destino não encontrada';
  END IF;

  IF v_etapa_destino.projeto_id IS DISTINCT FROM v_op.projeto_id THEN
    RAISE EXCEPTION 'A nova etapa precisa pertencer ao mesmo projeto da OP';
  END IF;

  IF v_etapa_destino.status = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível mover a OP para uma etapa cancelada';
  END IF;

  IF v_op.processo_id = p_nova_etapa_id THEN
    RETURN jsonb_build_object(
      'alterada', false,
      'ordem_producao_id', v_op.id,
      'etapa_id', v_op.processo_id,
      'apontamentos_reclassificados', 0
    );
  END IF;

  SELECT COALESCE(NULLIF(p.nome, ''), p.email, v_user::text)
  INTO v_nome_usuario
  FROM public.profiles p
  WHERE p.user_id = v_user
  LIMIT 1;

  v_nome_usuario := COALESCE(v_nome_usuario, v_user::text);

  PERFORM set_config('app.reclassificar_op_etapa', 'on', true);

  UPDATE public.producao_ordens_producao
  SET processo_id = p_nova_etapa_id,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome_usuario,
      updated_at = now()
  WHERE id = v_op.id;

  UPDATE public.producao_apontamentos
  SET processo_id = p_nova_etapa_id,
      updated_at = now()
  WHERE ordem_producao_id = v_op.id
    AND processo_id IS DISTINCT FROM p_nova_etapa_id;

  GET DIAGNOSTICS v_qtd_apontamentos = ROW_COUNT;

  INSERT INTO public.producao_ordens_etapas_auditoria (
    ordem_producao_id, projeto_id, etapa_origem_id, etapa_destino_id,
    etapa_origem_codigo_snapshot, etapa_origem_nome_snapshot,
    etapa_destino_codigo_snapshot, etapa_destino_nome_snapshot,
    justificativa, apontamentos_reclassificados,
    alterado_por_id, alterado_por_nome_snapshot
  ) VALUES (
    v_op.id, v_op.projeto_id, v_op.processo_id, p_nova_etapa_id,
    v_etapa_origem.codigo, v_etapa_origem.nome,
    v_etapa_destino.codigo, v_etapa_destino.nome,
    v_justificativa, v_qtd_apontamentos,
    v_user, v_nome_usuario
  );

  UPDATE public.producao_processos
  SET updated_at = now()
  WHERE id IN (v_op.processo_id, p_nova_etapa_id);

  RETURN jsonb_build_object(
    'alterada', true,
    'ordem_producao_id', v_op.id,
    'etapa_origem_id', v_op.processo_id,
    'etapa_origem_nome', v_etapa_origem.nome,
    'etapa_destino_id', p_nova_etapa_id,
    'etapa_destino_nome', v_etapa_destino.nome,
    'apontamentos_reclassificados', v_qtd_apontamentos
  );
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
