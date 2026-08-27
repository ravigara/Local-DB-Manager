import { mkdirSync } from "fs";
import path from "path";
import { app, safeStorage } from "electron";
import { DatabaseSync } from "node:sqlite";

import { StoredDatabase } from "../types/database";

export class AppDatabase {

  private db: DatabaseSync;

  constructor() {
    const dataDirectory = app.getPath("userData");

    mkdirSync(dataDirectory, {
      recursive: true
    });

    const databasePath = path.join(
      dataDirectory,
      "local-db-manager.db"
    );

    this.db = new DatabaseSync(
      databasePath
    );

    this.initialize();
  }

  private initialize() {

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS databases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        engine TEXT NOT NULL,
        version TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        database_name TEXT NOT NULL,
        username TEXT NOT NULL,
        container_name TEXT NOT NULL UNIQUE,
        volume_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS database_credentials (
        database_id TEXT PRIMARY KEY,
        encrypted_password TEXT NOT NULL
      );
    `);
  }

  create(database: StoredDatabase, password: string) {

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Secure credential storage is unavailable on this system"
      );
    }

    const encryptedPassword =
      safeStorage
        .encryptString(password)
        .toString("base64");

    this.db.exec("BEGIN");

    try {
      const statement = this.db.prepare(`
        INSERT INTO databases (
          id,
          name,
          engine,
          version,
          host,
          port,
          database_name,
          username,
          container_name,
          volume_name,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      statement.run(
        database.id,
        database.name,
        database.engine,
        database.version,
        database.host,
        database.port,
        database.database,
        database.username,
        database.containerName,
        database.volumeName,
        database.createdAt
      );

      this.db.prepare(`
        INSERT INTO database_credentials (
          database_id,
          encrypted_password
        )
        VALUES (?, ?)
      `).run(database.id, encryptedPassword);

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getAll(): StoredDatabase[] {

    const statement = this.db.prepare(`
      SELECT
        id,
        name,
        engine,
        version,
        host,
        port,
        database_name AS database,
        username,
        container_name AS containerName,
        volume_name AS volumeName,
        created_at AS createdAt
      FROM databases
      ORDER BY created_at DESC
    `);

    return statement.all() as unknown as StoredDatabase[];
  }

  delete(id: string) {

    this.db.prepare(`
      DELETE FROM database_credentials
      WHERE database_id = ?
    `).run(id);

    const statement = this.db.prepare(`
      DELETE FROM databases
      WHERE id = ?
    `);

    statement.run(id);
  }

  getPassword(id: string): string | undefined {

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Secure credential storage is unavailable on this system"
      );
    }

    const row = this.db.prepare(`
      SELECT encrypted_password AS encryptedPassword
      FROM database_credentials
      WHERE database_id = ?
    `).get(id) as {
      encryptedPassword?: string;
    } | undefined;

    if (!row?.encryptedPassword) {
      return undefined;
    }

    return safeStorage.decryptString(
      Buffer.from(row.encryptedPassword, "base64")
    );
  }

  getById(
  id: string
): StoredDatabase | undefined {

  const statement = this.db.prepare(`
    SELECT
      id,
      name,
      engine,
      version,
      host,
      port,
      database_name AS database,
      username,
      container_name AS containerName,
      volume_name AS volumeName,
      created_at AS createdAt
    FROM databases
    WHERE id = ?
  `);

  return statement.get(id) as
    | StoredDatabase
    | undefined;
}

}
