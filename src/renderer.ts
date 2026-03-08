import './index.css';
import type { GameEvent, WatchingInfo, Commander, SystemBody, SystemVisit } from './index';
import type { ChronicleAPI } from './preload';
import { getPossibleSpecies } from './bio_data';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const landableIcon = require('../static/landable.svg') as string;
const terraformableIcon = require('../static/terraformable.svg') as string;
const terraformedIcon = require('../static/terraform_other.svg') as string;
const discoveredIcon = require('../static/discovered.svg') as string;
const mappedIcon = require('../static/mapped.svg') as string;
const footfallIcon = require('../static/footfall.svg') as string;
const biologicalsIcon = require('../static/biologicals.svg') as string;

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

function createBodyGroup(key: string, members: SystemBody[], cmdrName: string): HTMLLIElement {
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
  for (const body of members) inner.append(createBodyElement(body, cmdrName));
  details.append(inner);

  li.append(details);
  return li;
}

function createBodyElement(body: SystemBody, cmdrName: string): HTMLLIElement {
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
    landable.className = 'body__icon';
    const img = document.createElement('img');
    img.src = landableIcon;
    img.alt = 'landable';
    landable.appendChild(img);
  } else {
    landable.className = 'body__col-empty';
  }

  const terraform_state = document.createElement('span');
  if (body.terraform_state && body.terraform_state.toLowerCase() == "terraformable") {
    li.className += ' body--planet--terraformable'
    terraform_state.className = 'body__icon';
    const img = document.createElement('img');
    img.src = terraformableIcon;
    img.alt = 'terraformable';
    terraform_state.appendChild(img);
  } else if (body.terraform_state && body.terraform_state !== "") {
    terraform_state.className = 'body__icon';
    const img = document.createElement('img');
    img.src = terraformedIcon;
    img.alt = 'terraformed?';
    terraform_state.appendChild(img);
  } else {
    terraform_state.className = 'body__col-empty';
  }

  const discovered = document.createElement('span');
  discovered.className = 'body__icon';
  if (body.discovered_by && body.discovered_by == cmdrName) {
    discovered.className = 'body__icon';
    const img = document.createElement('img');
    img.src = discoveredIcon;
    img.alt = 'discovered first';
    discovered.appendChild(img);
  } else {
    discovered.className = 'body__col-empty';
  }

  const mapped = document.createElement('span');
  if (body.mapped_by && body.mapped_by == cmdrName) {
    mapped.className = 'body__icon';
    const img = document.createElement('img');
    img.src = mappedIcon;
    img.alt = 'mapped first';
    mapped.appendChild(img);
  } else {
    mapped.className = 'body__col-empty';
  }

  const footfall = document.createElement('span');
  if (body.footfall_by && body.footfall_by == cmdrName) {
    footfall.className = 'body__icon';
    const img = document.createElement('img');
    img.src = footfallIcon;
    img.alt = 'footfall first';
    footfall.appendChild(img);
  } else {
    footfall.className = 'body__col-empty';
  }

  const EARTH_GRAVITY  = 9.797759;
  const ATM_PRESSURE   = 101231.656250;

  const atmosphere = document.createElement('span');
  atmosphere.className = 'body__class';
  atmosphere.textContent = body.atmosphere?.replace('atmosphere', '') ?? '';
  atmosphere.title = body.atmosphere ?? '';

  const temperature = document.createElement('span');
  temperature.className = 'body__stat';
  temperature.textContent = body.surface_temp != null ? `${body.surface_temp.toFixed(0)} K` : '';

  const gravity = document.createElement('span');
  gravity.className = 'body__stat';
  gravity.textContent = body.gravity != null ? `${(body.gravity / EARTH_GRAVITY).toFixed(2)} G` : '';

  const pressure = document.createElement('span');
  pressure.className = 'body__stat';
  pressure.textContent = body.pressure != null ? `${(body.pressure / ATM_PRESSURE).toFixed(2)} atm` : '';

  const biologicals = document.createElement('span');
  if (body.biological_signals && body.biological_signals > 0) {
    biologicals.className = 'body__icon body__icon--bio';

    const details = document.createElement('details');
    details.className = 'bio-species';

    const summary = document.createElement('summary');
    summary.className = 'bio-species__summary';

    const img = document.createElement('img');
    img.src = biologicalsIcon;
    img.alt = `${body.biological_signals} biological signal${body.biological_signals !== 1 ? 's' : ''}`;
    img.title = img.alt;
    summary.appendChild(img);

    const count = document.createElement('span');
    count.className = 'body__bio-count';
    count.textContent = `${body.biological_signals}`;
    summary.appendChild(count);

    details.appendChild(summary);

    const matches = getPossibleSpecies(body);
    const ul = document.createElement('ul');
    ul.className = 'bio-species__list';
    if (matches.length === 0) {
      const li2 = document.createElement('li');
      li2.className = 'bio-species__item bio-species__item--none';
      li2.textContent = 'No matches (insufficient scan data)';
      ul.appendChild(li2);
    } else {
      for (const match of matches) {
        const li2 = document.createElement('li');
        li2.className = match.uncertain
          ? 'bio-species__item bio-species__item--uncertain'
          : 'bio-species__item';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'bio-species__name';
        nameSpan.textContent = match.name;
        const valueSpan = document.createElement('span');
        valueSpan.className = 'bio-species__value';
        valueSpan.textContent = `${match.value.toLocaleString()} cr`;
        li2.appendChild(nameSpan);
        li2.appendChild(valueSpan);
        if (match.uncertain) {
          const flag = document.createElement('span');
          flag.className = 'bio-species__flag';
          flag.textContent = '?';
          flag.title = 'Conditions met but regional/special requirements unknown';
          li2.appendChild(flag);
        }
        ul.appendChild(li2);
      }
    }
    details.appendChild(ul);
    biologicals.appendChild(details);
  } else {
    biologicals.className = 'body__col-empty';
  }

  li.append(type, name, dist, cls, atmosphere, temperature, gravity, pressure, landable, terraform_state, biologicals, discovered, mapped, footfall);
  return li;
}

