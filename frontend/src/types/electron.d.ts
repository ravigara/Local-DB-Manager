export {};

import type {
  CreateDatabaseConfig,
  Database,
  DatabaseStatus,
  ExportResult,
  FileOperationResult,
  QueryResult,
  StoredDatabase,
  TableDetails
} from "./database";

declare global {

  interface Window {

    databaseAPI: {

      create: (
        config: CreateDatabaseConfig
      ) => Promise<Database>;

      list: () => Promise<StoredDatabase[]>;

      start: (
        id: string
      ) => Promise<void>;

      stop: (
        id: string
      ) => Promise<void>;

      restart: (
        id: string
      ) => Promise<void>;

      status: (
        id: string
      ) => Promise<DatabaseStatus>;

      logs: (
        id: string
      ) => Promise<string>;

      ping: (
        id: string
      ) => Promise<boolean>;

      listDatabases: (
        id: string
      ) => Promise<string[]>;

      listTables: (
        id: string
      ) => Promise<string[]>;

      query: (
        id: string,
        sql: string,
        params?: unknown[]
      ) => Promise<QueryResult>;

      tableDetails: (
        id: string,
        tableName: string
      ) => Promise<TableDetails>;

      exportTableCsv: (
        id: string,
        tableName: string
      ) => Promise<ExportResult>;

      backup: (
        id: string
      ) => Promise<FileOperationResult>;

      restore: (
        id: string
      ) => Promise<FileOperationResult>;

      remove: (
        id: string
      )  => Promise<void>;

      delete: (
        id: string
      ) => Promise<void>;
    };
  }
}
