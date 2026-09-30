-- Fundação do módulo RH + Controle de Ponto.
-- Compatível com migração histórica do App Controle, sem duplicar usuários do Auth.
-- IDs históricos podem ser preservados; origem_sistema/origem_id garantem rastreabilidade.

BEGIN;

-- ---------------------------------------------------------------------------
-- Permissões canônicas do novo módulo.
-- ---------------------------------------------------------------------------
INSERT INTO public.permissoes_catalogo (chave, modulo, grupo, nome, descricao, ordem)
VALUES
  ('rh.acessar', 'RH', 'Acesso', 'Acessar RH', 'Abre o módulo de Recursos Humanos.', 1200),
  ('rh.colaboradores.visualizar', 'RH', 'Colaboradores', 'Visualizar colaboradores', 'Consulta os cadastros de colaboradores do RH.', 1210),
  ('rh.colaboradores.gerenciar', 'RH', 'Colaboradores', 'Gerenciar colaboradores', 'Cria e altera cadastros e vínculos de colaboradores.', 1220),
  ('rh.jornadas.gerenciar', 'RH', 'Jornadas', 'Gerenciar jornadas', 'Cria e altera jornadas contratuais de trabalho.', 1230),
  ('rh.feriados.gerenciar', 'RH', 'Feriados', 'Gerenciar feriados', 'Cria e altera o calendário de feriados usado pelo ponto.', 1240),
  ('ponto.registrar', 'Ponto', 'Meu Ponto', 'Registrar o próprio ponto', 'Permite ao colaborador registrar suas próprias batidas de ponto.', 1300),
  ('ponto.visualizar', 'Ponto', 'Controle', 'Visualizar ponto', 'Consulta registros e espelhos de ponto.', 1310),
  ('ponto.gerenciar', 'Ponto', 'Controle', 'Gerenciar ponto', 'Inclui e corrige registros administrativos de ponto.', 1320),
  ('ponto.aprovar', 'Ponto', 'Aprovação', 'Aprovar ponto', 'Aprova ou rejeita registros de ponto.', 1330)
ON CONFLICT (chave) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  grupo = EXCLUDED.grupo,
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ordem = EXCLUDED.ordem,
  ativo = true,
  updated_at = now();

INSERT INTO public.perfil_permissoes (tipo_usuario, permissao_id, permitido)
SELECT ptu.tipo_usuario, c.id, false
FROM public.permissoes_tipo_usuario ptu
CROSS JOIN public.permissoes_catalogo c
WHERE c.chave IN (
  'rh.acessar','rh.colaboradores.visualizar','rh.colaboradores.gerenciar',
  'rh.jornadas.gerenciar','rh.feriados.gerenciar',
  'ponto.registrar','ponto.visualizar','ponto.gerenciar','ponto.aprovar'
)
ON CONFLICT (tipo_usuario, permissao_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Jornadas: fonte canônica para RH/Ponto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NULL,
  domingo_entrada_1 time NULL,
  domingo_saida_1 time NULL,
  domingo_entrada_2 time NULL,
  domingo_saida_2 time NULL,
  segunda_entrada_1 time NULL,
  segunda_saida_1 time NULL,
  segunda_entrada_2 time NULL,
  segunda_saida_2 time NULL,
  terca_entrada_1 time NULL,
  terca_saida_1 time NULL,
  terca_entrada_2 time NULL,
  terca_saida_2 time NULL,
  quarta_entrada_1 time NULL,
  quarta_saida_1 time NULL,
  quarta_entrada_2 time NULL,
  quarta_saida_2 time NULL,
  quinta_entrada_1 time NULL,
  quinta_saida_1 time NULL,
  quinta_entrada_2 time NULL,
  quinta_saida_2 time NULL,
  sexta_entrada_1 time NULL,
  sexta_saida_1 time NULL,
  sexta_entrada_2 time NULL,
  sexta_saida_2 time NULL,
  sabado_entrada_1 time NULL,
  sabado_saida_1 time NULL,
  sabado_entrada_2 time NULL,
  sabado_saida_2 time NULL,
  feriado_entrada_1 time NULL,
  feriado_saida_1 time NULL,
  feriado_entrada_2 time NULL,
  feriado_saida_2 time NULL,
  carga_horaria_semanal numeric NULL DEFAULT 40,
  ativo boolean NOT NULL DEFAULT true,
  personalizada_para_colaborador_id uuid NULL,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_jornadas_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_jornadas_origem_unique UNIQUE (origem_sistema, origem_id)
);

