let DATA = [];
const PAGE_SIZE = 100;

const state = {
  chooser: null,
  artist: null, album: null,
  search: '',
  query: null, queryFn: null, queryCustom: null,
  sortKey: 'artist', sortDir: 1,
  page: 0,
};

fetch('songs.json')
  .then(r => r.json())
  .then(data => {
    DATA = data;
    DATA.forEach(s => {
      s._hay = (s.artist + ' ' + s.title + ' ' + s.album).toLowerCase();
    });
    document.getElementById('summary').textContent =
      `${DATA.length} songs · ${uniqueChoosers().length} choosers`;
    buildBars();
    wireSearch();
    wirePager();
    render();
  })
  .catch(e => {
    document.getElementById('summary').textContent = 'Failed to load songs.json: ' + e;
  });

function uniqueChoosers() {
  return [...new Set(DATA.map(s => s.chooser))].sort();
}

function buildBars() {
  const chooserBar = document.getElementById('chooser-bar');
  chooserBar.innerHTML = '';
  chooserBar.appendChild(mkBtn('All', () => { state.chooser = null; state.page = 0; render(); }));
  uniqueChoosers().forEach(c => {
    chooserBar.appendChild(mkBtn(c, () => {
      state.chooser = (state.chooser === c) ? null : c;
      state.page = 0;
      render();
    }));
  });

  const customQueries = {
    'Chooser stats': chooserStats,
    'Artists >1':    artistsOver1,
    'Albums >1':     albumsOver1,
  };

  const songQueries = {
    'Longest 10':  { fn: () => [...DATA].sort((a,b) => b.time - a.time).slice(0,10),
                     sortKey: 'time', sortDir: -1 },
    'Shortest 10': { fn: () => [...DATA].sort((a,b) => a.time - b.time).slice(0,10),
                     sortKey: 'time', sortDir: 1 },
    'Oldest 10':   { fn: () => [...DATA].sort((a,b) => a.year - b.year).slice(0,10),
                     sortKey: 'year', sortDir: 1 },
    'Newest 10':   { fn: () => [...DATA].sort((a,b) => b.year - a.year).slice(0,10),
                     sortKey: 'year', sortDir: -1 },
    'Random pick': { fn: () => [DATA[Math.floor(Math.random() * DATA.length)]],
                     sortKey: null, sortDir: 1 },
    'Duplicates':  { fn: findDuplicates,
                     sortKey: 'artist', sortDir: 1 },
  };

  const queryBar = document.getElementById('query-bar');
  queryBar.innerHTML = '';

  Object.entries(customQueries).forEach(([label, fn]) => {
    queryBar.appendChild(mkBtn(label, () => {
      const on = state.query !== label;
      state.query = on ? label : null;
      state.queryFn = null;
      state.queryCustom = on ? fn : null;
      state.page = 0;
      render();
    }));
  });

  Object.entries(songQueries).forEach(([label, q]) => {
    queryBar.appendChild(mkBtn(label, () => {
      if (label === 'Random pick') {
        state.query = label;
        state.queryFn = q.fn;
        state.queryCustom = null;
        state.page = 0;
        if (q.sortKey) { state.sortKey = q.sortKey; state.sortDir = q.sortDir; }
        render();
        return;
      }
      const on = state.query !== label;
      state.query = on ? label : null;
      state.queryFn = on ? q.fn : null;
      state.queryCustom = null;
      state.page = 0;
      if (on && q.sortKey) { state.sortKey = q.sortKey; state.sortDir = q.sortDir; }
      render();
    }));
  });
}

function mkBtn(label, onclick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

let searchTimer;
function wireSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = input.value.trim().toLowerCase();
      if (state.search) {
        state.sortKey = 'artist';
        state.sortDir = 1;
      }
      state.page = 0;
      render();
    }, 150);
  });
  document.getElementById('clear-filters').addEventListener('click', () => {
    state.chooser = null;
    state.artist = null;
    state.album = null;
    state.search = '';
    state.query = null;
    state.queryFn = null;
    state.queryCustom = null;
    state.page = 0;
    state.sortKey = 'artist';
    state.sortDir = 1;
    document.getElementById('search').value = '';
    render();
  });
}

