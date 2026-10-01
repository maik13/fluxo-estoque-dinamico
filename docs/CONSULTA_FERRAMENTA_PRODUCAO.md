# Consulta de ferramentas na Produção

O card abaixo do título Produção pesquisa o código de barras exato no banco. A RPC retorna somente o item consultado e todas as suas movimentações em um único resultado JSON; a paginação de 20 linhas é apenas visual.

Acesso: sessão autenticada com permissão de visualizar Produção. A função é somente leitura; não libera acesso direto nem escrita nas tabelas do almoxarifado.

O pop-up distingue solicitante de responsável pelo registro e mostra destino, estoque, data e vínculo com a peça/OP quando originado de uma solicitação de material da Produção. Não deduz OP pelo nome do destino.

Devoluções são somadas pelo item e pela solicitação de retirada de origem. Se existirem devoluções posteriores sem vínculo, ou retirada sem solicitação, o resultado é não confirmado, sem atribuir posse ou dívida de devolução. A última movimentação é exibida separadamente. O histórico original é preservado.

Validação: consulta real dos códigos 283 e 682; quantidade de movimentos retornados comparada ao banco; código inexistente; entrada inválida; bloqueio de insumos, usuário anônimo e usuário sem permissão. Em transação revertida, vincular uma devolução à retirada correspondente mudou a situação para concluída com pendência zero. Sintaxe TSX validada antes da publicação.
