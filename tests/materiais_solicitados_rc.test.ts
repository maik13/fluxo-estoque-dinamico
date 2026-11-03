import { describe, expect, it } from 'vitest';
import {
  montarMateriaisSolicitados,
  type EntradaMontagem,
  type ItemSolicitacaoEntrada,
} from '@/components/gestao-estoque/materiaisSolicitadosRc';

const itemSm = (p: Partial<ItemSolicitacaoEntrada> & { id: string; nome_item: string }): ItemSolicitacaoEntrada => ({
  item_id: null, quantidade: 1, unidade: 'un', especificacao: null, observacoes: null, destino_atendimento: 'estoque', item_snapshot: null, ...p,
});

const base = (p: Partial<EntradaMontagem>): EntradaMontagem => ({
  itensRc: [], itensSolicitacao: [], pn: null, itensPn: [], itemSolicitacaoDaPn: null, outrasRcsMesmaSolicitacao: 0, ...p,
});

describe('Materiais solicitados da RC', () => {
  it('RC com itens próprios não recebe itens extras da solicitação (ex.: RC #41 com 1 item e solicitação com 7)', () => {
    const r = montarMateriaisSolicitados(base({
      itensRc: [{ id: 'rc1', item_id: null, nome_item: '1 metro de areia', quantidade: 1, item_snapshot: { nome: '1 metro de areia', unidade: 'un' } }],
      itensSolicitacao: [
        itemSm({ id: 's1', nome_item: 'ENXADA', item_id: 'enx' }),
        itemSm({ id: 's2', nome_item: 'CIMENTO 50 KG', item_id: 'cim', quantidade: 2 }),
        itemSm({ id: 's3', nome_item: '1 metro de areia', destino_atendimento: 'pn', observacoes: 'entregar na obra' }),
      ],
    }));
    expect(r.fontePrincipal).toBe('rc');
    expect(r.materiais).toHaveLength(1);
    expect(r.materiais[0].nome).toBe('1 metro de areia');
    expect(r.itensSolicitacaoForaDaRc).toBe(2);
  });

  it('completa só campos vazios do item da RC com o item correspondente da solicitação', () => {
    const r = montarMateriaisSolicitados(base({
      itensRc: [{ id: 'rc1', item_id: 'tinta', quantidade: 4, item_snapshot: { nome: 'TINTA C2', unidade: 'LITRO' } }],
      itensSolicitacao: [itemSm({ id: 's1', nome_item: 'TINTA C2', item_id: 'tinta', quantidade: 9, unidade: 'GL', especificacao: 'cor taco' })],
    }));
    expect(r.materiais[0].quantidade).toBe(4);
    expect(r.materiais[0].unidade).toBe('LITRO');
    expect(r.materiais[0].especificacao).toBe('cor taco');
    expect(r.materiais[0].complementadoPor).toEqual(['solicitacao']);
  });

  it('RC sem itens recupera apenas os itens da solicitação marcados para compra (ex.: RC #16)', () => {
    const r = montarMateriaisSolicitados(base({
      itensSolicitacao: [
        itemSm({ id: 's1', nome_item: 'REPINBOCA', destino_atendimento: 'pn' }),
        itemSm({ id: 's2', nome_item: 'SPRAY LATA GRAXA BRANCA', destino_atendimento: 'estoque' }),
      ],
    }));
    expect(r.fontePrincipal).toBe('solicitacao');
    expect(r.materiais.map(m => m.nome)).toEqual(['REPINBOCA']);
  });

  it('RC sem itens e solicitação sem item marcado para compra não mostra itens', () => {
    const r = montarMateriaisSolicitados(base({ itensSolicitacao: [itemSm({ id: 's1', nome_item: 'ENXADA' })] }));
    expect(r.materiais).toHaveLength(0);
    expect(r.fontePrincipal).toBeNull();
  });

  it('RC sem itens com PN usa o item específico da solicitação apontado pela PN', () => {
    const alvo = itemSm({ id: 's2', nome_item: 'MARTELO', destino_atendimento: 'pn' });
    const r = montarMateriaisSolicitados(base({
      itensSolicitacao: [itemSm({ id: 's1', nome_item: 'ALICATE', destino_atendimento: 'pn' }), alvo],
      pn: { id: 'pn1', numero: 164, descricao: 'PN da Solicitação #109 - MARTELO', especificacao: null, quantidade: 1, unidade: 'UN', item_id: null, solicitacao_material_item_id: 's2' },
      itemSolicitacaoDaPn: alvo,
    }));
    expect(r.fontePrincipal).toBe('pn');
    expect(r.materiais.map(m => m.nome)).toEqual(['MARTELO']);
  });

  it('RC manual sem itens e sem vínculos fica vazia', () => {
    const r = montarMateriaisSolicitados(base({}));
    expect(r.materiais).toHaveLength(0);
    expect(r.fontePrincipal).toBeNull();
  });
});
