import * as XLSX from 'xlsx';
import { LinhaPosicaoPatrimonio, TotaisPosicaoPatrimonio } from '@/hooks/usePosicaoPatrimonio';

interface ExportPosicaoOptions {
  linhas: LinhaPosicaoPatrimonio[];
  totais: TotaisPosicaoPatrimonio;
  nomeEstoque: string;
  descricaoFiltros: string;
}

export const exportarExcelPosicaoPatrimonio = ({
  linhas,
  totais,
  nomeEstoque,
  descricaoFiltros,
}: ExportPosicaoOptions) => {
  const workbook = XLSX.utils.book_new();

  const resumo = [
    { Indicador: 'Estoque', Valor: nomeEstoque, Observação: '' },
    { Indicador: 'Data/hora', Valor: new Date().toLocaleString('pt-BR'), Observação: '' },
    { Indicador: 'Filtros aplicados', Valor: descricaoFiltros || 'Nenhum', Observação: '' },
    { Indicador: 'Itens considerados', Valor: totais.itensConsiderados, Observação: 'Linhas exibidas com os filtros atuais' },
    { Indicador: 'Quantidade física no almoxarifado', Valor: totais.quantidadeFisicaAlmoxarifado, Observação: 'Saldo operacional atual; negativos não somados' },
    { Indicador: 'Ferramentas em uso/projeto', Valor: totais.ferramentasEmUso, Observação: 'Derivado da lógica de alocação existente' },
    { Indicador: 'Quantidade patrimonial de ferramentas', Valor: totais.quantidadePatrimonialFerramentas, Observação: 'Almoxarifado + em uso/projeto' },
    { Indicador: 'Quantidade de insumos em estoque', Valor: totais.quantidadeInsumosEstoque, Observação: 'Somente saldo disponível; saídas históricas não são somadas' },
    { Indicador: 'Itens precificados', Valor: totais.itensPrecificados, Observação: 'Valor unitário maior que zero' },
    { Indicador: 'Itens sem preço', Valor: totais.itensSemPreco, Observação: 'Não entram nos valores apresentados' },
    { Indicador: 'Itens com divergência de estoque', Valor: totais.itensComDivergencia, Observação: 'Saldo negativo; não gera valor patrimonial negativo' },
    { Indicador: 'Valor no almoxarifado conhecido (R$)', Valor: totais.valorAlmoxarifadoConhecido, Observação: 'Somente itens precificados' },
    { Indicador: 'Valor de ferramentas alocadas conhecido (R$)', Valor: totais.valorFerramentasAlocadasConhecido, Observação: 'Somente itens precificados' },
    { Indicador: 'Valor patrimonial de ferramentas conhecido (R$)', Valor: totais.valorPatrimonialFerramentasConhecido, Observação: 'Somente itens precificados' },
    { Indicador: 'Valor total conhecido da posição (R$)', Valor: totais.valorTotalConhecido, Observação: 'ATENÇÃO: exclui itens sem preço' },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 46 }, { wch: 26 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');

  const detalhamento = linhas.map((linha) => ({
    Código: linha.codigo,
    Tipo: linha.tipo,
    Nome: linha.nome,
    Marca: linha.marca,
    Especificação: linha.especificacao,
    Categoria: linha.categoria,
    Subcategoria: linha.subcategoria,
    Condição: linha.condicao,
    Unidade: linha.unidade,
    Ativo: linha.ativo ? 'Sim' : 'Não',
    'Qtd. no Almoxarifado': linha.quantidadeAlmoxarifado,
    'Qtd. Alocada': linha.ehFerramenta ? linha.quantidadeAlocada : '',
    'Qtd. Considerada': linha.quantidadeConsiderada,
    Situação: linha.situacao,
    'Projeto/Local de uso': linha.projetoLocalUso,
    'Valor Unitário (R$)': linha.valorUnitario ?? '',
    'Valor Total Conhecido (R$)': linha.valorTotal ?? '',
    'Status de Preço': linha.statusPreco,
  }));

  const wsDetalhe = XLSX.utils.json_to_sheet(
    detalhamento.length > 0 ? detalhamento : [{ Mensagem: 'Nenhum item para os filtros atuais.' }]
  );
  XLSX.utils.book_append_sheet(workbook, wsDetalhe, 'Detalhamento');

  const semPreco = linhas
    .filter((linha) => linha.valorUnitario === null)
    .map((linha) => ({
      Código: linha.codigo,
      Tipo: linha.tipo,
      Nome: linha.nome,
      Marca: linha.marca,
      Especificação: linha.especificacao,
      'Qtd. Considerada': linha.quantidadeConsiderada,
      Situação: linha.situacao,
      'Projeto/Local de uso': linha.projetoLocalUso,
      Observação: 'Sem preço cadastrado — não compõe nenhum valor do resumo',
    }));

  const wsSemPreco = XLSX.utils.json_to_sheet(
    semPreco.length > 0 ? semPreco : [{ Mensagem: 'Todos os itens exibidos possuem preço cadastrado.' }]
  );
  XLSX.utils.book_append_sheet(workbook, wsSemPreco, 'Itens sem preço');

  const nomeArquivo = `posicao-estoque-patrimonio-${nomeEstoque.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};
