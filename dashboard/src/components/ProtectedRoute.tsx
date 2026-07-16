import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { InternalPermission } from '@/types/internal';

interface Props {
  children: ReactNode;
  requirePermission?: InternalPermission;
}

export function ProtectedRoute({ children, requirePermission }: Props) {
  const { loading, isAuthorized, can } = useAuth();
  const location = useLocation();
  const permissionDenied = Boolean(requirePermission && !can(requirePermission));

  useEffect(() => {
    if (!loading && isAuthorized && permissionDenied && requirePermission) {
      void supabase.rpc('record_internal_access_denied', {
        p_action: `route.${requirePermission}`,
        p_target_type: 'route',
        p_target_id: location.pathname,
        p_reason: 'missing_permission',
      });
    }
  }, [isAuthorized, loading, location.pathname, permissionDenied, requirePermission]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthorized) return <Navigate to="/login" replace state={{ from: location }} />;
  if (permissionDenied) {
    return (
      <div className="p-8 text-center" role="alert">
        <h2 className="text-xl font-semibold text-destructive">Acesso negado</h2>
        <p className="mt-2 text-muted-foreground">Você não possui a permissão necessária para esta área.</p>
      </div>
    );
  }
  return <>{children}</>;
}
