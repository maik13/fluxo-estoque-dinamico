/**
 * Referência histórica do Cronograma v02.pdf, mantida apenas para conferência.
 * A importação v24 não pode usar EDT para identificar peças: ela exige Task UID
 * extraído do .mpp e confirmação operacional do destino.
 *
 * Nome no sistema = código completo + descrição + localidade, exatamente
 * como cadastrado. Entradas null são bloqueadas até prova de equivalência,
 * nunca criam automaticamente projeto/OP.
 */
export const equivalenciasNatal2026 = [
  {edt:'1.2',codigo:'AJE',pecaMSP:'Anjos Ecológicos',sistema:null,nota:'Nome correto do sistema: Anjo Agradecido. Há projetos TEC-01 em Brusque e Cianorte; EDT não define destino inequívoco.'},
  {edt:'1.5',codigo:'AJT',pecaMSP:'Anjo com Trombeta',sistema:null,nota:'Candidato histórico PCE-0006 Rolândia; confirmar a instância Task UID do .mpp antes de vincular.'},
  {edt:'1.16',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Separar TEC-21 1m de TEC-24 80cm e distinguir as cidades.'},
  {edt:'1.17',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Segunda ocorrência de BPE; identificação por EDT 1.17.'},
  {edt:'1.18',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Terceira ocorrência de BPE; identificação por EDT 1.18.'},
  {edt:'1.21',codigo:'CAN',pecaMSP:'Casa Noel',sistema:null,nota:'Candidato histórico TEC-29 Brusque; confirmar a instância Task UID do .mpp antes de vincular.'},
  {edt:'1.22',codigo:'CAP',pecaMSP:'Capivara',sistema:null,nota:'Candidato histórico TEC-28 Brusque; há mais de uma instância no .mpp v24.'},
  {edt:'1.24',codigo:'CCB',pecaMSP:'Conjunto Cônico de Bolas',sistema:null,nota:'Dois projetos TEC-30 (Cianorte e Parque do Japão), mais de um EDT.'},
  {edt:'1.25',codigo:'CCB',pecaMSP:'Conjunto Cônico de Bolas',sistema:null,nota:'Segundo EDT do conjunto CCB; cidade a comprovar.'},
  {edt:'1.28',codigo:'CPL',pecaMSP:'Caixa de presente com Laço',sistema:null,nota:'Candidato histórico TEC-27 Brusque; há mais de uma instância no .mpp v24.'},
  {edt:'1.35',codigo:'E1C',pecaMSP:'Estrela de uma cauda',sistema:null,nota:'Duas ocorrências do Project, cadastro E1C Maringá e PCE-0004 cidades distintas.'},
  {edt:'1.36',codigo:'E1C',pecaMSP:'Estrela de uma cauda',sistema:null,nota:'Não confundir as duas ocorrências E1C.'},
  {edt:'1.37',codigo:'E2D',pecaMSP:'Estrela 2D (10)',sistema:null,nota:'Sem projeto unívoco na relação consultada.'},
  {edt:'1.38',codigo:'E2D',pecaMSP:'Estrela 2D (10)',sistema:null,nota:'Segundo EDT E2D sem projeto unívoco.'},
  {edt:'1.41',codigo:'FVR',pecaMSP:'Flor Vitória Régia (5un 2m)',sistema:null,nota:'Não igualar automaticamente a Flor de lótus flutuante PCE-0005.'},
  {edt:'1.44',codigo:'JMB',pecaMSP:'José Maria e Burrinho',sistema:null,nota:'Candidato histórico TEC-46 Rolândia; confirmar Task UID antes de vincular.'},
  {edt:'1.47',codigo:'PAM',pecaMSP:'Painel Anunciação a Maria',sistema:null,nota:'Candidato histórico PCE-0008 Rolândia; confirmar Task UID antes de vincular.'},
  {edt:'1.48',codigo:'PMI',pecaMSP:'Painel Encontro de Maria e Isabel',sistema:null,nota:'Candidato histórico PCE-0009 Rolândia; confirmar Task UID antes de vincular.'},
  {edt:'1.49',codigo:'PSJ',pecaMSP:'Painel Sonho de José',sistema:null,nota:'Candidato histórico PCE-0010 Rolândia; confirmar Task UID antes de vincular.'},
  {edt:'1.50',codigo:'PTR',pecaMSP:'Painel Adoração dos Três Reis Magos',sistema:null,nota:'Candidato histórico PCE-0007 Rolândia; confirmar Task UID antes de vincular.'},
  {edt:'1.52',codigo:'PRP',pecaMSP:'Portal Receptivo Paramétrico',sistema:null,nota:'Provável PCE-0012 Pórtico Paramétrico; comprovar correspondência física.'},
  {edt:'1.56',codigo:'TOR',pecaMSP:'Torii',sistema:null,nota:'Candidato histórico PCE-0013 Pq do Japão; confirmar Task UID antes de vincular.'},
  {edt:'1.59',codigo:'VES',pecaMSP:'Varal de Estrelas',sistema:null,nota:'Candidato histórico PCE-0014 Brusque; confirmar Task UID antes de vincular.'},
] as const;
export function encontrarEquivalenciaPorEDT(edt: string) {
  return equivalenciasNatal2026.find(item => item.edt === edt) ?? null;
}
