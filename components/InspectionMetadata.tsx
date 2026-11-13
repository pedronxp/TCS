import React from 'react';
import { Text, View } from 'react-native';

export function InspectionMetadata({ agent, date, protocol, id, color }: {
  agent?: string | null; date?: string | null; protocol?: string | null; id: string; color: string;
}) {
  const timestamp = date ? new Date(date) : null;
  const hasTime = date ? /[T ]\d{2}:\d{2}/.test(date) : false;
  const dateLabel = timestamp && !Number.isNaN(timestamp.getTime())
    ? hasTime
      ? timestamp.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : `${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')} · Hora não registrada`
    : 'Data não informada';
  return <View style={{ flex: 1, gap: 4 }}>
    <Text style={{ color, fontSize: 12 }}>{agent || 'Agente não informado'} · {dateLabel}</Text>
    <Text selectable style={{ color, fontSize: 12 }}>{protocol?.trim() ? `Protocolo: ${protocol}` : `Registro local: ${id}`}</Text>
  </View>;
}
