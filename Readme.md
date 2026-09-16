# Local DB Manager

Local DB Manager is a focused Windows desktop workspace for running and inspecting local database environments through Docker Desktop. It gives developers a fast, visible workflow for creating a database, waiting for it to become ready, connecting to it, and managing its lifecycle without memorizing container commands.

> A lightweight local database utility with the clarity of a desktop developer tool.

## What it does

- Create MySQL 8.4, PostgreSQL 17, MariaDB 11.4, or MongoDB 8.0 environments with a named persistent Docker volume.
- Start, stop, restart, inspect, and monitor container status.
- Recreate a removed container while retaining its data volume.
- Connect to a running instance and browse databases, SQL tables, or MongoDB collections.
- Inspect table columns and sample rows.
- Run SQL queries and view structured results.
- Export table data to CSV.
- Back up and restore a database through native file dialogs.
- Remove a container without deleting its volume, or permanently delete an environment and its data.
- Store local environment metadata and encrypted credentials in Electron application storage.

## Current status

The MySQL, PostgreSQL, MariaDB, and MongoDB MVPs are implemented end to end. The primary supported platform is Windows, and Docker Desktop must be running for database lifecycle, connection, backup, and restore operations. Additional engine versions and reusable templates are planned for future iterations.

The last implementation milestones are `c2be251` (PostgreSQL support) and `ce5f57e` (MariaDB support). The next session should begin with `git status --short`, `git log -5 --oneline`, and the verification commands in this document before starting new feature work.

## Requirements

- Windows 10 or later.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with the Docker engine running.
- Node.js and npm for development and building from source.

## Run from source

```powershell
git clone https://github.com/ravigara/Local-DB-Manager.git
cd Local-DB-Manager
npm install
npm --prefix frontend install
npm.cmd start
```

`npm.cmd start` builds the Electron main process and React frontend, then launches the desktop application. The packaged frontend is served through Electron’s internal loopback server so the application does not depend on fragile Windows `file://` renderer loading.

## Create your first environment

1. Start Docker Desktop.
2. Launch the app with `npm.cmd start`.
3. Select **New environment**.
4. Choose MySQL 8.4, PostgreSQL 17, MariaDB 11.4, or MongoDB 8.0, then enter an environment name, database name, unused host port, and admin password.
5. Select **Create environment** and wait for the status to become **Running**.
6. Select **Connect & inspect** to browse the instance or run SQL.

The database name accepts letters, numbers, and underscores. Host ports must be whole numbers from `1024` through `65535`; the defaults are `3307` for MySQL, `5433` for PostgreSQL, `3308` for MariaDB, and `27017` for MongoDB. The form validates these values inline before asking the Electron process to create the container.

## Development commands

Run these commands from the repository root:

```powershell
# Build Electron and the frontend
npm.cmd run build

# Run the Electron unit tests
npm.cmd test

# Lint the React renderer
npm.cmd --prefix frontend run lint

# Start the development application using the production frontend build
npm.cmd start

# Build the Windows installer and unpacked application
npm.cmd run package
```

The generated Windows installer is written to `release/Local DB Manager Setup 0.1.0.exe` when packaging completes.

The root install must be present before running these commands. Use `npm.cmd ci` and `npm.cmd --prefix frontend ci` for a clean install from both lockfiles.

## Architecture

```text
        React + Vite renderer
        │
        │ window.databaseAPI
        ▼
Electron preload bridge
        │
        │ explicit IPC handlers
        ▼
Electron main process
        │
        ├── SQLite application metadata
        ├── Docker container and volume lifecycle
        └── MySQL/PostgreSQL/MariaDB/MongoDB connections, queries, CSV, backup, restore
```

The renderer does not receive Node.js access. Electron keeps `contextIsolation` enabled and `nodeIntegration` disabled, while privileged filesystem, Docker, and database operations remain in the main process.

## Repository map

| Path | Responsibility |
| --- | --- |
| `electron/main.ts` | Creates the `BrowserWindow`, serves the built frontend over loopback, and registers IPC handlers. |
| `electron/preload.ts` | Exposes the allow-listed `window.databaseAPI` bridge to the renderer. |
| `electron/services/DatabaseService.ts` | Validates requests, checks Docker and ports, and coordinates persistence, lifecycle, and database operations. |
| `electron/managers/DatabaseManager.ts` | Maps a stored environment to the correct Docker lifecycle implementation. |
| `electron/managers/DockerManager.ts` | Runs Docker commands, waits for health, manages volumes, and invokes native dump/restore tools. |
| `electron/services/DatabaseConnectionService.ts` | Uses `mysql2` for MySQL/MariaDB, `pg` for PostgreSQL, and `mongodb` for MongoDB; normalizes query results for the UI. |
| `electron/database/AppDatabase.ts` | Stores environment metadata in SQLite and encrypts passwords with Electron `safeStorage`. |
| `electron/utils/DatabaseEngines.ts` | Single engine registry for labels, versions, images, ports, internal ports, and usernames. |
| `electron/utils/DatabaseValidation.ts` | Validates names, ports, table names, statuses, and CSV values. |
| `electron/tests/` | Unit tests and disposable Docker integration tests. |
| `frontend/src/App.tsx` | Dashboard, creation dialog, lifecycle actions, connection browser, query console, and backup/export controls. |
| `frontend/src/types/electron.d.ts` | Renderer-side declaration of the preload API. |

## Supported engine contract

