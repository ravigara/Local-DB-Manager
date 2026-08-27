# Local DB Manager

Local DB Manager is a focused Windows desktop workspace for running and inspecting local MySQL environments through Docker Desktop. It gives developers a fast, visible workflow for creating a database, waiting for it to become ready, connecting to it, and managing its lifecycle without memorizing container commands.

> A lightweight local database utility with the clarity of a desktop developer tool.

## What it does

- Create MySQL 8.4 environments with a named persistent Docker volume.
- Start, stop, restart, inspect, and monitor container status.
- Recreate a removed container while retaining its data volume.
- Connect to a running instance and browse databases and tables.
- Inspect table columns and sample rows.
- Run SQL queries and view structured results.
- Export table data to CSV.
- Back up and restore a database through native file dialogs.
- Remove a container without deleting its volume, or permanently delete an environment and its data.
- Store local environment metadata and encrypted credentials in Electron application storage.

## Current status

The MySQL MVP is implemented end to end. The primary supported platform is Windows, and Docker Desktop must be running for database lifecycle, connection, backup, and restore operations. PostgreSQL, MariaDB, and additional database engines are planned for future iterations.

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
4. Enter an environment name, database name, unused host port, and root password.
5. Select **Create environment** and wait for the status to become **Running**.
6. Select **Connect & inspect** to browse the instance or run SQL.

The database name accepts letters, numbers, and underscores. Host ports must be whole numbers from `1024` through `65535`. The form validates these values inline before asking the Electron process to create the container.

## Development commands

Run these commands from the repository root:

```powershell
# Build Electron and the frontend
npm.cmd run build

# Lint the React renderer
npm.cmd --prefix frontend run lint

# Start the development application using the production frontend build
npm.cmd start

# Build the Windows installer and unpacked application
npm.cmd run package
```

The generated Windows installer is written to `release/Local DB Manager Setup 0.1.0.exe` when packaging completes.

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
        └── MySQL connection, queries, CSV, backup, restore
```

The renderer does not receive Node.js access. Electron keeps `contextIsolation` enabled and `nodeIntegration` disabled, while privileged filesystem, Docker, and database operations remain in the main process.

## Data and destructive actions

- Each environment uses a named Docker volume so data survives normal container stops and container-only removal.
- **Remove container** removes the container but intentionally retains the volume for later recreation.
- **Delete permanently** removes the container, volume, and stored application metadata. Use it only when the data is no longer needed.
- Backups and restores use native save/open dialogs and should be tested with disposable development data first.
- All database environments are local to the machine; the application is not a hosted database service.

## Verification

The current build has been checked with:

- TypeScript/Electron build.
- Vite production frontend build.
- Frontend ESLint.
- Exact `npm.cmd start` Electron startup and renderer-load verification.
- Actual rendered form smoke test covering all four create fields: environment name, database name, port, and root password.
- Docker lifecycle smoke test covering MySQL readiness, stop/start/restart, backup/restore, and retained-volume container recreation.
- Windows installer packaging with electron-builder.

Before a release, manually verify the complete acceptance flow with Docker Desktop running:

1. Type into every create form field and confirm each value remains visible.
2. Create an environment and wait for **Running**.
3. Stop, start, and restart the environment.
4. Connect, run `SELECT 1 AS ok;`, inspect a table, and export CSV.
5. Back up data, change it, restore the backup, and verify the result.
6. Remove the container, start it again, and verify that the data remains.
7. Delete the disposable test environment permanently and confirm its Docker volume is gone.

## Roadmap

- PostgreSQL and MariaDB support.
- Multiple engine versions and reusable environment templates.
- Improved activity history and resource usage visibility.
- Environment details view with connection information and logs.
- Search, filtering, and richer table management workflows.
- Automated release checks and cross-platform packaging.

## Contributing

1. Create a feature branch.
2. Keep Docker and database operations in the Electron main process.
3. Preserve the explicit preload/API boundary.
4. Run the build and frontend lint before opening a pull request.
5. Include manual Docker lifecycle steps when changing environment behavior.

## License

No license has been declared yet. Until one is added, the repository should be treated as source-available rather than automatically open source.
