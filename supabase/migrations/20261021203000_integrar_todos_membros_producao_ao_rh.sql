BEGIN;

-- Corrige a grafia divergente já confirmada entre Produção e RH sem duplicar a pessoa.
UPDATE public.producao_membros pm
SET rh_colaborador_id = rc.id,
    updated_at = now()
FROM public.rh_colaboradores rc
WHERE pm.rh_colaborador_id IS NULL
  AND lower(btrim(coalesce(nullif(pm.nome_snapshot, ''), pm.nome))) = 'isabella'
  AND lower(btrim(rc.nome)) = 'isabela';

-- Todo membro da Produção precisa possuir uma representação formal no RH.
INSERT INTO public.rh_colaboradores (
  nome,
  cargo,
  departamento,
  ativo,
  tipo_contrato,
  controla_ponto,
  rh_ativo,
  rh_cadastrado,
  pista_ativo_legado,
  origem_sistema,
  origem_id,
  importado_em
)
SELECT
  coalesce(nullif(btrim(pm.nome_snapshot), ''), btrim(pm.nome)),
  nullif(btrim(pm.funcao), ''),
  'Produção',
  pm.ativo,
  null,
  false,
  false,
  false,
  pm.ativo,
  'producao',
  pm.id,
  now()
FROM public.producao_membros pm
WHERE pm.rh_colaborador_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.rh_colaboradores rc
    WHERE rc.origem_sistema = 'producao' AND rc.origem_id = pm.id
  );

UPDATE public.producao_membros pm
SET rh_colaborador_id = rc.id,
    updated_at = now()
FROM public.rh_colaboradores rc
WHERE pm.rh_colaborador_id IS NULL
  AND rc.origem_sistema = 'producao'
  AND rc.origem_id = pm.id;

-- Registra a criação dos vínculos de pista para rastreabilidade.
INSERT INTO public.rh_contextos_auditoria (
  colaborador_id,
  ativo_anterior, ativo_novo,
  administrativo_anterior, administrativo_novo,
  pista_anterior, pista_novo,
  ponto_anterior, ponto_novo,
  origem, alterado_por
)
SELECT
  rc.id,
  false, rc.ativo,
  false, rc.rh_ativo,
  false, rc.pista_ativo_legado,
  false, rc.controla_ponto,
  'integracao_inicial_producao_rh', null
FROM public.rh_colaboradores rc
WHERE rc.origem_sistema = 'producao'
  AND rc.importado_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.rh_contextos_auditoria a
    WHERE a.colaborador_id = rc.id AND a.origem = 'integracao_inicial_producao_rh'
  );

CREATE OR REPLACE FUNCTION public.sincronizar_membro_producao_com_rh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rh_id uuid;
  v_anterior public.rh_colaboradores%ROWTYPE;
  v_nome text := coalesce(nullif(btrim(NEW.nome_snapshot), ''), nullif(btrim(NEW.nome), ''));
BEGIN
  IF v_nome IS NULL THEN
    RETURN NEW;
  END IF;

  v_rh_id := NEW.rh_colaborador_id;

  IF v_rh_id IS NULL THEN
    SELECT rc.id INTO v_rh_id
    FROM public.rh_colaboradores rc
    WHERE regexp_replace(
            lower(translate(rc.nome, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')),
            '[^a-z0-9]+', '', 'g'
          ) = regexp_replace(
            lower(translate(v_nome, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')),
            '[^a-z0-9]+', '', 'g'
          )
    ORDER BY rc.created_at
    LIMIT 1;
  END IF;

  IF v_rh_id IS NULL THEN
    INSERT INTO public.rh_colaboradores (
      nome, cargo, departamento, ativo, tipo_contrato,
      controla_ponto, rh_ativo, rh_cadastrado, pista_ativo_legado,
      origem_sistema, origem_id, importado_em
    ) VALUES (
      v_nome, nullif(btrim(NEW.funcao), ''), 'Produção', NEW.ativo, null,
      false, false, false, NEW.ativo,
      'producao', NEW.id, now()
    ) RETURNING id INTO v_rh_id;
  END IF;

  SELECT * INTO v_anterior
  FROM public.rh_colaboradores
  WHERE id = v_rh_id
  FOR UPDATE;

  UPDATE public.rh_colaboradores
  SET pista_ativo_legado = NEW.ativo,
      ativo = NEW.ativo OR rh_ativo OR controla_ponto,
      cargo = CASE
        WHEN origem_sistema = 'producao' AND rh_cadastrado = false
          THEN coalesce(nullif(btrim(NEW.funcao), ''), cargo)
        ELSE cargo
      END,
      updated_at = now()
  WHERE id = v_rh_id;

  IF v_anterior.pista_ativo_legado IS DISTINCT FROM NEW.ativo
     OR v_anterior.ativo IS DISTINCT FROM (NEW.ativo OR v_anterior.rh_ativo OR v_anterior.controla_ponto) THEN
    INSERT INTO public.rh_contextos_auditoria (
      colaborador_id,
      ativo_anterior, ativo_novo,
      administrativo_anterior, administrativo_novo,
      pista_anterior, pista_novo,
      ponto_anterior, ponto_novo,
      origem, alterado_por
    ) VALUES (
      v_rh_id,
      v_anterior.ativo, NEW.ativo OR v_anterior.rh_ativo OR v_anterior.controla_ponto,
      v_anterior.rh_ativo, v_anterior.rh_ativo,
      v_anterior.pista_ativo_legado, NEW.ativo,
      v_anterior.controla_ponto, v_anterior.controla_ponto,
      'sincronizacao_producao_rh', auth.uid()
    );
  END IF;

  IF NEW.rh_colaborador_id IS DISTINCT FROM v_rh_id THEN
    UPDATE public.producao_membros
    SET rh_colaborador_id = v_rh_id,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_membro_producao_com_rh() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sincronizar_membro_producao_com_rh ON public.producao_membros;
CREATE TRIGGER trg_sincronizar_membro_producao_com_rh
AFTER INSERT OR UPDATE OF nome, nome_snapshot, funcao, ativo, rh_colaborador_id
ON public.producao_membros
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_membro_producao_com_rh();

COMMIT;
