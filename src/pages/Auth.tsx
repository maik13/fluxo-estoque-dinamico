import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Package, Lock, Mail, ArrowRight, KeyRound } from 'lucide-react';

const Auth = () => {
  const { session, loading, error, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate('/');
    }
  }, [loading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    await signIn(email, password);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setResetMessage('Digite seu email primeiro.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      setResetMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (e: any) {
      setResetMessage(`Erro: ${e.message}`);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(222 28% 5%), hsl(224 32% 9%), hsl(220 24% 7%))' }}
    >
      {/* Background glow orbs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(145 72% 42%), transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(186 72% 37%), transparent 70%)' }}
        />
      </div>

      {/* Login Card */}
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-[fade-in_0.35s_ease-out]"
        style={{
          background: 'linear-gradient(145deg, hsl(224 24% 11%), hsl(222 22% 8%))',
          border: '1px solid hsl(145 72% 42% / 0.15)',
          boxShadow: '0 24px 80px hsl(222 28% 4% / 0.8), 0 0 0 1px hsl(210 20% 96% / 0.04)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-0.5 w-full"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(145 72% 42%), hsl(186 72% 37%), transparent)' }}
        />

        <div className="p-8">
          {/* Logo area */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, hsl(145 72% 42% / 0.2), hsl(186 72% 37% / 0.1))',
                border: '1px solid hsl(145 72% 42% / 0.2)',
                boxShadow: '0 0 24px hsl(145 72% 42% / 0.15)',
              }}
            >
              <Package className="h-8 w-8" style={{ color: 'hsl(145 72% 55%)' }} />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{
                background: 'linear-gradient(135deg, hsl(145 72% 62%), hsl(186 72% 57%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Almoxarifado
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema de gestão de materiais
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10"
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20">
                {error}
              </div>
            )}
            {resetMessage && (
              <div className="rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/50 border border-border">
                {resetMessage}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg">
              Entrar
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleForgotPassword}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Esqueci a senha
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
