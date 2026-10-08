import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Item, Movimentacao, EstoqueItem } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { useConfiguracoes } from './useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { verificarFerramentaAlocada } from '@/utils/verificarPendencias';
import { itemEhFerramentaUnitaria } from '@/utils/itemClassification';
import { carregarSaldosCompletos } from '@/services/estoque/carregarSaldosCompletos';

export const useEstoque = () => {
  const [itens, setItens] = useState<Item[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [saldosEstoque, setSaldosEstoque] = useState<Map<string, number>>(new Map());
  const [ultimasMovimentacoesEstoque, setUltimasMovimentacoesEstoque] = useState<Map<string, Movimentacao>>(new Map());
  const [loading, setLoading] = useState(true);
  const { estoqueAtivo, obterEstoqueAtivoInfo, isEstoqueAtivoPrincipal, categorias } = useConfiguracoes();
  const { user } = useAuth();
  
  // Refs para controle de carregamento e prevenção de duplicatas
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const processedItemsRef = useRef<Set<string>>(new Set());
  const processedMovementsRef = useRef<Set<string>>(new Set());
  const historicoLoadingRef = useRef(false);
  const historicoCarregadoRef = useRef(false);
  const historicoChaveRef = useRef<string>('');

  const verificarEntradaRecenteSimilar = async (
    itemId: string,
    quantidade: number,
    estoqueId?: string | null
  ) => {
    const limiteRecente = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = supabase
      .from('movements')
      .select('id, data_hora')
      .eq('item_id', itemId)
      .eq('tipo', 'ENTRADA')
      .eq('quantidade', quantidade)
      .eq('user_id', user?.id ?? '')
      .gte('data_hora', limiteRecente)
      .order('data_hora', { ascending: false })
      .limit(1);

    query = estoqueId ? query.eq('estoque_id', estoqueId) : query.is('estoque_id', null);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao verificar entrada recente similar:', error);
      return false;
    }

    return Boolean(data?.length);
  };

  // Obter dados iniciais quando o estoque ativo mudar
  useEffect(() => {
    historicoCarregadoRef.current = false;
    historicoLoadingRef.current = false;
    historicoChaveRef.current = '';
    setMovimentacoes([]);
    if (estoqueAtivo) {
      carregarDados();
    } else {
      // Se não há estoque ativo, limpar os dados
      setItens([]);
      setMovimentacoes([]);
      setSaldosEstoque(new Map());
      setUltimasMovimentacoesEstoque(new Map());
      setLoading(false);
    }
  }, [estoqueAtivo]);

  // Real-time updates para itens e movimentações
  useEffect(() => {
    // Canal para mudanças nos itens
    const itemsChannel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          const novoItem: Item = {
            id: payload.new.id,
            codigoBarras: Number(payload.new.codigo_barras),
            codigoAntigo: payload.new.codigo_antigo ?? undefined,
            origem: payload.new.origem ?? '',
            caixaOrganizador: payload.new.caixa_organizador ?? '',
            localizacao: payload.new.localizacao ?? '',
            nome: payload.new.nome,
            tipoItem: (payload.new.tipo_item ?? 'Insumo') as 'Insumo' | 'Ferramenta',
            especificacao: payload.new.especificacao ?? '',
            especificacoesDimensoes: payload.new.especificacoes_dimensoes ?? '',
            marca: payload.new.marca ?? '',
            unidade: payload.new.unidade,
            condicao: payload.new.condicao ?? 'Novo',
            subcategoriaId: payload.new.subcategoria_id ?? undefined,
            categoriaId: payload.new.categoria_id ?? undefined,
            quantidadeMinima: payload.new.quantidade_minima ?? undefined,
            ncm: payload.new.ncm ?? '',
            valor: payload.new.valor ?? undefined,
            imobilizado: payload.new.imobilizado ?? false,
            fotoUrl: payload.new.foto_url ?? undefined,
            ativo: payload.new.ativo ?? true,
          };
          setItens(prev => {
            // Evitar duplicatas
            if (prev.some(i => i.id === novoItem.id)) return prev;
            return [...prev, novoItem];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          const itemAtualizado: Item = {
            id: payload.new.id,
            codigoBarras: Number(payload.new.codigo_barras),
            codigoAntigo: payload.new.codigo_antigo ?? undefined,
            origem: payload.new.origem ?? '',
            caixaOrganizador: payload.new.caixa_organizador ?? '',
            localizacao: payload.new.localizacao ?? '',
            nome: payload.new.nome,
            tipoItem: (payload.new.tipo_item ?? 'Insumo') as 'Insumo' | 'Ferramenta',
            especificacao: payload.new.especificacao ?? '',
            especificacoesDimensoes: payload.new.especificacoes_dimensoes ?? '',
            marca: payload.new.marca ?? '',
            unidade: payload.new.unidade,
            condicao: payload.new.condicao ?? 'Novo',
            subcategoriaId: payload.new.subcategoria_id ?? undefined,
            categoriaId: payload.new.categoria_id ?? undefined,
            quantidadeMinima: payload.new.quantidade_minima ?? undefined,
            ncm: payload.new.ncm ?? '',
            valor: payload.new.valor ?? undefined,
            imobilizado: payload.new.imobilizado ?? false,
            fotoUrl: payload.new.foto_url ?? undefined,
            ativo: payload.new.ativo ?? true,
          };
          setItens(prev => prev.map(i => i.id === itemAtualizado.id ? itemAtualizado : i));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'items'
        },
        (payload) => {
          setItens(prev => prev.filter(i => i.id !== payload.old.id));
        }
      )
      .subscribe();

    // Canal para mudanças nas movimentações
    const movementsChannel = supabase
      .channel('movements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'movements'
        },
        async (payload) => {
          const estoqueAtivoInfo = obterEstoqueAtivoInfo();
            // Só adicionar se for do estoque ativo; movimentações sem estoque_id contam apenas no principal
          const incluirSemEstoque = isEstoqueAtivoPrincipal();
          if (!estoqueAtivoInfo?.id || payload.new.estoque_id === estoqueAtivoInfo.id || (incluirSemEstoque && payload.new.estoque_id === null)) {
            // Buscar nome do local se houver local_utilizacao_id
            let localNome: string | undefined;
            let solicitanteNome: string | undefined;
            let solicitacaoTipoOperacao: string | undefined;
            let tipoOperacaoNome: string | undefined;
            if (payload.new.local_utilizacao_id) {
              const { data } = await supabase
                .from('locais_utilizacao')
                .select('nome')
                .eq('id', payload.new.local_utilizacao_id)
                .single();
              localNome = data?.nome;
            }
            if (payload.new.solicitacao_id) {
              const { data } = await supabase
                .from('solicitacoes')
                .select('solicitante_nome, tipo_operacao')
                .eq('id', payload.new.solicitacao_id)
                .single();
              solicitanteNome = data?.solicitante_nome;
              solicitacaoTipoOperacao = data?.tipo_operacao;
            }
            if (payload.new.tipo_operacao_id) {
              const { data } = await supabase
                .from('tipos_operacao')
                .select('nome')
                .eq('id', payload.new.tipo_operacao_id)
                .single();
              tipoOperacaoNome = data?.nome;
            }

            const novaMovimentacao: Movimentacao = {
              id: payload.new.id,
              itemId: payload.new.item_id,
              tipo: payload.new.tipo,
              quantidade: Number(payload.new.quantidade),
              quantidadeAnterior: Number(payload.new.quantidade_anterior),
              quantidadeAtual: Number(payload.new.quantidade_atual),
              userId: payload.new.user_id ?? undefined,
              observacoes: payload.new.observacoes ?? undefined,
              dataHora: payload.new.data_hora,
              localUtilizacaoId: payload.new.local_utilizacao_id ?? undefined,
              localUtilizacaoNome: localNome,
              solicitacaoId: payload.new.solicitacao_id ?? undefined,
              solicitanteNome: solicitanteNome,
              solicitacaoTipoOperacao: solicitacaoTipoOperacao,
              destinatario: payload.new.destinatario ?? undefined,
              estoqueId: payload.new.estoque_id ?? undefined,
              tipoOperacaoId: payload.new.tipo_operacao_id ?? undefined,
              tipoOperacaoNome,
              itemSnapshot: payload.new.item_snapshot as Partial<Item>,
            };
            setMovimentacoes(prev => {
              // Evitar duplicatas
              if (prev.some(m => m.id === novaMovimentacao.id)) return prev;
              return [...prev, novaMovimentacao];
            });
            setSaldosEstoque((prev) => {
              const proximo = new Map(prev);
              proximo.set(
                payload.new.item_id,
                Number(payload.new.quantidade_atual ?? 0),
              );
              return proximo;
            });
            setUltimasMovimentacoesEstoque((prev) => {
              const proximo = new Map(prev);
              proximo.set(payload.new.item_id, novaMovimentacao);
              return proximo;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movements'
        },
        async (payload) => {
          const estoqueAtivoInfo = obterEstoqueAtivoInfo();
          const estoqueId = estoqueAtivoInfo?.id;
          
          // Verificar se a movimentação pertence ao estoque ativo; sem estoque_id conta apenas no principal
          const incluirSemEstoque = isEstoqueAtivoPrincipal();
          if (payload.new.estoque_id !== estoqueId && !(incluirSemEstoque && payload.new.estoque_id === null)) {
            return;
          }

          let localNome = '';
          let solicitanteNome: string | undefined;
          let solicitacaoTipoOperacao: string | undefined;
          let tipoOperacaoNome: string | undefined;
          if (payload.new.local_utilizacao_id) {
            const { data: localData } = await supabase
              .from('locais_utilizacao')
              .select('nome')
              .eq('id', payload.new.local_utilizacao_id)
              .single();
            if (localData) {
              localNome = localData.nome;
            }
          }
          if (payload.new.solicitacao_id) {
            const { data } = await supabase
              .from('solicitacoes')
              .select('solicitante_nome, tipo_operacao')
              .eq('id', payload.new.solicitacao_id)
              .single();
            solicitanteNome = data?.solicitante_nome;
            solicitacaoTipoOperacao = data?.tipo_operacao;
          }
          if (payload.new.tipo_operacao_id) {
            const { data } = await supabase
              .from('tipos_operacao')
              .select('nome')
              .eq('id', payload.new.tipo_operacao_id)
              .single();
            tipoOperacaoNome = data?.nome;
          }

          const movimentacaoAtualizada: Movimentacao = {
            id: payload.new.id,
            itemId: payload.new.item_id,
            tipo: payload.new.tipo,
            quantidade: Number(payload.new.quantidade),
            quantidadeAnterior: Number(payload.new.quantidade_anterior),
            quantidadeAtual: Number(payload.new.quantidade_atual),
            userId: payload.new.user_id ?? undefined,
            observacoes: payload.new.observacoes ?? undefined,
            dataHora: payload.new.data_hora,
            localUtilizacaoId: payload.new.local_utilizacao_id ?? undefined,
            localUtilizacaoNome: localNome,
            solicitacaoId: payload.new.solicitacao_id ?? undefined,
            solicitanteNome: solicitanteNome,
            solicitacaoTipoOperacao: solicitacaoTipoOperacao,
            destinatario: payload.new.destinatario ?? undefined,
            estoqueId: payload.new.estoque_id ?? undefined,
            tipoOperacaoId: payload.new.tipo_operacao_id ?? undefined,
            tipoOperacaoNome,
            itemSnapshot: payload.new.item_snapshot as Partial<Item>,
          };
          setMovimentacoes(prev => prev.map(m => m.id === movimentacaoAtualizada.id ? movimentacaoAtualizada : m));
          setSaldosEstoque((prev) => {
            const proximo = new Map(prev);
            proximo.set(
              payload.new.item_id,
              Number(payload.new.quantidade_atual ?? 0),
            );
            return proximo;
          });
          setUltimasMovimentacoesEstoque((prev) => {
            const proximo = new Map(prev);
            proximo.set(payload.new.item_id, movimentacaoAtualizada);
            return proximo;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'movements'
        },
        (payload) => {
          setMovimentacoes(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(movementsChannel);
    };
  }, [estoqueAtivo]);

  const mapearMovimentacao = (
    row: any,
    tipoOperacaoMap?: Map<string, string>,
  ): Movimentacao => ({
    id: row.id,
    itemId: row.item_id,
    tipo: row.tipo,
    quantidade: Number(row.quantidade),
    quantidadeAnterior: Number(row.quantidade_anterior),
    quantidadeAtual: Number(row.quantidade_atual),
    userId: row.user_id ?? undefined,
    observacoes: row.observacoes ?? undefined,
    dataHora: row.data_hora,
    localUtilizacaoId: row.local_utilizacao_id ?? undefined,
    localUtilizacaoNome: row.locais_utilizacao?.nome ?? undefined,
    solicitacaoId: row.solicitacao_id ?? undefined,
    solicitanteNome: row.solicitacoes?.solicitante_nome ?? undefined,
    solicitacaoTipoOperacao: row.solicitacoes?.tipo_operacao ?? undefined,
    destinatario: row.destinatario ?? undefined,
    estoqueId: row.estoque_id ?? undefined,
    tipoOperacaoId: row.tipo_operacao_id ?? undefined,
    tipoOperacaoNome:
      row.tipo_operacao_id && tipoOperacaoMap
        ? tipoOperacaoMap.get(row.tipo_operacao_id)
        : undefined,
    itemSnapshot: row.item_snapshot as Partial<Item>,
  });

  const carregarMovimentacoesRecentes = async (
    estoqueId?: string,
    incluirSemEstoque = false,
  ) => {
    try {
      const inicio = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const pageSize = 1000;
      let from = 0;
      let rows: any[] = [];

      while (true) {
        let query = supabase
          .from('movements')
          .select(`
            id,
            item_id,
            tipo,
            quantidade,
            quantidade_anterior,
            quantidade_atual,
            user_id,
            observacoes,
            data_hora,
            local_utilizacao_id,
            solicitacao_id,
            destinatario,
            estoque_id,
            tipo_operacao_id,
            item_snapshot,
            locais_utilizacao:local_utilizacao_id (nome)
          `)
          .gte('data_hora', inicio)
          .order('data_hora', { ascending: true })
          .range(from, from + pageSize - 1);

        if (estoqueId) {
          query = incluirSemEstoque
            ? query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`)
            : query.eq('estoque_id', estoqueId);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        rows = rows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const movimentacoesRecentes = rows.map((row) => mapearMovimentacao(row));

      // Se uma tela analítica já carregou o histórico completo, nunca reduzir
      // novamente o estado global para a janela de 7 dias. Isso fazia a aba
      // Gestão > Projetos parecer perder movimentos após um refresh/recarga.
      if (historicoCarregadoRef.current) {
        setMovimentacoes((atuais) => {
          const porId = new Map(atuais.map((mov) => [mov.id, mov]));
          movimentacoesRecentes.forEach((mov) => porId.set(mov.id, mov));
          return Array.from(porId.values()).sort(
            (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
          );
        });
      } else {
        setMovimentacoes(movimentacoesRecentes);
      }
    } catch (error) {
      console.error('Erro ao carregar movimentações recentes:', error);
    }
  };

  const carregarHistoricoCompleto = async (forcar = false) => {
    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    const estoqueId = estoqueAtivoInfo?.id;
    const incluirSemEstoque = isEstoqueAtivoPrincipal();
    const historicoChave = `${estoqueId ?? 'sem-estoque'}:${incluirSemEstoque ? 'legado' : 'estrito'}`;

    if (historicoChaveRef.current !== historicoChave) {
      historicoChaveRef.current = historicoChave;
      historicoCarregadoRef.current = false;
    }

    if ((!forcar && historicoCarregadoRef.current) || historicoLoadingRef.current) {
      return;
    }

    historicoLoadingRef.current = true;

    try {
      const pageSize = 1000;
      let movsQueryBase = supabase
        .from('movements')
        .select(`
          *,
          locais_utilizacao:local_utilizacao_id (nome),
          solicitacoes:solicitacao_id (solicitante_nome, tipo_operacao)
        `)
        .order('data_hora', { ascending: true });

      if (estoqueId) {
        movsQueryBase = incluirSemEstoque
          ? movsQueryBase.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`)
          : movsQueryBase.eq('estoque_id', estoqueId);
      }

      let movsData: any[] = [];
      let movFrom = 0;
      while (true) {
        const { data, error } = await movsQueryBase.range(movFrom, movFrom + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        movsData = movsData.concat(data);
        if (data.length < pageSize) break;
        movFrom += pageSize;
      }

      const { data: tiposOperacaoData, error: tiposOperacaoError } = await supabase
        .from('tipos_operacao')
        .select('id, nome');
      if (tiposOperacaoError) throw tiposOperacaoError;

      const tipoOperacaoMap = new Map(
        (tiposOperacaoData ?? []).map((op) => [op.id, op.nome]),
      );

      if (historicoChaveRef.current === historicoChave) {
        setMovimentacoes(
          movsData.map((row) => mapearMovimentacao(row, tipoOperacaoMap)),
        );
        historicoCarregadoRef.current = true;
      }
    } catch (error) {
      console.error('Erro ao carregar histórico completo de movimentações:', error);
    } finally {
      historicoLoadingRef.current = false;
    }
  };

  // Carrega catálogo e saldo atual sem baixar o histórico inteiro.
  // A Home recebe somente os últimos 7 dias; telas analíticas pedem o histórico completo sob demanda.
  const carregarDados = async (forcar = false) => {
    if (isLoadingRef.current) return;

    const now = Date.now();
    if (!forcar && now - lastLoadTimeRef.current < 500) return;

    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setLoading(true);
      const estoqueAtivoInfo = obterEstoqueAtivoInfo();
      const estoqueId = estoqueAtivoInfo?.id;
      const incluirSemEstoque = isEstoqueAtivoPrincipal();
      const pageSize = 1000;

      // 1) Catálogo completo de itens
      let from = 0;
      let itensData: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        itensData = itensData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const itensMapped: Item[] = itensData.map((row: any) => ({
        id: row.id,
        codigoBarras: Number(row.codigo_barras),
        codigoAntigo: row.codigo_antigo ?? undefined,
        origem: row.origem ?? '',
        caixaOrganizador: row.caixa_organizador ?? '',
        localizacao: row.localizacao ?? '',
        nome: row.nome,
        tipoItem: (row.tipo_item ?? 'Insumo') as Item['tipoItem'],
        especificacao: row.especificacao ?? '',
        especificacoesDimensoes: row.especificacoes_dimensoes ?? '',
        marca: row.marca ?? '',
        unidade: row.unidade,
        condicao: row.condicao ?? 'Novo',
        subcategoriaId: row.subcategoria_id ?? undefined,
        categoriaId: row.categoria_id ?? undefined,
        quantidadeMinima: row.quantidade_minima ?? undefined,
        ncm: row.ncm ?? '',
        valor: row.valor ?? undefined,
        imobilizado: row.imobilizado ?? false,
        fotoUrl: row.foto_url ?? undefined,
        ativo: row.ativo ?? true,
      }));

      // 2) Saldos e última movimentação calculados no servidor.
      // O catálogo só é publicado junto com uma posição de saldo confirmada;
      // ausência/falha de saldo nunca pode ser interpretada como estoque zero.
      const saldosData = await carregarSaldosCompletos<{
        item_id: string;
        saldo_atual: number | string | null;
        ultima_movimentacao: Movimentacao | null;
      }>((inicio, fim) =>
        (supabase as any)
          .rpc(
            'listar_saldos_estoque_v1',
            {
              p_estoque_id: estoqueId ?? null,
              p_incluir_sem_estoque: incluirSemEstoque,
            },
          )
          .order('item_id', { ascending: true })
          .range(inicio, fim),
      );

      const novoMapaSaldos = new Map<string, number>();
      const novoMapaUltimas = new Map<string, Movimentacao>();
      for (const row of (saldosData ?? [])) {
        novoMapaSaldos.set(row.item_id, Number(row.saldo_atual ?? 0));
        if (row.ultima_movimentacao) {
          novoMapaUltimas.set(row.item_id, row.ultima_movimentacao as Movimentacao);
        }
      }
      setItens(itensMapped);
      setSaldosEstoque(novoMapaSaldos);
      setUltimasMovimentacoesEstoque(novoMapaUltimas);

      // 3) Para a abertura da aplicação, somente os últimos 7 dias.
      // O histórico completo deixou de fazer parte do caminho crítico da Home.
      void carregarMovimentacoesRecentes(estoqueId, incluirSemEstoque);
    } catch (error: any) {
      console.error('Erro ao carregar catálogo/saldos do estoque:', error);
      toast({
        title: 'Erro ao carregar estoque',
        description:
          error?.message
            ? `Não foi possível confirmar os saldos do servidor: ${error.message}`
            : 'Não foi possível carregar o catálogo ou os saldos do servidor. A última posição válida foi preservada.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

// Removido: persistência em localStorage (agora usamos Supabase)

  // Função para gerar ID único
  const gerarId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Função para buscar item por código de barras
  const buscarItemPorCodigo = (codigoBarras: number): Item | undefined => {
    return itens.find(item => item.codigoBarras === codigoBarras);
  };

  const verificarCodigoExistente = (codigoBarras: number): boolean => {
    return itens.some(item => item.codigoBarras === codigoBarras);
  };

  const obterProximoCodigoDisponivel = async (): Promise<number> => {
    const codigosBloqueados = new Set([1001]);

    const encontrarProximoCodigo = (codigosExistentes: number[]) => {
      const codigosValidos = new Set(
        codigosExistentes
          .map((codigo) => Number(codigo))
          .filter((codigo) => Number.isInteger(codigo) && codigo > 0)
      );
      
      let proximo = 1;

      while (codigosValidos.has(proximo) || codigosBloqueados.has(proximo)) {
        proximo++;
      }

      return proximo;
    };

    const buscarTodosOsCodigos = async () => {
      const pageSize = 1000;
      let from = 0;
      const codigos: number[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('items')
          .select('codigo_barras')
          .order('codigo_barras', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          break;
        }

        codigos.push(...data.map((item) => Number(item.codigo_barras)));

        if (data.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      return codigos;
    };

    try {
      const codigosBanco = await buscarTodosOsCodigos();
      const codigosLocais = itens.map((item) => Number(item.codigoBarras));
      return encontrarProximoCodigo([...codigosBanco, ...codigosLocais]);
    } catch (error) {
      console.error('Erro ao obter próximo código:', error);
      return encontrarProximoCodigo(itens.map((item) => Number(item.codigoBarras)));
    }
  };

  const normalizarTexto = (texto?: string | null) =>
    (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const isEntradaParaAcerto = (mov: Pick<Movimentacao, 'tipo' | 'tipoOperacaoNome'>) =>
    mov.tipo === 'ENTRADA' && normalizarTexto(mov.tipoOperacaoNome).includes('acerto');

  const ultimasMovimentacoesDoHistorico = useMemo(() => {
    const mapa = new Map<string, Movimentacao>();

    for (const movimentacao of movimentacoes) {
      const atual = mapa.get(movimentacao.itemId);
      if (!atual) {
        mapa.set(movimentacao.itemId, movimentacao);
        continue;
      }

      const dataNova = new Date(movimentacao.dataHora).getTime();
      const dataAtual = new Date(atual.dataHora).getTime();

      if (
        dataNova > dataAtual ||
        (dataNova === dataAtual && movimentacao.id > atual.id)
      ) {
        mapa.set(movimentacao.itemId, movimentacao);
      }
    }

    return mapa;
  }, [movimentacoes]);

  const resolverPosicaoAtual = useCallback(
    (itemId: string) => {
      const ultimaServidor = ultimasMovimentacoesEstoque.get(itemId);
      const ultimaHistorico = ultimasMovimentacoesDoHistorico.get(itemId);

      // O saldo devolvido pelo servidor é a fonte canônica da posição atual.
      // O histórico local só é usado como fallback quando não há posição calculada no servidor.
      const ultima = ultimaServidor ?? ultimaHistorico ?? null;

      if (ultima) {
        return {
          saldo: Number(ultima.quantidadeAtual ?? 0),
          ultima,
        };
      }

      return {
        saldo: saldosEstoque.get(itemId) ?? 0,
        ultima: null,
      };
    },
    [
      saldosEstoque,
      ultimasMovimentacoesDoHistorico,
      ultimasMovimentacoesEstoque,
    ],
  );

  // A posição exibida e o histórico compartilham a mesma verdade: quantidade_atual
  // da última movimentação conhecida para o item.
  const calcularEstoqueAtual = (itemId: string): number => {
    return resolverPosicaoAtual(itemId).saldo;
  };

  const estoqueCalculado = useMemo(() => {
    return itens.map((item) => {
      const posicao = resolverPosicaoAtual(item.id);
      return {
        ...item,
        estoqueAtual: posicao.saldo,
        ultimaMovimentacao: posicao.ultima,
      };
    });
  }, [itens, resolverPosicaoAtual]);

  // Obter estoque com quantidades atuais - agora retorna o cache
  const obterEstoque = useCallback((): EstoqueItem[] => {
    return estoqueCalculado;
  }, [estoqueCalculado]);

// Função para cadastrar novo item
const cadastrarItem = async (dadosItem: Omit<Item, 'id'> & { codigoBarras?: number }) => {
  try {
    let codigoNumerico: number;

    // Se o código de barras foi fornecido, usar ele; senão, gerar automaticamente
    if (dadosItem.codigoBarras && dadosItem.codigoBarras > 0) {
      codigoNumerico = dadosItem.codigoBarras;
    } else {
      codigoNumerico = await obterProximoCodigoDisponivel();
    }

    const insertItem = {
      codigo_barras: codigoNumerico,
      origem: dadosItem.origem,
      caixa_organizador: dadosItem.caixaOrganizador,
      localizacao: dadosItem.localizacao,
      nome: dadosItem.nome,
      tipo_item: dadosItem.tipoItem,
      especificacao: dadosItem.especificacao,
      especificacoes_dimensoes: dadosItem.especificacoesDimensoes ?? null,
      marca: dadosItem.marca,
      unidade: dadosItem.unidade,
      condicao: dadosItem.condicao,
      subcategoria_id: dadosItem.subcategoriaId ?? null,
      categoria_id: dadosItem.categoriaId ?? null,
      quantidade_minima: dadosItem.quantidadeMinima ?? null,
      ncm: dadosItem.ncm ?? null,
      valor: dadosItem.valor ?? null,
      foto_url: dadosItem.fotoUrl ?? null,
    };

    const { data, error } = await supabase.from('items').insert(insertItem).select('*').maybeSingle();
    if (error) throw error;

    const novoItemId = data?.id as string;
    const novoItem: Item = {
      ...dadosItem,
      id: novoItemId,
      codigoBarras: codigoNumerico,
    };
    setItens(prev => [...prev, novoItem]);

    // Registrar movimentação de cadastro
    const movimentacao: Omit<Movimentacao, 'id'> = {
      itemId: novoItemId,
      tipo: 'CADASTRO',
      quantidade: 0,
      quantidadeAnterior: 0,
      quantidadeAtual: 0,
      userId: user?.id,
      observacoes: undefined,
      dataHora: new Date().toISOString(),
      itemSnapshot: novoItem,
    };

    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    const { data: movData, error: movError } = await supabase.from('movements').insert({
      item_id: movimentacao.itemId,
      tipo: movimentacao.tipo,
      quantidade: movimentacao.quantidade,
      quantidade_anterior: movimentacao.quantidadeAnterior,
      quantidade_atual: movimentacao.quantidadeAtual,
      user_id: movimentacao.userId ?? null,
      observacoes: movimentacao.observacoes ?? null,
      item_snapshot: JSON.parse(JSON.stringify(movimentacao.itemSnapshot)),
      estoque_id: estoqueAtivoInfo?.id ?? null,
    }).select('*').maybeSingle();
    if (movError) throw movError;

    setMovimentacoes(prev => [...prev, { ...movimentacao, id: movData!.id }]);

    toast({ title: 'Item cadastrado!', description: `${novoItem.nome} foi cadastrado com sucesso.` });
    return true;
  } catch (error) {
    console.error('Erro ao cadastrar item:', error);
    toast({ title: 'Erro ao cadastrar', description: 'Ocorreu um erro ao cadastrar o item.', variant: 'destructive' });
    return false;
  }
};

// Registrar entrada
const registrarEntrada = async (
  codigoBarras: number,
  quantidade: number,
  responsavel: string,
  observacoes?: string,
  tipoOperacaoId?: string
) => {
  try {
    const item = buscarItemPorCodigo(codigoBarras);
    if (!item) {
      toast({ title: 'Item não encontrado', description: 'Não foi encontrado item com este código de barras.', variant: 'destructive' });
      return false;
    }
    if (!item.ativo) {
      toast({ title: 'Item inativo', description: 'Este item está inativo e não pode receber entradas.', variant: 'destructive' });
      return false;
    }

    const estoqueAnterior = calcularEstoqueAtual(item.id);
    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    let tipoOperacaoNome: string | undefined;

    if (tipoOperacaoId) {
      const { data: tipoOperacaoData, error: tipoOperacaoError } = await supabase
        .from('tipos_operacao')
        .select('nome')
        .eq('id', tipoOperacaoId)
        .maybeSingle();

      if (tipoOperacaoError) throw tipoOperacaoError;
      tipoOperacaoNome = tipoOperacaoData?.nome;
    }

    const entradaParaAcerto = normalizarTexto(tipoOperacaoNome).includes('acerto');
    const estoqueAtual = entradaParaAcerto ? quantidade : estoqueAnterior + quantidade;

    const entradaSimilarRecente = await verificarEntradaRecenteSimilar(
      item.id,
      quantidade,
      estoqueAtivoInfo?.id ?? null
    );

    if (entradaSimilarRecente) {
      toast({
        title: 'Entrada duplicada bloqueada',
        description: 'Já existe uma entrada igual para este item nos últimos 5 minutos. Aguarde ou ajuste a quantidade se for uma nova entrada real.',
        variant: 'destructive'
      });
      return false;
    }

    const movimento: Omit<Movimentacao, 'id'> = {
      itemId: item.id,
      tipo: 'ENTRADA',
      quantidade,
      quantidadeAnterior: estoqueAnterior,
      quantidadeAtual: estoqueAtual,
      userId: user?.id,
      observacoes,
      dataHora: new Date().toISOString(),
      tipoOperacaoId,
      tipoOperacaoNome,
      itemSnapshot: item,
    };

    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      user_id: movimento.userId ?? null,
      observacoes: movimento.observacoes ?? null,
      item_snapshot: JSON.parse(JSON.stringify(movimento.itemSnapshot)),
      estoque_id: estoqueAtivoInfo?.id ?? null,
      tipo_operacao_id: tipoOperacaoId ?? null,
    }).select('*').maybeSingle();
    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Entrada duplicada bloqueada',
          description: 'Este item já teve uma entrada idêntica registrada agora há pouco.',
          variant: 'destructive'
        });
        return false;
      }
      throw error;
    }

    setMovimentacoes(prev => [...prev, { ...movimento, id: data!.id }]);

    toast({
      title: entradaParaAcerto ? 'Entrada para acerto registrada!' : 'Entrada registrada!',
      description: entradaParaAcerto
        ? `Saldo de ${item.nome} ajustado para ${estoqueAtual} ${item.unidade}.`
        : `Entrada de ${quantidade} ${item.unidade} de ${item.nome}.`
    });
    return true;
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    const detalhe = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : '';
    toast({
      title: 'Erro na entrada',
      description: detalhe || 'Ocorreu um erro ao registrar a entrada.',
      variant: 'destructive'
    });
    return false;
  }
};

// Registrar saída
const registrarSaida = async (
  codigoBarras: number,
  quantidade: number,
  responsavel: string,
  observacoes?: string,
  tipoOperacaoId?: string,
  destinatario?: string
) => {
  try {
    const item = buscarItemPorCodigo(codigoBarras);
    if (!item) {
      toast({ title: 'Item não encontrado', description: 'Não foi encontrado item com este código de barras.', variant: 'destructive' });
      return false;
    }
    if (!item.ativo) {
      toast({ title: 'Item inativo', description: 'Este item está inativo e não pode ser retirado.', variant: 'destructive' });
      return false;
    }

    const estoqueAnterior = calcularEstoqueAtual(item.id);
    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    
    // Regra para ferramentas: bloqueio de duplicidade e quantidade
    if (itemEhFerramentaUnitaria(item, categorias)) {
      if (quantidade > 1) {
        toast({ 
          title: 'Quantidade inválida', 
          description: 'Ferramentas devem ser retiradas individualmente (máximo 1).', 
          variant: 'destructive' 
        });
        return false;
      }

      const { alocada, localAtual } = await verificarFerramentaAlocada(item.id, estoqueAtivoInfo?.id);
      if (alocada) {
        toast({ 
          title: 'Ferramenta já alocada', 
          description: `A ferramenta "${item.nome}" possui devolução pendente.${localAtual ? ` Local atual: ${localAtual}` : ''}. Faça a devolução antes de retirar novamente.`, 
          variant: 'destructive' 
        });
        return false;
      }
    }

    if (estoqueAnterior < quantidade) {
      toast({ title: 'Estoque insuficiente', description: `Estoque atual: ${estoqueAnterior} ${item.unidade}. Quantidade solicitada: ${quantidade} ${item.unidade}.`, variant: 'destructive' });
      return false;
    }

    const estoqueAtual = estoqueAnterior - quantidade;

    const movimento: Omit<Movimentacao, 'id'> = {
      itemId: item.id,
      tipo: 'SAIDA',
      quantidade,
      quantidadeAnterior: estoqueAnterior,
      quantidadeAtual: estoqueAtual,
      userId: user?.id,
      observacoes,
      dataHora: new Date().toISOString(),
      tipoOperacaoId,
      itemSnapshot: item,
    };

    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      user_id: movimento.userId ?? null,
      observacoes: movimento.observacoes ?? null,
      item_snapshot: JSON.parse(JSON.stringify(movimento.itemSnapshot)),
      estoque_id: estoqueAtivoInfo?.id ?? null,
      tipo_operacao_id: tipoOperacaoId ?? null,
      destinatario: destinatario ?? null,
    }).select('*').maybeSingle();
    if (error) throw error;

    setMovimentacoes(prev => [...prev, { ...movimento, id: data!.id }]);

    if (item.quantidadeMinima && estoqueAtual <= item.quantidadeMinima) {
      toast({ title: '⚠️ Estoque baixo!', description: `${item.nome} está com estoque baixo: ${estoqueAtual} ${item.unidade}. Quantidade mínima: ${item.quantidadeMinima}`, variant: 'destructive' });
    }

    toast({ title: 'Saída registrada!', description: `Saída de ${quantidade} ${item.unidade} de ${item.nome}.` });
    return true;
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    toast({ title: 'Erro na saída', description: 'Ocorreu um erro ao registrar a saída.', variant: 'destructive' });
    return false;
  }
};

// Editar item
const editarItem = async (itemEditado: Item) => {
  try {
    const update = {
      codigo_barras: Number(itemEditado.codigoBarras),
      origem: itemEditado.origem,
      caixa_organizador: itemEditado.caixaOrganizador,
      localizacao: itemEditado.localizacao,
      nome: itemEditado.nome,
      tipo_item: itemEditado.tipoItem,
      especificacao: itemEditado.especificacao,
      especificacoes_dimensoes: itemEditado.especificacoesDimensoes ?? null,
      marca: itemEditado.marca,
      unidade: itemEditado.unidade,
      condicao: itemEditado.condicao,
      subcategoria_id: itemEditado.subcategoriaId ?? null,
      categoria_id: itemEditado.categoriaId ?? null,
      quantidade_minima: itemEditado.quantidadeMinima ?? null,
      ncm: itemEditado.ncm ?? null,
      valor: itemEditado.valor ?? null,
      foto_url: itemEditado.fotoUrl ?? null,
      ativo: itemEditado.ativo,
    };

    const { error } = await supabase.from('items').update(update).eq('id', itemEditado.id);
    if (error) {
      console.error('Erro detalhado do Supabase:', error);
      toast({ 
        title: 'Erro ao editar', 
        description: `Erro: ${error.message}${error.details ? ' - ' + error.details : ''}`, 
        variant: 'destructive' 
      });
      return false;
    }

    // Histórico é imutável: item_snapshot registra como o item era no momento
    // da movimentação. Editar o cadastro atual nunca reescreve movimentos passados.
    setItens(prev => prev.map(i => (i.id === itemEditado.id ? itemEditado : i)));
    toast({ title: 'Item atualizado!', description: `${itemEditado.nome} foi atualizado com sucesso.` });
    return true;
  } catch (error) {
    console.error('Erro ao editar item:', error);
    toast({ title: 'Erro ao editar', description: 'Ocorreu um erro ao editar o item.', variant: 'destructive' });
    return false;
  }
};

// Importar itens
const importarItens = async (lista: Omit<Item, 'id' | 'codigoBarras'>[]) => {
  try {

    let sucessos = 0;
    let erros = 0;
    const errosDetalhes: string[] = [];

    for (const itemData of lista) {
      // Gerar código sequencial automático
      const { data: codigoData, error: codigoError } = await supabase.rpc('gerar_proximo_codigo');
      if (codigoError) {
        erros++;
        errosDetalhes.push(`Código: ${codigoError.message}`);
        continue;
      }
      
      const codigoGerado = codigoData as string;
      const codigoNumerico = parseInt(codigoGerado.replace('COD-', ''));

      const insertItem = {
        codigo_barras: codigoNumerico,
        origem: itemData.origem,
        caixa_organizador: itemData.caixaOrganizador,
        localizacao: itemData.localizacao,
        nome: itemData.nome,
        tipo_item: itemData.tipoItem,
        especificacao: itemData.especificacao,
        especificacoes_dimensoes: itemData.especificacoesDimensoes ?? null,
        marca: itemData.marca,
        unidade: itemData.unidade,
        condicao: itemData.condicao,
        subcategoria_id: itemData.subcategoriaId ?? null,
        categoria_id: itemData.categoriaId ?? null,
        quantidade_minima: itemData.quantidadeMinima ?? null,
        ncm: itemData.ncm ?? null,
        valor: itemData.valor ?? null,
      };

      const { data: itemRow, error: itemErr } = await supabase.from('items').insert(insertItem).select('*').maybeSingle();
      if (itemErr) {
        erros++;
        errosDetalhes.push(`Item "${itemData.nome}": ${itemErr.message}`);
        continue;
      }

      const novoItem: Item = { ...itemData, id: itemRow!.id, codigoBarras: codigoNumerico };
      setItens(prev => [...prev, novoItem]);

      const { error: movErr } = await supabase.from('movements').insert({
        item_id: itemRow!.id,
        tipo: 'CADASTRO',
        quantidade: 0,
        quantidade_anterior: 0,
        quantidade_atual: 0,
        observacoes: null,
        data_hora: new Date().toISOString(),
        item_snapshot: JSON.parse(JSON.stringify(novoItem)),
      });
      if (movErr) {
        // não bloquear importação por falha no log, apenas registrar erro
        errosDetalhes.push(`Log "${itemData.nome}": ${movErr.message}`);
      }
      sucessos++;
    }

    if (sucessos > 0) {
      await carregarDados();
      const msg = `Importação concluída: ${sucessos} item(ns) importado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}.`;
      toast({ title: 'Importação realizada!', description: msg });
      return true;
    }

    // Nenhum item importado com sucesso
    const detalhe = errosDetalhes[0] ? ` Detalhe: ${errosDetalhes[0]}` : '';
    toast({
      title: 'Falha na importação',
      description: `Nenhum item foi importado. Verifique suas permissões (Administrador, Gestor ou Engenharia) e a conexão com o servidor.${detalhe}`,
      variant: 'destructive',
    });
    return false;
  } catch (error) {
    console.error('Erro ao importar itens:', error);
    toast({ title: 'Erro na importação', description: 'Ocorreu um erro ao importar os itens.', variant: 'destructive' });
    return false;
  }
};

// Importação alternativa via Função Edge (servidor)
const importarItensServidor = async (lista: Omit<Item, 'id' | 'codigoBarras'>[]) => {
  try {
    const { data, error } = await supabase.functions.invoke('import-items', {
      body: { itens: lista },
    });
    if (error) throw error;

    const res = data as { success: boolean; imported?: number; errors?: { index: number; nome?: string; message: string }[]; message?: string };
    if (!res?.success) {
      toast({ title: 'Falha na importação', description: res?.message || 'Erro desconhecido no servidor.', variant: 'destructive' });
      return false;
    }

    await carregarDados();

    const errosTotal = res.errors?.length ?? 0;
    toast({
      title: 'Importação realizada!',
      description: `Importados: ${res.imported ?? 0}${errosTotal > 0 ? `, erros: ${errosTotal}` : ''}.`,
    });
    return (res.imported ?? 0) > 0;
  } catch (e: any) {
    console.error('Erro na importação via servidor:', e);
    toast({ title: 'Erro na importação', description: e?.message || 'Falha ao chamar função de importação.', variant: 'destructive' });
    return false;
  }
};

  const estoqueAtivoInfo = obterEstoqueAtivoInfo();
  const incluirSemEstoqueAtivo = isEstoqueAtivoPrincipal();

  return {
    itens,
    movimentacoes,
    loading,
    estoqueAtivoInfo,
    incluirSemEstoqueAtivo,
    buscarItemPorCodigo,
    verificarCodigoExistente,
    obterProximoCodigoDisponivel,
    calcularEstoqueAtual,
    obterEstoque,
    cadastrarItem,
    editarItem,
    importarItens,
    importarItensServidor,
    registrarEntrada,
    registrarSaida,
    carregarDados,
    carregarHistoricoCompleto,
  };
};
