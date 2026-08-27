import { useEffect, useState } from "react";

import type {
  Database,
  DatabaseStatus,
  QueryResult,
  TableDetails
} from "./types/database";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(status: DatabaseStatus): string {
  return status.replace("-", " ").replace(/^\w/, character => character.toUpperCase());
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
    setLoading(true);

    try {
      const database = await window.databaseAPI.create({
        name,
        port: Number(port),
        password,
        database: databaseName
      });

      setDatabases(current => [...current, database]);
      setName("");
      setDatabaseName("");
      setPassword("");
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

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial",
        maxWidth: "1000px",
        margin: "auto"
      }}
    >
      <h1>Local DB Manager</h1>
      <p>Manage your local database environments</p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "25px",
          marginTop: "30px"
        }}
      >
        <h2>Create MySQL Database</h2>

        <form
          onSubmit={event => {
            event.preventDefault();
            void createDatabase();
          }}
          style={{
            display: "grid",
            gap: "15px",
            maxWidth: "500px"
          }}
        >
          <input
            placeholder="Environment name"
            value={name}
            required
            onChange={event => setName(event.target.value)}
          />
          <input
            placeholder="Database name"
            value={databaseName}
            required
            onChange={event => setDatabaseName(event.target.value)}
          />
          <input
            type="number"
            placeholder="Port"
            value={port}
            min="1024"
            max="65535"
            required
            onChange={event => setPort(event.target.value)}
          />
          <input
            type="password"
            placeholder="Root password"
            value={password}
            required
            onChange={event => setPassword(event.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Database"}
          </button>
        </form>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>Databases</h2>
        {actionError && <p style={{ color: "red" }}>{actionError}</p>}
        {notice && <p style={{ color: "green" }}>{notice}</p>}

        {databases.length === 0 && <p>No databases created yet.</p>}

        {databases.map(database => {
          const isBusy = busyId === database.id;
          const actionsDisabled = busyId !== null || fileAction !== null;

          return (
            <div
              key={database.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "20px",
                marginTop: "15px"
              }}
            >
              <h3>{database.name}</h3>
              <p>
                {database.engine} {database.version}
              </p>
              <p>
                {database.host}:{database.port}
              </p>
              <p>Database: {database.database}</p>
              <p>
                Status: <strong>{isBusy ? "Working..." : statusLabel(database.status)}</strong>
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => void startDatabase(database)}
                  disabled={actionsDisabled || database.status === "running"}
                >
                  Start
                </button>
                <button
                  onClick={() => void stopDatabase(database)}
                  disabled={actionsDisabled || database.status !== "running"}
                >
                  Stop
                </button>
                <button
                  onClick={() => void restartDatabase(database)}
                  disabled={actionsDisabled || database.status === "not-found"}
                >
                  Restart
                </button>
                <button
                  onClick={() => void removeDatabase(database)}
                  disabled={actionsDisabled}
                >
                  Remove Container
                </button>
                <button
                  onClick={() => void deleteDatabase(database)}
                  disabled={actionsDisabled}
                >
                  Delete Permanently
                </button>
                <button onClick={() => void showLogs(database)}>
                  View Logs
                </button>
                <button
                  onClick={() => void backupDatabase(database)}
                  disabled={actionsDisabled}
                >
                  {fileAction === `${database.id}:backup`
                    ? "Backing up..."
                    : "Backup"}
                </button>
                <button
                  onClick={() => void restoreDatabase(database)}
                  disabled={actionsDisabled}
                >
                  {fileAction === `${database.id}:restore`
                    ? "Restoring..."
                    : "Restore"}
                </button>
                <button
                  onClick={() => void inspectDatabase(database)}
                  disabled={actionsDisabled}
                >
                  Connect & Inspect
                </button>
              </div>

              {logs?.id === database.id && (
                <pre
                  style={{
                    textAlign: "left",
                    whiteSpace: "pre-wrap",
                    maxHeight: "240px",
                    overflow: "auto"
                  }}
                >
                  {logs.text || "No container logs available."}
                </pre>
              )}

              {inspection?.id === database.id && (
                <div style={{ textAlign: "left" }}>
                  <h4>Databases</h4>
                  <p>{inspection.databases.join(", ") || "None"}</p>
                  <h4>Tables in {database.database}</h4>
                  {inspection.tables.length === 0 ? (
                    <p>None</p>
                  ) : (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {inspection.tables.map(table => (
                        <button
                          key={table}
                          onClick={() => void inspectTable(database, table)}
                        >
                          {table}
                        </button>
                      ))}
                    </div>
                  )}

                  {tableDetails?.id === database.id && (
                    <TableDetailsView
                      details={tableDetails.details}
                      exporting={
                        exportingTable ===
                        `${database.id}:${tableDetails.details.tableName}`
                      }
                      onExport={() =>
                        void exportTable(
                          database,
                          tableDetails.details.tableName
                        )
                      }
                    />
                  )}

                  <h4>SQL Query</h4>
                  <textarea
                    rows={6}
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    spellCheck={false}
                  />
                  <button
                    onClick={() => void runQuery(database)}
                    disabled={queryLoadingId !== null || actionsDisabled}
                  >
                    {queryLoadingId === database.id ? "Running..." : "Run Query"}
                  </button>

                  {queryResult?.id === database.id && (
                    <QueryResultView result={queryResult.result} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
