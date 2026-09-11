import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useEstoque } from '@/hooks/useEstoque';
import { supabase } from '@/integrations/supabase/client';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { toast } from '@/hooks/use-toast';
import {
  createOperationId,
  listOfflineOperations,
  submitInventoryOperation,
  subscribeOfflineQueue,
} from '@/utils/offlineInventoryQueue';

// Tipo do retorno de useEstoque
type EstoqueContextType = ReturnType<typeof useEstoque>;

const EstoqueContext = createContext<EstoqueContextType | null>(null);

const itemToDbPayload = (item: any) => ({
  codigo_barras: Number(item.codigoBarras),
  codigo_antigo: item.codigoAntigo ?? '',
  origem: item.origem ?? '',
  caixa_organizador: item.caixaOrganizador ?? '',
  localizacao: item.localizacao ?? '',
  nome: item.nome,
  tipo_item: item.tipoItem,
  especificacao: item.especificacao ?? '',
  marca: item.marca ?? '',
  unidade: item.unidade,
  condicao: item.condicao ?? '',
  subcategoria_id: item.subcategoriaId ?? '',
  categoria_id: item.categoriaId ?? '',
  quantidade_minima: item.quantidadeMinima ?? '',
  ncm: item.ncm ?? '',
  valor: item.valor ?? '',
  foto_url: item.fotoUrl ?? '',
  ativo: item.ativo !== false,
});

