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

type AtualizacaoApontamento = Partial<
  Omit<NovoApontamentoProducao, 'membros_ids'>
>;

const idsUnicos = (ids: string[]) =>
  [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

const horarioEmSegundos = (horario: string) => {
  const correspondencia = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(horario);

  if (!correspondencia) {
    throw new Error('Horário inválido. Use o formato HH:mm ou HH:mm:ss.');
  }

  const [, horasTexto, minutosTexto, segundosTexto = '0'] = correspondencia;
  const horas = Number(horasTexto);
  const minutos = Number(minutosTexto);
  const segundos = Number(segundosTexto);

  if (horas > 23 || minutos > 59 || segundos > 59) {
    throw new Error('Horário inválido.');
  }

  return horas * 3600 + minutos * 60 + segundos;
};

export const calcularDuracaoProducao = (inicio: string, termino: string) => {
  const duracaoSegundos =
    horarioEmSegundos(termino) - horarioEmSegundos(inicio);

  if (duracaoSegundos <= 0) {
    throw new Error('O término deve ser pelo menos 1 minuto maior que o início.');
  }

  const duracaoMinutos = Math.ceil(duracaoSegundos / 60);
  if (duracaoMinutos < 1) {
    throw new Error('A duração mínima do apontamento é de 1 minuto.');
  }

  return duracaoMinutos;
};

const validarApontamento = (
  apontamento: Pick<
    NovoApontamentoProducao,
    'projeto_local_id' | 'tarefa_id' | 'inicio' | 'termino'
  >,
) => {
  if (!apontamento.projeto_local_id?.trim()) {
    throw new Error('O projeto/local é obrigatório.');
  }

  if (!apontamento.tarefa_id?.trim()) {
    throw new Error('A tarefa é obrigatória.');
  }

  return calcularDuracaoProducao(apontamento.inicio, apontamento.termino);
};

export const useProducao = () => {
  const [tarefas, setTarefas] = useState<ProducaoTarefa[]>([]);
  const [membrosProducao, setMembrosProducao] = useState<ProducaoMembro[]>([]);
  const [apontamentos, setApontamentos] = useState<ProducaoApontamento[]>([]);
  const [loading, setLoading] = useState(false);

  const listarTarefas = useCallback(async (somenteAtivas = true) => {
    setLoading(true);

    try {
      let consulta = supabase
        .from('producao_tarefas')
        .select('*')
        .order('nome', { ascending: true });

      if (somenteAtivas) {
        consulta = consulta.eq('ativo', true);
      }

      const { data, error } = await consulta;
      if (error) throw error;

      const resultado = (data ?? []) as ProducaoTarefa[];
      setTarefas(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarTarefa = useCallback(
    async (nome: string, categoria?: string | null) => {
      const nomeNormalizado = nome.trim();

      if (!nomeNormalizado) {
        throw new Error('O nome da tarefa é obrigatório.');
      }

      const { data, error } = await supabase
        .from('producao_tarefas')
        .insert({
          nome: nomeNormalizado,
          categoria: categoria?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const tarefa = data as ProducaoTarefa;
      setTarefas((atuais) =>
        [...atuais, tarefa].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      return tarefa;
    },
    [],
  );

  const listarMembrosProducao = useCallback(async (somenteAtivos = true) => {
    let consulta = supabase
      .from('producao_membros')
      .select('*')
      .order('nome', { ascending: true });

    if (somenteAtivos) {
      consulta = consulta.eq('ativo', true);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    const resultado = (data ?? []) as ProducaoMembro[];
    setMembrosProducao(resultado);
    return resultado;
  }, []);

  const criarMembroProducao = useCallback(
    async (nome: string, apelido?: string | null, funcao?: string | null) => {
      const nomeNormalizado = nome.trim();
      if (!nomeNormalizado) {
        throw new Error('O nome do membro é obrigatório.');
      }

      const { data, error } = await supabase
        .from('producao_membros')
        .insert({
          nome: nomeNormalizado,
          apelido: apelido?.trim() || null,
          funcao: funcao?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      const membro = data as ProducaoMembro;
      setMembrosProducao((atuais) =>
        [...atuais, membro].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      return membro;
    },
    [],
  );

  const editarMembroProducao = useCallback(
    async (id: string, dados: Partial<NovoMembroProducao>) => {
      const alteracoes: Partial<NovoMembroProducao> = {};

      if (dados.nome !== undefined) {
        const nomeNormalizado = dados.nome.trim();
        if (!nomeNormalizado) {
          throw new Error('O nome do membro é obrigatório.');
        }
        alteracoes.nome = nomeNormalizado;
      }
      if (dados.apelido !== undefined) {
        alteracoes.apelido = dados.apelido?.trim() || null;
      }
      if (dados.funcao !== undefined) {
        alteracoes.funcao = dados.funcao?.trim() || null;
      }

      const { data, error } = await supabase
        .from('producao_membros')
        .update(alteracoes)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const membro = data as ProducaoMembro;
      setMembrosProducao((atuais) =>
        atuais.map((atual) => (atual.id === id ? membro : atual)),
      );
      return membro;
    },
    [],
  );

  const inativarMembroProducao = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('producao_membros')
      .update({ ativo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setMembrosProducao((atuais) => atuais.filter((membro) => membro.id !== id));
    return data as ProducaoMembro;
  }, []);

  const listarApontamentos = useCallback(
    async (filtros: FiltrosProducao = {}) => {
      setLoading(true);

      try {
        let consulta = supabase
          .from('producao_apontamentos')
          .select('*')
          .order('data', { ascending: false })
          .order('inicio', { ascending: false });

        if (filtros.data_inicio) {
          consulta = consulta.gte('data', filtros.data_inicio);
        }
        if (filtros.data_fim) {
          consulta = consulta.lte('data', filtros.data_fim);
        }
        if (filtros.projeto_local_id) {
          consulta = consulta.eq(
            'projeto_local_id',
            filtros.projeto_local_id,
          );
        }
        if (filtros.tarefa_id) {
          consulta = consulta.eq('tarefa_id', filtros.tarefa_id);
        }
        if (filtros.status) {
          consulta = consulta.eq('status', filtros.status);
        }
        if (filtros.local_tipo) {
          consulta = consulta.eq('local_tipo', filtros.local_tipo);
        }

        const { data, error } = await consulta;
        if (error) throw error;

        const resultado = (data ?? []) as ProducaoApontamento[];
        setApontamentos(resultado);
        return resultado;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const obterMembrosValidos = useCallback(async (membrosIds: string[]) => {
    const membrosUnicos = idsUnicos(membrosIds);

    if (membrosUnicos.length === 0) {
      throw new Error('Informe pelo menos um membro da equipe.');
    }

    const { data, error } = await supabase
      .from('producao_membros')
      .select('id, nome')
      .in('id', membrosUnicos)
      .eq('ativo', true);

    if (error) throw error;

    if (!data || data.length !== membrosUnicos.length) {
      throw new Error('Um ou mais membros informados não existem.');
    }

    return data;
  }, []);

  const salvarMembrosInterno = useCallback(
    async (
      apontamentoId: string,
      membrosIds: string[],
      verificarStatus: boolean,
    ) => {
      const membros = await obterMembrosValidos(membrosIds);

      if (verificarStatus) {
        const { data: apontamento, error: apontamentoError } = await supabase
          .from('producao_apontamentos')
          .select('status')
          .eq('id', apontamentoId)
          .single();

        if (apontamentoError) throw apontamentoError;
        if (apontamento.status !== 'lancado') {
          throw new Error(
            'Somente apontamentos com status lançado podem ser editados.',
          );
        }
      }

      const { data: membrosAtuais, error: consultaMembrosError } =
        await supabase
          .from('producao_apontamento_membros')
          .select('membro_id')
          .eq('apontamento_id', apontamentoId);

      if (consultaMembrosError) throw consultaMembrosError;

      const idsDesejados = new Set(membros.map((membro) => membro.id));
      const idsAtuais = new Set(
        (membrosAtuais ?? []).map((membro) => membro.membro_id),
      );
      const membrosParaAdicionar = membros.filter(
        (membro) => !idsAtuais.has(membro.id),
      );
      const idsParaRemover = [...idsAtuais].filter(
        (membroId) => !idsDesejados.has(membroId),
      );

      if (membrosParaAdicionar.length > 0) {
        const { error: inclusaoError } = await supabase
          .from('producao_apontamento_membros')
          .insert(
            membrosParaAdicionar.map((membro) => ({
              apontamento_id: apontamentoId,
              membro_id: membro.id,
              nome_snapshot: membro.nome,
            })),
          );

        if (inclusaoError) throw inclusaoError;
      }

      if (idsParaRemover.length > 0) {
        const { error: exclusaoError } = await supabase
          .from('producao_apontamento_membros')
          .delete()
          .eq('apontamento_id', apontamentoId)
          .in('membro_id', idsParaRemover);

        if (exclusaoError) throw exclusaoError;
      }

      const { data, error } = await supabase
        .from('producao_apontamento_membros')
        .select('*')
        .eq('apontamento_id', apontamentoId)
        .order('nome_snapshot', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProducaoApontamentoMembro[];
    },
    [obterMembrosValidos],
  );

  const salvarMembros = useCallback(
    (apontamentoId: string, membrosIds: string[]) =>
      salvarMembrosInterno(apontamentoId, membrosIds, true),
    [salvarMembrosInterno],
  );

  const criarApontamento = useCallback(
    async (novo: NovoApontamentoProducao) => {
      const duracaoMinutos = validarApontamento(novo);
      await obterMembrosValidos(novo.membros_ids);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('producao_apontamentos')
        .insert({
          data: novo.data,
          projeto_local_id: novo.projeto_local_id,
          tarefa_id: novo.tarefa_id,
          local_tipo: novo.local_tipo,
          quantidade_produzida: novo.quantidade_produzida ?? null,
          inicio: novo.inicio,
          termino: novo.termino,
          duracao_minutos: duracaoMinutos,
          observacoes: novo.observacoes?.trim() || null,
          criado_por_id: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      try {
        await salvarMembrosInterno(data.id, novo.membros_ids, false);
      } catch (membrosError) {
        await supabase
          .from('producao_apontamentos')
          .delete()
          .eq('id', data.id);
        throw membrosError;
      }

      const apontamento = data as ProducaoApontamento;
      setApontamentos((atuais) => [apontamento, ...atuais]);
      return apontamento;
    },
    [obterMembrosValidos, salvarMembrosInterno],
  );

  const editarApontamento = useCallback(
    async (
      apontamentoId: string,
      alteracoes: AtualizacaoApontamento,
      membrosIds?: string[],
    ) => {
      const { data: atual, error: consultaError } = await supabase
        .from('producao_apontamentos')
        .select('*')
        .eq('id', apontamentoId)
        .single();

      if (consultaError) throw consultaError;
      if (atual.status !== 'lancado') {
        throw new Error(
          'Somente apontamentos com status lançado podem ser editados.',
        );
      }

      if (membrosIds) {
        await obterMembrosValidos(membrosIds);
      }

      const inicio = alteracoes.inicio ?? atual.inicio;
      const termino = alteracoes.termino ?? atual.termino;
      const projetoLocalId =
        alteracoes.projeto_local_id ?? atual.projeto_local_id;
      const tarefaId = alteracoes.tarefa_id ?? atual.tarefa_id;
      const duracaoMinutos = validarApontamento({
        projeto_local_id: projetoLocalId,
        tarefa_id: tarefaId,
        inicio,
        termino,
      });

      const { data, error } = await supabase
        .from('producao_apontamentos')
        .update({
          ...alteracoes,
          inicio,
          termino,
          duracao_minutos: duracaoMinutos,
          observacoes:
            alteracoes.observacoes === undefined
              ? atual.observacoes
              : alteracoes.observacoes?.trim() || null,
        })
        .eq('id', apontamentoId)
        .eq('status', 'lancado')
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('O apontamento não está mais disponível para edição.');
      }

      if (membrosIds) {
        await salvarMembrosInterno(apontamentoId, membrosIds, true);
      }

      const apontamento = data as ProducaoApontamento;
      setApontamentos((atuais) =>
        atuais.map((item) => (item.id === apontamentoId ? apontamento : item)),
      );
      return apontamento;
    },
    [obterMembrosValidos, salvarMembrosInterno],
  );

  const cancelarApontamento = useCallback(async (apontamentoId: string) => {
    const { data, error } = await supabase
      .from('producao_apontamentos')
      .update({ status: 'cancelado' })
      .eq('id', apontamentoId)
      .eq('status', 'lancado')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('Somente apontamentos lançados podem ser cancelados.');
    }

    const apontamento = data as ProducaoApontamento;
    setApontamentos((atuais) =>
      atuais.map((item) => (item.id === apontamentoId ? apontamento : item)),
    );
    return apontamento;
  }, []);

  const conferirApontamento = useCallback(async (apontamentoId: string) => {
    const {
      data: { user },
      error: usuarioError,
    } = await supabase.auth.getUser();

    if (usuarioError) throw usuarioError;
    if (!user) throw new Error('É necessário estar autenticado para conferir.');

    const { data, error } = await supabase
      .from('producao_apontamentos')
      .update({
        status: 'conferido',
        conferido_por_id: user.id,
        conferido_em: new Date().toISOString(),
      })
      .eq('id', apontamentoId)
      .eq('status', 'lancado')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('Somente apontamentos lançados podem ser conferidos.');
    }

    const apontamento = data as ProducaoApontamento;
    setApontamentos((atuais) =>
      atuais.map((item) => (item.id === apontamentoId ? apontamento : item)),
    );
    return apontamento;
  }, []);

  const listarMembros = useCallback(async (apontamentoId: string) => {
    const { data, error } = await supabase
      .from('producao_apontamento_membros')
      .select('*')
      .eq('apontamento_id', apontamentoId)
      .order('nome_snapshot', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProducaoApontamentoMembro[];
  }, []);

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
