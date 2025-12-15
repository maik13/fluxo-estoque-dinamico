import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Item, Movimentacao, EstoqueItem } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { useConfiguracoes } from './useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useEstoque = () => {
  const [itens, setItens] = useState<Item[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { estoqueAtivo, obterEstoqueAtivoInfo } = useConfiguracoes();
  const { user } = useAuth();
  
  // Refs para controle de carregamento e prevenção de duplicatas
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const processedItemsRef = useRef<Set<string>>(new Set());
  const processedMovementsRef = useRef<Set<string>>(new Set());

  // Obter dados iniciais quando o estoque ativo mudar
  useEffect(() => {
    if (estoqueAtivo) {
      carregarDados();
    } else {
      // Se não há estoque ativo, limpar os dados
      setItens([]);
      setMovimentacoes([]);
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
            marca: payload.new.marca ?? '',
            unidade: payload.new.unidade,
            condicao: payload.new.condicao ?? 'Novo',
            subcategoriaId: payload.new.subcategoria_id ?? undefined,
            quantidadeMinima: payload.new.quantidade_minima ?? undefined,
            ncm: payload.new.ncm ?? '',
            valor: payload.new.valor ?? undefined,
            fotoUrl: payload.new.foto_url ?? undefined,
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
            marca: payload.new.marca ?? '',
            unidade: payload.new.unidade,
            condicao: payload.new.condicao ?? 'Novo',
            subcategoriaId: payload.new.subcategoria_id ?? undefined,
            quantidadeMinima: payload.new.quantidade_minima ?? undefined,
            ncm: payload.new.ncm ?? '',
            valor: payload.new.valor ?? undefined,
            fotoUrl: payload.new.foto_url ?? undefined,
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
          // Só adicionar se for do estoque ativo ou se não houver filtro
          if (!estoqueAtivoInfo?.id || payload.new.estoque_id === estoqueAtivoInfo.id) {
            // Buscar nome do local se houver local_utilizacao_id
            let localNome: string | undefined;
            if (payload.new.local_utilizacao_id) {
              const { data } = await supabase
                .from('locais_utilizacao')
                .select('nome')
                .eq('id', payload.new.local_utilizacao_id)
                .single();
              localNome = data?.nome;
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
              destinatario: payload.new.destinatario ?? undefined,
              estoqueId: payload.new.estoque_id ?? undefined,
              itemSnapshot: payload.new.item_snapshot as Partial<Item>,
            };
            setMovimentacoes(prev => {
              // Evitar duplicatas
              if (prev.some(m => m.id === novaMovimentacao.id)) return prev;
              return [...prev, novaMovimentacao];
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
          
          // Verificar se a movimentação pertence ao estoque ativo
          if (payload.new.estoque_id !== estoqueId && payload.new.estoque_id !== null) {
            return;
          }

          let localNome = '';
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
            destinatario: payload.new.destinatario ?? undefined,
            estoqueId: payload.new.estoque_id ?? undefined,
            itemSnapshot: payload.new.item_snapshot as Partial<Item>,
          };
          setMovimentacoes(prev => prev.map(m => m.id === movimentacaoAtualizada.id ? movimentacaoAtualizada : m));
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

  // Função para carregar dados do Supabase com proteção contra chamadas múltiplas
  const carregarDados = async () => {
    // Prevenir múltiplas chamadas simultâneas
    if (isLoadingRef.current) return;
    
    const now = Date.now();
    // Evitar recarregar se foi carregado há menos de 500ms
    if (now - lastLoadTimeRef.current < 500) return;
    
    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;
    
    try {
      setLoading(true);
      const estoqueAtivoInfo = obterEstoqueAtivoInfo();
      const estoqueId = estoqueAtivoInfo?.id;

      // Buscar todos os itens em lotes de 1000 (limite do PostgREST)
      const pageSize = 1000;
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

      // Filtrar movimentações pelo estoque ativo e buscar em lotes
      let movsQueryBase = supabase
        .from('movements')
        .select(`
          *,
          locais_utilizacao:local_utilizacao_id (
            nome
          )
        `)
        .order('data_hora', { ascending: true });
      
      if (estoqueId) {
        movsQueryBase = movsQueryBase.eq('estoque_id', estoqueId);
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

      // Mapear DB -> Tipos locais
      const itensMapped: Item[] = (itensData ?? []).map((row: any) => ({
          id: row.id,
          codigoBarras: Number(row.codigo_barras),
          codigoAntigo: row.codigo_antigo ?? undefined,
          origem: row.origem ?? '',
          caixaOrganizador: row.caixa_organizador ?? '',
          localizacao: row.localizacao ?? '',
          nome: row.nome,
          tipoItem: (row.tipo_item ?? 'Insumo') as 'Insumo' | 'Ferramenta',
          especificacao: row.especificacao ?? '',
          marca: row.marca ?? '',
          unidade: row.unidade,
          condicao: row.condicao ?? 'Novo',
          subcategoriaId: row.subcategoria_id ?? undefined,
        quantidadeMinima: row.quantidade_minima ?? undefined,
        ncm: row.ncm ?? '',
        valor: row.valor ?? undefined,
        fotoUrl: row.foto_url ?? undefined,
      }));

      const movsMapped: Movimentacao[] = (movsData ?? []).map((row: any) => ({
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
        destinatario: row.destinatario ?? undefined,
        estoqueId: row.estoque_id ?? undefined,
        itemSnapshot: row.item_snapshot as Partial<Item>,
      }));

      setItens(itensMapped);
      setMovimentacoes(movsMapped);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do servidor.',
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

  const obterProximoCodigoDisponivel = (): number => {
    // Códigos bloqueados/reservados que não devem ser sugeridos
    const codigosBloqueados = [1001];
    
    if (itens.length === 0) return 1;
    
    // Ordena os códigos existentes
    const codigos = itens.map(item => item.codigoBarras).sort((a, b) => a - b);
    
    // Encontra o primeiro número inteiro positivo não utilizado
    let proximoCodigo = 1;
    for (const codigo of codigos) {
      if (codigo === proximoCodigo) {
        proximoCodigo++;
      } else if (codigo > proximoCodigo) {
        // Encontrou um "buraco" na sequência
        break;
      }
    }
    
    // Verifica se o código sugerido está na lista de bloqueados
    while (codigosBloqueados.includes(proximoCodigo)) {
      proximoCodigo++;
    }
    
    return proximoCodigo;
  };

  // Função para calcular estoque atual de um item considerando apenas o estoque ativo
  const calcularEstoqueAtual = (itemId: string): number => {
    // Filtrar movimentações do item E do estoque ativo
    const movimentacoesItem = movimentacoes.filter(mov => 
      mov.itemId === itemId && 
      (!mov.estoqueId || mov.estoqueId === estoqueAtivo)
    );
    let estoque = 0;
    
    movimentacoesItem.forEach(mov => {
      if (mov.tipo === 'ENTRADA' || mov.tipo === 'CADASTRO') {
        estoque += mov.quantidade;
      } else if (mov.tipo === 'SAIDA') {
        estoque -= mov.quantidade;
      }
    });
    
    return Math.max(0, estoque); // Não pode ser negativo
  };

  // Cache do estoque calculado - usa useMemo para evitar recálculo a cada render
  const estoqueCalculado = useMemo(() => {
    return itens.map(item => {
      // Filtrar movimentações do item E do estoque ativo
      const movimentacoesItem = movimentacoes.filter(mov => 
        mov.itemId === item.id && 
        (!mov.estoqueId || mov.estoqueId === estoqueAtivo)
      );
      
      let estoqueAtual = 0;
      movimentacoesItem.forEach(mov => {
        if (mov.tipo === 'ENTRADA' || mov.tipo === 'CADASTRO') {
          estoqueAtual += mov.quantidade;
        } else if (mov.tipo === 'SAIDA') {
          estoqueAtual -= mov.quantidade;
        }
      });
      
      // Encontrar última movimentação
      const ultimaMovimentacao = movimentacoesItem
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0];

      return {
        ...item,
        estoqueAtual: Math.max(0, estoqueAtual),
        ultimaMovimentacao: ultimaMovimentacao || null
      };
    });
  }, [itens, movimentacoes, estoqueAtivo]);

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
      // Gerar código sequencial automático usando função do banco
      const { data: codigoData, error: codigoError } = await supabase.rpc('gerar_proximo_codigo');
      if (codigoError) throw codigoError;
      
      const codigoGerado = codigoData as string;
      codigoNumerico = parseInt(codigoGerado.replace('COD-', ''));
    }

    const insertItem = {
      codigo_barras: codigoNumerico,
      origem: dadosItem.origem,
      caixa_organizador: dadosItem.caixaOrganizador,
      localizacao: dadosItem.localizacao,
      nome: dadosItem.nome,
      tipo_item: dadosItem.tipoItem,
      especificacao: dadosItem.especificacao,
      marca: dadosItem.marca,
      unidade: dadosItem.unidade,
      condicao: dadosItem.condicao,
      subcategoria_id: dadosItem.subcategoriaId ?? null,
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
      data_hora: movimentacao.dataHora,
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

    const estoqueAnterior = calcularEstoqueAtual(item.id);
    const estoqueAtual = estoqueAnterior + quantidade;

    const movimento: Omit<Movimentacao, 'id'> = {
      itemId: item.id,
      tipo: 'ENTRADA',
      quantidade,
      quantidadeAnterior: estoqueAnterior,
      quantidadeAtual: estoqueAtual,
      userId: user?.id,
      observacoes,
      dataHora: new Date().toISOString(),
      itemSnapshot: item,
    };

    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      user_id: movimento.userId ?? null,
      observacoes: movimento.observacoes ?? null,
      data_hora: movimento.dataHora,
      item_snapshot: JSON.parse(JSON.stringify(movimento.itemSnapshot)),
      estoque_id: estoqueAtivoInfo?.id ?? null,
      tipo_operacao_id: tipoOperacaoId ?? null,
    }).select('*').maybeSingle();
    if (error) throw error;

    setMovimentacoes(prev => [...prev, { ...movimento, id: data!.id }]);

    toast({ title: 'Entrada registrado!', description: `Entrada de ${quantidade} ${item.unidade} de ${item.nome}.` });
    return true;
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    toast({ title: 'Erro na entrada', description: 'Ocorreu um erro ao registrar a entrada.', variant: 'destructive' });
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

    const estoqueAnterior = calcularEstoqueAtual(item.id);
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
      itemSnapshot: item,
    };

    const estoqueAtivoInfo = obterEstoqueAtivoInfo();
    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      user_id: movimento.userId ?? null,
      observacoes: movimento.observacoes ?? null,
      data_hora: movimento.dataHora,
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
      marca: itemEditado.marca,
      unidade: itemEditado.unidade,
      condicao: itemEditado.condicao,
      subcategoria_id: itemEditado.subcategoriaId ?? null,
      quantidade_minima: itemEditado.quantidadeMinima ?? null,
      ncm: itemEditado.ncm ?? null,
      valor: itemEditado.valor ?? null,
      foto_url: itemEditado.fotoUrl ?? null,
    };

    const { error } = await supabase.from('items').update(update).eq('id', itemEditado.id);
    if (error) throw error;

    // Atualizar item_snapshot em todas as movimentações deste item
    const { error: movError } = await supabase
      .from('movements')
      .update({ item_snapshot: JSON.parse(JSON.stringify(itemEditado)) })
      .eq('item_id', itemEditado.id);
    
    if (movError) {
      console.error('Erro ao atualizar movimentações:', movError);
      toast({ 
        title: 'Aviso', 
        description: 'Item atualizado, mas houve um erro ao atualizar o histórico de movimentações.', 
        variant: 'default' 
      });
    }

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
        marca: itemData.marca,
        unidade: itemData.unidade,
        condicao: itemData.condicao,
        subcategoria_id: itemData.subcategoriaId ?? null,
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

  return {
    itens,
    movimentacoes,
    loading,
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
  };
};
