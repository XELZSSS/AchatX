const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILENAME = 'axchat.sqlite';
const DB_SCHEMA_VERSION = 2;
const DB_SIDECARE_SUFFIXES = ['', '-wal', '-shm'];

let database = null;

const ensureDatabaseDir = (databasePath) => {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
};

const getDatabasePath = () => path.join(app.getPath('userData'), DB_FILENAME);

const configureDatabase = (db) => {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
};

const openDatabase = (databasePath) => {
  const instance = new Database(databasePath);
  configureDatabase(instance);
  return instance;
};

const applySchema = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      reasoning TEXT,
      is_error INTEGER NOT NULL DEFAULT 0,
      token_usage_json TEXT,
      tool_calls_json TEXT,
      tool_results_json TEXT,
      citations_json TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (session_id, id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE (session_id, seq)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
      ON sessions(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_messages_session_seq
      ON messages(session_id, seq);
  `);

  db.pragma(`user_version = ${DB_SCHEMA_VERSION}`);
};

const ensureDatabase = () => {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  ensureDatabaseDir(databasePath);
  database = openDatabase(databasePath);
  applySchema(database);
  return database;
};

const closeDatabase = () => {
  if (!database) {
    return;
  }

  database.close();
  database = null;
};

const resetDatabaseFiles = () => {
  closeDatabase();

  const databasePath = getDatabasePath();
  for (const suffix of DB_SIDECARE_SUFFIXES) {
    try {
      fs.rmSync(`${databasePath}${suffix}`, { force: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
};

module.exports = {
  closeDatabase,
  ensureDatabase,
  getDatabasePath,
  resetDatabaseFiles,
};
