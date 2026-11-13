export function mergePendingInspectionArchiveState<T extends { id: string; owner_archived_at?: string | null; protocolo?: string | null }>(
  local: readonly T[],
  remote: readonly { id: string; owner_archived_at?: string | null; protocolo?: string | null }[],
): T[] {
  const remoteById = new Map(remote.map(inspection => [inspection.id, inspection]));
  return local.map(inspection => {
    const server = remoteById.get(inspection.id);
    if (!server) return inspection;
    return {
      ...inspection,
      owner_archived_at: server.owner_archived_at,
      ...(server.protocolo != null && { protocolo: server.protocolo }),
    };
  });
}
