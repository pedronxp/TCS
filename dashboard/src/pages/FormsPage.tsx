import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Braces,
  Camera,
  ClipboardList,
  Code2,
  CircleCheck,
  CircleOff,
  Eye,
  FileCheck2,
  ImageIcon,
  ImagePlus,
  Layers3,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { jsonArray, jsonBoolean, jsonNumber, jsonObject, jsonString, type JsonObject } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/supabase';

interface FormVersion {
  version: number;
  status: string;
  reason: string;
  createdAt: string;
}

interface FormRow {
  id: string;
  systemCode: string | null;
  title: string;
  description: string | null;
  status: string;
  active: boolean;
  municipality: string | null;
  version: number;
  questions: Json;
  classification: Json;
  phases: Json;
  calculationType: string;
  updatedAt: string;
  versions: FormVersion[];
}

type PendingAction = {
  form: FormRow;
  action: 'publish' | 'rollback' | 'deactivate' | 'set_status';
  version?: number;
  operationalStatus?: FormOperationalStatus;
};

type FormOperationalStatus = 'active' | 'maintenance' | 'inactive';

function parseForms(value: Json | null): FormRow[] {
  return jsonArray(value).map(jsonObject).filter(Boolean).map((row) => ({
    id: jsonString(row?.id) || '',
    systemCode: jsonString(row?.system_code),
    title: jsonString(row?.title) || 'Formulário',
    description: jsonString(row?.description),
    status: jsonString(row?.status) || 'rascunho',
    active: jsonBoolean(row?.active) || false,
    municipality: jsonString(row?.municipality),
    version: jsonNumber(row?.version) || 1,
    questions: row?.questions ?? [],
    classification: row?.classification ?? {},
    phases: row?.phases ?? [],
    calculationType: jsonString(row?.calculation_type) || 'soma_total',
    updatedAt: jsonString(row?.updated_at) || new Date(0).toISOString(),
    versions: jsonArray(row?.versions).map(jsonObject).filter(Boolean).map((version) => ({
      version: jsonNumber(version?.version) || 0,
      status: jsonString(version?.status) || 'rascunho',
      reason: jsonString(version?.reason) || '',
      createdAt: jsonString(version?.created_at) || new Date(0).toISOString(),
    })),
  }));
}

