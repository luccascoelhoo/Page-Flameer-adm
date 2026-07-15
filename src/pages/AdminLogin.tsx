import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Mail, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (session) {
        // Verify role
        const { data: profile, error: profileError } = await (supabase as any)
          .from('profiles')
          .select('role, name')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role === 'admin' || profile?.role === 'professional') {
          toast({
            title: `Bem-vindo, ${profile?.name || 'Administrador'}!`,
            description: "Acesso autorizado ao Painel de Gerenciamento.",
            variant: "default",
          });
          navigate('/dashboard');
        } else {
          // Log out immediately as they are not admin
          await supabase.auth.signOut();
          toast({
            title: "Acesso Negado",
            description: "Seu perfil não possui privilégios de administrador.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      toast({
        title: "Falha na Autenticação",
        description: err.message || "Email ou senha incorretos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background soft gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 shadow-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground mb-4 shadow-lg shadow-primary/20">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Flameer Admin</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Gerenciador oficial de desafios, treinos e nutrição
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu-admin@flameer.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-11 text-base font-medium shadow-md shadow-primary/20" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Autenticando...
              </>
            ) : (
              'Entrar no Painel'
            )}
          </Button>
        </form>
      </div>

      <p className="text-xs text-muted-foreground mt-6 relative z-10">
        Painel Restrito. Apenas para administradores e profissionais de saúde.
      </p>
    </div>
  );
}