function wirePager() {
  document.getElementById('prev-page').addEventListener('click', () => {
    if (state.page > 0) { state.page--; render(); window.scrollTo(0,0); }
  });
  document.getElementById('next-page').addEventListener('click', () => {
    state.page++;
    render();
    window.scrollTo(0,0);
  });
}

function findDuplicates() {
  const map = new Map();
  DATA.forEach(s => {
    const k = (s.artist + '\u0000' + s.title).toLowerCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  });
  return [...map.values()].filter(a => a.length > 1).flat();
}

// ---- Custom-table queries ----

function chooserStats() {
  const by = new Map();
  DATA.forEach(s => {
    if (!by.has(s.chooser)) by.set(s.chooser, { chooser: s.chooser, n: 0, tTime: 0, tYear: 0 });
    const o = by.get(s.chooser);
    o.n++; o.tTime += s.time; o.tYear += s.year;
  });
  const rows = [...by.values()].map(o => ({
    chooser: o.chooser,
    n: o.n,
    avgTime: Math.round(o.tTime / o.n),
    avgYear: Math.round(o.tYear / o.n),
  })).sort((a,b) => a.chooser.localeCompare(b.chooser));
  return {
    columns: [
      { key: 'chooser', label: 'Chooser', drill: 'chooser' },
      { key: 'n',       label: 'Songs',   num: true },
      { key: 'avgTime', label: 'Avg time', num: true, fmt: fmtTime },
      { key: 'avgYear', label: 'Avg year', num: true },
    ],
    rows,
  };
}

function artistsOver1() {
  const by = new Map();
  DATA.forEach(s => {
    if (!by.has(s.artist)) by.set(s.artist, []);
    by.get(s.artist).push(s);
  });
  const rows = [...by.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([artist, arr]) => ({ artist, n: arr.length }))
    .sort((a,b) => b.n - a.n || a.artist.localeCompare(b.artist));
  return {
    columns: [
      { key: 'artist', label: 'Artist', drill: 'artist' },
      { key: 'n',      label: 'Songs', num: true },
    ],
    rows,
  };
}

function albumsOver1() {
  const by = new Map();
  DATA.forEach(s => {
    if (!by.has(s.album)) by.set(s.album, []);
    by.get(s.album).push(s);
  });
  const rows = [...by.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([album, arr]) => ({ album, n: arr.length }))
    .sort((a,b) => b.n - a.n || a.album.localeCompare(b.album));
  return {
    columns: [
      { key: 'album', label: 'Album', drill: 'album' },
      { key: 'n',     label: 'Songs', num: true },
    ],
    rows,
  };
}

// ---- Rendering ----

