import mysql from "mysql2/promise";
import type {
  Connection,
  FieldPacket,
  ResultSetHeader,
  RowDataPacket
} from "mysql2/promise";
import { writeFile } from "fs/promises";
import path from "path";

import {
  AppDatabase
} from "../database/AppDatabase";

import type {
  QueryCell,
  QueryResult,
  TableDetails
} from "../types/database";

import type {
  ExportResult
} from "../types/database";

export class DatabaseConnectionService {
  constructor(private readonly database: AppDatabase) {}

  async ping(id: unknown): Promise<boolean> {
    const connection = await this.connect(id);

    try {
      await connection.ping();
      return true;
    } finally {
      await connection.end();
    }
  }

  async listDatabases(id: unknown): Promise<string[]> {
    const connection = await this.connect(id);

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SHOW DATABASES"
      );

      return rows
        .map(row => String(row.Database ?? ""))
        .filter(Boolean);
    } finally {
      await connection.end();
    }
  }

  async listTables(id: unknown): Promise<string[]> {
    const record = this.getDatabase(id);
    const connection = await this.connect(id);

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SHOW TABLES"
      );

      return rows
        .map(row => String(row[`Tables_in_${record.database}`] ?? ""))
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
      const [result, fields] = await connection.query(
        sql,
        params
      );

      if (Array.isArray(result)) {
        const rows = result as RowDataPacket[];
        const queryFields = (Array.isArray(fields) ? fields : []) as FieldPacket[];
        const columns = queryFields.length > 0
          ? queryFields.map(field => field.name)
          : Object.keys(rows[0] ?? {});

        return {
          columns,
          rows: rows.map(row => this.toRow(row, columns)),
          affectedRows: 0,
          executionTimeMs: Date.now() - startedAt
        };
      }

      const header = result as ResultSetHeader;

      return {
        columns: [],
        rows: [],
        affectedRows: header.affectedRows ?? 0,
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

    const table = this.validateTableName(tableName);
    const connection = await this.connect(id);
    const quotedTable = `\`${table}\``;

    try {
      const [columnRows] = await connection.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM ${quotedTable}`
      );

      const [dataRows, fields] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM ${quotedTable} LIMIT 100`
      );

      const queryFields = (Array.isArray(fields) ? fields : []) as FieldPacket[];
      const dataColumns = queryFields.length > 0
        ? queryFields.map(field => field.name)
        : Object.keys(dataRows[0] ?? {});

      return {
        tableName: table,
        columns: columnRows.map(row => ({
          name: String(row.Field ?? ""),
          type: String(row.Type ?? ""),
          nullable: String(row.Null ?? "").toUpperCase() === "YES",
          key: String(row.Key ?? ""),
          defaultValue: this.toQueryCell(row.Default),
          extra: String(row.Extra ?? "")
        })),
        rows: dataRows.map(row => this.toRow(row, dataColumns))
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

    const table = this.validateTableName(tableName);

    if (
      typeof destinationPath !== "string" ||
      !path.isAbsolute(destinationPath)
    ) {
      throw new Error("Invalid export path");
    }

    const connection = await this.connect(id);
    const quotedTable = `\`${table}\``;

    try {
      const [rows, fields] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM ${quotedTable}`
      );

      const queryFields = (Array.isArray(fields) ? fields : []) as FieldPacket[];
      const columns = queryFields.length > 0
        ? queryFields.map(field => field.name)
        : Object.keys(rows[0] ?? {});
      const csvRows = [
        columns.map(column => this.toCsvCell(column)).join(","),
        ...rows.map(row => columns
          .map(column => this.toCsvCell(this.toQueryCell(row[column])))
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
        rowCount: rows.length
      };
    } finally {
      await connection.end();
    }
  }

  private async connect(id: unknown): Promise<Connection> {
    const record = this.getDatabase(id);
    const password = this.database.getPassword(record.id);

    if (password === undefined) {
      throw new Error(
        "Database credentials are unavailable. Recreate this environment to connect."
      );
    }

    return mysql.createConnection({
      host: record.host,
      port: record.port,
      user: record.username,
      password,
      database: record.database,
      connectTimeout: 5000
    });
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

  private toRow(
    row: RowDataPacket,
    columns: string[]
  ): Record<string, QueryCell> {

    return Object.fromEntries(
      columns.map(column => [
        column,
        this.toQueryCell(row[column])
      ])
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

  private validateTableName(tableName: unknown): string {

    if (
      typeof tableName !== "string" ||
      !/^[A-Za-z0-9_$-]{1,64}$/.test(tableName)
    ) {
      throw new Error("Invalid table name");
    }

    return tableName;
  }

  private toCsvCell(value: QueryCell): string {

    const text = value === null ? "" : String(value);

    if (/[",\r\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  }
}