| Engine | Image | Host default | Container port | User | Adapter |
| --- | --- | ---: | ---: | --- | --- |
| MySQL | `mysql:8.4` | `3307` | `3306` | `root` | `mysql2` |
| PostgreSQL | `postgres:17` | `5433` | `5432` | `postgres` | `pg` |
| MariaDB | `mariadb:11.4` | `3308` | `3306` | `root` | `mysql2` |
| MongoDB | `mongo:8.0` | `27017` | `27017` | `root` | `mongodb` |

Engine behavior is centralized in `electron/utils/DatabaseEngines.ts`. When adding an engine or changing a version, update that registry, the `DatabaseEngine` union in both type locations, the manager lifecycle switch, the connection adapter, the renderer selection/labels, and the integration matrix together. MySQL and MariaDB share SQL quoting, `SHOW` metadata queries, and MySQL-compatible clients, but MariaDB uses `mariadb-admin`, `mariadb-dump`, and `mariadb` inside its container.

## Runtime and data flow

1. The renderer sends a request through `window.databaseAPI`.
2. The preload bridge forwards only the named IPC operation.
3. `DatabaseService` validates the payload, checks Docker/ports, and reads or writes application metadata.
4. `DatabaseManager` selects the engine-specific Docker implementation.
5. `DockerManager` creates a named container and named volume, waits for a healthy/running state, and returns normalized status.
6. Credentials are encrypted before they are stored in the application SQLite database. The password is not part of `StoredDatabase` records.
7. Connections, SQL, CSV export, backup, and restore run in the Electron main process. The renderer receives normalized data only.

PostgreSQL uses the `public` schema for table browsing. MySQL and MariaDB use the selected database's default schema. MongoDB exposes collections as tables in the explorer. Its query console accepts JSON such as `{"collection":"users","operation":"find","filter":{}}`; supported operations are `find`, `countDocuments`, `insertOne`, `updateMany`, and `deleteMany`.

## Data and destructive actions

- Each environment uses a named Docker volume so data survives normal container stops and container-only removal.
- **Remove container** removes the container but intentionally retains the volume for later recreation.
- **Delete permanently** removes the container, volume, and stored application metadata. Use it only when the data is no longer needed.
- Backups and restores use native save/open dialogs and the selected engine's native tools; test them with disposable development data first.
- All database environments are local to the machine; the application is not a hosted database service.

## Verification

The current build has been checked with:

- TypeScript/Electron build.
- Vite production frontend build.
- Frontend ESLint.
- Seven automated Electron-side unit tests covering engine compatibility, input validation, Docker status normalization, and CSV escaping.
- Disposable Docker integration tests for MySQL, PostgreSQL, and MariaDB covering readiness, stop/start, container recreation, direct connections, table inspection, CSV export, backup/restore, and volume data persistence (`npm.cmd run test:docker`).
- Exact `npm.cmd start` Electron startup and renderer-load verification.
- Actual rendered form smoke test covering all four create fields: environment name, database name, port, and root password.
- Docker lifecycle smoke test covering MySQL readiness, stop/start/restart, backup/restore, and retained-volume container recreation.
- Windows installer packaging with electron-builder.

The Docker integration suite creates disposable `ldb-test-*` containers and volumes and removes them in a `finally` cleanup block. If a test is interrupted, check for leftovers with `docker ps -a --filter name=ldb-test-` and `docker volume ls --filter name=ldb-test-` before continuing.

Before a release, manually verify the complete acceptance flow with Docker Desktop running:

1. Type into every create form field and confirm each value remains visible.
2. Create an environment and wait for **Running**.
3. Stop, start, and restart the environment.
4. Connect, run `SELECT 1 AS ok;`, inspect a table, and export CSV.
5. Back up data, change it, restore the backup, and verify the result.
6. Remove the container, start it again, and verify that the data remains.
7. Delete the disposable test environment permanently and confirm its Docker volume is gone.

## Roadmap

- Multiple engine versions and reusable environment templates.
- Improved activity history and resource usage visibility.
- Environment details view with connection information and logs.
- Search, filtering, and richer table management workflows.
- Automated release checks and cross-platform packaging.

The next implementation should be selected from the roadmap only after checking the current engine registry and integration suite. The highest-value follow-up is version/template support: make engine definitions configurable without duplicating Docker and renderer branches. Keep the current three-engine behavior as regression coverage while introducing that abstraction.

## Session handoff

The current build supports MySQL 8.4, PostgreSQL 17, and MariaDB 11.4 end to end. Before beginning another feature, run `git status --short`, `npm.cmd test`, `npm.cmd run build`, and `npm.cmd --prefix frontend run lint`. If Docker behavior is involved, also run `npm.cmd run test:docker`. Do not assume the installer is current unless `npm.cmd run package` has been run after the latest source changes.

For phased work, finish one phase before editing the next: define the contract, implement the Electron/backend path, expose the renderer behavior, run the relevant unit/build/lint/integration gates, update both README files, and commit the completed phase. Preserve the preload boundary and keep destructive Docker operations explicit in the UI.

## Contributing

1. Create a feature branch.
2. Keep Docker and database operations in the Electron main process.
3. Preserve the explicit preload/API boundary.
4. Run the build and frontend lint before opening a pull request.
5. Include manual Docker lifecycle steps when changing environment behavior.

## License

No license has been declared yet. Until one is added, the repository should be treated as source-available rather than automatically open source.
