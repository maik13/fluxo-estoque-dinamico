import { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export const PrimeiroAcessoSenha = () => {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const senhaValida =
    senha.length >= 8 &&
    /[A-Z]/.test(senha) &&
    /[a-z]/.test(senha) &&
    /[0-9]/.test(senha);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro(null);

    if (!senhaValida) {
      setErro('A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.');
      return;
    }

    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setSalvando(true);
    try {
      const { error: senhaError } = await supabase.auth.updateUser({ password: senha });
      if (senhaError) throw senhaError;

      const { error: perfilError } = await (supabase as any).rpc('concluir_primeiro_acesso');
      if (perfilError) throw perfilError;

      window.location.href = '/';
    } catch (error: any) {
      console.error('Erro ao concluir primeiro acesso:', error);
      setErro(error?.message || 'Não foi possível salvar a nova senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Defina sua nova senha</CardTitle>
          <CardDescription>
            Este é seu primeiro acesso. Por segurança, a senha provisória precisa ser substituída antes de usar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvar} className="space-y-4">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pl-10"
                required
              />
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirmar nova senha"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="pl-10"
                required
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              A senha deve ter no mínimo 8 caracteres e conter letra maiúscula, letra minúscula e número.
            </div>

            {erro && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar nova senha e acessar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
