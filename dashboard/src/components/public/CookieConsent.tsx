import { useEffect, useState } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const CONSENT_KEY = 'tcs.cookie-consent.v1';
type ConsentChoice = 'necessary' | 'all';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(CONSENT_KEY) === null);
  }, []);

  const save = (choice: ConsentChoice) => {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, decidedAt: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      aria-label="Preferências de privacidade"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-[760px] rounded-2xl border bg-card p-4 shadow-preview sm:bottom-5 sm:p-5"
      role="dialog"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warm text-primary"><Cookie className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Privacidade e funcionamento da página</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Usamos armazenamento necessário para sessão e segurança. O IP da conexão pode constar nos logs técnicos do servidor para prevenção de fraude e incidentes.
          </p>
          {details && (
            <div className="mt-3 grid gap-2 rounded-xl bg-secondary p-3 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
              <p><strong className="text-foreground">Necessários:</strong> autenticação, segurança, preferência de consentimento e continuidade da sessão.</p>
              <p><strong className="text-foreground">Opcionais:</strong> preferências de experiência e medição de uso. Não são ativados ao escolher somente os necessários.</p>
              <p className="sm:col-span-2">Dúvidas ou solicitações LGPD: <a className="font-semibold text-primary underline" href="mailto:privacidade@tcs.app">privacidade@tcs.app</a>.</p>
            </div>
          )}
        </div>
        <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary" onClick={() => save('necessary')} aria-label="Fechar e usar somente o necessário"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button className="min-h-11 px-3 text-sm font-semibold text-primary" onClick={() => setDetails((value) => !value)}>{details ? 'Ocultar detalhes' : 'Ver detalhes'}</button>
        <Button variant="outline" onClick={() => save('necessary')}><ShieldCheck />Somente necessários</Button>
        <Button onClick={() => save('all')}>Aceitar opcionais</Button>
      </div>
    </section>
  );
}

export { CONSENT_KEY };
