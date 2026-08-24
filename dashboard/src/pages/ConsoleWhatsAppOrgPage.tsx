import { ConsoleComunicadoOrgPage } from '@/pages/ConsoleComunicadoOrgPage';

export function ConsoleWhatsAppOrgPage() {
  return (
    <ConsoleComunicadoOrgPage
      mode="whatsapp"
      backTo="/app/whatsapp"
      backLabel="WhatsApp Bot"
    />
  );
}
