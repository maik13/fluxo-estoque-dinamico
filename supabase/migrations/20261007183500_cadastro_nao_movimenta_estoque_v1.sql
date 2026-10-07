BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_correcao_cadastro_sem_estoque_20261007;

CREATE TABLE IF NOT EXISTS backup_correcao_cadastro_sem_estoque_20261007.movements_1879_1882
AS
SELECT m.*
FROM public.movements m
JOIN public.items i ON i.id=m.item_id
WHERE i.codigo_barras IN (1879,1880,1881,1882);

CREATE OR REPLACE FUNCTION public.validar_movimento_ferramenta_unitaria_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item public.items%rowtype;
  v_ultimo_saldo numeric;
  v_eh_ferramenta boolean;
  v_nome_normalizado text;
BEGIN
  SELECT * INTO v_item FROM public.items WHERE id=new.item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN new; END IF;

  SELECT exists (
    SELECT 1 FROM public.categorias c
    WHERE c.id=v_item.categoria_id
      AND lower(trim(coalesce(c.nome,'')))='ferramenta'
  ) INTO v_eh_ferramenta;

  v_nome_normalizado := lower(trim(coalesce(v_item.nome,'')));

  IF NOT v_eh_ferramenta
     OR NOT coalesce(v_item.ativo,true)
     OR v_nome_normalizado LIKE '%allen%'
     OR v_nome_normalizado LIKE '%alen%'
     OR v_nome_normalizado LIKE '%bitz%'
     OR v_nome_normalizado LIKE '%bits%' THEN
    RETURN new;
  END IF;

  -- REGRA: CADASTRO cria a identidade do item, mas não movimenta estoque.
  IF new.tipo='CADASTRO' THEN
    new.quantidade := 0;
    new.quantidade_anterior := 0;
    new.quantidade_atual := 0;
    RETURN new;
  END IF;

  IF new.tipo NOT IN ('ENTRADA','SAIDA') THEN RETURN new; END IF;

  IF new.quantidade IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Ferramenta patrimonial deve ser movimentada individualmente (quantidade 1): %.',v_item.nome;
  END IF;

  SELECT m.quantidade_atual INTO v_ultimo_saldo
  FROM public.movements m
  WHERE m.item_id=new.item_id
  ORDER BY m.created_at DESC,m.id DESC
  LIMIT 1;

  IF new.tipo='SAIDA' THEN
    IF coalesce(v_ultimo_saldo,0)<>1 THEN
      RAISE EXCEPTION 'A ferramenta "%" não possui entrada disponível no almoxarifado para saída.',v_item.nome;
    END IF;
    new.quantidade_anterior:=1;
    new.quantidade_atual:=0;
  ELSE
    IF coalesce(v_ultimo_saldo,0)<>0 THEN
      RAISE EXCEPTION 'A ferramenta "%" já está no almoxarifado e não pode ter nova devolução/entrada.',v_item.nome;
    END IF;
    new.quantidade_anterior:=0;
    new.quantidade_atual:=1;
  END IF;

  RETURN new;
END;
$function$;

ALTER TABLE public.movements
  DISABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

UPDATE public.movements m
SET quantidade=0,
    quantidade_anterior=0,
    quantidade_atual=0
FROM public.items i
WHERE i.id=m.item_id
  AND i.codigo_barras IN (1879,1880,1881,1882)
  AND m.tipo='CADASTRO'
  AND NOT EXISTS (
    SELECT 1
    FROM public.movements x
    WHERE x.item_id=i.id
      AND x.tipo IN ('ENTRADA','SAIDA')
  );

ALTER TABLE public.movements
  ENABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

COMMIT;