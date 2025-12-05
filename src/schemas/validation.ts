import { z } from 'zod';

// Common validation schemas
const uuidSchema = z.string().uuid({ message: 'ID inválido' });
const positiveNumberSchema = z.number().positive({ message: 'Deve ser maior que zero' });
const nonEmptyStringSchema = z.string().trim().min(1, { message: 'Campo obrigatório' });

// Item Registration Schema
export const itemRegistrationSchema = z.object({
  codigoBarras: z.number()
    .int({ message: 'Código de barras deve ser um número inteiro' })
    .positive({ message: 'Código de barras deve ser maior que zero' }),
  codigoAntigo: z.string().trim().max(50, { message: 'Máximo 50 caracteres' }).optional(),
  origem: z.string().trim().max(100, { message: 'Máximo 100 caracteres' }).optional(),
  caixaOrganizador: z.string().trim().max(50, { message: 'Máximo 50 caracteres' }).optional(),
  localizacao: z.string().trim().max(100, { message: 'Máximo 100 caracteres' }).optional(),
  nome: nonEmptyStringSchema.max(200, { message: 'Máximo 200 caracteres' }),
  especificacao: z.string().trim().max(500, { message: 'Máximo 500 caracteres' }).optional(),
  marca: z.string().trim().max(100, { message: 'Máximo 100 caracteres' }).optional(),
  unidade: nonEmptyStringSchema.max(20, { message: 'Máximo 20 caracteres' }),
  condicao: z.enum(['Novo', 'Usado'], { message: 'Condição inválida' }),
  subcategoriaId: uuidSchema,
  ncm: z.string().trim().max(20, { message: 'Máximo 20 caracteres' }).optional(),
  valor: z.number()
    .min(0, { message: 'Valor não pode ser negativo' })
    .max(999999999.99, { message: 'Valor muito alto' }),
  fotoUrl: z.string().url({ message: 'URL inválida' }).optional()
});

export type ItemRegistrationInput = z.infer<typeof itemRegistrationSchema>;

