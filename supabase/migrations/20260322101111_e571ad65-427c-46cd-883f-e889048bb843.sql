begin;

create temporary table tmp_duplicate_solicitacoes as
with solicitacoes_assinadas as (
  select
    s.id,
    s.numero,
    s.created_at,
    s.solicitante_id,
    coalesce(s.estoque_id, '00000000-0000-0000-0000-000000000000'::uuid) as estoque_key,
    coalesce(s.local_utilizacao_id, '00000000-0000-0000-0000-000000000000'::uuid) as local_key,
    coalesce(s.tipo_operacao, '') as tipo_key,
    jsonb_agg(
      jsonb_build_object(
        'item_id', si.item_id,
        'quantidade', si.quantidade_solicitada
      )
      order by si.item_id
    ) as itens_signature
  from public.solicitacoes s
  join public.solicitacao_itens si on si.solicitacao_id = s.id
  where s.created_at::date = current_date
    and coalesce(s.tipo_operacao, '') in ('retirada', 'saida_obra')
  group by s.id, s.numero, s.created_at, s.solicitante_id, s.estoque_id, s.local_utilizacao_id, s.tipo_operacao
), duplicadas as (
  select distinct newer.id, newer.numero
  from solicitacoes_assinadas older
  join solicitacoes_assinadas newer
    on older.solicitante_id = newer.solicitante_id
   and older.estoque_key = newer.estoque_key
   and older.local_key = newer.local_key
   and older.tipo_key = newer.tipo_key
   and older.itens_signature = newer.itens_signature
   and older.created_at < newer.created_at
   and extract(epoch from (newer.created_at - older.created_at)) <= 20
)
select * from duplicadas;

delete from public.movements
where solicitacao_id in (select id from tmp_duplicate_solicitacoes);

delete from public.solicitacao_itens
where solicitacao_id in (select id from tmp_duplicate_solicitacoes);

delete from public.solicitacoes
where id in (select id from tmp_duplicate_solicitacoes);

commit;