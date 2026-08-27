import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type {
  Database,
  DatabaseStatus,
  QueryResult,
  TableDetails
} from "./types/database";

import "./App.css";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(status: DatabaseStatus): string {
  return status.replace("-", " ").replace(/^\w/, character => character.toUpperCase());
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type IconName =
  | "activity"
  | "arrow"
  | "backup"
  | "database"
  | "external"
  | "layers"
  | "logs"
  | "menu"
  | "play"
  | "plus"
  | "refresh"
  | "search"
  | "server"
  | "settings"
  | "stop"
  | "trash";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h3l2-7 4 14 2-7h4" />,
    arrow: <path d="m5 12 5 5 9-9" />,
    backup: <><path d="M12 3v10" /><path d="m8 7 4-4 4 4" /><path d="M5 13v6h14v-6" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v6H4V5h6" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
    logs: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 5v5h5" /><path d="M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 19v-5h-5" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    server: <><rect x="4" y="4" width="16" height="6" rx="1" /><rect x="4" y="14" width="16" height="6" rx="1" /><path d="M8 7h.01M8 17h.01" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.3a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.5l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.7 12a2 2 0 1 1 0-4h.2a2 2 0 0 0 1.5-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 9.6.3H10a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 21.7 8h.3a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.5 3.4Z" /></>,
    stop: <path d="M6 6h12v12H6z" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths[name]}
    </svg>
  );
}

