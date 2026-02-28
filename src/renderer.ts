import './index.css';
import type { GameEvent, WatchingInfo, Commander, SystemBody } from './index';
import type { ChronicleAPI } from './preload';

declare global {
  interface Window {
    chronicle: ChronicleAPI;
  }
}

function createEventElement(event: GameEvent): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'event';
  li.dataset.id = event._id;

  const badge = document.createElement('span');
  badge.className = 'event__badge';
  badge.textContent = event.type;

  const raw = document.createElement('span');
  raw.className = 'event__raw';
  raw.textContent = event.raw;

  li.append(badge, raw);
  return li;
}

// Matches names like "Colonia 2 A Belt Cluster 3" — captures the base name before
// the trailing number so siblings can be grouped under "Colonia 2 A Belt Cluster".
const BELT_CLUSTER_RE = /^(.+) \d+$/;

type BodyEntry =
  | { kind: 'single'; body: SystemBody }
  | { kind: 'group';  key: string; members: SystemBody[] };

function buildBodyEntries(bodies: SystemBody[]): BodyEntry[] {
  const result: BodyEntry[] = [];
  const groupMap = new Map<string, { kind: 'group'; key: string; members: SystemBody[] }>();

  for (const body of bodies) {
    if (body.body_type === 'Unknown') {
      const m = BELT_CLUSTER_RE.exec(body.body_name);
      if (m) {
        const key = m[1];
        if (!groupMap.has(key)) {
          const entry = { kind: 'group' as const, key, members: [] as SystemBody[] };
          groupMap.set(key, entry);
          result.push(entry); // placeholder inserted at first-member position
        }
        groupMap.get(key)!.members.push(body);
        continue;
      }
    }
    result.push({ kind: 'single', body });
  }

  return result;
}

function createBodyGroup(key: string, members: SystemBody[]): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'body-group';

  const details = document.createElement('details');

  const summary = document.createElement('summary');
  summary.className = 'body-group__summary';

  const name = document.createElement('span');
  name.className = 'body__name';
  name.textContent = key;

  const badge = document.createElement('span');
  badge.className = 'body__badge';
  badge.textContent = `${members.length}`;

  summary.append(name, badge);
  details.append(summary);

  const inner = document.createElement('ul');
  inner.className = 'body-group__list';
  for (const body of members) inner.append(createBodyElement(body));
  details.append(inner);

  li.append(details);
  return li;
}

function createBodyElement(body: SystemBody): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `body body--${body.body_type.toLowerCase()}`;

  const name = document.createElement('span');
  name.className = 'body__name';
  name.textContent = body.body_name;

  const cls = document.createElement('span');
  cls.className = 'body__class';
  cls.textContent = body.planet_class ?? '';

  const dist = document.createElement('span');
  dist.className = 'body__distance';
  dist.textContent = `${body.distance.toFixed(1)} ls`;

  const type = document.createElement('span');
  type.className = `body__badge body__badge--type body__badge--${body.body_type.toLowerCase()}`;
  type.textContent = body.body_type.toLowerCase();

  const landable = document.createElement('span');
  if (body.landable) {
    landable.className = 'body__badge body__badge--landable';
    landable.textContent = 'landable';
  } else {
    landable.className = 'body__col-empty';
  }

  li.append(name, cls, dist, type, landable);
  return li;
}

function setCommander(cmdr: Commander | null): void {
  const el = document.getElementById('commander');
  if (!el) return;
  el.hidden = !cmdr;
  if (!cmdr) return;
  el.textContent = cmdr.currentSystemName
    ? `CMDR ${cmdr.name}  ·  ${cmdr.currentSystemName}`
    : `CMDR ${cmdr.name}`;
}

function setStatus(text: string, active: boolean): void {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.className = active ? 'status status--active' : 'status';
}

function updateCount(): void {
  const list = document.getElementById('event-list');
  const counter = document.getElementById('event-count');
  if (counter && list) counter.textContent = `${list.childElementCount} events`;
}

function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');

      const target = tab.dataset.tab;
      document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
        panel.classList.toggle('tab-panel--hidden', panel.id !== `panel-${target}`);
      });
    });
  });
}

async function init(): Promise<void> {
  const folderInput = document.getElementById('folder-path') as HTMLInputElement;
  const watchBtn   = document.getElementById('btn-watch')   as HTMLButtonElement;
  const stopBtn    = document.getElementById('btn-stop')    as HTMLButtonElement;
  const clearBtn   = document.getElementById('btn-clear')   as HTMLButtonElement;
  const list       = document.getElementById('event-list')  as HTMLUListElement;
  const bodyList   = document.getElementById('body-list')   as HTMLUListElement;

  initTabs();

  let cleanupListener: (() => void) | null = null;

  async function refreshBodyList(systemAddress: number | null): Promise<void> {
    bodyList.innerHTML = '';
    if (systemAddress === null) return;
    const bodies = await window.chronicle.getBodies(systemAddress);
    for (const entry of buildBodyEntries(bodies)) {
      bodyList.append(
        entry.kind === 'group'
          ? createBodyGroup(entry.key, entry.members)
          : createBodyElement(entry.body)
      );
    }
  }

  function applyWatchingInfo(info: WatchingInfo): void {
    if (info.scanning) {
      setStatus('Scanning for new session...', false);
      cleanupListener?.();
      cleanupListener = null;
      watchBtn.disabled = true;
      stopBtn.disabled = false;
    } else if (info.file) {
      setStatus(`Watching: ${info.filename}`, true);
      cleanupListener?.();
      cleanupListener = window.chronicle.onNewEvent((event) => {
        list.prepend(createEventElement(event));
        updateCount();
      });
      watchBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      setStatus('No active file found in folder', false);
      watchBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // Main process fires this on startup if a folder was previously saved
  window.chronicle.onWatchingFile((info) => {
    folderInput.value = info.folder;
    applyWatchingInfo(info);
  });

  watchBtn.addEventListener('click', async () => {
    const folder = folderInput.value.trim();
    if (!folder) return;
    applyWatchingInfo(await window.chronicle.setFolder(folder));
  });

  stopBtn.addEventListener('click', async () => {
    cleanupListener?.();
    cleanupListener = null;
    await window.chronicle.stopWatching();
    setStatus('Not watching', false);
    watchBtn.disabled = false;
    stopBtn.disabled = true;
  });

  clearBtn.addEventListener('click', async () => {
    await window.chronicle.clearEvents();
    list.innerHTML = '';
    updateCount();
  });

  // Restore saved folder path in the input without auto-starting
  // (auto-start is handled by the main process via 'file:watching')
  const cmdr = await window.chronicle.getCommander();
  setCommander(cmdr);
  await refreshBodyList(cmdr?.currentSystem ?? null);

  window.chronicle.onCommanderActive((cmdr) => {
    setCommander(cmdr);
    refreshBodyList(cmdr.currentSystem ?? null);
  });

  const savedFolder = await window.chronicle.getFolder();
  if (savedFolder) folderInput.value = savedFolder;

  const past = await window.chronicle.getAllEvents();
  for (const event of past) list.prepend(createEventElement(event));
  updateCount();
}

init();