export function FormsPage() {
  const { can, user, profile } = useAuth();
  const { formId: previewId } = useParams<{ formId?: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<FormRow | 'new' | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'global' | 'municipal'>('all');

  const query = useQuery({
    queryKey: ['internal-forms', user?.id, profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_forms');
      if (error) throw error;
      return parseForms(data);
    },
  });

  const mutation = useAdministrativeMutation<{
    formId: string | null;
    action: string;
    payload: Json;
    reason: string;
  }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_form', {
        p_form_id: input.formId || '',
        p_action: input.action,
        p_payload: input.payload,
        p_reason: input.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-forms'], ['audit-timeline']],
  });

  const forms = useMemo(() => query.data ?? [], [query.data]);
  const filteredForms = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return forms.filter((form) => {
      const matchesSearch = !normalized
        || `${form.title} ${form.description || ''} ${form.municipality || 'global'} v${form.version}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalized);
      const matchesScope = scope === 'all'
        || (scope === 'global' ? !form.municipality : Boolean(form.municipality));
      return matchesSearch && matchesScope;
    });
  }, [forms, scope, search]);
  const selected = filteredForms.find((form) => form.id === selectedId) || filteredForms[0] || null;
  const active = forms.filter((form) => operationalStatus(form) === 'active').length;
  const maintenance = forms.filter((form) => operationalStatus(form) === 'maintenance').length;
  const inactive = forms.filter((form) => operationalStatus(form) === 'inactive').length;
  const drafts = forms.filter((form) => form.status === 'rascunho').length;
  const previewForm = forms.find((form) => form.id === previewId) || null;

  async function mutate(formId: string | null, action: string, payload: Json, reason: string) {
    const result = await mutation.mutateAsync({ formId, action, payload, reason });
    if (!result.ok) throw new Error(result.error);
  }

  return (
    <section className="page-stack max-w-[1094px]" aria-labelledby="forms-title">
      <form
        id="forms-create-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (can('configuration.prepare') || can('configuration.publish')) setEditing('new');
        }}
      />

      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Operação técnica</p>
        <h1 id="forms-title" className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Formulários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite perguntas, valide a prévia e publique versões com rastreabilidade.
        </p>
        {(can('configuration.prepare') || can('configuration.publish')) && (
          <Button className="mt-4" onClick={() => setEditing('new')}>
            <Plus />
            Novo formulário
          </Button>
        )}
      </header>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !forms.length)}
        emptyTitle="Sem formulários"
        emptyDescription="Crie o primeiro formulário como rascunho."
      >
        {query.data && forms.length > 0 && (
          <>
            <section className="grid gap-3 rounded-2xl border border-border/85 bg-muted/45 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6" aria-label="Resumo dos formulários">
              <FormMetric label="Ativados" value={active} hint="visíveis no aplicativo" icon={CircleCheck} />
              <FormMetric label="Em manutenção" value={maintenance} hint="temporariamente indisponíveis" icon={Wrench} tone="warning" />
              <FormMetric label="Desativados" value={inactive} hint="fora do catálogo do app" icon={CircleOff} tone="info" />
              <FormMetric label="Rascunhos" value={drafts} hint="alterações não publicadas" icon={ClipboardList} tone="warning" />
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
              <Card className="min-w-0 overflow-hidden rounded-2xl border-border/85 shadow-sm">
                <div className="p-5 sm:p-6">
                  <h2 className="text-base font-bold">Catálogo de formulários</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Versões publicadas e rascunhos</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <Label className="sr-only" htmlFor="forms-search">Buscar formulários</Label>
                    <Input
                      id="forms-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por título, município ou versão…"
                    />
                    <Label className="sr-only">Filtrar por escopo</Label>
                    <Select
                      value={scope}
                      onValueChange={(value) => setScope(value as typeof scope)}
                    >
                      <SelectTrigger aria-label="Filtrar por escopo" className="h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os escopos</SelectItem><SelectItem value="global">Global</SelectItem><SelectItem value="municipal">Municipal</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[690px] text-left text-sm">
                    <thead className="border-y bg-secondary/35 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-bold">Formulário</th>
                        <th className="px-4 py-3 font-bold">Escopo</th>
                        <th className="px-4 py-3 font-bold">Versão</th>
                        <th className="px-4 py-3 font-bold">Recursos</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredForms.map((form) => (
                        <tr key={form.id} className={cn('transition-colors hover:bg-secondary/50', selected?.id === form.id && 'bg-accent')}>
                          <td className="px-6 py-4">
                            <button className="max-w-[270px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedId(form.id)}>
                              <span className="block truncate font-semibold">{form.title}</span>
                              <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">{form.systemCode && <span className="rounded bg-info-soft px-1.5 py-0.5 font-semibold text-info-foreground">Sistema</span>}{formatUpdated(form.updatedAt)}</span>
                            </button>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{form.municipality || 'Global'}</td>
                          <td className="px-4 py-4 text-xs font-bold">v{form.version}</td>
                          <td className="px-4 py-4"><VisualResourceBadges inventory={visualInventory(form)} compact /></td>
                          <td className="px-4 py-4"><OperationalStatusBadge form={form} /></td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" aria-label={`Visualizar ${form.title}`} onClick={() => { setSelectedId(form.id); navigate(`/app/desenvolvimento/formularios/${form.id}`); }}>
                              <Eye />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredForms.length && (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhum formulário corresponde aos filtros.</p>
                )}
              </Card>

              {selected && (
                <FormPreview
                  form={selected}
                  canPrepare={can('configuration.prepare') || can('configuration.publish')}
                  canPublish={can('configuration.publish')}
                  onEdit={() => setEditing(selected)}
                  onStatusChange={(operationalStatus) => setPending({ form: selected, action: 'set_status', operationalStatus })}
                  onRollback={(version) => setPending({ form: selected, action: 'rollback', version })}
                />
              )}
            </div>
          </>
        )}
      </AsyncBoundary>

      <FormEditor
        form={editing === 'new' ? undefined : editing || undefined}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSave={async (payload, reason) => {
          await mutate(editing === 'new' ? null : editing?.id || null, editing === 'new' ? 'create' : 'save_draft', payload, reason);
          setEditing(null);
        }}
      />

      <FormDetailsDialog
        form={previewForm}
        canPrepare={can('configuration.prepare') || can('configuration.publish')}
        canPublish={can('configuration.publish')}
        onClose={() => navigate('/app/desenvolvimento/formularios')}
        onEdit={() => { if (previewForm) { setEditing(previewForm); navigate('/app/desenvolvimento/formularios'); } }}
        onStatusChange={(operationalStatus) => { if (previewForm) setPending({ form: previewForm, action: 'set_status', operationalStatus }); }}
      />

      {pending && (
        <HighRiskDialog
          open
          title={pendingTitle(pending)}
          description={pendingDescription(pending)}
          confirmLabel={pendingConfirmLabel(pending)}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            await mutate(
              pending.form.id,
              pending.action,
              pending.action === 'rollback' ? { version: pending.version ?? 1 } : pending.action === 'set_status' ? { status: pending.operationalStatus ?? 'inactive' } : {},
              reason,
            );
            setPending(null);
          }}
        />
      )}
    </section>
  );
}

function FormMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof FileCheck2;
  tone?: 'default' | 'warning' | 'info';
}) {
  return (
      <div className={cn(
      'min-w-0 rounded-xl bg-card/55 p-4',
      tone === 'warning' && 'bg-warning-soft',
      tone === 'info' && 'bg-info-soft',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{String(value).padStart(2, '0')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-card text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function FormPreview({
  form,
  canPrepare,
  canPublish,
  onEdit,
  onStatusChange,
  onRollback,
}: {
  form: FormRow;
  canPrepare: boolean;
  canPublish: boolean;
  onEdit: () => void;
  onStatusChange: (status: FormOperationalStatus) => void;
  onRollback: (version: number) => void;
}) {
  const questions = previewQuestions(form.phases, form.questions);
  const phases = previewPhases(form.phases);
  const inventory = visualInventory(form);
  const classificationCount = Array.isArray(form.classification)
    ? form.classification.length
    : Object.keys(jsonObject(form.classification) || {}).length;
  const rollbackVersions = form.versions.filter((version) => version.version !== form.version);

  return (
    <aside className="flex min-h-[602px] flex-col rounded-2xl border border-border/85 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="form-preview-title">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
      <h2 id="form-preview-title" className="mt-3 text-lg font-bold">{form.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OperationalStatusBadge form={form} />
        <span className="text-xs text-foreground">v{form.version}</span>
        {form.systemCode && <span className="rounded bg-info-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-info-foreground">Sistema</span>}
      </div>

      <div className="my-6 h-px bg-border" />
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Estrutura reconhecida</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <PreviewStat value={questions.length} label="perguntas" />
        <PreviewStat value={phases.length} label="fases" />
        <PreviewStat value={classificationCount} label="classes" />
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cálculo</p>
        <p className="mt-2 text-sm font-semibold">{calculationLabel(form.calculationType)}</p>
      </div>

      <VisualResourceSummary inventory={inventory} />

      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fases de atendimento</p>
        {phases.length ? (
          <ol className="mt-3 space-y-3">
            {phases.slice(0, 5).map((phase, index) => (
              <li key={`${phase}-${index}`} className="flex items-center gap-3 text-xs">
                <span className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] font-bold',
                  index === 0 && 'border-transparent bg-primary text-primary-foreground',
                )}>
                  {index + 1}
                </span>
                <span className={index === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{phase}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Nenhuma fase reconhecida.</p>
        )}
      </div>

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-2">
          {canPrepare && <Button variant="secondary" size="sm" onClick={onEdit}><Braces />Editar</Button>}
          {canPublish && <FormOperationalStatusSelect form={form} onChange={onStatusChange} />}
        </div>
        {canPublish && rollbackVersions.length > 0 && (
          <details className="mt-3 rounded-xl border border-border/85 bg-muted/65 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold">Histórico da versão</summary>
            <div className="mt-2 space-y-1">
              {rollbackVersions.slice(0, 5).map((version) => (
                <button
                  key={version.version}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onRollback(version.version)}
                >
                  <span className="inline-flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" />Restaurar v{version.version}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}

function PreviewStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-muted/65 p-3">
      <p className="text-lg font-bold text-foreground">{String(value).padStart(2, '0')}</p>
      <p className="mt-1 truncate text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FormEditor({
  form,
  open,
  onClose,
  onSave,
}: {
  form?: FormRow;
  open: boolean;
  onClose: () => void;
  onSave: (payload: Json, reason: string) => Promise<void>;
}) {
  const editorKey = `${form?.id || 'new'}-${open}`;
  return open ? (
    <FormEditorContent key={editorKey} form={form} open={open} onClose={onClose} onSave={onSave} />
  ) : null;
}

function FormEditorContent({
  form,
  open,
  onClose,
  onSave,
}: {
  form?: FormRow;
  open: boolean;
  onClose: () => void;
  onSave: (payload: Json, reason: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(form?.title || '');
  const [description, setDescription] = useState(form?.description || '');
  const [municipality, setMunicipality] = useState(form?.municipality || '');
  const [calculation, setCalculation] = useState(form?.calculationType || 'soma_total');
  const [phases, setPhases] = useState<EditablePhase[]>(() => editablePhases(form?.phases, form?.questions));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initialSnapshot = useRef<string | undefined>(undefined);
  const preview = useMemo(() => phases.flatMap((phase) => phase.perguntas).map((question) => question.texto || 'Pergunta sem título'), [phases]);
  const editorSnapshot = useMemo(() => JSON.stringify({ title, description, municipality, calculation, phases, reason }), [title, description, municipality, calculation, phases, reason]);
  if (initialSnapshot.current === undefined) initialSnapshot.current = editorSnapshot;
  const hasUnsavedChanges = initialSnapshot.current !== editorSnapshot;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [hasUnsavedChanges]);

  function requestClose() {
    if (saving) return;
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function replacePhase(phaseIndex: number, next: EditablePhase) {
    setPhases((current) => current.map((phase, index) => index === phaseIndex ? next : phase));
  }

  function replaceQuestion(phaseIndex: number, questionIndex: number, next: EditableQuestion) {
    const phase = phases[phaseIndex];
    replacePhase(phaseIndex, { ...phase, perguntas: phase.perguntas.map((question, index) => index === questionIndex ? next : question) });
  }

  async function uploadImage(file: File, target: string, onUploaded: (url: string) => void) {
    if (!file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) {
      setError('Envie uma imagem de até 4 MB (PNG, JPG ou WebP).');
      return;
    }
    setError(null);
    setUploading(target);
    try {
      const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
      const path = `forms/${crypto.randomUUID()}.${extension}`;
      const { data, error: uploadError } = await supabase.storage.from('form-media').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError || !data) throw uploadError || new Error('image_upload_failed');
      const { data: publicUrl } = supabase.storage.from('form-media').getPublicUrl(data.path);
      if (!publicUrl.publicUrl) throw new Error('image_url_unavailable');
      onUploaded(publicUrl.publicUrl);
    } catch {
      setError('Não foi possível enviar a imagem. Verifique sua permissão e tente novamente.');
    } finally {
      setUploading(null);
    }
  }

  function payload(): Json {
    if (title.trim().length < 3) throw new Error('Informe um título com pelo menos 3 caracteres.');
    const normalizedPhases = phases
      .map((phase) => ({ ...phase, titulo: phase.titulo.trim(), perguntas: phase.perguntas.filter((question) => question.texto.trim()) }))
      .filter((phase) => phase.titulo || phase.perguntas.length);
    if (!normalizedPhases.length) throw new Error('Adicione ao menos uma fase e uma pergunta antes de salvar.');
    const serializedPhases = normalizedPhases.map(serializePhase);
    return {
      title: title.trim(),
      description: description.trim(),
      municipality: municipality.trim(),
      calculation_type: calculation,
      questions: serializedPhases.flatMap((phase) => phase.perguntas),
      classification: form?.classification ?? {},
      phases: serializedPhases,
    };
  }

  async function saveDraft() {
    try {
      const nextPayload = payload();
      if (reason.trim().length < 8) throw new Error('Informe uma justificativa com pelo menos 8 caracteres.');
      setError(null);
      setSaving(true);
      await onSave(nextPayload, reason.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o rascunho.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
          <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{form ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
            <DialogDescription>Edite os metadados e valide a estrutura antes de salvar uma nova versão. Alterações não salvas serão protegidas ao fechar ou atualizar a página.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <EditorField id="form-title" label="Título" value={title} onChange={setTitle} />
                <EditorField
                  id="form-municipality"
                  label="Município (vazio = global)"
                  value={municipality}
                  onChange={setMunicipality}
                  disabled={Boolean(form)}
                />
                <div>
                  <Label>Tipo de cálculo</Label>
                  <Select
                    value={calculation}
                    onValueChange={setCalculation}
                  >
                    <SelectTrigger aria-label="Tipo de cálculo" className="mt-2 h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="soma_total">Soma total</SelectItem><SelectItem value="ponderada_max_elemento">Ponderada por fase</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="form-description">Descrição</Label>
                <Textarea id="form-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2" />
              </div>
              <section className="space-y-3" aria-labelledby="form-builder-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 id="form-builder-title" className="font-bold">Etapas, cards e pontuação</h3>
                    <p className="mt-1 text-xs text-muted-foreground">O que for salvo aqui aparece no app após a publicação e sincronização.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPhases((current) => [...current, newPhase()])}><Plus />Adicionar etapa</Button>
                </div>
                {phases.map((phase, phaseIndex) => (
                  <div key={phase.id} className="rounded-2xl border border-border/85 bg-secondary/30 p-4">
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`phase-${phase.id}`}>Nome da etapa</Label>
                        <Input id={`phase-${phase.id}`} className="mt-2" value={phase.titulo} onChange={(event) => replacePhase(phaseIndex, { ...phase, titulo: event.target.value })} placeholder="Ex.: Identificação do imóvel" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover etapa ${phaseIndex + 1}`} onClick={() => setPhases((current) => current.filter((_, index) => index !== phaseIndex))}><Trash2 /></Button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {phase.perguntas.map((question, questionIndex) => (
                        <QuestionEditor
                          key={question.id}
                          question={question}
                          position={questionIndex + 1}
                          uploading={uploading}
                          onChange={(next) => replaceQuestion(phaseIndex, questionIndex, next)}
                          onRemove={() => replacePhase(phaseIndex, { ...phase, perguntas: phase.perguntas.filter((_, index) => index !== questionIndex) })}
                          onUpload={(file, target, onUploaded) => void uploadImage(file, target, onUploaded)}
                        />
                      ))}
                    </div>
                    <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => replacePhase(phaseIndex, { ...phase, perguntas: [...phase.perguntas, newQuestion()] })}><Plus />Adicionar pergunta</Button>
                  </div>
                ))}
                {!phases.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Adicione uma etapa para começar a montar o formulário.</p>}
              </section>
              <div className="rounded-xl border border-info/20 bg-info-soft p-4">
                <p className="text-sm font-semibold">Classificação de risco automática</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Defina a pontuação diretamente nas respostas. O sistema preserva as regras existentes e calcula o resultado sem exigir edição em JSON.</p>
              </div>
              {form ? (
                <p className="text-xs text-muted-foreground">O escopo municipal é imutável depois da criação. Para outro escopo, crie um novo formulário.</p>
              ) : null}
              <div>
                <Label htmlFor="form-reason">Justificativa auditada</Label>
                <Textarea
                  id="form-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="mt-2"
                  placeholder="Explique a criação ou alteração deste rascunho"
                />
              </div>
            </div>

            <aside className="rounded-2xl border border-border/85 bg-secondary/35 p-4" aria-label="Pré-visualização das perguntas">
              <p className="flex items-center gap-2 font-bold"><Eye className="h-4 w-4" />Pré-visualização</p>
              {preview.length ? (
                <ol className="mt-4 space-y-2">
                  {preview.slice(0, 20).map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5">
                      <span className="font-bold text-primary">{String(index + 1).padStart(2, '0')}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Adicione uma etapa e perguntas para ver a prévia.</p>
              )}
            </aside>
          </div>

          {error && <p className="rounded-lg bg-destructive-soft p-3 text-sm text-foreground" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={requestClose}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void saveDraft()}>
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Descartar alterações não salvas?</DialogTitle>
            <DialogDescription>Você editou este formulário, mas ainda não salvou o rascunho. Atualizar, fechar ou trocar de rota agora perderá essas alterações.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Continuar editando</Button>
            <Button variant="destructive" onClick={() => { setConfirmDiscard(false); onClose(); }}>Descartar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2" />
    </div>
  );
}

