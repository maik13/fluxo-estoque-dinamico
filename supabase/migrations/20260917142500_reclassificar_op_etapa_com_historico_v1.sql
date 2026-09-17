BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_ordens_etapas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id uuid NOT NULL REFERENCES public.producao_ordens_producao(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  etapa_origem_id uuid NOT NULL REFERENCES public.producao_processos(id) ON DELETE RESTRICT,
  etapa_destino_id uuid NOT NULL REFERENCES public.producao_processos(id) ON DELETE RESTRICT,
  justificativa text NOT NULL,
  apontamentos_reclassificados integer NOT NULL DEFAULT 0,
  alterado_por_id uuid NULL,
  alterado_por_nome_snapshot text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.producao_ordens_etapas_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producao_ordens_etapas_auditoria FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.bloquear_reparent_op_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_projeto_etapa UUID;
  v_reclassificacao_controlada BOOLEAN := COALESCE(current_setting('app.reclassificar_op_etapa', true), '') = 'on';
BEGIN
  SELECT p.projeto_id
    INTO v_projeto_etapa
    FROM public.producao_processos p
   WHERE p.id = NEW.processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa da Ordem de Produção não existe';
  END IF;

  IF NEW.projeto_id IS DISTINCT FROM v_projeto_etapa THEN
    RAISE EXCEPTION 'O Projeto da OP deve ser o mesmo Projeto da Etapa';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.projeto_id IS DISTINCT FROM NEW.projeto_id THEN
      RAISE EXCEPTION 'O Projeto da Ordem de Produção não pode ser alterado após a emissão';
    END IF;

    IF OLD.processo_id IS DISTINCT FROM NEW.processo_id
       AND NOT v_reclassificacao_controlada THEN
      RAISE EXCEPTION 'A Etapa da Ordem de Produção só pode ser alterada pela rotina controlada de reclassificação';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reclassificar_ordem_producao_etapa_v1(
  p_ordem_producao_id uuid,
  p_nova_etapa_id uuid,
  p_justificativa text
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
  v_justificativa text := btrim(COALESCE(p_justificativa, ''));
BEGIN
  IF v_user IS NULL
     OR NOT (
       public.is_admin()
       OR public.usuario_tem_permissao_producao('processos')
     ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a etapa da Ordem de Produção';
  END IF;

  IF v_justificativa = '' THEN
    RAISE EXCEPTION 'Informe o motivo da alteração de etapa da OP';
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
    ordem_producao_id,
    projeto_id,
    etapa_origem_id,
    etapa_destino_id,
    justificativa,
    apontamentos_reclassificados,
    alterado_por_id,
    alterado_por_nome_snapshot
  ) VALUES (
    v_op.id,
    v_op.projeto_id,
    v_op.processo_id,
    p_nova_etapa_id,
    v_justificativa,
    v_qtd_apontamentos,
    v_user,
    v_nome_usuario
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

REVOKE ALL ON FUNCTION public.reclassificar_ordem_producao_etapa_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclassificar_ordem_producao_etapa_v1(uuid, uuid, text) TO authenticated;

DO $block$
DECLARE
  v_projeto record;
  v_num integer;
  v_codigo text;
  v_seq bigint;
BEGIN
  FOR v_projeto IN
    SELECT id FROM public.producao_projetos WHERE ativo = true ORDER BY created_at, id
  LOOP
    FOR v_num IN 1..3 LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.producao_processos p
        WHERE p.projeto_id = v_projeto.id
          AND lower(btrim(p.nome)) = lower('Etapa ' || v_num::text)
      ) THEN
        v_seq := nextval('public.producao_processo_codigo_seq');
        v_codigo := 'PRD-' || to_char(current_date, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');

        INSERT INTO public.producao_processos (
          codigo, projeto_id, nome, descricao, status, prioridade, sequencia, created_at, updated_at
        ) VALUES (
          v_codigo,
          v_projeto.id,
          'Etapa ' || v_num::text,
          'Etapa padrão criada para reorganização manual das Ordens de Produção.',
          'planejado',
          'normal',
          900 + v_num,
          now(),
          now()
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$block$;

NOTIFY pgrst, 'reload schema';

COMMIT;
