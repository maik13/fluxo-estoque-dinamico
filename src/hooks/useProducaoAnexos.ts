import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  NovoAnexoProducao,
  ProducaoApontamentoAnexo,
} from '@/types/producao';

const BUCKET_PRODUCAO = 'producao-apontamentos';
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

const extensaoPorMime: Record<(typeof TIPOS_PERMITIDOS)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const mimePermitido = (
  mime: string,
): mime is (typeof TIPOS_PERMITIDOS)[number] =>
  TIPOS_PERMITIDOS.includes(mime as (typeof TIPOS_PERMITIDOS)[number]);

export const useProducaoAnexos = () => {
  const [anexos, setAnexos] = useState<ProducaoApontamentoAnexo[]>([]);
  const [loading, setLoading] = useState(false);

  const listarAnexos = useCallback(async (apontamentoId: string) => {
    if (!apontamentoId?.trim()) {
      throw new Error('O apontamento é obrigatório.');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('producao_apontamento_anexos')
        .select('*')
        .eq('apontamento_id', apontamentoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const resultado = (data ?? []) as ProducaoApontamentoAnexo[];
      setAnexos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const anexarImagem = useCallback(
    async (apontamentoId: string, file: File) => {
      if (!apontamentoId?.trim()) {
        throw new Error('O apontamento é obrigatório.');
      }
      if (!mimePermitido(file.type)) {
        throw new Error('Envie uma imagem JPEG, PNG ou WebP.');
      }
      if (file.size <= 0) {
        throw new Error('O arquivo está vazio.');
      }
      if (file.size > TAMANHO_MAXIMO) {
        throw new Error('A imagem deve ter no máximo 10 MB.');
      }

      const {
        data: { user },
        error: usuarioError,
      } = await supabase.auth.getUser();

      if (usuarioError) throw usuarioError;
      if (!user) throw new Error('É necessário estar autenticado para anexar.');

      const filePath = `${apontamentoId}/${crypto.randomUUID()}.${extensaoPorMime[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_PRODUCAO)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const novoAnexo: NovoAnexoProducao = {
        apontamento_id: apontamentoId,
        file_path: filePath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
      };

      const { data, error } = await supabase
        .from('producao_apontamento_anexos')
        .insert(novoAnexo)
        .select()
        .single();

      if (error) {
        await supabase.storage.from(BUCKET_PRODUCAO).remove([filePath]);
        throw error;
      }

      const anexo = data as ProducaoApontamentoAnexo;
      setAnexos((atuais) => [anexo, ...atuais]);
      return anexo;
    },
    [],
  );

  const removerAnexo = useCallback(async (anexoId: string) => {
    const { data: anexo, error: consultaError } = await supabase
      .from('producao_apontamento_anexos')
      .select('*')
      .eq('id', anexoId)
      .single();

    if (consultaError) throw consultaError;

    const { error: storageError } = await supabase.storage
      .from(BUCKET_PRODUCAO)
      .remove([anexo.file_path]);

    if (storageError) throw storageError;

    const { error } = await supabase
      .from('producao_apontamento_anexos')
      .delete()
      .eq('id', anexoId);

    if (error) throw error;
    setAnexos((atuais) => atuais.filter((item) => item.id !== anexoId));
  }, []);

  const obterUrlAnexo = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET_PRODUCAO)
      .createSignedUrl(filePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  }, []);

  return {
    anexos,
    loading,
    listarAnexos,
    anexarImagem,
    removerAnexo,
    obterUrlAnexo,
  };
};
