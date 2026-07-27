import type {
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoOrdemProducao,
  ProducaoStatus,
} from '@/types/producao';

export interface ApontamentoImpressaoOrdem {
  apontamento: ProducaoApontamento;
  tarefaNome: string;
  membros: ProducaoApontamentoMembro[];
  fotos: Array<{ nome: string; url: string; criadoEm: string }>;
}

export interface DadosImpressaoOrdemProducao {
  ordem: ProducaoOrdemProducao;
  apontamentos: ApontamentoImpressaoOrdem[];
}

const statusApontamentoLabel: Record<ProducaoStatus, string> = {
  lancado: 'Pendente de conferência',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const statusOpLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  liberada: 'Liberada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const escapar = (valor: unknown) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const horas = (minutos: number | null | undefined) => {
  if (minutos === null || minutos === undefined) return 'Não informada';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const dataBr = (valor: string | null | undefined) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
  : '—';

const opFormatada = (numero: number) => `OP ${String(numero).padStart(6, '0')}`;

export const imprimirOrdemProducao = ({ ordem, apontamentos }: DadosImpressaoOrdemProducao) => {
  const janela = window.open('', '_blank', 'width=1100,height=850');
  if (!janela) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este sistema.');

  const apontamentosOrdenados = [...apontamentos].sort((a, b) =>
    `${a.apontamento.data}-${a.apontamento.inicio}`.localeCompare(`${b.apontamento.data}-${b.apontamento.inicio}`));

  const totais = apontamentosOrdenados.reduce((acc, item) => {
    if (item.apontamento.status === 'cancelado') return acc;
    acc.quantidade += Number(item.apontamento.quantidade_produzida ?? 0);
    acc.duracao += item.apontamento.duracao_minutos;
    acc.produtivo += item.apontamento.minutos_produtivos;
    acc.improdutivo += item.apontamento.minutos_improdutivos;
    return acc;
  }, { quantidade: 0, duracao: 0, produtivo: 0, improdutivo: 0 });

  const apontamentosHtml = apontamentosOrdenados.length === 0
    ? '<div class="vazio">Nenhum apontamento registrado nesta OP.</div>'
    : apontamentosOrdenados.map(({ apontamento, tarefaNome, membros, fotos }, indice) => {
      const membrosHtml = membros.length
        ? membros.map((membro) => `<tr><td>${escapar(membro.nome_snapshot)}</td><td>${escapar(horas(membro.jornada_diaria_minutos_snapshot))}</td><td>${escapar(horas(membro.minutos_produtivos_snapshot))}</td><td>${escapar(horas(membro.minutos_improdutivos_snapshot))}</td></tr>`).join('')
        : '<tr><td colspan="4">Nenhum membro vinculado.</td></tr>';
      const fotosHtml = fotos.length
        ? `<div class="fotos">${fotos.map((foto) => `<figure><img src="${escapar(foto.url)}" alt="${escapar(foto.nome)}" /><figcaption>${escapar(foto.nome)} · ${escapar(new Date(foto.criadoEm).toLocaleString('pt-BR'))}</figcaption></figure>`).join('')}</div>`
        : '';

      return `<section class="bloco apontamento">
        <div class="titulo-apontamento">
          <h2>Apontamento ${String(indice + 1).padStart(3, '0')}</h2>
          <span class="status">${escapar(statusApontamentoLabel[apontamento.status])}</span>
        </div>
        <div class="grade">
          <div class="campo"><span>Data</span><strong>${escapar(dataBr(apontamento.data))}</strong></div>
          <div class="campo"><span>Horário</span><strong>${escapar(apontamento.inicio.slice(0, 5))} às ${escapar(apontamento.termino.slice(0, 5))}</strong></div>
          <div class="campo"><span>Atividade executada</span><strong>${escapar(tarefaNome)}</strong></div>
          <div class="campo"><span>Quantidade</span><strong>${escapar(apontamento.quantidade_produzida ?? 'Não informada')}</strong></div>
          <div class="campo"><span>Duração</span><strong>${escapar(horas(apontamento.duracao_minutos))}</strong></div>
          <div class="campo"><span>Produtivo / improdutivo</span><strong>${escapar(horas(apontamento.minutos_produtivos))} / ${escapar(horas(apontamento.minutos_improdutivos))}</strong></div>
          <div class="campo coluna-inteira"><span>Motivo improdutivo</span><strong>${escapar(apontamento.motivo_improdutivo || 'Não informado')}</strong></div>
          <div class="campo coluna-inteira"><span>Observações</span><strong>${escapar(apontamento.observacoes || 'Sem observações')}</strong></div>
          <div class="campo"><span>Registrado por</span><strong>${escapar(apontamento.criado_por_nome_snapshot || 'Não identificado')}</strong></div>
          <div class="campo"><span>Conferido por</span><strong>${escapar(apontamento.conferido_por_nome_snapshot || 'Não conferido')}</strong></div>
        </div>
        <h3>Equipe</h3>
        <table><thead><tr><th>Membro</th><th>Jornada</th><th>Produtivo</th><th>Improdutivo</th></tr></thead><tbody>${membrosHtml}</tbody></table>
        ${fotosHtml}
      </section>`;
    }).join('');

  const localizacao = [ordem.projeto_cidade, ordem.projeto_uf].filter(Boolean).join('/');

  janela.document.open();
  janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapar(opFormatada(ordem.numero))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #178b55; padding-bottom: 12px; }
    .marca { font-size: 26px; font-weight: 700; letter-spacing: 1px; color: #176b48; }
    .submarca { margin-top: 3px; font-size: 10px; letter-spacing: 2px; color: #4b5563; }
    .numero { text-align: right; }
    .numero strong { display: block; font-size: 24px; }
    .status { display: inline-block; border: 1px solid #9ca3af; border-radius: 999px; padding: 4px 10px; font-weight: 700; }
    h1 { margin: 18px 0 5px; font-size: 19px; }
    h2 { margin: 0; font-size: 14px; color: #176b48; }
    h3 { margin: 12px 0 7px; font-size: 12px; color: #176b48; }
    .descricao { margin: 0 0 16px; color: #4b5563; }
    .bloco { margin-top: 14px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; break-inside: avoid; }
    .apontamento { break-inside: auto; }
    .titulo-apontamento { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 18px; }
    .campo { min-height: 38px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .campo span { display: block; margin-bottom: 3px; color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
    .campo strong { font-size: 11px; white-space: pre-wrap; }
    .coluna-inteira { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
    th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; }
    .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .resumo div { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
    .resumo span { display: block; color: #6b7280; font-size: 9px; text-transform: uppercase; }
    .resumo strong { display: block; margin-top: 3px; font-size: 14px; }
    .fotos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
    figure { margin: 0; border: 1px solid #d1d5db; padding: 6px; break-inside: avoid; }
    figure img { display: block; width: 100%; height: 180px; object-fit: contain; background: #f3f4f6; }
    figcaption { margin-top: 5px; font-size: 9px; color: #4b5563; }
    .assinaturas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-top: 45px; }
    .assinatura { border-top: 1px solid #111827; padding-top: 5px; text-align: center; }
    .vazio { border: 1px dashed #d1d5db; border-radius: 8px; padding: 20px; color: #6b7280; text-align: center; }
    footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 9px; }
  </style>
</head>
<body>
  <header>
    <div><div class="marca">BAMBUSA</div><div class="submarca">ATELIER · PRODUÇÃO</div></div>
    <div class="numero"><strong>${escapar(opFormatada(ordem.numero))}</strong><span class="status">${escapar(statusOpLabel[ordem.status] ?? ordem.status)}</span></div>
  </header>

  <h1>Ordem de Produção</h1>
  <p class="descricao">Documento emitido antes da execução e atualizado pelos apontamentos realizados dentro da ordem.</p>

  <section class="bloco">
    <h2>Planejamento da OP</h2>
    <div class="grade">
      <div class="campo"><span>Projeto</span><strong>${escapar(ordem.projeto_nome)}</strong></div>
      <div class="campo"><span>Cidade / UF</span><strong>${escapar(localizacao || 'Não informada')}</strong></div>
      <div class="campo"><span>Etapa</span><strong>${escapar(`${ordem.processo_codigo} — ${ordem.processo_nome}`)}</strong></div>
      <div class="campo"><span>Local operacional</span><strong>${escapar(ordem.local_tipo)}</strong></div>
      <div class="campo"><span>Produto / entregável</span><strong>${escapar(ordem.produto_entregavel || 'Não informado')}</strong></div>
      <div class="campo"><span>Quantidade planejada</span><strong>${escapar(`${ordem.quantidade_planejada} ${ordem.unidade_medida ?? ''}`)}</strong></div>
      <div class="campo"><span>Período previsto</span><strong>${escapar(`${dataBr(ordem.data_inicio_prevista)} a ${dataBr(ordem.data_fim_prevista)}`)}</strong></div>
      <div class="campo"><span>Responsável / equipe</span><strong>${escapar(`${ordem.responsavel_nome_snapshot || 'Não informado'} · ${ordem.equipe_prevista ?? '—'} pessoa(s)`)}</strong></div>
      <div class="campo coluna-inteira"><span>Descrição do lote</span><strong>${escapar(ordem.descricao || 'Não informada')}</strong></div>
      <div class="campo coluna-inteira"><span>Instruções</span><strong>${escapar(ordem.instrucoes || 'Sem instruções adicionais')}</strong></div>
    </div>
    <div class="resumo">
      <div><span>Realizado</span><strong>${escapar(`${ordem.quantidade_realizada} ${ordem.unidade_medida ?? ''}`)}</strong></div>
      <div><span>Progresso</span><strong>${escapar(`${ordem.percentual_realizado}%`)}</strong></div>
      <div><span>Horas apontadas</span><strong>${escapar(horas(totais.duracao))}</strong></div>
      <div><span>Produtivo / improdutivo</span><strong>${escapar(`${horas(totais.produtivo)} / ${horas(totais.improdutivo)}`)}</strong></div>
    </div>
  </section>

  ${apontamentosHtml}

  <section class="assinaturas"><div class="assinatura">Responsável pela execução</div><div class="assinatura">Responsável pela conferência</div></section>
  <footer>${escapar(opFormatada(ordem.numero))} · Identificador ${escapar(ordem.id)} · Emitido em ${escapar(new Date().toLocaleString('pt-BR'))}</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 500); });</script>
</body>
</html>`);
  janela.document.close();
};
