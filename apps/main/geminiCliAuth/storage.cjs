/* global Buffer */
const { safeStorage } = require('electron');
const {
  readAppStorageValue,
  writeAppStorageValue,
  removeAppStorageValue,
} = require('../storage/appStorage.cjs');
const { AUTH_STORAGE_KEY } = require('./constants.cjs');

const encodeStoredPayload = (payload) => {
  const serialized = JSON.stringify(payload);
  if (safeStorage?.isEncryptionAvailable?.()) {
    const encrypted = safeStorage.encryptString(serialized).toString('base64');
    return `enc:${encrypted}`;
  }
  return `plain:${serialized}`;
};

const decodeStoredPayload = (value) => {
  const stored = String(value ?? '').trim();
  if (!stored) return null;

  try {
    if (stored.startsWith('enc:')) {
      const encrypted = Buffer.from(stored.slice(4), 'base64');
      return JSON.parse(safeStorage.decryptString(encrypted));
    }
    if (stored.startsWith('plain:')) {
      return JSON.parse(stored.slice(6));
    }
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const persistSession = (session) => {
  writeAppStorageValue(AUTH_STORAGE_KEY, encodeStoredPayload(session));
};

const clearSession = () => {
  removeAppStorageValue(AUTH_STORAGE_KEY);
};

const readSession = () => {
  const stored = readAppStorageValue(AUTH_STORAGE_KEY);
  const parsed = decodeStoredPayload(stored);
  if (!parsed || typeof parsed !== 'object') return null;

  const accessToken = String(parsed.accessToken ?? '').trim();
  const refreshToken = String(parsed.refreshToken ?? '').trim();
  const expiresAt = Number(parsed.expiresAt ?? 0);
  const email = String(parsed.email ?? '').trim() || undefined;
  const projectId = String(parsed.projectId ?? '').trim() || undefined;
  const managedProjectId = String(parsed.managedProjectId ?? '').trim() || undefined;

  if (!accessToken || !refreshToken || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    email,
    projectId,
    managedProjectId,
  };
};

const toStatus = (session) => {
  if (!session) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    email: session.email,
    expiresAt: session.expiresAt,
    projectId: session.managedProjectId || session.projectId,
  };
};

module.exports = {
  persistSession,
  clearSession,
  readSession,
  toStatus,
};
