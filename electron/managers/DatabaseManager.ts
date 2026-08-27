import { randomUUID } from "crypto";

import {
  DatabaseConfig,
  DatabaseStatus
} from "../types/database";

import {
  DockerManager
} from "./DockerManager";

export class DatabaseManager {

  private docker =
    new DockerManager();

  async createMySQL(
    name: string,
    port: number,
    password: string,
    database: string
  ): Promise<DatabaseConfig> {

    const id =
      randomUUID();

    const containerName =
      `ldb-${id}`;

    const volumeName =
      `ldb-${id}-data`;

    await this.docker.createMySQLContainer(
      containerName,
      volumeName,
      port,
      password,
      database
    );

    const dockerStatus =
      await this.docker.getContainerStatus(
        containerName
      );

    return {

      id,

      name,

      engine: "mysql",

      version: "8.4",

      host: "localhost",

      port,

      database,

      username: "root",

      containerName,

      volumeName,

      status: this.normalizeStatus(dockerStatus),

      createdAt:
        new Date().toISOString()
    };
  }

  async start(
    containerName: string
  ) {

    return this.docker.startContainer(
      containerName
    );
  }

  async stop(
    containerName: string
  ) {

    return this.docker.stopContainer(
      containerName
    );
  }

  async restart(
    containerName: string
  ) {

    return this.docker.restartContainer(
      containerName
    );
  }

  async status(
    containerName: string
  ): Promise<DatabaseStatus> {

    return this.normalizeStatus(
      await this.docker.getContainerStatus(containerName)
    );
  }

  async logs(
    containerName: string
  ): Promise<string> {

    return this.docker.getContainerLogs(containerName);
  }

  async backupDatabase(
    containerName: string,
    databaseName: string,
    rootPassword: string,
    destinationPath: string
  ): Promise<void> {

    return this.docker.backupDatabase(
      containerName,
      databaseName,
      rootPassword,
      destinationPath
    );
  }

  async restoreDatabase(
    containerName: string,
    databaseName: string,
    rootPassword: string,
    sourcePath: string
  ): Promise<void> {

    return this.docker.restoreDatabase(
      containerName,
      databaseName,
      rootPassword,
      sourcePath
    );
  }

  private normalizeStatus(status: string): DatabaseStatus {
    if (status === "running") {
      return "running";
    }

    if (status === "healthy") {
      return "running";
    }

    if (status === "not-found") {
      return "not-found";
    }

    if (
      status === "starting" ||
      status === "exited" ||
      status === "dead" ||
      status === "stopped"
    ) {
      return status === "starting" ? "starting" : "stopped";
    }

    if (status === "unhealthy") {
      return "error";
    }

    return "unknown";
  }

  async removeContainer(
  containerName: string
) {
  return this.docker.removeContainer(
    containerName
  );
}

async removeVolume(
  volumeName: string
) {
  return this.docker.removeVolume(
    volumeName
  );
}

}
