/**
 * Regras puras (sem acesso a banco) para montar a lista somente leitura de
 * "Materiais solicitados" de uma RC.
 *
 * Princípios:
 * - Os itens formais da RC (pedido_compra_itens) são sempre a base.
 * - Solicitação de material e PN só COMPLEMENTAM campos vazios de itens
 *   da RC que casem (mesmo item_id ou mesmo nome normalizado).
 * - Itens da solicitação que não casam com a RC NUNCA são adicionados quando
 *   a RC já tem itens formais (a solicitação pode ter itens atendidos pelo
 *   estoque ou por outra RC).
 * - Só quando a RC não tem itens formais é que itens são recuperados da PN
 *   vinculada ou, em último caso, dos itens da solicitação marcados para compra.
 */

export type FonteMaterial = 'rc' | 'pn' | 'solicitacao';

export interface ItemRcEntrada {
  id: string;
  item_id: string | null;
  nome_item?: string | null;
  quantidade: number | string | null;
  item_snapshot?: Record<string, unknown> | null;
}

export interface ItemSolicitacaoEntrada {
  id: string;
  item_id: string | null;
  nome_item: string | null;
  quantidade: number | string | null;
  unidade: string | null;
  especificacao: string | null;
  observacoes: string | null;
  destino_atendimento: string | null;
  item_snapshot?: Record<string, unknown> | null;
}

export interface ItemPnEntrada {
  id: string;
  item_id: string | null;
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | string | null;
  unidade: string | null;
  ordem?: number | null;
  item_snapshot?: Record<string, unknown> | null;
}

export interface PnEntrada {
  id: string;
  numero: number | null;
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | string | null;
  unidade: string | null;
  item_id: string | null;
  solicitacao_material_item_id: string | null;
}

export interface MaterialSolicitado {
  chave: string;
  nome: string | null;
  codigo: string | null;
  quantidade: number | null;
  unidade: string | null;
  especificacao: string | null;
  observacoes: string | null;
  fonte: FonteMaterial;
  complementadoPor: FonteMaterial[];
}