function render() {
  if (state.queryCustom) {
    renderCustom(state.queryCustom());
    markActiveButtons();
    return;
  }

  restoreSongHeaders();

  let rows = state.queryFn ? state.queryFn() : DATA.slice();

  if (state.chooser) rows = rows.filter(s => s.chooser === state.chooser);
  if (state.artist) rows = rows.filter(s => s.artist === state.artist);
  if (state.album)  rows = rows.filter(s => s.album  === state.album);
  if (state.search) {
    const q = state.search;
    rows = rows.filter(s => s._hay.includes(q));
  }

  const k = state.sortKey;
  rows.sort((a, b) => {
    const av = a[k], bv = b[k];
    if (typeof av === 'number') return (av - bv) * state.sortDir;
    const primary = String(av).localeCompare(String(bv)) * state.sortDir;
    if (primary !== 0) return primary;
    return String(a.title).localeCompare(String(b.title));
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (state.page >= totalPages) state.page = totalPages - 1;
  if (state.page < 0) state.page = 0;
  const start = state.page * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  document.getElementById('rows').innerHTML = pageRows.map(s => `
    <tr>
      <td>${esc(s.artist)}</td>
      <td>${esc(s.title)}</td>
      <td>${esc(s.album)}</td>
      <td class="num">${s.year}</td>
      <td class="num">${fmtTime(s.time)}</td>
      <td>${esc(s.chooser)}</td>
      <td>${esc(s.challenge)}</td>
    </tr>`).join('');

  const bits = [`${total} of ${DATA.length} rows`];
  if (state.chooser) bits.push(`chooser=${state.chooser}`);
  if (state.artist) bits.push(`artist="${state.artist}"`);
  if (state.album)  bits.push(`album="${state.album}"`);
  if (state.search) bits.push(`search="${state.search}"`);
  if (state.query)  bits.push(`query=${state.query}`);

  let msg = bits.join(' · ');
  if (state.search && total === 0) {
    msg += ' — no matches, safe to add';
  }
  document.getElementById('count').textContent = msg;

  updatePager(total, totalPages);
  updateClearVisibility();
  markActiveButtons();
}

function restoreSongHeaders() {
  document.querySelector('table thead tr').innerHTML = `
    <th data-sort="artist">Artist</th>
    <th data-sort="title">Title</th>
    <th data-sort="album">Album</th>
    <th data-sort="year" class="num">Year</th>
    <th data-sort="time" class="num">Time</th>
    <th data-sort="chooser">Chooser</th>
    <th data-sort="challenge">Challenge</th>`;
}

function updatePager(total, totalPages) {
  const pager = document.getElementById('pager');
  if (total <= PAGE_SIZE) {
    pager.style.display = 'none';
    return;
  }
  pager.style.display = 'block';
  document.getElementById('page-info').textContent =
    `Page ${state.page + 1} of ${totalPages}`;
  document.getElementById('prev-page').disabled = state.page === 0;
  document.getElementById('next-page').disabled = state.page >= totalPages - 1;
}

function renderCustom(spec) {
  const thead = document.querySelector('table thead tr');
  thead.innerHTML = spec.columns.map(c =>
    `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`
  ).join('');

  document.getElementById('rows').innerHTML = spec.rows.map(r =>
    '<tr>' + spec.columns.map(c => {
      const v = r[c.key];
      const text = c.fmt ? c.fmt(v) : (v ?? '');
      const clickable = c.drill ? ' data-drill="' + c.drill +
        '" data-value="' + esc(r[c.key]) + '" style="cursor:pointer;text-decoration:underline"' : '';
      return `<td class="${c.num ? 'num' : ''}"${clickable}>${esc(text)}</td>`;
    }).join('') + '</tr>'
  ).join('');

  document.getElementById('count').textContent =
    `${spec.rows.length} rows · query=${state.query} · click a ${drillHint(spec)} to see those songs`;

  document.getElementById('pager').style.display = 'none';
  updateClearVisibility();
}

function drillHint(spec) {
  const d = spec.columns.find(c => c.drill);
  return d ? d.drill : 'row';
}

function updateClearVisibility() {
  const any = state.chooser || state.artist || state.album ||
              state.search || state.query;
  document.getElementById('clear-bar').style.display = any ? 'block' : 'none';
}

function markActiveButtons() {
  document.querySelectorAll('#chooser-bar button, #query-bar button')
    .forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#chooser-bar button').forEach(b => {
    if ((b.textContent === 'All' && !state.chooser) || b.textContent === state.chooser) b.classList.add('active');
  });
  document.querySelectorAll('#query-bar button').forEach(b => {
    if (b.textContent === state.query) b.classList.add('active');
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

document.addEventListener('click', e => {
  const drillCell = e.target.closest('td[data-drill]');
  if (drillCell) {
    const field = drillCell.dataset.drill;
    const value = drillCell.dataset.value;
    state.query = null; state.queryFn = null; state.queryCustom = null;
    state.chooser = null;
    state.artist = null;  state.album  = null;
    if (field === 'chooser') state.chooser = value;
    if (field === 'artist')  state.artist  = value;
    if (field === 'album')   state.album   = value;

    if (field === 'artist' || field === 'album') {
      state.sortKey = 'title'; state.sortDir = 1;
    } else {
      state.sortKey = 'artist'; state.sortDir = 1;
    }

    state.page = 0;
    render();
    return;
  }
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  if (state.queryCustom) return;
  const k = th.dataset.sort;
  if (state.sortKey === k) state.sortDir *= -1;
  else { state.sortKey = k; state.sortDir = 1; }
  state.page = 0;
  render();
});
