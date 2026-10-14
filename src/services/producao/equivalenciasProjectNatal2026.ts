/**
 * Conciliação de TODOS os 23 agrupamentos de peças do Cronograma v02.pdf.
 * Um agrupamento MSP é identificado pelo EDT principal, não apenas pelo
 * código abreviado: BPE, CCB e E1C se repetem no cronograma.
 *
 * Nome no sistema = código completo + descrição + localidade, exatamente
 * como cadastrado. Entradas null são bloqueadas até prova de equivalência,
 * nunca criam automaticamente projeto/OP.
 */
export const equivalenciasNatal2026 = [
  {edt:'1.2',codigo:'AJE',pecaMSP:'Anjos Ecológicos',sistema:null,nota:'Nome correto do sistema: Anjo Agradecido. Há projetos TEC-01 em Brusque e Cianorte; EDT não define destino inequívoco.'},
  {edt:'1.5',codigo:'AJT',pecaMSP:'Anjo com Trombeta',sistema:'PCE-0006 - Anjo com trombeta (A: 4m) · Rolândia'},
  {edt:'1.16',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Separar TEC-21 1m de TEC-24 80cm e distinguir as cidades.'},
  {edt:'1.17',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Segunda ocorrência de BPE; identificação por EDT 1.17.'},
  {edt:'1.18',codigo:'BPE',pecaMSP:'Bolas Penduradas',sistema:null,nota:'Terceira ocorrência de BPE; identificação por EDT 1.18.'},
  {edt:'1.21',codigo:'CAN',pecaMSP:'Casa Noel',sistema:'TEC-29 - Casa do Papai Noel · Brusque'},
  {edt:'1.22',codigo:'CAP',pecaMSP:'Capivara',sistema:'TEC-28 - Capivara · Brusque'},
  {edt:'1.24',codigo:'CCB',pecaMSP:'Conjunto Cônico de Bolas',sistema:null,nota:'Dois projetos TEC-30 (Cianorte e Parque do Japão), mais de um EDT.'},
  {edt:'1.25',codigo:'CCB',pecaMSP:'Conjunto Cônico de Bolas',sistema:null,nota:'Segundo EDT do conjunto CCB; cidade a comprovar.'},
  {edt:'1.28',codigo:'CPL',pecaMSP:'Caixa de presente com Laço',sistema:'TEC-27 - Caixa de Presente - Modelo 1 · Brusque'},
  {edt:'1.35',codigo:'E1C',pecaMSP:'Estrela de uma cauda',sistema:null,nota:'Duas ocorrências do Project, cadastro E1C Maringá e PCE-0004 cidades distintas.'},
  {edt:'1.36',codigo:'E1C',pecaMSP:'Estrela de uma cauda',sistema:null,nota:'Não confundir as duas ocorrências E1C.'},
  {edt:'1.37',codigo:'E2D',pecaMSP:'Estrela 2D (10)',sistema:null,nota:'Sem projeto unívoco na relação consultada.'},
  {edt:'1.38',codigo:'E2D',pecaMSP:'Estrela 2D (10)',sistema:null,nota:'Segundo EDT E2D sem projeto unívoco.'},
  {edt:'1.41',codigo:'FVR',pecaMSP:'Flor Vitória Régia (5un 2m)',sistema:null,nota:'Não igualar automaticamente a Flor de lótus flutuante PCE-0005.'},
  {edt:'1.44',codigo:'JMB',pecaMSP:'José Maria e Burrinho',sistema:'TEC-46 - Conjunto Maria, José e Burrinho · Rolândia'},
  {edt:'1.47',codigo:'PAM',pecaMSP:'Painel Anunciação a Maria',sistema:'PCE-0008 - Painel Anunciação a Maria · Rolândia'},
  {edt:'1.48',codigo:'PMI',pecaMSP:'Painel Encontro de Maria e Isabel',sistema:'PCE-0009 - Painel Encontro de Maria e Isabel · Rolândia'},
  {edt:'1.49',codigo:'PSJ',pecaMSP:'Painel Sonho de José',sistema:'PCE-0010 - Painel Sonho de José · Rolândia'},
  {edt:'1.50',codigo:'PTR',pecaMSP:'Painel Adoração dos Três Reis Magos',sistema:'PCE-0007 - Painel Adoração dos Três Reis Magos · Rolândia'},
  {edt:'1.52',codigo:'PRP',pecaMSP:'Portal Receptivo Paramétrico',sistema:null,nota:'Provável PCE-0012 Pórtico Paramétrico; comprovar correspondência física.'},
  {edt:'1.56',codigo:'TOR',pecaMSP:'Torii',sistema:'PCE-0013 - Torii Oriental + 20 m de cerquinha de bambu · Pq do Japão (Mga)'},
  {edt:'1.59',codigo:'VES',pecaMSP:'Varal de Estrelas',sistema:'PCE-0014 - Varal LED 50 m com estrelas penduradas · Brusque'},
] as const;
export function encontrarEquivalenciaPorEDT(edt: string) {
  return equivalenciasNatal2026.find(item => item.edt === edt) ?? null;
}
