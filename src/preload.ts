import { contextBridge, ipcRenderer } from 'electron';
import type { GameEvent, WatchingInfo, Commander, SystemBody } from './index';

export type ChronicleAPI = typeof api;

const api = {
  setFolder: (folder: string): Promise<WatchingInfo> =>
    ipcRenderer.invoke('folder:set', folder),

  getFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('folder:get'),

  stopWatching: (): Promise<void> =>
    ipcRenderer.invoke('file:stop'),

  getAllEvents: (): Promise<GameEvent[]> =>
    ipcRenderer.invoke('events:getAll'),

  clearEvents: (): Promise<void> =>
    ipcRenderer.invoke('events:clear'),

  onNewEvent: (callback: (event: GameEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: GameEvent) => callback(event);
    ipcRenderer.on('event:new', handler);
    return () => ipcRenderer.removeListener('event:new', handler);
  },

  onWatchingFile: (callback: (info: WatchingInfo) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: WatchingInfo) => callback(info);
    ipcRenderer.on('file:watching', handler);
    return () => ipcRenderer.removeListener('file:watching', handler);
  },

  getBodies: (systemAddress: number): Promise<SystemBody[]> =>
    ipcRenderer.invoke('bodies:get', systemAddress),

  onBodiesUpdated: (callback: (systemAddress: number) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, addr: number) => callback(addr);
    ipcRenderer.on('bodies:updated', handler);
    return () => ipcRenderer.removeListener('bodies:updated', handler);
  },

  getCommander: (): Promise<Commander | null> =>
    ipcRenderer.invoke('commander:get'),

  onCommanderActive: (callback: (commander: Commander) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmdr: Commander) => callback(cmdr);
    ipcRenderer.on('commander:active', handler);
    return () => ipcRenderer.removeListener('commander:active', handler);
  },
};

contextBridge.exposeInMainWorld('chronicle', api);
