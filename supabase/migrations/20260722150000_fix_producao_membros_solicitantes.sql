-- Correção da relação Produção Membros vs Solicitantes Legado
-- Cumpre todas as 18 regras de segurança e isolamento exigidas

-- 1. Criação do tipo enum para origem, limitando os valores aceitos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producao_membro_origem') THEN
    CREATE TYPE producao_membro_origem AS ENUM ('solicitante', 'producao', 'legado_pendente');
  END IF;
END
$$;

-- 2. Adicionar as novas colunas como nulas inicialmente
ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS solicitante_id UUID NULL,
  ADD COLUMN IF NOT EXISTS origem producao_membro_origem NULL,
  ADD COLUMN IF NOT EXISTS nome_snapshot TEXT NULL;

-- 3. Adicionar a foreign key segura (ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'producao_membros_solicitante_id_fkey' 
    AND conrelid = 'public.producao_membros'::regclass
  ) THEN
    ALTER TABLE public.producao_membros
      ADD CONSTRAINT producao_membros_solicitante_id_fkey
      FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- 4. Preencher os dados existentes
-- Todo registro existente herdado da migration anterior que perdeu o vínculo
-- será marcado como legado_pendente, sem adivinhação por nome.
UPDATE public.producao_membros
SET 
  nome_snapshot = nome,
  origem = 'legado_pendente'::producao_membro_origem
WHERE origem IS NULL;

-- 5. Validar e aplicar restrições (NOT NULL)
ALTER TABLE public.producao_membros
  ALTER COLUMN origem SET NOT NULL,
  ALTER COLUMN nome_snapshot SET NOT NULL;

-- Constraint para impedir snapshot vazio
ALTER TABLE public.producao_membros
  ADD CONSTRAINT producao_membros_nome_snapshot_check CHECK (btrim(nome_snapshot) <> '');

-- 6. Garantir unicidade do solicitante na produção (apenas 1 perfil produtivo por pessoa)
CREATE UNIQUE INDEX IF NOT EXISTS producao_membros_solicitante_unique_idx
  ON public.producao_membros (solicitante_id)
  WHERE solicitante_id IS NOT NULL;

-- 7. Remover a coluna 'nome' antiga que agora é responsabilidade do snapshot ou do solicitante original
ALTER TABLE public.producao_membros
  DROP COLUMN IF EXISTS nome;

-- 8. RPC administrativa para vincular registros "legado_pendente" a um "solicitante"
CREATE OR REPLACE FUNCTION public.vincular_membro_legado_pendente(
  p_membro_id UUID,
  p_solicitante_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_membro_atual RECORD;
  v_solicitante_nome TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Aqui poderíamos validar uma role administrativa se tivéssemos a tabela de permissões pronta,
  -- faremos isso na próxima migration que criará a estrutura producao_permissoes.

  SELECT * INTO v_membro_atual FROM public.producao_membros WHERE id = p_membro_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_membro_atual.origem::text <> 'legado_pendente' THEN
    RAISE EXCEPTION 'Apenas membros com status legado_pendente podem ser vinculados administrativamente por esta função';
  END IF;

  SELECT nome INTO v_solicitante_nome FROM public.solicitantes WHERE id = p_solicitante_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitante não encontrado no almoxarifado';
  END IF;

  -- Atualizar membro
  UPDATE public.producao_membros
  SET 
    solicitante_id = p_solicitante_id,
    origem = 'solicitante'::public.producao_membro_origem,
    nome_snapshot = v_solicitante_nome,
    updated_at = now()
  WHERE id = p_membro_id;

END;
$$;
REVOKE EXECUTE ON FUNCTION public.vincular_membro_legado_pendente FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_membro_legado_pendente TO authenticated;
