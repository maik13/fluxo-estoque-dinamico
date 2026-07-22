import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoApontamentoAnexo } from '@/types/producao';

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
    if (!apontamentoId?.trim()) throw new Error('O apontamento é obrigatório.');

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

  const listarAnexosPorApontamentos = useCallback(async (apontamentoIds: string[]) => {
    const ids = [...new Set(apontamentoIds.filter(Boolean))];
    if (ids.length === 0) return [] as ProducaoApontamentoAnexo[];

    const { data, error } = await supabase
      .from('producao_apontamento_anexos')
      .select('*')
      .in('apontamento_id', ids)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ProducaoApontamentoAnexo[];
  }, []);

  const anexarImagem = useCallback(async (apontamentoId: string, file: File) => {
    if (!apontamentoId?.trim()) throw new Error('O apontamento é obrigatório.');
    if (!mimePermitido(file.type)) throw new Error('Envie uma imagem JPEG, PNG ou WebP.');
    if (file.size <= 0) throw new Error('O arquivo está vazio.');
    if (file.size > TAMANHO_MAXIMO) throw new Error('A imagem deve ter no máximo 10 MB.');

    const filePath = `${apontamentoId}/${crypto.randomUUID()}.${extensaoPorMime[file.type]}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_PRODUCAO)
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: anexoId, error: rpcError } = await supabase.rpc('registrar_anexo_producao', {
      p_apontamento_id: apontamentoId,
      p_file_path: filePath,
      p_file_name: file.name,
      p_mime_type: file.type,
      p_size_bytes: file.size,
    });

    if (rpcError) {
      await supabase.storage.from(BUCKET_PRODUCAO).remove([filePath]);
      throw rpcError;
    }

    const { data, error } = await supabase
      .from('producao_apontamento_anexos')
      .select('*')
      .eq('id', anexoId)
      .single();

    if (error) throw error;
    const anexo = data as ProducaoApontamentoAnexo;
    setAnexos((atuais) => [anexo, ...atuais]);
    return anexo;
  }, []);

  const removerAnexo = useCallback(async (anexoId: string) => {
    const { data, error: rpcError } = await supabase.rpc('remover_anexo_producao', {
      p_anexo_id: anexoId,
    });

    if (rpcError) throw rpcError;
    const filePath = data?.[0]?.file_path as string | undefined;
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_PRODUCAO)
        .remove([filePath]);
      if (storageError) throw storageError;
    }

    setAnexos((atuais) => atuais.filter((item) => item.id !== anexoId));
  }, []);

  const obterUrlAnexo = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET_PRODUCAO)
      .createSignedUrl(filePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  }, []);

  const baixarAnexo = useCallback(async (anexo: ProducaoApontamentoAnexo) => {
    const { data, error } = await supabase.storage
      .from(BUCKET_PRODUCAO)
      .download(anexo.file_path);

    if (error) throw error;
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = anexo.file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  return {
    anexos,
    loading,
    listarAnexos,
    listarAnexosPorApontamentos,
    anexarImagem,
    removerAnexo,
    obterUrlAnexo,
    baixarAnexo,
  };
};
