import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { initDatabase, insertEvent, getAllEvents, clearEvents, upsertCommander, getLastCommander, upsertSystemFromLocation, updateCommanderSystem, markAllBodiesFound, updateBodyDiscoveredBy, updateBodyMappedBy, getBodiesBySystem } from './database';
export type { SystemBody } from './database';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

// --- Types ---
export interface GameEvent {
  _id: string;
  type: string;
  raw: string;
  data: Record<string, unknown>;
  commander: string | null;
}

export interface WatchingInfo {
  folder: string;
  file: string | null;
  filename: string | null;
  scanning: boolean;
}

interface Config {
  folder?: string;
}

// --- Config persistence ---
function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Config;
  } catch {
    return {};
  }
}

function writeConfig(config: Config): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

// --- File discovery ---
// Reads the last 4 KB of a file and checks if any of the final lines
// contain a JSON object with event === 'Shutdown'.
function hasShutdownAtEnd(filePath: string): boolean {
  const TAIL_BYTES = 4096;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }

  const readSize = Math.min(TAIL_BYTES, stat.size);
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(readSize);
  fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
  fs.closeSync(fd);

  const lines = buf.toString('utf8').split('\n').filter((l) => l.trim());
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.event === 'Shutdown') return true;
    } catch {
      // not valid JSON, skip
    }
  }
  return false;
}

const JOURNAL_FILENAME = /^Journal\.\d{4}-\d{2}-\d{2}T\d{6}\.\d+\.log$/;

// Returns the newest file in the folder that does not end with a Shutdown event.
function findLatestFile(folder: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return null;
  }

  const files = entries
    .filter((e) => e.isFile() && JOURNAL_FILENAME.test(e.name))
    .flatMap((e) => {
      const fullPath = path.join(folder, e.name);
      try {
        return [{ path: fullPath, mtime: fs.statSync(fullPath).mtimeMs }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.mtime - a.mtime); // newest first

  for (const file of files) {
    if (!hasShutdownAtEnd(file.path)) return file.path;
  }
  return null;
}

// --- Active commander ---
export interface Commander {
  fid: string;
  name: string;
  currentSystem: number | null;
  currentSystemName: string | null;
}

let activeCommander: Commander | null = null;

// Reads the first 8 KB of a new journal file to find the Commander event,
// upserts into the DB, and pushes the result to the renderer.
function readFileHeader(filePath: string, win: BrowserWindow): void {
  const HEADER_BYTES = 8192;
  let content: string;
  try {
    const size = fs.statSync(filePath).size;
    const readSize = Math.min(HEADER_BYTES, size);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);
    content = buf.toString('utf8');
  } catch {
    return;
  }

  let cmdrFid: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;

      if (
        parsed.event === 'Commander' &&
        typeof parsed.FID  === 'string' &&
        typeof parsed.Name === 'string'
      ) {
        upsertCommander(parsed.FID, parsed.Name);
        cmdrFid = parsed.FID;
        activeCommander = { fid: parsed.FID, name: parsed.Name, currentSystem: null, currentSystemName: null };
        win.webContents.send('commander:active', activeCommander);
        continue;
      }

      if (
        parsed.event === 'Location' &&
        typeof parsed.SystemAddress === 'number' &&
        typeof parsed.StarSystem    === 'string'
      ) {
        upsertSystemFromLocation(parsed.SystemAddress, parsed.StarSystem);
        if (cmdrFid) {
          updateCommanderSystem(cmdrFid, parsed.SystemAddress);
          if (activeCommander) {
            activeCommander.currentSystem     = parsed.SystemAddress;
            activeCommander.currentSystemName = parsed.StarSystem;
            win.webContents.send('commander:active', activeCommander);
          }
        }
        return; // Location is always the last header event we need
      }
    } catch {
      // not valid JSON, skip
    }
  }
}

// --- File watcher state ---
let watchedFilePath: string | null = null;
let filePosition = 0;
let fsWatcher: fs.FSWatcher | null = null;

// --- Polling state ---
let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 5000;

const IGNORED_EVENTS = new Set(['Music', 'ReservoirReplenished']);

function parseLine(line: string): GameEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed: Record<string, unknown> = JSON.parse(trimmed);
    const type =
      typeof parsed.event === 'string' ? parsed.event :
      'unknown';
    if (IGNORED_EVENTS.has(type)) return null;
    return {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      raw: trimmed,
      data: parsed,
      commander: null,
    };
  } catch {
    return null;
  }
}

