import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export function LoginPage() {
  const { signIn, isAuthorized, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return <TelaCarregando />;
  if (isAuthorized) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setErro(error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/app-icon.png" alt="TCS" className="w-20 h-20 rounded-3xl shadow-xl ring-2 ring-white/20 object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white">TCS — Painel</h1>
          <p className="text-sm text-slate-400 mt-2">Acesso restrito a administradores</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card text-card-foreground rounded-xl shadow-2xl p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {erro && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Entrar
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-2">
            Apenas contas <strong>admin</strong> e <strong>master_admin</strong> aprovadas têm
            acesso a este painel.
          </p>
        </form>
      </div>
    </div>
  );
}

function TelaCarregando() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
    </div>
  );
}
