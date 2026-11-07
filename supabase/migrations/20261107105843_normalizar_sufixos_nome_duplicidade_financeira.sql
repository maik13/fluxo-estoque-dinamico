CREATE OR REPLACE FUNCTION public.financeiro_normalizar_nome_duplicidade(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(p_texto, ''),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
          )
        ),
        '[^a-z0-9]+',
        '',
        'g'
      ),
      '(ltda|eireli|mei|me|sa)$',
      '',
      'g'
    ),
    '(ltda|eireli|mei|me|sa)$',
    '',
    'g'
  );
$$;
