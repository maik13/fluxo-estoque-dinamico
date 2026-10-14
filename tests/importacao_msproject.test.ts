import { describe, expect, it } from 'vitest';
import {
  resumirSimulacaoImportacao,
  type AcaoImportacaoMSP,
  type AtividadeMSProject,
} from '@/services/producao/importacaoMSProject';

const atividade: AtividadeMSProject = {
  taskUid: '841', edt: '1.21', codigoPeca: 'CAN', nomePecaProject: 'Casa Noel',
  projetoId: '00000000-0000-0000-0000-000000000001', projetoNomeCompleto: 'TEC-29 - Casa do Papai Noel · Brusque',
  etapa: 2, atividade: 'Montagem fabril', inicio: '2026-08-03', termino: '2026-08-05',
  duracaoHoras: 16, quantidadePlanejada: 1, tarefaId: '00000000-0000-0000-0000-000000000002',
  equipePrevista: 2, localTipo: 'Fábrica',
};

describe('simulação da importação do MS Project', () => {
  it('separa criação, conciliação e bloqueios sem gravar no banco', () => {
    const acoes: AcaoImportacaoMSP[] = [
      { origem: atividade, acao: 'criar', motivo: 'Task UID sem OP correspondente', etapaId: 'etapa-2' },
      { origem: { ...atividade, taskUid: '842' }, acao: 'manter_existente', motivo: 'Task UID original já vinculada à OP', opId: 'op-1' },
      { origem: { ...atividade, taskUid: '843' }, acao: 'bloquear', motivo: 'OP correlata com APs existentes; preservar execução antes de qualquer associação' },
      { origem: { ...atividade, taskUid: '844' }, acao: 'bloquear', motivo: 'OP correlata com APs existentes; preservar execução antes de qualquer associação' },
    ];

    expect(resumirSimulacaoImportacao(acoes)).toEqual({
      total: 4, criar: 1, manterExistente: 1, bloqueadas: 2,
      bloqueios: ['OP correlata com APs existentes; preservar execução antes de qualquer associação'],
    });
  });
});
