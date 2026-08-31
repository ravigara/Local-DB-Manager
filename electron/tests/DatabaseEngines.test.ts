import assert from "node:assert/strict";
import test from "node:test";

import {
  getDatabaseEngineDefinition,
  listDatabaseEngineDefinitions,
  parseDatabaseEngine
} from "../utils/DatabaseEngines";

test("keeps legacy engine requests compatible", () => {
  assert.equal(parseDatabaseEngine(undefined), "mysql");
  assert.equal(parseDatabaseEngine(null), "mysql");
  assert.equal(parseDatabaseEngine(""), "mysql");
});

test("accepts supported engines and rejects unknown engines", () => {
  assert.equal(parseDatabaseEngine("mysql"), "mysql");
  assert.equal(parseDatabaseEngine("postgresql"), "postgresql");
  assert.equal(parseDatabaseEngine("mariadb"), "mariadb");
  assert.throws(
    () => parseDatabaseEngine("sqlite"),
    /Unsupported database engine/
  );
});

test("defines the container contract for all supported engines", () => {
  const mysql = getDatabaseEngineDefinition("mysql");
  const postgresql = getDatabaseEngineDefinition("postgresql");
  const mariadb = getDatabaseEngineDefinition("mariadb");

  assert.deepEqual(
    {
      image: mysql.image,
      version: mysql.version,
      defaultPort: mysql.defaultPort,
      internalPort: mysql.internalPort,
      username: mysql.username
    },
    {
      image: "mysql:8.4",
      version: "8.4",
      defaultPort: 3307,
      internalPort: 3306,
      username: "root"
    }
  );
  assert.deepEqual(
    {
      image: postgresql.image,
      version: postgresql.version,
      defaultPort: postgresql.defaultPort,
      internalPort: postgresql.internalPort,
      username: postgresql.username
    },
    {
      image: "postgres:17",
      version: "17",
      defaultPort: 5433,
      internalPort: 5432,
      username: "postgres"
    }
  );
  assert.deepEqual(
    {
      image: mariadb.image,
      version: mariadb.version,
      defaultPort: mariadb.defaultPort,
      internalPort: mariadb.internalPort,
      username: mariadb.username
    },
    {
      image: "mariadb:11.4",
      version: "11.4",
      defaultPort: 3308,
      internalPort: 3306,
      username: "root"
    }
  );
  assert.deepEqual(
    listDatabaseEngineDefinitions().map(definition => definition.engine),
    ["mysql", "postgresql", "mariadb"]
  );
});
