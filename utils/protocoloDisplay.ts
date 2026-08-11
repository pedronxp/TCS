export type ProtocolDisplay = {
  value: string;
  isOfficial: boolean;
};

const PENDING_PROTOCOL_MESSAGE = 'Protocolo pendente de sincronização';

export function protocolDisplay(protocolo?: string | null): ProtocolDisplay {
  const value = protocolo?.trim();

  return value
    ? { value, isOfficial: true }
    : { value: PENDING_PROTOCOL_MESSAGE, isOfficial: false };
}
