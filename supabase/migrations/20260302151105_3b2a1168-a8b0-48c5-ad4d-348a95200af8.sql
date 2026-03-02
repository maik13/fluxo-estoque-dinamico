
-- Adicionar colunas de permissão para cada funcionalidade do menu
ALTER TABLE public.permissoes_tipo_usuario 
  ADD COLUMN IF NOT EXISTS pode_solicitar_material boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_devolver_material boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_registrar_entrada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_transferir boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_registrar_saida boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_pedido_compra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_solicitacao_material boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_ver_relatorios boolean NOT NULL DEFAULT true;

-- Definir permissões padrão por tipo de usuário
-- Administrador: tudo habilitado
UPDATE public.permissoes_tipo_usuario SET
  pode_solicitar_material = true,
  pode_devolver_material = true,
  pode_registrar_entrada = true,
  pode_transferir = true,
  pode_registrar_saida = true,
  pode_pedido_compra = true,
  pode_solicitacao_material = true,
  pode_ver_relatorios = true
WHERE tipo_usuario = 'administrador';

-- Gestor: tudo habilitado
UPDATE public.permissoes_tipo_usuario SET
  pode_solicitar_material = true,
  pode_devolver_material = true,
  pode_registrar_entrada = true,
  pode_transferir = true,
  pode_registrar_saida = true,
  pode_pedido_compra = true,
  pode_solicitacao_material = true,
  pode_ver_relatorios = true
WHERE tipo_usuario = 'gestor';

-- Engenharia: solicitar material, solicitação de material, relatórios
UPDATE public.permissoes_tipo_usuario SET
  pode_solicitar_material = true,
  pode_devolver_material = false,
  pode_registrar_entrada = false,
  pode_transferir = false,
  pode_registrar_saida = false,
  pode_pedido_compra = false,
  pode_solicitacao_material = true,
  pode_ver_relatorios = true
WHERE tipo_usuario = 'engenharia';

-- Mestre: solicitar, devolver, saída, solicitação material
UPDATE public.permissoes_tipo_usuario SET
  pode_solicitar_material = true,
  pode_devolver_material = true,
  pode_registrar_entrada = false,
  pode_transferir = false,
  pode_registrar_saida = true,
  pode_pedido_compra = false,
  pode_solicitacao_material = true,
  pode_ver_relatorios = true
WHERE tipo_usuario = 'mestre';

-- Estoquista: entrada, saída, devolver, transferir
UPDATE public.permissoes_tipo_usuario SET
  pode_solicitar_material = true,
  pode_devolver_material = true,
  pode_registrar_entrada = true,
  pode_transferir = true,
  pode_registrar_saida = true,
  pode_pedido_compra = true,
  pode_solicitacao_material = true,
  pode_ver_relatorios = true
WHERE tipo_usuario = 'estoquista';
