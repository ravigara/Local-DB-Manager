# Local DB Manager

A desktop application for managing local database environments through a simple dashboard, inspired by the developer experience of Docker Desktop.

The primary goal is to make local database development easier by allowing developers to create, configure, start, stop, restart, inspect, and connect to local database servers without manually managing system services, ports, configuration files, or command-line processes.

The project currently focuses on **MySQL** first. The architecture should be designed so PostgreSQL, MariaDB, SQLite-related workflows, and other database engines can be added later without rewriting the application.

---

## 1. Project Status

This repository is an **active MVP / early-stage implementation**.

The application already has a working Electron-based desktop shell and a database-management layer. The MySQL creation flow has been implemented and tested during development.

Important current implementation detail:

- The Electron main process contains/uses a `databaseManager`.
- The MySQL creation path currently uses:
  `databaseManager.createMySQL(...)`
- The application is intended to manage local database instances rather than connect only to externally hosted databases.
- The UI is a dashboard-style interface.
- The current MVP provisions MySQL through Docker Desktop using the `mysql:8.4` image.
- Docker health checks are used so create/start/restart complete only after MySQL reports ready.
- Docker Desktop must be running for database lifecycle operations.
- The project is being developed incrementally, so **do not assume that every item described in the target architecture already exists**.

When modifying the project, inspect the actual repository first and treat the existing code as the source of truth for what is currently implemented.

---

# 2. Product Vision

The application should provide a Docker-like experience for local databases.

Instead of requiring a developer to:

1. install a database server,
2. configure the server,
3. create a data directory,
4. initialize the database,
5. configure a port,
6. start the server,
7. remember credentials,
8. manually connect using a client,

the application should eventually allow the developer to:

1. Open Local DB Manager.
2. Create a database instance.
3. Select the database engine and version.
4. Configure its name, port, username, password, and storage location.
5. Start it.
6. See its status in the dashboard.
7. Connect to it.
8. Open/manage its databases and tables.
9. Stop/restart/delete the instance when required.

The product should feel like:

> "Docker Desktop, but focused specifically on local database development."

---

# 3. Primary Goals

## MVP goals

The MVP should provide:

- Desktop application.
- Local database instance management.
- MySQL support.
- Create MySQL instance.
- Store instance configuration.
- Initialize MySQL data directory.
- Start MySQL server.
- Stop MySQL server.
- Restart MySQL server.
- Detect whether an instance is running.
- Display instance status.
- Display port and connection information.
- Connect to a running database.
- Basic database inspection.
- Basic error reporting.
- Persistent local configuration.
- Safe process management.

## Later goals

After the MySQL MVP is stable:

- PostgreSQL support.
- MariaDB support.
- Multiple versions of each database engine.
- Database/table browser.
- SQL query editor.
- Query result grid.
- Create/delete databases.
- Create/delete tables.
- Basic table CRUD.
- Import/export.
- Backup/restore.
- Logs.
- Health checks.
- Resource usage.
- Port conflict detection.
- Automatic port assignment.
- Database instance templates.
- Environment variables.
- Connection profiles.
- Search/filtering.
- Notifications.
- Update/version management.

---

# 4. Non-Goals

Do not turn this application into a full production database administration platform.

The main use case is:

**local development databases.**

Do not unnecessarily introduce:

- Cloud database hosting.
- Remote server orchestration.
- Kubernetes.
- Complex enterprise authentication.
- Multi-user server management.
- Distributed database orchestration.
- Heavy infrastructure management.

Remote database connections may eventually be supported as a separate feature, but they should not complicate the local database lifecycle architecture.

---

# 5. Core User Workflow

## Create database

Expected flow:

```text
Dashboard
   |
   v
Create Database
   |
   v
Select Engine
   |
   +---- MySQL
   |
   v
Configure Instance
   |
   +---- Name
   +---- Version
   +---- Port
   +---- Username
   +---- Password
   +---- Data directory
   |
   v
Validate configuration
   |
   v
Initialize database
   |
   v
Persist instance metadata
   |
   v
Show instance on dashboard
```

## Start database

```text
Dashboard
   |
   v
Start
   |
   v
Validate instance
   |
   v
Validate executable
   |
   v
Validate data directory
   |
   v
Validate port
   |
   v
Spawn database process
   |
   v
Wait for readiness
   |
   v
Health check
   |
   v
RUNNING
```