function App() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [name, setName] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [port, setPort] = useState("3307");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [inspection, setInspection] = useState<{
    id: string;
    databases: string[];
    tables: string[];
  } | null>(null);
  const [query, setQuery] = useState("SELECT 1 AS ok;");
  const [queryLoadingId, setQueryLoadingId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<{
    id: string;
    result: QueryResult;
  } | null>(null);
  const [tableDetails, setTableDetails] = useState<{
    id: string;
    details: TableDetails;
  } | null>(null);
  const [exportingTable, setExportingTable] = useState<string | null>(null);
  const [fileAction, setFileAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function refreshStatuses() {
      try {
        const storedDatabases = await window.databaseAPI.list();
        const databasesWithStatus = await Promise.all(
          storedDatabases.map(async database => ({
            ...database,
            status: await window.databaseAPI.status(database.id)
          }))
        );

        if (mounted) {
          setDatabases(databasesWithStatus);
        }
      } catch (refreshError) {
        if (mounted) {
          setActionError(
            errorMessage(refreshError, "Failed to refresh databases")
          );
        }
      }
    }

    void refreshStatuses();
    const interval = window.setInterval(() => {
      void refreshStatuses();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  async function createDatabase() {
    setError("");

    const trimmedName = name.trim();
    const trimmedDatabaseName = databaseName.trim();
    const parsedPort = Number(port);

    if (!trimmedName) {
      setError("Enter an environment name.");
      return;
    }

    if (!trimmedDatabaseName || !/^[a-zA-Z0-9_]+$/.test(trimmedDatabaseName)) {
      setError("Database name may contain only letters, numbers, and underscores.");
      return;
    }

    if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
      setError("Port must be a whole number between 1024 and 65535.");
      return;
    }

    if (!password) {
      setError("Enter a root password.");
      return;
    }

    setLoading(true);

    try {
      const database = await window.databaseAPI.create({
        name: trimmedName,
        port: parsedPort,
        password,
        database: trimmedDatabaseName
      });

      setDatabases(current => [...current, database]);
      setName("");
      setDatabaseName("");
      setPassword("");
      setCreateOpen(false);
    } catch (createError) {
      setError(errorMessage(createError, "Failed to create database"));
    } finally {
      setLoading(false);
    }
  }

  function updateStatus(id: string, status: DatabaseStatus) {
    setDatabases(current =>
      current.map(database =>
        database.id === id ? { ...database, status } : database
      )
    );
  }

  async function runDatabaseAction(
    database: Database,
    action: () => Promise<void>,
    fallback: string
  ) {
    setActionError("");
    setBusyId(database.id);

    try {
      await action();
      const status = await window.databaseAPI.status(database.id);
      updateStatus(database.id, status);
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure, fallback));
    } finally {
      setBusyId(null);
    }
  }

  function startDatabase(database: Database) {
    return runDatabaseAction(
      database,
      () => window.databaseAPI.start(database.id),
      "Failed to start database"
    );
  }

  function stopDatabase(database: Database) {
    return runDatabaseAction(
      database,
      () => window.databaseAPI.stop(database.id),
      "Failed to stop database"
    );
  }

  function restartDatabase(database: Database) {
    return runDatabaseAction(
      database,
      () => window.databaseAPI.restart(database.id),
      "Failed to restart database"
    );
  }

  async function removeDatabase(database: Database) {
    const confirmed = window.confirm(
      `Remove the container for "${database.name}"?\n\n` +
        "Your database volume will NOT be deleted."
    );

    if (!confirmed) {
      return;
    }

    setActionError("");
    setBusyId(database.id);

    try {
      await window.databaseAPI.remove(database.id);
      updateStatus(database.id, "not-found");
    } catch (removeError) {
      setActionError(errorMessage(removeError, "Failed to remove container"));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDatabase(database: Database) {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE "${database.name}"?\n\n` +
        "This will delete the Docker container, database volume, all data, " +
        "and application metadata.\n\nThis cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setActionError("");
    setBusyId(database.id);

    try {
      await window.databaseAPI.delete(database.id);
      setDatabases(current =>
        current.filter(currentDatabase => currentDatabase.id !== database.id)
      );
    } catch (deleteError) {
      setActionError(errorMessage(deleteError, "Failed to delete database"));
    } finally {
      setBusyId(null);
    }
  }

  async function showLogs(database: Database) {
    setActionError("");

    try {
      const text = await window.databaseAPI.logs(database.id);
      setLogs({ id: database.id, text });
    } catch (logError) {
      setActionError(errorMessage(logError, "Failed to load database logs"));
    }
  }

  async function inspectDatabase(database: Database) {
    setActionError("");

    try {
      await window.databaseAPI.ping(database.id);
      const [availableDatabases, tables] = await Promise.all([
        window.databaseAPI.listDatabases(database.id),
        window.databaseAPI.listTables(database.id)
      ]);

      setInspection({
        id: database.id,
        databases: availableDatabases,
        tables
      });
      setQueryResult(null);
      setTableDetails(null);
    } catch (inspectionError) {
      setActionError(
        errorMessage(inspectionError, "Failed to connect to database")
      );
    }
  }

  async function runQuery(database: Database) {
    setActionError("");
    setQueryLoadingId(database.id);

    try {
      const result = await window.databaseAPI.query(database.id, query);
      setQueryResult({ id: database.id, result });
    } catch (queryError) {
      setActionError(errorMessage(queryError, "Failed to execute query"));
    } finally {
      setQueryLoadingId(null);
    }
  }

  async function inspectTable(database: Database, tableName: string) {
    setActionError("");

    try {
      const details = await window.databaseAPI.tableDetails(
        database.id,
        tableName
      );
      setTableDetails({ id: database.id, details });
    } catch (tableError) {
      setActionError(errorMessage(tableError, "Failed to load table details"));
    }
  }

  async function exportTable(database: Database, tableName: string) {
    setActionError("");
    setNotice("");
    setExportingTable(`${database.id}:${tableName}`);

    try {
      const result = await window.databaseAPI.exportTableCsv(
        database.id,
        tableName
      );

      if (!result.canceled) {
        setNotice(
          `Exported ${result.rowCount ?? 0} row(s) to ${result.filePath}`
        );
      }
    } catch (exportError) {
      setActionError(errorMessage(exportError, "Failed to export table"));
    } finally {
      setExportingTable(null);
    }
  }

  async function backupDatabase(database: Database) {
    setActionError("");
    setNotice("");
    setFileAction(`${database.id}:backup`);

    try {
      const result = await window.databaseAPI.backup(database.id);

      if (!result.canceled) {
        setNotice(`Backup saved to ${result.filePath}`);
      }
    } catch (backupError) {
      setActionError(errorMessage(backupError, "Failed to back up database"));
    } finally {
      setFileAction(null);
    }
  }

  async function restoreDatabase(database: Database) {
    const confirmed = window.confirm(
      `Restore a backup into "${database.name}"?\n\n` +
        "Existing objects with matching names may be overwritten."
    );

    if (!confirmed) {
      return;
    }

    setActionError("");
    setNotice("");
    setFileAction(`${database.id}:restore`);

    try {
      const result = await window.databaseAPI.restore(database.id);

      if (!result.canceled) {
        setNotice(`Backup restored from ${result.filePath}`);
        setInspection(null);
        setTableDetails(null);
        setQueryResult(null);
      }
    } catch (restoreError) {
      setActionError(errorMessage(restoreError, "Failed to restore database"));
    } finally {
      setFileAction(null);
    }
  }

  const runningCount = databases.filter(database => database.status === "running").length;
  const stoppedCount = databases.filter(database => database.status === "stopped").length;
  const attentionCount = databases.filter(database =>
    database.status === "error" || database.status === "not-found"
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="database" size={20} /></div>
          <div>
            <strong>Local DB</strong>
            <span>Manager</span>
          </div>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <button className="nav-item active"><Icon name="layers" /> Overview</button>
          <button className="nav-item" onClick={() => document.getElementById("environments")?.scrollIntoView({ behavior: "smooth" })}><Icon name="server" /> Environments <span className="nav-count">{databases.length}</span></button>
          <button className="nav-item" onClick={() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })}><Icon name="activity" /> Activity</button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <span className="sidebar-card-icon"><Icon name="database" /></span>
          <div>
            <strong>MySQL workspace</strong>
            <span>Docker-powered local data</span>
          </div>
        </div>
        <button className="nav-item sidebar-settings"><Icon name="settings" /> Settings</button>
        <div className="sidebar-footer">v0.1.0 <span>•</span> Local only</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Icon name="database" size={18} /></div><strong>Local DB Manager</strong></div>
          <div className="breadcrumbs"><span>Workspace</span><Icon name="arrow" size={13} /><strong>Overview</strong></div>
          <div className="topbar-actions"><span className="connection-pill"><span className="pulse-dot" /> Docker connected</span><button className="icon-button" title="Refresh status" onClick={() => window.location.reload()}><Icon name="refresh" /></button></div>
        </header>

        <div className="content-wrap">
          <section className="page-header">
            <div><span className="eyebrow">WORKSPACE</span><h1>Overview</h1><p>Manage your local database environments.</p></div>
            <button className="primary-button" type="button" onClick={() => { setError(""); setCreateOpen(true); }}><Icon name="plus" /> New environment</button>
          </section>

          <section className="metric-grid" aria-label="Workspace summary">
            <div className="metric-card"><div className="metric-icon blue"><Icon name="server" /></div><div><span>Total environments</span><strong>{databases.length}</strong></div><small className="metric-trend">All instances</small></div>
            <div className="metric-card"><div className="metric-icon green"><Icon name="activity" /></div><div><span>Running now</span><strong>{runningCount}</strong></div><small className="metric-trend positive">Ready to connect</small></div>
            <div className="metric-card"><div className="metric-icon amber"><Icon name="stop" /></div><div><span>Stopped</span><strong>{stoppedCount}</strong></div><small className="metric-trend">Available to start</small></div>
            <div className="metric-card"><div className="metric-icon rose"><Icon name="activity" /></div><div><span>Needs attention</span><strong>{attentionCount}</strong></div><small className="metric-trend">Errors or missing</small></div>
          </section>

          <div className="section-heading" id="environments">
            <div><span className="eyebrow">DATABASES</span><h2>Your environments</h2><p>Manage the local instances that power your projects.</p></div>
            <button className="secondary-button" type="button" onClick={() => { setError(""); setCreateOpen(true); }}><Icon name="plus" /> New environment</button>
          </div>

          {actionError && <div className="alert error-alert"><Icon name="activity" /><span>{actionError}</span></div>}
          {notice && <div className="alert success-alert"><Icon name="arrow" /><span>{notice}</span></div>}

          <section className="database-grid">
            {databases.length === 0 && <div className="empty-card"><div className="empty-icon"><Icon name="server" size={24} /></div><h3>No environments yet</h3><p>Create a local MySQL environment to get started.</p><button className="secondary-button" type="button" onClick={() => { setError(""); setCreateOpen(true); }}><Icon name="plus" /> New environment</button></div>}

            {databases.map(database => {
              const isBusy = busyId === database.id;
              const actionsDisabled = busyId !== null || fileAction !== null;
              const canStart = database.status !== "running" && database.status !== "starting" && database.status !== "stopping";
              const canStop = database.status === "running" || database.status === "starting" || database.status === "error";
              return (
                <article className={`database-card status-${database.status}`} key={database.id}>
                  <div className="card-topline"><span className={`status-badge ${database.status}`}><span className="status-dot" />{isBusy ? "Working..." : statusLabel(database.status)}</span><button className="more-button" title="Environment options"><span /><span /><span /></button></div>
                  <div className="database-title"><div className="database-avatar"><Icon name="database" /></div><div><h3>{database.name}</h3><p>MySQL {database.version}</p></div></div>
                  <div className="connection-details"><div><span>HOST</span><strong>{database.host}</strong></div><div><span>PORT</span><strong>{database.port}</strong></div><div><span>DATABASE</span><strong>{database.database}</strong></div><div><span>CREATED</span><strong>{formatCreatedAt(database.createdAt)}</strong></div></div>
                  <div className="card-actions primary-actions">
                    <button className="primary-button small" onClick={() => void inspectDatabase(database)} disabled={actionsDisabled}><Icon name="external" /> Connect & inspect</button>
                    <button className="secondary-button small icon-only" title="Restart environment" onClick={() => void restartDatabase(database)} disabled={actionsDisabled || database.status === "not-found"}><Icon name="refresh" /></button>
                  </div>
                  <div className="card-actions secondary-actions">
                    <button onClick={() => void startDatabase(database)} disabled={actionsDisabled || !canStart}><Icon name="play" /> Start</button>
                    <button onClick={() => void stopDatabase(database)} disabled={actionsDisabled || !canStop}><Icon name="stop" /> Stop</button>
                    <button onClick={() => void showLogs(database)} disabled={actionsDisabled}><Icon name="logs" /> Logs</button>
                    <button onClick={() => void backupDatabase(database)} disabled={actionsDisabled}><Icon name="backup" />{fileAction === `${database.id}:backup` ? "Backing up" : "Backup"}</button>
                    <button onClick={() => void restoreDatabase(database)} disabled={actionsDisabled}><Icon name="backup" />{fileAction === `${database.id}:restore` ? "Restoring" : "Restore"}</button>
                  </div>
                  <div className="card-danger-actions"><button onClick={() => void removeDatabase(database)} disabled={actionsDisabled}>Remove container</button><button onClick={() => void deleteDatabase(database)} disabled={actionsDisabled}><Icon name="trash" /> Delete permanently</button></div>

                  {logs?.id === database.id && <pre className="logs-panel">{logs.text || "No container logs available."}</pre>}
                  {inspection?.id === database.id && <div className="inspection-panel">
                    <div className="inspection-header"><div><span className="eyebrow">CONNECTED</span><h4>Database explorer</h4></div><span className="connection-pill compact"><span className="pulse-dot" /> Live</span></div>
                    <div className="explorer-summary"><div><span>DATABASES</span><strong>{inspection.databases.length}</strong></div><div><span>TABLES</span><strong>{inspection.tables.length}</strong></div><div><span>DEFAULT</span><strong>{database.database}</strong></div></div>
                    <h5>Tables in {database.database}</h5>
                    {inspection.tables.length === 0 ? <p className="muted-copy">No tables found in this database.</p> : <div className="table-list">{inspection.tables.map(table => <button className="table-chip" key={table} onClick={() => void inspectTable(database, table)}><Icon name="database" size={14} />{table}<Icon name="arrow" size={12} /></button>)}</div>}
                    {tableDetails?.id === database.id && <TableDetailsView details={tableDetails.details} exporting={exportingTable === `${database.id}:${tableDetails.details.tableName}`} onExport={() => void exportTable(database, tableDetails.details.tableName)} />}
                    <div className="query-panel"><div className="query-heading"><div><span className="eyebrow">QUERY CONSOLE</span><h4>Run SQL</h4></div><span className="sql-badge">MySQL</span></div><textarea value={query} onChange={event => setQuery(event.target.value)} spellCheck={false} /><button className="primary-button small" onClick={() => void runQuery(database)} disabled={queryLoadingId !== null || actionsDisabled}><Icon name="play" />{queryLoadingId === database.id ? "Running..." : "Run query"}</button>{queryResult?.id === database.id && <QueryResultView result={queryResult.result} />}</div>
                  </div>}
                </article>
              );
            })}
          </section>

          <section className="create-prompt"><div><span className="eyebrow">LOCAL WORKSPACE</span><h2>Need another environment?</h2><p>Provision a persistent MySQL 8.4 container with a few details.</p></div><button className="secondary-button" type="button" onClick={() => { setError(""); setCreateOpen(true); }}><Icon name="plus" /> Create environment</button></section>
          <div id="activity" className="activity-footer"><span><span className="pulse-dot" /> Status refreshes automatically every 5 seconds</span><span>Local DB Manager</span></div>
        </div>
      </main>

      {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading) setCreateOpen(false); }}>
        <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title" onMouseDown={event => event.stopPropagation()}>
          <div className="dialog-header"><div><span className="eyebrow">NEW ENVIRONMENT</span><h2 id="create-dialog-title">Create environment</h2><p>Configure a local MySQL container.</p></div><button className="dialog-close" type="button" aria-label="Close dialog" onClick={() => setCreateOpen(false)} disabled={loading}>×</button></div>
          <form className="create-form" onSubmit={event => { event.preventDefault(); void createDatabase(); }} noValidate>
            <div className="form-field"><label htmlFor="environment-name">Environment name</label><input id="environment-name" data-testid="environment-name" type="text" placeholder="Payments API" value={name} autoComplete="off" onChange={event => setName(event.target.value)} /></div>
            <div className="form-field"><label htmlFor="database-name">Database name</label><input id="database-name" data-testid="database-name" type="text" placeholder="payments_dev" value={databaseName} autoComplete="off" onChange={event => setDatabaseName(event.target.value)} /></div>
            <div className="form-row"><div className="form-field"><label htmlFor="database-port">Port</label><input id="database-port" data-testid="database-port" type="number" inputMode="numeric" placeholder="3307" value={port} min="1024" max="65535" onChange={event => setPort(event.target.value)} /></div><div className="form-field"><label htmlFor="root-password">Root password</label><input id="root-password" data-testid="root-password" type="password" placeholder="Use a secure password" value={password} autoComplete="new-password" onChange={event => setPassword(event.target.value)} /></div></div>
            <p className="field-help"><Icon name="database" size={13} /> Data persists in a named Docker volume.</p>
            {error && <div className="form-error" role="alert"><Icon name="activity" />{error}</div>}
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setCreateOpen(false)} disabled={loading}>Cancel</button><button className="primary-button" type="submit" disabled={loading}><Icon name="plus" />{loading ? "Creating..." : "Create environment"}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function QueryResultView({ result }: { result: QueryResult }) {
  return (
    <div>
      <p>
        Completed in {result.executionTimeMs} ms
        {result.columns.length === 0
          ? ` · ${result.affectedRows} row(s) affected`
          : ` · ${result.rows.length} row(s)`}
      </p>

      {result.columns.length > 0 && (
        <div style={{ overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                {result.columns.map(column => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {result.columns.map(column => {
                    const value = row[column];
                    return (
                      <td key={column}>
                        {value === null ? "NULL" : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TableDetailsView({
  details,
  exporting,
  onExport
}: {
  details: TableDetails;
  exporting: boolean;
  onExport: () => void;
}) {
  return (
    <div>
      <h4>
        Table: {details.tableName}{" "}
        <button onClick={onExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </h4>
      <h5>Columns</h5>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Nullable</th>
            <th>Key</th>
            <th>Default</th>
            <th>Extra</th>
          </tr>
        </thead>
        <tbody>
          {details.columns.map(column => (
            <tr key={column.name}>
              <td>{column.name}</td>
              <td>{column.type}</td>
              <td>{column.nullable ? "YES" : "NO"}</td>
              <td>{column.key || "-"}</td>
              <td>
                {column.defaultValue === null
                  ? "NULL"
                  : String(column.defaultValue)}
              </td>
              <td>{column.extra || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h5>Rows (first 100)</h5>
      {details.rows.length === 0 ? (
        <p>No rows found.</p>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                {details.columns.map(column => (
                  <th key={column.name}>{column.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
                  {details.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {details.columns.map(column => {
                    const value = row[column.name];
                    return (
                      <td key={column.name}>
                        {value === null ? "NULL" : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
