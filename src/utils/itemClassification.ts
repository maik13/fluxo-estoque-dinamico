type CategoriaRef = {
  id: string;
  nome: string;
  ativo?: boolean;
};

const normalizar = (valor?: string | null) =>
  String(valor ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const itemEhFerramenta = (
  item: any,
  categorias: CategoriaRef[] = [],
): boolean => {
  if (!item) return false;

  const nomeDireto =
    item.categoriaNome ??
    item.categoria_nome ??
    item.categoria;

  if (normalizar(nomeDireto) === 'ferramenta') return true;

  const categoriaId = item.categoriaId ?? item.categoria_id;
  if (!categoriaId) return false;

  const categoria = categorias.find(
    (ref) => ref.id === categoriaId && ref.ativo !== false,
  );

  return normalizar(categoria?.nome) === 'ferramenta';
};