type EditableOption = {
  id: string;
  texto: string;
  descricao?: string;
  imagemLocal?: string | null;
  pesoRisco: number;
  extra?: JsonObject;
};

type EditableQuestion = {
  id: string;
  texto: string;
  descricao?: string;
  tipo: 'cards' | 'multipla_escolha' | 'texto' | 'foto';
  imagemLocal?: string | null;
  obrigatoria: boolean;
  layout?: string;
  opcoes: EditableOption[];
  extra?: JsonObject;
};

type EditablePhase = { id: string; titulo: string; perguntas: EditableQuestion[]; extra?: JsonObject };

function editorId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function newOption(): EditableOption {
  return { id: editorId('opcao'), texto: '', pesoRisco: 0, imagemLocal: null };
}

function newQuestion(): EditableQuestion {
  return { id: editorId('pergunta'), texto: '', tipo: 'cards', obrigatoria: true, opcoes: [newOption(), newOption()] };
}

function newPhase(): EditablePhase {
  return { id: editorId('fase'), titulo: '', perguntas: [newQuestion()] };
}

function editablePhases(rawPhases: Json | undefined, rawQuestions: Json | undefined): EditablePhase[] {
  const phases = jsonArray(rawPhases).map(jsonObject).filter(Boolean).map((phase, index) => ({
    id: jsonString(phase?.id) || editorId(`fase-${index + 1}`),
    titulo: jsonString(phase?.titulo) || jsonString(phase?.nome) || `Etapa ${index + 1}`,
    perguntas: editableQuestions(phase?.perguntas),
    extra: preservedFields(phase, ['id', 'titulo', 'nome', 'perguntas']),
  }));
  if (phases.length) return phases;
  const questions = editableQuestions(rawQuestions);
  return questions.length ? [{ id: editorId('fase'), titulo: 'Etapa principal', perguntas: questions }] : [newPhase()];
}

