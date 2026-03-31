import { getDb } from './database';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory =
  | 'auth'
  | 'sync'
  | 'vistoria'
  | 'network'
  | 'token'
  | 'form'
  | 'system'
  | 'notifications';

export interface LogEntry {
  id: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data: string | null;
  criado_em: string;
}

const MAX_LOGS = 500;

// ─── Sanitização de dados sensíveis ────────────────────────────────────────

const SENSITIVE_KEYS = ['password', 'senha', 'token', 'access_token', 'refresh_token', 'secret', 'authorization', 'codigo'];

function sanitize(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Mascarar tokens no formato XXXX-XXXX-XXXX ou UUIDs
    return data
      .replace(/\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/g, '***-****-***')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '****-uuid-****');
  }
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitize(v);
    }
  }
  return clean;
}

// ─── Escrita ───────────────────────────────────────────────────────────────

function writeLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: any
): void {
  const now = new Date().toISOString();
  const safeData = data !== undefined ? sanitize(data) : undefined;
  const dataStr = safeData !== undefined ? JSON.stringify(safeData) : null;

  // Console sempre (formatado, com dados sanitizados)
  const tag = `[${level.toUpperCase()}][${category}]`;
  if (level === 'error') console.error(tag, message, safeData ?? '');
  else if (level === 'warn') console.warn(tag, message, safeData ?? '');
  else console.log(tag, message, safeData ?? '');

  // Persistir no SQLite (nunca crasha o app por falha de log)
  try {
    const db = getDb();
    db.runSync(
      `INSERT INTO logs (level, category, message, data, criado_em) VALUES (?,?,?,?,?)`,
      [level, category, message, dataStr, now]
    );
    // Manter apenas os últimos MAX_LOGS registros
    db.runSync(
      `DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT ?)`,
      [MAX_LOGS]
    );
  } catch {
    // Silencioso — logging nunca pode quebrar o fluxo principal
  }
}

// ─── API pública ───────────────────────────────────────────────────────────

export const logger = {
  info: (category: LogCategory, message: string, data?: any) =>
    writeLog('info', category, message, data),
  warn: (category: LogCategory, message: string, data?: any) =>
    writeLog('warn', category, message, data),
  error: (category: LogCategory, message: string, data?: any) =>
    writeLog('error', category, message, data),
};

// ─── Leitura ───────────────────────────────────────────────────────────────

export function getLogs(options?: {
  limit?: number;
  level?: LogLevel;
  category?: LogCategory;
}): LogEntry[] {
  try {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.level) {
      conditions.push(`level = ?`);
      params.push(options.level);
    }
    if (options?.category) {
      conditions.push(`category = ?`);
      params.push(options.category);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 200;
    params.push(limit);

    return db.getAllSync<LogEntry>(
      `SELECT * FROM logs${where} ORDER BY id DESC LIMIT ?`,
      params
    );
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  try {
    getDb().runSync(`DELETE FROM logs`);
  } catch {}
}

export function countLogsByLevel(): { info: number; warn: number; error: number } {
  try {
    const db = getDb();
    const rows = db.getAllSync<{ level: string; total: number }>(
      `SELECT level, COUNT(*) as total FROM logs GROUP BY level`
    );
    const counts = { info: 0, warn: 0, error: 0 };
    for (const r of rows) {
      if (r.level === 'info') counts.info = r.total;
      else if (r.level === 'warn') counts.warn = r.total;
      else if (r.level === 'error') counts.error = r.total;
    }
    return counts;
  } catch {
    return { info: 0, warn: 0, error: 0 };
  }
}
