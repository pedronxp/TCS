import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { migrateAcknowledgementSyncStatus } from '../utils/documentAcknowledgementSchema.ts';

function adapter(database) {
  return {
    runSync(sql, params = []) {
      return database.prepare(sql).run(...params);
    },
    getFirstSync(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null;
    },
  };
}

test('migra o CHECK local e preserva a ciência existente', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE generated_documents_local (id TEXT PRIMARY KEY);
    CREATE TABLE document_ack_events_local (
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
      sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','syncing','confirmed','failed')),
      protocol TEXT,
      remote_signature_path TEXT,
      error_code TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      training_mode INTEGER NOT NULL DEFAULT 0,
      correction_of TEXT,
      correction_reason TEXT,
      FOREIGN KEY (document_id) REFERENCES generated_documents_local(id)
    );
    CREATE INDEX idx_document_ack_events_document ON document_ack_events_local (document_id, occurred_at_device DESC);
    CREATE INDEX idx_document_ack_events_sync ON document_ack_events_local (sync_status, attempts);
    INSERT INTO generated_documents_local(id) VALUES ('doc-1');
    INSERT INTO document_ack_events_local(
      id, client_event_id, document_id, outcome, declaration_version,
      declaration_text, declaration_hash, recipient_name, recipient_relationship,
      occurred_at_device, created_by
    ) VALUES (
      'event-1', 'client-1', 'doc-1', 'acknowledged', 'v1',
      'Declaração preservada', 'hash', 'Pessoa', 'Morador',
      '2026-08-26T12:00:00.000Z', 'user-1'
    );
  `);

  migrateAcknowledgementSyncStatus(adapter(database));

  assert.equal(database.prepare(`SELECT COUNT(*) AS total FROM document_ack_events_local`).get().total, 1);
  database.prepare(`UPDATE document_ack_events_local SET sync_status = 'superseded' WHERE id = 'event-1'`).run();
  assert.equal(database.prepare(`SELECT sync_status FROM document_ack_events_local WHERE id = 'event-1'`).get().sync_status, 'superseded');
  assert.throws(
    () => database.prepare(`UPDATE document_ack_events_local SET sync_status = 'invalid' WHERE id = 'event-1'`).run(),
    /CHECK constraint failed/,
  );
  assert.deepEqual(
    database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_document_ack_events_%' ORDER BY name`).all().map(row => row.name),
    ['idx_document_ack_events_document', 'idx_document_ack_events_sync'],
  );
  database.close();
});
