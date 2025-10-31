import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
        redirectTo: `${window.location.origin}/`
      });
      
      if (error) throw error;
      setResetMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (e: any) {
      setResetMessage(`Erro: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-destructive text-sm">{error}</p>}
            {resetMessage && <p className="text-muted-foreground text-sm">{resetMessage}</p>}
            <Button type="submit" className="w-full">Entrar</Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={handleForgotPassword}
            >
              Esqueci a senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
