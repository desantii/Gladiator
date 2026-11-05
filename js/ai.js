/* Gladiator v6.1 — computer opponents. Simple heuristics, no cheating (it never looks at hidden hands or decks). */
(function (root) {
  'use strict';
  const { CARDS, GLADIATORS, RULES } = root.GLAD_DATA;
  const def = (c) => CARDS[c.key];

  function avgAtk(d) {
    if (d.beast) return 3.5 * d.beast;
    return d.atk || 0;
  }

  /** Rough worth of a loadout for gladiator key `gkey`. */
  function score(gkey, items) {
    const ds = items.map(def);
    const ws = ds.filter((d) => d.type === 'weapon');
    let atk = ws.reduce((s, d) => s + avgAtk(d), 0);
    if (!ws.some((d) => avgAtk(d) > 0)) atk += RULES.fists;
    if (gkey === 'bestia') atk += 10;
    let bonus = 0;
    for (const d of ws) {
      if (d.pierce) bonus += d.pierce * 0.6;
      if (d.halfArmor) bonus += 12;
      if (d.ignoreArmor) bonus += avgAtk(d) * 0.35;
      if (d.multi) atk *= 1.6;
      if (d.extra) atk *= 1.3;
      if (d.autoOn) atk *= 1.12;
      if (d.name === 'Flagrum') bonus += 4;
    }
    const red = ws.reduce((s, d) => s + (d.dodgeMod || 0), 0);
    const oppDodge = Math.max(1, 2 - red); // typical opponent dodge
    const hitP = (6 - oppDodge) / 6;
    let defense = 0;
    for (const d of ds) {
      if (d.type === 'armor') defense += d.def * 0.9 + (d.autoReduce || 0) * 0.3 + (d.negate ? 25 : 0);
      if (d.dodgeBonus && gkey !== 'bestia') defense += 28;
    }
    return atk * hitP + bonus + defense;
  }

  /** Best legal loadout from everything the player owns. */
  function bestLoadout(game, p, extra) {
    const E = root.GladiatorEngine;
    const gkey = p.glad.key;
    const locked = p.glad.equipped.filter((c) => c.locked);
    const owned = [...p.hand, ...p.glad.equipped, ...(extra ? [extra] : [])].filter((c) => !c.locked && E.isGear(def(c)));
    const legs = owned.filter((c) => def(c).legendary);
    let best = { items: locked.slice(), score: score(gkey, locked) };
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
          for (const loc of ['head', 'body', 'arm', 'legs']) {
            const opts = pool.filter((c) => def(c).loc === loc).sort((x, y) => def(y).def - def(x).def + (def(y).negate ? 30 : 0) - (def(x).negate ? 30 : 0));
            for (const o of opts) {
              if (!E.loadoutError(gkey, [...items, o])) { items = [...items, o]; break; }
            }
          }
          const s = score(gkey, items);
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
          const eff = g - d.buy * 0.12;
          if (g > 6 && eff > gain) { gain = eff; pick = c; }
        }
        return pick;
      };
      let pick = tryBuy();
      if (!pick && p.gold >= 70 && game.rng() < 0.4) {
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
