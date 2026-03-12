import './index.css';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { BioScan, GameEvent, WatchingInfo, Commander, SystemBody, SystemVisit } from './types';
import { getPossibleSpecies, getSpeciesValue } from './bio_data';

const landableIcon     = new URL('../static/landable.svg',      import.meta.url).href;
const terraformableIcon = new URL('../static/terraformable.svg', import.meta.url).href;
const terraformedIcon  = new URL('../static/terraform_other.svg', import.meta.url).href;
const discoveredIcon   = new URL('../static/discovered.svg',     import.meta.url).href;
const mappedIcon       = new URL('../static/mapped.svg',         import.meta.url).href;
const footfallIcon     = new URL('../static/footfall.svg',       import.meta.url).href;
const biologicalsIcon  = new URL('../static/biologicals.svg',    import.meta.url).href;

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

  const details = document.createElement('pre');
  details.className = 'event__details';
  details.textContent = JSON.stringify(event.data, null, 2);

  li.append(badge, raw, details);

  li.addEventListener('click', () => {
    li.classList.toggle('event--expanded');
  });

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

function createBodyGroup(key: string, members: SystemBody[], cmdrName: string, bioScansByBodyId: Map<number, BioScan[]>): HTMLLIElement {
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
  for (const body of members) inner.append(createBodyElement(body, cmdrName, bioScansByBodyId.get(body.body_id) ?? []));
  details.append(inner);

  li.append(details);
  return li;
}

function createBodyElement(body: SystemBody, cmdrName: string, bioScansForBody: BioScan[]): HTMLLIElement {
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
    type.className = `body__badge body__badge--type body__badge--terraformable`;
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

    const ul = document.createElement('ul');
    ul.className = 'bio-species__list';

    // Render confirmed scans first
    for (const scan of bioScansForBody) {
      const listTitle = document.createElement('div');
      listTitle.textContent = 'Confirmed biologicals';
      ul.appendChild(listTitle)

      const li2 = document.createElement('li');
      li2.className = 'bio-species__item bio-species__item--confirmed';

      const statusBadge = document.createElement('span');
      statusBadge.className = `bio-species__status bio-species__status--${scan.status}`;
      statusBadge.textContent = scan.status === 'complete' ? 'complete' : scan.status === 'collecting' ? '2nd sample' : 'genus only';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'bio-species__name';
      nameSpan.textContent = scan.species ?? scan.genus;
      if (scan.variant) nameSpan.title = scan.variant;

      li2.appendChild(statusBadge);
      li2.appendChild(nameSpan);

      let scanValue = scan.base_value
      if (scan.first_found) {
        scanValue = scanValue * 4
        const firstSpan = document.createElement('span');
        firstSpan.className = 'bio-species__flag bio-species__flag--first';
        firstSpan.textContent = '★';
        firstSpan.title = 'First found';
        li2.appendChild(firstSpan);
      }

      if (scan.status === 'complete') {
        const valueSpan = document.createElement('span');
        valueSpan.className = 'bio-species__value';
        valueSpan.textContent = scanValue != null
          ? `${scanValue.toLocaleString()} cr`
          : '— cr';
        li2.appendChild(valueSpan);
      }

      ul.appendChild(li2);
    }

    // For remaining unconfirmed signals, show predictions
    const unconfirmedCount = (body.biological_signals ?? 0) - bioScansForBody.length;
    if (unconfirmedCount > 0) {
      const listTitle = document.createElement('div');
      listTitle.textContent = 'Predicted biologicals';
      ul.appendChild(listTitle)

      const matches = getPossibleSpecies(body);
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

  const badges = document.createElement('span');
  badges.className = 'visit__badges';

  const notableBodies: { count: number; label: string; cls: string }[] = [
    { count: visit.earthlike_worlds,     label: 'ELW', cls: 'elw' },
    { count: visit.water_worlds,          label: 'WW',  cls: 'ww'  },
    { count: visit.ammonia_worlds,        label: 'AW',  cls: 'aw'  },
    { count: visit.terraformable_planets, label: 'TF',  cls: 'tf'  },
  ];
  for (const { count, label, cls } of notableBodies) {
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = `visit__body-badge visit__body-badge--${cls}`;
      badge.textContent = count > 1 ? `${count} ${label}` : label;
      badge.title = `${count} ${label}`;
      badges.appendChild(badge);
    }
  }

  li.addEventListener('click', onClick);
  li.append(time, name, badges);
  return li;
}

