import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export function LoginPage() {
  const { signIn, isAuthorized, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div
        className="w-full max-w-md"
        style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Logo */}
        <div
          className="text-center mb-8"
          style={{ animation: 'fadeSlideUp 0.45s 0.05s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/app-icon.png"
              alt="TCS"
              className="w-20 h-20 rounded-3xl shadow-xl object-cover"
              style={{ animation: 'scaleIn 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white">TCS — Painel</h1>
          <p className="text-sm text-slate-400 mt-2">Acesso restrito a administradores</p>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="bg-card text-card-foreground rounded-xl shadow-2xl p-6 space-y-4"
          style={{ animation: 'fadeSlideUp 0.45s 0.12s cubic-bezier(0.16,1,0.3,1) both' }}
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700 transition-colors"
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          {erro && (
            <div
              className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
              style={{ animation: 'shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both' }}
            >
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

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
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