The important point is:

**Starting a process successfully does not automatically mean the database is ready.**

The application should eventually distinguish:

- `STARTING`
- `RUNNING`
- `STOPPING`
- `STOPPED`
- `ERROR`

rather than relying only on whether a child process exists.

---

# 6. High-Level Architecture

The intended architecture is:

```text
+------------------------------------------------------+
|                    Electron App                      |
+------------------------------------------------------+
|                                                      |
|  Renderer / UI                                       |
|       |                                              |
|       | IPC                                           |
|       v                                              |
|  Electron Main Process                               |
|       |                                              |
|       +-----------------------+                      |
|       |                       |                      |
|       v                       v                      |
|  Database Manager         Persistence Manager       |
|       |                       |                      |
|       v                       v                      |
|  Engine Adapters          Local Metadata             |
|       |                                              |
|       +-----------------------+                      |
|                               |                      |
|                               v                      |
|                       MySQL Process                  |
|                               |                      |
|                               v                      |
|                         Local Storage                |
|                                                      |
+------------------------------------------------------+
```

---

# 7. Architectural Layers

## 7.1 Renderer / Frontend

Responsible for:

- Dashboard.
- Database cards.
- Create database UI.
- Configuration forms.
- Status display.
- Buttons/actions.
- Connection UI.
- Logs/status messages.
- Error presentation.

The renderer must **not** directly:

- spawn processes,
- execute shell commands,
- access arbitrary filesystem paths,
- manage database processes,
- contain secrets unnecessarily.

All privileged operations should go through a controlled IPC API.

---

## 7.2 Preload / IPC Boundary

The preload layer should expose a small, explicit API to the renderer.

Conceptually:

```ts
window.databaseManager.create(...)
window.databaseManager.start(...)
window.databaseManager.stop(...)
window.databaseManager.restart(...)
window.databaseManager.remove(...)
window.databaseManager.getAll(...)
window.databaseManager.getStatus(...)
```

The exact API should follow the existing repository implementation.

Do not expose unrestricted Node.js APIs to the renderer.

Avoid:

```ts
contextIsolation: false
```

or exposing:

```ts
window.require
```

unless there is an extremely specific reason and it is documented.

---

## 7.3 Electron Main Process

The main process owns privileged operations.

Responsibilities include:

- Database lifecycle.
- Child process management.
- Filesystem operations.
- Executable discovery.
- Configuration generation.
- Port checks.
- Database initialization.
- Persistence.
- Logging.
- IPC handlers.

The main process should be the authoritative owner of database instance state.

---

# 8. Database Manager

`databaseManager` is the central orchestration layer.

It should eventually provide a clean API similar to:

```ts
interface DatabaseManager {
  createMySQL(config: MySQLConfig): Promise<DatabaseInstance>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<DatabaseInstance | null>;
  getAll(): Promise<DatabaseInstance[]>;
  getStatus(id: string): Promise<DatabaseStatus>;
}
```

The exact signatures should match the current codebase rather than blindly replacing existing APIs.

---

# 9. Database Engine Abstraction

The application should not hard-code MySQL logic into the entire application.

Use an engine abstraction.

Conceptually:

```ts
interface DatabaseEngine {
  initialize(config: DatabaseConfig): Promise<void>;
  start(instance: DatabaseInstance): Promise<void>;
  stop(instance: DatabaseInstance): Promise<void>;
  restart(instance: DatabaseInstance): Promise<void>;
  isRunning(instance: DatabaseInstance): Promise<boolean>;
  isReady(instance: DatabaseInstance): Promise<boolean>;
  getVersion(instance: DatabaseInstance): Promise<string>;
}
```

Then:

```text
DatabaseEngine
     |
     +---- MySQLEngine
     |
     +---- PostgreSQLEngine   (future)
     |
     +---- MariaDBEngine      (future)
```

This is important because MySQL and PostgreSQL have different:

- initialization commands,
- server executables,
- configuration formats,
- readiness checks,
- shutdown mechanisms,
- data directory structures.

Do not create a fake generic implementation that hides important engine-specific differences.

---

# 10. MySQL Implementation

MySQL is the first supported engine.

The MySQL adapter should eventually own:

- Finding MySQL binaries.
- Validating the MySQL installation.
- Initializing a data directory.
- Creating the initial database system.
- Generating configuration.
- Starting `mysqld`.
- Stopping `mysqld`.
- Detecting readiness.
- Connecting for health checks.
- Reading server version.
- Handling process termination.
- Capturing stdout/stderr.
- Reporting startup errors.

The exact commands vary depending on the MySQL distribution and version.

Do not hard-code assumptions without checking the installed MySQL version/distribution.

---

# 11. MySQL Instance Model

A database instance should conceptually look like:

```ts
interface DatabaseInstance {
  id: string;
  name: string;
  engine: "mysql";
  version: string;

  host: string;
  port: number;

  username: string;

  dataDirectory: string;

  status:
    | "STOPPED"
    | "STARTING"
    | "RUNNING"
    | "STOPPING"
    | "ERROR";

  pid?: number;

  createdAt: string;
  updatedAt: string;
}
```

Do not store plaintext passwords in ordinary UI state or logs.

If credentials must be persisted, design a secure credential-storage mechanism instead of writing passwords into a normal JSON metadata file.

---

# 12. Persistence

The application needs persistent metadata so instances remain visible after restarting the application.

Example conceptual structure:

```text
app-data/
    databases/
        <instance-id>/
            metadata.json
            config/
            logs/
            data/
```

The actual storage location should use Electron's application-data APIs rather than hard-coded project-relative paths.

For example, conceptually:

```ts
app.getPath("userData")
```

should be preferred for application-managed persistent data.

Do not place runtime database data inside the source repository.

---

# 13. Runtime Data vs Metadata

Keep these separate.

## Metadata

Contains:

- instance ID
- display name
- engine
- version
- port
- host
- username
- paths
- timestamps
- status information

## Runtime data

Contains:

- actual MySQL data files
- generated configuration
- logs
- PID/runtime information

Never assume that deleting metadata should automatically delete actual database data without an explicit destructive confirmation.

---

# 14. Process Management

Database processes are one of the most important parts of the application.

Use Node's process APIs from the Electron main process.

Conceptually:

```ts
spawn(...)
```

rather than constructing unsafe shell strings.

Avoid:

```ts
exec(`mysqld --port=${userInput}`)
```

because user-controlled input can become command injection.

Prefer structured arguments:

```ts
spawn(executablePath, [
  "--port",
  String(port),
  "--datadir",
  dataDirectory,
]);
```

Validate all user-controlled values before passing them to processes.

---

# 15. Process Lifecycle

A robust lifecycle should be:

```text
STOPPED
   |
   | start()
   v
STARTING
   |
   +---- startup failure ----> ERROR
   |
   v
RUNNING
   |
   | stop()
   v
STOPPING
   |
   v
STOPPED
```

If a process unexpectedly exits:

```text
RUNNING
   |
   | process exit
   v
ERROR / STOPPED
```

The exact choice should be consistent across the application.

Do not leave stale `RUNNING` state after a process dies.

---

# 16. Readiness Detection

Do not consider this sufficient:

```ts
childProcess.pid !== undefined
```

Instead:

1. Start process.
2. Capture output.
3. Poll readiness.
4. Attempt a lightweight MySQL connection or equivalent health check.
5. Mark instance `RUNNING` only after successful readiness.
6. Timeout after a reasonable period.
7. Capture useful logs on failure.

Example:

```text
STARTING
   |
   +-- process exists
   |
   +-- wait
   |
   +-- health check
   |
   +-- success -> RUNNING
   |
   +-- timeout -> ERROR
```

---

# 17. Port Management

The application should validate ports before starting a database.

Requirements:

- Port must be numeric.
- Port must be in a valid TCP range.
- Port must not already be occupied.
- Two managed instances should not use the same port.

Eventually support:

```text
Auto-select available port
```

but do not silently change a user-selected port without informing the user.

---

# 18. Error Handling

Errors should be categorized.

Examples:

```text
MYSQL_NOT_FOUND
MYSQL_INITIALIZATION_FAILED
MYSQL_START_FAILED
MYSQL_STOP_FAILED
MYSQL_ALREADY_RUNNING
MYSQL_NOT_RUNNING
PORT_IN_USE
INVALID_CONFIGURATION
DATA_DIRECTORY_INVALID
PERMISSION_DENIED
CONNECTION_FAILED
HEALTH_CHECK_TIMEOUT
UNKNOWN_ERROR
```

The renderer should receive safe, structured errors.

