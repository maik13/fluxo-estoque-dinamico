import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const GuiaImportacaoExcel = () => {
  
  // Função para gerar arquivo Excel modelo
  const gerarArquivoModelo = () => {
    const headers = [
      'codigoBarras',
      'nome',
      'origem',
      'caixaOrganizador',
      'localizacao',
      'responsavel',
      'marca',
      'categoria',
      'subcategoria',
      'subDestino',
      'tipoServico',
      'quantidade',
      'quantidadeMinima',
      'unidade',
      'condicao',
      'especificacao',
      'metragem',
      'peso',
      'comprimentoLixa',
      'polaridadeDisjuntor'
    ];

    const exemploData = [
      [
        '7891234567890',
        'Cabo Flexível 2,5mm',
        'Fornecedor ABC',
        'Caixa 01',
        'Estante A - Prateleira 2',
        'João Silva',
        'Furukawa',
        'Cabos',
        'Cabos Flexíveis',
        'Estoque Principal',
        'Instalação Elétrica',
        '100',
        '10',
        'metro',
        'Novo',
        'Cabo flexível 2,5mm² isolação 750V',
        '100',
        '',
        '',
        ''
      ],
      [
        '7891234567891',
        'Disjuntor Bipolar 32A',
        'Nota Fiscal 12345',
        'Gaveta 03',
        'Armário Disjuntores',
        'Maria Santos',
        'Schneider',
        'Proteção',
        'Disjuntores',
        'Estoque Obra',
        'Quadro Elétrico',
        '5',
        '2',
        'peça',
        'Novo',
        'Disjuntor bipolar 32A curva C',
        '',
        '0.2',
        '',
        'Bipolar'
      ],
      [
        '7891234567892',
        'Lixa d\'água #220',
        'Compra Direta',
        'Prateleira B',
        'Área Acabamento',
        'Pedro Costa',
        'Norton',
        'Ferramentas',
        'Abrasivos',
        'Estoque Geral',
        'Acabamento',
        '50',
        '5',
        'folha',
        'Novo',
        'Lixa d\'água granulação 220',
        '',
        '',
        '23',
        ''
      ]
    ];

    // Criar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...exemploData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo-importacao-estoque.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const camposObrigatorios = [
    { campo: 'codigoBarras', descricao: 'Código único do item (deve ser único no sistema)' },
    { campo: 'nome', descricao: 'Nome do produto' },
    { campo: 'responsavel', descricao: 'Nome do responsável pelo cadastro' },
    { campo: 'quantidade', descricao: 'Quantidade inicial (número)' },
    { campo: 'unidade', descricao: 'Unidade de medida (metro, peça, kg, etc.)' }
  ];

  const camposOpcionais = [
    { campo: 'origem', descricao: 'Fornecedor, nota fiscal, origem do item' },
    { campo: 'caixaOrganizador', descricao: 'Caixa, gaveta ou organizador onde está guardado' },
    { campo: 'localizacao', descricao: 'Localização física do item' },
    { campo: 'marca', descricao: 'Marca do produto' },
    { campo: 'categoria', descricao: 'Categoria principal do item' },
    { campo: 'subcategoria', descricao: 'Subcategoria do item' },
    { campo: 'subDestino', descricao: 'Sub destino/estoque de destino' },
    { campo: 'tipoServico', descricao: 'Tipo de serviço onde será usado' },
    { campo: 'quantidadeMinima', descricao: 'Quantidade mínima para alerta (número)' },
    { campo: 'condicao', descricao: 'Novo, Usado, Defeito ou Descarte' },
    { campo: 'especificacao', descricao: 'Especificações técnicas detalhadas' },
    { campo: 'metragem', descricao: 'Metragem (para cabos) - número' },
    { campo: 'peso', descricao: 'Peso do item - número' },
    { campo: 'comprimentoLixa', descricao: 'Comprimento da lixa - número' },
    { campo: 'polaridadeDisjuntor', descricao: 'Polaridade do disjuntor (Monopolar, Bipolar, Tripolar)' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Guia de Importação Excel/CSV
          </CardTitle>
          <CardDescription>
            Como preparar seu arquivo Excel ou CSV para importação em lote
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Botão para baixar modelo */}
          <div className="flex justify-center">
            <Button onClick={gerarArquivoModelo} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Baixar Arquivo Modelo (CSV)
            </Button>
          </div>

          {/* Alertas importantes */}
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> O arquivo deve estar no formato CSV (separado por vírgulas) 
                ou Excel (.xlsx). Certifique-se de que os nomes das colunas estão exatamente como especificado.
              </AlertDescription>
            </Alert>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Baixe o arquivo modelo acima para ter a estrutura correta. 
                Ele já vem com exemplos de dados para orientar o preenchimento.
              </AlertDescription>
            </Alert>
          </div>

          {/* Campos obrigatórios */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="destructive">Obrigatório</Badge>
              Campos Obrigatórios
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {camposObrigatorios.map((campo, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono bg-muted/50">{campo.campo}</TableCell>
                    <TableCell>{campo.descricao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Campos opcionais */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="secondary">Opcional</Badge>
              Campos Opcionais
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {camposOpcionais.map((campo, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono bg-muted/50">{campo.campo}</TableCell>
                    <TableCell>{campo.descricao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Regras importantes */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">📋 Regras Importantes</CardTitle>
            </CardHeader>
            <CardContent className="text-blue-700 space-y-2">
              <ul className="space-y-2">
                <li>• <strong>Códigos únicos:</strong> Cada codigoBarras deve ser único no sistema</li>
                <li>• <strong>Números:</strong> Campos como quantidade, quantidadeMinima, metragem e peso devem conter apenas números</li>
                <li>• <strong>Condição:</strong> Valores aceitos: "Novo", "Usado", "Defeito", "Descarte"</li>
                <li>• <strong>Primeira linha:</strong> Deve conter os nomes dos campos (cabeçalho)</li>
                <li>• <strong>Codificação:</strong> Salve o arquivo com codificação UTF-8 para caracteres especiais</li>
                <li>• <strong>Aspas:</strong> Textos com vírgulas devem estar entre aspas duplas</li>
              </ul>
            </CardContent>
          </Card>

          {/* Exemplo de linha */}
          <div>
            <h3 className="text-lg font-semibold mb-3">💡 Exemplo de Linha Completa</h3>
            <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <p className="text-gray-600 mb-2">// Cabeçalho (primeira linha)</p>
              <p className="mb-4">codigoBarras,nome,origem,caixaOrganizador,localizacao,responsavel,marca,categoria,subcategoria,subDestino,tipoServico,quantidade,quantidadeMinima,unidade,condicao,especificacao,metragem,peso,comprimentoLixa,polaridadeDisjuntor</p>
              
              <p className="text-gray-600 mb-2">// Exemplo de dados (segunda linha em diante)</p>
              <p>"7891234567890","Cabo Flexível 2,5mm","Fornecedor ABC","Caixa 01","Estante A - Prateleira 2","João Silva","Furukawa","Cabos","Cabos Flexíveis","Estoque Principal","Instalação Elétrica","100","10","metro","Novo","Cabo flexível 2,5mm² isolação 750V","100","","",""</p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};