-- ---------------------------------------------------------------------------
-- Colaboradores: identidade canônica de pessoa do RH.
-- user_id é opcional: colaborador pode existir sem login.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text NULL,
  departamento text NULL,
  ativo boolean NOT NULL DEFAULT true,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NULL,
  cpf_cnpj text NULL,
  telefone text NULL,
  data_nascimento date NULL,
  endereco text NULL,
  cidade text NULL,
  estado text NULL,
  cep text NULL,
  salario numeric NULL,
  data_admissao date NULL,
  pis text NULL,
  jornada_id uuid NULL REFERENCES public.rh_jornadas(id) ON DELETE SET NULL,
  tipo_contrato text NULL DEFAULT 'clt',
  valor_contrato numeric NULL,
  controla_ponto boolean NOT NULL DEFAULT false,
  hora_extra_gera_valor boolean NOT NULL DEFAULT true,
  rh_ativo boolean NOT NULL DEFAULT true,
  rh_cadastrado boolean NOT NULL DEFAULT false,
  pista_ativo_legado boolean NOT NULL DEFAULT false,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_colaboradores_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_colaboradores_tipo_contrato CHECK (
    tipo_contrato IS NULL OR lower(btrim(tipo_contrato)) IN ('clt','pj','diarista','horista')
  ),
  CONSTRAINT rh_colaboradores_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_user_unique
  ON public.rh_colaboradores(user_id)
  WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rh_jornadas_personalizada_colaborador_fkey'
  ) THEN
    ALTER TABLE public.rh_jornadas
      ADD CONSTRAINT rh_jornadas_personalizada_colaborador_fkey
      FOREIGN KEY (personalizada_para_colaborador_id)
      REFERENCES public.rh_colaboradores(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Calendário de feriados.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data date NOT NULL,
  tipo text NULL DEFAULT 'nacional',
  ativo boolean NOT NULL DEFAULT true,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_feriados_nome_nao_vazio CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_feriados_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE INDEX IF NOT EXISTS rh_feriados_data_idx
  ON public.rh_feriados(data);

-- ---------------------------------------------------------------------------
-- Registro diário de ponto: até 3 pares de entrada/saída, igual ao App Controle.
-- Métricas numéricas são preservadas como snapshot histórico e podem ser
-- recalculadas pela aplicação a partir das batidas/jornada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada_1 time NULL,
  hora_saida_1 time NULL,
  hora_entrada_2 time NULL,
  hora_saida_2 time NULL,
  hora_entrada_3 time NULL,
  hora_saida_3 time NULL,
  observacao text NULL,
  status text NOT NULL DEFAULT 'pendente',
  criado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz NULL,
  horas_trabalhadas_snapshot integer NULL DEFAULT 0,
  horas_extras_50_snapshot integer NULL DEFAULT 0,
  horas_extras_100_snapshot integer NULL DEFAULT 0,
  horas_falta_snapshot integer NULL DEFAULT 0,
  horas_atraso_snapshot integer NULL DEFAULT 0,
  adicional_noturno_snapshot integer NULL DEFAULT 0,
  is_feriado_snapshot boolean NULL DEFAULT false,
  is_domingo_snapshot boolean NULL DEFAULT false,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_registros_ponto_status CHECK (status IN ('pendente','aprovado','rejeitado')),
  CONSTRAINT rh_registros_ponto_dia_unique UNIQUE (colaborador_id, data),
  CONSTRAINT rh_registros_ponto_origem_unique UNIQUE (origem_sistema, origem_id)
);

