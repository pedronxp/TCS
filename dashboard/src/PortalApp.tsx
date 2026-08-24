import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalAuthProvider } from '@/contexts/PortalAuthContext';
import { PortalRoute } from '@/components/portal/PortalRoute';
import { PortalShell } from '@/components/portal/PortalShell';
import { Toaster } from '@/components/ui/Sonner';
import { PortalAuthPage } from '@/pages/portal/PortalAuthPage';
import { PortalDashboardPage } from '@/pages/portal/PortalDashboardPage';
import { PortalModulePage } from '@/pages/portal/PortalModulePage';
import { InviteAcceptancePage } from '@/pages/portal/InviteAcceptancePage';
import { CheckoutReturnPage } from '@/pages/portal/CheckoutReturnPage';
import { PortalBillingPage } from '@/pages/portal/PortalBillingPage';
import { PortalInvitesPage } from '@/pages/portal/PortalInvitesPage';
import { PortalInspectionPage } from '@/pages/portal/PortalInspectionPage';
import { PortalAcknowledgementsPage } from '@/pages/portal/PortalAcknowledgementsPage';
import { PortalReportsPage } from '@/pages/portal/PortalReportsPage';
import { PortalComunicadosPage } from '@/pages/portal/PortalComunicadosPage';
import { PortalWhatsAppPage } from '@/pages/portal/PortalWhatsAppPage';
import { PortalSupportPage } from '@/pages/portal/PortalSupportPage';
import { PortalProfilePage } from '@/pages/portal/PortalProfilePage';
import { PortalAgendaPage } from '@/pages/portal/PortalAgendaPage';
import { PortalTeamPage } from '@/pages/portal/PortalTeamPage';
import { PortalTeamMemberPage } from '@/pages/portal/PortalTeamMemberPage';
import { PortalSettingsPage } from '@/pages/portal/PortalSettingsPage';
import { PortalPasswordRecoveryPage } from '@/pages/portal/PortalPasswordRecoveryPage';
import { InboxPage } from '@/pages/InboxPage';
import { DocumentAcknowledgementLinkPage } from '@/pages/public/DocumentAcknowledgementLinkPage';
import type { PortalAccountKind } from '@/types/portal';

const portalQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});
const PortalMapPage = lazy(() => import('@/pages/portal/PortalMapPage').then((module) => ({ default: module.PortalMapPage })));

function Providers() {
  return <QueryClientProvider client={portalQueryClient}><PortalAuthProvider><Outlet /><Toaster position="top-right" richColors closeButton /></PortalAuthProvider></QueryClientProvider>;
}

function shell(kind: PortalAccountKind) {
  return <PortalRoute kind={kind}><PortalShell /></PortalRoute>;
}

function mapPage(kind: PortalAccountKind) {
  return (
    <PortalRoute kind={kind} permission="map.read">
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />}>
        <PortalMapPage />
      </Suspense>
    </PortalRoute>
  );
}

