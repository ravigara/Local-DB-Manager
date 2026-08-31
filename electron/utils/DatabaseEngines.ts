import type { DatabaseEngine } from "../types/database";

export interface DatabaseEngineDefinition {
  engine: DatabaseEngine;
  label: string;
  version: string;
  image: string;
  defaultPort: number;
  internalPort: number;
  username: string;
}

const definitions: Record<DatabaseEngine, DatabaseEngineDefinition> = {
  mysql: {
    engine: "mysql",
    label: "MySQL",
    version: "8.4",
    image: "mysql:8.4",
    defaultPort: 3307,
    internalPort: 3306,
    username: "root"
  },
  postgresql: {
    engine: "postgresql",
    label: "PostgreSQL",
    version: "17",
    image: "postgres:17",
    defaultPort: 5433,
    internalPort: 5432,
    username: "postgres"
  }
};

export function parseDatabaseEngine(value: unknown): DatabaseEngine {
  if (value === undefined || value === null || value === "") {
    return "mysql";
  }

  if (value === "mysql" || value === "postgresql") {
    return value;
  }

  throw new Error("Unsupported database engine");
}

export function getDatabaseEngineDefinition(
  engine: DatabaseEngine
): DatabaseEngineDefinition {
  return definitions[engine];
}

export function listDatabaseEngineDefinitions(): DatabaseEngineDefinition[] {
  return Object.values(definitions);
}
