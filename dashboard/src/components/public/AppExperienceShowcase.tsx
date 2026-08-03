import type { ReactNode } from 'react';
import { Bell, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';

export function AppExperienceShowcase() {
  return (
    <section aria-labelledby="app-experience-title" className="bg-ink text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16 xl:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warm">Aplicativo TCS</p>
          <h2 id="app-experience-title" className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">Do primeiro acesso à operação em campo.</h2>
          <p className="mt-4 text-[15px] leading-6 text-white/65">Uma prévia das telas mobile que acompanham o profissional antes do login, durante o onboarding e na rotina de vistorias.</p>
        </div>

        <div className="app-phone-track mt-10 grid gap-6 md:grid-cols-3">
          <PhoneFrame label="Antes de entrar" className="app-phone-float">
            <div className="flex flex-col items-center px-5 pb-5 pt-8 text-center">
              <TcsMark size={68} />
              <p className="mt-4 text-xl font-bold text-foreground">Bem-vindo ao TCS</p>
              <p className="mt-1 text-xs text-muted-foreground">Relatório e Risco</p>
              <div className="mt-6 w-full space-y-2">
                <MockInput text="E-mail" />
                <MockInput text="Senha" />
                <div className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground">Entrar</div>
                <div className="rounded-xl border px-4 py-3 text-xs font-semibold text-foreground">Continuar com Google</div>
              </div>
              <p className="mt-5 text-[10px] text-muted-foreground">Criar conta · Recuperar senha</p>
            </div>
          </PhoneFrame>

          <PhoneFrame label="Onboarding" className="app-phone-float app-phone-float-delay">
            <div className="p-5 text-foreground">
              <div className="flex items-center gap-2"><TcsMark size={34} /><div><p className="text-xs font-bold">Configure seu acesso</p><p className="text-[9px] text-muted-foreground">Etapa salva na sua conta</p></div></div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
              <p className="mt-5 text-xs font-bold">Como você utilizará o TCS?</p>
              <Choice icon={<UserRound />} title="Uso individual" detail="Profissional autônomo" selected />
              <Choice icon={<ShieldCheck />} title="Prefeitura ou município" detail="Equipe e primeiro administrador" />
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-secondary p-3 text-[10px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />Termos e privacidade confirmados.</div>
            </div>
          </PhoneFrame>

          <PhoneFrame label="Operação" className="app-phone-float app-phone-float-delay-2">
            <div className="p-5 text-foreground">
              <div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground">Bom dia, Ana</p><p className="text-sm font-bold">Visão geral</p></div><Bell className="h-5 w-5 text-primary" /></div>
              <div className="mt-5 grid grid-cols-2 gap-2"><Metric value="12" label="Vistorias" /><Metric value="3" label="Pendências" /></div>
              <div className="mt-3 rounded-xl bg-primary p-4 text-primary-foreground"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /><p className="text-xs font-bold">Nova vistoria</p></div><p className="mt-2 text-[9px] opacity-80">Registre evidências mesmo offline.</p></div>
              <p className="mt-5 text-xs font-bold">Atividade recente</p>
              <div className="mt-2 space-y-2"><Activity title="Rua das Flores, 120" risk="R2" /><Activity title="Av. Central, 45" risk="R3" /></div>
              <div className="mt-4 flex items-center justify-around border-t pt-3 text-primary"><ClipboardCheck className="h-4 w-4" /><MapPin className="h-4 w-4" /><UserRound className="h-4 w-4" /></div>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function PhoneFrame({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return <article className={`mx-auto w-full max-w-[310px] ${className}`}><p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-warm">{label}</p><div className="overflow-hidden rounded-[34px] border-[7px] border-warm/25 bg-background shadow-2xl"><div className="mx-auto mt-2 h-4 w-20 rounded-full bg-ink" />{children}</div></article>;
}
function MockInput({ text }: { text: string }) { return <div className="rounded-xl border bg-card px-4 py-3 text-left text-xs text-muted-foreground">{text}</div>; }
function Choice({ icon, title, detail, selected = false }: { icon: ReactNode; title: string; detail: string; selected?: boolean }) { return <div className={`mt-3 flex items-center gap-3 rounded-xl border p-3 ${selected ? 'border-primary bg-warm/30' : 'bg-card'}`}><span className="[&>svg]:h-5 [&>svg]:w-5 text-primary">{icon}</span><div><p className="text-xs font-bold">{title}</p><p className="text-[9px] text-muted-foreground">{detail}</p></div></div>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border bg-card p-3"><p className="text-xl font-bold">{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>; }
function Activity({ title, risk }: { title: string; risk: string }) { return <div className="flex items-center justify-between rounded-xl bg-card p-3 text-[10px]"><span>{title}</span><span className="rounded-full bg-warm px-2 py-1 font-bold text-primary">{risk}</span></div>; }
