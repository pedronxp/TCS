import { Navigate, useLocation } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import type { PortalAccountKind, PortalPermission } from '@/types/portal';
import { Skeleton } from '@/components/ui/Skeleton';
import { portalHome } from '@/lib/portal';

export function PortalRoute({
  kind,
  permission,
  children,
}: {
  kind: PortalAccountKind;
  permission?: PortalPermission;
  children: React.ReactNode;
}) {
  const { session, access, loading, can } = usePortalAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6" aria-live="polite">
        <div className="w-full max-w-md space-y-3">
          <span className="sr-only">Carregando acesso ao portal…</span>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to={`/entrar?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  if (!access) return <Navigate to="/entrar?status=sem-acesso" replace />;
  if (access.accountKind !== kind) return <Navigate to={portalHome(access.accountKind)} replace />;
  if (kind === 'organization' && access.membershipStatus !== 'active') {
    return <Navigate to="/entrar?status=vinculo-inativo" replace />;
  }
  if (permission && !can(permission)) return <Navigate to={portalHome(access.accountKind)} replace />;
  return children;
}