export interface ResultadoMateriais {
  materiais: MaterialSolicitado[];
  /** Origem principal da lista exibida. null = nenhum item disponível. */
  fontePrincipal: FonteMaterial | null;
  /** Itens da solicitação que não fazem parte desta RC (apenas contagem informativa). */
  itensSolicitacaoForaDaRc: number;
  avisos: string[];
}

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const normalizarNome = (v: unknown): string =>
  (texto(v) || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const snap = (s: Record<string, unknown> | null | undefined) => s || {};

interface Candidato {
  chave: string;
  fonte: FonteMaterial;
  item_id: string | null;
  nome: string | null;
  codigo: string | null;
  quantidade: number | null;
  unidade: string | null;
  especificacao: string | null;
  observacoes: string | null;
}

const candidatoDeSolicitacao = (i: ItemSolicitacaoEntrada): Candidato => {
  const s = snap(i.item_snapshot);
  return {
    chave: `sm-${i.id}`,
    fonte: 'solicitacao',
    item_id: i.item_id,
    nome: texto(i.nome_item) || texto(s.nome),
    codigo: texto(s.codigoBarras) || texto(s.codigo_item),
    quantidade: numero(i.quantidade),
    unidade: texto(i.unidade) || texto(s.unidade),
    especificacao: texto(i.especificacao) || texto(s.especificacao),
    observacoes: texto(i.observacoes),
  };
};

const candidatoDePnItem = (i: ItemPnEntrada): Candidato => {
  const s = snap(i.item_snapshot);
  return {
    chave: `pni-${i.id}`,
    fonte: 'pn',
    item_id: i.item_id,
    nome: texto(i.descricao) || texto(s.nome),
    codigo: texto(s.codigoBarras) || texto(s.codigo_item),
    quantidade: numero(i.quantidade),
    unidade: texto(i.unidade) || texto(s.unidade),
    especificacao: texto(i.especificacao) || texto(s.especificacao),
    observacoes: null,
  };
};

/** Descrições automáticas de PN vêm como "PN da Solicitação #109 - NOME" ou "RC #49 - NOME". */
const nomeDaDescricaoPn = (descricao: string | null): string | null => {
  const d = texto(descricao);
  if (!d) return null;
  const m = d.match(/^(?:PN da Solicita[çc][ãa]o\s*#\d+|RC\s*#\d+)\s*-\s*(.+)$/i);
  return texto(m ? m[1] : d);
};

const candidatoDePnCabecalho = (pn: PnEntrada): Candidato | null => {
  const nome = nomeDaDescricaoPn(pn.descricao);
  if (!nome) return null;
  return {
    chave: `pn-${pn.id}`,
    fonte: 'pn',
    item_id: pn.item_id,
    nome,
    codigo: null,
    quantidade: numero(pn.quantidade),
    unidade: texto(pn.unidade),
    especificacao: texto(pn.especificacao),
    observacoes: null,
  };
};

const casa = (a: { item_id: string | null; nome: string | null }, b: Candidato) => {
  if (a.item_id && b.item_id) return a.item_id === b.item_id;
  const na = normalizarNome(a.nome);
  return na.length > 0 && na === normalizarNome(b.nome);
};

const paraMaterial = (c: Candidato): MaterialSolicitado => ({
  chave: c.chave,
  nome: c.nome,
  codigo: c.codigo,
  quantidade: c.quantidade,
  unidade: c.unidade,
  especificacao: c.especificacao,
  observacoes: c.observacoes,
  fonte: c.fonte,
  complementadoPor: [],
});

export interface EntradaMontagem {
  itensRc: ItemRcEntrada[];
  itensSolicitacao: ItemSolicitacaoEntrada[];
  pn: PnEntrada | null;
  itensPn: ItemPnEntrada[];
  /** Item específico da solicitação apontado pela PN (financeiro_necessidades.solicitacao_material_item_id). */
  itemSolicitacaoDaPn: ItemSolicitacaoEntrada | null;
  /** Quantidade de outras RCs que apontam para a mesma solicitação. */
  outrasRcsMesmaSolicitacao: number;
}

export const montarMateriaisSolicitados = (e: EntradaMontagem): ResultadoMateriais => {
  const avisos: string[] = [];
  const candidatosSm = e.itensSolicitacao.map(candidatoDeSolicitacao);
  const candidatosPn: Candidato[] = [
    ...e.itensPn.map(candidatoDePnItem),
    ...(e.itemSolicitacaoDaPn ? [candidatoDeSolicitacao(e.itemSolicitacaoDaPn)] : []),
  ];
  const cabecalhoPn = e.pn ? candidatoDePnCabecalho(e.pn) : null;

  // 1) RC com itens formais: base é a RC; demais documentos só complementam.
  if (e.itensRc.length > 0) {
    const usadosSm = new Set<string>();
    const materiais = e.itensRc.map((item): MaterialSolicitado => {
      const s = snap(item.item_snapshot);
      const base = {
        item_id: item.item_id,
        nome: texto(s.nome) || texto(item.nome_item),
      };
      const m: MaterialSolicitado = {
        chave: `rc-${item.id}`,
        nome: base.nome,
        codigo: texto(s.codigoBarras) || texto(s.codigo_item),
        quantidade: numero(item.quantidade),
        unidade: texto(s.unidade),
        especificacao: texto(s.especificacao),
        observacoes: texto(s.observacoes),
        fonte: 'rc',
        complementadoPor: [],
      };
      const fontesComplemento: Candidato[] = [];
      const pnMatch = candidatosPn.find(c => casa(base, c));
      if (pnMatch) fontesComplemento.push(pnMatch);
      else if (cabecalhoPn && e.itensRc.length === 1 && casa(base, cabecalhoPn)) fontesComplemento.push(cabecalhoPn);
      const smMatch = candidatosSm.find(c => !usadosSm.has(c.chave) && casa(base, c));
      if (smMatch) {
        usadosSm.add(smMatch.chave);
        fontesComplemento.push(smMatch);
      }
      for (const c of fontesComplemento) {
        let usou = false;
        if (!m.nome && c.nome) { m.nome = c.nome; usou = true; }
        if (!m.codigo && c.codigo) { m.codigo = c.codigo; usou = true; }
        if (!m.unidade && c.unidade) { m.unidade = c.unidade; usou = true; }
        if (!m.especificacao && c.especificacao) { m.especificacao = c.especificacao; usou = true; }
        if (!m.observacoes && c.observacoes) { m.observacoes = c.observacoes; usou = true; }
        if (m.quantidade === null && c.quantidade !== null) { m.quantidade = c.quantidade; usou = true; }
        if (usou && !m.complementadoPor.includes(c.fonte)) m.complementadoPor.push(c.fonte);
      }
      return m;
    });
    return {
      materiais,
      fontePrincipal: 'rc',
      itensSolicitacaoForaDaRc: candidatosSm.filter(c => !usadosSm.has(c.chave)).length,
      avisos,
    };
  }

  // 2) RC sem itens formais: recuperar pela PN vinculada (itens específicos da PN).
  if (candidatosPn.length > 0) {
    return { materiais: candidatosPn.map(paraMaterial), fontePrincipal: 'pn', itensSolicitacaoForaDaRc: 0, avisos };
  }
  if (cabecalhoPn) {
    return { materiais: [paraMaterial(cabecalhoPn)], fontePrincipal: 'pn', itensSolicitacaoForaDaRc: 0, avisos };
  }

  // 3) Último recurso: itens da solicitação marcados para compra.
  if (candidatosSm.length > 0) {
    const paraCompra = e.itensSolicitacao.filter(i => i.destino_atendimento === 'pn').map(candidatoDeSolicitacao);
    if (paraCompra.length === 0) {
      avisos.push(
        `A solicitação de origem tem ${candidatosSm.length} item(ns), mas nenhum está marcado para compra. Não é possível confirmar quais pertencem a esta RC.`,
      );
      return { materiais: [], fontePrincipal: null, itensSolicitacaoForaDaRc: candidatosSm.length, avisos };
    }
    if (e.outrasRcsMesmaSolicitacao > 0) {
      avisos.push(
        `Existem outras ${e.outrasRcsMesmaSolicitacao} RC(s) ligadas à mesma solicitação. Os itens abaixo podem estar divididos entre elas.`,
      );
    }
    return {
      materiais: paraCompra.map(paraMaterial),
      fontePrincipal: 'solicitacao',
      itensSolicitacaoForaDaRc: candidatosSm.length - paraCompra.length,
      avisos,
    };
  }

  return { materiais: [], fontePrincipal: null, itensSolicitacaoForaDaRc: 0, avisos };
};
