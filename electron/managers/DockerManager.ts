import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";

import type { DatabaseEngine } from "../types/database";
import { getDatabaseEngineDefinition } from "../utils/DatabaseEngines";

const execFileAsync = promisify(execFile);

export class DockerManager {

  async isDockerRunning(): Promise<boolean> {
    try {
      await execFileAsync("docker", ["info"]);
      return true;
    } catch {
      return false;
    }
  }

  async createMySQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string
  ): Promise<string> {

    return this.runMySQLContainer(
      containerName,
      volumeName,
      port,
      rootPassword,
      database,
      true
    );
  }

  async recreateMySQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string
  ): Promise<string> {

    if (!(await this.hasVolume(volumeName))) {
      throw new Error(
        `Database volume "${volumeName}" was not found. Delete this environment and create it again.`
      );
    }

    return this.runMySQLContainer(
      containerName,
      volumeName,
      port,
      rootPassword,
      database,
      false
    );
  }

  async createPostgreSQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    password: string,
    database: string
  ): Promise<string> {
    return this.runPostgreSQLContainer(
      containerName,
      volumeName,
      port,
      password,
      database,
      true
    );
  }

  async recreatePostgreSQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    password: string,
    database: string
  ): Promise<string> {
    if (!(await this.hasVolume(volumeName))) {
      throw new Error(
        `Database volume "${volumeName}" was not found. Delete this environment and create it again.`
      );
    }

    return this.runPostgreSQLContainer(
      containerName,
      volumeName,
      port,
      password,
      database,
      false
    );
  }

  async createMariaDBContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string
  ): Promise<string> {
    return this.runMariaDBContainer(
      containerName,
      volumeName,
      port,
      rootPassword,
      database,
      true
    );
  }

  async recreateMariaDBContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string
  ): Promise<string> {
    if (!(await this.hasVolume(volumeName))) {
      throw new Error(
        `Database volume "${volumeName}" was not found. Delete this environment and create it again.`
      );
    }

    return this.runMariaDBContainer(
      containerName,
      volumeName,
      port,
      rootPassword,
      database,
      false
    );
  }

  private async runMySQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string,
    removeVolumeOnFailure: boolean
  ): Promise<string> {

    const args = [
      "run",
      "-d",

      "--name",
      containerName,

      "-e",
      `MYSQL_ROOT_PASSWORD=${rootPassword}`,

      "-e",
      `MYSQL_DATABASE=${database}`,

      "-p",
      `${port}:3306`,

      "-v",
      `${volumeName}:/var/lib/mysql`,

      "--health-cmd",
      "mysqladmin ping -h 127.0.0.1 -uroot -p$MYSQL_ROOT_PASSWORD || exit 1",

      "--health-interval",
      "2s",

      "--health-timeout",
      "5s",

      "--health-retries",
      "15",

      "--health-start-period",
      "5s",

      getDatabaseEngineDefinition("mysql").image
    ];

    return this.runContainer(
      args,
      containerName,
      volumeName,
      removeVolumeOnFailure
    );
  }

  private async runPostgreSQLContainer(
    containerName: string,
    volumeName: string,
    port: number,
    password: string,
    database: string,
    removeVolumeOnFailure: boolean
  ): Promise<string> {
    const args = [
      "run",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${database}`,
      "-p",
      `${port}:${getDatabaseEngineDefinition("postgresql").internalPort}`,
      "-v",
      `${volumeName}:/var/lib/postgresql/data`,
      "--health-cmd",
      `pg_isready -U ${getDatabaseEngineDefinition("postgresql").username} -d ${database}`,
      "--health-interval",
      "2s",
      "--health-timeout",
      "5s",
      "--health-retries",
      "15",
      "--health-start-period",
      "5s",
      getDatabaseEngineDefinition("postgresql").image
    ];

    return this.runContainer(
      args,
      containerName,
      volumeName,
      removeVolumeOnFailure
    );
  }

  private async runMariaDBContainer(
    containerName: string,
    volumeName: string,
    port: number,
    rootPassword: string,
    database: string,
    removeVolumeOnFailure: boolean
  ): Promise<string> {
    const definition = getDatabaseEngineDefinition("mariadb");
    const args = [
      "run",
      "-d",
      "--name",
      containerName,
      "-e",
      `MARIADB_ROOT_PASSWORD=${rootPassword}`,
      "-e",
      `MARIADB_DATABASE=${database}`,
      "-p",
      `${port}:${definition.internalPort}`,
      "-v",
      `${volumeName}:/var/lib/mysql`,
      "--health-cmd",
      "mariadb-admin ping -h 127.0.0.1 -uroot -p$MARIADB_ROOT_PASSWORD || exit 1",
      "--health-interval",
      "2s",
      "--health-timeout",
      "5s",
      "--health-retries",
      "15",
      "--health-start-period",
      "5s",
      definition.image
    ];

    return this.runContainer(
      args,
      containerName,
      volumeName,
      removeVolumeOnFailure
    );
  }

  private async runContainer(
    args: string[],
    containerName: string,
    volumeName: string,
    removeVolumeOnFailure: boolean
  ): Promise<string> {

    try {
      const { stdout } =
        await execFileAsync("docker", args);

      await this.waitForReady(containerName);

      return stdout.trim();
    } catch (error) {
      await this.tryRemoveContainer(containerName);
      if (removeVolumeOnFailure) {
        await this.tryRemoveVolume(volumeName);
      }
      throw error;
    }
  }

  async stopContainer(
    containerName: string
  ): Promise<void> {

    const status = await this.getContainerStatus(containerName);

    if (status === "not-found") {
      throw new Error(`Docker container "${containerName}" was not found`);
    }

    if (
      status === "exited" ||
      status === "dead" ||
      status === "stopped" ||
      status === "created"
    ) {
      return;
    }

    await execFileAsync(
      "docker",
      ["stop", containerName]
    );
  }

  async startContainer(
    containerName: string
  ): Promise<void> {

    const status = await this.getContainerStatus(containerName);

    if (status === "not-found") {
      throw new Error(`Docker container "${containerName}" was not found`);
    }

    if (
      status === "running" ||
      status === "healthy" ||
      status === "starting"
    ) {
      await this.waitForReady(containerName);
      return;
    }

    await execFileAsync(
      "docker",
      ["start", containerName]
    );

    await this.waitForReady(containerName);
  }

  async restartContainer(
    containerName: string
  ): Promise<void> {

    const status = await this.getContainerStatus(containerName);

    if (status === "not-found") {
      throw new Error(`Docker container "${containerName}" was not found`);
    }

    await execFileAsync(
      "docker",
      ["restart", containerName]
    );

    await this.waitForReady(containerName);
  }

  async removeContainer(
  containerName: string
): Promise<void> {

  await execFileAsync(
    "docker",
    [
      "rm",
      "-f",
      containerName
    ]
  );
}

async removeVolume(
  volumeName: string
): Promise<void> {

  if (!(await this.hasVolume(volumeName))) {
    return;
  }

  await execFileAsync(
    "docker",
    [
      "volume",
      "rm",
      volumeName
    ]
  );
}

  private async hasVolume(
    volumeName: string
  ): Promise<boolean> {

    try {
      await execFileAsync(
        "docker",
        ["volume", "inspect", volumeName]
      );

      return true;
    } catch (error) {
      if (this.isMissingResourceError(error)) {
        return false;
      }

      throw error;
    }
  }

  async getContainerStatus(
    containerName: string
  ): Promise<string> {

    try {

      const { stdout } =
        await execFileAsync(
          "docker",
          [
            "inspect",
            "-f",
            "{{if eq .State.Status \"running\"}}{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}{{else}}{{.State.Status}}{{end}}",
            containerName
          ]
        );

      return stdout.trim();

    } catch (error) {

      if (this.isMissingResourceError(error)) {
        return "not-found";
      }

      throw error;
    }
  }

  private isMissingResourceError(
    error: unknown
  ): boolean {

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return /no such (object|container|volume)|not found/i.test(
      message
    );
  }

  private async waitForReady(
    containerName: string,
    timeoutMs = 60_000
  ): Promise<void> {

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getContainerStatus(containerName);

      if (status === "healthy" || status === "running") {
        return;
      }

      if (
        status === "unhealthy" ||
        status === "exited" ||
        status === "dead" ||
        status === "not-found"
      ) {
        const logs = await this.getContainerLogs(containerName);
        throw new Error(
          `MySQL container failed readiness check (${status}).\n${logs}`
        );
      }

      await this.delay(1000);
    }

    const logs = await this.getContainerLogs(containerName);
    throw new Error(
      `MySQL container did not become ready within ${timeoutMs / 1000} seconds.\n${logs}`
    );
  }

  async getContainerLogs(
    containerName: string
  ): Promise<string> {

    try {
      const { stdout, stderr } = await execFileAsync(
        "docker",
        ["logs", "--tail", "100", containerName]
      );

      return `${stdout}${stderr}`.trim();
    } catch {
      return "Container logs were unavailable.";
    }
  }

  async backupDatabase(
    engine: DatabaseEngine,
    containerName: string,
    databaseName: string,
    rootPassword: string,
    destinationPath: string
  ): Promise<void> {

    const definition = getDatabaseEngineDefinition(engine);
    const command = engine === "mysql" || engine === "mariadb" ? [
      engine === "mariadb" ? "mariadb-dump" : "mysqldump",
      "--single-transaction",
      "--routines",
      "--events",
      "--triggers",
      `-u${definition.username}`,
      databaseName
    ] : [
      "pg_dump",
      "-U",
      definition.username,
      "-d",
      databaseName
    ];
    const passwordVariable = engine === "mysql" || engine === "mariadb" ? "MYSQL_PWD" : "PGPASSWORD";
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", "-e", `${passwordVariable}=${rootPassword}`, containerName, ...command],
      {
        env: {
          ...process.env,
          [passwordVariable]: rootPassword
        },
        maxBuffer: 200 * 1024 * 1024
      }
    );

    await writeFile(destinationPath, stdout, "utf8");
  }

  async restoreDatabase(
    engine: DatabaseEngine,
    containerName: string,
    databaseName: string,
    rootPassword: string,
    sourcePath: string
  ): Promise<void> {

    const dump = await readFile(sourcePath);

    await new Promise<void>((resolve, reject) => {
      const definition = getDatabaseEngineDefinition(engine);
      const passwordVariable = engine === "mysql" || engine === "mariadb" ? "MYSQL_PWD" : "PGPASSWORD";
      const command = engine === "mysql" || engine === "mariadb" ? [
        engine === "mariadb" ? "mariadb" : "mysql",
        `-u${definition.username}`,
        databaseName
      ] : [
        "psql",
        "-U",
        definition.username,
        "-d",
        databaseName
      ];
      const child = spawn(
        "docker",
        [
          "exec",
          "-i",
          "-e",
          `${passwordVariable}=${rootPassword}`,
          containerName,
          ...command
        ],
        {
          env: {
            ...process.env,
            [passwordVariable]: rootPassword
          },
          stdio: ["pipe", "ignore", "pipe"]
        }
      );
      const stderrChunks: Buffer[] = [];

      if (!child.stdin || !child.stderr) {
        child.kill();
        reject(new Error("Unable to open the Docker restore process"));
        return;
      }

      child.stderr.on("data", chunk => {
        stderrChunks.push(Buffer.from(chunk as Uint8Array));
      });

      child.once("error", error => {
        reject(error);
      });

      child.once("close", code => {
        if (code === 0) {
          resolve();
          return;
        }

        const message = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(message || `Database restore failed with exit code ${String(code)}`));
      });

      child.stdin.end(dump);
    });
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }

  private async tryRemoveContainer(
    containerName: string
  ): Promise<void> {

    try {
      await this.removeContainer(containerName);
    } catch {
      // Preserve the original startup error.
    }
  }

  private async tryRemoveVolume(
    volumeName: string
  ): Promise<void> {

    try {
      await this.removeVolume(volumeName);
    } catch {
      // Preserve the original startup error.
    }
  }
}
