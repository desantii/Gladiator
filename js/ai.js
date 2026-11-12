/* Gladiator v6.4 — computer opponents. Simple heuristics, no cheating (it never looks at hidden hands or decks). */
(function (root) {
  'use strict';
  const { CARDS, GLADIATORS, RULES } = root.GLAD_DATA;
  const def = (c) => CARDS[c.key];

  function avgAtk(d) {
    if (d.beast) return 3.5 * d.beast;
    return d.atk || 0;
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /** Expected damage of one attack by (aKey, aItems) on (tKey, tItems). Uses only public info. */
  function expAttack(aKey, aItems, tKey, tItems) {
    const ws = aItems.map(def).filter((d) => d.type === 'weapon');
    const td = tItems.map(def);
    let normal = 0, ignore = 0, half = false, ursus = false, hasta = false, red = 0;
    const skip = new Set();
    for (const w of ws) {
      const v = w.beast ? 3.5 * w.beast : w.atk;
      if (w.ignoreArmor) ignore += v; else normal += v;
      for (const l of w.ignoreLocs || []) skip.add(l);
      if (w.halfArmor) half = true;
      if (w.autoReduceOwn) ursus = true;
      if (w.autoOn) hasta = true;
      if (w.dodgeMod && !(w.isRete && td.some((d) => d.ignoresRete))) red += w.dodgeMod;
    }
    if (ws.every((w) => !w.beast && !w.atk)) normal += RULES.fists;
    if (aKey === 'bestia') normal += 10;
    const armor = td.reduce((s, d) => s + (d.type === 'armor' && !skip.has(d.loc) ? d.def : 0), 0);
    let eff = armor;
    if (half) eff = Math.ceil(eff / 10) * 5;
    const regular = Math.max(5, normal - eff + ignore);
    const autoRed = td.reduce((s, d) => s + (skip.has(d.loc) ? 0 : d.autoReduce || 0), 0) + (ursus ? 10 : 0);
    const auto = Math.max(5, normal + ignore - autoRed);
    let dodge = 0;
    if (tKey !== 'bestia') {
      dodge = clamp(GLADIATORS[tKey].dodge + (td.some((d) => d.dodgeBonus) ? 2 : 0), 1, 4);
      if (tKey !== 'amazonia') dodge = clamp(dodge - red, 1, 4);
    }
    const autoOn = hasta ? 5 : 6;
    const pAuto = (7 - autoOn) / 6;
    const pReg = Math.max(0, autoOn - 1 - dodge) / 6;
    let e = pAuto * auto + pReg * regular;
    if (ws.some((w) => w.extra)) e *= 1 + (pAuto + pReg) * 0.8;
    if (ws.some((w) => w.name === 'Flagrum')) e += 3;
    if (td.some((d) => d.negate)) e *= 0.9;
    return e;
  }

  const DUMMY = [{ key: 'vulgaris', items: [{ key: 'gladius' }, { key: 'subarmalis' }, { key: 'cassis' }] }];

  /** Worth of a loadout for p: expected damage dealt to the living opponents minus expected damage taken from them. */
  function score(game, p, items) {
    let opps = game.living().filter((q) => q !== p).map((q) => ({ key: q.glad.key, items: q.glad.equipped }));
    if (!opps.length) opps = DUMMY;
    let dealt = 0, taken = 0;
    for (const o of opps) {
      dealt += expAttack(p.glad.key, items, o.key, o.items);
      taken += expAttack(o.key, o.items.length ? o.items : DUMMY[0].items, p.glad.key, items);
    }
    dealt /= opps.length;
    taken /= opps.length;
    const ds = items.map(def);
    if (ds.some((d) => d.multi) && opps.length >= 2) dealt *= 1.8;
    return dealt * 1.1 - taken;
  }

  /** Best legal loadout from everything the player owns. */
  function bestLoadout(game, p, extra) {
    const E = root.GladiatorEngine;
    const gkey = p.glad.key;
    const locked = p.glad.equipped.filter((c) => c.locked);
    const owned = [...p.hand, ...p.glad.equipped, ...(extra ? [extra] : [])].filter((c) => !c.locked && E.isGear(def(c)));
    const legs = owned.filter((c) => def(c).legendary);
    let best = { items: locked.slice(), score: score(game, p, locked) };
    for (const leg of [null, ...legs]) {
      const pool = owned.filter((c) => !def(c).legendary || c === leg);
      const weapons = pool.filter((c) => def(c).type === 'weapon');
      const shields = pool.filter((c) => def(c).shield);
      const relics = pool.filter((c) => def(c).type === 'relic');
      const combos = [[]];
      for (let i = 0; i < weapons.length; i++) {
        combos.push([weapons[i]]);
        for (let j = i + 1; j < weapons.length; j++) combos.push([weapons[i], weapons[j]]);
      }
      for (const combo of combos) {
        for (const sh of [null, ...shields]) {
          let items = [...locked, ...combo, ...(sh ? [sh] : []), ...relics];
          if (E.loadoutError(gkey, items)) continue;
          let cur = score(game, p, items);
          for (const loc of ['head', 'body', 'arm', 'legs']) {
            let pick = null;
            for (const o of pool.filter((c) => def(c).loc === loc)) {
              const next = [...items, o];
              if (E.loadoutError(gkey, next)) continue;
              const sc = score(game, p, next);
              if (sc > cur) { cur = sc; pick = o; }
            }
            if (pick) items = [...items, pick];
          }
          const s = cur;
          if (s > best.score) best = { items, score: s };
        }
      }
    }
    return best;
  }

  function cardValue(game, p, c) {
    const d = def(c);
    if (d.heal) return 25 + (p.glad && p.glad.vita < p.glad.max * 0.6 ? 20 : 0);
    if (d.cat === 'special') return 18;
    if (!p.glad) return d.sell || 0;
    const base = bestLoadout(game, p).score;
    const withIt = bestLoadout(game, p, c).score;
    return withIt - base + (d.sell || 0) * 0.2;
  }

  const AI = {
    score,
    bestLoadout,

    wantsRedraw(game, p) {
      const g = GLADIATORS[p.glad.key];
      return p.glad.key === 'debilis' || (g.vita <= 70 && game.rng() < 0.3);
    },

    async equipPhase(game, p) {
      const pause = () => game.delay(250);
      // 1. Heal, Fortuna, Interceptio
      for (const c of [...p.hand]) {
        const d = def(c);
        if (d.heal && p.glad.vita <= p.glad.max - d.heal) { game.heal(p, c.uid); await pause(); }
      }
      for (const c of [...p.hand]) {
        if (c.key === 'fortuna') { await game.actUse(p, c.uid); await pause(); }
      }
      for (const c of [...p.hand]) {
        if (c.key === 'interceptio' && game.interceptTargets(p).length) { await game.actUse(p, c.uid); await pause(); }
      }

      // 2. Sell gear that isn't part of the best loadout (and isn't worth holding).
      const best0 = bestLoadout(game, p);
      for (const c of [...p.hand]) {
        const d = def(c);
        if (root.GladiatorEngine.isGear(d) && !best0.items.includes(c)) { game.actSell(p, c.uid); }
      }

      // 3. Buy up to 2 upgrades, or draw a free card.
      const tryBuy = () => {
        const base = bestLoadout(game, p).score;
        let pick = null, gain = 0;
        for (const c of game.market) {
          const d = def(c);
          if (d.buy > p.gold) continue;
          const g = bestLoadout(game, p, c).score - base;
          const eff = g - d.buy * 0.01;
          if (g > 0.75 && eff > gain) { gain = eff; pick = c; }
        }
        return pick;
      };
      const st = game.equipState;
      if (st.haunted) {
        game.log(`${p.name} cannot bring themselves to touch their gear.`, 'dim');
        await pause();
        return;
      }
      let pick = st.noBuy ? null : tryBuy();
      if (!pick && !st.noBuy && p.gold >= 60) {
        if (!game.actRefresh(p)) { await pause(); pick = tryBuy(); }
      }
      if (pick) {
        game.actBuy(p, pick.uid);
        await pause();
        const second = tryBuy();
        if (second) { game.actBuy(p, second.uid); await pause(); }
      } else {
        game.actDraw(p);
        await pause();
        const drawn = p.hand[p.hand.length - 1];
        if (drawn && drawn.key === 'fortuna') { await game.actUse(p, drawn.uid); await pause(); }
        if (drawn && def(drawn).heal && p.glad.vita <= p.glad.max - def(drawn).heal) game.heal(p, drawn.uid);
      }

      // 4. Equip the best loadout.
      const best = bestLoadout(game, p);
      game.setLoadout(p, best.items);
      const names = p.glad.equipped.map((c) => def(c).name);
      game.log(`${p.name} equips: ${names.length ? names.join(', ') : 'nothing (fists)'}.`, 'dim');
      await pause();
    },

    /** A shade in Hades picks a living Gladiator to torment: the leader, then the healthiest. */
    pickHadesTarget(game, p, cands) {
      let best = cands[0], bs = -Infinity;
      for (const c of cands) {
        const s = c.laurels * 100 + c.glad.vita + c.gold * 0.3;
        if (s > bs) { bs = s; best = c; }
      }
      return best;
    },

    pickLoseEquipped(game, p, pool) {
      let bi = 0, bs = -Infinity;
      pool.forEach((c, i) => {
        const rest = p.glad.equipped.filter((x) => x !== c);
        const s = score(game, p, rest);
        if (s > bs) { bs = s; bi = i; }
      });
      return bi;
    },

    /** Bribe the Lanista when the chosen target is clearly better than a random card: a likely kill, or spare gold. */
    wantsBribe(game, p, others) {
      const t = AI.pickTarget(game, p, others);
      const dmg = expAttack(p.glad.key, p.glad.equipped, t.glad.key, t.glad.equipped);
      const left = game.neighbor(p, +1), right = game.neighbor(p, -1);
      const randomIsFine = t === left && t === right;
      if (randomIsFine) return false;
      if (t.glad.vita <= dmg * 1.5) return true;          // good chance to finish them
      if (t.laurels >= 2 && p.gold >= 50) return true;    // stop the leader
      return p.gold >= 90;                                // nothing better to spend on
    },

    pickTarget(game, p, cands) {
      // Prefer someone we can finish, else the most dangerous (most laurels), else lowest VITA.
      let best = cands[0], bs = -Infinity;
      for (const c of cands) {
        const dodge = game.dodgeVs(c, p, false);
        const s = -c.glad.vita + c.laurels * 25 + (6 - dodge) * 8 - game.totalDef(c) * 0.4;
        if (s > bs) { bs = s; best = c; }
      }
      return best;
    },

    preAttack(game, p, targets, hasHarena, hasFuror) {
      const t = targets[0];
      const dodge = game.dodgeVs(t, p, false);
      const useH = hasHarena && dodge >= 2 && t.glad.key !== 'bestia' && t.glad.key !== 'amazonia';
      const useF = hasFuror && (dodge >= 3 || t.glad.vita <= 40 || game.totalDef(t) >= 50);
      if (useH && useF) return 'both';
      if (useH) return 'harena';
      if (useF) return 'furor';
      return 'none';
    },

    useVelox(game, t, a, r) {
      return r.auto || t.glad.vita <= t.glad.max * 0.6;
    },

    useHephaesti(game, t, dmg) {
      return dmg >= 35 || dmg >= t.glad.vita;
    },

    pickHeal(game, p, heals) {
      if (p.glad.vita > 45) return 0;
      const h = heals.sort((a, b) => def(b).heal - def(a).heal)[0];
      return h.uid;
    },

    pickDiscard(game, p) {
      let bi = 0, bv = Infinity;
      p.hand.forEach((c, i) => { const v = cardValue(game, p, c); if (v < bv) { bv = v; bi = i; } });
      return bi;
    },

    pickBest(game, p, cards) {
      let bi = 0, bv = -Infinity;
      cards.forEach((c, i) => { const v = cardValue(game, p, c); if (v > bv) { bv = v; bi = i; } });
      return bi;
    },

    pickInterceptio(game, p, targets) {
      let bi = -1, bv = 0;
      targets.forEach((t, i) => {
        const d = def(t.card);
        const v = (d.buy || 60) + t.owner.laurels * 20 + (d.legendary ? 40 : 0);
        if (v > bv) { bv = v; bi = i; }
      });
      return bi;
    },
  };

  root.GLAD_AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
