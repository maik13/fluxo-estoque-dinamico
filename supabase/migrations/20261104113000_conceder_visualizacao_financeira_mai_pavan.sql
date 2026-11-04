-- Concede exclusivamente visualização do fluxo PN → RC → PC à usuária indicada.
-- Não concede criação, edição, aprovação, programação, conciliação ou compra.

DO $$
DECLARE
  v_user_id uuid;
  v_estado_anterior text;
BEGIN
  SELECT user_id
    INTO v_user_id
  FROM public.profiles
  WHERE lower(trim(email)) = lower('mayarapavan.arqeurb@gmail.com')
    AND ativo IS TRUE;

  IF NOT FOUND THEN
    RAISE NOTICE 'Perfil ativo não encontrado para mayarapavan.arqeurb@gmail.com; nenhuma permissão foi concedida.';
    RETURN;
  END IF;

  SELECT efeito
    INTO v_estado_anterior
  FROM public.usuario_permissoes_individuais
  WHERE user_id = v_user_id
    AND permissao = 'pode_acessar_financeiro';

  INSERT INTO public.usuario_permissoes_individuais (
    user_id,
    permissao,
    efeito,
    criado_por,
    atualizado_por
  ) VALUES (
    v_user_id,
    'pode_acessar_financeiro',
    'permitir',
    NULL,
    NULL
  )
  ON CONFLICT (user_id, permissao) DO UPDATE
    SET efeito = 'permitir',
        atualizado_por = NULL,
        updated_at = now();

  IF v_estado_anterior IS DISTINCT FROM 'permitir' THEN
    INSERT INTO public.usuario_permissoes_individuais_auditoria (
      user_id,
      permissao,
      estado_anterior,
      estado_novo,
      alterado_por,
      alterado_por_nome
    ) VALUES (
      v_user_id,
      'pode_acessar_financeiro',
      coalesce(v_estado_anterior, 'herdar'),
      'permitir',
      NULL,
      'Migração: visualização financeira PN, RC e PC'
    );
  END IF;
END;
$$;
