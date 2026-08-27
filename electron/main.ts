import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { SaveDialogOptions } from "electron";
import path from "path";

import { DatabaseService } from "./services/DatabaseService";

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const developmentUrl = process.env.LOCAL_DB_MANAGER_DEV_URL;

  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(
      path.join(__dirname, "../frontend/dist/index.html")
    );
  }
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

app.whenReady().then(() => {
  const databaseService = new DatabaseService();
  registerIpcHandlers(databaseService);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
