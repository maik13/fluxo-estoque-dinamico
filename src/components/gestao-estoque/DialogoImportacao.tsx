import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Item } from '@/types/estoque';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface DialogoImportacaoProps {
  aberto: boolean;
  onClose: () => void;
  onImportar: (itens: Omit<Item, 'id' | 'codigoBarras'>[]) => void;
}

interface ResultadoValidacao {
  validos: Omit<Item, 'id' | 'codigoBarras'>[];
  erros: { linha: number; erro: string; dados: any }[];
}

export const DialogoImportacao = ({ aberto, onClose, onImportar }: DialogoImportacaoProps) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [progresso, setProgresso] = useState(0);

  const camposObrigatorios = ['nome', 'responsavel', 'unidade'];

  const validarLinha = (dados: any, linha: number): { item?: Omit<Item, 'id' | 'codigoBarras'>; erro?: string } => {
    // Verificar campos obrigatórios
    for (const campo of camposObrigatorios) {
      const valor = dados[campo];
      if (!valor || valor.toString().trim() === '') {
        return { erro: `Campo obrigatório '${campo}' está vazio ou não foi encontrado` };
      }
    }

    // Determinar tipo de item (aceita ausência e infere por categoria)
    const rawTipo = dados.tipoItem?.toString().trim();
    if (rawTipo && !['Insumo', 'Ferramenta'].includes(rawTipo)) {
      return { erro: `Tipo de item inválido: "${dados.tipoItem}". Deve ser "Insumo" ou "Ferramenta"` };
    }
    const tipoInferido = rawTipo || (dados.categoria?.toString().trim() === 'Ferramenta' ? 'Ferramenta' : 'Insumo');

    // Validar quantidade (opcional agora)
    let quantidade = 0;
    if (dados.quantidade && dados.quantidade.toString().trim() !== '') {
      const quantidadeStr = dados.quantidade.toString().trim().replace(',', '.');
      quantidade = parseFloat(quantidadeStr);
      if (isNaN(quantidade) || quantidade < 0) {
        return { erro: `Quantidade inválida: "${dados.quantidade}". Deve ser um número maior ou igual a zero` };
      }
    }

    // Validar quantidade mínima se fornecida
    let quantidadeMinima;
    if (dados.quantidadeMinima && dados.quantidadeMinima.toString().trim() !== '') {
      const quantidadeMinimaStr = dados.quantidadeMinima.toString().trim().replace(',', '.');
      quantidadeMinima = parseFloat(quantidadeMinimaStr);
      if (isNaN(quantidadeMinima) || quantidadeMinima < 0) {
        return { erro: `Quantidade mínima inválida: "${dados.quantidadeMinima}". Deve ser um número maior ou igual a zero` };
      }
    }

    // Validar condição
    const condicao = dados.condicao ? dados.condicao.toString().trim() : 'Novo';
    const condicoesValidas = ['Novo', 'Usado', 'Defeito', 'Descarte'];
    if (!condicoesValidas.includes(condicao)) {
      return { erro: `Condição inválida: "${dados.condicao}". Deve ser: ${condicoesValidas.join(', ')}` };
    }

    // Validar campos numéricos opcionais
    const camposNumericos = ['metragem', 'peso', 'comprimentoLixa'];
    for (const campo of camposNumericos) {
      if (dados[campo] && dados[campo].toString().trim() !== '') {
        const valorStr = dados[campo].toString().trim().replace(',', '.');
        const valor = parseFloat(valorStr);
        if (isNaN(valor) || valor < 0) {
          return { erro: `${campo} inválido: "${dados[campo]}". Deve ser um número válido maior ou igual a zero` };
        }
      }
    }

    const item: Omit<Item, 'id' | 'codigoBarras'> = {
      origem: dados.origem?.toString().trim() || '',
      caixaOrganizador: dados.caixaOrganizador?.toString().trim() || '',
      localizacao: dados.localizacao?.toString().trim() || '',
      nome: dados.nome.toString().trim(),
      tipoItem: tipoInferido as 'Insumo' | 'Ferramenta',
      especificacao: dados.especificacao?.toString().trim() || '',
      marca: dados.marca?.toString().trim() || '',
      unidade: dados.unidade.toString().trim(),
      condicao: condicao as 'Novo' | 'Usado' | 'Defeito' | 'Descarte',
      subcategoriaId: dados.subcategoriaId?.toString().trim() || undefined,
      quantidadeMinima: quantidadeMinima,
      ncm: dados.ncm?.toString().trim() || '',
      valor: dados.valor ? parseFloat(dados.valor.toString().trim().replace(',', '.')) : undefined
    };

    return { item };
  };

  const processarArquivo = async (arquivo: File) => {
    setValidando(true);
    setProgresso(0);

    const validarRegistros = async (cabecalho: string[], linhas: any[][]) => {
      const validos: Omit<Item, 'id' | 'codigoBarras'>[] = [];
      const erros: { linha: number; erro: string; dados: any }[] = [];

      for (let i = 0; i < linhas.length; i++) {
        setProgresso(((i + 1) / linhas.length) * 100);
        const valores = linhas[i] || [];

        // Preencher com vazio quando faltar coluna
        while (valores.length < cabecalho.length) valores.push('');
        if (valores.length > cabecalho.length) {
          erros.push({ linha: i + 2, erro: `Muitas colunas. Esperado: ${cabecalho.length}, Encontrado: ${valores.length}`, dados: valores.slice(0, 5) });
          continue;
        }

        const dados: any = {};
        cabecalho.forEach((campo, index) => { dados[campo] = (valores[index] ?? '').toString(); });

        const validacao = validarLinha(dados, i + 2);
        if (validacao.erro) {
          erros.push({ linha: i + 2, erro: validacao.erro, dados });
        } else if (validacao.item) {
          validos.push(validacao.item);
        }

        if (i % 100 === 0) await new Promise(r => setTimeout(r, 1));
      }

      setResultado({ validos, erros });
    };

    try {
      const nome = arquivo.name.toLowerCase();
      if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
        // Excel
        const buffer = await arquivo.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (rows.length < 2) throw new Error('Arquivo deve ter pelo menos uma linha de cabeçalho e uma de dados');
        const cabecalho = rows[0].map((c: any) => (c ?? '').toString().trim());
        const faltando = camposObrigatorios.filter(c => !cabecalho.includes(c));
        if (faltando.length > 0) throw new Error(`Campos obrigatórios faltando no cabeçalho: ${faltando.join(', ')}`);
        const dadosLinhas = rows.slice(1);
        await validarRegistros(cabecalho, dadosLinhas);
      } else {
        // CSV
        const texto = await arquivo.text();
        const linhasBrutas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (linhasBrutas.length < 2) throw new Error('Arquivo deve ter pelo menos uma linha de cabeçalho e uma de dados');

        const parseCSVLine = (linha: string): string[] => {
          const resultado: string[] = [];
          let atual = '';
          let dentroAspas = false;
          for (let i = 0; i < linha.length; i++) {
            const char = linha[i];
            if (char === '"') {
              if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
              else { dentroAspas = !dentroAspas; }
            } else if (char === ',' && !dentroAspas) {
              resultado.push(atual.trim());
              atual = '';
            } else {
              atual += char;
            }
          }
          resultado.push(atual.trim());
          return resultado;
        };

        const cabecalho = parseCSVLine(linhasBrutas[0]).map(c => c.trim());
        const faltando = camposObrigatorios.filter(c => !cabecalho.includes(c));
        if (faltando.length > 0) throw new Error(`Campos obrigatórios faltando no cabeçalho: ${faltando.join(', ')}`);
        const dadosLinhas = linhasBrutas.slice(1).map(parseCSVLine);
        await validarRegistros(cabecalho, dadosLinhas);
      }
    } catch (error) {
      toast({
        title: 'Erro ao processar arquivo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setValidando(false);
    }
  };

  const handleArquivoSelecionado = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const formatosAceitos = ['.csv', '.xlsx', '.xls'];
      const formatoValido = formatosAceitos.some(formato => fileName.endsWith(formato));
      
      if (!formatoValido) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo CSV ou Excel (.xlsx, .xls).",
          variant: "destructive",
        });
        return;
      }
      setArquivo(file);
      setResultado(null);
    }
  };

  const handleImportar = () => {
    if (resultado?.validos) {
      onImportar(resultado.validos);
      handleClose();
    }
  };

  const handleClose = () => {
    setArquivo(null);
    setResultado(null);
    setValidando(false);
    setProgresso(0);
    onClose();
  };

  return (
    <Dialog open={aberto} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Itens em Lote
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos itens de uma vez usando um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload de arquivo */}
          <div>
            <Label htmlFor="arquivo">Selecionar Arquivo CSV</Label>
            <div className="mt-2">
              <Input
                id="arquivo"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleArquivoSelecionado}
                className="cursor-pointer"
              />
            </div>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 font-semibold mb-2">⚠️ Notas Importantes:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li><strong>Códigos gerados automaticamente:</strong> COD-000001, COD-000002... (pode ignorar a coluna codigoBarras do modelo)</li>
                <li><strong>Campos obrigatórios:</strong> nome, responsavel, unidade</li>
                <li><strong>tipoItem (opcional):</strong> se ausente, será inferido pela coluna categoria (Ferramenta/Insumo)</li>
                <li><strong>Quantidade:</strong> Opcional (padrão: 0 se não informada)</li>
              </ul>
            </div>
          </div>

          {/* Processar arquivo */}
          {arquivo && !resultado && !validando && (
            <div className="flex justify-center">
              <Button onClick={() => processarArquivo(arquivo)} className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Validar Arquivo
              </Button>
            </div>
          )}

          {/* Progresso da validação */}
          {validando && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 animate-spin" />
                <span>Validando arquivo...</span>
              </div>
              <Progress value={progresso} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                {progresso.toFixed(0)}% concluído
              </p>
            </div>
          )}

          {/* Resultado da validação */}
          {resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>{resultado.validos.length}</strong> itens válidos para importação
                  </AlertDescription>
                </Alert>

                {resultado.erros.length > 0 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>{resultado.erros.length}</strong> erros encontrados
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Lista de erros */}
              {resultado.erros.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded p-3">
                  <h4 className="font-semibold text-red-800 mb-2">Erros encontrados:</h4>
                  <div className="space-y-1">
                    {resultado.erros.slice(0, 10).map((erro, index) => (
                      <div key={index} className="text-sm flex items-start gap-2">
                        <X className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Linha {erro.linha}:</strong> {erro.erro}
                        </span>
                      </div>
                    ))}
                    {resultado.erros.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ... e mais {resultado.erros.length - 10} erros
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                
                <Button 
                  onClick={handleImportar}
                  disabled={resultado.validos.length === 0}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Importar {resultado.validos.length} Itens
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};