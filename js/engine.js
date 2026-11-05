/* Gladiator v6.1 — rules engine. No DOM: talks to the outside through an `io` object:
 *   io.log(msg, cls)                 append to game log
 *   io.update()                      state changed, re-render
 *   io.delay(ms)                     pacing (Promise)
 *   io.choose(player, question)      human decision → Promise<value>
 *   io.humanEquip(player)            Promise resolved when the human ends their Equip Phase
 *   io.showRoll(player, value, why)  Promise (dice animation)
 *   io.showFlip(label, heads)        Promise (coin animation)
 *   io.showCard(kind, def, player)   Promise (attack / hades card reveal)
 */
(function (root) {
  'use strict';
  const { GLADIATORS, CARDS, ATTACK_CARDS, HADES, RULES } = root.GLAD_DATA;

  const ceil5 = (x) => Math.ceil(x / 5) * 5;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let UID = 1;

  class Deck {
    constructor(defs, rng, name) {
      this.name = name;
      this.rng = rng;
      this.cards = [];
      this.discard = [];
      for (const key of Object.keys(defs)) for (let i = 0; i < defs[key].count; i++) this.cards.push({ uid: UID++, key });
      this.shuffle();
    }
    shuffle() {
      const a = this.cards;
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
    }
    draw() {
      if (!this.cards.length) {
        if (!this.discard.length) return null;
        this.cards = this.discard;
        this.discard = [];
        this.shuffle();
      }
      return this.cards.pop();
    }
    toDiscard(c) { if (c) this.discard.push(c); }
    get count() { return this.cards.length; }
  }

  const def = (c) => CARDS[c.key];
  const isDrawOnly = (d) => d.cat === 'special' || d.cat === 'legendary';
  const isGear = (d) => d.type === 'weapon' || d.type === 'armor' || d.type === 'relic';

  /** Returns an error string if `items` is not a legal loadout for gladiator `gkey`, otherwise null. */
  function loadoutError(gkey, items) {
    const ds = items.map(def);
    if (ds.some((d) => !isGear(d))) return 'Only weapons, armor and relics can be equipped.';
    const weapons = ds.filter((d) => d.type === 'weapon');
    const shields = ds.filter((d) => d.shield);
    const hands = weapons.reduce((s, d) => s + d.hands, 0) + shields.length;
    if (hands > 2) return 'Not enough hands: you have a main hand and an off-hand only.';
    if (weapons.filter((d) => d.mainOnly).length > 1) return 'Only one main-hand-only weapon can be wielded.';
    if (weapons.some((d) => d.name === 'Gladius') && weapons.some((d) => d.name === 'Tridens')) return 'A Gladius cannot be paired with a Tridens.';
    if (weapons.filter((d) => d.isRete).length > 1) return 'Maximum 1 Rete per Gladiator.';
    const locs = ds.filter((d) => d.type === 'armor' && d.loc !== 'off').map((d) => d.loc);
    if (new Set(locs).size !== locs.length) return 'Only one armor piece per location (head, body, arm, legs).';
    if (ds.filter((d) => d.legendary).length > 1) return 'A Gladiator may carry only 1 Legendary item.';
    if (gkey === 'invictus' && ds.some((d) => d.shield || d.helmet)) return 'Invictus cannot use shields or helmets.';
    if (gkey === 'amazonia' && weapons.some((d) => d.hands === 2)) return 'Amazonia cannot use two-handed weapons.';
    return null;
  }

  class Game {
    constructor(cfg, io, rng) {
      this.io = io;
      this.rng = rng || Math.random;
      this.players = cfg.players.map((p, i) => ({ id: i, name: p.name, isAI: !!p.ai, hand: [], gold: 0, laurels: 0, glad: null }));
      this.laurelsToWin = cfg.laurelsToWin || RULES.laurelsToWin;
      this.maxTurns = cfg.maxTurns || 150;
      this.arena = 0;
      this.turn = 0;
      this.phase = 'setup';
      this.market = [];
      this.order = [];
      this.active = null;
      this.equipState = null;
      this.champion = null;
      this.lastAttackCard = null;
      this.lastHadesCard = null;
    }

    // ---------------------------------------------------------------- helpers
    d6() { return 1 + Math.floor(this.rng() * 6); }
    coin() { return this.rng() < 0.5; }
    log(msg, cls) { this.io.log(msg, cls); }
    update() { this.io.update(); }
    delay(ms) { return this.io.delay(ms); }
    get AI() { return root.GLAD_AI; }
    living() { return this.players.filter((p) => p.glad && p.glad.alive); }
    arenaOver() { return this.living().length <= 1; }
    gdef(p) { return GLADIATORS[p.glad.key]; }
    has(p, key) { return p.glad.equipped.some((c) => c.key === key); }
    weapons(p) { return p.glad.equipped.filter((c) => def(c).type === 'weapon'); }
    totalDef(p) { return p.glad.equipped.reduce((s, c) => s + (def(c).type === 'armor' ? def(c).def : 0), 0); }

    /** Base dodge of a gladiator with its own equipment (Talaria), before attacker modifiers. */
    ownDodge(p) {
      if (p.glad.key === 'bestia') return 0;
      let d = this.gdef(p).dodge;
      if (this.has(p, 'talaria')) d += 2;
      return clamp(d, RULES.dodgeMin, RULES.dodgeMax);
    }

    /** Dodge of `t` against attacker `a` this attack. */
    dodgeVs(t, a, harena) {
      if (t.glad.key === 'bestia') return 0; // always struck, modifiers have no impact
      if (this.noDodgePhase) return 0; // Hands in the Sand
      let d = this.ownDodge(t);
      if (t.glad.key !== 'amazonia') {
        let red = (harena ? 1 : 0) + (t.glad.debuff.dodgePhase || 0);
        for (const c of this.weapons(a)) {
          const wd = def(c);
          if (!wd.dodgeMod) continue;
          if (wd.isRete && this.has(t, 'galea')) continue;
          red += wd.dodgeMod;
        }
        d -= red;
      }
      return clamp(d, RULES.dodgeMin, RULES.dodgeMax);
    }

    /** Short text for the attack value, e.g. "65" or "50 + d6×8". */
    attackText(p) {
      const ws = this.weapons(p).map(def);
      let flat = 0;
      const beasts = [];
      for (const w of ws) { if (w.beast) beasts.push(`d6×${w.beast}`); else flat += w.atk; }
      if (!beasts.length && flat === 0) flat = RULES.fists;
      if (p.glad.key === 'bestia') flat += 10;
      return [flat ? String(flat) : null, ...beasts].filter(Boolean).join(' + ');
    }

    async ask(p, q, aiFn) {
      if (p.isAI) return aiFn();
      this.update();
      return this.io.choose(p, q);
    }

    async flip(label) {
      const heads = this.coin();
      await this.io.showFlip(label, heads);
      this.log(`🪙 ${label}: <b>${heads ? 'Heads' : 'Tails'}</b>`, 'lcoin');
      return heads;
    }

    // ---------------------------------------------------------------- game flow
    async run() {
      while (!this.champion) {
        await this.playArena();
      }
      this.phase = 'over';
      this.log(`🏆 <b>${this.champion.name}</b> claims ${this.laurelsToWin} laurels and is crowned Champion of the Arena!`, 'big');
      this.update();
      return this.champion;
    }

    setupArena() {
      this.arena += 1;
      this.turn = 0;
      this.equipDeck = new Deck(CARDS, this.rng, 'Equipment');
      this.attackDeck = new Deck(ATTACK_CARDS, this.rng, 'Attack');
      this.hadesDeck = new Deck(HADES, this.rng, 'Hades');
      this.gladDeck = new Deck(GLADIATORS, this.rng, 'Gladiator');
      this.market = [];
      this.tiebreak = null; // { winner, tie, why } when everyone falls at once
      this.refillMarket();
      for (const p of this.players) {
        p.hand = [];
        p.gold = 0;
        p.glad = null;
      }
      this.lastAttackCard = null;
      this.lastHadesCard = null;
    }

    newGladiator(p) {
      const c = this.gladDeck.draw();
      const g = GLADIATORS[c.key];
      p.glad = {
        key: c.key, card: c, vita: g.vita, max: g.vita, alive: true,
        equipped: [], coinUsed: false, veloxUsed: false, hephUsed: false, redrawn: false,
        debuff: { roll: 0, miss: false, noBuy: false, haunted: false, armorPhase: 0, dodgePhase: 0, turnedBy: null },
      };
    }

    refillMarket() {
      let guard = 0;
      while (this.market.length < RULES.marketSize && guard++ < 300) {
        const c = this.equipDeck.draw();
        if (!c) break;
        if (isDrawOnly(def(c))) { this.equipDeck.toDiscard(c); continue; }
        this.market.push(c);
      }
    }

    async playArena() {
      this.setupArena();
      this.phase = 'setup';
      this.log(`🏟️ <b>Arena ${this.arena}</b> begins! A new crop of Gladiators enters the sand.`, 'big');
      for (const p of this.players) this.newGladiator(p);
      for (const p of this.players) this.log(`${p.name} draws <b>${this.gdef(p).name}</b> (VITA ${p.glad.vita}).`);
      this.update();

      // Once per arena: send your gladiator back and draw a new one.
      for (const p of this.players) {
        const g = this.gdef(p);
        const redraw = await this.ask(p, {
          title: `${p.name}: keep ${g.name}?`,
          gladKey: p.glad.key,
          text: `${g.icon} <b>${g.name}</b> — VITA ${g.vita}, dodge ${g.dodge || 'never'}. ${g.text}<br><br>Once per arena you may send your Gladiator back and draw a new one (the returned Gladiator is discarded).`,
          options: [{ label: `Keep ${g.name}`, value: false }, { label: 'Send back & draw again', value: true }],
        }, () => this.AI.wantsRedraw(this, p));
        if (redraw) {
          this.gladDeck.toDiscard(p.glad.card);
          this.newGladiator(p);
          p.glad.redrawn = true;
          this.log(`${p.name} sends ${g.name} back and draws <b>${this.gdef(p).name}</b>.`);
          this.update();
        }
      }

      // Retiarius begins with a Rete.
      for (const p of this.players) {
        if (p.glad.key !== 'retiarius') continue;
        let rete = this.takeFrom(this.equipDeck.cards, 'rete') || this.takeFrom(this.equipDeck.discard, 'rete') || this.takeFrom(this.market, 'rete');
        if (this.market.length < RULES.marketSize) this.refillMarket();
        if (rete) {
          rete.locked = true;
          p.glad.equipped.push(rete);
          this.equipDeck.shuffle();
          this.log(`${p.name}'s Retiarius takes up a Rete.`);
        } else {
          this.log(`No Rete is left for ${p.name}'s Retiarius.`);
        }
      }

      // Turn order.
      this.order = this.rollOrder();
      this.log(`Turn order: ${this.order.map((p) => p.name).join(' → ')}`);
      this.update();

      while (!this.arenaOver()) {
        this.turn += 1;
        if (this.turn > this.maxTurns) {
          this.log('The Emperor grows bored and ends the arena. No laurel is awarded.', 'big');
          break;
        }
        this.log(`— Turn ${this.turn} —`, 'turn');
        if (this.turn >= RULES.restlessTurn) {
          await this.crowdRestless();
          if (this.arenaOver()) break;
        }
        await this.equipPhase();
        await this.attackPhase();
      }

      const alive = this.living();
      const tb = alive.length === 0 ? this.tiebreak : null;
      if (tb && tb.winner) {
        const w = tb.winner;
        w.laurels += 1;
        this.log(`🌿 ${tb.why}, but <b>${w.name}</b> had the most VITA before the final blows and wins Arena ${this.arena}! (${w.laurels} laurel${w.laurels > 1 ? 's' : ''})`, 'big');
        if (w.laurels >= this.laurelsToWin) this.champion = w;
      } else if (alive.length === 1 && this.turn <= this.maxTurns) {
        const w = alive[0];
        w.laurels += 1;
        this.log(`🌿 <b>${w.name}</b> is the last Gladiator standing and wins Arena ${this.arena}! (${w.laurels} laurel${w.laurels > 1 ? 's' : ''})`, 'big');
        if (w.laurels >= this.laurelsToWin) this.champion = w;
      } else if (alive.length === 0) {
        this.log(`No Gladiator is left standing${tb && tb.tie ? ' and their VITA before the final blows was tied' : ''}. Nobody earns a laurel in Arena ${this.arena}.`, 'big');
      }
      this.phase = 'arenaEnd';
      this.active = null;
      this.update();
      if (!this.champion) await this.io.arenaEnd?.(this);
    }

    takeFrom(arr, key) {
      const i = arr.findIndex((c) => c.key === key);
      return i >= 0 ? arr.splice(i, 1)[0] : null;
    }

    rollOrder() {
      const rolls = new Map(this.players.map((p) => [p, [this.d6()]]));
      for (;;) {
        const groups = new Map();
        for (const [p, r] of rolls) {
          const k = r.join(',');
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(p);
        }
        const tied = [...groups.values()].filter((g) => g.length > 1);
        if (!tied.length) break;
        for (const g of tied) for (const p of g) rolls.get(p).push(this.d6());
      }
      for (const [p, r] of rolls) this.log(`${p.name} rolls ${r.join(' then ')} for turn order.`, 'dim');
      return [...this.players].sort((a, b) => {
        const ra = rolls.get(a), rb = rolls.get(b);
        for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
          const x = ra[i] || 0, y = rb[i] || 0;
          if (x !== y) return y - x;
        }
        return 0;
      });
    }

    // ---------------------------------------------------------------- equip phase
    async equipPhase() {
      this.phase = 'equip';
      for (const p of this.order) {
        if (this.arenaOver()) return;
        if (!p.glad.alive) continue;
        this.active = p;
        p.gold += RULES.income;
        const db = p.glad.debuff;
        this.equipState = { player: p, refreshed: false, drawn: false, buys: 0, noBuy: db.noBuy, haunted: db.haunted };
        db.noBuy = false;
        db.haunted = false;
        this.log(`${p.name} collects ${RULES.income} denarii (now ${p.gold}).`, 'dim');
        if (this.equipState.haunted) this.log(`🌘 ${p.name} is haunted: no drawing, buying or equipping this phase.`, 'hades');
        else if (this.equipState.noBuy) this.log(`🏚️ The Market stalls are shut for ${p.name} this phase.`, 'hades');
        this.update();
        if (p.isAI) await this.AI.equipPhase(this, p);
        else await this.io.humanEquip(p);
        this.equipState = null;
        this.update();
      }
      this.active = null;
    }

    checkEquip(p) {
      if (!this.equipState || this.equipState.player !== p) return 'It is not your Equip Phase.';
      return null;
    }

    findOwned(p, uid) {
      let i = p.hand.findIndex((c) => c.uid === uid);
      if (i >= 0) return { card: p.hand[i], where: 'hand', i };
      i = p.glad.equipped.findIndex((c) => c.uid === uid);
      if (i >= 0) return { card: p.glad.equipped[i], where: 'equipped', i };
      return null;
    }

    actSell(p, uid) {
      const e = this.checkEquip(p); if (e) return e;
      const f = this.findOwned(p, uid); if (!f) return 'Card not found.';
      if (f.card.locked) return "Retiarius's Rete cannot be sold.";
      (f.where === 'hand' ? p.hand : p.glad.equipped).splice(f.i, 1);
      const d = def(f.card);
      p.gold += d.sell;
      this.equipDeck.toDiscard(f.card);
      this.log(`${p.name} sells ${d.name} for ${d.sell} denarii.`);
      this.update();
      return null;
    }

    actRefresh(p) {
      const e = this.checkEquip(p); if (e) return e;
      const s = this.equipState;
      if (s.refreshed) return 'The Market can be refreshed only once per phase.';
      if (s.drawn || s.buys) return 'Refresh the Market before drawing or buying.';
      if (p.gold < RULES.refreshCost) return `Refreshing costs ${RULES.refreshCost} denarii.`;
      p.gold -= RULES.refreshCost;
      for (const c of this.market) this.equipDeck.toDiscard(c);
      this.market = [];
      this.refillMarket();
      s.refreshed = true;
      this.log(`${p.name} pays ${RULES.refreshCost} denarii to refresh the Market.`);
      this.update();
      return null;
    }

    actDraw(p) {
      const e = this.checkEquip(p); if (e) return e;
      const s = this.equipState;
      if (s.haunted) return 'Haunted Dreams: you cannot draw this phase.';
      if (s.drawn) return 'You already drew this phase.';
      if (s.buys) return 'You chose to buy this phase: draw OR buy, not both.';
      const c = this.equipDeck.draw();
      if (!c) return 'The Equipment deck is empty.';
      p.hand.push(c);
      s.drawn = true;
      this.lastDrawn = c;
      this.log(`${p.name} draws a free card from the Equipment deck.`);
      this.update();
      return null;
    }

    actBuy(p, uid) {
      const e = this.checkEquip(p); if (e) return e;
      const s = this.equipState;
      if (s.haunted || s.noBuy) return s.haunted ? 'Haunted Dreams: you cannot buy this phase.' : 'Stalls Shut: you cannot buy from the Market this phase.';
      if (s.drawn) return 'You drew a free card this phase: draw OR buy, not both.';
      if (s.buys >= RULES.maxBuys) return `You can buy at most ${RULES.maxBuys} cards per phase.`;
      const i = this.market.findIndex((c) => c.uid === uid);
      if (i < 0) return 'That card is no longer in the Market.';
      const d = def(this.market[i]);
      if (p.gold < d.buy) return `You need ${d.buy} denarii to buy ${d.name}.`;
      p.gold -= d.buy;
      const [c] = this.market.splice(i, 1);
      p.hand.push(c);
      s.buys += 1;
      this.refillMarket();
      this.log(`${p.name} buys <b>${d.name}</b> for ${d.buy} denarii.`);
      this.update();
      return null;
    }

    /** Equip from hand. If the new card conflicts, try unequipping the fewest conflicting cards. */
    actEquip(p, uid) {
      const e = this.checkEquip(p); if (e) return e;
      if (this.equipState.haunted) return 'Haunted Dreams: you cannot equip this phase.';
      const i = p.hand.findIndex((c) => c.uid === uid);
      if (i < 0) return 'Card not in hand.';
      const card = p.hand[i];
      const d = def(card);
      if (!isGear(d)) return `${d.name} is used, not equipped.`;
      const cur = p.glad.equipped;
      let err = loadoutError(p.glad.key, [...cur, card]);
      if (!err) {
        p.hand.splice(i, 1);
        cur.push(card);
        this.update();
        return null;
      }
      const removable = cur.filter((c) => !c.locked);
      const tries = [];
      for (const a of removable) tries.push([a]);
      for (let x = 0; x < removable.length; x++) for (let y = x + 1; y < removable.length; y++) tries.push([removable[x], removable[y]]);
      for (const rm of tries) {
        const next = [...cur.filter((c) => !rm.includes(c)), card];
        if (!loadoutError(p.glad.key, next)) {
          p.hand.splice(i, 1);
          p.glad.equipped = next;
          p.hand.push(...rm);
          this.update();
          return null;
        }
      }
      return err;
    }

    actUnequip(p, uid) {
      const e = this.checkEquip(p); if (e) return e;
      if (this.equipState.haunted) return 'Haunted Dreams: you cannot change your gear this phase.';
      const i = p.glad.equipped.findIndex((c) => c.uid === uid);
      if (i < 0) return 'Card not equipped.';
      if (p.glad.equipped[i].locked) return "Retiarius's Rete cannot be unequipped.";
      p.hand.push(p.glad.equipped.splice(i, 1)[0]);
      this.update();
      return null;
    }

    /** Replace the whole loadout (used by the AI). `items` must be cards owned by p. */
    setLoadout(p, items) {
      if (this.equipState && this.equipState.player === p && this.equipState.haunted) return 'Haunted Dreams: you cannot equip this phase.';
      const err = loadoutError(p.glad.key, items);
      if (err) return err;
      const all = [...p.hand, ...p.glad.equipped];
      if (p.glad.equipped.some((c) => c.locked && !items.includes(c))) return 'Locked card missing.';
      p.glad.equipped = items.slice();
      p.hand = all.filter((c) => !items.includes(c));
      this.update();
      return null;
    }

    discardFromHand(p, uid) {
      const i = p.hand.findIndex((c) => c.uid === uid);
      if (i < 0) return null;
      const [c] = p.hand.splice(i, 1);
      this.equipDeck.toDiscard(c);
      return c;
    }

    heal(p, uid) {
      const d = def(p.hand.find((c) => c.uid === uid));
      const before = p.glad.vita;
      p.glad.vita = Math.min(p.glad.max, p.glad.vita + d.heal);
      this.discardFromHand(p, uid);
      this.log(`${d.icon} ${p.name} uses ${d.name} and restores ${p.glad.vita - before} VITA (now ${p.glad.vita}).`, 'heal');
      this.update();
    }

    /** Use a special card from hand during your Equip Phase. */
    async actUse(p, uid) {
      const e = this.checkEquip(p); if (e) return e;
      const card = p.hand.find((c) => c.uid === uid);
      if (!card) return 'Card not in hand.';
      const d = def(card);
      if (d.heal) {
        if (p.glad.vita <= 0) return 'Healing requires VITA above 0.';
        if (p.glad.vita >= p.glad.max) return 'Your Gladiator is already at full VITA.';
        this.heal(p, uid);
        return null;
      }
      if (card.key === 'harena' || card.key === 'furor') return `${d.name} is declared right before you roll an attack.`;
      if (card.key === 'interceptio') return this.useInterceptio(p, card);
      if (card.key === 'fortuna') {
        if (this.equipState.haunted) return 'Haunted Dreams: you cannot draw this phase.';
        return this.useFortuna(p, card);
      }
      return `${d.name} cannot be used like that.`;
    }

    interceptTargets(p) {
      const out = [];
      for (const o of this.living()) {
        if (o === p) continue;
        for (const c of o.glad.equipped) {
          const d = def(c);
          if (c.locked) continue;
          if (d.type === 'armor' || (d.type === 'weapon' && d.hands === 1)) out.push({ owner: o, card: c });
        }
      }
      return out;
    }

    async useInterceptio(p, card) {
      const targets = this.interceptTargets(p);
      if (!targets.length) return 'No opponent has a one-handed weapon or armor to remove.';
      const pick = await this.ask(p, {
        title: 'Interceptio: sabotage which item?',
        text: "Remove one equipped one-handed weapon or armor from an opponent. Its owner receives half its sell value.",
        options: [...targets.map((t, i) => ({ label: `${t.owner.name}: ${def(t.card).name}`, value: i })), { label: 'Cancel', value: -1 }],
      }, () => this.AI.pickInterceptio(this, p, targets));
      if (pick === -1 || pick == null) return 'Cancelled.';
      const t = targets[pick];
      const d = def(t.card);
      t.owner.glad.equipped = t.owner.glad.equipped.filter((c) => c !== t.card);
      this.equipDeck.toDiscard(t.card);
      const comp = ceil5(d.sell / 2);
      t.owner.gold += comp;
      this.discardFromHand(p, card.uid);
      this.log(`🕵️ ${p.name} plays Interceptio and removes ${t.owner.name}'s <b>${d.name}</b>! (${t.owner.name} receives ${comp} denarii)`, 'hit');
      this.update();
      return null;
    }

    async useFortuna(p, card) {
      this.discardFromHand(p, card.uid);
      const drawn = [this.equipDeck.draw(), this.equipDeck.draw()].filter(Boolean);
      if (!drawn.length) return null;
      const pick = drawn.length === 1 ? 0 : await this.ask(p, {
        title: 'Fortuna: keep one card',
        text: 'Keep one, discard the other.',
        cards: drawn,
        options: drawn.map((c, i) => ({ label: `Keep ${def(c).name}`, value: i })),
      }, () => this.AI.pickBest(this, p, drawn));
      drawn.forEach((c, i) => (i === pick ? p.hand.push(c) : this.equipDeck.toDiscard(c)));
      this.log(`🍀 ${p.name} plays Fortuna, draws 2 cards and keeps one.`);
      this.update();
      return null;
    }

    // ---------------------------------------------------------------- attack phase
    async attackPhase() {
      this.phase = 'attack';
      this.update();
      for (const p of this.order) {
        if (this.arenaOver()) break;
        this.active = p;
        this.update();
        if (p.glad.alive) await this.attackTurn(p);
        else await this.hadesTurn(p);
        await this.delay(350);
      }
      // "For the rest of this Attack Phase" effects end here.
      this.noDodgePhase = false;
      for (const q of this.players) { q.glad.debuff.armorPhase = 0; q.glad.debuff.dodgePhase = 0; }
      this.active = null;
      this.update();
    }

    neighbor(p, dir) {
      const n = this.players.length;
      for (let k = 1; k < n; k++) {
        const q = this.players[(((p.id + dir * k) % n) + n) % n];
        if (q !== p && q.glad.alive) return q;
      }
      return null;
    }

    async chooseTarget(p, candidates, title, chooser) {
      if (candidates.length === 1) return candidates[0];
      if (chooser && chooser !== p) {
        const j = await this.ask(chooser, {
          title,
          text: `Choose who ${p.name} attacks.`,
          options: candidates.map((c, i) => ({ label: `${c.name} — ${this.gdef(c).name}, VITA ${c.glad.vita}`, value: i })),
        }, () => candidates.indexOf(this.AI.pickHadesTarget(this, chooser, candidates)));
        return candidates[j];
      }
      const i = await this.ask(p, {
        title,
        text: 'Choose your target.',
        options: candidates.map((c, i) => ({ label: `${c.name} — ${this.gdef(c).name}, VITA ${c.glad.vita}, dodge ${this.dodgeVs(c, p, false)}, DEF ${this.totalDef(c)}`, value: i })),
      }, () => candidates.indexOf(this.AI.pickTarget(this, p, candidates)));
      return candidates[i];
    }

    async attackTurn(p) {
      const others = this.living().filter((q) => q !== p);
      if (!others.length) return;
      const turner = p.glad.debuff.turnedBy;
      p.glad.debuff.turnedBy = null;
      if (turner) this.log(`🔄 Turned Blade: ${turner.name} whispers from Hades and chooses ${p.name}'s target!`, 'hades');

      if (this.has(p, 'fulgur')) {
        let targets = others;
        if (others.length > 2) {
          const first = await this.chooseTarget(p, others, `Fulgur Iovis (${p.name}) — first target`, turner);
          const second = await this.chooseTarget(p, others.filter((q) => q !== first), `Fulgur Iovis (${p.name}) — second target`, turner);
          targets = [first, second];
        } else if (this.players.length === 2) {
          targets = [others[0]];
        }
        this.log(`⚡ ${p.name} calls down Fulgur Iovis on ${targets.map((t) => t.name).join(' and ')}!`);
        const mods = await this.preAttackMods(p, targets);
        const raw = this.d6();
        await this.io.showRoll(p, raw, 'Fulgur Iovis');
        for (const t of targets) {
          if (!p.glad.alive && !p.glad.finalAttacking) break;
          if (!t.glad.alive) continue;
          await this.resolveAttack(p, t, { mods, raw, keepMiss: true });
        }
        p.glad.debuff.roll = 0;
        p.glad.debuff.miss = false;
        return;
      }

      let target = null;
      if (this.players.length === 2) {
        target = others[0];
      } else if (turner) {
        target = await this.chooseTarget(p, others, `Turned Blade: choose ${p.name}'s target`, turner);
      } else {
        const c = this.attackDeck.draw();
        const ad = ATTACK_CARDS[c.key];
        this.lastAttackCard = c;
        this.attackDeck.toDiscard(c);
        this.log(`${p.name} draws <b>${ad.icon} ${ad.name}</b>.`);
        await this.io.showCard('attack', ad, p);
        if (c.key === 'pass') { this.log(`${p.name} passes this Attack Phase.`, 'dim'); return; }
        if (c.key === 'left') target = this.neighbor(p, +1);
        else if (c.key === 'right') target = this.neighbor(p, -1);
        else target = await this.chooseTarget(p, others, `${p.name}: Attack your choice`);
      }
      if (!target) return;
      const res = await this.resolveAttack(p, target, {});
      p.glad.debuff.roll = 0;

      if (res.hit && this.has(p, 'ensis') && p.glad.alive && !this.arenaOver()) {
        const cands = this.living().filter((q) => q !== p);
        if (cands.length) {
          const t2 = await this.chooseTarget(p, cands, `${p.name}: Ensis Martis — extra attack`);
          this.log(`🔥 Ensis Martis grants ${p.name} an extra attack on ${t2.name}!`);
          await this.resolveAttack(p, t2, { extra: true });
        }
      }
    }

    /** Harena / Furor are declared before the roll. */
    async preAttackMods(p, targets) {
      const mods = { harena: false, furor: false };
      const harena = p.hand.find((c) => c.key === 'harena');
      const furor = p.hand.find((c) => c.key === 'furor');
      if (!harena && !furor) return mods;
      const options = [{ label: 'Attack without special cards', value: 'none' }];
      if (harena) options.push({ label: '⏳ Throw Harena (dodge −1)', value: 'harena' });
      if (furor) options.push({ label: '🔥 Unleash Furor (roll +1)', value: 'furor' });
      if (harena && furor) options.push({ label: 'Use both', value: 'both' });
      const t = targets.map((x) => `${x.name} (dodge ${this.dodgeVs(x, p, false)}, VITA ${x.glad.vita})`).join(', ');
      const pick = await this.ask(p, {
        title: `${p.name}: declare special cards?`,
        text: `You are attacking ${t}. A roll higher than the target's dodge hits; a 6 is an auto-hit that ignores armor.`,
        options,
      }, () => this.AI.preAttack(this, p, targets, !!harena, !!furor));
      if ((pick === 'harena' || pick === 'both') && harena) { mods.harena = true; this.discardFromHand(p, harena.uid); this.log(`⏳ ${p.name} throws sand (Harena)!`); }
      if ((pick === 'furor' || pick === 'both') && furor) { mods.furor = true; this.discardFromHand(p, furor.uid); this.log(`🔥 ${p.name} is filled with Furor!`); }
      this.update();
      return mods;
    }

    evalRoll(a, t, raw, mods) {
      let mod = raw + (mods.furor ? 1 : 0) - (a.glad.debuff.roll ? 1 : 0);
      mod = clamp(mod, 1, 6);
      const autoOn = this.has(a, 'hasta') ? 5 : 6;
      const auto = mod >= autoOn;
      const dodge = this.dodgeVs(t, a, mods.harena);
      return { mod, auto, dodge, hit: auto || mod > dodge };
    }

    /** One attack from a → t. Options: mods, raw (pre-rolled, Fulgur), extra (Ensis), final (Furor Mortis). */
    async resolveAttack(a, t, opt) {
      if (a.glad.debuff.miss) {
        if (!opt.keepMiss) a.glad.debuff.miss = false;
        this.log(`💨 Stolen Breath: ${a.name}'s attack on ${t.name} automatically misses.`, 'miss');
        this.update();
        return { hit: false };
      }
      const mods = opt.mods || (opt.final ? { harena: false, furor: false } : await this.preAttackMods(a, [t]));
      let raw = opt.raw;
      if (raw == null) {
        raw = this.d6();
        await this.io.showRoll(a, raw, `vs ${t.name}`);
      }
      let r = this.evalRoll(a, t, raw, mods);

      // Velox: once per arena, force a reroll of an attack against you.
      if (t.glad.key === 'velox' && !t.glad.veloxUsed && t.glad.alive && r.hit) {
        const use = await this.ask(t, {
          title: `${t.name}: Velox reroll?`,
          text: `${a.name} rolled ${raw}${r.auto ? ' (AUTO-HIT!)' : ''} and will hit you. Once per arena, Velox can force a reroll. They must keep the new roll.`,
          options: [{ label: 'Force a reroll!', value: true }, { label: 'Take the hit', value: false }],
        }, () => this.AI.useVelox(this, t, a, r));
        if (use) {
          t.glad.veloxUsed = true;
          this.log(`💨 ${t.name}'s Velox forces ${a.name} to reroll!`);
          raw = this.d6();
          await this.io.showRoll(a, raw, 'reroll');
          r = this.evalRoll(a, t, raw, mods);
        }
      }

      const rollText = r.mod !== raw ? `${raw}→${r.mod}` : `${raw}`;
      if (!r.hit) {
        this.log(`${a.name} rolls ${rollText} against ${t.name}'s dodge ${r.dodge}: <b>miss</b>.`, 'miss');
        this.update();
        return { hit: false };
      }

      let dmg = this.computeDamage(a, t, r.auto);
      this.log(`${a.name} rolls ${rollText} against ${t.name}'s dodge ${r.dodge}: <b>${r.auto ? 'AUTO-HIT' : 'hit'}</b> for <b>${dmg.total}</b> damage${dmg.detail ? ` (${dmg.detail})` : ''}.`, r.auto ? 'crit' : 'hit');
      let total = dmg.total;

      if (this.has(t, 'hephaesti') && !t.glad.hephUsed && total > 0) {
        const use = await this.ask(t, {
          title: `${t.name}: Lorica Hephaesti?`,
          text: `You are about to take ${total} damage (VITA ${t.glad.vita}). Once per arena, the Armor of Hephaestus negates one hit entirely.`,
          options: [{ label: 'Negate the hit!', value: true }, { label: 'Save it', value: false }],
        }, () => this.AI.useHephaesti(this, t, total));
        if (use) {
          t.glad.hephUsed = true;
          total = 0;
          this.log(`🔨 The Armor of Hephaestus negates the blow on ${t.name}!`, 'heal');
        }
      }

      await this.takeDamage(t, total, { killer: a, final: !!opt.final });

      // Flagrum: target discards a card of their choice.
      if (this.has(a, 'flagrum') && t.glad.alive && t.hand.length) {
        const i = await this.ask(t, {
          title: `${t.name}: the Flagrum strikes`,
          text: 'Discard one card of your choice from your hand.',
          cards: t.hand,
          options: t.hand.map((c, i) => ({ label: `Discard ${def(c).name}`, value: i })),
        }, () => this.AI.pickDiscard(this, t));
        const c = t.hand[i] || t.hand[0];
        this.discardFromHand(t, c.uid);
        this.log(`〰️ The Flagrum makes ${t.name} discard ${def(c).name}.`);
      }
      this.update();
      return { hit: true };
    }

    computeDamage(a, t, auto) {
      const ws = this.weapons(a).map(def);
      let normal = 0, ignore = 0, half = false, ursus = false;
      const skipLocs = new Set();
      const parts = [];
      for (const w of ws) {
        let v;
        if (w.beast) {
          const r = this.d6();
          v = r * w.beast;
          parts.push(`${w.name} ${r}×${w.beast}=${v}`);
          if (w.autoReduceOwn) ursus = true;
        } else {
          v = w.atk;
          if (w.name === 'Pugio' && t.glad.vita < 30) { v *= 2; parts.push('Pugio doubled'); }
        }
        if (w.ignoreArmor) ignore += v; else normal += v;
        for (const l of w.ignoreLocs || []) skipLocs.add(l);
        if (w.halfArmor) half = true;
      }
      if (ws.every((w) => !w.beast && !w.atk)) { normal += RULES.fists; parts.push('fists 10'); }
      if (a.glad.key === 'bestia') { normal += 10; parts.push('Bestia +10'); }

      if (auto) {
        let total = normal + ignore;
        let red = 0;
        for (const c of t.glad.equipped) if (!skipLocs.has(def(c).loc)) red += def(c).autoReduce || 0;
        if (ursus) red += 10;
        if (red) parts.push(`auto-hit reduced by ${red}`);
        total = Math.max(5, ceil5(total - red));
        parts.push('armor ignored');
        return { total, detail: parts.join(', ') };
      }
      const armor = Math.max(0, this.totalDef(t) - (t.glad.debuff.armorPhase || 0));
      let ignored = 0;
      for (const c of t.glad.equipped) { const d = def(c); if (d.type === 'armor' && skipLocs.has(d.loc)) ignored += d.def; }
      let eff = Math.max(0, armor - ignored);
      if (half) eff = ceil5(eff / 2);
      if (armor) parts.push(`armor ${armor}${eff !== armor ? `→${eff}` : ''}`);
      const total = Math.max(5, ceil5(Math.max(0, normal - eff) + ignore));
      return { total, detail: parts.join(', ') };
    }

    async takeDamage(p, dmg, src) {
      if (dmg <= 0 || !p.glad.alive) return;
      p.glad.vitaBeforeHit = p.glad.vita;
      p.glad.vita -= dmg;
      if (p.glad.vita > 0) {
        this.update();
        await this.offerHeal(p);
        return;
      }
      p.glad.vita = 0;
      this.update();
      await this.reachZero(p, src);
    }

    /** "Any time your VITA is above 0": offered after taking damage. */
    async offerHeal(p) {
      const heals = p.hand.filter((c) => def(c).heal);
      if (!heals.length || p.glad.vita >= p.glad.max) return;
      if (!p.isAI && p.glad.vita > p.glad.max * 0.5) return; // don't nag humans when healthy
      const pick = await this.ask(p, {
        title: `${p.name}: heal now?`,
        text: `Your Gladiator is at ${p.glad.vita}/${p.glad.max} VITA.`,
        options: [...heals.map((c) => ({ label: `${def(c).icon} Use ${def(c).name} (+${def(c).heal})`, value: c.uid })), { label: 'Not now', value: 0 }],
      }, () => this.AI.pickHeal(this, p, heals));
      if (pick) this.heal(p, pick);
    }

    async reachZero(p, src) {
      const g = p.glad;
      if (!g.coinUsed) {
        g.coinUsed = true;
        this.log(`${p.name}'s ${this.gdef(p).name} falls! The crowd turns to the Emperor…`, 'death');
        const heads = await this.flip(`The Emperor's Favor for ${p.name}`);
        if (heads) {
          g.vita = Math.min(g.max, RULES.reviveVita);
          this.log(`👍 The Emperor bestows his favor! Medics revive ${p.name} with ${g.vita} VITA.`, 'heal');
          this.update();
          return;
        }
        this.log(`👎 The Emperor is not impressed. The crowd boos as ${p.name} is removed from the arena.`, 'death');
      } else {
        this.log(`💀 ${p.name}'s ${this.gdef(p).name} falls a second time and is on the way to Hades.`, 'death');
      }
      g.alive = false;
      this.update();

      // Furor Mortis
      const k = src.killer;
      if (!src.hades && !src.crowd && !src.final && k && k !== p && k.glad.alive) {
        const heads = await this.flip(`Furor Mortis: ${p.name}'s revenge`);
        if (heads) {
          this.log(`😤 With their dying breath, ${p.name} strikes back at ${k.name}!`, 'crit');
          const victimVita = g.vitaBeforeHit;
          const killerVita = k.glad.vita;
          g.finalAttacking = true;
          await this.resolveAttack(p, k, { final: true });
          g.finalAttacking = false;
          // If the revenge leaves nobody standing, the one with more VITA before their fatal blow wins.
          if (!this.living().length) {
            if (victimVita === killerVita) this.tiebreak = { tie: true };
            else this.tiebreak = { winner: victimVita > killerVita ? p : k, why: `${p.name} and ${k.name} took each other down` };
          }
        } else {
          this.log(`${p.name} boards the boat to cross into Hades.`, 'dim');
        }
      }
    }

    /** The Crowd Grows Restless: from turn 11, at the start of each turn every living Gladiator loses 10 VITA.
     *  Ignores armor, no Furor Mortis, the Sacred Coin applies. If the stones eliminate everyone at once,
     *  the Gladiator with the most VITA before the stones wins; a tie means no laurel. */
    async crowdRestless() {
      const text = `The crowd is bored and starts hurling stones into the arena. Every living Gladiator loses ${RULES.restlessDmg} VITA. Ignores armor.`;
      this.log(`🪨 <b>The Crowd Grows Restless!</b> ${text}`, 'hit');
      await this.io.showCard?.('crowd', { name: 'The Crowd Grows Restless', icon: '🪨', text }, { name: 'The crowd' });
      const before = this.order.filter((p) => p.glad.alive).map((p) => ({ p, vita: p.glad.vita }));
      for (const { p } of before) {
        if (!p.glad.alive) continue;
        await this.takeDamage(p, RULES.restlessDmg, { crowd: true });
      }
      if (before.length && !this.living().length) {
        const top = Math.max(...before.map((b) => b.vita));
        const leaders = before.filter((b) => b.vita === top);
        this.tiebreak = leaders.length === 1 ? { winner: leaders[0].p, why: 'The stones fell everyone' } : { tie: true };
      }
    }

    // ---------------------------------------------------------------- hades
    async hadesTurn(p) {
      const c = this.hadesDeck.draw();
      const h = HADES[c.key];
      this.lastHadesCard = c;
      this.hadesDeck.toDiscard(c);
      this.log(`👻 ${p.name} draws from Hades: <b>${h.icon} ${h.name}</b>. <i>${h.flavor}</i>`, 'hades');
      await this.io.showCard('hades', h, p);
      if (h.kind === 'watch') { this.log('No effect.', 'dim'); return; }
      if (!this.living().length) return;
      if (h.coin) {
        const heads = await this.flip(h.name);
        if (!heads) { this.log('Tails: the underworld stirs, but nothing happens.', 'dim'); return; }
      }
      if (h.target === 'global') {
        if (h.effect === 'noDodge') {
          this.noDodgePhase = true;
          this.log('🙌 Cold hands grip every ankle: no living Gladiator can dodge for the rest of this Attack Phase!', 'hit');
        }
        this.update();
        return;
      }
      if (h.target === 'all') {
        for (const t of this.living()) await this.applyHades(p, t, h);
        return;
      }
      const t = await this.chooseTarget(p, this.living(), `${p.name} (Hades): ${h.name}`, p);
      await this.applyHades(p, t, h);
    }

    async applyHades(p, t, h) {
      if (!t.glad.alive) return;
      const db = t.glad.debuff;
      switch (h.effect) {
        case 'dmg':
          this.log(`👻 ${t.name} takes ${h.amount} damage from Hades.`, 'hit');
          await this.takeDamage(t, h.amount, { killer: p, hades: true });
          break;
        case 'toll': {
          const pay = Math.min(t.gold, h.amount);
          t.gold -= pay;
          this.log(`👻 ${t.name} pays ${pay} denarii to the Bank.`);
          break;
        }
        case 'discard': {
          if (!t.hand.length) { this.log(`👻 ${t.name}'s hand is empty: no effect.`, 'dim'); break; }
          const i = await this.ask(t, {
            title: `${t.name}: ${h.name}`,
            text: 'Discard 1 card of your choice from your hand.',
            cards: t.hand,
            options: t.hand.map((c, k) => ({ label: `Discard ${def(c).name}`, value: k })),
          }, () => this.AI.pickDiscard(this, t));
          const c = t.hand[i] || t.hand[0];
          this.discardFromHand(t, c.uid);
          this.log(`👻 ${t.name} discards ${def(c).name}.`);
          break;
        }
        case 'discardHand':
          if (t.hand.length) {
            const n = t.hand.length;
            for (const c of t.hand) this.equipDeck.toDiscard(c);
            t.hand = [];
            this.log(`👻 ${t.name} drops their whole hand (${n} card${n > 1 ? 's' : ''}).`);
          }
          break;
        case 'weak':
          db.roll = 1;
          this.log(`👻 ${t.name}'s next hit roll is reduced by 1.`);
          break;
        case 'noBuy':
          db.noBuy = true;
          this.log(`👻 ${t.name} cannot buy from the Market in their next Equip Phase.`);
          break;
        case 'haunted':
          db.haunted = true;
          this.log(`👻 ${t.name} cannot draw, buy or equip in their next Equip Phase.`);
          break;
        case 'armorDown':
          db.armorPhase = (db.armorPhase || 0) + h.amount;
          this.log(`👻 ${t.name} has ${h.amount} less armor for the rest of this Attack Phase.`);
          break;
        case 'dodgeDown':
          db.dodgePhase = (db.dodgePhase || 0) + 1;
          this.log(`👻 ${t.name}'s dodge is reduced by 1 for the rest of this Attack Phase.`);
          break;
        case 'miss':
          db.miss = true;
          this.log(`👻 ${t.name}'s next attack will automatically miss.`);
          break;
        case 'turned':
          db.turnedBy = p;
          this.log(`👻 ${p.name} will choose the target of ${t.name}'s next attack.`);
          break;
        case 'loseWeapon':
        case 'loseItem': {
          const pool = t.glad.equipped.filter((c) => !c.locked && (h.effect === 'loseItem' || def(c).type === 'weapon'));
          if (!pool.length) { this.log(`👻 ${t.name} has nothing to lose.`, 'dim'); break; }
          const i = pool.length === 1 ? 0 : await this.ask(t, {
            title: `${t.name}: ${h.name}`,
            text: `Discard 1 equipped ${h.effect === 'loseWeapon' ? 'weapon' : 'item'} of your choice. No refund.`,
            cards: pool,
            options: pool.map((c, k) => ({ label: `Lose ${def(c).name}`, value: k })),
          }, () => this.AI.pickLoseEquipped(this, t, pool));
          const c = pool[i] || pool[0];
          t.glad.equipped = t.glad.equipped.filter((x) => x !== c);
          this.equipDeck.toDiscard(c);
          this.log(`👻 ${t.name}'s ${def(c).name} is swallowed by the sand!`, 'hit');
          break;
        }
      }
      this.update();
    }
  }

  root.GladiatorEngine = { Game, Deck, loadoutError, def, isGear, isDrawOnly, ceil5, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
