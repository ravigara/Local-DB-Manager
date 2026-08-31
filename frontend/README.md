# Local DB Manager renderer

This directory contains the React + TypeScript + Vite renderer for Local DB Manager. It is the user-facing dashboard hosted by the Electron main process. The renderer is not a general web application: it must remain compatible with the preload boundary and must not access Node.js, Docker, the filesystem, or database drivers directly.

## Responsibilities

`src/App.tsx` owns the current dashboard workflow:

- show saved environments and normalized lifecycle status;
- create MySQL 8.4, PostgreSQL 17, and MariaDB 11.4 environments;
- start, stop, restart, remove, and permanently delete environments;
- connect and browse databases/tables;
- inspect table columns and sample rows;
- execute SQL and display normalized results;
- export CSV and invoke database backup/restore dialogs.

The renderer calls the typed surface declared in `src/types/electron.d.ts` as `window.databaseAPI`. The implementation of that surface lives in `../electron/preload.ts`; the corresponding IPC handlers live in `../electron/main.ts` and are fulfilled by the Electron services.

## Engine-aware UI rules

The supported engine contract is currently:

| Engine | Display version | Default host port | Notes |
| --- | --- | ---: | --- |
| MySQL | 8.4 | 3307 | Uses the MySQL-compatible adapter and default schema. |
| PostgreSQL | 17 | 5433 | Uses the PostgreSQL adapter and the `public` schema. |
| MariaDB | 11.4 | 3308 | Uses the MySQL-compatible adapter and default schema. |

If an engine is added, update both the backend registry and the renderer's `DatabaseEngine` type, selection options, labels, and default-port behavior. Existing saved records must remain renderable. Do not infer the engine from the port; use the stored `engine` field.

## Development commands

Run these commands from the repository root:

```powershell
# Build the renderer only
npm.cmd --prefix frontend run build

# Run renderer lint
npm.cmd --prefix frontend run lint

# Start Vite for renderer development
npm.cmd run dev:frontend

# Run Electron against the Vite development server
npm.cmd run dev:electron
```

`dev:electron` expects the Vite server at `http://localhost:5173` through `LOCAL_DB_MANAGER_DEV_URL`. The normal `npm.cmd start` path builds both projects and serves `frontend/dist` through Electron's loopback server.

For a complete repository gate, use the root commands instead:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd --prefix frontend run lint
npm.cmd run test:docker
npm.cmd run package
```

The Docker suite requires Docker Desktop and uses disposable containers for all three engines. The root test command currently runs the Electron-side unit tests; there is no separate Jest/Vitest renderer test suite yet. Renderer correctness is currently checked by TypeScript/Vite build, ESLint, and manual or smoke verification of the creation form and dashboard actions.

## Renderer implementation notes

- Keep API calls in `App.tsx` or extracted UI hooks/components; never import `electron`, `fs`, `child_process`, `mysql2`, or `pg` here.
- Treat every value from the bridge as untrusted and display errors through the existing UI error paths.
- Keep loading/action state scoped to the affected environment where possible so one database card does not block unrelated cards.
- Use `engineLabel` and `defaultPortForEngine` for engine-specific display behavior instead of repeating string comparisons throughout the JSX.
- Keep destructive actions visibly distinct and preserve the distinction between removing a container (retains the volume) and permanently deleting an environment (removes the volume and metadata).
- When adding UI behavior, update the corresponding type declaration in `src/types/electron.d.ts` and the actual preload exposure together.

## Files

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Main dashboard and interaction state. |
| `src/App.css` | Dashboard/dialog component styles. |
| `src/index.css` | Global typography, colors, and layout defaults. |
| `src/types/database.ts` | Renderer-side data contracts and engine union. |
| `src/types/electron.d.ts` | TypeScript declaration for `window.databaseAPI`. |
| `src/main.tsx` | React entry point. |
| `dist/` | Generated Vite output; do not edit manually. |

## Next-session handoff

The backend currently supports the three engine options listed above and the renderer exposes all three. The next planned direction is multiple engine versions and reusable environment templates. Start by inspecting `electron/utils/DatabaseEngines.ts`, `electron/managers/DockerManager.ts`, `electron/services/DatabaseConnectionService.ts`, and this file before changing the creation flow. Preserve the existing integration matrix and run the full root verification commands before committing.
