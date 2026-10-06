BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_movement_order_repair_audit_20261006 (
  movement_id uuid PRIMARY KEY REFERENCES public.movements(id),
  pair_role text NOT NULL,
  classification text NOT NULL,
  item_id uuid NOT NULL,
  estoque_id uuid,
  old_data_hora timestamptz NOT NULL,
  new_data_hora timestamptz NOT NULL,
  old_quantidade_anterior numeric,
  old_quantidade_atual numeric,
  new_quantidade_anterior numeric,
  new_quantidade_atual numeric,
  paired_movement_id uuid,
  repaired_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);

ALTER TABLE public.inventory_movement_order_repair_audit_20261006 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_movement_order_repair_audit_20261006 FROM anon, authenticated;

-- Corrige pares ENTRADA -> SAIDA cuja ordem do servidor é inequívoca,
-- mas data_hora (relógio do dispositivo) os deixou invertidos.
CREATE TEMP TABLE _safe_entry_exit_pairs ON COMMIT DROP AS
WITH c AS (
  SELECT m.*,
         lead(id) over(partition by item_id,estoque_id order by created_at,id) saida_id,
         lead(tipo) over(partition by item_id,estoque_id order by created_at,id) saida_tipo,
         lead(created_at) over(partition by item_id,estoque_id order by created_at,id) saida_created,
         lead(data_hora) over(partition by item_id,estoque_id order by created_at,id) saida_data,
         lead(quantidade) over(partition by item_id,estoque_id order by created_at,id) saida_qtd,
         lead(quantidade_anterior) over(partition by item_id,estoque_id order by created_at,id) saida_ant,
         lead(quantidade_atual) over(partition by item_id,estoque_id order by created_at,id) saida_atual,
         lead(solicitacao_id) over(partition by item_id,estoque_id order by created_at,id) saida_solicitacao
  FROM public.movements m
)
SELECT *,
  CASE
    WHEN saida_ant = quantidade_atual
     AND saida_atual = quantidade_atual - saida_qtd
     AND saida_qtd <= quantidade_atual
      THEN 'sequencia_comprovada'
    WHEN coalesce(saida_ant,0)=0
     AND coalesce(saida_atual,0)=0
     AND saida_qtd <= quantidade_atual
      THEN 'zero_zero_reconstruivel'
    ELSE 'ambiguo'
  END classification
FROM c
WHERE tipo='ENTRADA'
  AND saida_tipo='SAIDA'
  AND saida_solicitacao IS NOT NULL
  AND created_at < saida_created
  AND data_hora > saida_data
  AND extract(epoch from (saida_created-created_at)) BETWEEN 0 AND 600
  AND (
    (saida_ant = quantidade_atual
      AND saida_atual = quantidade_atual - saida_qtd
      AND saida_qtd <= quantidade_atual)
    OR
    (coalesce(saida_ant,0)=0
      AND coalesce(saida_atual,0)=0
      AND saida_qtd <= quantidade_atual)
  );

INSERT INTO public.inventory_movement_order_repair_audit_20261006 (
  movement_id,pair_role,classification,item_id,estoque_id,
  old_data_hora,new_data_hora,
  old_quantidade_anterior,old_quantidade_atual,
  new_quantidade_anterior,new_quantidade_atual,
  paired_movement_id,reason
)
SELECT
  p.id,'entrada',p.classification,p.item_id,p.estoque_id,
  p.data_hora,p.created_at,
  p.quantidade_anterior,p.quantidade_atual,
  p.quantidade_anterior,p.quantidade_atual,
  p.saida_id,
  'Corrige inversão temporal causada por data_hora proveniente do relógio do dispositivo.'
FROM _safe_entry_exit_pairs p
ON CONFLICT (movement_id) DO NOTHING;

