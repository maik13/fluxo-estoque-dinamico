
import { useState, useEffect } from 'react';
import { Item, Movimentacao, EstoqueItem, TipoMovimentacao } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { useConfiguracoes } from './useConfiguracoes';

// Hook personalizado para gerenciar todo o sistema de estoque
// Este é o "cérebro" do sistema - aqui ficam todas as regras de negócio

export const useEstoque = () => {
  const [itens, setItens] = useState<Item[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { estoqueAtivo, obterEstoqueAtivoInfo } = useConfiguracoes();

  // Carregar dados do localStorage quando o componente inicializar
  useEffect(() => {
    if (!estoqueAtivo) return;
    
    try {
      // ITENS: sempre carregar do estoque principal (compartilhado)
      const itensSalvos = localStorage.getItem('estoque-itens-estoque-principal');
      
      // MOVIMENTAÇÕES: carregar específicas do estoque ativo
      const movimentacoesSalvas = localStorage.getItem(`estoque-movimentacoes-${estoqueAtivo}`);
      
      if (itensSalvos) {
        setItens(JSON.parse(itensSalvos));
      } else {
        setItens([]);
      }
      
      if (movimentacoesSalvas) {
        setMovimentacoes(JSON.parse(movimentacoesSalvas));
      } else {
        setMovimentacoes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados salvos anteriormente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [estoqueAtivo]);

  // Salvar no localStorage sempre que os dados mudarem
  useEffect(() => {
    if (!loading) {
      // ITENS: sempre salvar no estoque principal (compartilhado)
      localStorage.setItem('estoque-itens-estoque-principal', JSON.stringify(itens));
    }
  }, [itens, loading]);

  useEffect(() => {
    if (!loading && estoqueAtivo) {
      // MOVIMENTAÇÕES: salvar específicas do estoque ativo
      localStorage.setItem(`estoque-movimentacoes-${estoqueAtivo}`, JSON.stringify(movimentacoes));
    }
  }, [movimentacoes, loading, estoqueAtivo]);

  // Função para gerar ID único
  const gerarId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Função para buscar item por código de barras
  const buscarItemPorCodigo = (codigoBarras: string): Item | undefined => {
    return itens.find(item => item.codigoBarras === codigoBarras);
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

  // Função para obter todos os itens com estoque atual
  const obterEstoque = (): EstoqueItem[] => {
    return itens.map(item => {
      const estoqueAtual = calcularEstoqueAtual(item.id);
      const ultimasMovimentacoes = movimentacoes
        .filter(mov => mov.itemId === item.id)
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      
      return {
        ...item,
        estoqueAtual,
        ultimaMovimentacao: ultimasMovimentacoes[0]
      };
    });
  };

  // Verificar se estoque atual é o principal
  const isEstoquePrincipal = () => {
    return estoqueAtivo === 'estoque-principal';
  };

  // Função para cadastrar novo item (só funciona no estoque principal)
  const cadastrarItem = (dadosItem: Omit<Item, 'id' | 'dataCriacao'>) => {
    try {
      // Verificar se está no estoque principal
      if (!isEstoquePrincipal()) {
        toast({
          title: "Operação não permitida",
          description: "Novos itens só podem ser cadastrados no Estoque Principal.",
          variant: "destructive",
        });
        return false;
      }

      // Verificar se já existe item com mesmo código de barras
      if (buscarItemPorCodigo(dadosItem.codigoBarras)) {
        toast({
          title: "Código já existe",
          description: "Já existe um item com este código de barras.",
          variant: "destructive",
        });
        return false;
      }

      const novoItem: Item = {
        ...dadosItem,
        id: gerarId(),
        dataCriacao: new Date().toISOString(),
      };

      setItens(prev => [...prev, novoItem]);

      // Registrar movimentação de cadastro
      const movimentacao: Movimentacao = {
        id: gerarId(),
        itemId: novoItem.id,
        tipo: 'CADASTRO',
        quantidade: dadosItem.quantidade,
        quantidadeAnterior: 0,
        quantidadeAtual: dadosItem.quantidade,
        responsavel: dadosItem.responsavel,
        dataHora: new Date().toISOString(),
        itemSnapshot: novoItem,
      };

      setMovimentacoes(prev => [...prev, movimentacao]);

      toast({
        title: "Item cadastrado!",
        description: `${novoItem.nome} foi cadastrado com sucesso.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao cadastrar item:', error);
      toast({
        title: "Erro ao cadastrar",
        description: "Ocorreu um erro ao cadastrar o item.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Função para registrar entrada de estoque
  const registrarEntrada = (
    codigoBarras: string, 
    quantidade: number, 
    responsavel: string,
    observacoes?: string
  ) => {
    try {
      const item = buscarItemPorCodigo(codigoBarras);
      
      if (!item) {
        toast({
          title: "Item não encontrado",
          description: "Não foi encontrado item com este código de barras.",
          variant: "destructive",
        });
        return false;
      }

      const estoqueAnterior = calcularEstoqueAtual(item.id);
      const estoqueAtual = estoqueAnterior + quantidade;

      const movimentacao: Movimentacao = {
        id: gerarId(),
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

      setMovimentacoes(prev => [...prev, movimentacao]);

      toast({
        title: "Entrada registrada!",
        description: `Entrada de ${quantidade} ${item.unidade} de ${item.nome}.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      toast({
        title: "Erro na entrada",
        description: "Ocorreu um erro ao registrar a entrada.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Função para registrar saída de estoque
  const registrarSaida = (
    codigoBarras: string, 
    quantidade: number, 
    responsavel: string,
    observacoes?: string
  ) => {
    try {
      const item = buscarItemPorCodigo(codigoBarras);
      
      if (!item) {
        toast({
          title: "Item não encontrado",
          description: "Não foi encontrado item com este código de barras.",
          variant: "destructive",
        });
        return false;
      }

      const estoqueAnterior = calcularEstoqueAtual(item.id);
      
      if (estoqueAnterior < quantidade) {
        toast({
          title: "Estoque insuficiente",
          description: `Estoque atual: ${estoqueAnterior} ${item.unidade}. Quantidade solicitada: ${quantidade} ${item.unidade}.`,
          variant: "destructive",
        });
        return false;
      }

      const estoqueAtual = estoqueAnterior - quantidade;

      const movimentacao: Movimentacao = {
        id: gerarId(),
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

      setMovimentacoes(prev => [...prev, movimentacao]);

      // Verificar se precisa alertar sobre estoque baixo
      if (item.quantidadeMinima && estoqueAtual <= item.quantidadeMinima) {
        toast({
          title: "⚠️ Estoque baixo!",
          description: `${item.nome} está com estoque baixo: ${estoqueAtual} ${item.unidade}. Quantidade mínima: ${item.quantidadeMinima}`,
          variant: "destructive",
        });
      }

      toast({
        title: "Saída registrada!",
        description: `Saída de ${quantidade} ${item.unidade} de ${item.nome}.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao registrar saída:', error);
      toast({
        title: "Erro na saída",
        description: "Ocorreu um erro ao registrar a saída.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    itens,
    movimentacoes,
    loading,
    buscarItemPorCodigo,
    calcularEstoqueAtual,
    obterEstoque,
    cadastrarItem,
    registrarEntrada,
    registrarSaida,
    isEstoquePrincipal,
  };
};