CREATE INDEX IF NOT EXISTS rh_registros_ponto_colaborador_data_idx
  ON public.rh_registros_ponto(colaborador_id, data DESC);
CREATE INDEX IF NOT EXISTS rh_registros_ponto_status_idx
  ON public.rh_registros_ponto(status, data DESC);

-- ---------------------------------------------------------------------------
-- Dias já pagos: preserva o comportamento histórico existente no App Controle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_ponto_dias_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  data date NOT NULL,
  valor_diaria numeric NOT NULL DEFAULT 0,
  valor_adicionais numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  pago_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  origem_sistema text NOT NULL DEFAULT 'fluxo_estoque_dinamico',
  origem_id uuid NULL,
  importado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_ponto_dias_pagos_unique UNIQUE (colaborador_id, data),
  CONSTRAINT rh_ponto_dias_pagos_origem_unique UNIQUE (origem_sistema, origem_id)
);

-- ---------------------------------------------------------------------------
-- Auditoria das importações.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_importacoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_sistema text NOT NULL,
  entidade text NOT NULL,
  origem_id uuid NULL,
  destino_id uuid NULL,
  acao text NOT NULL CHECK (acao IN ('inserido','atualizado','ignorado','erro')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_importacoes_auditoria_origem_idx
  ON public.rh_importacoes_auditoria(origem_sistema, entidade, origem_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_rh_jornadas_updated_at ON public.rh_jornadas;
CREATE TRIGGER trg_rh_jornadas_updated_at
BEFORE UPDATE ON public.rh_jornadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated_at ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated_at
BEFORE UPDATE ON public.rh_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_registros_ponto_updated_at ON public.rh_registros_ponto;
CREATE TRIGGER trg_rh_registros_ponto_updated_at
BEFORE UPDATE ON public.rh_registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rh_ponto_dias_pagos_updated_at ON public.rh_ponto_dias_pagos;
CREATE TRIGGER trg_rh_ponto_dias_pagos_updated_at
BEFORE UPDATE ON public.rh_ponto_dias_pagos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Identificação segura do colaborador autenticado.
-- 1) user_id explícito; 2) e-mail único do perfil para vínculo automático.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_current_user_colaborador_id()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_colaborador_id uuid;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT c.id INTO v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id = v_user_id
    AND c.ativo = true
    AND c.rh_ativo = true
    AND c.controla_ponto = true
  LIMIT 1;

  IF v_colaborador_id IS NOT NULL THEN RETURN v_colaborador_id; END IF;

  SELECT lower(btrim(coalesce(p.email, u.email, '')))
    INTO v_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = v_user_id;

  IF coalesce(v_email, '') = '' THEN RETURN NULL; END IF;

  SELECT count(*), min(c.id)
    INTO v_count, v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id IS NULL
    AND c.ativo = true
    AND c.rh_ativo = true
    AND c.controla_ponto = true
    AND lower(btrim(coalesce(c.email, ''))) = v_email;

  IF v_count <> 1 OR v_colaborador_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.rh_colaboradores
  SET user_id = v_user_id
  WHERE id = v_colaborador_id AND user_id IS NULL;

  RETURN v_colaborador_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_current_user_colaborador_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_current_user_colaborador_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Registro atômico do próprio ponto, usando horário oficial do servidor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_registrar_meu_ponto_agora()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_colaborador_id uuid;
  v_nome text;
  v_timestamp timestamp without time zone;
  v_data date;
  v_hora time without time zone;
  v_entry public.rh_registros_ponto%ROWTYPE;
  v_campo text;
  v_rotulo text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.usuario_tem_permissao('ponto.registrar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para registrar ponto';
  END IF;

  v_colaborador_id := public.rh_current_user_colaborador_id();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a colaborador ativo habilitado para ponto';
  END IF;

  SELECT nome INTO v_nome FROM public.rh_colaboradores WHERE id = v_colaborador_id;

  v_timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_data := v_timestamp::date;
  v_hora := date_trunc('minute', v_timestamp)::time;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_colaborador_id::text || ':' || v_data::text, 0));

  SELECT * INTO v_entry
  FROM public.rh_registros_ponto
  WHERE colaborador_id = v_colaborador_id AND data = v_data
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    INSERT INTO public.rh_registros_ponto (
      colaborador_id, data, hora_entrada_1, status, criado_por
    ) VALUES (
      v_colaborador_id, v_data, v_hora, 'pendente', v_user_id
    )
    RETURNING * INTO v_entry;
    v_campo := 'hora_entrada_1';
    v_rotulo := 'Entrada 1';
  ELSE
    IF v_entry.hora_entrada_1 IS NULL THEN
      v_campo := 'hora_entrada_1'; v_rotulo := 'Entrada 1';
    ELSIF v_entry.hora_saida_1 IS NULL THEN
      v_campo := 'hora_saida_1'; v_rotulo := 'Saída 1';
    ELSIF v_entry.hora_entrada_2 IS NULL THEN
      v_campo := 'hora_entrada_2'; v_rotulo := 'Entrada 2';
    ELSIF v_entry.hora_saida_2 IS NULL THEN
      v_campo := 'hora_saida_2'; v_rotulo := 'Saída 2';
    ELSIF v_entry.hora_entrada_3 IS NULL THEN
      v_campo := 'hora_entrada_3'; v_rotulo := 'Entrada 3';
    ELSIF v_entry.hora_saida_3 IS NULL THEN
      v_campo := 'hora_saida_3'; v_rotulo := 'Saída 3';
    ELSE
      RAISE EXCEPTION 'Todos os horários de hoje já foram registrados';
    END IF;

    EXECUTE format(
      'UPDATE public.rh_registros_ponto
       SET %I = $1, status = ''pendente'', aprovado_por = NULL, aprovado_em = NULL
       WHERE id = $2',
      v_campo
    ) USING v_hora, v_entry.id;
  END IF;

  RETURN jsonb_build_object(
    'entry_id', v_entry.id,
    'colaborador_id', v_colaborador_id,
    'colaborador_nome', v_nome,
    'data', v_data,
    'hora', to_char(v_hora, 'HH24:MI'),
    'campo', v_campo,
    'rotulo', v_rotulo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rh_registrar_meu_ponto_agora() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_registrar_meu_ponto_agora() TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_get_meu_ponto_snapshot(p_mes date)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_colaborador_id uuid;
  v_nome text;
  v_inicio date;
  v_fim date;
  v_entries jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.usuario_tem_permissao('ponto.registrar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o próprio ponto';
  END IF;

  v_colaborador_id := public.rh_current_user_colaborador_id();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a colaborador ativo habilitado para ponto';
  END IF;

  SELECT nome INTO v_nome FROM public.rh_colaboradores WHERE id = v_colaborador_id;
  v_inicio := date_trunc('month', coalesce(p_mes, current_date))::date;
  v_fim := (v_inicio + interval '1 month - 1 day')::date;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.data DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id, data,
      hora_entrada_1, hora_saida_1,
      hora_entrada_2, hora_saida_2,
      hora_entrada_3, hora_saida_3,
      observacao, status
    FROM public.rh_registros_ponto
    WHERE colaborador_id = v_colaborador_id
      AND data BETWEEN v_inicio AND v_fim
  ) x;

  RETURN jsonb_build_object(
    'colaborador', jsonb_build_object('id', v_colaborador_id, 'nome', v_nome),
    'entries', v_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rh_get_meu_ponto_snapshot(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_get_meu_ponto_snapshot(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: dados sensíveis de RH não ficam expostos aos demais módulos.
-- ---------------------------------------------------------------------------
ALTER TABLE public.rh_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_ponto_dias_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_importacoes_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_jornadas_select ON public.rh_jornadas;
CREATE POLICY rh_jornadas_select ON public.rh_jornadas FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('rh.acessar')
  OR public.usuario_tem_permissao('ponto.visualizar')
  OR public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
);
DROP POLICY IF EXISTS rh_jornadas_write ON public.rh_jornadas;
CREATE POLICY rh_jornadas_write ON public.rh_jornadas FOR ALL TO authenticated
USING (public.usuario_tem_permissao('rh.jornadas.gerenciar'))
WITH CHECK (public.usuario_tem_permissao('rh.jornadas.gerenciar'));

DROP POLICY IF EXISTS rh_colaboradores_select ON public.rh_colaboradores;
CREATE POLICY rh_colaboradores_select ON public.rh_colaboradores FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('rh.colaboradores.visualizar')
  OR public.usuario_tem_permissao('rh.colaboradores.gerenciar')
  OR public.usuario_tem_permissao('ponto.visualizar')
  OR public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
);
DROP POLICY IF EXISTS rh_colaboradores_write ON public.rh_colaboradores;
CREATE POLICY rh_colaboradores_write ON public.rh_colaboradores FOR ALL TO authenticated
USING (public.usuario_tem_permissao('rh.colaboradores.gerenciar'))
WITH CHECK (public.usuario_tem_permissao('rh.colaboradores.gerenciar'));

DROP POLICY IF EXISTS rh_feriados_select ON public.rh_feriados;
CREATE POLICY rh_feriados_select ON public.rh_feriados FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('rh.acessar')
  OR public.usuario_tem_permissao('ponto.visualizar')
  OR public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
);
DROP POLICY IF EXISTS rh_feriados_write ON public.rh_feriados;
CREATE POLICY rh_feriados_write ON public.rh_feriados FOR ALL TO authenticated
USING (public.usuario_tem_permissao('rh.feriados.gerenciar'))
WITH CHECK (public.usuario_tem_permissao('rh.feriados.gerenciar'));

DROP POLICY IF EXISTS rh_registros_ponto_select ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_select ON public.rh_registros_ponto FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('ponto.visualizar')
  OR public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
);
DROP POLICY IF EXISTS rh_registros_ponto_insert_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_insert_admin ON public.rh_registros_ponto FOR INSERT TO authenticated
WITH CHECK (public.usuario_tem_permissao('ponto.gerenciar'));
DROP POLICY IF EXISTS rh_registros_ponto_update_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_update_admin ON public.rh_registros_ponto FOR UPDATE TO authenticated
USING (
  public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
)
WITH CHECK (
  public.usuario_tem_permissao('ponto.gerenciar')
  OR public.usuario_tem_permissao('ponto.aprovar')
);
DROP POLICY IF EXISTS rh_registros_ponto_delete_admin ON public.rh_registros_ponto;
CREATE POLICY rh_registros_ponto_delete_admin ON public.rh_registros_ponto FOR DELETE TO authenticated
USING (public.usuario_tem_permissao('ponto.gerenciar'));