INSERT INTO public.inventory_movement_order_repair_audit_20261006 (
  movement_id,pair_role,classification,item_id,estoque_id,
  old_data_hora,new_data_hora,
  old_quantidade_anterior,old_quantidade_atual,
  new_quantidade_anterior,new_quantidade_atual,
  paired_movement_id,reason
)
SELECT
  s.id,'saida',p.classification,s.item_id,s.estoque_id,
  s.data_hora,s.created_at,
  s.quantidade_anterior,s.quantidade_atual,
  CASE WHEN p.classification='zero_zero_reconstruivel' THEN p.quantidade_atual ELSE s.quantidade_anterior END,
  CASE WHEN p.classification='zero_zero_reconstruivel' THEN p.quantidade_atual-s.quantidade ELSE s.quantidade_atual END,
  p.id,
  CASE WHEN p.classification='zero_zero_reconstruivel'
    THEN 'Corrige inversão temporal e reconstrói saída 0->0 pela entrada imediatamente anterior.'
    ELSE 'Corrige inversão temporal; saldo da saída já era coerente.'
  END
FROM _safe_entry_exit_pairs p
JOIN public.movements s ON s.id=p.saida_id
ON CONFLICT (movement_id) DO NOTHING;

ALTER TABLE public.movements DISABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

UPDATE public.movements m
SET data_hora=m.created_at
WHERE m.id IN (
  SELECT id FROM _safe_entry_exit_pairs
  UNION
  SELECT saida_id FROM _safe_entry_exit_pairs
);

UPDATE public.movements s
SET quantidade_anterior=p.quantidade_atual,
    quantidade_atual=p.quantidade_atual-s.quantidade
FROM _safe_entry_exit_pairs p
WHERE p.classification='zero_zero_reconstruivel'
  AND s.id=p.saida_id
  AND coalesce(s.quantidade_anterior,0)=0
  AND coalesce(s.quantidade_atual,0)=0
  AND s.quantidade<=p.quantidade_atual;

-- Corrige apenas pares SAIDA -> ENTRADA comprovados e com clock-skew <= 10 min
-- em ambos os registros; lançamentos retroativos maiores ficam intactos.
WITH s AS (
  SELECT m.*,
         lead(id) over(partition by item_id,estoque_id order by created_at,id) next_id,
         lead(tipo) over(partition by item_id,estoque_id order by created_at,id) next_tipo,
         lead(created_at) over(partition by item_id,estoque_id order by created_at,id) next_created_at,
         lead(data_hora) over(partition by item_id,estoque_id order by created_at,id) next_data_hora,
         lead(quantidade) over(partition by item_id,estoque_id order by created_at,id) next_qtd,
         lead(quantidade_anterior) over(partition by item_id,estoque_id order by created_at,id) next_ant,
         lead(quantidade_atual) over(partition by item_id,estoque_id order by created_at,id) next_atual
  FROM public.movements m
),
safe AS (
  SELECT *
  FROM s
  WHERE tipo='SAIDA'
    AND next_tipo='ENTRADA'
    AND created_at < next_created_at
    AND data_hora > next_data_hora
    AND abs(extract(epoch from (data_hora-created_at))) <= 600
    AND abs(extract(epoch from (next_data_hora-next_created_at))) <= 600
    AND extract(epoch from (next_created_at-created_at)) BETWEEN 0 AND 600
    AND quantidade_atual=next_ant
    AND next_atual=next_ant+next_qtd
)
UPDATE public.movements m
SET data_hora=m.created_at
FROM safe s
WHERE m.id=s.id;

ALTER TABLE public.movements ENABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

-- O saldo corrente passa a seguir exclusivamente a sequência do servidor.
CREATE OR REPLACE FUNCTION public.calcular_saldo_movimento_atomico_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
DECLARE
  v_saldo numeric := 0;
  v_operacao text := '';
