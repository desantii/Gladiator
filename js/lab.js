/* Gladiator balance lab: edit rules and card stats, run AI-vs-AI games, compare against the v6.4 rules.
 * Uses the real game engine and AI (data.js, engine.js, ai.js), so results match the playable game. */
(function () {
  'use strict';
  const D = window.GLAD_DATA;
  const { Game } = window.GladiatorEngine;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STORE_KEY = 'gladiator-lab-variant-v1';

  // ------------------------------------------------------------ editable fields
  // Each field: [group, id, label, get(D), set(D, v)]
  const FIELDS = [];
  const add = (group, id, label, obj, key, opts) => FIELDS.push({ group, id, label, obj, key, min: 0, step: 5, ...opts });

  const R = D.RULES;
  add('rules', 'income', 'Income per turn', R, 'income');
  add('rules', 'refreshCost', 'Market refresh cost', R, 'refreshCost');
  add('rules', 'maxBuys', 'Max buys per turn', R, 'maxBuys', { step: 1 });
  add('rules', 'marketSize', 'Market size', R, 'marketSize', { step: 1, min: 1 });
  add('rules', 'fists', 'Fist damage', R, 'fists');
  add('rules', 'reviveVita', "Emperor's Favor revive VITA", R, 'reviveVita');
  add('rules', 'restlessTurn', 'Stones start on turn', R, 'restlessTurn', { step: 1, min: 1 });
  add('rules', 'restlessDmg', 'Stone damage', R, 'restlessDmg');
  add('rules', 'archerTurn', 'Archers fire on turn', R, 'archerTurn', { step: 1, min: 1 });
  add('rules', 'archerDmg', 'Archer damage', R, 'archerDmg');
  add('rules', 'bribeCost', 'Bribe the Lanista cost', R, 'bribeCost');
  add('rules', 'dodgeMax', 'Dodge cap', R, 'dodgeMax', { step: 1, min: 1 });
  add('rules', 'laurelsToWin', 'Laurels to win (2–3 players)', R, 'laurelsToWin', { step: 1, min: 1 });
  add('rules', 'laurelsToWinBig', 'Laurels to win (4+ players)', R, 'laurelsToWinBig', { step: 1, min: 1 });

  for (const [k, g] of Object.entries(D.GLADIATORS)) {
    add('glad', `${k}-vita`, `${g.name} VITA`, g, 'vita', { row: k, col: 'VITA' });
    add('glad', `${k}-dodge`, `${g.name} dodge`, g, 'dodge', { row: k, col: 'Dodge', step: 1 });
    add('glad', `${k}-count`, `${g.name} count`, g, 'count', { row: k, col: 'Count', step: 1 });
  }
  for (const [k, c] of Object.entries(D.CARDS)) {
    const grp = c.cat === 'legendary' ? 'legend' : c.type === 'armor' ? 'armor' : c.type === 'weapon' ? 'weapon' : 'special';
    if (c.beast) add(grp, `${k}-beast`, `${c.name} die ×`, c, 'beast', { row: k, col: 'ATK', step: 1, prefix: 'd6×' });
    else if (c.type === 'weapon') add(grp, `${k}-atk`, `${c.name} ATK`, c, 'atk', { row: k, col: 'ATK' });
    if (c.type === 'armor') add(grp, `${k}-def`, `${c.name} DEF`, c, 'def', { row: k, col: 'DEF' });
    if (c.heal) add(grp, `${k}-heal`, `${c.name} heal`, c, 'heal', { row: k, col: 'Heal' });
    if (c.buy != null) add(grp, `${k}-buy`, `${c.name} buy`, c, 'buy', { row: k, col: 'Buy' });
    add(grp, `${k}-sell`, `${c.name} sell`, c, 'sell', { row: k, col: 'Sell' });
    add(grp, `${k}-count`, `${c.name} count`, c, 'count', { row: k, col: 'Count', step: 1 });
  }
  const DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.id, f.obj[f.key]]));

  function applyConfig(overrides) {
    for (const f of FIELDS) f.obj[f.key] = f.id in overrides ? overrides[f.id] : DEFAULTS[f.id];
  }

  // ------------------------------------------------------------ variant state
  let variant = {};
  try { variant = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { variant = {}; }
  for (const k of Object.keys(variant)) if (!(k in DEFAULTS)) delete variant[k];
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(variant)); } catch (e) { /* storage unavailable */ } };

  // ------------------------------------------------------------ editor UI
  const GROUPS = [
    { id: 'rules', title: 'Rules', open: true },
    { id: 'glad', title: 'Gladiators', label: 'Gladiator' },
    { id: 'weapon', title: 'Weapons', label: 'Weapon' },
    { id: 'armor', title: 'Armor', label: 'Armor' },
    { id: 'special', title: 'Specials', label: 'Card' },
    { id: 'legend', title: 'Legendaries', label: 'Card' },
  ];
  const rowName = (grp, row) => (grp === 'glad' ? D.GLADIATORS[row].name : D.CARDS[row].name);

  function inputHTML(f) {
    const v = f.id in variant ? variant[f.id] : DEFAULTS[f.id];
    const changed = f.id in variant;
    return `<span class="fld${changed ? ' changed' : ''}">${f.prefix ? `<span class="pre">${f.prefix}</span>` : ''}<input type="number" id="f-${f.id}" data-f="${f.id}" value="${v}" min="${f.min}" step="${f.step}" inputmode="numeric" aria-label="${esc(f.label)}">${changed ? `<span class="was" title="v6.4 value">was ${DEFAULTS[f.id]}</span>` : ''}</span>`;
  }

  function renderEditor() {
    const wrap = $('editor');
    const openState = {};
    wrap.querySelectorAll('details').forEach((d) => { openState[d.dataset.g] = d.open; });
    let html = '';
    for (const g of GROUPS) {
      const fs = FIELDS.filter((f) => f.group === g.id);
      const nChanged = fs.filter((f) => f.id in variant).length;
      const open = g.id in openState ? openState[g.id] : g.open;
      html += `<details data-g="${g.id}"${open ? ' open' : ''}><summary>${g.title}${nChanged ? ` <span class="pill">${nChanged} changed</span>` : ''}</summary>`;
      if (g.id === 'rules') {
        html += '<div class="rules-grid">' + fs.map((f) => `<label for="f-${f.id}">${esc(f.label)}</label>${inputHTML(f)}`).join('') + '</div>';
      } else {
        const rows = [...new Set(fs.map((f) => f.row))];
        const cols = [...new Set(fs.map((f) => f.col))];
        html += `<div class="tbl-wrap"><table class="edit"><thead><tr><th>${g.label}</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
        for (const r of rows) {
          html += `<tr><th scope="row">${esc(rowName(g.id, r))}</th>`;
          for (const c of cols) {
            const f = fs.find((x) => x.row === r && x.col === c);
            html += `<td>${f ? inputHTML(f) : '<span class="na">—</span>'}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table></div>';
      }
      html += '</details>';
    }
    wrap.innerHTML = html;
    const n = Object.keys(variant).length;
    $('changes').textContent = n ? `${n} change${n > 1 ? 's' : ''} from v6.4` : 'No changes yet: edit any number to create a variant.';
    $('btn-reset').disabled = !n;
  }

  $('editor').addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.f;
    if (!id) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || e.target.value === '') { delete variant[id]; }
    else if (v === DEFAULTS[id]) delete variant[id];
    else variant[id] = v;
    save();
    renderEditor();
  });
  $('btn-reset').onclick = () => { variant = {}; save(); renderEditor(); };

  // ------------------------------------------------------------ simulation
  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const quiet = { log() {}, update() {}, delay: () => Promise.resolve(), showRoll: () => Promise.resolve(), showFlip: () => Promise.resolve(), showCard: () => Promise.resolve() };
  let cancelled = false;

  async function runBatch(overrides, nPlayers, games, seed, progress) {
    applyConfig(overrides);
    const m = {
      gameTurns: [], arenas: 0, arenaTurns: 0, gamesArenas: 0, reachStones: 0, reachArchers: 0, noWinner: 0,
      gold: [], atk: [], def: [], dmg: [], bribes: 0, buys: 0, draws: 0, refreshes: 0, crowdKills: 0,
      gladSeen: {}, gladWins: {}, weap: {}, samples: 0, games: 0,
    };
    for (let i = 0; i < games; i++) {
      if (cancelled) break;
      const g = new Game({ players: Array.from({ length: nPlayers }, (_, k) => ({ name: 'AI' + k, ai: true })) }, quiet, mulberry(seed * 100003 + i));
      let total = 0;
      const oEquip = g.equipPhase.bind(g);
      g.equipPhase = async () => {
        await oEquip();
        for (const p of g.players) {
          if (!p.glad || !p.glad.alive) continue;
          m.samples++;
          m.gold.push(p.gold);
          let atk = 0;
          for (const c of p.glad.equipped) {
            const d = D.CARDS[c.key];
            if (d.type === 'weapon') { atk += d.beast ? 3.5 * d.beast : d.atk; m.weap[c.key] = (m.weap[c.key] || 0) + 1; }
          }
          m.atk.push(atk);
          m.def.push(g.totalDef(p));
        }
      };
      const oArena = g.playArena.bind(g);
      g.playArena = async () => {
        const before = g.players.map((p) => p.laurels);
        await oArena();
        m.arenas++;
        m.arenaTurns += g.turn;
        total += g.turn;
        if (g.turn >= D.RULES.restlessTurn) m.reachStones++;
        if (g.turn >= D.RULES.archerTurn) m.reachArchers++;
        let winner = null;
        g.players.forEach((p, k) => { if (p.laurels > before[k]) winner = p; });
        if (!winner) m.noWinner++;
        for (const p of g.players) {
          const key = p.glad.key;
          m.gladSeen[key] = (m.gladSeen[key] || 0) + 1;
          if (p === winner) m.gladWins[key] = (m.gladWins[key] || 0) + 1;
        }
      };
      const oDmg = g.computeDamage.bind(g);
      g.computeDamage = (a, t, auto) => { const r = oDmg(a, t, auto); m.dmg.push(r.total); return r; };
      for (const [fn, key] of [['actBuy', 'buys'], ['actDraw', 'draws'], ['actRefresh', 'refreshes']]) {
        const o = g[fn].bind(g);
        g[fn] = (...args) => { const err = o(...args); if (!err) m[key]++; return err; };
      }
      const oLog = g.log.bind(g);
      g.log = (msg, cls) => { if (msg.includes('bribes the Lanista')) m.bribes++; return oLog(msg, cls); };
      const oZero = g.reachZero.bind(g);
      g.reachZero = async (p, src) => { if (src && src.crowd) m.crowdKills++; return oZero(p, src); };
      await g.run();
      m.gameTurns.push(total);
      m.gamesArenas += g.arena;
      m.games++;
      if (i % 2 === 1) { progress(i + 1); await new Promise((r) => setTimeout(r, 0)); }
    }
    applyConfig({});
    return m;
  }

  // ------------------------------------------------------------ metrics
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const q = (a, p) => { if (!a.length) return NaN; const s = sorted(a); return s[Math.floor(p * (s.length - 1))]; };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

  const METRICS = [
    { id: 'turnsMed', label: 'Turns per game (typical)', get: (m) => q(m.gameTurns, 0.5), fmt: 0, hint: 'Median total turns across all arenas of a game.' },
    { id: 'turnsP90', label: 'Turns per game (longest 10%)', get: (m) => q(m.gameTurns, 0.9), fmt: 0, hint: '90th percentile: 1 game in 10 runs at least this long.' },
    { id: 'arenas', label: 'Arenas per game', get: (m) => m.gamesArenas / m.games, fmt: 1 },
    { id: 'turnsArena', label: 'Turns per arena', get: (m) => m.arenaTurns / m.arenas, fmt: 1 },
    { id: 'stones', label: 'Arenas reaching the stones', get: (m) => (100 * m.reachStones) / m.arenas, fmt: 1, unit: '%' },
    { id: 'archers', label: 'Arenas reaching the archers', get: (m) => (100 * m.reachArchers) / m.arenas, fmt: 1, unit: '%' },
    { id: 'crowdKills', label: 'Gladiators dropped to 0 by the crowd, per arena', get: (m) => m.crowdKills / m.arenas, fmt: 2 },
    { id: 'noWin', label: 'Arenas with no winner', get: (m) => (100 * m.noWinner) / m.arenas, fmt: 1, unit: '%' },
    { id: 'goldMed', label: 'Gold held (typical)', get: (m) => q(m.gold, 0.5), fmt: 0, hint: 'Denarii left after each Equip Phase, living Gladiators.' },
    { id: 'goldP90', label: 'Gold held (high, top 10%)', get: (m) => q(m.gold, 0.9), fmt: 0 },
    { id: 'goldMax', label: 'Gold held (most ever)', get: (m) => (m.gold.length ? Math.max(...m.gold) : NaN), fmt: 0 },
    { id: 'atk', label: 'Average attack equipped', get: (m) => mean(m.atk), fmt: 0 },
    { id: 'def', label: 'Average armor equipped', get: (m) => mean(m.def), fmt: 0 },
    { id: 'dmg', label: 'Damage per hit (typical)', get: (m) => q(m.dmg, 0.5), fmt: 0 },
    { id: 'buyShare', label: 'Turns spent buying (vs free draw)', get: (m) => (100 * m.buys) / Math.max(1, m.buys + m.draws), fmt: 0, unit: '%', hint: 'Market purchases as a share of buy + draw actions.' },
    { id: 'refresh', label: 'Market refreshes per arena', get: (m) => m.refreshes / m.arenas, fmt: 1 },
    { id: 'bribes', label: 'Bribes per arena', get: (m) => m.bribes / m.arenas, fmt: 1 },
  ];
  const fmtNum = (v, d, unit) => (Number.isFinite(v) ? v.toFixed(d) + (unit || '') : '—');

  // ------------------------------------------------------------ results UI
  let lastRun = null;

  function deltaHTML(a, b, d, unit) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return '<span class="muted">—</span>';
    const diff = b - a;
    const eps = Math.pow(10, -d) / 2;
    if (Math.abs(diff) < eps) return '<span class="muted">same</span>';
    const pct = a !== 0 && unit !== '%' ? ` <span class="muted">(${diff > 0 ? '+' : ''}${((100 * diff) / Math.abs(a)).toFixed(0)}%)</span>` : '';
    return `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ '}${diff.toFixed(d)}${unit === '%' ? ' pts' : ''}</span>${pct}`;
  }

  function histogram(n, A, B) {
    const all = [...(A ? A.gameTurns : []), ...(B ? B.gameTurns : [])];
    if (!all.length) return '';
    const lo = Math.min(...all), hi = Math.max(...all);
    const width = Math.max(5, Math.ceil((hi - lo + 1) / 12 / 5) * 5);
    const start = Math.floor(lo / width) * width;
    const bins = [];
    for (let x = start; x <= hi; x += width) bins.push(x);
    const count = (m) => bins.map((b) => (m ? (100 * m.gameTurns.filter((t) => t >= b && t < b + width).length) / m.gameTurns.length : 0));
    const ca = A ? count(A) : null, cb = B ? count(B) : null;
    const ymax = Math.max(5, ...(ca || []), ...(cb || []));
    const yTop = Math.ceil(ymax / 5) * 5;
    const W = 640, H = 220, padL = 36, padR = 8, padT = 10, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    const bw = iw / bins.length;
    const series = [ca && { v: ca, cls: 's1', name: 'v6.4 rules' }, cb && { v: cb, cls: 's2', name: 'Your variant' }].filter(Boolean);
    const barW = Math.max(3, (bw - 6) / series.length - 2);
    const y = (v) => padT + ih - (v / yTop) * ih;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="hist" role="img" aria-label="Distribution of turns per game, ${n} players">`;
    for (let t = 0; t <= yTop; t += yTop / 5) {
      svg += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)}%</text>`;
    }
    bins.forEach((b, i) => {
      const x0 = padL + i * bw + 3;
      series.forEach((s, k) => {
        const v = s.v[i];
        const h = (v / yTop) * ih;
        const x = x0 + k * (barW + 2);
        if (h > 0) {
          const r = Math.min(4, h / 2, barW / 2);
          const yb = padT + ih;
          svg += `<path class="bar ${s.cls}" d="M${x},${yb} V${yb - h + r} Q${x},${yb - h} ${x + r},${yb - h} H${x + barW - r} Q${x + barW},${yb - h} ${x + barW},${yb - h + r} V${yb} Z"/>`;
        }
        svg += `<rect class="hit" x="${x}" y="${padT}" width="${barW + 2}" height="${ih}" data-tip="${esc(`${s.name}: ${v.toFixed(1)}% of games took ${b}–${b + width - 1} turns`)}"/>`;
      });
      if (i % Math.ceil(bins.length / 8) === 0) svg += `<text class="ax" x="${x0 + (bw - 6) / 2}" y="${H - padB + 16}" text-anchor="middle">${b}</text>`;
    });
    svg += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"/><text class="ax" x="${padL + iw / 2}" y="${H - 4}" text-anchor="middle">Turns per game</text></svg>`;
    return svg;
  }

  function renderResults() {
    const out = $('results');
    if (!lastRun) { out.innerHTML = '<div class="empty-state"><h2>No results yet</h2><p>Change a rule or a card on the left, choose the player counts, then press <b>Run simulation</b>. The lab plays the same AI opponents as the game, using identical dice for the v6.4 rules and your variant, so the differences come from your changes.</p><p class="muted">Tip: 250 games per player count takes about 10–30 seconds.</p></div>'; return; }
    const { results, overrides, games, compare } = lastRun;
    const changes = Object.entries(overrides);
    let html = `<div class="run-head"><div><h2>Results</h2><p class="muted">${games} games per player count · ${changes.length ? changes.map(([k, v]) => `${esc(FIELDS.find((f) => f.id === k).label)} ${DEFAULTS[k]} → <b>${v}</b>`).join(' · ') : 'no changes: both columns use v6.4'}</p></div><button class="btn ghost" id="btn-copy">Copy results</button></div>`;
    for (const r of results) {
      const A = r.A, B = r.B;
      html += `<section class="res"><h3>${r.n} players</h3>`;
      html += `<div class="legend">${A ? '<span><i class="sw s1"></i>v6.4 rules</span>' : ''}${B ? '<span><i class="sw s2"></i>Your variant</span>' : ''}</div>`;
      html += `<div class="chart">${histogram(r.n, A, B)}</div>`;
      html += `<div class="tbl-wrap"><table class="res-t"><thead><tr><th>Measure</th>${A ? '<th class="num">v6.4</th>' : ''}${B ? '<th class="num">Variant</th>' : ''}${A && B ? '<th>Change</th>' : ''}</tr></thead><tbody>`;
      for (const mt of METRICS) {
        const a = A ? mt.get(A) : NaN, b = B ? mt.get(B) : NaN;
        html += `<tr><th scope="row"${mt.hint ? ` title="${esc(mt.hint)}"` : ''}>${mt.label}</th>${A ? `<td class="num">${fmtNum(a, mt.fmt, mt.unit)}</td>` : ''}${B ? `<td class="num">${fmtNum(b, mt.fmt, mt.unit)}</td>` : ''}${A && B ? `<td>${deltaHTML(a, b, mt.fmt, mt.unit)}</td>` : ''}</tr>`;
      }
      html += '</tbody></table></div>';
      // gladiator win rates
      const keys = Object.keys(D.GLADIATORS);
      const wr = (m, k) => (m && m.gladSeen[k] ? (100 * (m.gladWins[k] || 0)) / m.gladSeen[k] : NaN);
      const fair = 100 / r.n;
      html += `<details><summary>Gladiator win rates <span class="muted">(fair share at ${r.n} players: ${fair.toFixed(0)}%)</span></summary><div class="tbl-wrap"><table class="res-t"><thead><tr><th>Gladiator</th>${A ? '<th class="num">v6.4</th>' : ''}${B ? '<th class="num">Variant</th>' : ''}${A && B ? '<th>Change</th>' : ''}</tr></thead><tbody>`;
      for (const k of keys) {
        const a = wr(A, k), b = wr(B, k);
        const ref = Number.isFinite(b) ? b : a;
        const tag = Number.isFinite(ref) ? (ref > fair * 1.4 ? ' <span class="tag hot">strong</span>' : ref < fair * 0.6 ? ' <span class="tag cold">weak</span>' : '') : '';
        html += `<tr><th scope="row">${D.GLADIATORS[k].name}${tag}</th>${A ? `<td class="num">${fmtNum(a, 0, '%')}</td>` : ''}${B ? `<td class="num">${fmtNum(b, 0, '%')}</td>` : ''}${A && B ? `<td>${deltaHTML(a, b, 0, '%')}</td>` : ''}</tr>`;
      }
      html += '</tbody></table></div></details>';
      // weapon usage
      const wkeys = Object.keys(D.CARDS).filter((k) => D.CARDS[k].type === 'weapon');
      const wu = (m, k) => (m ? (100 * (m.weap[k] || 0)) / m.samples : NaN);
      wkeys.sort((x, y) => (wu(B || A, y) || 0) - (wu(B || A, x) || 0));
      html += `<details><summary>Weapon usage <span class="muted">(% of Gladiator-turns with it equipped)</span></summary><div class="tbl-wrap"><table class="res-t"><thead><tr><th>Weapon</th>${A ? '<th class="num">v6.4</th>' : ''}${B ? '<th class="num">Variant</th>' : ''}${A && B ? '<th>Change</th>' : ''}</tr></thead><tbody>`;
      for (const k of wkeys) {
        const a = wu(A, k), b = wu(B, k);
        html += `<tr><th scope="row">${D.CARDS[k].name}</th>${A ? `<td class="num">${fmtNum(a, 1, '%')}</td>` : ''}${B ? `<td class="num">${fmtNum(b, 1, '%')}</td>` : ''}${A && B ? `<td>${deltaHTML(a, b, 1, '%')}</td>` : ''}</tr>`;
      }
      html += '</tbody></table></div></details></section>';
    }
    if (!compare) html += '<p class="muted">Only your variant was run. Tick "Compare with v6.4" to see the differences.</p>';
    out.innerHTML = html;
    $('btn-copy').onclick = copyResults;
  }

  function resultsText() {
    const { results, overrides, games } = lastRun;
    const lines = [`Gladiator balance lab: ${games} games per player count`];
    const ch = Object.entries(overrides);
    lines.push(ch.length ? 'Changes: ' + ch.map(([k, v]) => `${FIELDS.find((f) => f.id === k).label} ${DEFAULTS[k]} -> ${v}`).join('; ') : 'Changes: none');
    for (const r of results) {
      lines.push('', `${r.n} players`, ['Measure', r.A ? 'v6.4' : null, r.B ? 'Variant' : null].filter(Boolean).join(' | '));
      for (const mt of METRICS) lines.push([mt.label, r.A ? fmtNum(mt.get(r.A), mt.fmt, mt.unit) : null, r.B ? fmtNum(mt.get(r.B), mt.fmt, mt.unit) : null].filter((x) => x != null).join(' | '));
    }
    return lines.join('\n');
  }
  function copyResults() {
    const text = resultsText();
    const done = () => toast('Results copied. Paste them into the chat to discuss.');
    try {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text));
    } catch (e) { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    const ta = $('copy-box');
    ta.value = text;
    ta.hidden = false;
    ta.select();
    toast('Select-all is ready: copy the text below the button.');
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2800);
  }

  // tooltips on chart bars
  const tip = $('tip');
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 14);
    tip.style.left = x + 'px';
    tip.style.top = e.clientY + 14 + 'px';
  });

  // ------------------------------------------------------------ run
  $('btn-run').onclick = async () => {
    const counts = [...document.querySelectorAll('input[name=pc]:checked')].map((x) => +x.value);
    if (!counts.length) { toast('Choose at least one player count.'); return; }
    const games = +$('games').value;
    const seed = Math.max(1, Math.floor(+$('seed').value) || 1);
    const compare = $('compare').checked;
    const overrides = { ...variant };
    cancelled = false;
    $('btn-run').hidden = true;
    $('btn-stop').hidden = false;
    $('editor').inert = true;
    const total = counts.length * games * (compare ? 2 : 1);
    let done = 0;
    const bar = $('progress');
    bar.hidden = false;
    const step = (label) => (k) => { bar.querySelector('span').style.width = `${(100 * (done + k)) / total}%`; bar.querySelector('b').textContent = `${label} · ${Math.round((100 * (done + k)) / total)}%`; };
    const results = [];
    const t0 = performance.now();
    for (const n of counts) {
      const r = { n };
      if (compare) { r.A = await runBatch({}, n, games, seed + n, step(`${n} players · v6.4`)); done += games; }
      r.B = await runBatch(overrides, n, games, seed + n, step(`${n} players · variant`)); done += games;
      results.push(r);
      if (cancelled) break;
    }
    $('btn-run').hidden = false;
    $('btn-stop').hidden = true;
    $('editor').inert = false;
    bar.hidden = true;
    if (!results.length || !results[0].B || !results[0].B.games) { toast('Stopped before any games finished.'); return; }
    lastRun = { results: results.filter((r) => r.B && r.B.games), overrides, games, compare };
    renderResults();
    toast(`${cancelled ? 'Stopped early. ' : ''}Finished in ${((performance.now() - t0) / 1000).toFixed(0)} s.`);
  };
  $('btn-stop').onclick = () => { cancelled = true; };

  renderEditor();
  renderResults();
})();
