import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Database, Clock, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  id: string;
  created_at: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  profiles: {
    nome: string;
  } | null;
}

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState('');

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('action_logs')
        .select(`
          *,
          profiles:user_id (
            nome
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data as LogEntry[]) || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  const logsFiltrados = logs.filter(log => {
    const busca = filtroTexto.toLowerCase();
    const nomeUsuario = log.profiles?.nome?.toLowerCase() || '';
    const acao = log.action.toLowerCase();
    const detalhes = JSON.stringify(log.details).toLowerCase();
    
    return nomeUsuario.includes(busca) || acao.includes(busca) || detalhes.includes(busca);
  });

  const formatarAcao = (acao: string) => {
    switch (acao) {
      case 'EDICAO_DESTINO_MOVIMENTACAO':
        return 'Edição de Destino';
      case 'EXCLUSAO_MOVIMENTACAO':
        return 'Exclusão de Movimentação';
      default:
        return acao;
    }
  };

  const renderDetails = (details: any) => {
    if (!details) return '-';
    
    if (details && typeof details === 'object') {
      return (
        <div className="text-xs space-y-1">
          {details.item_nome && <p><strong>Item:</strong> {details.item_nome}</p>}
          {details.antigo_local_nome && details.novo_local_nome && (
            <p>
              <strong>De:</strong> <span className="text-muted-foreground line-through">{details.antigo_local_nome}</span>{' '}
              <strong>Para:</strong> <span className="text-primary font-medium">{details.novo_local_nome}</span>
            </p>
          )}
          {Object.entries(details).map(([key, value]) => {
            if (['item_nome', 'antigo_local_nome', 'novo_local_nome', 'antigo_local_id', 'novo_local_id'].includes(key)) return null;
            return <p key={key}><strong>{key}:</strong> {JSON.stringify(value)}</p>;
          })}
        </div>
      );
    }
    
    return JSON.stringify(details);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por usuário, ação ou conteúdo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={carregarLogs} disabled={loading}>
          <Clock className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Data/Hora</TableHead>
              <TableHead className="w-[150px]">Usuário</TableHead>
              <TableHead className="w-[180px]">Ação</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Carregando logs...</TableCell>
              </TableRow>
            ) : logsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              logsFiltrados.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{log.profiles?.nome || 'Sistema'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {formatarAcao(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {renderDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Componente de botão local para evitar erro de importação se usado no mesmo arquivo
const Button = ({ children, variant, size, onClick, disabled, className }: any) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${
        variant === 'outline' ? 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground' : 'bg-primary text-primary-foreground shadow hover:bg-primary/90'
      } ${size === 'icon' ? 'h-9 w-9' : 'h-9 px-4 py-2'} ${className}`}
    >
      {children}
    </button>
  );
};
