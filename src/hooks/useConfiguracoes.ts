import { useState, useEffect } from 'react';
import { EstoqueConfig, TipoServicoConfig, SubcategoriaConfig } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';

export interface TipoOperacaoConfig {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao: string;
}

export const useConfiguracoes = () => {
  const [estoques, setEstoques] = useState<EstoqueConfig[]>([]);
  const [tiposServico, setTiposServico] = useState<TipoServicoConfig[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaConfig[]>([]);
  const [tiposOperacao, setTiposOperacao] = useState<TipoOperacaoConfig[]>([]);
  const [estoqueAtivo, setEstoqueAtivo] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Carregar dados do localStorage
  useEffect(() => {
    try {
      const estoquesSalvos = localStorage.getItem('estoque-config');
      const tiposServicoSalvos = localStorage.getItem('tipos-servico-config');
      const subcategoriasSalvas = localStorage.getItem('subcategorias-config');
      const tiposOperacaoSalvos = localStorage.getItem('tipos-operacao-config');
      const estoqueAtivoSalvo = localStorage.getItem('estoque-ativo');

      if (estoquesSalvos) {
        const parsedEstoques = JSON.parse(estoquesSalvos);
        setEstoques(parsedEstoques);
        
        // Se não há estoque ativo salvo, definir o primeiro como ativo
        if (!estoqueAtivoSalvo && parsedEstoques.length > 0) {
          setEstoqueAtivo(parsedEstoques[0].id);
        }
      } else {
        // Criar estoque padrão
        const estoqueDefault: EstoqueConfig = {
          id: 'estoque-principal',
          nome: 'Estoque Principal',
          descricao: 'Estoque principal do sistema',
          ativo: true,
          dataCriacao: new Date().toISOString(),
        };
        setEstoques([estoqueDefault]);
        setEstoqueAtivo(estoqueDefault.id);
      }

      if (tiposServicoSalvos) {
        setTiposServico(JSON.parse(tiposServicoSalvos));
      }

      if (subcategoriasSalvas) {
        setSubcategorias(JSON.parse(subcategoriasSalvas));
      }

      if (tiposOperacaoSalvos) {
        setTiposOperacao(JSON.parse(tiposOperacaoSalvos));
      } else {
        // Criar tipos de operação padrão
        const tiposDefault: TipoOperacaoConfig[] = [
          { id: 'op-1', nome: 'Compra', descricao: 'Entrada de materiais por compra', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'op-2', nome: 'Saída para Produção', descricao: 'Saída de materiais para uso na produção', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'op-3', nome: 'Quebra', descricao: 'Perda de material por quebra ou dano', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'op-4', nome: 'Devolução', descricao: 'Retorno de materiais ao estoque', ativo: true, dataCriacao: new Date().toISOString() },
        ];
        setTiposOperacao(tiposDefault);
      }

      if (estoqueAtivoSalvo) {
        setEstoqueAtivo(estoqueAtivoSalvo);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: "Não foi possível carregar as configurações salvas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Salvar no localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('estoque-config', JSON.stringify(estoques));
    }
  }, [estoques, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('tipos-servico-config', JSON.stringify(tiposServico));
    }
  }, [tiposServico, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('subcategorias-config', JSON.stringify(subcategorias));
    }
  }, [subcategorias, loading]);

  useEffect(() => {
    if (!loading && estoqueAtivo) {
      localStorage.setItem('estoque-ativo', estoqueAtivo);
    }
  }, [estoqueAtivo, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('tipos-operacao-config', JSON.stringify(tiposOperacao));
    }
  }, [tiposOperacao, loading]);

  // Funções para gerar ID único
  const gerarId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Funções para gerenciar estoques
  const adicionarEstoque = (nome: string, descricao?: string) => {
    const novoEstoque: EstoqueConfig = {
      id: gerarId(),
      nome,
      descricao,
      ativo: true,
      dataCriacao: new Date().toISOString(),
    };

    setEstoques(prev => [...prev, novoEstoque]);
    
    toast({
      title: "Estoque criado!",
      description: `Estoque "${nome}" foi criado com sucesso.`,
    });

    return novoEstoque;
  };

  const removerEstoque = (id: string) => {
    if (estoques.length === 1) {
      toast({
        title: "Erro",
        description: "Não é possível remover o último estoque.",
        variant: "destructive",
      });
      return false;
    }

    if (estoqueAtivo === id) {
      const outroEstoque = estoques.find(e => e.id !== id);
      if (outroEstoque) {
        setEstoqueAtivo(outroEstoque.id);
      }
    }

    setEstoques(prev => prev.filter(e => e.id !== id));
    
    toast({
      title: "Estoque removido!",
      description: "Estoque foi removido com sucesso.",
    });

    return true;
  };

  const alterarEstoqueAtivo = (id: string) => {
    const estoque = estoques.find(e => e.id === id);
    if (estoque) {
      setEstoqueAtivo(id);
      toast({
        title: "Estoque alterado!",
        description: `Estoque ativo: ${estoque.nome}`,
      });
    }
  };

  // Funções para gerenciar tipos de serviço
  const adicionarTipoServico = (nome: string, descricao?: string) => {
    const novoTipo: TipoServicoConfig = {
      id: gerarId(),
      nome,
      descricao,
      ativo: true,
      dataCriacao: new Date().toISOString(),
    };

    setTiposServico(prev => [...prev, novoTipo]);
    
    toast({
      title: "Tipo de serviço criado!",
      description: `Tipo "${nome}" foi criado com sucesso.`,
    });

    return novoTipo;
  };

  const removerTipoServico = (id: string) => {
    setTiposServico(prev => prev.filter(t => t.id !== id));
    
    toast({
      title: "Tipo de serviço removido!",
      description: "Tipo de serviço foi removido com sucesso.",
    });
  };

  // Funções para gerenciar subcategorias
  const adicionarSubcategoria = (nome: string, categoria: string) => {
    const novaSubcategoria: SubcategoriaConfig = {
      id: gerarId(),
      nome,
      categoria,
      ativo: true,
      dataCriacao: new Date().toISOString(),
    };

    setSubcategorias(prev => [...prev, novaSubcategoria]);
    
    toast({
      title: "Subcategoria criada!",
      description: `Subcategoria "${nome}" foi criada com sucesso.`,
    });

    return novaSubcategoria;
  };

  const removerSubcategoria = (id: string) => {
    setSubcategorias(prev => prev.filter(s => s.id !== id));
    
    toast({
      title: "Subcategoria removida!",
      description: "Subcategoria foi removida com sucesso.",
    });
  };

  // Funções para gerenciar tipos de operação
  const adicionarTipoOperacao = (nome: string, descricao?: string) => {
    const novoTipo: TipoOperacaoConfig = {
      id: gerarId(),
      nome,
      descricao,
      ativo: true,
      dataCriacao: new Date().toISOString(),
    };

    setTiposOperacao(prev => [...prev, novoTipo]);
    
    toast({
      title: "Tipo de operação criado!",
      description: `Tipo "${nome}" foi criado com sucesso.`,
    });

    return novoTipo;
  };

  const removerTipoOperacao = (id: string) => {
    setTiposOperacao(prev => prev.filter(t => t.id !== id));
    
    toast({
      title: "Tipo de operação removido!",
      description: "Tipo de operação foi removido com sucesso.",
    });
  };

  // Funções para obter dados filtrados
  const obterEstoquesAtivos = () => estoques.filter(e => e.ativo);
  const obterTiposServicoAtivos = () => tiposServico.filter(t => t.ativo);
  const obterSubcategoriasAtivas = () => subcategorias.filter(s => s.ativo);
  const obterTiposOperacaoAtivos = () => tiposOperacao.filter(t => t.ativo);
  const obterEstoqueAtivoInfo = () => estoques.find(e => e.id === estoqueAtivo);

  return {
    estoques,
    tiposServico,
    subcategorias,
    tiposOperacao,
    estoqueAtivo,
    loading,
    adicionarEstoque,
    removerEstoque,
    alterarEstoqueAtivo,
    adicionarTipoServico,
    removerTipoServico,
    adicionarSubcategoria,
    removerSubcategoria,
    adicionarTipoOperacao,
    removerTipoOperacao,
    obterEstoquesAtivos,
    obterTiposServicoAtivos,
    obterSubcategoriasAtivas,
    obterTiposOperacaoAtivos,
    obterEstoqueAtivoInfo,
  };
};