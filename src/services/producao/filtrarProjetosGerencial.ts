export interface ProjetoGerencialFiltravel {
  projeto_id: string; projeto_nome: string; cidade?: string | null;
  horas_homem: number; percentual_realizado: number; consumo_tinta_ml: number;
  custo_materiais: number | null; ops_total: number;
  etapas: { status: string; ordens: { status: string; quantidade_realizada: number }[] }[];
}
export type SituacaoGerencial = 'todos' | 'em_andamento' | 'com_registros';
export const chaveCidade = (cidade?: string | null) => cidade?.trim()
  ? cidade.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  : '__sem_cidade__';
export const projetoEmAndamento = (p: ProjetoGerencialFiltravel) =>
  p.etapas.some((e) => e.status === 'em_andamento' || e.ordens.some((op) => op.status === 'em_execucao'));
export const projetoComRegistros = (p: ProjetoGerencialFiltravel) =>
  p.horas_homem > 0 || p.percentual_realizado > 0 || p.consumo_tinta_ml > 0
  || Number(p.custo_materiais ?? 0) > 0
  || p.etapas.some((e) => e.ordens.some((op) => op.quantidade_realizada > 0));
const prioridade = (p: ProjetoGerencialFiltravel) =>
  projetoEmAndamento(p) ? 0 : projetoComRegistros(p) ? 1 : p.ops_total > 0 ? 2 : 3;
export function filtrarOrdenarProjetos<T extends ProjetoGerencialFiltravel>(
  projetos: T[], situacao: SituacaoGerencial, cidades: string[] | null,
): T[] {
  const selecionadas = cidades === null ? null : new Set(cidades);
  return projetos.filter((p) =>
    (!selecionadas || selecionadas.has(chaveCidade(p.cidade)))
    && (situacao === 'todos' || (situacao === 'em_andamento' ? projetoEmAndamento(p) : projetoComRegistros(p)))
  ).sort((a, b) => prioridade(a) - prioridade(b)
    || a.projeto_nome.localeCompare(b.projeto_nome, 'pt-BR')
    || chaveCidade(a.cidade).localeCompare(chaveCidade(b.cidade), 'pt-BR')
    || a.projeto_id.localeCompare(b.projeto_id));
}
