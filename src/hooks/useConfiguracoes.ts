import { useState, useEffect } from 'react';
import { EstoqueConfig, TipoServicoConfig, SubcategoriaConfig } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface TipoOperacaoConfig {
  id: string;
  nome: string;
  descricao?: string;
  tipo: 'entrada' | 'saida';
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

  // Carregar estoques do Supabase
  const carregarEstoques = async () => {
    try {
      const { data, error } = await supabase
        .from('estoques')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const estoquesCarregados = data.map(e => ({
          id: e.id,
          nome: e.nome,
          descricao: e.descricao || undefined,
          ativo: e.ativo,
          dataCriacao: e.created_at,
        }));
        setEstoques(estoquesCarregados);
        
        // Se não há estoque ativo salvo ou o estoque ativo não existe mais, definir o primeiro como ativo
        const estoqueAtivoSalvo = localStorage.getItem('estoque-ativo');
        if (!estoqueAtivoSalvo || !estoquesCarregados.find(e => e.id === estoqueAtivoSalvo)) {
          if (estoquesCarregados.length > 0) {
            setEstoqueAtivo(estoquesCarregados[0].id);
          }
        } else {
          setEstoqueAtivo(estoqueAtivoSalvo);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar estoques:', error);
      toast({
        title: "Erro ao carregar estoques",
        description: error.message || "Não foi possível carregar os estoques.",
        variant: "destructive",
      });
    }
  };

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

  // Carregar locais de utilização do Supabase
  const carregarLocaisUtilizacao = async () => {
    try {
      const { data, error } = await supabase
        .from('locais_utilizacao')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setLocaisUtilizacao(data.map(l => ({
          id: l.id,
          nome: l.nome,
          ativo: l.ativo,
          dataCriacao: l.created_at,
        })));
      }
    } catch (error: any) {
      console.error('Erro ao carregar locais de utilização:', error);
      toast({
        title: "Erro ao carregar locais",
        description: error.message || "Não foi possível carregar os locais de utilização.",
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

  // Carregar tipos de operação do Supabase
  const carregarTiposOperacao = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_operacao')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setTiposOperacao(data.map(t => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao || undefined,
          tipo: t.tipo as 'entrada' | 'saida',
          ativo: t.ativo,
          dataCriacao: t.created_at,
        })));
      }
    } catch (error: any) {
      console.error('Erro ao carregar tipos de operação:', error);
      toast({
        title: "Erro ao carregar operações",
        description: error.message || "Não foi possível carregar os tipos de operação.",
        variant: "destructive",
      });
    }
  };

  // Carregar dados do localStorage e Supabase
  useEffect(() => {
    const inicializarDados = async () => {
      try {
        const tiposServicoSalvos = localStorage.getItem('tipos-servico-config');

        // Carregar estoques do Supabase
        await carregarEstoques();

        if (tiposServicoSalvos) {
          setTiposServico(JSON.parse(tiposServicoSalvos));
        }

        // Carregar subcategorias do Supabase
        carregarSubcategorias();

        // Carregar tipos de operação do Supabase
        carregarTiposOperacao();

        // Carregar solicitantes do Supabase
        carregarSolicitantes();

        // Carregar locais de utilização do Supabase
        carregarLocaisUtilizacao();
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
    };

    inicializarDados();
  }, []);

  // Estoques agora são gerenciados no Supabase, não precisa salvar no localStorage

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

  // Tipos de operação, solicitantes e locais agora são gerenciados no Supabase, não precisa salvar no localStorage

  // Funções para gerar ID único
  const gerarId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Funções para gerenciar estoques no Supabase
  const adicionarEstoque = async (nome: string, descricao?: string) => {
    try {
      const { data, error } = await supabase
        .from('estoques')
        .insert({
          nome,
          descricao: descricao || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const novoEstoque: EstoqueConfig = {
          id: data.id,
          nome: data.nome,
          descricao: data.descricao || undefined,
          ativo: data.ativo,
          dataCriacao: data.created_at,
        };

        setEstoques(prev => [...prev, novoEstoque]);
        
        toast({
          title: "Almoxarifado criado!",
          description: `Almoxarifado "${nome}" foi criado com sucesso.`,
        });

        return novoEstoque;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar almoxarifado:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar o almoxarifado.",
        variant: "destructive",
      });
    }
  };

  const removerEstoque = async (id: string) => {
    if (estoques.length === 1) {
      toast({
        title: "Erro",
        description: "Não é possível remover o último almoxarifado.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('estoques')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (estoqueAtivo === id) {
        const outroEstoque = estoques.find(e => e.id !== id);
        if (outroEstoque) {
          setEstoqueAtivo(outroEstoque.id);
        }
      }

      setEstoques(prev => prev.filter(e => e.id !== id));
      
      toast({
        title: "Almoxarifado removido!",
        description: "Almoxarifado foi removido com sucesso.",
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao remover almoxarifado:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover o almoxarifado.",
        variant: "destructive",
      });
      return false;
    }
  };

  const alterarEstoqueAtivo = (id: string) => {
    const estoque = estoques.find(e => e.id === id);
    if (estoque) {
      setEstoqueAtivo(id);
      toast({
        title: "Almoxarifado alterado!",
        description: `Almoxarifado ativo: ${estoque.nome}`,
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

  // Funções para gerenciar tipos de operação no Supabase
  const adicionarTipoOperacao = async (nome: string, tipo: 'entrada' | 'saida', descricao?: string) => {
    try {
      const { data, error } = await supabase
        .from('tipos_operacao')
        .insert({
          nome,
          tipo,
          descricao: descricao || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const novoTipo: TipoOperacaoConfig = {
          id: data.id,
          nome: data.nome,
          descricao: data.descricao || undefined,
          tipo: data.tipo as 'entrada' | 'saida',
          ativo: data.ativo,
          dataCriacao: data.created_at,
        };

        setTiposOperacao(prev => [...prev, novoTipo]);
        
        toast({
          title: "Operação criada!",
          description: `Operação "${nome}" foi criada com sucesso.`,
        });

        return novoTipo;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar operação:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar a operação.",
        variant: "destructive",
      });
    }
  };

  const editarTipoOperacao = async (id: string, nome: string, tipo: 'entrada' | 'saida', descricao?: string) => {
    try {
      const { data, error } = await supabase
        .from('tipos_operacao')
        .update({
          nome,
          tipo,
          descricao: descricao || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTiposOperacao(prev => prev.map(t => 
          t.id === id 
            ? {
                id: data.id,
                nome: data.nome,
                descricao: data.descricao || undefined,
                tipo: data.tipo as 'entrada' | 'saida',
                ativo: data.ativo,
                dataCriacao: data.created_at,
              }
            : t
        ));
        
        toast({
          title: "Operação atualizada!",
          description: `Operação "${nome}" foi atualizada com sucesso.`,
        });

        return true;
      }
    } catch (error: any) {
      console.error('Erro ao editar operação:', error);
      toast({
        title: "Erro ao editar",
        description: error.message || "Não foi possível editar a operação.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removerTipoOperacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tipos_operacao')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTiposOperacao(prev => prev.filter(t => t.id !== id));
      
      toast({
        title: "Operação removida!",
        description: "Operação foi removida com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao remover operação:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover a operação.",
        variant: "destructive",
      });
    }
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

  // Funções para gerenciar locais de utilização no Supabase
  const adicionarLocalUtilizacao = async (nome: string) => {
    try {
      const { data, error } = await supabase
        .from('locais_utilizacao')
        .insert({
          nome,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const novoLocal: LocalUtilizacaoConfig = {
          id: data.id,
          nome: data.nome,
          ativo: data.ativo,
          dataCriacao: data.created_at,
        };

        setLocaisUtilizacao(prev => [...prev, novoLocal]);
        
        toast({
          title: "Local cadastrado!",
          description: `Local "${nome}" foi cadastrado com sucesso.`,
        });

        return novoLocal;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar local:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar o local.",
        variant: "destructive",
      });
    }
  };

  const removerLocalUtilizacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('locais_utilizacao')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLocaisUtilizacao(prev => prev.filter(l => l.id !== id));
      
      toast({
        title: "Local removido!",
        description: "Local foi removido com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao remover local:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover o local.",
        variant: "destructive",
      });
    }
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
    editarTipoOperacao,
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