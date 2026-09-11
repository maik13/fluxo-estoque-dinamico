import type { ProducaoOrdemProducao } from '@/types/producao';

const statusLabel: Record<string, string> = {
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

const dataBr = (valor: string | null | undefined) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
  : 'Não informado';

const formatarQuantidade = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(valor));

const opFormatada = (numero: number) => `OP ${String(numero).padStart(6, '0')}`;

export const imprimirOrdemProducaoOperacional = (ordem: ProducaoOrdemProducao) => {
  const janela = window.open('', '_blank', 'width=900,height=780');
  if (!janela) {
    throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este sistema.');
  }

  const atividade = ordem.tarefa_nome_snapshot?.trim() || 'Atividade não vinculada';
  const etapa = `${ordem.processo_codigo} — ${ordem.processo_nome}`;
  const quantidade = `${formatarQuantidade(Number(ordem.quantidade_planejada))}${ordem.unidade_medida ? ` ${ordem.unidade_medida}` : ''}`;
  const periodo = `${dataBr(ordem.data_inicio_prevista)} a ${dataBr(ordem.data_fim_prevista)}`;
  const equipe = ordem.equipe_prevista == null
    ? 'Não informada'
    : `${ordem.equipe_prevista} pessoa${ordem.equipe_prevista === 1 ? '' : 's'}`;

  janela.document.open();
  janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapar(`${opFormatada(ordem.numero)} — ${atividade}`)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #176b48; padding-bottom: 14px; }
    .marca { color: #176b48; font-size: 24px; font-weight: 700; letter-spacing: 1px; }
    .submarca { margin-top: 3px; color: #6b7280; font-size: 9px; letter-spacing: 1.8px; }
    .numero { text-align: right; }
    .numero strong { display: block; font-size: 22px; }
    h1 { margin: 20px 0 4px; font-size: 22px; }
    .atividade { margin: 0 0 20px; color: #176b48; font-size: 17px; font-weight: 700; }
    .grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 22px; }
    .campo { border-bottom: 1px solid #e5e7eb; padding: 0 0 9px; min-height: 50px; }
    .campo span { display: block; margin-bottom: 4px; color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
    .campo strong { display: block; font-size: 13px; white-space: pre-wrap; }
    .coluna-inteira { grid-column: 1 / -1; }
    .descricao { min-height: 105px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
    .descricao span { display: block; margin-bottom: 7px; color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
    .descricao strong { font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="marca">BAMBUSA</div>
      <div class="submarca">ATELIER · PRODUÇÃO</div>
    </div>
    <div class="numero"><strong>${escapar(opFormatada(ordem.numero))}</strong></div>
  </header>

  <h1>Ordem de Produção</h1>
  <p class="atividade">${escapar(atividade)}</p>

  <section class="grade">
    <div class="campo"><span>Projeto</span><strong>${escapar(ordem.projeto_nome)}</strong></div>
    <div class="campo"><span>Etapa</span><strong>${escapar(etapa)}</strong></div>
    <div class="campo"><span>Status</span><strong>${escapar(statusLabel[ordem.status] ?? ordem.status)}</strong></div>
    <div class="campo"><span>Quantidade planejada</span><strong>${escapar(quantidade)}</strong></div>
    <div class="campo"><span>Período previsto</span><strong>${escapar(periodo)}</strong></div>
    <div class="campo"><span>Local de execução</span><strong>${escapar(ordem.local_tipo)}</strong></div>
    <div class="campo"><span>Responsável</span><strong>${escapar(ordem.responsavel_nome_snapshot || 'Não informado')}</strong></div>
    <div class="campo"><span>Equipe</span><strong>${escapar(equipe)}</strong></div>
    <div class="descricao coluna-inteira"><span>Descrição</span><strong>${escapar(ordem.descricao || 'Sem descrição adicional.')}</strong></div>
  </section>

  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });</script>
</body>
</html>`);
  janela.document.close();
};
