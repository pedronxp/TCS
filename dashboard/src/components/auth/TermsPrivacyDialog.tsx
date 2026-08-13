import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

/**
 * Modal de Termos de Uso e Política de Privacidade — acessível a partir do
 * checkbox de aceite do cadastro, para que o usuário possa ler antes de marcar.
 */
export function TermsPrivacyDialog({ document }: { document: 'terms' | 'privacy' }) {
  const isTerms = document === 'terms';
  const title = isTerms ? 'Termos de Uso' : 'Política de Privacidade';
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>TCS — Relatório de Risco · vigente em 2026-08</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Objeto</h2>
            <p>O TCS é uma plataforma de gestão de relatórios de risco e vistorias. Ao criar sua conta você concorda em utilizar o sistema conforme estas condições e a legislação aplicável (LGPD — Lei nº 13.709/2018).</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Dados coletados</h2>
            <p>Coletamos nome, e-mail, telefone (opcional) e dados operacionais inseridos em vistorias e documentos. Os dados são utilizados exclusivamente para a prestação do serviço e cumprimento de obrigações legais.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Finalidade do tratamento</h2>
            <p>Os dados servem para autenticação, comunicação sobre sua conta, geração de laudos e relatórios, auditoria de uso e segurança da plataforma.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Compartilhamento</h2>
            <p>Não comercializamos seus dados. Podemos compartilhá-los apenas com o município/organização ao qual você está vinculado, provedores de infraestratura necessários ao serviço ou quando exigido por lei.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Segurança</h2>
            <p>Adotamos criptografia, controle de acesso por perfil e registro de auditoria. Sessões de recuperação de senha expiram em 20 minutos, podendo revogar demais sessões ativas.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Seus direitos</h2>
            <p>Você pode acessar, corrigir, portar ou excluir seus dados, e revogar consentimento a qualquer momento. Solicitações podem ser feitas pelo suporte do sistema.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Retenção</h2>
            <p>Dados são mantidos enquanto a conta estiver ativa e pelos prazos legais após encerramento, salvo solicitação de exclusão.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Aceite</h2>
            <p>Ao prosseguir com o cadastro, você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso e a Política de Privacidade.</p>
          </section>
        </div>
        <div className="flex justify-end pt-2">
          <DialogClose asChild>
            <Button variant="outline" type="button">Fechar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
