import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';

interface Props {
  children: ReactNode;
  requireRole?: UserRole[];
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { loading, isAuthorized, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireRole && profile && !requireRole.includes(profile.role)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-destructive">Acesso negado</h2>
        <p className="text-muted-foreground mt-2">
          Esta área requer permissão de {requireRole.join(' ou ')}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