export default function PortalApp() {
  return (
    <Routes>
      <Route element={<Providers />}>
        <Route path="/entrar" element={<PortalAuthPage mode="sign-in" />} />
        <Route path="/criar-conta" element={<PortalAuthPage mode="sign-up" />} />
        <Route path="/recuperar-senha" element={<PortalPasswordRecoveryPage mode="request" />} />
        <Route path="/redefinir-senha" element={<PortalPasswordRecoveryPage mode="reset" />} />
        <Route path="/convite/:token" element={<InviteAcceptancePage />} />
        <Route path="/checkout/retorno" element={<CheckoutReturnPage />} />
        <Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} />

        <Route path="/portal/individual" element={shell('individual')}>
          <Route index element={<PortalDashboardPage />} />
          <Route path="/portal/individual/vistorias" element={<PortalRoute kind="individual" permission="inspection.read"><PortalModulePage section="vistorias" /></PortalRoute>} />
          <Route path="/portal/individual/vistorias/:inspectionId" element={<PortalRoute kind="individual" permission="inspection.read"><PortalInspectionPage /></PortalRoute>} />
          <Route path="/portal/individual/mapa" element={mapPage('individual')} />
          <Route path="/portal/individual/agenda" element={<PortalRoute kind="individual" permission="appointment.read"><PortalAgendaPage /></PortalRoute>} />
          <Route path="/portal/individual/documentos" element={<PortalRoute kind="individual" permission="document.read"><PortalModulePage section="documentos" /></PortalRoute>} />
          <Route path="/portal/individual/ciencias" element={<PortalRoute kind="individual" permission="document.read"><PortalAcknowledgementsPage /></PortalRoute>} />
          <Route path="/portal/individual/relatorios" element={<PortalRoute kind="individual" permission="report.read"><PortalReportsPage /></PortalRoute>} />
          <Route path="/portal/individual/consumo" element={<PortalRoute kind="individual" permission="usage.read"><PortalModulePage section="consumo" /></PortalRoute>} />
          <Route path="/portal/individual/assinatura" element={<PortalRoute kind="individual" permission="billing.read"><PortalBillingPage /></PortalRoute>} />
          <Route path="/portal/individual/suporte" element={<PortalRoute kind="individual" permission="support.read"><PortalSupportPage /></PortalRoute>} />
          <Route path="/portal/individual/perfil" element={<PortalRoute kind="individual" permission="profile.read"><PortalProfilePage /></PortalRoute>} />
          <Route path="/portal/individual/mensagens" element={<PortalRoute kind="individual" permission="profile.read"><InboxPage workspace="individual" /></PortalRoute>} />
        </Route>

        <Route path="/portal/municipal" element={shell('organization')}>
          <Route index element={<PortalDashboardPage />} />
          <Route path="/portal/municipal/vistorias" element={<PortalRoute kind="organization" permission="inspection.read"><PortalModulePage section="vistorias" /></PortalRoute>} />
          <Route path="/portal/municipal/vistorias/:inspectionId" element={<PortalRoute kind="organization" permission="inspection.read"><PortalInspectionPage /></PortalRoute>} />
          <Route path="/portal/municipal/mapa" element={mapPage('organization')} />
          <Route path="/portal/municipal/agenda" element={<PortalRoute kind="organization" permission="appointment.read"><PortalAgendaPage /></PortalRoute>} />
          <Route path="/portal/municipal/documentos" element={<PortalRoute kind="organization" permission="document.read"><PortalModulePage section="documentos" /></PortalRoute>} />
          <Route path="/portal/municipal/ciencias" element={<PortalRoute kind="organization" permission="document.read"><PortalAcknowledgementsPage /></PortalRoute>} />
          <Route path="/portal/municipal/relatorios" element={<PortalRoute kind="organization" permission="report.read"><PortalReportsPage /></PortalRoute>} />
          <Route path="/portal/municipal/comunicados" element={<PortalRoute kind="organization" permission="communication.read"><PortalComunicadosPage /></PortalRoute>} />
          <Route path="/portal/municipal/whatsapp" element={<PortalRoute kind="organization" permission="whatsapp.read"><PortalWhatsAppPage /></PortalRoute>} />
          <Route path="/portal/municipal/equipe" element={<PortalRoute kind="organization" permission="team.read"><PortalTeamPage /></PortalRoute>} />
          <Route path="/portal/municipal/equipe/:memberId" element={<PortalRoute kind="organization" permission="team.read"><PortalTeamMemberPage /></PortalRoute>} />
          <Route path="/portal/municipal/convites" element={<PortalRoute kind="organization" permission="invite.agent"><PortalInvitesPage /></PortalRoute>} />
          <Route path="/portal/municipal/consumo" element={<PortalRoute kind="organization" permission="usage.read"><PortalModulePage section="consumo" /></PortalRoute>} />
          <Route path="/portal/municipal/assinatura" element={<PortalRoute kind="organization" permission="billing.read"><PortalBillingPage /></PortalRoute>} />
          <Route path="/portal/municipal/suporte" element={<PortalRoute kind="organization" permission="support.read"><PortalSupportPage /></PortalRoute>} />
          <Route path="/portal/municipal/configuracoes" element={<PortalRoute kind="organization" permission="settings.read"><PortalSettingsPage /></PortalRoute>} />
          <Route path="/portal/municipal/perfil" element={<PortalRoute kind="organization" permission="profile.read"><PortalProfilePage /></PortalRoute>} />
          <Route path="/portal/municipal/mensagens" element={<PortalRoute kind="organization" permission="profile.read"><InboxPage workspace="organization" /></PortalRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/entrar" replace />} />
    </Routes>
  );
}
