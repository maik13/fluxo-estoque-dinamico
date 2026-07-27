import type {
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoStatus,
} from '@/types/producao';

export interface DadosImpressaoOrdemProducao {
  apontamento: ProducaoApontamento;
  projetoNome: string;
  projetoCidade?: string | null;
  projetoUf?: string | null;
  localOperacional?: string | null;
  processoCodigo?: string | null;
  processoNome?: string | null;
  tarefaNome: string;
  membros: ProducaoApontamentoMembro[];
  fotos: Array<{ nome: string; url: string; criadoEm: string }>;
}

const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Pendente de conferência',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
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

const opFormatada = (numero: number) => `OP ${String(numero).padStart(6, '0')}`;

export const imprimirOrdemProducao = (dados: DadosImpressaoOrdemProducao) => {
  const { apontamento, membros, fotos } = dados;
  const janela = window.open('', '_blank', 'width=1100,height=850');
  if (!janela) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este sistema.');

  const equipeHtml = membros.length > 0
    ? membros.map((membro) => `
      <tr>
        <td>${escapar(membro.nome_snapshot)}</td>
        <td>${escapar(horas(membro.jornada_diaria_minutos_snapshot))}</td>
        <td>${escapar(horas(membro.minutos_produtivos_snapshot))}</td>
        <td>${escapar(horas(membro.minutos_improdutivos_snapshot))}</td>
      </tr>`).join('')
    : '<tr><td colspan="4">Nenhum membro vinculado.</td></tr>';

  const fotosHtml = fotos.length > 0
    ? `<section class="bloco quebra-antes">
        <h2>Evidências fotográficas</h2>
        <div class="fotos">${fotos.map((foto) => `
          <figure>
            <img src="${escapar(foto.url)}" alt="${escapar(foto.nome)}" />
            <figcaption>${escapar(foto.nome)} · ${escapar(new Date(foto.criadoEm).toLocaleString('pt-BR'))}</figcaption>
          </figure>`).join('')}</div>
      </section>`
    : '';

  const localizacao = [dados.projetoCidade, dados.projetoUf].filter(Boolean).join('/');
  const processo = dados.processoCodigo
    ? `${dados.processoCodigo} — ${dados.processoNome ?? ''}`
    : 'Apontamento avulso — sem etapa vinculada';

  janela.document.open();
  janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapar(opFormatada(apontamento.numero_op))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #178b55; padding-bottom: 12px; }
    .marca { font-size: 26px; font-weight: 700; letter-spacing: 1px; color: #176b48; }
    .submarca { margin-top: 3px; font-size: 10px; letter-spacing: 2px; color: #4b5563; }
    .numero { text-align: right; }
    .numero strong { display: block; font-size: 24px; color: #111827; }
    .status { display: inline-block; margin-top: 6px; border: 1px solid #9ca3af; border-radius: 999px; padding: 4px 10px; font-weight: 700; }
    h1 { margin: 18px 0 5px; font-size: 19px; }
    h2 { margin: 0 0 10px; font-size: 14px; color: #176b48; }
    .descricao { margin: 0 0 16px; color: #4b5563; }
    .bloco { margin-top: 14px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; break-inside: avoid; }
    .grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 18px; }
    .campo { min-height: 38px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .campo span { display: block; margin-bottom: 3px; color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
    .campo strong { font-size: 11px; white-space: pre-wrap; }
    .coluna-inteira { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
    th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; }
    .assinaturas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-top: 45px; }
    .assinatura { border-top: 1px solid #111827; padding-top: 5px; text-align: center; }
    .fotos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    figure { margin: 0; border: 1px solid #d1d5db; padding: 6px; break-inside: avoid; }
    figure img { display: block; width: 100%; height: 190px; object-fit: contain; background: #f3f4f6; }
    figcaption { margin-top: 5px; font-size: 9px; color: #4b5563; }
    footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 9px; }
    .quebra-antes { break-before: page; }
    @media print { .nao-imprimir { display: none !important; } }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="marca">BAMBUSA</div>
      <div class="submarca">ATELIER · PRODUÇÃO</div>
    </div>
    <div class="numero">
      <strong>${escapar(opFormatada(apontamento.numero_op))}</strong>
      <span class="status">${escapar(statusLabel[apontamento.status])}</span>
    </div>
  </header>

  <h1>Ordem de Produção / Apontamento</h1>
  <p class="descricao">Documento operacional gerado a partir do registro efetivo de produção.</p>

  <section class="bloco">
    <h2>Identificação</h2>
    <div class="grade">
      <div class="campo"><span>Projeto</span><strong>${escapar(dados.projetoNome)}</strong></div>
      <div class="campo"><span>Cidade / UF</span><strong>${escapar(localizacao || 'Não informada')}</strong></div>
      <div class="campo"><span>Local operacional</span><strong>${escapar(dados.localOperacional || apontamento.local_tipo)}</strong></div>
      <div class="campo"><span>Etapa / processo</span><strong>${escapar(processo)}</strong></div>
      <div class="campo coluna-inteira"><span>Atividade executada</span><strong>${escapar(dados.tarefaNome)}</strong></div>
    </div>
  </section>

  <section class="bloco">
    <h2>Execução</h2>
    <div class="grade">
      <div class="campo"><span>Data</span><strong>${escapar(new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR'))}</strong></div>
      <div class="campo"><span>Horário</span><strong>${escapar(apontamento.inicio.slice(0, 5))} às ${escapar(apontamento.termino.slice(0, 5))}</strong></div>
      <div class="campo"><span>Duração total</span><strong>${escapar(horas(apontamento.duracao_minutos))}</strong></div>
      <div class="campo"><span>Quantidade produzida</span><strong>${escapar(apontamento.quantidade_produzida ?? 'Não informada')}</strong></div>
      <div class="campo"><span>Tempo produtivo</span><strong>${escapar(horas(apontamento.minutos_produtivos))}</strong></div>
      <div class="campo"><span>Tempo improdutivo</span><strong>${escapar(horas(apontamento.minutos_improdutivos))}</strong></div>
      <div class="campo coluna-inteira"><span>Motivo improdutivo</span><strong>${escapar(apontamento.motivo_improdutivo || 'Não informado')}</strong></div>
      <div class="campo coluna-inteira"><span>Observações</span><strong>${escapar(apontamento.observacoes || 'Sem observações')}</strong></div>
    </div>
  </section>

  <section class="bloco">
    <h2>Equipe</h2>
    <table>
      <thead><tr><th>Membro</th><th>Jornada diária</th><th>Tempo produtivo</th><th>Tempo improdutivo</th></tr></thead>
      <tbody>${equipeHtml}</tbody>
    </table>
  </section>

  <section class="bloco">
    <h2>Rastreabilidade</h2>
    <div class="grade">
      <div class="campo"><span>Criado por</span><strong>${escapar(apontamento.criado_por_nome_snapshot || 'Não identificado')}</strong></div>
      <div class="campo"><span>Criado em</span><strong>${escapar(new Date(apontamento.created_at).toLocaleString('pt-BR'))}</strong></div>
      <div class="campo"><span>Conferido por</span><strong>${escapar(apontamento.conferido_por_nome_snapshot || 'Não conferido')}</strong></div>
      <div class="campo"><span>Conferido em</span><strong>${escapar(apontamento.conferido_em ? new Date(apontamento.conferido_em).toLocaleString('pt-BR') : '—')}</strong></div>
      <div class="campo"><span>Cancelado por</span><strong>${escapar(apontamento.cancelado_por_nome_snapshot || 'Não cancelado')}</strong></div>
      <div class="campo"><span>Cancelado em</span><strong>${escapar(apontamento.cancelado_em ? new Date(apontamento.cancelado_em).toLocaleString('pt-BR') : '—')}</strong></div>
      ${apontamento.motivo_cancelamento ? `<div class="campo coluna-inteira"><span>Motivo do cancelamento</span><strong>${escapar(apontamento.motivo_cancelamento)}</strong></div>` : ''}
    </div>
  </section>

  ${fotosHtml}

  <section class="assinaturas">
    <div class="assinatura">Responsável pela execução</div>
    <div class="assinatura">Responsável pela conferência</div>
  </section>

  <footer>
    ${escapar(opFormatada(apontamento.numero_op))} · Identificador interno ${escapar(apontamento.id)} · Documento emitido em ${escapar(new Date().toLocaleString('pt-BR'))}
  </footer>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`);
  janela.document.close();
};