Do not send raw internal stack traces to normal users unless useful for a developer/debug mode.

---

# 19. Logging

Each database instance should have logs.

Conceptually:

```text
logs/
    stdout.log
    stderr.log
```

The application should capture:

- startup output
- shutdown output
- crashes
- initialization failures

Logs are especially important because database startup failures can otherwise be difficult to diagnose.

The UI should eventually provide:

```text
View Logs
```

for an instance.

---

# 20. Dashboard

The dashboard is the main screen.

Each database should be represented by a card/row.

Conceptual information:

```text
+------------------------------------------------+
| My Local MySQL                                 |
| MySQL 8.x                                      |
|                                                |
| Status: RUNNING                                |
| Host: localhost                                |
| Port: 3306                                     |
|                                                |
| [Open] [Restart] [Stop] [More]                 |
+------------------------------------------------+
```

For stopped instances:

```text
Status: STOPPED

[Start] [Edit] [Delete]
```

For starting:

```text
Status: STARTING

[Cancel]
```

The UI should not show contradictory actions.

For example, do not show:

```text
RUNNING
[Start]
```

if starting the same instance again is invalid.

---

# 21. UI State Management

The frontend should derive UI from database state.

Avoid maintaining multiple independent booleans such as:

```ts
isRunning
isStarting
isStopping
hasError
```

because contradictory states can occur.

Prefer one explicit state:

```ts
status: "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "ERROR"
```

This makes rendering and transitions easier to reason about.

---

# 22. IPC Design

IPC should be explicit and typed.

Conceptual channels:

```text
database:list
database:get
database:create
database:start
database:stop
database:restart
database:remove
database:status
database:logs
```

The exact channel names should follow the current implementation if already established.

Validate IPC arguments in the main process.

Never trust renderer input simply because it originated from the application's own UI.

---

# 23. Security Rules

Electron security is important.

Maintain:

```text
contextIsolation: true
nodeIntegration: false
```

where compatible with the current architecture.

Expose only the APIs required by the renderer.

Never expose:

- unrestricted filesystem APIs
- unrestricted shell execution
- arbitrary process spawning
- raw Node.js modules

to the renderer.

Passwords and connection credentials must not be printed into logs.

Avoid logging full connection strings when they contain credentials.

Bad:

```text
mysql://root:password123@localhost:3306/db
```

Good:

```text
mysql://root@localhost:3306/db
```

---

# 24. Connection Layer

The application will eventually need a database connection service.

Conceptually:

```ts
interface DatabaseConnection {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  ping(): Promise<boolean>;
}
```

The connection layer should be separate from process management.

Important distinction:

```text
Process Manager
    =
"Is the MySQL server running?"

Connection Manager
    =
"Can I connect to MySQL and execute queries?"
```

These should not be mixed into one giant class.

---

# 25. SQL Query Execution

Future query execution should use parameterized queries whenever user values are involved.

Avoid constructing queries like:

```ts
`SELECT * FROM users WHERE id = ${id}`
```

Prefer:

```ts
connection.query(
  "SELECT * FROM users WHERE id = ?",
  [id]
);
```

The SQL editor itself may intentionally execute raw SQL, but application-generated SQL should still be parameterized.

---

# 26. Future Database Explorer

Eventually the UI should support:

```text
Instance
 |
 +-- Databases
 |    |
 |    +-- app_db
 |         |
 |         +-- Tables
 |              |
 |              +-- users
 |              +-- products
 |              +-- orders
 |
 +-- Query
 +-- Logs
 +-- Settings
```

Clicking a table should show:

- columns
- types
- indexes
- constraints
- rows

---

# 27. Query Editor

Future query editor requirements:

- SQL syntax highlighting.
- Run query.
- Cancel query where supported.
- Query execution time.
- Result rows.
- Error messages.
- Multiple result sets where supported.
- Basic history.
- Saved queries eventually.

Do not build a sophisticated SQL IDE before the database lifecycle is stable.

---

# 28. Import / Export

Eventually support:

```text
Import SQL
Export SQL
Import CSV
Export CSV
Backup database
Restore database
```

These features should be implemented after stable lifecycle and connection management.

---

# 29. Backup / Restore

Backup operations are destructive/important operations and should have:

- progress indication
- destination selection
- validation
- error handling
- overwrite confirmation
- clear success/failure state

