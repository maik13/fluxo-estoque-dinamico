import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  FiltrosProducao,
  NovoApontamentoProducao,
  NovoMembroProducao,
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

type AtualizacaoApontamento = Partial<Omit<NovoApontamentoProducao, 'membros_ids'>>;

const horarioEmSegundos = (horario: string) => {
  const correspondencia = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(horario);
  if (!correspondencia) throw new Error('Horário inválido.');
  const [, h, m, s = '0'] = correspondencia;
  const horas = Number(h);
  const minutos = Number(m);
  const segundos = Number(s);
  if (horas > 23 || minutos > 59 || segundos > 59) throw new Error('Horário inválido.');
  return horas * 3600 + minutos * 60 + segundos;
};

export const calcularDuracaoProducao = (inicio: string, termino: string) => {
  const segundos = horarioEmSegundos(termino) - horarioEmSegundos(inicio);
  if (segundos <= 0) throw new Error('O término deve ser maior que o início.');
  return Math.ceil(segundos / 60);
};

const normalizarTempos = (
  duracao: number,
  produtivos?: number | null,
  improdutivos?: number | null,
  motivo?: string | null,
) => {
  const minutosImprodutivos = Number(improdutivos ?? 0);
  const minutosProdutivos = produtivos ?? duracao - minutosImprodutivos;
  if (!Number.isInteger(minutosProdutivos) || !Number.isInteger(minutosImprodutivos)) {
    throw new Error('Os tempos devem ser minutos inteiros.');
  }
  if (minutosProdutivos < 0 || minutosImprodutivos < 0 || minutosProdutivos + minutosImprodutivos !== duracao) {
    throw new Error('A soma dos tempos deve ser igual à duração.');
  }
  if (minutosImprodutivos > 0 && !motivo?.trim()) {
    throw new Error('Informe o motivo do tempo improdutivo.');
  }
  return {
    minutos_produtivos: minutosProdutivos,
    minutos_improdutivos: minutosImprodutivos,
    motivo_improdutivo: minutosImprodutivos > 0 ? motivo!.trim() : null,
  };
};

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