function readNewLines(win: BrowserWindow): void {
  if (!watchedFilePath) return;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(watchedFilePath);
  } catch {
    return;
  }

  if (stat.size < filePosition) filePosition = 0;
  if (stat.size === filePosition) return;

  const stream = fs.createReadStream(watchedFilePath, {
    start: filePosition,
    end: stat.size - 1,
    encoding: 'utf8',
  });

  let buffer = '';
  stream.on('data', (chunk) => { buffer += chunk; });
  stream.on('end', () => {
    filePosition = stat.size;
    for (const line of buffer.split('\n')) {
      const event = parseLine(line);
      if (event) {
        event.commander = activeCommander?.fid ?? null;
        insertEvent(event, event.commander);
        win.webContents.send('event:new', event);

        if (event.type === 'Location' &&
            typeof event.data.SystemAddress === 'number' &&
            typeof event.data.StarSystem    === 'string') {
          upsertSystemFromLocation(event.data.SystemAddress, event.data.StarSystem);
          if (activeCommander) {
            updateCommanderSystem(activeCommander.fid, event.data.SystemAddress);
            activeCommander.currentSystem     = event.data.SystemAddress;
            activeCommander.currentSystemName = event.data.StarSystem;
            win.webContents.send('commander:active', activeCommander);
          }
        }

        if (event.type === 'StartJump' &&
            typeof event.data.SystemAddress === 'number' &&
            typeof event.data.StarSystem    === 'string') {
          if (activeCommander) {
            updateCommanderSystem(activeCommander.fid, event.data.SystemAddress);
            activeCommander.currentSystem     = event.data.SystemAddress;
            activeCommander.currentSystemName = event.data.StarSystem;
            win.webContents.send('commander:active', activeCommander);
          }
        }

        if (event.type === 'FSSAllBodiesFound' &&
            typeof event.data.SystemAddress === 'number') {
          markAllBodiesFound(event.data.SystemAddress);
        }

        if (event.type === 'Scan' &&
            typeof event.data.BodyName === 'string' &&
            event.data.WasDiscovered === false &&
            activeCommander) {
          updateBodyDiscoveredBy(event.data.BodyName, activeCommander.name);
        }

        if (event.type === 'SAAScanComplete' &&
            typeof event.data.BodyName === 'string' &&
            activeCommander) {
          updateBodyMappedBy(event.data.BodyName, activeCommander.name);
        }

        if (event.type === 'Shutdown') {
          // Current session ended — stop watching and poll for the next file
          const folder = readConfig().folder;
          stopWatching();
          if (folder) beginPolling(folder, win);
          return;
        }
      }
    }
  });
}

function stopWatching(): void {
  fsWatcher?.close();
  fsWatcher = null;
  watchedFilePath = null;
}

function startWatching(filePath: string, win: BrowserWindow): void {
  stopPolling();
  stopWatching();
  watchedFilePath = filePath;

  try {
    filePosition = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch {
    filePosition = 0;
  }

  fsWatcher = fs.watch(filePath, () => readNewLines(win));
  readFileHeader(filePath, win);
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Notifies the renderer that we're scanning, then polls every POLL_INTERVAL_MS
// until a new journal file appears.
function beginPolling(folder: string, win: BrowserWindow): void {
  stopPolling();

  function tryFind(): boolean {
    const file = findLatestFile(folder);
    if (!file) return false;
    startWatching(file, win);
    const found: WatchingInfo = { folder, file, filename: path.basename(file), scanning: false };
    win.webContents.send('file:watching', found);
    return true;
  }

  // Check immediately before falling back to the interval
  if (tryFind()) return;

  win.webContents.send('file:watching', { folder, file: null, filename: null, scanning: true } as WatchingInfo);
  pollTimer = setInterval(() => { if (tryFind()) stopPolling(); }, POLL_INTERVAL_MS);
}

function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('folder:set', (_event, folder: string): WatchingInfo => {
    writeConfig({ folder });
    const file = findLatestFile(folder);
    if (file) {
      startWatching(file, win);
      return { folder, file, filename: path.basename(file), scanning: false };
    }
    beginPolling(folder, win);
    return { folder, file: null, filename: null, scanning: true };
  });

  ipcMain.handle('folder:get', () => readConfig().folder ?? null);

  ipcMain.handle('file:stop', () => {
    stopPolling();
    stopWatching();
  });

  ipcMain.handle('commander:get', () => activeCommander);

  ipcMain.handle('events:getAll', () => getAllEvents());

  ipcMain.handle('events:clear', () => clearEvents());

  ipcMain.handle('bodies:get', (_event, systemAddress: number) =>
    getBodiesBySystem(systemAddress)
  );
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 900,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  initDatabase();
  const saved = getLastCommander();
  activeCommander = saved
    ? { fid: saved.fid, name: saved.name, currentSystem: saved.current_system, currentSystemName: saved.system_name }
    : null;

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();

  registerIpcHandlers(mainWindow);

  mainWindow.webContents.once('did-finish-load', () => {
    const config = readConfig();
    if (!config.folder) return;

    const file = findLatestFile(config.folder);
    if (file) {
      startWatching(file, mainWindow);
      const info: WatchingInfo = { folder: config.folder, file, filename: path.basename(file), scanning: false };
      mainWindow.webContents.send('file:watching', info);
    } else {
      // No active file yet — beginPolling sends file:watching with scanning:true itself
      beginPolling(config.folder, mainWindow);
    }
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