Do not silently overwrite an existing backup.

---

# 30. Version Management

Database versions are important.

Do not assume:

```text
mysql = one executable
```

The application should eventually support version-aware installations.

Conceptually:

```text
MySQL
 |
 +-- 8.0
 +-- 8.4
 +-- future versions
```

The architecture should make version-specific behavior possible without duplicating the whole application.

---

# 31. Executable Discovery

The application needs a reliable strategy for finding database executables.

Possible sources:

1. Application-managed binaries.
2. User-configured installation path.
3. Known installation locations.
4. PATH lookup.
5. Future downloadable runtime.

The implementation should identify which strategy the current code uses before modifying it.

Do not hard-code one Windows path as the universal solution.

The application should eventually support Windows first while keeping platform-specific logic isolated.

---

# 32. Platform Architecture

The project should avoid spreading operating-system checks everywhere.

Prefer:

```text
platform/
    windows/
    macos/
    linux/
```

or a small abstraction:

```ts
interface PlatformService {
  findExecutable(...): Promise<string>;
  killProcess(...): Promise<void>;
  isPortAvailable(...): Promise<boolean>;
}
```

The exact organization should match the current project structure.

---

# 33. Windows Considerations

The current development environment is Windows-oriented.

Pay attention to:

- `.exe` executable paths.
- Windows process termination.
- Windows filesystem permissions.
- PATH handling.
- quoting paths containing spaces.
- service/process differences.
- port ownership.
- filesystem locking.

Do not assume Unix shell commands such as:

```bash
kill
which
chmod
```

are available.

Use cross-platform Node APIs where possible.

---

# 34. Recommended Project Structure

The final architecture should move toward something conceptually similar to:

```text
project-root/
│
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   │
│   ├── ipc/
│   │   ├── database.ipc.ts
│   │   └── ...
│   │
│   ├── database/
│   │   ├── database-manager.ts
│   │   ├── database-engine.ts
│   │   ├── mysql/
│   │   │   ├── mysql-engine.ts
│   │   │   ├── mysql-process.ts
│   │   │   ├── mysql-config.ts
│   │   │   └── mysql-health.ts
│   │   └── ...
│   │
│   ├── persistence/
│   │   ├── database-store.ts
│   │   └── ...
│   │
│   ├── services/
│   │   ├── port-service.ts
│   │   ├── logging-service.ts
│   │   └── ...
│   │
│   └── types/
│       └── database.ts
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   └── ...
│
├── package.json
├── tsconfig.json
├── README.md
└── ...
```

This is a target architecture, not a command to restructure everything immediately.

If the existing repository uses a different but clean organization, preserve it.

---

# 35. Development Principle

Do not rewrite working code simply to make it look architecturally different.

Use this order:

```text
Understand current code
        |
        v
Identify actual problem
        |
        v
Make smallest safe change
        |
        v
Run TypeScript/build
        |
        v
Run application
        |
        v
Test affected workflow
        |
        v
Continue
```

Avoid large speculative refactors.

---

# 36. Current Development Context

Previous development uncovered TypeScript integration issues around `databaseManager`.

One known issue was:

```text
electron/main.ts:33:12
error TS2304: Cannot find name 'databaseManager'.
```

That issue was addressed during development and the manager was subsequently created/recognized.

When working on the repository:

- Do not reintroduce duplicate `databaseManager` declarations.
- Check imports before adding new instances.
- Keep one authoritative database manager.
- Verify the TypeScript compiler after changes.

---

# 37. Testing Strategy

At minimum, test each database lifecycle transition.

## Create

```text
Create instance
  -> metadata exists
  -> data directory exists
  -> dashboard shows instance
```

## Start

```text
Start
  -> status STARTING
  -> process launches
  -> server becomes ready
  -> status RUNNING
```

## Stop

```text
Stop
  -> status STOPPING
  -> process terminates
  -> status STOPPED
```

## Restart

```text
Restart
  -> STOPPING
  -> STOPPED
  -> STARTING
  -> RUNNING
```

## Failure

Test:

- invalid executable
- invalid data directory
- occupied port
- invalid credentials
- database startup failure
- unexpected process termination
- duplicate start
- duplicate stop
- missing instance
- deleted data directory

---

# 38. TypeScript Quality

The codebase should remain strongly typed.

Avoid unnecessary:

```ts
any
```

Prefer explicit interfaces/types.

