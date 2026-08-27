import {
  DatabaseManager
} from "../managers/DatabaseManager";

import {
  DatabaseConnectionService
} from "./DatabaseConnectionService";

import {
  AppDatabase
} from "../database/AppDatabase";

import {
  DatabaseConfig,
  CreateDatabaseRequest,
  ExportResult,
  FileOperationResult,
  QueryResult,
  StoredDatabase,
  TableDetails
} from "../types/database";

import {
  isPortAvailable
} from "../utils/PortChecker";

export class DatabaseService {

  private manager =
    new DatabaseManager();

  private database =
    new AppDatabase();

  private connection =
    new DatabaseConnectionService(this.database);

  async createDatabase(config: unknown): Promise<DatabaseConfig> {

    if (!this.isCreateDatabaseRequest(config)) {
      throw new Error("Invalid database configuration");
    }

    const name = config.name.trim();
    const databaseName = config.database.trim();

    if (!name) {
      throw new Error(
        "Database name is required"
      );
    }
    const existingName =
  this.database
    .getAll()
    .some(
      database =>
        database.name.toLowerCase() ===
        name.toLowerCase()
    );

if (existingName) {
  throw new Error(
    `Environment "${config.name}" already exists`
  );
}

    if (!databaseName) {
      throw new Error(
        "Database name is required"
      );
    }

    if (!/^[A-Za-z0-9_$-]{1,64}$/.test(databaseName)) {
      throw new Error(
        "Database name may contain only letters, numbers, _, $, and -"
      );
    }

    if (!config.password) {
      throw new Error(
        "Password is required"
      );
    }

    if (
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535
    ) {
      throw new Error(
        "Port must be between 1024 and 65535"
      );
    }
    const portAvailable =
      await isPortAvailable(
        config.port
      );

    if (!portAvailable) {
      throw new Error(
        `Port ${config.port} is already in use`
        );
    }

    const existing =
      this.database
        .getAll()
        .find(
          database =>
            database.port === config.port
        );

    if (existing) {
      throw new Error(
        `Port ${config.port} is already registered`
      );
    }

    const database = await this.manager.createMySQL(
      name,
      config.port,
      config.password,
      databaseName
    );

    const storedDatabase: StoredDatabase = {

      id: database.id,

      name: database.name,

      engine: database.engine,

      version: database.version,

      host: database.host,

      port: database.port,

      database: database.database,

      username: database.username,

      containerName:
        database.containerName,

      volumeName:
        database.volumeName,

      createdAt:
        database.createdAt
    };

    try {
      this.database.create(storedDatabase, config.password);
    } catch (error) {
      await this.cleanupCreatedDatabase(database);
      throw error;
    }

    return database;
  }

  getDatabases() {

    return this.database.getAll();
  }

  async start(id: unknown) {

    const database =
      this.getStoredDatabase(id);

    return this.manager.start(
      database.containerName
    );
  }

  async stop(id: unknown) {

    const database =
      this.getStoredDatabase(id);

    return this.manager.stop(
      database.containerName
    );
  }

  async restart(id: unknown) {

    const database =
      this.getStoredDatabase(id);

    return this.manager.restart(
      database.containerName
    );
  }

  async getStatus(id: unknown) {

    const database =
      this.getStoredDatabase(id);

    return this.manager.status(
      database.containerName
    );
  }

  async getLogs(id: unknown): Promise<string> {

    const database =
      this.getStoredDatabase(id);

    return this.manager.logs(database.containerName);
  }

  async ping(id: unknown): Promise<boolean> {
    return this.connection.ping(id);
  }

  async listDatabases(id: unknown): Promise<string[]> {
    return this.connection.listDatabases(id);
  }

  async listTables(id: unknown): Promise<string[]> {
    return this.connection.listTables(id);
  }

  async query(
    id: unknown,
    sql: unknown,
    params: unknown[] = []
  ): Promise<QueryResult> {
    return this.connection.query(id, sql, params);
  }

  async getTableDetails(
    id: unknown,
    tableName: unknown
  ): Promise<TableDetails> {
    return this.connection.getTableDetails(id, tableName);
  }

  async exportTableCsv(
    id: unknown,
    tableName: unknown,
    destinationPath: unknown
  ): Promise<ExportResult> {
    return this.connection.exportTableCsv(
      id,
      tableName,
      destinationPath
    );
  }

  async backupDatabase(
    id: unknown,
    destinationPath: unknown
  ): Promise<FileOperationResult> {

    const database = this.getStoredDatabase(id);
    const password = this.database.getPassword(database.id);

    if (password === undefined) {
      throw new Error("Database credentials are unavailable");
    }

    if (typeof destinationPath !== "string") {
      throw new Error("Invalid backup path");
    }

    await this.requireRunning(database.containerName);
    await this.manager.backupDatabase(
      database.containerName,
      database.database,
      password,
      destinationPath
    );

    return { canceled: false, filePath: destinationPath };
  }

  async restoreDatabase(
    id: unknown,
    sourcePath: unknown
  ): Promise<FileOperationResult> {

    const database = this.getStoredDatabase(id);
    const password = this.database.getPassword(database.id);

    if (password === undefined) {
      throw new Error("Database credentials are unavailable");
    }

    if (typeof sourcePath !== "string") {
      throw new Error("Invalid restore path");
    }

    await this.requireRunning(database.containerName);
    await this.manager.restoreDatabase(
      database.containerName,
      database.database,
      password,
      sourcePath
    );

    return { canceled: false, filePath: sourcePath };
  }

  async removeEnvironment(
  id: unknown
): Promise<void> {

  const database = this.getStoredDatabase(id);

  const status = await this.manager.status(database.containerName);

  if (status !== "not-found") {
    await this.manager.removeContainer(database.containerName);
  }
}
  async deleteEnvironment(
  id: unknown
): Promise<void> {

  const database = this.getStoredDatabase(id);

  const status = await this.manager.status(database.containerName);

  if (status !== "not-found") {
    await this.manager.removeContainer(database.containerName);
  }

  await this.manager.removeVolume(database.volumeName);

  this.database.delete(database.id);
}

  private getStoredDatabase(id: unknown): StoredDatabase {

    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid database ID");
    }

    const database =
      this.database.getById(id);

    if (!database) {
      throw new Error(
        "Database environment not found"
      );
    }

    return database;
  }

  private async requireRunning(containerName: string): Promise<void> {
    const status = await this.manager.status(containerName);

    if (status !== "running") {
      throw new Error("Database must be running for this operation");
    }
  }

  private isCreateDatabaseRequest(
    value: unknown
  ): value is CreateDatabaseRequest {

    if (!value || typeof value !== "object") {
      return false;
    }

    const config = value as Partial<CreateDatabaseRequest>;

    return (
      typeof config.name === "string" &&
      typeof config.port === "number" &&
      typeof config.password === "string" &&
      typeof config.database === "string"
    );
  }

  private async cleanupCreatedDatabase(
    database: DatabaseConfig
  ): Promise<void> {

    try {
      await this.manager.removeContainer(database.containerName);
    } catch {
      // Preserve the original persistence error.
    }

    try {
      await this.manager.removeVolume(database.volumeName);
    } catch {
      // Preserve the original persistence error.
    }
  }

}
