import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Diálogo de troca da própria senha do usuário de staff logado no console.
 *
 * Reauth implícita: o Supabase exige a senha atual para validar a identidade
 * antes de aceitar a nova senha. Caso a sessão tenha sido criada por login
 * social (Google) sem senha, o usuário é orientado a usar a recuperação por
 * e-mail.
 */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { user, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasLength = newPassword.length >= 8;
  const valid = hasUpper && hasLower && hasNumber && hasLength;
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!valid) {
      setError('A nova senha não atende aos requisitos de complexidade.');
      return;
    }
    if (!matches) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setLoading(true);
    try {
      // 1. Reautentica com a senha atual para garantir posse da identidade.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });
      if (authError) {
        setError('Senha atual incorreta. Tente novamente.');
        return;
      }

      // 2. Atualiza a senha da sessão ativa.
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success('Sua senha foi alterada com sucesso. Faça login novamente.');
      handleClose(false);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Alterar minha senha
          </DialogTitle>
          <DialogDescription>
            Informe sua senha atual e defina uma nova senha de acesso ao console. Após a troca você será desconectado para validar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showCurrent ? 'Ocultar senha atual' : 'Exibir senha atual'}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres, com maiúscula, minúscula e número"
            />
            <button
              type="button"
              onClick={() => setShowNew((value) => !value)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showNew ? 'Ocultar' : 'Exibir'} nova senha
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !matches && (
              <p className="text-xs text-destructive">As senhas não conferem.</p>
            )}
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className={cn(hasLength && 'text-success')}>{hasLength ? '✓' : '•'} Ao menos 8 caracteres</li>
            <li className={cn(hasUpper && 'text-success')}>{hasUpper ? '✓' : '•'} Uma letra maiúscula</li>
            <li className={cn(hasLower && 'text-success')}>{hasLower ? '✓' : '•'} Uma letra minúscula</li>
            <li className={cn(hasNumber && 'text-success')}>{hasNumber ? '✓' : '•'} Um número</li>
          </ul>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || !matches || !currentPassword || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <KeyRound />}
              Alterar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