For example:

```ts
type DatabaseStatus =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "ERROR";
```

and:

```ts
interface MySQLConfig {
  name: string;
  version: string;
  port: number;
  username: string;
  dataDirectory: string;
}
```

Keep shared types in a location accessible to both main and renderer when appropriate.

---

# 39. Error Handling Pattern

Prefer errors with useful machine-readable information.

Conceptually:

```ts
class DatabaseError extends Error {
  constructor(
    public code: DatabaseErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
```

The renderer can then map:

```text
PORT_IN_USE
```

to:

```text
Port 3306 is already being used by another process.
```

rather than displaying an opaque exception.

---

# 40. UX Rules

The application should be predictable.

## Never

- silently delete database data
- silently change ports
- show RUNNING when the server is not ready
- hide startup errors
- expose passwords
- freeze the UI during database startup
- allow multiple simultaneous start operations
- make destructive operations one-click without confirmation

## Prefer

- clear status
- loading states
- disabled invalid actions
- useful error messages
- confirmation for destructive actions
- logs for technical failures
- non-blocking UI

---

# 41. State Synchronization

The renderer should not assume its previous state is still correct.

Example:

```text
Renderer says RUNNING
        |
        v
User closes application
        |
        v
MySQL process dies
```

On next launch the application should inspect the actual process/server state rather than trusting stale UI state.

Persistence should store configuration, not blindly trust previous runtime status.

---

# 42. Startup Recovery

On application launch:

```text
Load instance metadata
        |
        v
For each instance
        |
        v
Check actual process/server state
        |
        +---- running -> RUNNING
        |
        +---- not running -> STOPPED
```

Do not automatically restart every database unless the user explicitly enables an auto-start feature.

---

# 43. Auto Start

A future feature may allow:

```text
Auto-start database when Local DB Manager opens
```

This should be optional per instance.

Example:

```ts
autoStart: boolean;
```

Do not implement this until normal start/stop lifecycle behavior is reliable.

---

# 44. Configuration Validation

Validate before doing filesystem/process operations.

Example:

```text
Name
  -> non-empty

Port
  -> integer
  -> valid TCP range
  -> available

Username
  -> valid

Data directory
  -> valid path
  -> permissions available

Engine version
  -> supported
```

Do not wait until the process starts to discover obvious configuration errors.

---

# 45. Secrets

Passwords should receive special treatment.

Preferred future options:

- OS credential manager/keychain.
- Electron-safe credential storage.
- Encrypted local storage.

Do not commit secrets.

Do not put real credentials into:

- Git
- README
- source code
- test fixtures
- screenshots
- logs

Use placeholders in documentation.

---

# 46. Git Rules

Never commit:

```text
database data directories
*.ibd
*.frm
*.MYD
*.MYI
runtime logs
local credentials
.env files containing secrets
local executable installations
```

The `.gitignore` should protect the repository from accidentally tracking database runtime files.

---

# 47. Environment Variables

If environment variables are used, document them.

Example:

```text
MYSQL_BIN_PATH=
```

But do not require environment variables for normal users if the application can discover/configure the required paths.

---

# 48. Current MVP Priority

When Codex is asked to continue development, use this priority order:

## Priority 1 — Stability

- Fix TypeScript errors.
- Fix runtime crashes.
- Ensure IPC works.
- Ensure database manager lifecycle works.

## Priority 2 — MySQL lifecycle

- Create
- Initialize
- Start
- Readiness detection
- Stop
- Restart
- Status

## Priority 3 — Persistence

- Save instances.
- Load instances.
- Recover status on application restart.

## Priority 4 — Dashboard

- Clear cards.
- Correct status.
- Correct action buttons.
- Loading/error states.

## Priority 5 — Connection

- Connect to running MySQL.
- Show connection information.
- Basic ping/query.

## Priority 6 — Database explorer

- List databases.
- List tables.
- View rows.

## Priority 7 — Query editor

- SQL editor.
- Execute query.
- Result grid.
- Errors.

Only after these are stable should major additional engines or advanced features be introduced.

---

# 49. What Codex Should Do Before Changing Code

When Codex starts working on this repository, it should first:

