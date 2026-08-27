export type DatabaseStatus =
  | "running"
  | "starting"
  | "stopping"
  | "stopped"
  | "error"
  | "not-found"
  | "unknown";

export interface CreateDatabaseConfig {
  name: string;
  port: number;
  password: string;
  database: string;
}

export type QueryCell = string | number | boolean | null;

export interface QueryResult {
  columns: string[];
  rows: Record<string, QueryCell>[];
  affectedRows: number;
  executionTimeMs: number;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  defaultValue: QueryCell;
  extra: string;
}

export interface TableDetails {
  tableName: string;
  columns: TableColumn[];
  rows: Record<string, QueryCell>[];
}

export interface ExportResult {
  canceled: boolean;
  filePath?: string;
  rowCount?: number;
}

export interface FileOperationResult {
  canceled: boolean;
  filePath?: string;
}

export interface StoredDatabase {
  id: string;
  name: string;
  engine: string;
  version: string;
  host: string;
  port: number;
  database: string;
  username: string;
  containerName: string;
  volumeName: string;
  createdAt: string;
}

export interface Database extends StoredDatabase {
  status: DatabaseStatus;
}