function editableQuestions(raw: Json | undefined): EditableQuestion[] {
  return jsonArray(raw).map(jsonObject).filter(Boolean).map((question) => ({
    id: jsonString(question?.id) || editorId('pergunta'),
    texto: jsonString(question?.texto) || jsonString(question?.pergunta) || jsonString(question?.label) || '',
    descricao: jsonString(question?.descricao) || undefined,
    tipo: question?.tipo === 'texto' || question?.tipo === 'foto' || question?.tipo === 'multipla_escolha' ? question.tipo : 'cards',
    imagemLocal: jsonString(question?.imagemLocal) || jsonString(question?.imagemExemplo) || null,
    obrigatoria: question?.obrigatoria !== false,
    layout: jsonString(question?.layout) || undefined,
    opcoes: jsonArray(question?.opcoes).map(jsonObject).filter(Boolean).map((option) => ({
      id: jsonString(option?.id) || editorId('opcao'),
      texto: jsonString(option?.texto) || jsonString(option?.label) || '',
      descricao: jsonString(option?.descricao) || undefined,
      imagemLocal: jsonString(option?.imagemLocal) || jsonString(option?.imagemKey) || null,
      pesoRisco: jsonNumber(option?.pesoRisco) || 0,
      extra: preservedFields(option, ['id', 'texto', 'label', 'descricao', 'imagemLocal', 'imagemKey', 'pesoRisco']),
    })),
    extra: preservedFields(question, ['id', 'texto', 'pergunta', 'label', 'descricao', 'tipo', 'imagemLocal', 'imagemExemplo', 'obrigatoria', 'layout', 'opcoes']),
  }));
}