1. Read this README.
2. Inspect `package.json`.
3. Inspect the Electron entry point.
4. Inspect the preload/IPC layer.
5. Locate `databaseManager`.
6. Locate the MySQL implementation.
7. Inspect the renderer structure.
8. Run the existing type-check/build commands.
9. Identify the current working state.
10. Avoid assuming the target architecture has already been implemented.
11. Make a short implementation plan before large changes.
12. Modify only the necessary files.
13. Run type-check/build after changes.
14. Test the affected user flow.

---

# 50. Important Codex Instruction

**Do not start by rewriting the application.**

This README describes the intended product architecture and development direction.

The actual repository is the source of truth.

If the repository differs from this README:

1. Determine whether the difference is intentional.
2. Preserve working code.
3. Prefer incremental changes.
4. Update the README when the architecture materially changes.

---

# 51. Definition of Done

A feature is not considered complete merely because the code compiles.

For a database lifecycle feature, "done" means:

```text
Code implemented
    +
TypeScript passes
    +
Application starts
    +
UI action works
    +
Main-process operation works
    +
Actual MySQL state changes correctly
    +
UI reflects actual state
    +
Errors are handled
    +
Relevant logs exist
    +
Existing features still work
```

---

# 52. Suggested Development Commands

Do not invent commands if the repository already defines scripts.

First inspect:

```text
package.json
```

Then use the project's existing scripts.

Typical commands may be:

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

Only use commands that actually exist in `package.json`.

The current repository commands are:

```bash
npm run build
npm run start
npm run dev:frontend
npm run dev:electron
```

For development, run `npm run dev:frontend` and `npm run dev:electron` in separate terminals.

---

# 53. Future Architecture

The long-term architecture should look approximately like:

```text
                         Local DB Manager
                                |
              +-----------------+-----------------+
              |                                   |
          Dashboard                          Settings
              |
       +------+------+
       |             |
   Instance       Instance
       |             |
    MySQL 8.4     MySQL 8.0
       |
       v
+----------------------+
| Database Lifecycle   |
+----------------------+
| Create               |
| Initialize           |
| Start                |
| Stop                 |
| Restart              |
| Health               |
| Logs                 |
+----------------------+
           |
           v
+----------------------+
| Engine Adapter       |
+----------------------+
| MySQL                |
| PostgreSQL (future)  |
| MariaDB (future)     |
+----------------------+
           |
           v
+----------------------+
| Local Processes      |
+----------------------+
           |
           v
+----------------------+
| Local Database Data  |
+----------------------+
```

---

# 54. Product Philosophy

The application should optimize for:

### Simplicity

A developer should not need to understand every database installation detail just to run a local database.

### Transparency

The application should make it clear:

- where the database is stored
- which port it uses
- which version is running
- whether it is actually ready
- why it failed

### Safety

Database data is valuable. Destructive actions should be deliberate.

### Extensibility

MySQL is the first engine, not the final engine.

### Developer Experience

The application should reduce repetitive setup work without hiding important technical information.

---

# 55. Immediate Continuation Point

When continuing the project, first inspect the existing implementation and determine:

```text
1. Current databaseManager implementation
2. Current MySQL creation flow
3. Current start/stop implementation
4. Current IPC API
5. Current dashboard state model
6. Current persistence mechanism
7. Current MySQL executable discovery
8. Current error handling
9. Current TypeScript/build status
```

Then implement the next missing lifecycle capability rather than creating unrelated features.

The most important milestone is:

```text
Create MySQL instance
        ↓
Persist it
        ↓
Start it
        ↓
Wait until actually ready
        ↓
Show RUNNING
        ↓
Connect successfully
        ↓
Stop it
        ↓
Show STOPPED
```

Once this complete lifecycle is reliable, build the database explorer and query functionality on top of it.

---

# 56. Final Instruction to Codex

Treat this repository as a real software project, not a demo.

Before every significant change:

- inspect existing code
- understand dependencies
- preserve working behavior
- avoid unnecessary rewrites
- use strong TypeScript types
- keep privileged operations in the Electron main process
- keep IPC explicit
- validate inputs
- handle process failures
- never expose secrets
- test the actual database lifecycle
- update documentation when behavior changes

The target outcome is a polished local database environment manager that provides the convenience of Docker Desktop for local database development while remaining lightweight, transparent, and developer-friendly.

**Current primary engine: MySQL.**

**Current primary platform: Windows, with cross-platform architecture as a future goal.**

**Primary next milestone: reliable end-to-end MySQL instance lifecycle management.**
