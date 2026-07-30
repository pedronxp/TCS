import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalHome } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

interface InspectionDetail {
  id: string;
  protocol: string;
  status: string;
  risk_level: string | null;
  score: number | null;
  occurred_at: string | null;
  address: string | null;
  municipality: string | null;
  agent_name: string | null;
  latitude: number | null;
  longitude: number | null;
  document_available: boolean;
}

export function PortalInspectionPage() {
  const { inspectionId } = useParams();
  const { access } = usePortalAuth();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['portal', 'inspection', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_get_inspection', { p_inspection_id: inspectionId ?? '' });
      if (error || !data) throw new Error(error?.message ?? 'inspection_not_found');
      return data as unknown as InspectionDetail;
    },
    enabled: Boolean(inspectionId),
  });
  if (!access) return null;
  const root = portalHome(access.accountKind);

  async function document(mode: 'view' | 'download') {
    if (!inspectionId) return;
    setDocumentError(null);
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    const { data, error } = await supabase.functions.invoke('portal-inspection-document', {
      body: { inspection_id: inspectionId, mode },
    });
    if (error || !data?.signed_url) {
      popup?.close();
      setDocumentError('Não foi possível autorizar o documento. Tente novamente.');
      return;
    }
    if (popup) popup.location.href = data.signed_url;
    else window.location.assign(data.signed_url);
  }

  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-72 w-full" /></div>;
  if (query.isError || !query.data) return <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Vistoria não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">O item pode estar fora do seu escopo.</p><Button asChild className="mt-5"><Link to={`${root}/vistorias`}>Voltar às vistorias</Link></Button></div></CardContent></Card>;
  const inspection = query.data;

  return (
    <div className="page-stack">
      <header><Button asChild variant="ghost" className="-ml-3"><Link to={`${root}/vistorias`}><ArrowLeft />Vistorias</Link></Button><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{inspection.protocol}</h1><Badge>{inspection.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{inspection.occurred_at ? new Date(inspection.occurred_at).toLocaleString('pt-BR') : 'Data não informada'}</p></header>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card><CardHeader><CardTitle>Resumo técnico</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info label="Risco" value={inspection.risk_level ?? 'Não classificado'} /><Info label="Pontuação" value={inspection.score?.toLocaleString('pt-BR') ?? '—'} /><Info label="Responsável" value={inspection.agent_name ?? 'Não informado'} /><Info label="Município" value={inspection.municipality ?? 'Não informado'} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Documento</CardTitle></CardHeader><CardContent>{inspection.document_available ? <div className="space-y-3"><p className="flex items-center gap-2 text-sm"><FileText className="text-primary" />Laudo disponível</p><div className="flex gap-2"><Button onClick={() => void document('view')}>Visualizar</Button><Button variant="outline" onClick={() => void document('download')}><Download />Baixar</Button></div></div> : <p className="text-sm text-muted-foreground">O laudo ainda não está disponível.</p>}{documentError && <p className="mt-3 text-sm text-destructive" role="alert">{documentError}</p>}</CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin />Localização</CardTitle></CardHeader><CardContent><p className="text-sm">{inspection.address ?? 'Endereço não informado'}</p>{inspection.latitude !== null && <p className="mt-2 text-xs text-muted-foreground">{inspection.latitude.toFixed(6)}, {inspection.longitude?.toFixed(6)}</p>}</CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
