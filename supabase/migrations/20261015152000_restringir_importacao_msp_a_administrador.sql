-- A importação do MS Project é uma ação administrativa: o frontend a oculta
-- para os demais perfis e o banco impede a chamada direta fora de um admin.
DO $migracao$
DECLARE
  v_definicao text;
BEGIN
  SELECT pg_get_functiondef('public.importar_ops_reais_msproject_natal_v24(jsonb)'::regprocedure)
  INTO v_definicao;

  IF position($trecho$NOT public.usuario_tem_permissao_producao('processos')$trecho$ IN v_definicao) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a autorização atual da importação MSP v24';
  END IF;

  v_definicao := replace(
    v_definicao,
    $trecho$NOT public.usuario_tem_permissao_producao('processos')$trecho$,
    $trecho$NOT public.is_admin()$trecho$
  );
  v_definicao := replace(
    v_definicao,
    $trecho$Permissão de Produção necessária para importar OPs do MS Project$trecho$,
    $trecho$Somente administradores podem importar OPs do MS Project$trecho$
  );

  EXECUTE v_definicao;
END;
$migracao$;

REVOKE ALL ON FUNCTION public.importar_ops_reais_msproject_natal_v24(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_ops_reais_msproject_natal_v24(jsonb) TO authenticated;
