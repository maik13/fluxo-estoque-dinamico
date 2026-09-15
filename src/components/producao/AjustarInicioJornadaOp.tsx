import { FormEvent, useEffect, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ajustarInicioJornadaOp,
  type JornadaOpAberta,
} from '@/services/producao/jornadasOrdemProducao';

interface Props {
  jornada: JornadaOpAberta;
  disabled?: boolean;
  onAjustado: (jornada: JornadaOpAberta) => void;
}

const dataLocal = (valor: Date) => {
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const horaLocal = (valor: Date) =>
  `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}`;

const hoje = () => dataLocal(new Date());

export const AjustarInicioJornadaOp = ({
  jornada,
  disabled = false,
  onAjustado,
}: Props) => {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const preencher = () => {
    const valor = new Date(jornada.iniciado_em);
    setData(dataLocal(valor));
    setInicio(horaLocal(valor));
    setMotivo('');
  };

  useEffect(() => {
    if (aberto) preencher();
  }, [aberto, jornada.iniciado_em]);

  const salvar = async (event: FormEvent) => {
    event.preventDefault();

    if (!data || !inicio) {
      toast.error('Informe a data e o horário reais de início.');
      return;
    }
    if (!motivo.trim()) {
      toast.error('Informe por que o horário de início está sendo corrigido.');
      return;
    }

    setSalvando(true);
    try {
      const resultado = await ajustarInicioJornadaOp({
        jornadaId: jornada.id,
        data,
        inicio,
        motivo: motivo.trim(),
      });

      onAjustado({
        ...jornada,
        iniciado_em: resultado.iniciadoEm,
        pendente_dia_anterior: resultado.data < hoje(),
      });
      setAberto(false);
      toast.success(
        'Início real ajustado. O horário capturado originalmente foi preservado na auditoria.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível ajustar o início da jornada.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => !salvando && setAberto(open)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          title="Corrigir o início real da jornada com registro de auditoria"
        >
          <Clock3 className="mr-2 h-4 w-4" />
          Ajustar início
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar início real da jornada</DialogTitle>
          <DialogDescription>
            Use somente quando o apontador iniciou o registro depois do horário em que o trabalho realmente começou. O horário originalmente capturado não será apagado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data real *</Label>
              <Input
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                disabled={salvando}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Horário real de início *</Label>
              <Input
                type="time"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
                disabled={salvando}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo da correção *</Label>
            <Textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Ex.: operador iniciou o apontamento às 10:43, mas o trabalho começou às 08:00."
              rows={3}
              disabled={salvando}
              required
            />
          </div>

          <p className="text-xs text-muted-foreground">
            A auditoria registrará o horário capturado originalmente, o novo horário informado, quem fez a alteração, quando ela foi feita e a justificativa.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !motivo.trim()}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
