import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { SaveDialogOptions } from "electron";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";

import { DatabaseService } from "./services/DatabaseService";

// The dashboard does not need GPU acceleration, and disabling it avoids a
// blank window on Windows systems where Electron cannot initialize a GPU
// process (for example, remote desktop or restricted graphics environments).
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("in-process-gpu");
// Some managed Windows environments reject Electron renderer navigation
// while the Chromium sandbox is enabled. The renderer remains locked down by
// context isolation and disabled Node integration below.
app.commandLine.appendSwitch("no-sandbox");
app.disableHardwareAcceleration();

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

let frontendServer: ReturnType<typeof createServer> | undefined;

async function startFrontendServer(frontendDirectory: string): Promise<string> {
  const rootDirectory = path.resolve(frontendDirectory);
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? "/",
        "http://127.0.0.1"
      );
      const pathname = decodeURIComponent(requestUrl.pathname);
      const requestedPath = pathname === "/"
        ? "index.html"
        : pathname.replace(/^\/+/, "");
      const filePath = path.resolve(rootDirectory, requestedPath);
      const isInsideRoot =
        filePath === rootDirectory ||
        filePath.startsWith(`${rootDirectory}${path.sep}`);

      if (!isInsideRoot) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      let body: Buffer;
      let servedPath = filePath;

      try {
        body = await readFile(servedPath);
      } catch {
        if (path.extname(servedPath)) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        servedPath = path.join(rootDirectory, "index.html");
        body = await readFile(servedPath);
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentTypes[path.extname(servedPath).toLowerCase()] ??
          "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  frontendServer = server;
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine the frontend server address");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function createWindow(frontendUrl: string) {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on(
    "did-finish-load",
    () => console.log("Local DB Manager frontend loaded")
  );

  window.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        console.error(
          `Frontend failed to load (${errorCode}): ${errorDescription} - ${validatedURL}`
        );
      }
    }
  );

  const loadPromise = window.loadURL(frontendUrl);

  void loadPromise.catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to load the frontend: ${message}`);

    if (!window.isDestroyed()) {
      const errorPage = `<!doctype html><html><head><meta charset="utf-8"><title>Local DB Manager</title></head><body style="font-family:Segoe UI,sans-serif;padding:40px"><h1>Local DB Manager could not start</h1><p>The frontend failed to load.</p><pre>${message}</pre><p>Run <code>npm.cmd run build</code> and try again.</p></body></html>`;
      void window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`
      );
    }
  });
}

function registerIpcHandlers(databaseService: DatabaseService) {
  ipcMain.handle(
    "database:create",
    async (_, config: unknown) => databaseService.createDatabase(config)
  );

  ipcMain.handle(
    "database:start",
    async (_, id: unknown) => databaseService.start(id)
  );

  ipcMain.handle(
    "database:stop",
    async (_, id: unknown) => databaseService.stop(id)
  );

  ipcMain.handle(
    "database:restart",
    async (_, id: unknown) => databaseService.restart(id)
  );

  ipcMain.handle(
    "database:status",
    async (_, id: unknown) => databaseService.getStatus(id)
  );

  ipcMain.handle(
    "database:logs",
    async (_, id: unknown) => databaseService.getLogs(id)
  );

  ipcMain.handle(
    "database:ping",
    async (_, id: unknown) => databaseService.ping(id)
  );

  ipcMain.handle(
    "database:list-databases",
    async (_, id: unknown) => databaseService.listDatabases(id)
  );

  ipcMain.handle(
    "database:list-tables",
    async (_, id: unknown) => databaseService.listTables(id)
  );

  ipcMain.handle(
    "database:query",
    async (_, payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid query request");
      }

      const request = payload as {
        id?: unknown;
        sql?: unknown;
        params?: unknown;
      };

      return databaseService.query(
        request.id,
        request.sql,
        Array.isArray(request.params) ? request.params : []
      );
    }
  );

  ipcMain.handle(
    "database:table-details",
    async (_, payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid table request");
      }

      const request = payload as {
        id?: unknown;
        tableName?: unknown;
      };

      return databaseService.getTableDetails(
        request.id,
        request.tableName
      );
    }
  );

  ipcMain.handle(
    "database:export-table-csv",
    async (event, payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid export request");
      }

      const request = payload as {
        id?: unknown;
        tableName?: unknown;
      };
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const saveOptions: SaveDialogOptions = {
        title: "Export table as CSV",
        defaultPath: `${String(request.tableName ?? "table")}.csv`,
        filters: [{ name: "CSV files", extensions: ["csv"] }],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      };
      const saveResult = window
        ? await dialog.showSaveDialog(window, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      return databaseService.exportTableCsv(
        request.id,
        request.tableName,
        saveResult.filePath
      );
    }
  );

  ipcMain.handle(
    "database:backup",
    async (event, id: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const saveOptions: SaveDialogOptions = {
        title: "Back up database",
        defaultPath: "database-backup.sql",
        filters: [{ name: "SQL files", extensions: ["sql"] }],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      };
      const saveResult = window
        ? await dialog.showSaveDialog(window, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (saveResult.canceled || !saveResult.filePath) {
        return { canceled: true };
      }

      return databaseService.backupDatabase(id, saveResult.filePath);
    }
  );

  ipcMain.handle(
    "database:restore",
    async (event, id: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const openOptions = {
        title: "Restore database backup",
        filters: [{ name: "SQL files", extensions: ["sql"] }],
        properties: ["openFile"] as Array<"openFile">
      };
      const openResult = window
        ? await dialog.showOpenDialog(window, openOptions)
        : await dialog.showOpenDialog(openOptions);
      const sourcePath = openResult.filePaths[0];

      if (openResult.canceled || !sourcePath) {
        return { canceled: true };
      }

      return databaseService.restoreDatabase(id, sourcePath);
    }
  );

  ipcMain.handle(
    "database:list",
    async () => databaseService.getDatabases()
  );

  ipcMain.handle(
    "database:remove",
    async (_, id: unknown) => databaseService.removeEnvironment(id)
  );

  ipcMain.handle(
    "database:delete",
    async (_, id: unknown) => databaseService.deleteEnvironment(id)
  );
}

app.whenReady().then(async () => {
  const databaseService = new DatabaseService();
  registerIpcHandlers(databaseService);
  const developmentUrl = process.env.LOCAL_DB_MANAGER_DEV_URL;
  const frontendUrl = developmentUrl ?? await startFrontendServer(
    path.join(__dirname, "../frontend/dist")
  );
  await createWindow(frontendUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(frontendUrl);
    }
  });
});

app.on("before-quit", () => {
  frontendServer?.close();
  frontendServer = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
