/* Gladiator v6.3 — browser UI. */
(function () {
  'use strict';
  const { CARDS, GLADIATORS, RULES, ART } = window.GLAD_DATA;
  const { Game } = window.GladiatorEngine;
  const def = (c) => CARDS[c.key];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const state = {
    game: null,
    gen: 0,
    speed: 1,
    viewer: null,
    equipResolve: null,
    renderQueued: false,
    lastHandUids: new Set(),
  };

  // ------------------------------------------------------------ card rendering
  function statLine(d) {
    if (d.type === 'weapon') {
      const atk = d.beast ? `ATK d6×${d.beast}` : `ATK ${d.atk}`;
      const h = d.hands === 2 ? '2-handed' : d.mainOnly ? 'Main hand' : '1-handed';
      return `${atk} · ${h}`;
    }
    if (d.type === 'armor') return `DEF ${d.def} · ${{ off: 'Off-hand', body: 'Body', head: 'Head', arm: 'Arm', legs: 'Legs' }[d.loc]}`;
    if (d.type === 'relic') return 'Relic · no slot';
    return 'Special · single use';
  }
  function chipText(d) {
    if (d.type === 'weapon') return d.beast ? `d6×${d.beast}` : String(d.atk);
    if (d.type === 'armor') return `🛡${d.def}`;
    return '';
  }
  function tooltip(d) {
    return `${d.name} (${d.en}) — ${statLine(d)}. ${d.text}${d.buy ? ` Buy ${d.buy}.` : ' Draw only.'} Sell ${d.sell}.`;
  }
  const TIMING = { aqua: 'ANY TIME', volumen: 'ANY TIME', harena: 'BEFORE ATTACK', furor: 'BEFORE ATTACK', interceptio: 'EQUIP PHASE', fortuna: 'EQUIP PHASE' };
  const LOC = { off: 'OFF HAND', body: 'BODY', head: 'HEAD', arm: 'ARM', legs: 'LEGS' };
  function typeLine(d, key) {
    const leg = d.legendary ? 'LEGENDARY · ' : '';
    if (d.type === 'weapon') return `${leg}WEAPON · ${d.hands === 2 ? 'TWO' : 'ONE'} HANDED`;
    if (d.type === 'armor') return `${leg}ARMOR · ${LOC[d.loc]}`;
    if (d.type === 'relic') return 'LEGENDARY · NO SLOT';
    return `SPECIAL · ${TIMING[key] || ''} · ONE USE`;
  }
  function footRight(d) {
    if (d.type === 'weapon') return d.beast ? `ATK Dx${d.beast}` : `ATK ${d.atk}`;
    if (d.type === 'armor') return `DEF ${d.def}`;
    if (d.type === 'relic') return '—';
    return 'DRAW ONLY';
  }
  function artHTML(key, icon) {
    const src = ART && ART[key];
    return `<div class="c-art">${src ? `<img src="${esc(src)}" alt="">` : `<span>${icon}</span>`}</div>`;
  }
  /** Card face laid out like the v6 print sheets. */
  function faceHTML(o) {
    return `
      <div class="c-type">${o.type}</div>
      <div class="c-title"><span class="c-name">${esc(o.name)}</span>${o.count ? `<span class="c-count">×${o.count}</span>` : ''}</div>
      ${o.sub ? `<div class="c-en">(${esc(o.sub)})</div>` : ''}
      ${artHTML(o.key, o.icon)}
      <div class="c-text">${esc(o.text)}${o.flavor ? `<div class="c-flavor">${esc(o.flavor)}</div>` : ''}</div>
      ${o.footL || o.footR ? `<div class="c-foot"><span>${o.footL || ''}</span><b>${o.footR || ''}</b></div>` : ''}`;
  }
  function cardEl(c, actions, extraClass) {
    const d = def(c);
    const el = document.createElement('div');
    el.className = `card cat-${d.cat}${extraClass ? ' ' + extraClass : ''}`;
    el.title = tooltip(d);
    el.innerHTML = faceHTML({
      type: typeLine(d, c.key), name: d.name, sub: d.en, count: d.count, key: c.key, icon: d.icon, text: d.text,
      footL: `${d.buy ? `BUY ${d.buy} · ` : ''}SELL ${d.sell}${c.locked ? ' · 🔒' : ''}`, footR: footRight(d),
    });
    if (actions && actions.length) {
      const row = document.createElement('div');
      row.className = 'c-actions';
      for (const a of actions) {
        const b = document.createElement('button');
        b.className = `btn small${a.red ? ' red' : ''}${a.ghost ? ' ghost' : ''}`;
        b.textContent = a.label;
        b.disabled = !!a.disabled;
        if (a.title) b.title = a.title;
        b.onclick = a.onClick;
        row.appendChild(b);
      }
      el.appendChild(row);
    }
    return el;
  }
  const FACES = window.GLAD_CARD_FACES || {};
  function gladCardHTML(key) {
    const g = GLADIATORS[key];
    if (FACES[key]) return `<img class="card-face" src="${esc(FACES[key])}" alt="${esc(g.name)} card: ${esc(g.text)} VITA ${g.vita}, dodge ${g.dodge || 'never'}.">`;
    return `<div class="card cat-gladiator">${faceHTML({ type: 'GLADIATOR', name: g.name, count: g.count, key, icon: g.icon, text: g.text, footL: `DODGE ${g.dodge || 'NEVER'}`, footR: `VITA ${g.vita}` })}</div>`;
  }

  // ------------------------------------------------------------ helpers
  function humans() { return state.game ? state.game.players.filter((p) => !p.isAI) : []; }
  function toast(msg, ok) {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast${ok ? ' ok' : ''}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  async function act(fn) {
    const err = await fn();
    if (err) toast(err);
    render();
  }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ------------------------------------------------------------ modal
  function openModal(html, wide) {
    const box = $('modal-box');
    box.className = `modal-box${wide ? ' wide' : ''}`;
    box.innerHTML = html;
    $('modal').classList.remove('hidden');
    return box;
  }
  function closeModal() { $('modal').classList.add('hidden'); $('modal-box').innerHTML = ''; }

  function modalChoice(title, text, options, cards, gladKey) {
    return new Promise((resolve) => {
      const box = openModal(`<h2>${title}</h2><div class="mtext">${text || ''}</div><div class="mcards"></div><div class="mopts"></div>`);
      const mc = box.querySelector('.mcards');
      if (cards && cards.length) for (const c of cards) mc.appendChild(cardEl(c));
      if (gladKey) mc.innerHTML += gladCardHTML(gladKey);
      const mo = box.querySelector('.mopts');
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = `btn${i > 0 ? ' ghost' : ''}`;
        b.innerHTML = o.label;
        b.onclick = () => { closeModal(); resolve(o.value); };
        mo.appendChild(b);
      });
    });
  }

  // ------------------------------------------------------------ io for the engine
  function makeIO(gen) {
    const live = () => gen === state.gen;
    const never = () => new Promise(() => {});
    return {
      log(msg, cls) {
        if (!live()) return;
        const li = document.createElement('li');
        if (cls) li.className = cls;
        li.innerHTML = msg;
        const log = $('log');
        log.appendChild(li);
        log.scrollTop = log.scrollHeight;
        queueRender();
      },
      update() { if (live()) queueRender(); },
      delay(ms) { return live() ? wait(ms * state.speed) : never(); },
      async choose(p, q) {
        if (!live()) return never();
        if (humans().length > 1 && state.viewer !== p) { state.viewer = p; }
        render();
        const v = await modalChoice(esc(q.title), q.text, q.options, q.cards, q.gladKey);
        return live() ? v : never();
      },
      async humanEquip(p) {
        if (!live()) return never();
        if (humans().length > 1 && state.viewer !== p) {
          state.viewer = null;
          render();
          await modalChoice(`${esc(p.name)}, your Equip Phase`, 'Pass the device to this player. Other players should look away from the hand area.', [{ label: "I'm ready", value: true }]);
        }
        state.viewer = p;
        render();
        return new Promise((resolve) => { state.equipResolve = resolve; });
      },
      async showRoll(p, v, why) {
        if (!live()) return never();
        stage(`<div><span class="die rolling${v === 6 ? ' six' : ''}">${v}</span><div class="lbl">${esc(p.name)} rolls</div><div class="why">${esc(why || '')}</div></div>`);
        await wait(750 * state.speed);
      },
      async showFlip(label, heads) {
        if (!live()) return never();
        stage(`<div><span class="coin flipping${heads ? '' : ' tails'}">${heads ? 'HEADS' : 'TAILS'}</span><div class="lbl">Sacred Coin</div><div class="why">${esc(label)}</div></div>`);
        await wait(1200 * state.speed);
      },
      async showCard(kind, d, p) {
        if (!live()) return never();
        if (kind === 'crowd') {
          stage(`<div><div class="card stage-card cat-attack">${faceHTML({ type: 'TURN ' + state.game.turn + ' · ALL LIVING', name: d.name, key: 'crowd', icon: d.icon, text: d.text })}</div><div class="why">The arena turns on its fighters</div></div>`);
          await wait(1100 * state.speed);
          return;
        }
        const key = Object.keys(kind === 'hades' ? window.GLAD_DATA.HADES : window.GLAD_DATA.ATTACK_CARDS).find((k) => (kind === 'hades' ? window.GLAD_DATA.HADES : window.GLAD_DATA.ATTACK_CARDS)[k] === d);
        const type = kind === 'hades' ? `HADES · ${d.kind.toUpperCase()}${d.coin ? ' · COIN FLIP' : ''}` : 'ATTACK';
        stage(`<div><div class="card stage-card cat-${kind}">${faceHTML({ type, name: d.name, key: (kind === 'hades' ? 'hades-' : 'attack-') + key, icon: d.icon, text: d.text, flavor: d.flavor })}</div><div class="why">${esc(p.name)}${kind === 'hades' ? ' · from Hades' : ''}</div></div>`);
        await wait((kind === 'hades' ? 1400 : 700) * state.speed);
      },
      async arenaEnd(game) {
        if (!live()) return never();
        if (!humans().length) { await wait(1500 * state.speed); return; }
        const rows = [...game.players].sort((a, b) => b.laurels - a.laurels)
          .map((p) => `<tr><td>${esc(p.name)}</td><td class="laurels">${laurelHTML(p.laurels, game.laurelsToWin)}</td></tr>`).join('');
        await modalChoice(`Arena ${game.arena} is over`, `<table class="standings">${rows}</table>First to ${game.laurelsToWin} laurels is crowned Champion.`, [{ label: 'Enter the next arena ⚔️', value: true }]);
      },
    };
  }

  function stage(html) { $('stage').innerHTML = html; }

  // ------------------------------------------------------------ rendering
  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => { state.renderQueued = false; render(); });
  }

  function laurelHTML(n, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < n ? '🌿' : '<span class="off">◯</span>';
    return s;
  }

  function render() {
    const g = state.game;
    if (!g) return;
    renderStatus(g);
    renderPlayers(g);
    renderMarket(g);
    renderDecks(g);
    renderHand(g);
  }

  function renderStatus(g) {
    const phase = { setup: 'Setup', equip: 'Equip Phase', attack: 'Attack Phase', arenaEnd: 'Arena over', over: 'Game over' }[g.phase] || '';
    const who = g.active ? ` · <b>${esc(g.active.name)}</b>${g.phase === 'attack' && g.active.glad && !g.active.glad.alive ? ' (Hades)' : ''}` : '';
    $('status').innerHTML = `Arena <b>${g.arena}</b> · Turn <b>${g.turn}</b> · ${phase}${who}${g.turn >= RULES.restlessTurn ? ` · <span style="color:#ffcf5a">${g.turn === RULES.archerTurn ? "🏹 The Emperor's archers fire: −30 VITA" : g.turn === RULES.archerTurn - 1 ? '🪨 Stones −10 VITA · archers fire next turn (−30)' : '🪨 Crowd hurls stones: −10 VITA each turn'}</span>` : g.turn >= RULES.restlessTurn - 2 && g.phase !== 'arenaEnd' ? ` · <span class="dim">Crowd grows restless from turn ${RULES.restlessTurn}</span>` : ''}${g.noDodgePhase ? ' · <span style="color:#ff9d8c">🙌 Hands in the Sand: nobody can dodge</span>' : ''}`;
  }

  function renderPlayers(g) {
    const wrap = $('players');
    wrap.innerHTML = '';
    const mine = g.equipState && !g.equipState.player.isAI && g.equipState.player === state.viewer ? g.equipState.player : null;
    for (const p of g.players) {
      const el = document.createElement('div');
      const gl = p.glad;
      el.className = `pp${g.active === p ? ' active' : ''}${gl && !gl.alive ? ' dead' : ''}`;
      if (!gl) { el.innerHTML = `<div class="pp-name">${esc(p.name)}</div>`; wrap.appendChild(el); continue; }
      const gd = GLADIATORS[gl.key];
      const pct = Math.max(0, gl.vita / gl.max);
      const cls = pct > 0.6 ? 'hi' : pct > 0.3 ? 'mid' : '';
      const badges = [];
      badges.push(`<span class="badge${gl.coinUsed ? ' used' : ''}" title="The Emperor's Favor: the first time your Gladiator reaches 0 VITA, flip the Sacred Coin (Heads: revive with 30 VITA).">🪙 Emperor's Favor</span>`);
      if (gl.key === 'velox') badges.push(`<span class="badge${gl.veloxUsed ? ' used' : ''}">💨 Reroll</span>`);
      if (g.has(p, 'hephaesti')) badges.push(`<span class="badge${gl.hephUsed ? ' used' : ''}">🔨 Negate hit</span>`);
      const db = gl.debuff;
      if (db.roll) badges.push('<span class="badge warn" title="A Familiar Face">Next roll −1</span>');
      if (db.miss) badges.push('<span class="badge warn" title="Stolen Breath">Next attack misses</span>');
      if (db.armorPhase) badges.push(`<span class="badge warn" title="Rotten Straps">Armor −${db.armorPhase}</span>`);
      if (db.dodgePhase) badges.push(`<span class="badge warn" title="Weak Knees">Dodge −${db.dodgePhase}</span>`);
      if (db.noBuy) badges.push('<span class="badge warn" title="Stalls Shut">No buying next phase</span>');
      if (db.haunted) badges.push('<span class="badge warn" title="Haunted Dreams">Haunted next phase</span>');
      if (db.turnedBy) badges.push(`<span class="badge warn" title="Turned Blade">${esc(db.turnedBy.name)} picks next target</span>`);
      const dodge = gl.key === 'bestia' || g.noDodgePhase ? 'never' : Math.max(1, g.ownDodge(p) - (gl.key === 'amazonia' ? 0 : gl.debuff.dodgePhase || 0));
      el.innerHTML = `
        <div class="pp-head"><span class="pp-name">${esc(p.name)}${p.isAI ? '<span class="tag">AI</span>' : ''}</span><span class="laurels" title="${p.laurels} laurels">${laurelHTML(p.laurels, g.laurelsToWin)}</span></div>
        <div class="pp-glad-row">${FACES[gl.key] ? `<button class="glad-thumb" data-face="${gl.key}" style="background-image:url('${esc(FACES[gl.key])}')" title="View the ${gd.name} card" aria-label="View the ${gd.name} card"></button>` : ''}<div class="pp-glad" title="${esc(gd.text)}">${FACES[gl.key] ? '' : gd.icon + ' '}${gd.name} <span class="ab">— ${esc(gd.text)}</span></div></div>
        <div class="vita"><div class="vita-fill ${cls}" style="width:${pct * 100}%"></div><div class="vita-txt">VITA ${gl.vita} / ${gl.max}</div></div>
        <div class="pp-stats"><span>ATK <b>${g.attackText(p)}</b></span><span>DEF <b>${g.totalDef(p)}</b></span><span title="Attack rolls must beat this number">Dodge <b>${dodge}</b></span><span>💰 <b>${p.gold}</b></span><span>✋ <b>${p.hand.length}</b></span></div>
        <div class="badges">${badges.join('')}</div>`;
      const eq = document.createElement('div');
      eq.className = 'equip';
      if (!gl.equipped.length) eq.innerHTML = '<span class="empty">Unarmed: fists (10)</span>';
      for (const c of gl.equipped) {
        const d = def(c);
        const chip = document.createElement('span');
        chip.className = `chip cat-${d.cat}${c.locked ? ' locked' : ''}`;
        chip.title = tooltip(d);
        chip.innerHTML = `${d.icon} ${esc(d.name)} <b>${chipText(d)}</b>`;
        if (mine === p && !c.locked) {
          const un = document.createElement('button');
          un.textContent = '↩';
          un.title = 'Unequip (back to hand)';
          un.onclick = () => act(() => g.actUnequip(p, c.uid));
          const sell = document.createElement('button');
          sell.textContent = `💰${d.sell}`;
          sell.title = `Sell for ${d.sell}`;
          sell.onclick = () => act(() => g.actSell(p, c.uid));
          chip.append(un, sell);
        }
        eq.appendChild(chip);
      }
      el.appendChild(eq);
      wrap.appendChild(el);
    }
  }

  function renderMarket(g) {
    const m = $('market');
    m.innerHTML = '';
    const s = g.equipState;
    const p = s && !s.player.isAI && s.player === state.viewer ? s.player : null;
    for (const c of g.market) {
      const d = def(c);
      const actions = p ? [{
        label: `Buy ${d.buy}`,
        disabled: s.drawn || s.buys >= RULES.maxBuys || p.gold < d.buy,
        title: s.drawn ? 'You drew this phase' : s.buys >= RULES.maxBuys ? 'Max 2 buys' : p.gold < d.buy ? 'Not enough denarii' : '',
        onClick: () => act(() => g.actBuy(p, c.uid)),
      }] : null;
      m.appendChild(cardEl(c, actions));
    }
  }

  function renderDecks(g) {
    const e = g.equipDeck, a = g.attackDeck, h = g.hadesDeck;
    $('deck-equip').innerHTML = `<div class="dt">EQUIPMENT</div><div class="dc">${e ? e.count : 0} cards<br>${e ? e.discard.length : 0} discarded</div>`;
    $('deck-attack').innerHTML = `<div class="dt">ATTACK</div><div class="dc">${a ? a.count : 0} left</div>`;
    $('deck-hades').innerHTML = `<div class="dt">HADES</div><div class="dc">${h ? h.count : 0} left</div>`;
  }

  function renderHand(g) {
    const area = $('hand-area');
    area.innerHTML = '';
    const hs = humans();
    let p = state.viewer;
    if (!p && hs.length === 1) p = hs[0];
    if (!p) {
      area.innerHTML = hs.length ? '<div class="hand-sub">Hands are hidden until the next human player takes over.</div>' : '<div class="hand-sub">Spectating an all-AI game. Sit back and enjoy the games!</div>';
      return;
    }
    const s = g.equipState;
    const mine = s && s.player === p;
    const head = document.createElement('div');
    head.className = 'hand-head';
    if (mine) {
      head.innerHTML = `<h3 style="margin:0">${esc(p.name)} — Equip Phase</h3><span class="gold">💰 ${p.gold} denarii</span>
        <div class="steps">
          <span class="step done">1 Income +${RULES.income}</span>
          <span class="step${s.refreshed ? ' done' : ''}">3 Refresh (opt.)</span>
          <span class="step${s.drawn || s.buys ? ' done' : ''}">4 ${s.drawn ? 'Drew 1' : s.buys ? `Bought ${s.buys}/${RULES.maxBuys}` : 'Draw 1 or buy ≤2'}</span>
          <span class="step">5 Equip</span>
        </div><span class="spacer"></span>`;
      const bDraw = mkBtn('Draw free card', () => act(() => g.actDraw(p)), s.drawn || s.buys > 0, 'Draw 1 card for free from the Equipment deck (instead of buying)');
      const bRef = mkBtn(`Refresh Market (${RULES.refreshCost})`, () => act(() => g.actRefresh(p)), s.refreshed || s.drawn || s.buys > 0 || p.gold < RULES.refreshCost, 'Once per phase, before drawing or buying', true);
      const bEnd = mkBtn('End Equip Phase ✔', async () => {
        if (!s.drawn && !s.buys) {
          const ok = await modalChoice('End your Equip Phase?', "You haven't drawn or bought a card this phase.", [{ label: 'Go back', value: false }, { label: 'End anyway', value: true }]);
          if (!ok) return;
        }
        const r = state.equipResolve; state.equipResolve = null; r && r();
      }, false, 'Lock in your equipment until your next Equip Phase');
      head.append(bRef, bDraw, bEnd);
    } else {
      const waiting = g.active && g.phase === 'equip' ? `Waiting for ${esc(g.active.name)}…` : g.phase === 'attack' ? 'Equipment is locked during the Attack Phase.' : '';
      head.innerHTML = `<h3 style="margin:0">${esc(p.name)}'s hand</h3><span class="gold">💰 ${p.gold} denarii</span><span class="hand-sub">${waiting}</span>`;
    }
    area.appendChild(head);

    // Equipped gear, shown as full cards like the hand.
    const eqLabel = document.createElement('div');
    eqLabel.className = 'hand-label';
    const total = p.glad ? p.glad.equipped.length : 0;
    eqLabel.textContent = `Equipped on ${p.glad ? GLADIATORS[p.glad.key].name : 'your Gladiator'} (${total})${mine ? '' : ' — locked until your next Equip Phase'}`;
    area.appendChild(eqLabel);
    const eqRow = document.createElement('div');
    eqRow.className = 'hand-row';
    if (!total) eqRow.innerHTML = `<span class="empty">Nothing equipped: your Gladiator fights with fists (${RULES.fists}).</span>`;
    for (const c of p.glad ? p.glad.equipped : []) {
      const d = def(c);
      const actions = [];
      if (mine) {
        if (c.locked) {
          actions.push({ label: '🔒 Locked', disabled: true, ghost: true, title: "Retiarius's Rete cannot be unequipped or sold" });
        } else {
          actions.push({ label: 'Unequip', disabled: s.haunted, title: s.haunted ? 'Haunted Dreams: you cannot change your gear this phase' : 'Move back to your hand', onClick: () => act(() => g.actUnequip(p, c.uid)) });
          actions.push({ label: `Sell ${d.sell}`, ghost: true, onClick: () => act(() => g.actSell(p, c.uid)) });
        }
      }
      eqRow.appendChild(cardEl(c, actions, state.lastHandUids.has(c.uid) ? 'equipped' : 'equipped new'));
    }
    area.appendChild(eqRow);

    const label = document.createElement('div');
    label.className = 'hand-label';
    label.textContent = `Hand (${p.hand.length}) — not equipped`;
    area.appendChild(label);
    const row = document.createElement('div');
    row.className = 'hand-row';
    if (!p.hand.length) row.innerHTML = '<span class="empty">No cards in hand.</span>';
    const seen = new Set();
    for (const c of p.hand) {
      seen.add(c.uid);
      const d = def(c);
      const actions = [];
      if (mine) {
        if (window.GladiatorEngine.isGear(d)) actions.push({ label: 'Equip', onClick: () => act(() => g.actEquip(p, c.uid)) });
        else if (d.heal) actions.push({ label: 'Use', disabled: p.glad.vita >= p.glad.max || !p.glad.alive, onClick: () => act(() => g.actUse(p, c.uid)) });
        else if (c.key === 'interceptio' || c.key === 'fortuna') actions.push({ label: 'Play', onClick: () => act(() => g.actUse(p, c.uid)) });
        actions.push({ label: `Sell ${d.sell}`, ghost: true, onClick: () => act(() => g.actSell(p, c.uid)) });
      } else if (d.heal && p.glad && p.glad.alive && p.glad.vita < p.glad.max && g.phase !== 'over') {
        // "Any time your VITA is above 0"
        actions.push({ label: 'Use now', onClick: () => { g.heal(p, c.uid); render(); } });
      }
      row.appendChild(cardEl(c, actions, state.lastHandUids.has(c.uid) ? '' : 'new'));
    }
    for (const c of p.glad ? p.glad.equipped : []) seen.add(c.uid);
    state.lastHandUids = seen;
    area.appendChild(row);
    if (mine) {
      const tip = document.createElement('div');
      tip.className = 'hand-sub';
      tip.style.marginTop = '10px';
      tip.innerHTML = 'Tip: <b>Harena</b> and <b>Furor</b> are offered right before you roll an attack. Equipping a card that clashes with your gear swaps the old piece back to your hand. Hover any card for its full text.';
      area.appendChild(tip);
    }
  }

  function mkBtn(label, onClick, disabled, title, ghost) {
    const b = document.createElement('button');
    b.className = `btn${ghost ? ' ghost' : ''}`;
    b.textContent = label;
    b.disabled = !!disabled;
    if (title) b.title = title;
    b.onclick = onClick;
    return b;
  }

  // ------------------------------------------------------------ setup / rules
  const AI_NAMES = ['Spartacus', 'Crixus', 'Flamma', 'Priscus', 'Verus', 'Carpophorus', 'Tetraites'];

  function showSetup() {
    let n = 4;
    const box = openModal(`
      <h2>⚔️ Gladiator</h2>
      <div class="mtext">Command your Gladiator, equip weapons and armor, and be the last one standing. Win <b>3 arenas</b> to be crowned Champion.</div>
      <div class="mtext"><label>Players <select id="su-n">${[2, 3, 4, 5, 6].map((k) => `<option ${k === n ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        &nbsp; <label>Laurels to win <select id="su-l"><option value="3" selected>3 (standard)</option><option value="2">2 (shorter)</option><option value="1">1 (single arena)</option></select></label></div>
      <div id="su-rows"></div>
      <div class="mopts" style="flex-direction:row;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn" id="su-go">Enter the arena</button>
        <button class="btn ghost" id="su-rules">Read the rules</button>
      </div>`);
    const rows = box.querySelector('#su-rows');
    const prev = [];
    const draw = () => {
      for (let i = 0; i < rows.children.length; i++) {
        prev[i] = { name: rows.children[i].querySelector('input').value, ai: rows.children[i].querySelector('select').value === 'ai' };
      }
      rows.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const p = prev[i] || { name: i === 0 ? 'Player 1' : AI_NAMES[i - 1], ai: i !== 0 };
        const r = document.createElement('div');
        r.className = 'setup-row';
        r.innerHTML = `<span class="n">${i + 1}</span><input type="text" maxlength="16" value="${esc(p.name)}"><select><option value="human" ${!p.ai ? 'selected' : ''}>Human</option><option value="ai" ${p.ai ? 'selected' : ''}>Computer</option></select>`;
        rows.appendChild(r);
      }
    };
    draw();
    box.querySelector('#su-n').onchange = (e) => { n = +e.target.value; draw(); };
    box.querySelector('#su-rules').onclick = () => showRules(showSetup);
    box.querySelector('#su-go').onclick = () => {
      const players = [...rows.children].map((r, i) => ({
        name: r.querySelector('input').value.trim() || `Player ${i + 1}`,
        ai: r.querySelector('select').value === 'ai',
      }));
      const laurels = +box.querySelector('#su-l').value;
      closeModal();
      startGame(players, laurels);
    };
  }

  function showRules(back) {
    const box = openModal(`
      <div class="rules">
      <h2>Rules of the Arena (v6.3)</h2>
      <p><b>Goal.</b> Be the last Gladiator standing to win an arena and earn a laurel. The first player to 3 laurels is Champion.</p>
      <h4>Each turn</h4>
      <p><b>1. Equip Phase</b> (each player in turn order): collect <b>${RULES.income} denarii</b>; sell any cards for their printed sell value (50%); optionally pay <b>20</b> to refresh the 3-card Market (before drawing or buying); then <b>draw 1 free card OR buy up to 2</b> from the Market; finally arrange your equipment. It is locked until your next Equip Phase.</p>
      <p><b>2. Attack Phase</b> (turn order): living Gladiators draw an Attack card (Left / Right / Your Choice / Pass) and attack. In a 2-player game there are no Attack cards: you always attack each other. Dead Gladiators draw a Hades card instead.</p>
      <h4>Attacking</h4>
      <p>Roll a die. <b>Higher than the target's dodge = hit.</b> Damage = total weapon attack − target's armor (minimum 5, rounded up to 5). A <b>6 is an auto-hit</b> that ignores armor. Unarmed Gladiators punch for 10. Beasts (Leo, Ursus, Canis, Cerberus) roll a die for damage. Dodge is always between 1 and 4.</p>
      <h4>The Crowd Grows Restless</h4>
      <p>The crowd is bored and starts hurling stones into the arena. Starting on turn 11, at the start of each turn, every living Gladiator loses 10 VITA. This ignores armor and cannot trigger Furor Mortis. The Sacred Coin flip applies as usual. If the stones eliminate all remaining Gladiators at once, the Gladiator with the most VITA before the stones wins the arena. If still tied, no one earns a laurel.</p>
      <p><b>The Emperor's Archers:</b> on turn 15 the Emperor loses patience and orders his archers to fire: every living Gladiator loses 30 VITA instead of 10 that turn. The stones continue after that (10 VITA per turn).</p>
      <p><b>Furor Mortis:</b> if a final attack eliminates the last Gladiator standing, that Gladiator still wins the arena: they outlived their opponent. Otherwise, if no Gladiator is left standing, no one earns a laurel.</p>
      <h4>Death</h4>
      <p><b>The Emperor's Favor:</b> the first time a Gladiator reaches 0 VITA, flip the Sacred Coin. Heads: revived with 30 VITA. Tails: eliminated. Reaching 0 a second time is death.</p>
      <p><b>Furor Mortis:</b> when eliminated by an attack, flip again. Heads: one final attack on the killer. Eliminated players meddle from <b>Hades</b> each Attack Phase.</p>
      <h4>Gladiators</h4>
      <table><tr><th>Gladiator</th><th>VITA</th><th>Dodge</th><th>Special</th></tr>
      ${Object.values(GLADIATORS).map((g) => `<tr><td>${g.icon} ${g.name}</td><td>${g.vita}</td><td>${g.dodge || 'never'}</td><td>${esc(g.text)}</td></tr>`).join('')}</table>
      <h4>Equipment</h4>
      <p>Two weapon slots (main and off-hand). Two-handed weapons use both; shields use the off-hand. One armor piece per location. Specials and Legendaries are draw-only (never in the Market), and you may carry only 1 Legendary equipped.</p>
      <table><tr><th>Card</th><th>Stats</th><th>Buy/Sell</th><th>Effect</th></tr>
      ${Object.values(CARDS).map((d) => `<tr><td>${d.icon} ${d.name}</td><td>${statLine(d)}</td><td>${d.buy || '—'}/${d.sell}</td><td>${esc(d.text)}</td></tr>`).join('')}</table>
      <h4>Notes on this digital edition</h4>
      <p>Card counts and texts follow the v6 card sheets (Attack deck: 9 Left, 9 Right, 6 Your Choice, 6 Pass; 30 unique Hades cards). Where the rules leave details open, this version assumes: armor-piercing and Clava effects apply to the attack as a whole; a Gladiator whose only weapon is a Rete still punches for 10; "Left" is the next seat clockwise (skipping the dead); Haunted Dreams also blocks unequipping and Fortuna.</p>
      <h4>Hades deck</h4>
      <table><tr><th>Card</th><th>Type</th><th>Effect</th></tr>
      ${Object.values(window.GLAD_DATA.HADES).filter((h) => h.kind !== 'watch').map((h) => `<tr><td>${h.icon} ${h.name}</td><td>${h.kind}</td><td>${esc(h.text)}</td></tr>`).join('')}
      <tr><td>👁️ 10 Watch cards</td><td>watch</td><td>No effect.</td></tr></table>
      </div>
      <div class="mopts" style="margin-top:14px"><button class="btn" id="rules-close">Close</button></div>`, true);
    box.querySelector('#rules-close').onclick = () => { closeModal(); if (back) back(); };
  }

  // ------------------------------------------------------------ game start
  function startGame(players, laurelsToWin) {
    state.gen += 1;
    state.viewer = null;
    state.equipResolve = null;
    state.lastHandUids = new Set();
    $('log').innerHTML = '';
    stage('<div class="stage-inner">The crowd roars…</div>');
    const io = makeIO(state.gen);
    const g = new Game({ players, laurelsToWin: laurelsToWin || 3 }, io);
    state.game = g;
    const gen = state.gen;
    render();
    g.run().then((champ) => {
      if (gen !== state.gen) return;
      render();
      modalChoice('🏆 Champion of the Arena', `<b>${esc(champ.name)}</b> has won ${g.laurelsToWin} arenas and is crowned Champion!`, [{ label: 'New game', value: true }]).then(showSetup);
    }).catch((e) => { console.error(e); toast('Something went wrong: ' + e.message); });
  }

  function showFace(key) {
    if (!$('modal').classList.contains('hidden')) return; // never cover a decision the game is waiting on
    const box = openModal(`<div class="face-view">${gladCardHTML(key)}</div><div class="mopts"><button class="btn" id="face-close">Close</button></div>`);
    box.classList.add('face-box');
    box.querySelector('#face-close').onclick = closeModal;
  }
  $('players').addEventListener('click', (e) => {
    const t = e.target.closest('[data-face]');
    if (t) showFace(t.dataset.face);
  });

  // ------------------------------------------------------------ wire up
  $('speed').onchange = (e) => { state.speed = +e.target.value; };
  $('btn-rules').onclick = () => {
    if (!$('modal').classList.contains('hidden')) return;
    showRules();
  };
  $('btn-new').onclick = () => {
    if (!$('modal').classList.contains('hidden')) return;
    if (state.game && state.game.phase !== 'over') {
      modalChoice('Abandon the current game?', 'The current game will be lost.', [{ label: 'Keep playing', value: false }, { label: 'Start a new game', value: true }]).then((ok) => { if (ok) showSetup(); });
      return;
    }
    showSetup();
  };
  showSetup();
})();
