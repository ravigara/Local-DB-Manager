import mysql from "mysql2/promise";
import type {
  Connection as MySQLConnection,
  FieldPacket,
  ResultSetHeader,
  RowDataPacket
} from "mysql2/promise";
import { Client as PostgreSQLClient } from "pg";
import { writeFile } from "fs/promises";
import path from "path";

import { AppDatabase } from "../database/AppDatabase";
import type {
  DatabaseEngine,
  QueryCell,
  QueryResult,
  TableDetails
} from "../types/database";
import type { ExportResult } from "../types/database";
import {
  toCsvCell,
  validateTableName
} from "../utils/DatabaseValidation";

interface NormalizedQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  affectedRows: number;
}

interface DatabaseConnection {
  query(sql: string, params: unknown[]): Promise<NormalizedQueryResult>;
  end(): Promise<void>;
}

export class DatabaseConnectionService {
  constructor(private readonly database: AppDatabase) {}

  async ping(id: unknown): Promise<boolean> {
    const connection = await this.connect(id);

    try {
      await connection.query("SELECT 1", []);
      return true;
    } finally {
      await connection.end();
    }
  }

  async listDatabases(id: unknown): Promise<string[]> {
    const record = this.getDatabase(id);
    const connection = await this.connect(id);

    try {
      const result = await connection.query(
        record.engine === "mysql" || record.engine === "mariadb"
          ? "SHOW DATABASES"
          : "SELECT datname AS \"Database\" FROM pg_database WHERE datistemplate = false ORDER BY datname",
        []
      );

      return result.rows
        .map(row => String(row.Database ?? row.database ?? row.datname ?? ""))
        .filter(Boolean);
    } finally {
      await connection.end();
    }
  }

  async listTables(id: unknown): Promise<string[]> {
    const record = this.getDatabase(id);
    const connection = await this.connect(id);

    try {
      const result = await connection.query(
        record.engine === "mysql" || record.engine === "mariadb"
          ? "SHOW TABLES"
          : "SELECT table_name AS \"tableName\" FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
        []
      );

      return result.rows
        .map(row => record.engine === "mysql" || record.engine === "mariadb"
          ? String(row[`Tables_in_${record.database}`] ?? "")
          : String(row.tableName ?? row.table_name ?? ""))
        .filter(Boolean);
    } finally {
      await connection.end();
    }
  }

  async query(
    id: unknown,
    sql: unknown,
    params: unknown[] = []
  ): Promise<QueryResult> {
    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error("SQL query is required");
    }

    if (sql.length > 100_000) {
      throw new Error("SQL query is too large");
    }

    if (!Array.isArray(params)) {
      throw new Error("SQL parameters must be an array");
    }

    const connection = await this.connect(id);
    const startedAt = Date.now();

