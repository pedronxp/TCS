import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Braces,
  ChevronRight,
  ClipboardList,
  Eye,
  FileCheck2,
  Layers3,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { StatusBadge } from '@/components/domain/Badges';
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
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { jsonArray, jsonBoolean, jsonNumber, jsonObject, jsonString } from '@/lib/json';
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
  action: 'publish' | 'rollback';
  version?: number;
};

function parseForms(value: Json | null): FormRow[] {
  return jsonArray(value).map(jsonObject).filter(Boolean).map((row) => ({
    id: jsonString(row?.id) || '',
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
  const { can } = useAuth();
  const [editing, setEditing] = useState<FormRow | 'new' | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'global' | 'municipal'>('all');

  const query = useQuery({
    queryKey: ['internal-forms'],
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
  const selected = forms.find((form) => form.id === selectedId) || filteredForms[0] || forms[0] || null;
  const published = forms.filter((form) => form.status === 'publicado').length;
  const drafts = forms.filter((form) => form.status === 'rascunho').length;
  const global = forms.filter((form) => !form.municipality).length;

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
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Configuração operacional</p>
        <h1 id="forms-title" className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Formulários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite perguntas, valide a prévia e publique versões com rastreabilidade.
        </p>
        {(can('configuration.prepare') || can('configuration.publish')) && (
          <Button className="mt-4 sm:hidden" onClick={() => setEditing('new')}>
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
            <div className="grid gap-4 md:grid-cols-3" aria-label="Resumo dos formulários">
              <FormMetric label="Publicados" value={published} hint="versões ativas" icon={FileCheck2} />
              <FormMetric label="Rascunhos" value={drafts} hint="em revisão" icon={ClipboardList} tone="warning" />
              <FormMetric label="Escopo global" value={global} hint={`${forms.length - global} municipais`} icon={Layers3} tone="info" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
              <Card className="min-w-0 overflow-hidden rounded-lg">
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
                    <Label className="sr-only" htmlFor="forms-scope">Filtrar por escopo</Label>
                    <select
                      id="forms-scope"
                      value={scope}
                      onChange={(event) => setScope(event.target.value as typeof scope)}
                      className="h-11 rounded-md border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                    >
                      <option value="all">Todos os escopos</option>
                      <option value="global">Global</option>
                      <option value="municipal">Municipal</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[690px] text-left text-sm">
                    <thead className="border-y bg-secondary/35 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-bold">Formulário</th>
                        <th className="px-4 py-3 font-bold">Escopo</th>
                        <th className="px-4 py-3 font-bold">Versão</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredForms.map((form) => (
                        <tr key={form.id} className={cn('transition-colors hover:bg-secondary/35', selected?.id === form.id && 'bg-success-soft')}>
                          <td className="px-6 py-4">
                            <button className="max-w-[270px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedId(form.id)}>
                              <span className="block truncate font-semibold">{form.title}</span>
                              <span className="mt-1 block text-[11px] text-muted-foreground">{formatUpdated(form.updatedAt)}</span>
                            </button>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{form.municipality || 'Global'}</td>
                          <td className="px-4 py-4 text-xs font-bold">v{form.version}</td>
                          <td className="px-4 py-4"><StatusBadge value={form.status} /></td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" aria-label={`Visualizar ${form.title}`} onClick={() => setSelectedId(form.id)}>
                              <ChevronRight />
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
                  canPrepare={can('configuration.prepare')}
                  canPublish={can('configuration.publish')}
                  onEdit={() => setEditing(selected)}
                  onPublish={() => setPending({ form: selected, action: 'publish' })}
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

      {pending && (
        <HighRiskDialog
          open
          title={pending.action === 'publish' ? 'Publicar formulário' : 'Restaurar versão do formulário'}
          description="A versão será preservada no histórico e a operação ficará registrada na auditoria."
          confirmLabel={pending.action === 'publish' ? 'Publicar versão' : 'Restaurar e publicar'}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            await mutate(
              pending.form.id,
              pending.action,
              pending.action === 'rollback' ? { version: pending.version ?? 1 } : {},
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
    <Card className={cn(
      'rounded-lg p-5 shadow-none',
      tone === 'warning' && 'border-warning/20 bg-warning-soft',
      tone === 'info' && 'border-border bg-muted',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{String(value).padStart(2, '0')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}

function FormPreview({
  form,
  canPrepare,
  canPublish,
  onEdit,
  onPublish,
  onRollback,
}: {
  form: FormRow;
  canPrepare: boolean;
  canPublish: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onRollback: (version: number) => void;
}) {
  const questions = previewQuestions(form.phases, form.questions);
  const phases = previewPhases(form.phases);
  const classificationCount = Array.isArray(form.classification)
    ? form.classification.length
    : Object.keys(jsonObject(form.classification) || {}).length;
  const rollbackVersions = form.versions.filter((version) => version.version !== form.version);

  return (
    <aside className="flex min-h-[602px] flex-col rounded-lg border border-border bg-card p-6" aria-labelledby="form-preview-title">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
      <h2 id="form-preview-title" className="mt-3 text-lg font-bold">{form.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge value={form.status} />
        <span className="text-xs text-primary">v{form.version}</span>
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
          {canPublish && form.status !== 'publicado' && <Button size="sm" onClick={onPublish}><FileCheck2 />Publicar</Button>}
        </div>
        {canPublish && rollbackVersions.length > 0 && (
          <details className="mt-3 rounded-lg border border-border bg-muted px-3 py-2">
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
    <div className="rounded-lg border border-border bg-muted p-3">
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
  const [questions, setQuestions] = useState(JSON.stringify(form?.questions ?? [], null, 2));
  const [classification, setClassification] = useState(JSON.stringify(form?.classification ?? {}, null, 2));
  const [phases, setPhases] = useState(JSON.stringify(form?.phases ?? [], null, 2));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => questionPreviewFromStrings(phases, questions), [phases, questions]);

  function payload(): Json {
    if (title.trim().length < 3) throw new Error('Informe um título com pelo menos 3 caracteres.');
    const parsedQuestions = JSON.parse(questions) as Json;
    const parsedClassification = JSON.parse(classification) as Json;
    const parsedPhases = JSON.parse(phases) as Json;
    if (!Array.isArray(parsedQuestions) || !Array.isArray(parsedPhases)) {
      throw new Error('Perguntas e fases devem ser arrays JSON.');
    }
    return {
      title: title.trim(),
      description: description.trim(),
      municipality: municipality.trim(),
      calculation_type: calculation,
      questions: parsedQuestions,
      classification: parsedClassification,
      phases: parsedPhases,
    };
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next && !confirming) onClose(); }}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{form ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
            <DialogDescription>Edite os metadados e valide a estrutura antes de salvar uma nova versão.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <EditorField id="form-title" label="Título" value={title} onChange={setTitle} />
                <EditorField id="form-municipality" label="Município (vazio = global)" value={municipality} onChange={setMunicipality} />
                <div>
                  <Label htmlFor="form-calculation">Tipo de cálculo</Label>
                  <select
                    id="form-calculation"
                    value={calculation}
                    onChange={(event) => setCalculation(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                  >
                    <option value="soma_total">Soma total</option>
                    <option value="ponderada_max_elemento">Ponderada por fase</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="form-description">Descrição</Label>
                <Textarea id="form-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2" />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <JsonField id="form-questions" label="Perguntas" value={questions} onChange={setQuestions} />
                <JsonField id="form-phases" label="Fases" value={phases} onChange={setPhases} />
                <JsonField id="form-classification" label="Classificação" value={classification} onChange={setClassification} />
              </div>
            </div>

            <aside className="rounded-xl border bg-secondary/35 p-4" aria-label="Pré-visualização das perguntas">
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
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma pergunta reconhecida no JSON.</p>
              )}
            </aside>
          </div>

          {error && <p className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => {
              try {
                payload();
                setError(null);
                setConfirming(true);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'JSON inválido.');
              }
            }}>
              Salvar rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar rascunho"
        description="O conteúdo será validado e uma nova versão ficará disponível no histórico."
        confirmLabel="Salvar versão"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await onSave(payload(), reason);
          setConfirming(false);
        }}
      />
    </>
  );
}

function EditorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" />
    </div>
  );
}

function JsonField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label} (JSON)</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        spellCheck={false}
        className="mt-2 font-mono text-xs"
      />
    </div>
  );
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

function questionPreviewFromStrings(phases: string, questions: string) {
  try {
    return previewQuestions(JSON.parse(phases) as Json, JSON.parse(questions) as Json);
  } catch {
    return [];
  }
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
