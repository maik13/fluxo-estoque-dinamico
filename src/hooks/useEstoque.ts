import { useState, useEffect } from 'react';
import { Item, Movimentacao, EstoqueItem } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { useConfiguracoes } from './useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';

export const useEstoque = () => {
  const [itens, setItens] = useState<Item[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { estoqueAtivo, obterEstoqueAtivoInfo } = useConfiguracoes();

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

  // Função para carregar dados do Supabase
  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: itensData, error: itensError } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: true });
      if (itensError) throw itensError;

      const { data: movsData, error: movsError } = await supabase
        .from('movements')
        .select('*')
        .order('data_hora', { ascending: true });
      if (movsError) throw movsError;

      // Mapear DB -> Tipos locais
      const itensMapped: Item[] = (itensData ?? []).map((row: any) => ({
          id: row.id,
          codigoBarras: Number(row.codigo_barras),
          origem: row.origem ?? '',
          caixaOrganizador: row.caixa_organizador ?? '',
          localizacao: row.localizacao ?? '',
          responsavel: row.responsavel ?? '',
          nome: row.nome,
          tipoItem: (row.tipo_item ?? 'Insumo') as 'Insumo' | 'Ferramenta',
          metragem: row.metragem ?? undefined,
          peso: row.peso ?? undefined,
          comprimentoLixa: row.comprimento_lixa ?? undefined,
          polaridadeDisjuntor: row.polaridade_disjuntor ?? undefined,
          especificacao: row.especificacao ?? '',
          marca: row.marca ?? '',
          quantidade: Number(row.quantidade ?? 0),
          unidade: row.unidade,
          condicao: row.condicao ?? 'Novo',
          categoria: row.categoria ?? '',
          subcategoria: row.subcategoria ?? '',
          subDestino: row.sub_destino ?? '',
          tipoServico: row.tipo_servico ?? '',
        dataCriacao: row.data_criacao ?? new Date().toISOString(),
        quantidadeMinima: row.quantidade_minima ?? undefined,
      }));

      const movsMapped: Movimentacao[] = (movsData ?? []).map((row: any) => ({
          id: row.id,
          itemId: row.item_id,
          tipo: row.tipo,
          quantidade: Number(row.quantidade),
          quantidadeAnterior: Number(row.quantidade_anterior),
          quantidadeAtual: Number(row.quantidade_atual),
          responsavel: row.responsavel,
          observacoes: row.observacoes ?? undefined,
          local_utilizacao: row.local_utilizacao ?? undefined,
        dataHora: row.data_hora,
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
    if (itens.length === 0) return 1;
    const codigos = itens.map(item => item.codigoBarras).sort((a, b) => a - b);
    return Math.max(...codigos) + 1;
  };

  // Função para calcular estoque atual de um item
  const calcularEstoqueAtual = (itemId: string): number => {
    const movimentacoesItem = movimentacoes.filter(mov => mov.itemId === itemId);
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

  // Obter estoque com quantidades atuais (filtrado por estoque ativo)
  const obterEstoque = (): EstoqueItem[] => {
    // Filtrar itens apenas do estoque ativo
    const itensFiltrados = itens.filter(item => {
      // Se não há informação de estoque no item, considerar que pertence ao estoque principal
      const itemEstoque = item.subDestino || 'estoque-principal';
      const estoqueAtivoInfo = obterEstoqueAtivoInfo();
      const estoqueAtivoNome = estoqueAtivoInfo?.nome || 'Estoque Principal';
      
      // Mapear nomes para IDs consistentes
      const estoqueAtivo = estoqueAtivoNome.toLowerCase().replace(/\s+/g, '-');
      const itemEstoqueNormalizado = itemEstoque.toLowerCase().replace(/\s+/g, '-');
      
      return itemEstoqueNormalizado === estoqueAtivo;
    });

    return itensFiltrados.map(item => {
      const estoqueAtual = calcularEstoqueAtual(item.id);
      const ultimaMovimentacao = movimentacoes
        .filter(mov => mov.itemId === item.id)
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0];

      return {
        ...item,
        estoqueAtual,
        ultimaMovimentacao: ultimaMovimentacao || null
      };
    });
  };

const isEstoquePrincipal = () => estoqueAtivo === 'estoque-principal';

// Função para cadastrar novo item (só funciona no estoque principal)
const cadastrarItem = async (dadosItem: Omit<Item, 'id' | 'dataCriacao' | 'codigoBarras'>) => {
  try {
    if (!isEstoquePrincipal()) {
      toast({
        title: 'Operação não permitida',
        description: 'Novos itens só podem ser cadastrados no Estoque Principal.',
        variant: 'destructive',
      });
      return false;
    }

    // Gerar código sequencial automático usando função do banco
    const { data: codigoData, error: codigoError } = await supabase.rpc('gerar_proximo_codigo');
    if (codigoError) throw codigoError;
    
    const codigoGerado = codigoData as string;
    const codigoNumerico = parseInt(codigoGerado.replace('COD-', ''));

    const insertItem = {
      codigo_barras: codigoNumerico,
      origem: dadosItem.origem,
      caixa_organizador: dadosItem.caixaOrganizador,
      localizacao: dadosItem.localizacao,
      responsavel: dadosItem.responsavel,
      nome: dadosItem.nome,
      tipo_item: dadosItem.tipoItem,
      metragem: dadosItem.metragem ?? null,
      peso: dadosItem.peso ?? null,
      comprimento_lixa: dadosItem.comprimentoLixa ?? null,
      polaridade_disjuntor: dadosItem.polaridadeDisjuntor ?? null,
      especificacao: dadosItem.especificacao,
      marca: dadosItem.marca,
      quantidade: dadosItem.quantidade,
      unidade: dadosItem.unidade,
      condicao: dadosItem.condicao,
      categoria: dadosItem.categoria,
      subcategoria: dadosItem.subcategoria,
      sub_destino: dadosItem.subDestino,
      tipo_servico: dadosItem.tipoServico,
      data_criacao: new Date().toISOString(),
      quantidade_minima: dadosItem.quantidadeMinima ?? null,
    };

    const { data, error } = await supabase.from('items').insert(insertItem).select('*').maybeSingle();
    if (error) throw error;

    const novoItemId = data?.id as string;
    const novoItem: Item = {
      ...dadosItem,
      id: novoItemId,
      codigoBarras: codigoNumerico,
      dataCriacao: insertItem.data_criacao,
    };
    setItens(prev => [...prev, novoItem]);

    // Registrar movimentação de cadastro
    const movimentacao: Omit<Movimentacao, 'id'> = {
      itemId: novoItemId,
      tipo: 'CADASTRO',
      quantidade: dadosItem.quantidade,
      quantidadeAnterior: 0,
      quantidadeAtual: dadosItem.quantidade,
      responsavel: dadosItem.responsavel,
      observacoes: undefined,
      dataHora: new Date().toISOString(),
      itemSnapshot: novoItem,
    };

    const { data: movData, error: movError } = await supabase.from('movements').insert({
      item_id: movimentacao.itemId,
      tipo: movimentacao.tipo,
      quantidade: movimentacao.quantidade,
      quantidade_anterior: movimentacao.quantidadeAnterior,
      quantidade_atual: movimentacao.quantidadeAtual,
      responsavel: movimentacao.responsavel,
      observacoes: movimentacao.observacoes ?? null,
      data_hora: movimentacao.dataHora,
      item_snapshot: JSON.parse(JSON.stringify(movimentacao.itemSnapshot)),
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
  observacoes?: string
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
      responsavel,
      observacoes,
      dataHora: new Date().toISOString(),
      itemSnapshot: item,
    };

    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      responsavel: movimento.responsavel,
      observacoes: movimento.observacoes ?? null,
      data_hora: movimento.dataHora,
      item_snapshot: JSON.parse(JSON.stringify(movimento.itemSnapshot)),
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
  localUtilizacao?: string
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
      responsavel,
      observacoes,
      dataHora: new Date().toISOString(),
      itemSnapshot: item,
    };

    const { data, error } = await supabase.from('movements').insert({
      item_id: movimento.itemId,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      quantidade_anterior: movimento.quantidadeAnterior,
      quantidade_atual: movimento.quantidadeAtual,
      responsavel: movimento.responsavel,
      observacoes: movimento.observacoes ?? null,
      local_utilizacao: localUtilizacao ?? null,
      data_hora: movimento.dataHora,
      item_snapshot: JSON.parse(JSON.stringify(movimento.itemSnapshot)),
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

// Editar item (só no principal)
const editarItem = async (itemEditado: Item) => {
  try {
    if (!isEstoquePrincipal()) {
      toast({ title: 'Operação não permitida', description: 'Itens só podem ser editados no Estoque Principal.', variant: 'destructive' });
      return false;
    }

    const update = {
      codigo_barras: Number(itemEditado.codigoBarras),
      origem: itemEditado.origem,
      caixa_organizador: itemEditado.caixaOrganizador,
      localizacao: itemEditado.localizacao,
      responsavel: itemEditado.responsavel,
      nome: itemEditado.nome,
      tipo_item: itemEditado.tipoItem,
      metragem: itemEditado.metragem ?? null,
      peso: itemEditado.peso ?? null,
      comprimento_lixa: itemEditado.comprimentoLixa ?? null,
      polaridade_disjuntor: itemEditado.polaridadeDisjuntor ?? null,
      especificacao: itemEditado.especificacao,
      marca: itemEditado.marca,
      quantidade: itemEditado.quantidade,
      unidade: itemEditado.unidade,
      condicao: itemEditado.condicao,
      categoria: itemEditado.categoria,
      subcategoria: itemEditado.subcategoria,
      sub_destino: itemEditado.subDestino,
      tipo_servico: itemEditado.tipoServico,
      quantidade_minima: itemEditado.quantidadeMinima ?? null,
    };

    const { error } = await supabase.from('items').update(update).eq('id', itemEditado.id);
    if (error) throw error;

    setItens(prev => prev.map(i => (i.id === itemEditado.id ? itemEditado : i)));
    toast({ title: 'Item atualizado!', description: `${itemEditado.nome} foi atualizado com sucesso.` });
    return true;
  } catch (error) {
    console.error('Erro ao editar item:', error);
    toast({ title: 'Erro ao editar', description: 'Ocorreu um erro ao editar o item.', variant: 'destructive' });
    return false;
  }
};

// Importar itens (só no principal)
const importarItens = async (lista: Omit<Item, 'id' | 'dataCriacao' | 'codigoBarras'>[]) => {
  try {
    if (!isEstoquePrincipal()) {
      toast({ title: 'Operação não permitida', description: 'Importação só pode ser feita no Estoque Principal.', variant: 'destructive' });
      return false;
    }

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
        responsavel: itemData.responsavel,
        nome: itemData.nome,
        tipo_item: itemData.tipoItem,
        metragem: itemData.metragem ?? null,
        peso: itemData.peso ?? null,
        comprimento_lixa: itemData.comprimentoLixa ?? null,
        polaridade_disjuntor: itemData.polaridadeDisjuntor ?? null,
        especificacao: itemData.especificacao,
        marca: itemData.marca,
        quantidade: itemData.quantidade,
        unidade: itemData.unidade,
        condicao: itemData.condicao,
        categoria: itemData.categoria,
        subcategoria: itemData.subcategoria,
        sub_destino: itemData.subDestino,
        tipo_servico: itemData.tipoServico,
        data_criacao: new Date().toISOString(),
        quantidade_minima: itemData.quantidadeMinima ?? null,
      };

      const { data: itemRow, error: itemErr } = await supabase.from('items').insert(insertItem).select('*').maybeSingle();
      if (itemErr) {
        erros++;
        errosDetalhes.push(`Item "${itemData.nome}": ${itemErr.message}`);
        continue;
      }

      const novoItem: Item = { ...itemData, id: itemRow!.id, codigoBarras: codigoNumerico, dataCriacao: insertItem.data_criacao };
      setItens(prev => [...prev, novoItem]);

      const { error: movErr } = await supabase.from('movements').insert({
        item_id: itemRow!.id,
        tipo: 'CADASTRO',
        quantidade: itemData.quantidade,
        quantidade_anterior: 0,
        quantidade_atual: itemData.quantidade,
        responsavel: itemData.responsavel,
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
const importarItensServidor = async (lista: Omit<Item, 'id' | 'dataCriacao' | 'codigoBarras'>[]) => {
  try {
    if (!isEstoquePrincipal()) {
      toast({
        title: 'Operação não permitida',
        description: 'Importação só pode ser feita no Estoque Principal.',
        variant: 'destructive',
      });
      return false;
    }

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
    isEstoquePrincipal,
  };
};
