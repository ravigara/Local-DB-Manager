import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";

import { AppDatabase } from "../database/AppDatabase";
import { DockerManager } from "../managers/DockerManager";
import { DatabaseConnectionService } from "../services/DatabaseConnectionService";
import type { StoredDatabase } from "../types/database";

const execFileAsync = promisify(execFile);

async function getFreePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  await new Promise<void>(resolve => server.close(() => resolve()));

  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate an integration-test port");
  }

  return address.port;
}

async function dockerQuery(
  engine: "mysql" | "postgresql",
  containerName: string,
  password: string,
  sql: string
): Promise<string> {
  const args = engine === "mysql"
    ? ["exec", "-e", `MYSQL_PWD=${password}`, containerName, "mysql", "-uroot", "smoke", "-N", "-e", sql]
    : ["exec", "-e", `PGPASSWORD=${password}`, containerName, "psql", "-U", "postgres", "-d", "smoke", "-At", "-c", sql];
  const { stdout } = await execFileAsync("docker", args);
  return stdout.trim();
}

for (const engine of ["mysql", "postgresql"] as const) {
  test(`${engine} Docker lifecycle preserves volume data`, { timeout: 180_000 }, async t => {
    const manager = new DockerManager();

    if (!(await manager.isDockerRunning())) {
      t.skip("Docker Desktop is not running");
      return;
    }

    const suffix = `${process.pid}-${Date.now()}`;
    const containerName = `ldb-test-${engine}-${suffix}`;
    const volumeName = `ldb-test-${engine}-${suffix}-data`;
    const password = "IntegrationTestPassword123";
    const port = await getFreePort();
    const backupPath = join(tmpdir(), `${containerName}.sql`);
    const csvPath = join(tmpdir(), `${containerName}.csv`);
    const record: StoredDatabase = {
      id: containerName,
      name: containerName,
      engine,
      version: engine === "mysql" ? "8.4" : "17",
      host: "127.0.0.1",
      port,
      database: "smoke",
      username: engine === "mysql" ? "root" : "postgres",
      containerName,
      volumeName,
      createdAt: new Date().toISOString()
    };
    const connectionService = new DatabaseConnectionService({
      getById: () => record,
      getPassword: () => password
    } as unknown as AppDatabase);

    try {
      if (engine === "mysql") {
        await manager.createMySQLContainer(containerName, volumeName, port, password, "smoke");
      } else {
        await manager.createPostgreSQLContainer(containerName, volumeName, port, password, "smoke");
      }

      assert.ok(["healthy", "running"].includes(await manager.getContainerStatus(containerName)));
      await connectionService.query(record.id, "CREATE TABLE verification (id INTEGER PRIMARY KEY, note VARCHAR(64));");
      await connectionService.query(record.id, "INSERT INTO verification VALUES (1, 'persisted');");
      assert.equal((await connectionService.listTables(record.id)).includes("verification"), true);
      const details = await connectionService.getTableDetails(record.id, "verification");
      assert.equal(details.columns.some(column => column.name === "note"), true);
      const exportResult = await connectionService.exportTableCsv(record.id, "verification", csvPath);
      assert.equal(exportResult.rowCount, 1);
      assert.match(await readFile(csvPath, "utf8"), /persisted/);

      await manager.backupDatabase(engine, containerName, "smoke", password, backupPath);
      await connectionService.query(record.id, "DROP TABLE verification;");
      await manager.restoreDatabase(engine, containerName, "smoke", password, backupPath);
      assert.equal(await dockerQuery(engine, containerName, password, "SELECT note FROM verification WHERE id = 1;"), "persisted");

      await manager.stopContainer(containerName);
      await manager.startContainer(containerName);
      assert.ok(["healthy", "running"].includes(await manager.getContainerStatus(containerName)));
      assert.equal(await dockerQuery(engine, containerName, password, "SELECT note FROM verification WHERE id = 1;"), "persisted");

      await manager.removeContainer(containerName);
      assert.equal(await manager.getContainerStatus(containerName), "not-found");
      if (engine === "mysql") {
        await manager.recreateMySQLContainer(containerName, volumeName, port, password, "smoke");
      } else {
        await manager.recreatePostgreSQLContainer(containerName, volumeName, port, password, "smoke");
      }
      assert.equal(await dockerQuery(engine, containerName, password, "SELECT note FROM verification WHERE id = 1;"), "persisted");
    } finally {
      try {
        await manager.removeContainer(containerName);
      } catch {
        // The container may already have been removed after a failed setup.
      }
      try {
        await manager.removeVolume(volumeName);
      } catch {
        // Preserve the test failure if Docker cleanup itself fails.
      }
      await unlink(backupPath).catch(() => undefined);
      await unlink(csvPath).catch(() => undefined);
    }
  });
}
