const crypto = require('node:crypto');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

function buildCipher(secret) {
  if (!secret || secret.length < 24) {
    throw new Error('BOT_SESSION_ENCRYPTION_KEY deve ter pelo menos 24 caracteres.');
  }
  const key = crypto.createHash('sha256').update(secret, 'utf8').digest();
  return {
    encrypt(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const plain = JSON.stringify(value, BufferJSON.replacer);
      const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
    },
    decrypt(payload) {
      const [version, ivValue, tagValue, encryptedValue] = String(payload).split('.');
      if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
        throw new Error('Formato de sessão criptografada inválido.');
      }
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plain, BufferJSON.reviver);
    },
  };
}

async function useSupabaseAuthState(supabase, sessionId, encryptionSecret) {
  const cipher = buildCipher(encryptionSecret);
  const store = new Map();
  const { data, error } = await supabase.rpc('bot_load_auth_state', { p_session_id: sessionId });
  if (error) throw new Error(`Falha ao carregar a sessão persistida: ${error.message}`);

  for (const row of Array.isArray(data) ? data : []) {
    try {
      store.set(`${row.key_category}:${row.key_id}`, cipher.decrypt(row.encrypted_payload));
    } catch (stateError) {
      throw new Error(`Não foi possível descriptografar ${row.key_category}/${row.key_id}: ${stateError.message}`);
    }
  }

  const read = (category, id) => store.get(`${category}:${id}`);
  const write = async (category, id, value) => {
    const mapKey = `${category}:${id}`;
    if (value == null) {
      store.delete(mapKey);
      const { error: deleteError } = await supabase.rpc('bot_delete_auth_state', {
        p_session_id: sessionId,
        p_key_category: category,
        p_key_id: id,
      });
      if (deleteError) throw new Error(deleteError.message);
      return;
    }
    store.set(mapKey, value);
    const { error: saveError } = await supabase.rpc('bot_set_auth_state', {
      p_session_id: sessionId,
      p_key_category: category,
      p_key_id: id,
      p_encrypted_payload: cipher.encrypt(value),
    });
    if (saveError) throw new Error(saveError.message);
  };

  const creds = read('creds', 'creds') || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          for (const id of ids) {
            let value = read(type, id);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            result[id] = value;
          }
          return result;
        },
        set: async (updates) => {
          const writes = [];
          for (const [category, values] of Object.entries(updates || {})) {
            for (const [id, value] of Object.entries(values || {})) {
              writes.push(write(category, id, value));
            }
          }
          await Promise.all(writes);
        },
      },
    },
    saveCreds: () => write('creds', 'creds', creds),
    clearState: async () => {
      store.clear();
      const { error: clearError } = await supabase.rpc('bot_delete_auth_state', {
        p_session_id: sessionId,
        p_key_category: null,
        p_key_id: null,
      });
      if (clearError) throw new Error(clearError.message);
    },
  };
}

module.exports = { useSupabaseAuthState };
