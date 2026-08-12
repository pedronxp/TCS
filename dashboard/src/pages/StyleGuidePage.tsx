import { Info } from 'lucide-react';
import { PageHeader } from '@/components/domain/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';

const tokenSwatches = [
  { name: 'Background', value: 'var(--background)', className: 'bg-background' },
  { name: 'Surface', value: 'var(--card)', className: 'bg-card' },
  { name: 'Foreground', value: 'var(--foreground)', className: 'bg-foreground' },
  { name: 'Muted', value: 'var(--muted)', className: 'bg-secondary' },
  { name: 'Border', value: 'var(--border)', className: 'bg-border' },
  { name: 'Primary', value: 'var(--primary)', className: 'bg-primary' },
  { name: 'Primary hover', value: 'var(--primary-hover)', className: 'bg-primary-hover' },
  { name: 'Success soft', value: 'var(--success-soft)', className: 'bg-success-soft' },
  { name: 'Warning', value: 'var(--warning)', className: 'bg-warning' },
  { name: 'Destructive', value: 'var(--destructive)', className: 'bg-destructive' },
] as const;

export function StyleGuidePage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Design system"
        title="Referência da interface TCS"
        description="Foundations adaptativas com modos Light, Dark e temas estendidos, bordas arredondadas (soft borders), efeito gloss e componentes interativos."
      />

      <section aria-labelledby="guide-foundations" className="space-y-5">
        <div>
          <h2 id="guide-foundations" className="text-[22px] font-semibold">Foundations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cores semânticas, tipografia, espaçamento e forma. Os hexadecimais abaixo são a referência do tema claro; a interface usa tokens adaptativos.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tokenSwatches.map((token) => (
            <article key={token.name} className="rounded-lg border bg-card p-3">
              <div className={`h-20 rounded-md border ${token.className}`} />
              <p className="mt-3 text-sm font-semibold">{token.name}</p>
              <code className="mt-1 block text-xs text-muted-foreground">{token.value}</code>
            </article>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tipografia</CardTitle>
              <CardDescription>Inter em toda a experiência.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-[40px] font-bold leading-[1.2]">Título 40</p>
              <p className="text-[32px] font-bold leading-[1.2]">Display 32</p>
              <p className="text-2xl font-semibold leading-[1.4]">Heading 24</p>
              <p className="text-[15px] leading-[1.4]">Texto de corpo 15 com leitura confortável.</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Label 11</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Espaçamento e forma</CardTitle>
              <CardDescription>Escalas usadas em páginas e componentes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                {[4, 8, 12, 16, 24, 32].map((space) => (
                  <div key={space} className="text-center">
                    <div className="mx-auto bg-primary" style={{ height: space, width: space }} />
                    <span className="mt-2 block text-xs text-muted-foreground">{space}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-4 gap-3">
                <Shape radius="6" className="rounded-sm" />
                <Shape radius="10" className="rounded-md" />
                <Shape radius="14" className="rounded-lg" />
                <Shape radius="24" className="rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="guide-motion" className="space-y-5">
        <div>
          <h2 id="guide-motion" className="text-[22px] font-semibold">Motion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Movimento comunica estado e continuidade; não decora dados, leitura ou navegação frequente.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Curvas e durações</CardTitle>
            <CardDescription>Use propriedades compostas de transform e opacidade, com saída mais curta que entrada.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <MotionRule label="Feedback" value="150 ms" detail="Botões, tabs, hover e foco" token="--motion-ease-out" />
            <MotionRule label="Presença" value="200 ms" detail="Dialog, sheet e mudança de etapa" token="--motion-ease-out" />
            <MotionRule label="Drawer" value="200 / 150 ms" detail="Entrada / saída interrompível" token="--motion-ease-drawer" />
          </CardContent>
        </Card>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Redução de movimento é parte do contrato</AlertTitle>
          <AlertDescription>
            Spinners param, skeletons deixam de pulsar e transições espaciais são removidas com <code>prefers-reduced-motion</code>, sem esconder estado ou feedback textual.
          </AlertDescription>
        </Alert>
      </section>

      <section aria-labelledby="guide-components" className="space-y-5">
        <div>
          <h2 id="guide-components" className="text-[22px] font-semibold">Components</h2>
          <p className="mt-1 text-sm text-muted-foreground">Estados reutilizáveis para ações, entrada e leitura.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buttons e badges</CardTitle>
            <CardDescription>Hierarquia clara em 44 px e status sem depender apenas de cor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button>Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="info">Informação</Button>
              <Button disabled>Desabilitado</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge>Neutro</Badge>
              <Badge variant="info">Informação</Badge>
              <Badge variant="success">Sucesso</Badge>
              <Badge variant="warning">Atenção</Badge>
              <Badge variant="destructive">Erro</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Altura consistente, foco verde e estado desabilitado explícito.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guide-name">Nome</Label>
                <Input id="guide-name" placeholder="Digite um nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guide-disabled">Desabilitado</Label>
                <Input id="guide-disabled" value="Sem edição" disabled readOnly />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guide-notes">Observações</Label>
                <Textarea id="guide-notes" placeholder="Contexto da operação" />
              </div>
              <label className="flex items-center gap-3 text-sm"><Checkbox />Selecionar registro</label>
              <label className="flex items-center gap-3 text-sm"><Switch />Receber notificações</label>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card padrão</CardTitle>
                <CardDescription>Superfície branca, borda quente e sombra curta.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-info-soft">
              <CardHeader>
                <CardTitle className="text-foreground">Card informativo</CardTitle>
                <CardDescription>Contexto de apoio em azul suave.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-dashed shadow-none">
              <CardHeader>
                <CardTitle>Estado vazio</CardTitle>
                <CardDescription>Nenhum registro encontrado para os filtros atuais.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Tabela compacta</CardTitle>
            <CardDescription>Hierarquia para listas operacionais densas.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Prefeitura de Aurora</TableCell>
                  <TableCell><Badge variant="success">Ativo</Badge></TableCell>
                  <TableCell className="text-muted-foreground">Hoje, 09:42</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Consórcio Regional Norte</TableCell>
                  <TableCell><Badge variant="warning">Atenção</Badge></TableCell>
                  <TableCell className="text-muted-foreground">Ontem, 17:18</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Alert className="bg-info-soft text-foreground">
          <Info className="h-4 w-4" />
          <AlertTitle>Informação operacional</AlertTitle>
          <AlertDescription className="text-foreground/80">
            Use mensagens curtas, acionáveis e vinculadas ao contexto atual.
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}

function MotionRule({ label, value, detail, token }: { label: string; value: string; detail: string; token: string }) {
  return (
    <div className="rounded-lg border bg-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      <code className="mt-3 block text-xs text-foreground">{token}</code>
    </div>
  );
}

function Shape({ radius, className }: { radius: string; className: string }) {
  return (
    <div>
      <div className={`h-16 border bg-secondary ${className}`} />
      <p className="mt-2 text-center text-xs text-muted-foreground">{radius} px</p>
    </div>
  );
}
