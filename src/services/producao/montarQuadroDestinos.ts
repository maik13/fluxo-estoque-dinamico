import { chaveCidade } from './filtrarProjetosGerencial';

export interface ProjetoQuadro {
  projeto_id: string;
  projeto_nome: string;
  cidade: string | null;
  percentual_realizado: number;
}
export function montarQuadroDestinos<T extends ProjetoQuadro>(projetos: T[], parqueIds: readonly string[]) {
  const parque = new Set(parqueIds);
  const destinos = [
    { id: 'brusque', nome: 'Brusque', projetos: projetos.filter(p => !parque.has(p.projeto_id) && chaveCidade(p.cidade) === 'brusque') },
    { id: 'rolandia', nome: 'Rolândia', projetos: projetos.filter(p => !parque.has(p.projeto_id) && chaveCidade(p.cidade) === 'rolandia') },
    { id: 'parque', nome: 'Parque do Japão', projetos: projetos.filter(p => parque.has(p.projeto_id)) },
  ];
  const resumir = (grupo: { id: string; nome: string; projetos: T[] }) => ({
    ...grupo,
    percentual: grupo.projetos.length ? grupo.projetos.reduce((total, p) => total + Math.max(0, Math.min(100, Number(p.percentual_realizado) || 0)), 0) / grupo.projetos.length : null,
  });
  return [...destinos, { id: 'geral', nome: 'Consolidado dos três destinos', projetos: destinos.flatMap(d => d.projetos) }].map(resumir);
}
