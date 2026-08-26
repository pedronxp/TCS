type SQLiteMigrationDatabase = {
  runSync: (sql: string) => unknown;
  getFirstSync: <T>(sql: string) => T | null;
};

const EVENT_COLUMNS = `
  id, client_event_id, document_id, outcome, declaration_version,
  declaration_text, declaration_hash, recipient_name, recipient_relationship,
  signature_strokes, signature_hash, reason, witness_json, occurred_at_device,
  recorded_at_server, device_id_hash, created_by, sync_status, protocol,
  remote_signature_path, error_code, attempts, training_mode, correction_of,
  correction_reason
`;

/**
 * SQLite não permite alterar um CHECK existente. A migração recria somente a
 * tabela filha, dentro da transação externa de runMigrations, e preserva todas
 * as linhas e índices.
 */
export function migrateAcknowledgementSyncStatus(database: SQLiteMigrationDatabase): void {
  const table = database.getFirstSync<{ sql: string | null }>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'document_ack_events_local'`,
  );
  if (!table?.sql || /sync_status[\s\S]*'superseded'/i.test(table.sql)) return;

  database.runSync(`DROP TABLE IF EXISTS document_ack_events_local_v22`);
  database.runSync(`
    CREATE TABLE document_ack_events_local_v22 (
      id TEXT PRIMARY KEY,
      client_event_id TEXT NOT NULL UNIQUE,
      document_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('acknowledged','refused','unable_to_sign')),
      declaration_version TEXT NOT NULL,
      declaration_text TEXT NOT NULL,
      declaration_hash TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_relationship TEXT NOT NULL,
      signature_strokes TEXT,
      signature_hash TEXT,
      reason TEXT,
      witness_json TEXT,
      occurred_at_device TEXT NOT NULL,
      recorded_at_server TEXT,
      device_id_hash TEXT,
      created_by TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending','syncing','confirmed','superseded','failed')),
      protocol TEXT,
      remote_signature_path TEXT,
      error_code TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      training_mode INTEGER NOT NULL DEFAULT 0,
      correction_of TEXT,
      correction_reason TEXT,
      FOREIGN KEY (document_id) REFERENCES generated_documents_local(id)
    )
  `);
  database.runSync(`
    INSERT INTO document_ack_events_local_v22 (${EVENT_COLUMNS})
    SELECT ${EVENT_COLUMNS} FROM document_ack_events_local
  `);
  database.runSync(`DROP TABLE document_ack_events_local`);
  database.runSync(`ALTER TABLE document_ack_events_local_v22 RENAME TO document_ack_events_local`);
  database.runSync(`CREATE INDEX idx_document_ack_events_document ON document_ack_events_local (document_id, occurred_at_device DESC)`);
  database.runSync(`CREATE INDEX idx_document_ack_events_sync ON document_ack_events_local (sync_status, attempts)`);
}
