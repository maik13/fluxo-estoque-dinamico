import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProcessosProducaoHierarquico } from '@/components/producao/ProcessosProducaoHierarquico';

const projetoCasaNoel = {
  id: '7c1bcdce-7ddf-4dc7-9a94-3107595bffda',
  config_id: '7c1bcdce-7ddf-4dc7-9a94-3107595bffda',
  local_utilizacao_id: '927f6949-b8e3-4d3c-8722-a8f978db7775',
  group_id: 'c031b608-1cab-49ca-8f6f-992491d7eca7',
  grupo_nome: 'Natal Brusque',
  nome: 'RFM-CASA NOEL',
  descricao: 'Reforma',
  cliente: 'Banbusa',
  cidade: 'Maringá',
  uf: null,
  local_execucao: 'Maringá',
  endereco_execucao: 'Caramuru, 287',
  data_inicio_prevista: null,
  data_fim_prevista: null,
  responsavel_id: null,
  responsavel_nome_snapshot: 'João Ricardo',
  observacoes: null,
  ativo: true,
  configurado: true,
  criado_por_id: null,
  criado_por_nome_snapshot: null,
  atualizado_por_id: null,
  atualizado_por_nome_snapshot: null,
  created_at: '2026-08-06T18:10:16.782448+00:00',
  updated_at: '2026-09-18T21:11:10.025899+00:00',
};

const etapas = [
  {
    id: '2c3de834-f98f-4f9e-9114-8806b7162ecc',
    projeto_id: projetoCasaNoel.id,
    codigo: 'PRD-2026-000033',
    nome: 'Etapa 1',
    status: 'planejado',
    prioridade: 'normal',
    sequencia: 901,
    data_inicio_prevista: null,
    data_fim_prevista: null,
    data_inicio_desejada: null,
    data_limite: null,
    data_inicio_real: null,
    data_fim_real: null,
    projeto: {
      nome: projetoCasaNoel.nome,
      cidade: projetoCasaNoel.cidade,
      uf: projetoCasaNoel.uf,
      local_utilizacao_id: projetoCasaNoel.local_utilizacao_id,
    },
  },
  {
    id: '6d437043-657b-4f17-906a-691d8f8a0f71',
    projeto_id: projetoCasaNoel.id,
    codigo: 'PRD-2026-000034',
    nome: 'Etapa 2',
    status: 'em_andamento',
    prioridade: 'normal',
    sequencia: 902,
    data_inicio_prevista: null,
    data_fim_prevista: null,
    data_inicio_desejada: null,
    data_limite: null,
    data_inicio_real: '2026-09-18',
    data_fim_real: null,
    projeto: {
      nome: projetoCasaNoel.nome,
      cidade: projetoCasaNoel.cidade,
      uf: projetoCasaNoel.uf,
      local_utilizacao_id: projetoCasaNoel.local_utilizacao_id,
    },
  },
  {
    id: '8d540025-3b46-4c23-9474-ba6a50cc1be2',
    projeto_id: projetoCasaNoel.id,
    codigo: 'PRD-2026-000035',
    nome: 'Etapa 3',
    status: 'em_andamento',
    prioridade: 'normal',
    sequencia: 903,
    data_inicio_prevista: null,
    data_fim_prevista: null,
    data_inicio_desejada: null,
    data_limite: null,
    data_inicio_real: '2026-09-14',
    data_fim_real: null,
    projeto: {
      nome: projetoCasaNoel.nome,
      cidade: projetoCasaNoel.cidade,
      uf: projetoCasaNoel.uf,
      local_utilizacao_id: projetoCasaNoel.local_utilizacao_id,
    },
  },
];

const ordens = [
  {
    id: 'bdc407d7-1d11-48b2-a7a3-5160be64cef4',
    numero: 77,
    projeto_id: projetoCasaNoel.id,
    processo_id: etapas[1].id,
    status: 'em_execucao',
    quantidade_planejada: 1,
    quantidade_realizada: 0,
    percentual_realizado: 0,
    unidade_medida: null,
    duracao_estimada_horas: 8,
    equipe_prevista: 2,
    esforco_estimado_horas_homem: 16,
    tarefa_nome_snapshot: 'Montagem',
    descricao: 'produção',
    responsavel_nome_snapshot: null,
    data_inicio_prevista: '2026-09-29',
    data_fim_prevista: '2026-09-29',
    prioridade: 'normal',
    project_group_id: null,
    project_group_nome: null,
  },
];

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isAdmin: () => true,
    canConfigurarProducao: () => true,
  }),
}));

vi.mock('@/hooks/useProjetosProducao', () => ({
  useProjetosProducao: () => ({
    projetos: [projetoCasaNoel],
    loading: false,
    erro: null,
    listarProjetos: vi.fn().mockResolvedValue([projetoCasaNoel]),
  }),
}));

vi.mock('@/hooks/useProcessosProducao', () => ({
  useProcessosProducao: () => ({
    processos: etapas,
    loading: false,
    listarProcessos: vi.fn().mockResolvedValue(etapas),
    transicaoProcesso: vi.fn(),
    obterResumoFinalizacao: vi.fn(),
    obterResumoExclusao: vi.fn(),
    excluirProcesso: vi.fn(),
    criarProcesso: vi.fn(),
    listarDependencias: vi.fn().mockResolvedValue([]),
    obterProximoCodigo: vi.fn().mockResolvedValue('PRD-2026-000036'),
  }),
}));

vi.mock('@/hooks/useOrdensProducao', () => ({
  useOrdensProducao: () => ({
    ordens,
    listarOrdens: vi.fn().mockResolvedValue(ordens),
    criarOrdem: vi.fn(),
    transicaoOrdem: vi.fn(),
  }),
  formatarIdentificacaoOrdemProducao: (ordem: any) =>
    `OP ${String(ordem.numero).padStart(6, '0')} — ${ordem.tarefa_nome_snapshot ?? ordem.descricao ?? ''}`,
  ordemProducaoEDePintura: () => false,
}));

vi.mock('@/services/producao/jornadasOrdemProducao', () => ({
  listarJornadasOpAbertas: vi.fn().mockResolvedValue([]),
  iniciarJornadaOp: vi.fn(),
}));

vi.mock('@/services/producao/finalizarOrdemProducao', () => ({
  finalizarOrdemProducaoComConferencia: vi.fn(),
  FinalizacaoParcialOrdemProducaoError: class extends Error {},
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

describe('Etapas - Casa Noel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre Casa Noel e mostra as três etapas sem quebrar o layout', async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <ProcessosProducaoHierarquico
          tarefas={[]}
          membros={[]}
          onFecharJornada={vi.fn()}
        />
      </TooltipProvider>,
    );

    const cardCasaNoel = await screen.findByText('RFM-CASA NOEL');
    await user.click(cardCasaNoel);

    expect(await screen.findByText('Etapas do projeto')).toBeInTheDocument();
    expect(screen.getByText('Etapa 1')).toBeInTheDocument();
    expect(screen.getByText('Etapa 2')).toBeInTheDocument();
    expect(screen.getByText('Etapa 3')).toBeInTheDocument();
    expect(screen.getByText('Progresso global')).toBeInTheDocument();
  });
});