function preservedFields(source: JsonObject | null | undefined, known: string[]): JsonObject | undefined {
  if (!source) return undefined;
  const result = Object.fromEntries(Object.entries(source).filter(([key]) => !known.includes(key))) as JsonObject;
  return Object.keys(result).length ? result : undefined;
}

function serializePhase(phase: EditablePhase): { id: string; titulo: string; perguntas: Array<JsonObject>; [key: string]: Json | undefined } {
  return { ...phase.extra, id: phase.id, titulo: phase.titulo, perguntas: phase.perguntas.map(serializeQuestion) };
}

function serializeQuestion(question: EditableQuestion): JsonObject {
  return {
    ...question.extra,
    id: question.id,
    texto: question.texto,
    descricao: question.descricao,
    tipo: question.tipo,
    imagemLocal: question.imagemLocal,
    obrigatoria: question.obrigatoria,
    layout: question.layout,
    opcoes: question.opcoes.map((option) => ({ ...option.extra, id: option.id, texto: option.texto, descricao: option.descricao, imagemLocal: option.imagemLocal, pesoRisco: option.pesoRisco })),
  };
}

function QuestionEditor({
  question,
  position,
  uploading,
  onChange,
  onRemove,
  onUpload,
}: {
  question: EditableQuestion;
  position: number;
  uploading: string | null;
  onChange: (next: EditableQuestion) => void;
  onRemove: () => void;
  onUpload: (file: File, target: string, onUploaded: (url: string) => void) => void;
}) {
  const supportsOptions = question.tipo === 'cards' || question.tipo === 'multipla_escolha';
  const svgCards = question.opcoes.filter((option) => Boolean(jsonString(option.extra?.svgKey))).length;
  const icons = question.opcoes.filter((option) => Boolean(jsonString(option.extra?.icon) || jsonString(option.extra?.icone))).length;
  const imageCount = Number(Boolean(question.imagemLocal)) + question.opcoes.filter((option) => Boolean(option.imagemLocal)).length;
  return (
    <article className="rounded-xl border border-border/80 bg-card p-3" aria-label={`Pergunta ${position}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5"><p className="text-xs font-bold text-muted-foreground">PERGUNTA {String(position).padStart(2, '0')}</p>{svgCards ? <span className="rounded-full bg-info-soft px-2 py-1 text-[10px] font-bold text-info-foreground">{svgCards} SVG</span> : null}{icons ? <span className="rounded-full bg-info-soft px-2 py-1 text-[10px] font-bold text-info-foreground">{icons} ícone(s)</span> : null}{imageCount ? <span className="rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold text-success-foreground">{imageCount} imagem(ns)</span> : null}{question.tipo === 'foto' ? <span className="rounded-full bg-warning-soft px-2 py-1 text-[10px] font-bold text-warning-foreground">captura de foto</span> : null}</div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remover pergunta ${position}`} onClick={onRemove}><Trash2 /></Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <Label htmlFor={`question-${question.id}`}>Pergunta</Label>
          <Input id={`question-${question.id}`} className="mt-2" value={question.texto} onChange={(event) => onChange({ ...question, texto: event.target.value })} placeholder="Ex.: Qual condição foi identificada?" />
        </div>
        <div>
          <Label>Formato</Label>
          <Select value={question.tipo} onValueChange={(value) => onChange({ ...question, tipo: value as EditableQuestion['tipo'], opcoes: ['cards', 'multipla_escolha'].includes(value) ? question.opcoes.length ? question.opcoes : [newOption(), newOption()] : [] })}>
            <SelectTrigger aria-label="Formato da pergunta" className="mt-2 h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="cards">Cards com imagem</SelectItem><SelectItem value="multipla_escolha">Múltipla escolha</SelectItem><SelectItem value="texto">Texto</SelectItem><SelectItem value="foto">Foto de campo</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <Label htmlFor={`question-description-${question.id}`}>Orientação para o agente</Label>
          <Input id={`question-description-${question.id}`} className="mt-2" value={question.descricao || ''} onChange={(event) => onChange({ ...question, descricao: event.target.value || undefined })} placeholder="Texto de apoio opcional" />
        </div>
        <label className="mt-7 flex h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm font-medium"><input type="checkbox" checked={question.obrigatoria} onChange={(event) => onChange({ ...question, obrigatoria: event.target.checked })} />Obrigatória</label>
      </div>
      <ImageControl
        id={`question-image-${question.id}`}
        label="Imagem de referência"
        value={question.imagemLocal || ''}
        uploading={uploading === `question-${question.id}`}
        onChange={(url) => onChange({ ...question, imagemLocal: url || null })}
        onUpload={(file) => onUpload(file, `question-${question.id}`, (url) => onChange({ ...question, imagemLocal: url }))}
      />
      {supportsOptions && (
        <div className="mt-4 rounded-lg bg-secondary/45 p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">Cards / respostas e pontuação</p><Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...question, opcoes: [...question.opcoes, newOption()] })}><Plus />Card</Button></div>
          <div className="mt-3 space-y-3">
            {question.opcoes.map((option, optionIndex) => (
              <div key={option.id} className="grid gap-3 rounded-lg border border-border/80 bg-card p-3 md:grid-cols-[minmax(0,1fr)_100px_auto]">
                <div>
                  <Label htmlFor={`option-${option.id}`}>Card {optionIndex + 1}</Label>
                  <Input id={`option-${option.id}`} className="mt-2" value={option.texto} onChange={(event) => onChange({ ...question, opcoes: question.opcoes.map((current, index) => index === optionIndex ? { ...current, texto: event.target.value } : current) })} placeholder="Texto da opção" />
                  {jsonString(option.extra?.svgKey) ? <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-info-foreground"><Code2 className="h-3 w-3" />SVG: {jsonString(option.extra?.svgKey)}</p> : null}
                  {jsonString(option.extra?.icon) || jsonString(option.extra?.icone) ? <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-info-foreground"><Layers3 className="h-3 w-3" />Ícone: {jsonString(option.extra?.icon) || jsonString(option.extra?.icone)}</p> : null}
                </div>
                <div><Label htmlFor={`option-score-${option.id}`}>Pontos</Label><Input id={`option-score-${option.id}`} type="number" className="mt-2" value={String(option.pesoRisco)} onChange={(event) => onChange({ ...question, opcoes: question.opcoes.map((current, index) => index === optionIndex ? { ...current, pesoRisco: Number(event.target.value) || 0 } : current) })} /></div>
                <Button type="button" variant="ghost" size="icon" className="self-end" aria-label={`Remover card ${optionIndex + 1}`} onClick={() => onChange({ ...question, opcoes: question.opcoes.filter((_, index) => index !== optionIndex) })}><Trash2 /></Button>
                <div className="md:col-span-3">
                  <ImageControl id={`option-image-${option.id}`} label={`Imagem do card ${optionIndex + 1}`} value={option.imagemLocal || ''} uploading={uploading === `option-${option.id}`} onChange={(url) => onChange({ ...question, opcoes: question.opcoes.map((current, index) => index === optionIndex ? { ...current, imagemLocal: url || null } : current) })} onUpload={(file) => onUpload(file, `option-${option.id}`, (url) => onChange({ ...question, opcoes: question.opcoes.map((current, index) => index === optionIndex ? { ...current, imagemLocal: url } : current) }))} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

type VisualInventory = {
  svgCards: number;
  icons: number;
  questionImages: number;
  cardImages: number;
  photoCaptureQuestions: number;
  questionsWithVisuals: Array<{ text: string; svgCards: number; icons: number; images: number; capturesPhoto: boolean }>;
};

function visualInventory(form: FormRow): VisualInventory {
  const source = previewQuestionRows(form.phases, form.questions);
  const questionsWithVisuals: VisualInventory['questionsWithVisuals'] = [];
  let svgCards = 0;
  let icons = 0;
  let questionImages = 0;
  let cardImages = 0;
  let photoCaptureQuestions = 0;

  source.forEach((question, index) => {
    const options = jsonArray(question?.opcoes).map(jsonObject).filter(Boolean);
    const questionImage = hasImage(question);
    const capturesPhoto = jsonString(question?.tipo) === 'foto';
    const questionSvgCards = options.filter((option) => Boolean(jsonString(option?.svgKey))).length;
    const questionIcons = options.filter((option) => Boolean(jsonString(option?.icon) || jsonString(option?.icone))).length;
    const questionCardImages = options.filter(hasImage).length;
    svgCards += questionSvgCards;
    icons += questionIcons;
    questionImages += questionImage ? 1 : 0;
    cardImages += questionCardImages;
    photoCaptureQuestions += capturesPhoto ? 1 : 0;
    if (questionImage || capturesPhoto || questionSvgCards || questionIcons || questionCardImages) {
      questionsWithVisuals.push({
        text: jsonString(question?.texto) || jsonString(question?.pergunta) || jsonString(question?.label) || `Pergunta ${index + 1}`,
        svgCards: questionSvgCards,
        icons: questionIcons,
        images: (questionImage ? 1 : 0) + questionCardImages,
        capturesPhoto,
      });
    }
  });

  return { svgCards, icons, questionImages, cardImages, photoCaptureQuestions, questionsWithVisuals };
}

function previewQuestionRows(phases: Json, questions: Json): JsonObject[] {
  const nested = jsonArray(phases).flatMap((phase) => jsonArray(jsonObject(phase)?.perguntas));
  const source = nested.length ? nested : jsonArray(questions);
  return source.map(jsonObject).filter((row): row is JsonObject => Boolean(row));
}

function hasImage(value: JsonObject | null | undefined) {
  return Boolean(
    jsonString(value?.imagemLocal)
    || jsonString(value?.imagemExemplo)
    || jsonString(value?.imagemKey)
    || jsonString(value?.image)
    || jsonString(value?.imageUrl),
  );
}

function VisualResourceBadges({ inventory, compact = false }: { inventory: VisualInventory; compact?: boolean }) {
  const items = [
    inventory.svgCards ? { label: `${inventory.svgCards} SVG`, icon: Code2 } : null,
    inventory.icons ? { label: `${inventory.icons} ícone${inventory.icons === 1 ? '' : 's'}`, icon: Layers3 } : null,
    inventory.questionImages + inventory.cardImages ? { label: `${inventory.questionImages + inventory.cardImages} imagem${inventory.questionImages + inventory.cardImages === 1 ? '' : 'ns'}`, icon: ImageIcon } : null,
    inventory.photoCaptureQuestions ? { label: `${inventory.photoCaptureQuestions} foto${inventory.photoCaptureQuestions === 1 ? '' : 's'}`, icon: Camera } : null,
  ].filter(Boolean) as Array<{ label: string; icon: typeof Code2 }>;

  if (!items.length) return <span className="text-xs text-muted-foreground">Sem mídia</span>;
  return <div className={cn('flex flex-wrap gap-1.5', compact && 'max-w-44')}>{items.map(({ label, icon: Icon }) => <span key={label} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"><Icon className="h-3 w-3" aria-hidden="true" />{label}</span>)}</div>;
}

function VisualResourceSummary({ inventory }: { inventory: VisualInventory }) {
  return <div className="mt-6 rounded-xl border border-border/85 bg-muted/45 p-3">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recursos visuais no aplicativo</p>
    <div className="mt-3"><VisualResourceBadges inventory={inventory} /></div>
    {inventory.questionsWithVisuals.length ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{inventory.questionsWithVisuals.length} pergunta(s) usam ícone, SVG, imagem de referência, imagem de card ou captura de foto.</p> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Nenhuma imagem, ícone ou SVG configurado neste formulário.</p>}
  </div>;
}

function operationalStatus(form: FormRow): FormOperationalStatus {
  if (form.active || form.status === 'publicado') return 'active';
  if (form.status === 'manutencao') return 'maintenance';
  return 'inactive';
}

function OperationalStatusBadge({ form }: { form: FormRow }) {
  const status = operationalStatus(form);
  const styles: Record<FormOperationalStatus, string> = {
    active: 'border-success/30 bg-success-soft text-success-foreground',
    maintenance: 'border-warning/30 bg-warning-soft text-warning-foreground',
    inactive: 'border-border bg-muted text-muted-foreground',
  };
  const labels: Record<FormOperationalStatus, string> = { active: 'Ativado', maintenance: 'Em manutenção', inactive: 'Desativado' };
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold', styles[status])}>{labels[status]}</span>;
}

function FormOperationalStatusSelect({ form, onChange }: { form: FormRow; onChange: (status: FormOperationalStatus) => void }) {
  const current = operationalStatus(form);
  return <div className="min-w-44"><Label className="sr-only">Status operacional</Label><Select value={current} onValueChange={(value) => { const next = value as FormOperationalStatus; if (next !== current) onChange(next); }}><SelectTrigger aria-label="Status operacional" className="h-9 bg-card text-xs font-semibold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativado no aplicativo</SelectItem><SelectItem value="maintenance">Em manutenção</SelectItem><SelectItem value="inactive">Desativado</SelectItem></SelectContent></Select></div>;
}

function FormDetailsDialog({
  form,
  canPrepare,
  canPublish,
  onClose,
  onEdit,
  onStatusChange,
}: {
  form: FormRow | null;
  canPrepare: boolean;
  canPublish: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: FormOperationalStatus) => void;
}) {
  if (!form) return null;
  const inventory = visualInventory(form);
  const questions = previewQuestions(form.phases, form.questions);
  return <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-4xl">
      <DialogHeader className="pr-8 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Visualização do formulário</p>
        <DialogTitle>{form.title}</DialogTitle>
        <DialogDescription>Rota direta para conferência: os recursos abaixo serão exibidos no aplicativo conforme a versão sincronizada.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2"><OperationalStatusBadge form={form} /><span className="text-xs font-semibold text-muted-foreground">v{form.version}</span>{form.systemCode && <span className="rounded bg-info-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-info-foreground">Formulário do sistema</span>}</div>
      <VisualResourceSummary inventory={inventory} />
      <section aria-labelledby="visual-questions-title">
        <h3 id="visual-questions-title" className="text-sm font-bold">Perguntas com recursos visuais</h3>
        {inventory.questionsWithVisuals.length ? <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">{inventory.questionsWithVisuals.map((question, index) => <li key={`${question.text}-${index}`} className="rounded-xl border border-border/85 bg-muted/35 p-3"><p className="text-sm font-semibold">{question.text}</p><div className="mt-2 flex flex-wrap gap-1.5">{question.svgCards ? <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold">{question.svgCards} SVG em cards</span> : null}{question.icons ? <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold">{question.icons} ícone(s)</span> : null}{question.images ? <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold">{question.images} imagem(ns)</span> : null}{question.capturesPhoto ? <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold">captura de foto</span> : null}</div></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Nenhuma pergunta possui mídia configurada.</p>}
      </section>
      <section className="rounded-xl border border-border/85 p-4" aria-labelledby="questions-title"><h3 id="questions-title" className="text-sm font-bold">Estrutura da vistoria</h3><ol className="mt-3 grid gap-2 sm:grid-cols-2">{questions.slice(0, 20).map((question, index) => <li key={`${question}-${index}`} className="flex gap-2 text-xs leading-5"><span className="font-bold text-primary">{String(index + 1).padStart(2, '0')}</span><span>{question}</span></li>)}</ol></section>
      <DialogFooter>{canPrepare && <Button variant="outline" onClick={onEdit}><Braces />Editar</Button>}{canPublish && <FormOperationalStatusSelect form={form} onChange={onStatusChange} />}<Button onClick={onClose}>Fechar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function pendingTitle(pending: PendingAction) {
  if (pending.action === 'rollback') return 'Restaurar versão do formulário';
  if (pending.action === 'publish') return 'Publicar formulário';
  if (pending.action === 'deactivate' || pending.operationalStatus === 'inactive') return 'Desativar formulário';
  if (pending.operationalStatus === 'maintenance') return 'Colocar formulário em manutenção';
  return 'Ativar formulário no aplicativo';
}

function pendingDescription(pending: PendingAction) {
  if (pending.action === 'rollback') return 'A versão será preservada no histórico e a operação ficará registrada na auditoria.';
  if (pending.operationalStatus === 'active' || pending.action === 'publish') return 'O formulário ficará disponível no aplicativo após a próxima sincronização. A alteração será registrada na auditoria.';
  if (pending.operationalStatus === 'maintenance') return 'O formulário deixará de aparecer no aplicativo enquanto estiver em manutenção. Vistorias já realizadas e versões anteriores serão preservadas.';
  return 'O formulário deixará de aparecer no aplicativo após a próxima sincronização. O histórico das vistorias permanece preservado.';
}

function pendingConfirmLabel(pending: PendingAction) {
  if (pending.action === 'rollback') return 'Restaurar e publicar';
  if (pending.action === 'publish' || pending.operationalStatus === 'active') return 'Ativar no aplicativo';
  if (pending.operationalStatus === 'maintenance') return 'Iniciar manutenção';
  return 'Desativar no aplicativo';
}

function ImageControl({ id, label, value, uploading, onChange, onUpload }: { id: string; label: string; value: string; uploading: boolean; onChange: (value: string) => void; onUpload: (file: File) => void }) {
  return <div className="mt-3 rounded-xl border border-border/70 bg-muted/25 p-3"><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div><Label htmlFor={id}>{label}</Label><Input id={id} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder="URL da imagem ou envie um arquivo" /></div><label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-secondary"><ImagePlus className="h-4 w-4" />{uploading ? 'Enviando…' : 'Enviar imagem'}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ''; }} /></label></div>{value ? <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/70 bg-card p-2"><img src={value} alt={`Prévia: ${label}`} className="h-12 w-16 rounded-md border border-border/70 object-cover" /><p className="text-xs font-medium text-success-foreground">Imagem configurada para o aplicativo</p></div> : <p className="mt-2 text-xs text-muted-foreground">Nenhuma imagem configurada.</p>}</div>;
}

function previewQuestions(phases: Json, questions: Json) {
  const nested = jsonArray(phases).flatMap((phase) => {
    const row = jsonObject(phase);
    return jsonArray(row?.perguntas);
  });
  const source = nested.length ? nested : jsonArray(questions);
  return source.map((question) => {
    const row = jsonObject(question);
    return jsonString(row?.texto) || jsonString(row?.pergunta) || jsonString(row?.label) || 'Pergunta sem título';
  });
}

function previewPhases(phases: Json) {
  return jsonArray(phases).map((phase, index) => {
    if (typeof phase === 'string') return phase;
    const row = jsonObject(phase);
    return jsonString(row?.titulo)
      || jsonString(row?.nome)
      || jsonString(row?.label)
      || `Fase ${index + 1}`;
  });
}

function calculationLabel(value: string) {
  if (value === 'ponderada_max_elemento') return 'Pontuação ponderada por fase';
  if (value === 'soma_total') return 'Soma total';
  return value.replace(/_/g, ' ');
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Atualização não informada';
  return `Atualizado em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
}