function createHistoryElement(visit: SystemVisit, onClick: () => void): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'visit';

  const name = document.createElement('span');
  name.className = 'visit__name';
  name.textContent = visit.system_name ?? `#${visit.system_address}`;

  const time = document.createElement('span');
  time.className = 'visit__time';
  time.textContent = new Date(visit.visited_at).toLocaleString();

  li.addEventListener('click', onClick);
  li.append(time, name);
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

async function populateBodies(
  targetList: HTMLUListElement,
  systemAddress: number | null,
  cmdrName: string
): Promise<void> {
  targetList.innerHTML = '';
  if (systemAddress === null) return;
  const bodies = await window.chronicle.getBodies(systemAddress);
  for (const entry of buildBodyEntries(bodies)) {
    targetList.append(
      entry.kind === 'group'
        ? createBodyGroup(entry.key, entry.members, cmdrName)
        : createBodyElement(entry.body, cmdrName)
    );
  }
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
  const list             = document.getElementById('event-list')          as HTMLUListElement;
  const bodyList         = document.getElementById('body-list')           as HTMLUListElement;
  const historyList      = document.getElementById('history-list')        as HTMLUListElement;
  const historyViewList  = document.getElementById('history-view-list')   as HTMLDivElement;
  const historyViewDetail = document.getElementById('history-view-detail') as HTMLDivElement;
  const historyBackBtn   = document.getElementById('history-back-btn')    as HTMLButtonElement;
  const historyDetailTitle = document.getElementById('history-detail-title') as HTMLSpanElement;
  const historyBodyList  = document.getElementById('history-body-list')   as HTMLUListElement;

  initTabs();

  let cleanupListener: (() => void) | null = null;

  const cmdr = await window.chronicle.getCommander();

  function showHistoryDetail(visit: SystemVisit): void {
    historyDetailTitle.textContent = visit.system_name ?? `#${visit.system_address}`;
    historyViewList.hidden = true;
    historyViewDetail.hidden = false;
    void populateBodies(historyBodyList, visit.system_address, cmdr?.name ?? '');
  }

  function showHistoryList(): void {
    historyViewDetail.hidden = true;
    historyBodyList.innerHTML = '';
    historyViewList.hidden = false;
  }

  historyBackBtn.addEventListener('click', showHistoryList);

  async function refreshHistoryList(): Promise<void> {
    historyList.innerHTML = '';
    const visits = await window.chronicle.getHistory();
    for (const visit of visits) historyList.append(createHistoryElement(visit, () => showHistoryDetail(visit)));
  }

  window.chronicle.onBodiesUpdated((systemAddress) => {
    void populateBodies(bodyList, systemAddress, cmdr.name);
  });

  window.chronicle.onHistoryUpdated(() => {
    void refreshHistoryList();
  });

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
  setCommander(cmdr);
  await Promise.all([
    populateBodies(bodyList, cmdr?.currentSystem ?? null, cmdr.name),
    refreshHistoryList(),
  ]);

  window.chronicle.onCommanderActive((cmdr) => {
    setCommander(cmdr);
    void populateBodies(bodyList, cmdr.currentSystem ?? null, cmdr.name);
  });

  const savedFolder = await window.chronicle.getFolder();
  if (savedFolder) folderInput.value = savedFolder;

  const past = await window.chronicle.getAllEvents();
  for (const event of past) list.prepend(createEventElement(event));
  updateCount();
}

init();