BEGIN
  IF new.tipo NOT IN ('ENTRADA','SAIDA') THEN RETURN new; END IF;
  IF new.quantidade IS NULL OR new.quantidade<=0 THEN
    RAISE EXCEPTION 'A quantidade da movimentação deve ser maior que zero.';
  END IF;

  PERFORM 1 FROM public.items WHERE id=new.item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado para registrar a movimentação.'; END IF;

  SELECT coalesce(m.quantidade_atual,0)
  INTO v_saldo
  FROM public.movements m
  WHERE m.item_id=new.item_id
    AND m.estoque_id IS NOT DISTINCT FROM new.estoque_id
  ORDER BY m.created_at DESC,m.id DESC
  LIMIT 1;

  v_saldo:=coalesce(v_saldo,0);

  IF new.tipo_operacao_id IS NOT NULL THEN
    SELECT lower(trim(coalesce(t.nome,''))) INTO v_operacao
    FROM public.tipos_operacao t WHERE t.id=new.tipo_operacao_id;
  END IF;

  new.quantidade_anterior:=v_saldo;

  IF new.tipo='ENTRADA' THEN
    IF coalesce(v_operacao,'') LIKE '%acerto%' THEN
      new.quantidade_atual:=new.quantidade;
    ELSE
      new.quantidade_atual:=v_saldo+new.quantidade;
    END IF;
  ELSE
    IF new.quantidade>v_saldo THEN
      RAISE EXCEPTION 'Estoque insuficiente. Saldo atual: %, quantidade solicitada: %.',v_saldo,new.quantidade;
    END IF;
    new.quantidade_atual:=v_saldo-new.quantidade;
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_saldos_estoque_v1(
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false
)
RETURNS TABLE(item_id uuid,saldo_atual numeric,ultima_movimentacao jsonb)
LANGUAGE sql
STABLE
SET search_path=public
AS $$
SELECT DISTINCT ON (m.item_id)
  m.item_id,
  m.quantidade_atual::numeric,
  jsonb_build_object(
    'id',m.id,'itemId',m.item_id,'tipo',m.tipo,'quantidade',m.quantidade,
    'quantidadeAnterior',m.quantidade_anterior,'quantidadeAtual',m.quantidade_atual,
    'userId',m.user_id,'observacoes',m.observacoes,'dataHora',m.created_at,
    'localUtilizacaoId',m.local_utilizacao_id,'solicitacaoId',m.solicitacao_id,
    'destinatario',m.destinatario,'estoqueId',m.estoque_id,
    'tipoOperacaoId',m.tipo_operacao_id,'itemSnapshot',m.item_snapshot
  )
FROM public.movements m
WHERE auth.uid() IS NOT NULL
  AND (
    p_estoque_id IS NULL OR m.estoque_id=p_estoque_id
    OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
  )
ORDER BY m.item_id,m.created_at DESC,m.id DESC;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_v1(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_v1(uuid,boolean) TO authenticated;

-- Atualiza funções legadas de saldo/visualização sem alterar seus contratos.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.converter_solicitacao_material_retirada_v1(uuid)'::regprocedure) INTO v_def;
  v_def:=replace(v_def,'ORDER BY m.data_hora DESC, m.id DESC','ORDER BY m.created_at DESC, m.id DESC');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.listar_posicoes_estoque_exportacao_v1(uuid,boolean,uuid[])'::regprocedure) INTO v_def;
  v_def:=replace(v_def,'ORDER BY m.data_hora DESC, m.id DESC','ORDER BY m.created_at DESC, m.id DESC');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.listar_planejamento_producao_v2()'::regprocedure) INTO v_def;
  v_def:=replace(v_def,'ORDER BY m.item_id, m.data_hora DESC, m.id DESC','ORDER BY m.item_id, m.created_at DESC, m.id DESC');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.consultar_ferramenta_producao_v1(text)'::regprocedure) INTO v_def;
  v_def:=replace(v_def,
    'select m.id,m.tipo,m.quantidade,m.data_hora,m.observacoes,m.solicitacao_id,',
    'select m.id,m.tipo,m.quantidade,m.created_at as data_hora,m.observacoes,m.solicitacao_id,');
  v_def:=replace(v_def,
    'select m.id,m.solicitacao_id,m.data_hora,m.quantidade,m.estoque_id,m.local_utilizacao_id,',
    'select m.id,m.solicitacao_id,m.created_at as data_hora,m.quantidade,m.estoque_id,m.local_utilizacao_id,');
  v_def:=replace(v_def,'d.data_hora>=m.data_hora','d.created_at>=m.created_at');
  EXECUTE v_def;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
