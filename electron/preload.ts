import {
  contextBridge,
  ipcRenderer
} from "electron";

import type {
  DatabaseConfig,
  DatabaseStatus,
  CreateDatabaseRequest,
  ExportResult,
  FileOperationResult,
  QueryResult,
  StoredDatabase,
  TableDetails
} from "./types/database";

contextBridge.exposeInMainWorld(
  "databaseAPI",
  {
    create: (
      config: CreateDatabaseRequest
    ): Promise<DatabaseConfig> => {
      return ipcRenderer.invoke(
        "database:create",
        config
      );
    },

    list: (): Promise<StoredDatabase[]> => {
      return ipcRenderer.invoke(
        "database:list"
      );
    },

    start: (
      id: string
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "database:start",
        id
      );
    },

    stop: (
      id: string
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "database:stop",
        id
      );
    },

    restart: (
      id: string
    ): Promise<void> => {
      return ipcRenderer.invoke(
        "database:restart",
        id
      );
    },

    status: (
      id: string
    ): Promise<DatabaseStatus> => {
      return ipcRenderer.invoke(
        "database:status",
        id
      );
    },

    logs: (
      id: string
    ): Promise<string> => {
      return ipcRenderer.invoke(
        "database:logs",
        id
      );
    },

    ping: (
      id: string
    ): Promise<boolean> => {
      return ipcRenderer.invoke(
        "database:ping",
        id
      );
    },

    listDatabases: (
      id: string
    ): Promise<string[]> => {
      return ipcRenderer.invoke(
        "database:list-databases",
        id
      );
    },

    listTables: (
      id: string
    ): Promise<string[]> => {
      return ipcRenderer.invoke(
        "database:list-tables",
        id
      );
    },

    query: (
      id: string,
      sql: string,
      params: unknown[] = []
    ): Promise<QueryResult> => {
      return ipcRenderer.invoke(
        "database:query",
        { id, sql, params }
      );
    },

    tableDetails: (
      id: string,
      tableName: string
    ): Promise<TableDetails> => {
      return ipcRenderer.invoke(
        "database:table-details",
        { id, tableName }
      );
    },

    exportTableCsv: (
      id: string,
      tableName: string
    ): Promise<ExportResult> => {
      return ipcRenderer.invoke(
        "database:export-table-csv",
        { id, tableName }
      );
    },

    backup: (
      id: string
    ): Promise<FileOperationResult> => {
      return ipcRenderer.invoke("database:backup", id);
    },

    restore: (
      id: string
    ): Promise<FileOperationResult> => {
      return ipcRenderer.invoke("database:restore", id);
    },

    remove: (
      id: string
    ) => {
      return ipcRenderer.invoke(
        "database:remove",
        id
      );
    },

    delete: (
      id: string
    ) => {
      return ipcRenderer.invoke(
        "database:delete",
        id
      );
    }
  }
);