export const EstoqueProvider = ({ children }: { children: React.ReactNode }) => {
  const estoque = useEstoque();
  const { obterEstoqueAtivoInfo, isEstoqueAtivoPrincipal } = useConfiguracoes();
  const carregarDadosRef = useRef(estoque.carregarDados);

  useEffect(() => {
    carregarDadosRef.current = estoque.carregarDados;
  }, [estoque.carregarDados]);

  useEffect(() => {
    const recarregar = () => {
      void carregarDadosRef.current(true);
    };

    const channel = supabase
      .channel('estoque-context-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movements' },
        recarregar,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'locais_utilizacao' },
        recarregar,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Quando uma operação protegida é sincronizada, atualiza a tela com o estado confirmado do servidor.
  useEffect(() => {
    return subscribeOfflineQueue(() => {
      if (navigator.onLine) {
        window.setTimeout(() => void carregarDadosRef.current(true), 250);
      }
    });
  }, []);

  const obterSaldoProjetado = async (itemId: string, estoqueId: string | null, saldoBanco: number) => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return saldoBanco;

    const pendentes = (await listOfflineOperations())
      .filter(op =>
        op.userId === userId &&
        op.status === 'pending' &&
        op.type === 'movement_insert' &&
        op.payload.item_id === itemId &&
        (op.payload.estoque_id || null) === estoqueId
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let saldo = saldoBanco;
    for (const op of pendentes) {
      const projetado = Number(op.payload.quantity_after_client);
      if (Number.isFinite(projetado)) saldo = projetado;
    }
    return saldo;
  };

  const editarItem: typeof estoque.editarItem = async (itemEditado) => {
    const atual = estoque.itens.find(item => item.id === itemEditado.id);
    if (!atual) {
      toast({ title: 'Item não encontrado', description: 'Atualize a tela e tente novamente.', variant: 'destructive' });
      return false;
    }

    const result = await submitInventoryOperation('item_update', {
      item_id: itemEditado.id,
      base: itemToDbPayload(atual),
      patch: itemToDbPayload(itemEditado),
      occurred_at: new Date().toISOString(),
    });

    if (!result.ok) {
      toast({
        title: result.status === 'conflict' ? 'Conflito de edição' : 'Erro ao editar',
        description: result.message || 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      });
      return false;
    }

    if (result.queued) {
      toast({
        title: 'Alteração protegida offline',
        description: 'A edição ficou salva neste dispositivo e será enviada automaticamente quando a conexão estabilizar.',
      });
      return true;
    }

    await estoque.carregarDados(true);
    toast({ title: 'Item atualizado!', description: `${itemEditado.nome} foi atualizado com sucesso.` });
    return true;
  };

  const cadastrarItem: typeof estoque.cadastrarItem = async (dadosItem) => {
    const codigoNumerico = dadosItem.codigoBarras && dadosItem.codigoBarras > 0
      ? dadosItem.codigoBarras
      : await estoque.obterProximoCodigoDisponivel();
    const itemId = createOperationId();
    const itemLocal = {
      ...dadosItem,
      id: itemId,
      codigoBarras: codigoNumerico,
      ativo: dadosItem.ativo !== false,
    };
    const estoqueInfo = obterEstoqueAtivoInfo();

    const result = await submitInventoryOperation('item_create', {
      item_id: itemId,
      estoque_id: estoqueInfo?.id ?? '',
      item: itemToDbPayload(itemLocal),
      client_item_snapshot: itemLocal,
      occurred_at: new Date().toISOString(),
    });

    if (!result.ok) {
      toast({ title: 'Erro ao cadastrar', description: result.message || 'Não foi possível cadastrar o item.', variant: 'destructive' });
      return false;
    }

    if (result.queued) {
      toast({
        title: 'Cadastro protegido offline',
        description: `O cadastro de ${dadosItem.nome} foi guardado neste dispositivo e será sincronizado automaticamente.`,
      });
      return true;
    }

    await estoque.carregarDados(true);
    toast({ title: 'Item cadastrado!', description: `${dadosItem.nome} foi cadastrado com sucesso.` });
    return true;
  };

  const registrarEntrada: typeof estoque.registrarEntrada = async (
    codigoBarras,
    quantidade,
    responsavel,
    observacoes,
    tipoOperacaoId,
  ) => {
    const item = estoque.buscarItemPorCodigo(codigoBarras);
    if (!item || !item.ativo) {
      toast({ title: 'Entrada não permitida', description: !item ? 'Item não encontrado.' : 'O item está inativo.', variant: 'destructive' });
      return false;
    }

    const estoqueInfo = obterEstoqueAtivoInfo();
    const saldoBanco = estoque.calcularEstoqueAtual(item.id);
    const saldoProjetado = await obterSaldoProjetado(item.id, estoqueInfo?.id ?? null, saldoBanco);
    const saldoAposCliente = saldoProjetado + quantidade;

    const result = await submitInventoryOperation('movement_insert', {
      item_id: item.id,
      tipo: 'ENTRADA',
      quantidade,
      expected_quantity_before: saldoProjetado,
      quantity_after_client: saldoAposCliente,
      estoque_id: estoqueInfo?.id ?? '',
      include_legacy_null: isEstoqueAtivoPrincipal(),
      observacoes: observacoes ?? '',
      responsavel,
      tipo_operacao_id: tipoOperacaoId ?? '',
      item_snapshot: item,
      occurred_at: new Date().toISOString(),
    });

    if (!result.ok) {
      toast({ title: result.status === 'conflict' ? 'Entrada requer revisão' : 'Erro na entrada', description: result.message || 'Não foi possível registrar a entrada.', variant: 'destructive' });
      return false;
    }

    if (result.queued) {
      toast({ title: 'Entrada protegida offline', description: 'A entrada foi guardada neste dispositivo e será lançada automaticamente no banco quando a conexão voltar.' });
      return true;
    }

    await estoque.carregarDados(true);
    toast({ title: 'Entrada registrada!', description: `Entrada de ${quantidade} ${item.unidade} de ${item.nome}.` });
    return true;
  };

  const registrarSaida: typeof estoque.registrarSaida = async (
    codigoBarras,
    quantidade,
    responsavel,
    observacoes,
    tipoOperacaoId,
    destinatario,
  ) => {
    const item = estoque.buscarItemPorCodigo(codigoBarras);
    if (!item || !item.ativo) {
      toast({ title: 'Saída não permitida', description: !item ? 'Item não encontrado.' : 'O item está inativo.', variant: 'destructive' });
      return false;
    }

    const estoqueInfo = obterEstoqueAtivoInfo();
    const saldoBanco = estoque.calcularEstoqueAtual(item.id);
    const saldoProjetado = await obterSaldoProjetado(item.id, estoqueInfo?.id ?? null, saldoBanco);
    if (saldoProjetado < quantidade) {
      toast({ title: 'Estoque insuficiente', description: `Saldo disponível/projetado: ${saldoProjetado} ${item.unidade}.`, variant: 'destructive' });
      return false;
    }
    if (item.tipoItem === 'Ferramenta' && quantidade > 1) {
      toast({ title: 'Quantidade inválida', description: 'Ferramentas devem ser retiradas individualmente.', variant: 'destructive' });
      return false;
    }

    const saldoAposCliente = saldoProjetado - quantidade;
    const result = await submitInventoryOperation('movement_insert', {
      item_id: item.id,
      tipo: 'SAIDA',
      quantidade,
      expected_quantity_before: saldoProjetado,
      quantity_after_client: saldoAposCliente,
      estoque_id: estoqueInfo?.id ?? '',
      include_legacy_null: isEstoqueAtivoPrincipal(),
      observacoes: observacoes ?? '',
      responsavel,
      tipo_operacao_id: tipoOperacaoId ?? '',
      destinatario: destinatario ?? '',
      item_snapshot: item,
      occurred_at: new Date().toISOString(),
    });

    if (!result.ok) {
      toast({ title: result.status === 'conflict' ? 'Saída requer revisão' : 'Erro na saída', description: result.message || 'Não foi possível registrar a saída.', variant: 'destructive' });
      return false;
    }

    if (result.queued) {
      toast({ title: 'Saída protegida offline', description: 'A saída foi guardada neste dispositivo e será lançada automaticamente quando a conexão voltar.' });
      return true;
    }

    await estoque.carregarDados(true);
    toast({ title: 'Saída registrada!', description: `Saída de ${quantidade} ${item.unidade} de ${item.nome}.` });
    return true;
  };

  const value: EstoqueContextType = {
    ...estoque,
    editarItem,
    cadastrarItem,
    registrarEntrada,
    registrarSaida,
  };

  return (
    <EstoqueContext.Provider value={value}>
      {children}
    </EstoqueContext.Provider>
  );
};

export const useEstoqueContext = (): EstoqueContextType => {
  const context = useContext(EstoqueContext);
  if (!context) {
    throw new Error('useEstoqueContext deve ser usado dentro de um EstoqueProvider');
  }
  return context;
};
