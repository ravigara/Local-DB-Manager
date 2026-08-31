import type {
  DatabaseStatus,
  QueryCell
} from "../types/database";

const databaseNamePattern = /^[A-Za-z0-9_]{1,64}$/;
const tableNamePattern = /^[A-Za-z0-9_$-]{1,64}$/;

export function validateEnvironmentName(value: string): string {
  const name = value.trim();

  if (!name) {
    throw new Error("Database name is required");
  }

  return name;
}

export function validateDatabaseName(value: string): string {
  const name = value.trim();

  if (!name) {
    throw new Error("Database name is required");
  }

  if (!databaseNamePattern.test(name)) {
    throw new Error(
      "Database name may contain only letters, numbers, and underscores"
    );
  }

  return name;
}

export function validatePort(value: number): number {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error("Port must be between 1024 and 65535");
  }

  return value;
}

export function validateTableName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !tableNamePattern.test(value)
  ) {
    throw new Error("Invalid table name");
  }

  return value;
}

export function normalizeDatabaseStatus(status: string): DatabaseStatus {
  if (status === "running" || status === "healthy") {
    return "running";
  }

  if (status === "not-found") {
    return "not-found";
  }

  if (status === "starting") {
    return "starting";
  }

  if (status === "stopping") {
    return "stopping";
  }

  if (
    status === "exited" ||
    status === "dead" ||
    status === "stopped" ||
    status === "created"
  ) {
    return "stopped";
  }

  if (status === "unhealthy") {
    return "error";
  }

  return "unknown";
}

export function toCsvCell(value: QueryCell): string {
  const text = value === null ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