function setCommander(cmdr: Commander | null): void {
  const el = document.getElementById('commander');
  const systemNameEl = document.getElementById('system-name');
  if (!el) return;
  el.hidden = !cmdr;
  if (systemNameEl) systemNameEl.textContent = cmdr?.currentSystemName ?? '';
  if (!cmdr) return;
  el.textContent = `CMDR ${cmdr.name}`;
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

async function populateSystemStats(
  systemAddress: number | null,
  countId = 'body-count',
  tagId = 'all-bodies-tag',
): Promise<void> {
  const countEl = document.getElementById(countId) as HTMLSpanElement;
  const tagEl   = document.getElementById(tagId)   as HTMLSpanElement;
  if (!countEl || !tagEl) return;

  if (systemAddress === null) {
    countEl.textContent = '';
    tagEl.hidden = true;
    return;
  }

  const stats = await invoke<{ body_count: number | null; all_bodies_found: number; found_count: number } | null>(
    'system_stats', { systemAddress }
  );
  if (!stats) {
    countEl.textContent = '';
    tagEl.hidden = true;
    return;
  }

  countEl.textContent = stats.body_count != null
    ? `${stats.found_count} / ${stats.body_count} bodies`
    : `${stats.found_count} bodies`;
  tagEl.hidden = !stats.all_bodies_found;
}

async function populateBodies(
  targetList: HTMLUListElement,
  systemAddress: number | null,
  cmdrName: string
): Promise<void> {
  targetList.innerHTML = '';
  if (systemAddress === null) return;

  const [bodies, bioScans] = await Promise.all([
    invoke<SystemBody[]>('bodies_get', { systemAddress }),
    invoke<BioScan[]>('bio_scans_get', { systemAddress }),
  ]);

  // Resolve credit values for newly-complete scans (frontend owns bio_data.ts values)
  for (const scan of bioScans) {
    if (scan.status === 'complete' && scan.base_value === null && scan.species !== null) {
      const baseValue = getSpeciesValue(scan.species);
      if (baseValue !== null) {
        void invoke('bio_scan_set_value', { id: scan.id, baseValue });
        scan.base_value = baseValue;
      }
    }
  }

  const bioScansByBodyId = new Map<number, BioScan[]>();
  for (const scan of bioScans) {
    const arr = bioScansByBodyId.get(scan.body_id) ?? [];
    arr.push(scan);
    bioScansByBodyId.set(scan.body_id, arr);
  }

  for (const entry of buildBodyEntries(bodies)) {
    targetList.append(
      entry.kind === 'group'
        ? createBodyGroup(entry.key, entry.members, cmdrName, bioScansByBodyId)
        : createBodyElement(entry.body, cmdrName, bioScansByBodyId.get(entry.body.body_id) ?? [])
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
  const list             = document.getElementById('event-list')          as HTMLUListElement;
  const bodyList         = document.getElementById('body-list')           as HTMLUListElement;
  const historyList      = document.getElementById('history-list')        as HTMLUListElement;
  const historyViewList  = document.getElementById('history-view-list')   as HTMLDivElement;
  const historyViewDetail = document.getElementById('history-view-detail') as HTMLDivElement;
  const historyBackBtn   = document.getElementById('history-back-btn')    as HTMLButtonElement;
  const historyBodyList  = document.getElementById('history-body-list')   as HTMLUListElement;

  initTabs();

  let unlistenNewEvent: UnlistenFn | null = null;

  const cmdr = await invoke<Commander | null>('commander_get');
  let currentSystemAddress: number | null = cmdr?.currentSystem ?? null;

  function showHistoryDetail(visit: SystemVisit): void {
    const systemNameEl = document.getElementById('history-system-name');
    if (systemNameEl) systemNameEl.textContent = visit.system_name ?? `#${visit.system_address}`;
    historyViewList.hidden = true;
    historyViewDetail.hidden = false;
    void populateBodies(historyBodyList, visit.system_address, cmdr?.name ?? '');
    void populateSystemStats(visit.system_address, 'history-body-count', 'history-all-bodies-tag');
  }

  function showHistoryList(): void {
    historyViewDetail.hidden = true;
    historyBodyList.innerHTML = '';
    historyViewList.hidden = false;
  }

  historyBackBtn.addEventListener('click', showHistoryList);

  async function refreshHistoryList(): Promise<void> {
    historyList.innerHTML = '';
    const visits = await invoke<SystemVisit[]>('history_get');
    for (const visit of visits) historyList.append(createHistoryElement(visit, () => showHistoryDetail(visit)));
  }

  await listen<number>('bodies:updated', (e) => {
    void populateBodies(bodyList, e.payload, cmdr?.name ?? '');
    void populateSystemStats(e.payload);
  });

  await listen<number>('bio_scan:updated', (e) => {
    if (e.payload === currentSystemAddress) {
      void populateBodies(bodyList, currentSystemAddress, cmdr?.name ?? '');
    }
  });

  await listen<null>('history:updated', () => {
    void refreshHistoryList();
  });

  function applyWatchingInfo(info: WatchingInfo): void {
    if (info.scanning) {
      setStatus('Scanning for new session...', false);
      unlistenNewEvent?.();
      unlistenNewEvent = null;
      watchBtn.disabled = true;
      stopBtn.disabled = false;
    } else if (info.file) {
      setStatus(`Watching: ${info.filename}`, true);
      unlistenNewEvent?.();
      listen<GameEvent>('event:new', (e) => {
        list.prepend(createEventElement(e.payload));
        if (list.childElementCount > 100) list.lastElementChild?.remove();
        updateCount();
      }).then(fn => { unlistenNewEvent = fn; });
      watchBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      setStatus('No active file found in folder', false);
      watchBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // Main process fires this on startup if a folder was previously saved
  await listen<WatchingInfo>('file:watching', (e) => {
    folderInput.value = e.payload.folder;
    applyWatchingInfo(e.payload);
  });

  await listen<Commander>('commander:active', (e) => {
    currentSystemAddress = e.payload.currentSystem ?? null;
    setCommander(e.payload);
    void populateBodies(bodyList, currentSystemAddress, e.payload.name);
    void populateSystemStats(currentSystemAddress);
  });

  watchBtn.addEventListener('click', async () => {
    const folder = folderInput.value.trim();
    if (!folder) return;
    applyWatchingInfo(await invoke<WatchingInfo>('folder_set', { folder }));
  });

  stopBtn.addEventListener('click', async () => {
    unlistenNewEvent?.();
    unlistenNewEvent = null;
    await invoke('file_stop');
    setStatus('Not watching', false);
    watchBtn.disabled = false;
    stopBtn.disabled = true;
  });

  setCommander(cmdr);
  await Promise.all([
    populateBodies(bodyList, cmdr?.currentSystem ?? null, cmdr?.name ?? ''),
    populateSystemStats(cmdr?.currentSystem ?? null),
    refreshHistoryList(),
  ]);

  const savedFolder = await invoke<string | null>('folder_get');
  if (savedFolder) folderInput.value = savedFolder;

  const past = await invoke<GameEvent[]>('events_get_all');
  for (const event of past) list.prepend(createEventElement(event));
  updateCount();
}

init().catch((err: unknown) => {
  console.error('Renderer initialization failed:', err);
  const status = document.getElementById('status');
  if (status) status.textContent = `Init error: ${err instanceof Error ? err.message : String(err)}`;
});
