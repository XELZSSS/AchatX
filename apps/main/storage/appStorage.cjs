const { ensureDatabase } = require('./db.cjs');

const normalizeStorageKey = (key) => String(key);

const decodeStoredString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
};

const encodeStoredString = (value) => JSON.stringify(String(value));

const readStringSetting = (key) => {
  const db = ensureDatabase();
  const row = db
    .prepare(`SELECT value_json FROM app_settings WHERE key = ?`)
    .get(normalizeStorageKey(key));
  return row ? decodeStoredString(row.value_json) : null;
};

const writeStringSetting = (key, value) => {
  const db = ensureDatabase();
  const updatedAt = Date.now();

  db.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at)
     VALUES (@key, @value_json, @updated_at)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`
  ).run({
    key: normalizeStorageKey(key),
    value_json: encodeStoredString(value),
    updated_at: updatedAt,
  });
};

const removeStringSetting = (key) => {
  const db = ensureDatabase();
  db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(normalizeStorageKey(key));
};

const readAppStorageValue = (key) => readStringSetting(key);

const writeAppStorageValue = (key, value) => writeStringSetting(key, String(value ?? ''));

const removeAppStorageValue = (key) => removeStringSetting(key);

const listAppStorageValues = (keys) => {
  const requestedKeys = Array.isArray(keys) ? keys.map(normalizeStorageKey) : [];

  return Object.fromEntries(
    requestedKeys.map((key) => {
      const value = readAppStorageValue(key);
      return [key, value ?? null];
    })
  );
};

module.exports = {
  listAppStorageValues,
  readAppStorageValue,
  removeAppStorageValue,
  writeAppStorageValue,
};