export const useProducao = () => {
  const [tarefas, setTarefas] = useState<ProducaoTarefa[]>([]);
  const [membrosProducao, setMembrosProducao] = useState<ProducaoMembro[]>([]);
  const [apontamentos, setApontamentos] = useState<ProducaoApontamento[]>([]);
  const [loading, setLoading] = useState(false);

  const listarTarefas = useCallback(async (somenteAtivas = true) => {
    let consulta = supabase.from('producao_tarefas').select('*').order('nome');
    if (somenteAtivas) consulta = consulta.eq('ativo', true);
    const { data, error } = await consulta;
    if (error) throw erro(error, 'Não foi possível carregar as tarefas da Produção.');
    const resultado = (data ?? []) as ProducaoTarefa[];
    setTarefas(resultado);
    return resultado;
  }, []);

  const criarTarefa = useCallback(async (nome: string, categoria?: string | null) => {
    const { data: id, error } = await supabase.rpc('criar_tarefa_producao', {
      p_nome: nome,
      p_categoria: categoria ?? null,
    });
    if (error) throw erro(error, 'Não foi possível cadastrar a tarefa.');
    const { data, error: readError } = await supabase.from('producao_tarefas').select('*').eq('id', id).single();
    if (readError) throw erro(readError, 'A tarefa foi cadastrada, mas não pôde ser recarregada.');
    const tarefa = data as ProducaoTarefa;
    setTarefas((atuais) => [...atuais, tarefa].sort((a, b) => a.nome.localeCompare(b.nome)));
    return tarefa;
  }, []);

  const listarMembrosProducao = useCallback(async (somenteAtivos = true) => {
    let consulta = supabase.from('producao_membros').select('*').order('nome');
    if (somenteAtivos) consulta = consulta.eq('ativo', true);
    const { data, error } = await consulta;
    if (error) throw erro(error, 'Não foi possível carregar a equipe da Produção.');
    const resultado = (data ?? []) as unknown as ProducaoMembro[];
    setMembrosProducao(resultado);
    return resultado;
  }, []);

  const salvarMembro = useCallback(async (id: string | null, dados: NovoMembroProducao) => {
    const { data: membroId, error } = await (supabase.rpc as any)('salvar_membro_producao', {
      p_id: id,
      p_nome: dados.nome,
      p_apelido: dados.apelido ?? null,
      p_funcao: dados.funcao ?? null,
      p_valor_hora: dados.valor_hora ?? null,
      p_jornada_diaria_minutos: dados.jornada_diaria_minutos ?? null,
      p_ativo: dados.ativo ?? true,
    });
    if (error) throw erro(error, 'Não foi possível salvar o membro da equipe.');
    const { data, error: readError } = await supabase.from('producao_membros').select('*').eq('id', membroId).single();
    if (readError) throw erro(readError, 'O membro foi salvo, mas não pôde ser recarregado.');
    return data as unknown as ProducaoMembro;
  }, []);

  const criarMembroProducao = useCallback(async (
    nome: string,
    apelido?: string | null,
    funcao?: string | null,
    valorHora?: number | null,
    jornadaDiariaMinutos?: number | null,
  ) => {
    const membro = await salvarMembro(null, {
      nome,
      apelido,
      funcao,
      valor_hora: valorHora,
      jornada_diaria_minutos: jornadaDiariaMinutos,
    });
    setMembrosProducao((atuais) => [...atuais, membro].sort((a, b) => a.nome.localeCompare(b.nome)));
    return membro;
  }, [salvarMembro]);

  const editarMembroProducao = useCallback(async (id: string, dados: Partial<NovoMembroProducao>) => {
    const atual = membrosProducao.find((item) => item.id === id);
    if (!atual) throw new Error('Membro não encontrado.');
    const membro = await salvarMembro(id, {
      nome: dados.nome ?? atual.nome,
      apelido: dados.apelido === undefined ? atual.apelido : dados.apelido,
      funcao: dados.funcao === undefined ? atual.funcao : dados.funcao,
      valor_hora: dados.valor_hora === undefined ? atual.valor_hora : dados.valor_hora,
      jornada_diaria_minutos: dados.jornada_diaria_minutos === undefined
        ? atual.jornada_diaria_minutos
        : dados.jornada_diaria_minutos,
      ativo: dados.ativo ?? atual.ativo,
    });
    setMembrosProducao((atuais) => atuais.map((item) => item.id === id ? membro : item));
    return membro;
  }, [membrosProducao, salvarMembro]);

  const inativarMembroProducao = useCallback(async (id: string) => {
    const membro = await editarMembroProducao(id, { ativo: false });
    setMembrosProducao((atuais) => atuais.filter((item) => item.id !== id));
    return membro;
  }, [editarMembroProducao]);

  const listarApontamentos = useCallback(async (filtros: FiltrosProducao = {}) => {
    setLoading(true);
    try {
      let consulta = (supabase.from('producao_apontamentos') as any).select('*')
        .order('data', { ascending: false }).order('inicio', { ascending: false });
      if (filtros.data_inicio) consulta = consulta.gte('data', filtros.data_inicio);
      if (filtros.data_fim) consulta = consulta.lte('data', filtros.data_fim);
      if (filtros.projeto_local_id) consulta = consulta.eq('projeto_local_id', filtros.projeto_local_id);
      if (filtros.processo_id) consulta = consulta.eq('processo_id', filtros.processo_id);
      if (filtros.ordem_producao_id) consulta = consulta.eq('ordem_producao_id', filtros.ordem_producao_id);
      if (filtros.tarefa_id) consulta = consulta.eq('tarefa_id', filtros.tarefa_id);
      if (filtros.status) consulta = consulta.eq('status', filtros.status);
      if (filtros.local_tipo) consulta = consulta.eq('local_tipo', filtros.local_tipo);
      const { data, error } = await consulta;
      if (error) throw erro(error, 'Não foi possível carregar os apontamentos.');
      const resultado = (data ?? []) as ProducaoApontamento[];
      setApontamentos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const executarApontamentoRpc = useCallback(async (
    rpc: 'criar_apontamento_producao' | 'editar_apontamento_producao',
    novo: NovoApontamentoProducao,
    apontamentoId?: string,
  ) => {
    const planejado = Boolean(novo.ordem_producao_id);
    if (!planejado && (!novo.projeto_local_id || novo.processo_id)) {
      throw new Error('Selecione uma OP ou informe um projeto/local para o apontamento avulso.');
    }
    if (!novo.membros_ids.length) throw new Error('Informe pelo menos um membro.');

    const duracao = calcularDuracaoProducao(novo.inicio, novo.termino);
    const tempos = normalizarTempos(
      duracao,
      novo.minutos_produtivos,
      novo.minutos_improdutivos,
      novo.motivo_improdutivo,
    );

    const parametrosBase = {
      ...(apontamentoId ? { p_apontamento_id: apontamentoId } : {}),
      p_data: novo.data,
      p_processo_id: novo.processo_id ?? null,
      p_projeto_local_id: novo.projeto_local_id ?? null,
      p_tarefa_id: novo.tarefa_id,
      p_local_tipo: novo.local_tipo,
      p_quantidade_produzida: novo.quantidade_produzida ?? null,
      p_inicio: novo.inicio,
      p_termino: novo.termino,
      p_duracao_minutos: duracao,
      p_minutos_produtivos: tempos.minutos_produtivos,
      p_minutos_improdutivos: tempos.minutos_improdutivos,
      p_motivo_improdutivo: tempos.motivo_improdutivo,
      p_observacoes: novo.observacoes?.trim() || null,
      p_membros: [...new Set(novo.membros_ids)],
    };

    const parametros = rpc === 'criar_apontamento_producao'
      ? { ...parametrosBase, p_ordem_producao_id: novo.ordem_producao_id ?? null }
      : parametrosBase;

    const { data, error } = await (supabase.rpc as any)(rpc, parametros);
    if (error) throw erro(
      error,
      rpc === 'criar_apontamento_producao'
        ? 'Não foi possível salvar o apontamento.'
        : 'Não foi possível editar o apontamento.',
    );
    return (data as string | null) ?? apontamentoId!;
  }, []);

  const recarregarApontamento = useCallback(async (id: string, fallback: string) => {
    const { data, error } = await (supabase.from('producao_apontamentos') as any).select('*').eq('id', id).single();
    if (error) throw erro(error, fallback);
    return data as ProducaoApontamento;
  }, []);

  const criarApontamento = useCallback(async (novo: NovoApontamentoProducao) => {
    const id = await executarApontamentoRpc('criar_apontamento_producao', novo);
    const apontamento = await recarregarApontamento(id, 'O apontamento foi salvo, mas não pôde ser recarregado.');
    setApontamentos((atuais) => [apontamento, ...atuais]);
    return apontamento;
  }, [executarApontamentoRpc, recarregarApontamento]);

  const listarMembros = useCallback(async (apontamentoId: string) => {
    const { data, error } = await supabase.from('producao_apontamento_membros')
      .select('*').eq('apontamento_id', apontamentoId).order('nome_snapshot');
    if (error) throw erro(error, 'Não foi possível carregar a equipe do apontamento.');
    return (data ?? []) as unknown as ProducaoApontamentoMembro[];
  }, []);

  const editarApontamento = useCallback(async (
    id: string,
    alteracoes: AtualizacaoApontamento,
    membrosIds?: string[],
  ) => {
    const atual = apontamentos.find((item) => item.id === id);
    if (!atual) throw new Error('Apontamento não encontrado.');
    const membrosAtuais = membrosIds ?? (await listarMembros(id)).map((item) => item.membro_id);
    const novo: NovoApontamentoProducao = {
      data: alteracoes.data ?? atual.data,
      ordem_producao_id: atual.ordem_producao_id,
      processo_id: alteracoes.processo_id === undefined ? atual.processo_id : alteracoes.processo_id,
      projeto_local_id: alteracoes.projeto_local_id === undefined ? atual.projeto_local_id : alteracoes.projeto_local_id,
      tarefa_id: alteracoes.tarefa_id ?? atual.tarefa_id,
      local_tipo: alteracoes.local_tipo ?? atual.local_tipo,
      quantidade_produzida: alteracoes.quantidade_produzida === undefined ? atual.quantidade_produzida : alteracoes.quantidade_produzida,
      inicio: alteracoes.inicio ?? atual.inicio,
      termino: alteracoes.termino ?? atual.termino,
      minutos_produtivos: alteracoes.minutos_produtivos ?? atual.minutos_produtivos,
      minutos_improdutivos: alteracoes.minutos_improdutivos ?? atual.minutos_improdutivos,
      motivo_improdutivo: alteracoes.motivo_improdutivo === undefined ? atual.motivo_improdutivo : alteracoes.motivo_improdutivo,
      observacoes: alteracoes.observacoes === undefined ? atual.observacoes : alteracoes.observacoes,
      membros_ids: membrosAtuais,
    };
    await executarApontamentoRpc('editar_apontamento_producao', novo, id);
    const apontamento = await recarregarApontamento(id, 'O apontamento foi editado, mas não pôde ser recarregado.');
    setApontamentos((atuais) => atuais.map((item) => item.id === id ? apontamento : item));
    return apontamento;
  }, [apontamentos, executarApontamentoRpc, listarMembros, recarregarApontamento]);

  const cancelarApontamento = useCallback(async (id: string, justificativa = 'Cancelado pelo usuário') => {
    const { error } = await supabase.rpc('cancelar_apontamento_producao', { p_apontamento_id: id, p_justificativa: justificativa });
    if (error) throw erro(error, 'Não foi possível cancelar o apontamento.');
    const apontamento = await recarregarApontamento(id, 'O apontamento foi cancelado, mas não pôde ser recarregado.');
    setApontamentos((atuais) => atuais.map((item) => item.id === id ? apontamento : item));
    return apontamento;
  }, [recarregarApontamento]);

  const conferirApontamento = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('conferir_apontamento_producao', { p_apontamento_id: id });
    if (error) throw erro(error, 'Não foi possível conferir o apontamento.');
    const apontamento = await recarregarApontamento(id, 'O apontamento foi conferido, mas não pôde ser recarregado.');
    setApontamentos((atuais) => atuais.map((item) => item.id === id ? apontamento : item));
    return apontamento;
  }, [recarregarApontamento]);

  const salvarMembros = useCallback(async (apontamentoId: string, membrosIds: string[]) => {
    const atual = apontamentos.find((item) => item.id === apontamentoId);
    if (!atual) throw new Error('Apontamento não encontrado.');
    await editarApontamento(apontamentoId, {}, membrosIds);
    return listarMembros(apontamentoId);
  }, [apontamentos, editarApontamento, listarMembros]);

  return {
    tarefas,
    membrosProducao,
    apontamentos,
    loading,
    listarTarefas,
    criarTarefa,
    listarMembrosProducao,
    criarMembroProducao,
    editarMembroProducao,
    inativarMembroProducao,
    listarApontamentos,
    criarApontamento,
    editarApontamento,
    cancelarApontamento,
    conferirApontamento,
    listarMembros,
    salvarMembros,
  };
};