    try {
      const result = await connection.query(sql, params);

      return {
        columns: result.columns,
        rows: result.rows.map(row => this.toRow(row, result.columns)),
        affectedRows: result.columns.length > 0 ? 0 : result.affectedRows,
        executionTimeMs: Date.now() - startedAt
      };
    } finally {
      await connection.end();
    }
  }

  async getTableDetails(
    id: unknown,
    tableName: unknown
  ): Promise<TableDetails> {
    const table = validateTableName(tableName);
    const record = this.getDatabase(id);
    const connection = await this.connect(id);

    try {
      const columnResult = record.engine === "mysql" || record.engine === "mariadb"
        ? await connection.query(
          `SHOW COLUMNS FROM ${this.quoteTable(record.engine, table)}`,
          []
        )
        : await connection.query(
          `SELECT c.column_name AS "columnName", c.data_type AS "type", c.is_nullable AS "isNullable", CASE WHEN EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY') THEN 'PRI' ELSE '' END AS "key", c.column_default AS "defaultValue", '' AS "extra" FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = $1 ORDER BY c.ordinal_position`,
          [table]
        );
      const dataResult = await connection.query(
        `SELECT * FROM ${this.quoteTable(record.engine, table)} LIMIT 100`,
        []
      );

      const columns = record.engine === "mysql" || record.engine === "mariadb"
        ? columnResult.rows.map(row => ({
          name: String(row.Field ?? ""),
          type: String(row.Type ?? ""),
          nullable: String(row.Null ?? "").toUpperCase() === "YES",
          key: String(row.Key ?? ""),
          defaultValue: this.toQueryCell(row.Default),
          extra: String(row.Extra ?? "")
        }))
        : columnResult.rows.map(row => ({
          name: String(row.columnName ?? ""),
          type: String(row.type ?? ""),
          nullable: String(row.isNullable ?? "").toUpperCase() === "YES",
          key: String(row.key ?? ""),
          defaultValue: this.toQueryCell(row.defaultValue),
          extra: String(row.extra ?? "")
        }));

      return {
        tableName: table,
        columns,
        rows: dataResult.rows.map(row => this.toRow(row, dataResult.columns))
      };
    } finally {
      await connection.end();
    }
  }

  async exportTableCsv(
    id: unknown,
    tableName: unknown,
    destinationPath: unknown
  ): Promise<ExportResult> {
    const table = validateTableName(tableName);

    if (
      typeof destinationPath !== "string" ||
      !path.isAbsolute(destinationPath)
    ) {
      throw new Error("Invalid export path");
    }

    const record = this.getDatabase(id);
    const connection = await this.connect(id);

    try {
      const result = await connection.query(
        `SELECT * FROM ${this.quoteTable(record.engine, table)}`,
        []
      );
      const csvRows = [
        result.columns.map(column => toCsvCell(column)).join(","),
        ...result.rows.map(row => result.columns
          .map(column => toCsvCell(this.toQueryCell(row[column])))
          .join(","))
      ];

      await writeFile(
        destinationPath,
        `${csvRows.join("\r\n")}\r\n`,
        "utf8"
      );

      return {
        canceled: false,
        filePath: destinationPath,
        rowCount: result.rows.length
      };
    } finally {
      await connection.end();
    }
  }

  private async connect(id: unknown): Promise<DatabaseConnection> {
    const record = this.getDatabase(id);
    const password = this.database.getPassword(record.id);

    if (password === undefined) {
      throw new Error(
        "Database credentials are unavailable. Recreate this environment to connect."
      );
    }

    if (record.engine === "mysql" || record.engine === "mariadb") {
      const connection = await mysql.createConnection({
        host: record.host,
        port: record.port,
        user: record.username,
        password,
        database: record.database,
        connectTimeout: 5000
      });

      return this.wrapMySQLConnection(connection);
    }

    const connection = new PostgreSQLClient({
      host: record.host,
      port: record.port,
      user: record.username,
      password,
      database: record.database,
      connectionTimeoutMillis: 5000
    });
    await connection.connect();

    return {
      query: async (sql, params) => {
        const result = await connection.query(sql, params);
        return {
          columns: result.fields.map(field => field.name),
          rows: result.rows as Record<string, unknown>[],
          affectedRows: result.rowCount ?? 0
        };
      },
      end: () => connection.end()
    };
  }

  private wrapMySQLConnection(connection: MySQLConnection): DatabaseConnection {
    return {
      query: async (sql, params) => {
        const [result, fields] = await connection.query(sql, params);

        if (Array.isArray(result)) {
          const rows = result as RowDataPacket[];
          const queryFields = (Array.isArray(fields) ? fields : []) as FieldPacket[];
          return {
            columns: queryFields.length > 0
              ? queryFields.map(field => field.name)
              : Object.keys(rows[0] ?? {}),
            rows: rows as Record<string, unknown>[],
            affectedRows: 0
          };
        }

        const header = result as ResultSetHeader;
        return {
          columns: [],
          rows: [],
          affectedRows: header.affectedRows ?? 0
        };
      },
      end: () => connection.end()
    };
  }

  private getDatabase(id: unknown) {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid database ID");
    }

    const record = this.database.getById(id);

    if (!record) {
      throw new Error("Database environment not found");
    }

    return record;
  }

  private quoteTable(engine: DatabaseEngine, table: string): string {
    if (engine === "mysql" || engine === "mariadb") {
      return `\`${table}\``;
    }

    return `"${table.replaceAll('"', '""')}"`;
  }

  private toRow(
    row: Record<string, unknown>,
    columns: string[]
  ): Record<string, QueryCell> {
    return Object.fromEntries(
      columns.map(column => [column, this.toQueryCell(row[column])])
    );
  }

  private toQueryCell(value: unknown): QueryCell {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
      return value.toString("hex");
    }

    return JSON.stringify(value) ?? String(value);
  }
}
