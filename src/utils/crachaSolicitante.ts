const PADROES_CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  '*': 'nwnnwnwnn',
};

const escaparHtml = (valor: string) =>
  valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const codigoSolicitanteProntoParaCracha = (codigo?: string | null) =>
  /^\d{8}$/.test((codigo ?? '').trim());

export const gerarSvgCode39 = (codigo: string) => {
  const valor = codigo.trim();
  if (!/^\d+$/.test(valor)) {
    throw new Error('O código do crachá precisa conter somente números.');
  }

  const texto = `*${valor}*`;
  const estreito = 2;
  const largo = 5;
  const espacoEntreCaracteres = 2;
  const margem = 16;
  const altura = 72;
  let x = margem;
  const barras: string[] = [];

  for (const caractere of texto) {
    const padrao = PADROES_CODE39[caractere];
    if (!padrao) throw new Error('Código incompatível com o crachá.');

    for (let indice = 0; indice < padrao.length; indice += 1) {
      const largura = padrao[indice] === 'w' ? largo : estreito;
      const ehBarra = indice % 2 === 0;

      if (ehBarra) {
        barras.push(
          `<rect x="${x}" y="0" width="${largura}" height="${altura}" fill="#000" />`,
        );
      }

      x += largura;
    }

    x += espacoEntreCaracteres;
  }

  const larguraTotal = x + margem - espacoEntreCaracteres;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${larguraTotal} ${altura}" role="img" aria-label="Código de barras ${valor}" style="width:100%;height:24mm;display:block;background:#fff" shape-rendering="crispEdges">${barras.join('')}</svg>`;
};

export const imprimirCrachaSolicitante = (nome: string, codigo: string) => {
  const codigoNormalizado = codigo.trim();

  if (!codigoSolicitanteProntoParaCracha(codigoNormalizado)) {
    throw new Error('Gere primeiro um código automático de 8 dígitos para este solicitante.');
  }

  const popup = window.open('', '_blank', 'width=760,height=560');
  if (!popup) {
    throw new Error('O navegador bloqueou a janela de impressão.');
  }

  const nomeSeguro = escaparHtml(nome.trim());
  const codigoSeguro = escaparHtml(codigoNormalizado);
  const barras = gerarSvgCode39(codigoNormalizado);

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Crachá - ${nomeSeguro}</title>
  <style>
    @page { size: 86mm 54mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    body { width: 86mm; height: 54mm; }
    .cracha {
      width: 86mm;
      height: 54mm;
      padding: 5mm 6mm 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      border: 0.35mm solid #111827;
      border-radius: 2mm;
      color: #111827;
      background: #fff;
    }
    .marca { font-size: 8pt; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
    .tipo { margin-top: 1mm; font-size: 6.5pt; letter-spacing: 1.1px; color: #4b5563; text-transform: uppercase; }
    .nome { margin: 1.5mm 0 1mm; font-size: 16pt; line-height: 1.05; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .codigo { margin-top: 0.8mm; text-align: center; font-size: 10pt; font-family: "Courier New", monospace; font-weight: 700; letter-spacing: 2px; }
    .rodape { margin-top: 1mm; font-size: 5.5pt; color: #6b7280; text-align: center; }
    @media print {
      body { width: 86mm; height: 54mm; }
      .cracha { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="cracha">
    <div>
      <div class="marca">TUDUBAMBUSA</div>
      <div class="tipo">Solicitante de material</div>
      <div class="nome">${nomeSeguro}</div>
    </div>
    <div>
      ${barras}
      <div class="codigo">${codigoSeguro}</div>
      <div class="rodape">Apresente este crachá para retirada e devolução de materiais.</div>
    </div>
  </div>
  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
    window.onafterprint = () => window.close();
  </script>
</body>
</html>`);

  popup.document.close();
};
