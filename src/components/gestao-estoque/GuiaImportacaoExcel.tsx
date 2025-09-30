import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export const GuiaImportacaoExcel = () => {
  
  // Função para baixar arquivo modelo do servidor
  const baixarArquivoModelo = () => {
    const link = document.createElement('a');
    link.href = '/modelo-importacao-estoque.xlsx';
    link.download = 'modelo-importacao-estoque.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const camposObrigatorios = [
    { campo: 'nome', descricao: 'Nome do produto' },
    { campo: 'responsavel', descricao: 'Nome do responsável pelo cadastro' },
    { campo: 'unidade', descricao: 'Unidade de medida (metro, peça, kg, etc.)' },
    { campo: 'tipoItem', descricao: 'Tipo do item: "Insumo" ou "Ferramenta"' }
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
    { campo: 'quantidade', descricao: 'Quantidade inicial (número) - padrão: 0' },
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
            <Button onClick={baixarArquivoModelo} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Baixar Arquivo Modelo Excel (.xlsx)
            </Button>
          </div>

          {/* Alertas importantes */}
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> O arquivo deve estar no formato Excel (.xlsx) ou CSV (separado por vírgulas). 
                Certifique-se de que os nomes das colunas estão exatamente como especificado.
              </AlertDescription>
            </Alert>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Baixe o arquivo modelo Excel acima para ter a estrutura correta. 
                Ele já vem com exemplos de dados e formatação adequada para orientar o preenchimento.
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
                <li>• <strong>Códigos automáticos:</strong> Os códigos serão gerados automaticamente (COD-000001, COD-000002...)</li>
                <li>• <strong>tipoItem:</strong> Deve ser exatamente "Insumo" ou "Ferramenta"</li>
                <li>• <strong>Números:</strong> Campos como quantidade, quantidadeMinima, metragem e peso devem conter apenas números</li>
                <li>• <strong>Condição:</strong> Valores aceitos: "Novo", "Usado", "Defeito", "Descarte"</li>
                <li>• <strong>Primeira linha:</strong> Deve conter os nomes dos campos (cabeçalho)</li>
                <li>• <strong>Codificação:</strong> Salve o arquivo com codificação UTF-8 para caracteres especiais</li>
                <li>• <strong>Quantidade opcional:</strong> Se não informada, será considerada 0</li>
              </ul>
            </CardContent>
          </Card>

          {/* Exemplo de linha */}
          <div>
            <h3 className="text-lg font-semibold mb-3">💡 Exemplo de Linha Completa</h3>
            <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <p className="text-gray-600 mb-2">// Use o arquivo modelo baixado acima como referência</p>
              <p className="mb-4">Campos: nome, responsavel, unidade, tipoItem (obrigatórios) + campos opcionais</p>
              
              <p className="text-gray-600 mb-2">// Exemplo:</p>
              <p>"CHAVE COMB. (19)","FRANCIS","1","Ferramenta","PA5","MTX","Ferramenta","Manual",...</p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};