DROP POLICY IF EXISTS rh_ponto_dias_pagos_select ON public.rh_ponto_dias_pagos;
CREATE POLICY rh_ponto_dias_pagos_select ON public.rh_ponto_dias_pagos FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('rh.acessar')
  OR public.usuario_tem_permissao('ponto.visualizar')
  OR public.usuario_tem_permissao('ponto.gerenciar')
);
DROP POLICY IF EXISTS rh_ponto_dias_pagos_write ON public.rh_ponto_dias_pagos;
CREATE POLICY rh_ponto_dias_pagos_write ON public.rh_ponto_dias_pagos FOR ALL TO authenticated
USING (public.usuario_tem_permissao('ponto.gerenciar'))
WITH CHECK (public.usuario_tem_permissao('ponto.gerenciar'));

DROP POLICY IF EXISTS rh_importacoes_auditoria_select ON public.rh_importacoes_auditoria;
CREATE POLICY rh_importacoes_auditoria_select ON public.rh_importacoes_auditoria FOR SELECT TO authenticated
USING (
  public.usuario_tem_permissao('rh.colaboradores.gerenciar')
  OR public.usuario_tem_permissao('administracao.auditoria.visualizar')
);

REVOKE ALL ON public.rh_importacoes_auditoria FROM anon, authenticated;
GRANT SELECT ON public.rh_importacoes_auditoria TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