// User Edit Schema
export const userEditSchema = z.object({
  nome: nonEmptyStringSchema
    .min(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
    .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
  email: z.string()
    .trim()
    .email({ message: 'Email inválido' })
    .max(255, { message: 'Email muito longo' })
    .toLowerCase(),
  tipo_usuario: z.enum(['administrador', 'gestor', 'engenharia', 'mestre', 'estoquista'], {
    message: 'Tipo de usuário inválido'
  })
});

export type UserEditInput = z.infer<typeof userEditSchema>;

// Item with quantity schema (reusable)
const itemWithQuantitySchema = z.object({
  item_id: uuidSchema,
  quantidade_solicitada: positiveNumberSchema.max(999999, { message: 'Quantidade muito alta' }),
  item_snapshot: z.object({
    id: uuidSchema,
    nome: nonEmptyStringSchema,
    codigoBarras: z.number(),
    unidade: z.string(),
    marca: z.string().optional(),
    especificacao: z.string().optional()
  })
});

// Material Request Schema
export const materialRequestSchema = z.object({
  localUtilizacao: uuidSchema,
  responsavelEstoque: nonEmptyStringSchema.max(100, { message: 'Máximo 100 caracteres' }),
  observacoes: z.string().trim().max(1000, { message: 'Máximo 1000 caracteres' }).optional(),
  solicitanteId: uuidSchema,
  codigoAssinatura: nonEmptyStringSchema
    .regex(/^\d+$/, { message: 'Código deve conter apenas números' })
    .min(1, { message: 'Código de assinatura obrigatório' }),
  itensSolicitados: z.array(itemWithQuantitySchema)
    .min(1, { message: 'Adicione pelo menos um item' })
    .max(100, { message: 'Máximo 100 itens por solicitação' })
});

export type MaterialRequestInput = z.infer<typeof materialRequestSchema>;

// Material Return Schema
export const materialReturnSchema = z.object({
  localUtilizacao: uuidSchema,
  responsavelEstoque: nonEmptyStringSchema.max(100, { message: 'Máximo 100 caracteres' }),
  observacoes: z.string().trim().max(1000, { message: 'Máximo 1000 caracteres' }).optional(),
  solicitanteId: uuidSchema,
  codigoAssinatura: nonEmptyStringSchema
    .regex(/^\d+$/, { message: 'Código deve conter apenas números' })
    .min(1, { message: 'Código de assinatura obrigatório' }),
  itensDevolucao: z.array(itemWithQuantitySchema)
    .min(1, { message: 'Adicione pelo menos um item' })
    .max(100, { message: 'Máximo 100 itens por devolução' })
});

export type MaterialReturnInput = z.infer<typeof materialReturnSchema>;

// Material Entry Schema
const entryItemSchema = z.object({
  item_id: uuidSchema,
  quantidade: positiveNumberSchema.max(999999, { message: 'Quantidade muito alta' })
});

export const materialEntrySchema = z.object({
  tipoOperacaoId: uuidSchema,
  observacoes: z.string().trim().max(1000, { message: 'Máximo 1000 caracteres' }).optional(),
  itensEntrada: z.array(entryItemSchema)
    .min(1, { message: 'Adicione pelo menos um item' })
    .max(100, { message: 'Máximo 100 itens por entrada' })
});

export type MaterialEntryInput = z.infer<typeof materialEntrySchema>;

// Transfer Schema
const transferItemSchema = z.object({
  item_id: uuidSchema,
  quantidade: positiveNumberSchema.max(999999, { message: 'Quantidade muito alta' }),
  item_snapshot: z.object({
    id: uuidSchema,
    nome: nonEmptyStringSchema,
    codigoBarras: z.number(),
    unidade: z.string(),
    marca: z.string().optional(),
    especificacao: z.string().optional()
  })
});

export const transferSchema = z.object({
  estoqueOrigemId: uuidSchema,
  estoqueDestinoId: uuidSchema,
  observacoes: z.string().trim().max(1000, { message: 'Máximo 1000 caracteres' }).optional(),
  itensTransferencia: z.array(transferItemSchema)
    .min(1, { message: 'Adicione pelo menos um item' })
    .max(100, { message: 'Máximo 100 itens por transferência' })
}).refine(
  (data) => data.estoqueOrigemId !== data.estoqueDestinoId,
  {
    message: 'Estoque de origem e destino devem ser diferentes',
    path: ['estoqueDestinoId']
  }
);

export type TransferInput = z.infer<typeof transferSchema>;

// Exit Registration Schema (for material withdrawal)
const exitItemSchema = z.object({
  item_id: uuidSchema,
  quantidade: positiveNumberSchema.max(999999, { message: 'Quantidade muito alta' })
});

export const exitRegistrationSchema = z.object({
  tipoOperacaoId: uuidSchema.optional(),
  destinatario: z.string().trim().max(200, { message: 'Máximo 200 caracteres' }).optional(),
  observacoes: z.string().trim().max(1000, { message: 'Máximo 1000 caracteres' }).optional(),
  itensSaida: z.array(exitItemSchema)
    .min(1, { message: 'Adicione pelo menos um item' })
    .max(100, { message: 'Máximo 100 itens por saída' })
});

export type ExitRegistrationInput = z.infer<typeof exitRegistrationSchema>;

// User Creation Schema (for admin-create-user edge function)
export const userCreationSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: 'Email inválido' })
    .max(255, { message: 'Email muito longo' })
    .toLowerCase(),
  password: z.string()
    .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
    .max(72, { message: 'Senha muito longa' })
    .regex(/[A-Z]/, { message: 'Senha deve conter ao menos uma letra maiúscula' })
    .regex(/[a-z]/, { message: 'Senha deve conter ao menos uma letra minúscula' })
    .regex(/[0-9]/, { message: 'Senha deve conter ao menos um número' }),
  nome: nonEmptyStringSchema
    .min(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
    .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
  tipo: z.enum(['administrador', 'gestor', 'engenharia', 'mestre', 'estoquista'], {
    message: 'Tipo de usuário inválido'
  }).optional()
});

export type UserCreationInput = z.infer<typeof userCreationSchema>;

// Item Import Schema (for import-items edge function)
export const itemImportSchema = z.object({
  nome: nonEmptyStringSchema.max(200, { message: 'Nome: máximo 200 caracteres' }),
  responsavel: z.string().trim().max(100, { message: 'Responsável: máximo 100 caracteres' }).optional(),
  tipoItem: z.string().trim().max(50, { message: 'Tipo: máximo 50 caracteres' }).optional(),
  unidade: nonEmptyStringSchema.max(20, { message: 'Unidade: máximo 20 caracteres' }),
  codigoAntigo: z.string().trim().max(50, { message: 'Código antigo: máximo 50 caracteres' }).optional(),
  ncm: z.string().trim().max(20, { message: 'NCM: máximo 20 caracteres' }).optional(),
  especificacao: z.string().trim().max(500, { message: 'Especificação: máximo 500 caracteres' }).optional(),
  marca: z.string().trim().max(100, { message: 'Marca: máximo 100 caracteres' }).optional(),
  condicao: z.enum(['Novo', 'Usado']).optional(),
  localizacao: z.string().trim().max(100, { message: 'Localização: máximo 100 caracteres' }).optional(),
  caixaOrganizador: z.string().trim().max(50, { message: 'Caixa: máximo 50 caracteres' }).optional(),
  valor: z.number().min(0, { message: 'Valor não pode ser negativo' }).max(999999999.99, { message: 'Valor muito alto' }).optional(),
  quantidadeMinima: z.number().int().min(0, { message: 'Quantidade mínima não pode ser negativa' }).max(999999, { message: 'Quantidade muito alta' }).optional(),
  origem: z.string().trim().max(100, { message: 'Origem: máximo 100 caracteres' }).optional()
});

export type ItemImportInput = z.infer<typeof itemImportSchema>;
