import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Database, Moon, Sun } from 'lucide-react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { CloudStorageIndicator } from '@/components/gestao-estoque/CloudStorageIndicator';
import { OfflineSyncIndicator } from '@/components/gestao-estoque/OfflineSyncIndicator';

const THEME_STORAGE_KEY = 'almoxarifado-theme';

type Tema = 'light' | 'dark';

export const SeletorEstoque = () => {
  const { estoques, estoqueAtivo, alterarEstoqueAtivo } = useConfiguracoes();
  const { isAdmin, isGestor } = usePermissions();
  const podeVerArmazenamento = isAdmin() || isGestor();
  const [tema, setTema] = useState<Tema>(() => {
    const salvo = localStorage.getItem(THEME_STORAGE_KEY);
    if (salvo === 'light' || salvo === 'dark') return salvo;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    document.documentElement.style.colorScheme = tema;
    localStorage.setItem(THEME_STORAGE_KEY, tema);
  }, [tema]);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
        <Database className="h-4 w-4" />
      </div>

      <Select value={estoqueAtivo} onValueChange={alterarEstoqueAtivo}>
        <SelectTrigger className="h-10 w-44 border-input bg-background text-foreground shadow-sm sm:w-64">
          <SelectValue placeholder="Selecione o estoque" />
        </SelectTrigger>
        <SelectContent>
          {estoques.map((estoque) => (
            <SelectItem key={estoque.id} value={estoque.id}>
              {estoque.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-foreground shadow-sm"
        title={tema === 'dark' ? 'Tema escuro ativo' : 'Tema claro ativo'}
      >
        <Sun className={`h-4 w-4 ${tema === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
        <Switch
          checked={tema === 'dark'}
          onCheckedChange={(checked) => setTema(checked ? 'dark' : 'light')}
          aria-label="Alternar entre tema claro e escuro"
        />
        <Moon className={`h-4 w-4 ${tema === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>

      <OfflineSyncIndicator />
      {podeVerArmazenamento && <CloudStorageIndicator />}
    </div>
  );
};