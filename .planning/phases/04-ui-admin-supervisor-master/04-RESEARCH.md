# Phase 04: UI Redesign — Admin + Supervisor + Master - Research

**Researched:** 2024-05-24
**Domain:** React Native UI, Data Visualization, Performance (Supabase RPC, Async Storage), Push Notifications
**Confidence:** HIGH

## Summary

This phase focuses on migrating the administrative interfaces (Admin, Supervisor, and Master) to the newly established Design System from Phase 2. This includes replacing silent failures with robust error states (`ErrorState`), optimizing heavy queries (eliminating `LIMIT` issues using Supabase RPCs), implementing cache invalidation (24h TTL) for `risco-config.tsx`, adding CSV export for logs using Expo FileSystem, and integrating Push Notifications for new agent assignments.

**Primary recommendation:** Use the existing Phase 2 UI components (`Card`, `ErrorState`, `LoadingState`, `Badge`, `EmptyState`) across all 17 screens. Implement CSV exports using `expo-file-system` and `expo-sharing`, and trigger push notifications directly via Expo Push API call from the client or via a Supabase Edge Function (if available).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-file-system` | ~19.0.21 | CSV file generation | Required to write CSV files locally before sharing |
| `expo-sharing` | ~14.0.8 | Native share dialog | Standard Expo way to export files to other apps |
| `expo-notifications` | ~0.32.16 | Push notifications | Already configured in the project |
| `@react-native-async-storage/async-storage` | ^2.2.0 | Local caching | Existing solution for offline configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Building charts from scratch | `react-native-chart-kit` | We already use Flexbox and simple `View` elements for bar charts in `estatisticas.tsx`. For this redesign, keeping the custom Flexbox charts is preferred over adding a heavy dependency, unless complex interactions are needed. |

**Version verification:** 
Versions verified directly against `package.json`. No new installations required as these libraries are already present.

## Architecture Patterns

### Caching with TTL (AsyncStorage)
**What:** Storing configuration locally but expiring it after 24 hours to ensure admins receive updated risk parameters.
**When to use:** In `risco-config.tsx`.
**Example:**
```typescript
const STORAGE_KEY = '@risco_config_v1';
const TTL_HOURS = 24;

const saveWithTTL = async (data: any) => {
  const payload = {
    data,
    timestamp: Date.now()
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const loadWithTTL = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  
  const { data, timestamp } = JSON.parse(raw);
  const isExpired = (Date.now() - timestamp) > (TTL_HOURS * 60 * 60 * 1000);
  
  if (isExpired) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null; // Force fetch from Cloud
  }
  return data;
};
```

### Optimizing `SELECT` Queries
**What:** Avoid `select('*')` when only specific columns are needed.
**When to use:** In `relatorios.tsx`.
**Example:**
```typescript
// Anti-pattern
const { data } = await supabase.from('vistorias').select('*');

// Recommended
const { data } = await supabase.from('vistorias').select('id, dataVistoria, nivelRisco, agenteNome, endereco');
```

### Anti-Patterns to Avoid
- **Silent Failures:** Do not use `console.error` or `logger.error` without updating UI state. Always render an `ErrorState` component when data fetching fails.
- **Client-Side Heavy Grouping:** Avoid fetching all records (`select('municipio, nivelRisco')` without limits) to group them in memory. Use a Supabase RPC instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sharing CSV | Custom file path logic | `expo-file-system` + `expo-sharing` | Native share sheets handle permissions and target apps automatically |
| Error UI | Custom text views | `components/ui/ErrorState` | Ensures visual consistency across the entire app |
| Grouping metrics | Client-side loops | Supabase RPC (`GROUP BY`) | Prevents memory leaks and slow loading on devices with many records |

## Common Pitfalls

### Pitfall 1: Unhandled Promises in Push Notifications
**What goes wrong:** Sending a push notification fails silently because the agent hasn't registered an FCM token, or the Expo Push API call throws an error.
**Why it happens:** Assuming all users have valid `fcmToken`s.
**How to avoid:** Wrap the push notification call in a `try/catch` block, check if `agente.fcmToken` (or push token) exists, and do not block the assignment creation if the push notification fails.
**Warning signs:** Assignments are created but agents don't receive notifications, and no errors are logged.

### Pitfall 2: Memory Overflow with Large Datasets
**What goes wrong:** The app crashes when opening `municipios.tsx` in a production environment with thousands of records.
**Why it happens:** Fetching an unbounded array of vistorias to group by municipality on the client.
**How to avoid:** Create a Supabase RPC (e.g., `get_municipios_stats`) that performs the `GROUP BY` and returns an aggregated list.

## Code Examples

### Exporting Logs to CSV
```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const exportToCSV = async (logs: LogEntry[]) => {
  try {
    const header = "Data,Nível,Categoria,Mensagem\n";
    const rows = logs.map(l => `${new Date(l.criado_em).toISOString()},${l.level},${l.category},"${l.message.replace(/"/g, '""')}"`).join('\n');
    const csvString = header + rows;
    
    const fileUri = `${FileSystem.documentDirectory}logs_export.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    }
  } catch (error) {
    logger.error('system', 'Erro ao exportar CSV', { error: String(error) });
  }
};
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-file-system` | CSV Export | ✓ | ~19.0.21 | — |
| `expo-sharing` | CSV Export | ✓ | ~14.0.8 | — |
| `expo-notifications` | Push Notifications | ✓ | ~0.32.16 | Local notifications |
| `Supabase` | Data & RPCs | ✓ | ^2.45.0 | — |

**Missing dependencies with no fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + testing-library/react-native |
| Config file | `package.json` (jest section) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PH4-01 | Render ErrorState on fetch failure | unit | `npm test -- app/(panel)/admin/index.test.tsx` | ❌ Wave 0 |
| PH4-02 | CSV Export logic works | unit | `npm test -- app/(panel)/admin/logs.test.tsx` | ❌ Wave 0 |
| PH4-03 | 24h TTL logic in cache | unit | `npm test -- app/(panel)/admin/risco-config.test.tsx`| ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test -- --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/admin.test.tsx` — covers ErrorState and CSV
- [ ] `__tests__/risco-config.test.tsx` — covers TTL cache logic
- [ ] Missing Supabase RPC `get_municipios_stats` needs to be applied to the database.

## Sources

### Primary (HIGH confidence)
- `package.json` - Verified library versions.
- `app/(panel)/admin/estatisticas.tsx` - Verified existing simple charting using Flexbox.
- `app/(panel)/admin/risco-config.tsx` - Verified missing TTL logic in AsyncStorage.

### Secondary (MEDIUM confidence)
- Expo Docs for `expo-file-system` and `expo-sharing`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly observed in `package.json`
- Architecture: HIGH - Known best practices for Expo and React Native
- Pitfalls: HIGH - Common issues with Push Notifications and unbound queries

**Research date:** 2024-05-24
**Valid until:** 30 days
