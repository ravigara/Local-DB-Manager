import { randomUUID } from "crypto";

import {
  DatabaseConfig,
  DatabaseStatus,
  StoredDatabase
} from "../types/database";

import type {
  DatabaseEngine
} from "../types/database";

import {
  DockerManager
} from "./DockerManager";

import {
  normalizeDatabaseStatus
} from "../utils/DatabaseValidation";

import {
  getDatabaseEngineDefinition
} from "../utils/DatabaseEngines";

export class DatabaseManager {

  private docker =
    new DockerManager();

  async isDockerRunning(): Promise<boolean> {
    return this.docker.isDockerRunning();
  }

  async create(
    engine: DatabaseEngine,
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

    if (engine === "mysql") {
      await this.docker.createMySQLContainer(
        containerName,
        volumeName,
        port,
        password,
        database
      );
    } else if (engine === "postgresql") {
      await this.docker.createPostgreSQLContainer(
        containerName,
        volumeName,
        port,
        password,
        database
      );
    } else if (engine === "mariadb") {
      await this.docker.createMariaDBContainer(
        containerName,
        volumeName,
        port,
        password,
        database
      );
    } else {
      await this.docker.createMongoDBContainer(
        containerName,
        volumeName,
        port,
        password,
        database
      );
    }

    const dockerStatus =
      await this.docker.getContainerStatus(
        containerName
      );

    return {

      id,

      name,

      engine,

      version: getDatabaseEngineDefinition(engine).version,

      host: "localhost",

      port,

      database,

      username: getDatabaseEngineDefinition(engine).username,

      containerName,

      volumeName,

      status: this.normalizeStatus(dockerStatus),

      createdAt:
        new Date().toISOString()
    };
  }

  async start(
    database: StoredDatabase,
    password: string
  ) {

    const status = await this.docker.getContainerStatus(
      database.containerName
    );

    if (status === "not-found") {
      if (database.engine === "mysql") {
        await this.docker.recreateMySQLContainer(
          database.containerName,
          database.volumeName,
          database.port,
          password,
          database.database
        );
      } else if (database.engine === "postgresql") {
        await this.docker.recreatePostgreSQLContainer(
          database.containerName,
          database.volumeName,
          database.port,
          password,
          database.database
        );
      } else if (database.engine === "mariadb") {
        await this.docker.recreateMariaDBContainer(
          database.containerName,
          database.volumeName,
          database.port,
          password,
          database.database
        );
      } else {
        await this.docker.recreateMongoDBContainer(
          database.containerName,
          database.volumeName,
          database.port,
          password,
          database.database
        );
      }
      return;
    }

    return this.docker.startContainer(
      database.containerName
    );
  }

  async createMySQL(
    name: string,
    port: number,
    password: string,
    database: string
  ): Promise<DatabaseConfig> {
    return this.create("mysql", name, port, password, database);
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
    engine: DatabaseEngine,
    containerName: string,
    databaseName: string,
    rootPassword: string,
    destinationPath: string
  ): Promise<void> {

    return this.docker.backupDatabase(
      engine,
      containerName,
      databaseName,
      rootPassword,
      destinationPath
    );
  }

  async restoreDatabase(
    engine: DatabaseEngine,
    containerName: string,
    databaseName: string,
    rootPassword: string,
    sourcePath: string
  ): Promise<void> {

    return this.docker.restoreDatabase(
      engine,
      containerName,
      databaseName,
      rootPassword,
      sourcePath
    );
  }

  private normalizeStatus(status: string): DatabaseStatus {
    return normalizeDatabaseStatus(status);
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
