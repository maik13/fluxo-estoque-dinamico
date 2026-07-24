export type EstadoPermissaoUsuario = 'herdar' | 'permitir' | 'negar';

export interface PermissaoExistenteDefinicao {
  campo: string;
  chave: string;
  modulo: string;
  grupo: string;
  nome: string;
  descricao: string;
  ordem: number;
}

export const PERMISSOES_EXISTENTES: PermissaoExistenteDefinicao[] = [
  ['pode_cadastrar_itens','estoque.itens.criar','Estoque','Gestão de Itens','Cadastrar itens','Permite cadastrar novos itens no estoque.',10],
  ['pode_editar_itens','estoque.itens.editar','Estoque','Gestão de Itens','Editar itens','Permite alterar dados dos itens existentes.',20],
  ['pode_excluir_itens','estoque.itens.excluir','Estoque','Gestão de Itens','Excluir itens','Permite excluir itens quando as regras aceitarem.',30],
  ['pode_registrar_movimentacoes','estoque.movimentacoes.registrar','Estoque','Movimentações','Registrar movimentações','Permissão geral para registrar movimentações.',40],
  ['pode_solicitar_material','estoque.solicitacoes.solicitar','Estoque','Retirada e devolução','Retirada de Material','Libera o cartão verde Retirada de Material para solicitar itens existentes no estoque e encaminhá-los para aprovação.',50],
  ['pode_devolver_material','estoque.solicitacoes.devolver','Estoque','Retirada e devolução','Devolver material','Permite registrar devoluções de materiais retirados.',60],
  ['pode_registrar_entrada','estoque.movimentacoes.entrada','Estoque','Movimentações','Registrar entrada','Permite registrar entradas de materiais.',70],
  ['pode_registrar_saida','estoque.movimentacoes.saida','Estoque','Movimentações','Registrar saída','Permite registrar saídas diretas de materiais.',80],
  ['pode_transferir','estoque.movimentacoes.transferir','Estoque','Movimentações','Transferir entre estoques','Permite transferir materiais entre estoques.',90],
  ['pode_editar_movimentacoes','estoque.movimentacoes.editar','Estoque','Movimentações','Editar movimentações','Permite corrigir movimentações existentes.',100],
  ['pode_solicitacao_material','estoque.solicitacoes.gerenciar','Estoque','Solicitações e Compras','Solicitação de Material','Libera o cartão laranja Solicitação de Material, usado para solicitar itens, inclusive itens sem saldo ou ainda não cadastrados, e encaminhá-los ao fluxo de compras.',110],
  ['pode_pedido_compra','compras.pedidos.gerenciar','Compras','Solicitações e Compras','Pedido de compra','Permite acessar e gerenciar pedidos de compra.',120],
  ['pode_apontar_producao','producao.apontamentos.criar','Produção','Produção','Apontar Produção','Permite criar apontamentos de Produção.',130],
  ['pode_conferir_producao','producao.apontamentos.conferir','Produção','Produção','Conferir Produção','Permite conferir ou cancelar apontamentos.',140],
  ['pode_ver_bi_producao','producao.bi.visualizar','Produção','Produção','Ver BI Produção','Permite acessar o BI Produção.',150],
  ['pode_configurar_producao','producao.configuracoes.gerenciar','Produção','Produção','Configurar Produção','Permite alterar configurações da Produção.',160],
  ['pode_gerenciar_configuracoes','administracao.configuracoes.gerenciar','Administração','Administração','Gerenciar configurações','Permite alterar configurações gerais.',170],
  ['pode_gerenciar_usuarios','administracao.usuarios.gerenciar','Administração','Administração','Gerenciar usuários','Permite cadastrar, editar, ativar e desativar usuários.',180],
  ['pode_ver_relatorios','relatorios.visualizar','Administração','Administração','Ver relatórios','Permite acessar relatórios.',190],
  ['pode_acessar_gerencial','gerencial.visualizar','Administração','Administração','Acessar painel gerencial','Permite acessar o painel gerencial.',200],
  ['pode_acessar_projetos','projetos.visualizar','Administração','Administração','Acessar projetos','Permite acessar a área de projetos.',210],
].map(([campo,chave,modulo,grupo,nome,descricao,ordem]) => ({
  campo: String(campo),
  chave: String(chave),
  modulo: String(modulo),
  grupo: String(grupo),
  nome: String(nome),
  descricao: String(descricao),
  ordem: Number(ordem),
}));
