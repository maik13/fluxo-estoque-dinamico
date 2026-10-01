create or replace function public.consultar_ferramenta_producao_v1(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_item public.items%rowtype; v_movimentos jsonb; v_retiradas jsonb;
begin
 if auth.uid() is null or not public.usuario_tem_permissao_producao('visualizar') then
   raise exception 'Sem permissão para consultar ferramentas na Produção' using errcode='42501';
 end if;
 if p_codigo is null or btrim(p_codigo) !~ '^[0-9]{1,18}$' then
   raise exception 'Digite um código de barras numérico válido';
 end if;
 select * into v_item from public.items where codigo_barras=btrim(p_codigo)::bigint;
 if not found then return jsonb_build_object('item',null,'movimentacoes','[]'::jsonb,'retiradas','[]'::jsonb); end if;
 if lower(coalesce(v_item.tipo_item,'')) not in ('ferramenta','ferramentas') and not exists (
   select 1 from public.categorias c where c.id=v_item.categoria_id and lower(c.nome) in ('ferramenta','ferramentas')
 ) then raise exception 'O código informado não está classificado como ferramenta'; end if;
 with eventos as (
 select m.id,m.tipo,m.quantidade,m.data_hora,m.observacoes,m.solicitacao_id,
   s.numero,s.tipo_operacao,s.solicitacao_origem_id,
   coalesce(nullif(s.solicitante_nome,''),nullif(m.item_snapshot->>'solicitanteNome','')) as solicitante,
   coalesce(nullif(s.responsavel_estoque,''),pr.nome) as registrado_por,
   coalesce(pp.nome,nullif(s.local_utilizacao,''),l.nome) as projeto_destino,
   l.nome as destino,ep.nome as etapa,op.numero as op_numero,
   coalesce(nullif(op.produto_entregavel,''),nullif(ep.produto_entregavel,'')) as peca,
   e.nome as estoque
 from public.movements m
 left join public.solicitacoes s on s.id=m.solicitacao_id
 left join public.locais_utilizacao l on l.id=coalesce(m.local_utilizacao_id,s.local_utilizacao_id)
 left join public.estoques e on e.id=m.estoque_id
 left join public.profiles pr on pr.user_id=m.user_id
 left join lateral (
   select sm.* from public.solicitacoes_material sm
   where sm.solicitacao_retirada_id=s.id or sm.id=s.solicitacao_origem_id
   order by sm.created_at desc limit 1
 ) sm on true
 left join public.producao_projetos pp on pp.id=sm.producao_projeto_id
 left join public.producao_processos ep on ep.id=sm.processo_id
 left join public.producao_ordens_producao op on op.id=sm.ordem_producao_id
 where m.item_id=v_item.id
 )
 select coalesce(jsonb_agg(to_jsonb(ev) order by ev.data_hora desc,ev.id desc),'[]'::jsonb)
 into v_movimentos from eventos ev;
 with retiradas as (
 select m.id,m.solicitacao_id,m.data_hora,m.quantidade,m.estoque_id,m.local_utilizacao_id,
   coalesce((select sum(d.quantidade) from public.movements d
     join public.solicitacoes sd on sd.id=d.solicitacao_id
     where d.item_id=m.item_id and d.tipo='ENTRADA' and sd.tipo_operacao='devolucao'
       and sd.solicitacao_origem_id=m.solicitacao_id),0) as devolvida,
   exists (select 1 from public.movements d
     left join public.solicitacoes sd on sd.id=d.solicitacao_id
     where d.item_id=m.item_id and d.tipo='ENTRADA' and d.data_hora>=m.data_hora
       and d.estoque_id is not distinct from m.estoque_id
       and (sd.tipo_operacao='devolucao' or d.observacoes ilike 'Devolução%')
       and sd.solicitacao_origem_id is null) as devolucao_sem_vinculo
 from public.movements m left join public.solicitacoes s on s.id=m.solicitacao_id
 where m.item_id=v_item.id and m.tipo='SAIDA'
   and (s.tipo_operacao='retirada' or (s.id is null and m.observacoes ilike 'Retirada%'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'movement_id',r.id,'devolvida',r.devolvida,'pendente',greatest(0,r.quantidade-r.devolvida),
   'situacao',case when r.devolvida>=r.quantidade then 'devolvida'
     when r.devolucao_sem_vinculo or r.solicitacao_id is null then 'nao_confirmada'
     when r.devolvida>0 then 'parcial' else 'pendente' end
 ) order by r.data_hora desc,r.id desc),'[]'::jsonb) into v_retiradas from retiradas r;
 return jsonb_build_object('item',jsonb_build_object(
   'id',v_item.id,'codigo',v_item.codigo_barras::text,'nome',v_item.nome,
   'foto',v_item.foto_url,'unidade',v_item.unidade,'ativo',v_item.ativo),
   'movimentacoes',v_movimentos,'retiradas',v_retiradas);
end $$;
revoke all on function public.consultar_ferramenta_producao_v1(text) from public,anon;
grant execute on function public.consultar_ferramenta_producao_v1(text) to authenticated,service_role;