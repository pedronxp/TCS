import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHome } from '@/pages/DashboardHome';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route
                path="ocorrencias"
                element={<PlaceholderPage titulo="Ocorrências" fase="Fase 3" />}
              />
              <Route
                path="usuarios"
                element={<PlaceholderPage titulo="Usuários" fase="Fase 2" />}
              />
              <Route
                path="agendamentos"
                element={<PlaceholderPage titulo="Agendamentos" fase="Fase 4" />}
              />
              <Route path="mapa" element={<PlaceholderPage titulo="Mapa" fase="Fase 5" />} />
              <Route path="laudos" element={<PlaceholderPage titulo="Laudos" fase="Fase 6" />} />
              <Route
                path="relatorios"
                element={<PlaceholderPage titulo="Relatórios" fase="Fase 7" />}
              />
              <Route
                path="arquivamento"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <PlaceholderPage
                      titulo="Arquivamento (Drive)"
                      fase="Fase 8"
                      descricao="Lifecycle de arquivos: Supabase → Google Drive após 7 dias"
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="builds"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <PlaceholderPage
                      titulo="Builds APK"
                      fase="Fase 9"
                      descricao="Geração remota via EAS Build / GitHub Actions"
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="configuracoes"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <PlaceholderPage titulo="Configurações" fase="Fase 8/9" />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
