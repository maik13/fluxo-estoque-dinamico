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
  created_at: string;
}

export interface SolicitanteConfig {
  id: string;
  nome: string;
  codigoBarras?: string;
  ativo: boolean;
  created_at: string;
}

export interface LocalUtilizacaoConfig {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface CategoriaConfig {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface CategoriaSubcategoriaRelacao {
  id: string;
  categoria_id: string;
  subcategoria_id: string;
  created_at: string;
}

export const useConfiguracoes = () => {
  const [estoques, setEstoques] = useState<EstoqueConfig[]>([]);
  const [tiposServico, setTiposServico] = useState<TipoServicoConfig[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaConfig[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConfig[]>([]);
  const [categoriasSubcategorias, setCategoriasSubcategorias] = useState<CategoriaSubcategoriaRelacao[]>([]);
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
          created_at: e.created_at,
        }));
        setEstoques(estoquesCarregados);
        
        // Sempre definir "almoxarifado principal" como estoque ativo ao abrir o app
        const almoxarifadoPrincipal = estoquesCarregados.find(
          e => e.nome.toLowerCase() === 'almoxarifado principal'
        );
        
        if (almoxarifadoPrincipal) {
          setEstoqueAtivo(almoxarifadoPrincipal.id);
        } else if (estoquesCarregados.length > 0) {
          // Fallback: usar o primeiro estoque se "almoxarifado principal" não existir
          setEstoqueAtivo(estoquesCarregados[0].id);
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
          created_at: s.created_at,
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
          created_at: l.created_at,
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

  // Carregar categorias do Supabase
  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setCategorias(data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: "Erro ao carregar categorias",
        description: error.message || "Não foi possível carregar as categorias.",
        variant: "destructive",
      });
    }
  };

  //Carregar relacionamentos categoria-subcategoria do Supabase
  const carregarCategoriasSubcategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categoria_subcategoria')
        .select('*');

      if (error) throw error;
      
      if (data) {
        setCategoriasSubcategorias(data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar relacionamentos:', error);
      toast({
        title: "Erro ao carregar relacionamentos",
        description: error.message || "Não foi possível carregar os relacionamentos.",
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
          ativo: s.ativo,
          created_at: s.created_at,
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
          created_at: t.created_at,
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

        // Carregar categorias, subcategorias e relacionamentos do Supabase
        await carregarCategorias();
        await carregarSubcategorias();
        await carregarCategoriasSubcategorias();

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

  // Real-time updates para todas as configurações
  useEffect(() => {
    const estoquesChannel = supabase
      .channel('estoques-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoques' }, () => {
        carregarEstoques();
      })
      .subscribe();

    const categoriasChannel = supabase
      .channel('categorias-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => {
        carregarCategorias();
      })
      .subscribe();

    const subcategoriasChannel = supabase
      .channel('subcategorias-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcategorias' }, () => {
        carregarSubcategorias();
      })
      .subscribe();

    const categoriasSubcategoriasChannel = supabase
      .channel('categoria-subcategoria-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categoria_subcategoria' }, () => {
        carregarCategoriasSubcategorias();
      })
      .subscribe();

    const tiposOperacaoChannel = supabase
      .channel('tipos-operacao-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tipos_operacao' }, () => {
        carregarTiposOperacao();
      })
      .subscribe();

    const solicitantesChannel = supabase
      .channel('solicitantes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitantes' }, () => {
        carregarSolicitantes();
      })
      .subscribe();

    const locaisChannel = supabase
      .channel('locais-utilizacao-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locais_utilizacao' }, () => {
        carregarLocaisUtilizacao();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(estoquesChannel);
      supabase.removeChannel(categoriasChannel);
      supabase.removeChannel(subcategoriasChannel);
      supabase.removeChannel(categoriasSubcategoriasChannel);
      supabase.removeChannel(tiposOperacaoChannel);
      supabase.removeChannel(solicitantesChannel);
      supabase.removeChannel(locaisChannel);
    };
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
          created_at: data.created_at,
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
      created_at: new Date().toISOString(),
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

  // Funções para gerenciar categorias no Supabase
  const adicionarCategoria = async (nome: string) => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .insert({
          nome,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCategorias(prev => [...prev, data]);
        await carregarCategoriasSubcategorias(); // Recarregar relacionamentos
        
        toast({
          title: "Categoria criada!",
          description: `Categoria "${nome}" foi criada com sucesso.`,
        });

        return data;
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar categoria:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar a categoria.",
        variant: "destructive",
      });
    }
  };

  const removerCategoria = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategorias(prev => prev.filter(c => c.id !== id));
      
      toast({
        title: "Categoria removida!",
        description: "Categoria foi removida com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao remover categoria:', error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover a categoria.",
        variant: "destructive",
      });
    }
  };

  // Funções para gerenciar subcategorias no Supabase
  const adicionarSubcategoria = async (nome: string, categoriaIds: string[]) => {
    try {
      // 1. Criar a subcategoria
      const { data: subData, error: subError } = await supabase
        .from('subcategorias')
        .insert({
          nome,
          ativo: true,
        })
        .select()
        .single();

      if (subError) throw subError;

      if (subData) {
        const novaSubcategoria: SubcategoriaConfig = {
          id: subData.id,
          nome: subData.nome,
          ativo: subData.ativo,
          created_at: subData.created_at,
        };

        // 2. Criar relacionamentos com categorias
        if (categoriaIds.length > 0) {
          const relacionamentos = categoriaIds.map(catId => ({
            categoria_id: catId,
            subcategoria_id: subData.id,
          }));

          const { error: relError } = await supabase
            .from('categoria_subcategoria')
            .insert(relacionamentos);

          if (relError) throw relError;
        }

        setSubcategorias(prev => [...prev, novaSubcategoria]);
        await carregarCategoriasSubcategorias(); // Recarregar relacionamentos
        
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

  const editarSubcategoria = async (id: string, nome: string) => {
    try {
      const { error } = await supabase
        .from('subcategorias')
        .update({ nome, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setSubcategorias(prev =>
        prev.map(s => s.id === id ? { ...s, nome } : s)
      );

      toast({
        title: "Subcategoria editada",
        description: "A subcategoria foi atualizada com sucesso.",
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao editar subcategoria:', error);
      toast({
        title: "Erro ao editar",
        description: error.message || "Não foi possível editar a subcategoria.",
        variant: "destructive",
      });
      return false;
    }
  };

  const vincularSubcategoriaACategorias = async (subcategoriaId: string, categoriaIds: string[]) => {
    try {
      // 1. Remover vínculos existentes
      const { error: deleteError } = await supabase
        .from('categoria_subcategoria')
        .delete()
        .eq('subcategoria_id', subcategoriaId);

      if (deleteError) throw deleteError;

      // 2. Criar novos vínculos
      if (categoriaIds.length > 0) {
        const relacionamentos = categoriaIds.map(catId => ({
          categoria_id: catId,
          subcategoria_id: subcategoriaId,
        }));

        const { error: insertError } = await supabase
          .from('categoria_subcategoria')
          .insert(relacionamentos);

        if (insertError) throw insertError;
      }

      await carregarCategoriasSubcategorias(); // Recarregar relacionamentos
      
      toast({
        title: "Categorias atualizadas!",
        description: "As categorias da subcategoria foram atualizadas com sucesso.",
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao vincular categorias:', error);
      toast({
        title: "Erro ao vincular",
        description: error.message || "Não foi possível vincular as categorias.",
        variant: "destructive",
      });
      return false;
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
          created_at: data.created_at,
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
                created_at: data.created_at,
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
  const editarSolicitante = async (id: string, nome: string, codigoBarras?: string) => {
    try {
      const { data, error } = await supabase
        .from('solicitantes')
        .update({
          nome,
          codigo_barras: codigoBarras || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSolicitantes(prev => prev.map(s => 
          s.id === id 
            ? {
                id: data.id,
                nome: data.nome,
                codigoBarras: data.codigo_barras || undefined,
                ativo: data.ativo,
                created_at: data.created_at,
              }
            : s
        ));
        
        toast({
          title: "Solicitante atualizado!",
          description: `Solicitante "${nome}" foi atualizado com sucesso.`,
        });

        return true;
      }
    } catch (error: any) {
      console.error('Erro ao editar solicitante:', error);
      toast({
        title: "Erro ao editar",
        description: error.message || "Não foi possível editar o solicitante.",
        variant: "destructive",
      });
      return false;
    }
  };

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
          created_at: data.created_at,
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
  const editarLocalUtilizacao = async (id: string, nome: string) => {
    try {
      const { data, error } = await supabase
        .from('locais_utilizacao')
        .update({
          nome,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setLocaisUtilizacao(prev => prev.map(l => 
          l.id === id 
            ? {
                id: data.id,
                nome: data.nome,
                ativo: data.ativo,
                created_at: data.created_at,
              }
            : l
        ));
        
        toast({
          title: "Local atualizado!",
          description: `Local "${nome}" foi atualizado com sucesso.`,
        });

        return true;
      }
    } catch (error: any) {
      console.error('Erro ao editar local:', error);
      toast({
        title: "Erro ao editar",
        description: error.message || "Não foi possível editar o local.",
        variant: "destructive",
      });
      return false;
    }
  };

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
          created_at: data.created_at,
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
  const obterCategoriasAtivas = () => categorias.filter(c => c.ativo);
  const obterCategoriasUnicas = () => {
    return categorias.filter(c => c.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  };
  
  const obterCategoriasDaSubcategoria = (subcategoriaId: string) => {
    const relacoes = categoriasSubcategorias.filter(r => r.subcategoria_id === subcategoriaId);
    const catIds = relacoes.map(r => r.categoria_id);
    return categorias.filter(c => catIds.includes(c.id));
  };

  const obterSubcategoriasDaCategoria = (categoriaId: string) => {
    const relacoes = categoriasSubcategorias.filter(r => r.categoria_id === categoriaId);
    const subIds = relacoes.map(r => r.subcategoria_id);
    return subcategorias.filter(s => subIds.includes(s.id) && s.ativo);
  };

  const obterSubcategoriasPorCategoria = (categoriaNome: string) => {
    const categoria = categorias.find(c => c.nome === categoriaNome);
    if (!categoria) return [];
    return obterSubcategoriasDaCategoria(categoria.id);
  };

  const obterPrimeiraCategoriaDeSubcategoria = (subcategoriaId: string) => {
    const cats = obterCategoriasDaSubcategoria(subcategoriaId);
    return cats.length > 0 ? cats[0].nome : '';
  };

  const obterTiposOperacaoAtivos = () => tiposOperacao.filter(t => t.ativo);
  const obterSolicitantesAtivos = () => solicitantes.filter(s => s.ativo);
  const obterLocaisUtilizacaoAtivos = () => locaisUtilizacao.filter(l => l.ativo);
  const obterEstoqueAtivoInfo = () => estoques.find(e => e.id === estoqueAtivo);

  return {
    estoques,
    tiposServico,
    subcategorias,
    categorias,
    categoriasSubcategorias,
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
    adicionarCategoria,
    removerCategoria,
    adicionarSubcategoria,
    editarSubcategoria,
    vincularSubcategoriaACategorias,
    removerSubcategoria,
    adicionarTipoOperacao,
    editarTipoOperacao,
    removerTipoOperacao,
    adicionarSolicitante,
    editarSolicitante,
    removerSolicitante,
    adicionarLocalUtilizacao,
    editarLocalUtilizacao,
    removerLocalUtilizacao,
    obterEstoquesAtivos,
    obterTiposServicoAtivos,
    obterSubcategoriasAtivas,
    obterCategoriasAtivas,
    obterCategoriasUnicas,
    obterCategoriasDaSubcategoria,
    obterSubcategoriasDaCategoria,
    obterSubcategoriasPorCategoria,
    obterPrimeiraCategoriaDeSubcategoria,
    obterTiposOperacaoAtivos,
    obterSolicitantesAtivos,
    obterLocaisUtilizacaoAtivos,
    obterEstoqueAtivoInfo,
  };
};