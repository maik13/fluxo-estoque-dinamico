import { useState, useEffect } from 'react';
import { EstoqueConfig, TipoServicoConfig, SubcategoriaConfig } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface TipoOperacaoConfig {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface SolicitanteConfig {
  id: string;
  nome: string;
  codigoBarras?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface LocalUtilizacaoConfig {
  id: string;
  nome: string;
  codigo?: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao: string;
}

export const useConfiguracoes = () => {
  const [estoques, setEstoques] = useState<EstoqueConfig[]>([]);
  const [tiposServico, setTiposServico] = useState<TipoServicoConfig[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaConfig[]>([]);
  const [tiposOperacao, setTiposOperacao] = useState<TipoOperacaoConfig[]>([]);
  const [solicitantes, setSolicitantes] = useState<SolicitanteConfig[]>([]);
  const [locaisUtilizacao, setLocaisUtilizacao] = useState<LocalUtilizacaoConfig[]>([]);
  const [estoqueAtivo, setEstoqueAtivo] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Carregar solicitantes do Supabase
  const carregarSolicitantes = async () => {
    try {
      const { data, error } = await supabase
        .from('solicitantes')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setSolicitantes(data.map(s => ({
          id: s.id,
          nome: s.nome,
          codigoBarras: s.codigo_barras || undefined,
          ativo: s.ativo,
          dataCriacao: s.created_at,
        })));
      }
    } catch (error: any) {
      console.error('Erro ao carregar solicitantes:', error);
      toast({
        title: "Erro ao carregar solicitantes",
        description: error.message || "Não foi possível carregar os solicitantes.",
        variant: "destructive",
      });
    }
  };

  // Carregar subcategorias do Supabase
  const carregarSubcategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('subcategorias')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setSubcategorias(data.map(s => ({
          id: s.id,
          nome: s.nome,
          categoria: s.categoria,
          ativo: s.ativo,
          dataCriacao: s.created_at,
        })));
      }
    } catch (error: any) {
      console.error('Erro ao carregar subcategorias:', error);
      toast({
        title: "Erro ao carregar subcategorias",
        description: error.message || "Não foi possível carregar as subcategorias.",
        variant: "destructive",
      });
    }
  };

  // Carregar dados do localStorage e Supabase
  useEffect(() => {
    try {
      const estoquesSalvos = localStorage.getItem('estoque-config');
      const tiposServicoSalvos = localStorage.getItem('tipos-servico-config');
      const tiposOperacaoSalvos = localStorage.getItem('tipos-operacao-config');
      const locaisUtilizacaoSalvos = localStorage.getItem('locais-utilizacao-config');
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

      // Carregar subcategorias do Supabase
      carregarSubcategorias();

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

      // Carregar solicitantes do Supabase
      carregarSolicitantes();

      if (locaisUtilizacaoSalvos) {
        setLocaisUtilizacao(JSON.parse(locaisUtilizacaoSalvos));
      } else {
        // Criar locais padrão conforme especificado
        const locaisDefault: LocalUtilizacaoConfig[] = [
          { id: 'loc-1', nome: 'Natal Cascavel 2025', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-2', nome: 'BFL - Beija Flor', codigo: 'BFL', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-3', nome: 'GRA - Gralha Azul', codigo: 'GRA', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-4', nome: 'NPR - Novo Presépio', codigo: 'NPR', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-5', nome: 'TOG - Túnel Ogival', codigo: 'TOG', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-6', nome: 'SGF - Sagrada Família', codigo: 'SGF', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-7', nome: 'JMB - José Maria e Burrinho', codigo: 'JMB', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-8', nome: 'Restauros Cascavel 2025', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-9', nome: 'Natal Foz do Iguaçu 2025', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-10', nome: 'Restauros Foz do Iguaçu 2025', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-11', nome: 'AVP - Árvore Pinheiro', codigo: 'AVP', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-12', nome: 'AJE - Anjo Ecológico', codigo: 'AJE', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-13', nome: 'FNE - Floco de Neve', codigo: 'FNE', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-14', nome: 'DFL - Domo Flor de Lotus', codigo: 'DFL', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-15', nome: 'CAP - Capivara', codigo: 'CAP', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-16', nome: 'BGU - Banco Guirlanda', codigo: 'BGU', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-17', nome: 'QUA - Quati', codigo: 'QUA', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-18', nome: 'CXL - Caixa de Presente com Laço', codigo: 'CXL', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-19', nome: 'COZ - COZINHA', codigo: 'COZ', ativo: true, dataCriacao: new Date().toISOString() },
          { id: 'loc-20', nome: 'USI - USINA MARIALVA', codigo: 'USI', ativo: true, dataCriacao: new Date().toISOString() },
        ];
        setLocaisUtilizacao(locaisDefault);
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

  // Subcategorias agora são gerenciadas no Supabase, não precisa salvar no localStorage

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

  // Solicitantes agora são gerenciados no Supabase, não precisa salvar no localStorage

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('locais-utilizacao-config', JSON.stringify(locaisUtilizacao));
    }
  }, [locaisUtilizacao, loading]);

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

  // Funções para gerenciar subcategorias no Supabase
  const adicionarSubcategoria = async (nome: string, categoria: string) => {
    try {
      const { data, error } = await supabase
        .from('subcategorias')
        .insert({
          nome,
          categoria,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const novaSubcategoria: SubcategoriaConfig = {
          id: data.id,
          nome: data.nome,
          categoria: data.categoria,
          ativo: data.ativo,
          dataCriacao: data.created_at,
        };

        setSubcategorias(prev => [...prev, novaSubcategoria]);
        
        toast({
          title: "Subcategoria criada!",
          description: `Subcategoria "${nome}" foi criada com sucesso.`,
        });

        return novaSubcategoria;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar subcategoria:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar a subcategoria.",
        variant: "destructive",
      });
    }
  };

  const removerSubcategoria = async (id: string) => {
    try {
      const { error } = await supabase
        .from('subcategorias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSubcategorias(prev => prev.filter(s => s.id !== id));
      
      toast({
        title: "Subcategoria removida!",
        description: "Subcategoria foi removida com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao remover subcategoria:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover a subcategoria.",
        variant: "destructive",
      });
    }
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

  // Funções para gerenciar solicitantes no Supabase
  const adicionarSolicitante = async (nome: string, codigoBarras?: string) => {
    try {
      const { data, error } = await supabase
        .from('solicitantes')
        .insert({
          nome,
          codigo_barras: codigoBarras || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const novoSolicitante: SolicitanteConfig = {
          id: data.id,
          nome: data.nome,
          codigoBarras: data.codigo_barras || undefined,
          ativo: data.ativo,
          dataCriacao: data.created_at,
        };

        setSolicitantes(prev => [...prev, novoSolicitante]);
        
        toast({
          title: "Solicitante cadastrado!",
          description: `Solicitante "${nome}" foi cadastrado com sucesso.`,
        });

        return novoSolicitante;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar solicitante:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar o solicitante.",
        variant: "destructive",
      });
    }
  };

  const removerSolicitante = async (id: string) => {
    try {
      const { error } = await supabase
        .from('solicitantes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSolicitantes(prev => prev.filter(s => s.id !== id));
      
      toast({
        title: "Solicitante removido!",
        description: "Solicitante foi removido com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao remover solicitante:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover o solicitante.",
        variant: "destructive",
      });
    }
  };

  // Funções para gerenciar locais de utilização
  const adicionarLocalUtilizacao = (nome: string, codigo?: string, descricao?: string) => {
    const novoLocal: LocalUtilizacaoConfig = {
      id: gerarId(),
      nome,
      codigo,
      descricao,
      ativo: true,
      dataCriacao: new Date().toISOString(),
    };

    setLocaisUtilizacao(prev => [...prev, novoLocal]);
    
    toast({
      title: "Local cadastrado!",
      description: `Local "${nome}" foi cadastrado com sucesso.`,
    });

    return novoLocal;
  };

  const removerLocalUtilizacao = (id: string) => {
    setLocaisUtilizacao(prev => prev.filter(l => l.id !== id));
    
    toast({
      title: "Local removido!",
      description: "Local foi removido com sucesso.",
    });
  };

  // Funções para obter dados filtrados
  const obterEstoquesAtivos = () => estoques.filter(e => e.ativo);
  const obterTiposServicoAtivos = () => tiposServico.filter(t => t.ativo);
  const obterSubcategoriasAtivas = () => subcategorias.filter(s => s.ativo);
  const obterTiposOperacaoAtivos = () => tiposOperacao.filter(t => t.ativo);
  const obterSolicitantesAtivos = () => solicitantes.filter(s => s.ativo);
  const obterLocaisUtilizacaoAtivos = () => locaisUtilizacao.filter(l => l.ativo);
  const obterEstoqueAtivoInfo = () => estoques.find(e => e.id === estoqueAtivo);

  return {
    estoques,
    tiposServico,
    subcategorias,
    tiposOperacao,
    solicitantes,
    locaisUtilizacao,
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
    adicionarSolicitante,
    removerSolicitante,
    adicionarLocalUtilizacao,
    removerLocalUtilizacao,
    obterEstoquesAtivos,
    obterTiposServicoAtivos,
    obterSubcategoriasAtivas,
    obterTiposOperacaoAtivos,
    obterSolicitantesAtivos,
    obterLocaisUtilizacaoAtivos,
    obterEstoqueAtivoInfo,
  };
};