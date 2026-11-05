/* Gladiator v6.1 — card data, taken from the rules manual (docs/rules-v6.1.md). */
(function (root) {
  'use strict';

  const GLADIATORS = {
    vulgaris: { name: 'Vulgaris', vita: 100, dodge: 1, count: 8, icon: '🪖', text: 'No special ability. A sturdy, honest fighter.' },
    velox: { name: 'Velox', vita: 80, dodge: 2, count: 7, icon: '💨', text: 'Once per arena, make an opponent reroll an attack against you. They must keep the new roll.' },
    bestia: { name: 'Bestia', vita: 130, dodge: 0, count: 7, icon: '🐗', text: 'Never dodges (always struck). +10 to all attacks. Dodge modifiers have no impact on Bestia.' },
    retiarius: { name: 'Retiarius', vita: 90, dodge: 2, count: 3, icon: '🕸️', text: 'Begins with a Rete already equipped. It cannot be unequipped or sold, and Interceptio cannot remove it.' },
    debilis: { name: 'Debilis', vita: 80, dodge: 1, count: 3, icon: '🥀', text: 'No special ability.' },
    invictus: { name: 'Invictus', vita: 120, dodge: 3, count: 1, icon: '👑', text: 'Cannot equip shields or helmets.' },
    amazonia: { name: 'Amazonia', vita: 70, dodge: 3, count: 3, icon: '🏹', text: "Dodge reductions don't affect her. Cannot use two-handed weapons." },
  };

  // type: weapon | armor | special | relic   ·   cat: weapon | armor | special | legendary
  const CARDS = {
    // ---------- Weapons (51) ----------
    pugio: { name: 'Pugio', en: 'Dagger', type: 'weapon', cat: 'weapon', atk: 15, hands: 1, buy: 20, sell: 10, count: 7, icon: '🗡️',
      text: "If the defender has fewer than 30 VITA, double this weapon's Attack before subtracting armor." },
    gladius: { name: 'Gladius', en: 'Short Sword', type: 'weapon', cat: 'weapon', atk: 50, hands: 1, buy: 40, sell: 20, count: 9, icon: '⚔️',
      text: 'Cannot be paired with a Tridens.' },
    pilum: { name: 'Pilum', en: 'Spear', type: 'weapon', cat: 'weapon', atk: 50, hands: 1, buy: 50, sell: 25, count: 5, icon: '🏑', pierce: 10,
      text: "Ignores 10 points of the defender's armor." },
    sica: { name: 'Sica', en: 'Curved Blade', type: 'weapon', cat: 'weapon', atk: 35, hands: 1, buy: 40, sell: 20, count: 3, icon: '🌙', pierce: 20,
      text: "Ignores 20 points of the defender's armor." },
    clava: { name: 'Clava', en: 'Spiked Club', type: 'weapon', cat: 'weapon', atk: 40, hands: 1, buy: 45, sell: 25, count: 3, icon: '🏏', halfArmor: true,
      text: 'Armor counts half against this weapon (round up to the nearest 5).' },
    tridens: { name: 'Tridens', en: 'Trident', type: 'weapon', cat: 'weapon', atk: 60, hands: 1, mainOnly: true, buy: 60, sell: 30, count: 5, icon: '🔱',
      text: 'Main hand only. Cannot be paired with a Gladius.' },
    spatha: { name: 'Spatha', en: 'Long Sword', type: 'weapon', cat: 'weapon', atk: 90, hands: 2, buy: 65, sell: 35, count: 4, icon: '🗡️',
      text: 'Two-handed weapon.' },
    flagrum: { name: 'Flagrum', en: 'Whip', type: 'weapon', cat: 'weapon', atk: 25, hands: 1, buy: 30, sell: 15, count: 3, icon: '〰️',
      text: 'On a hit, the target must discard one card of their choice from their hand.' },
    rete: { name: 'Rete', en: 'Net', type: 'weapon', cat: 'weapon', atk: 0, hands: 1, buy: 25, sell: 15, count: 4, icon: '🕸️', dodgeMod: 1, isRete: true,
      text: "Reduces the opponent's dodge by 1 for this attack. Maximum 1 per Gladiator." },
    leo: { name: 'Leo', en: 'Lion', type: 'weapon', cat: 'weapon', beast: 10, hands: 2, buy: 70, sell: 35, count: 2, icon: '🦁', ignoreArmor: true, dodgeMod: 1,
      text: "Two-handed. Damage = die × 10 (10–60). Ignores armor. Reduces opponent's dodge by 1." },
    ursus: { name: 'Ursus', en: 'Bear', type: 'weapon', cat: 'weapon', beast: 8, hands: 1, buy: 50, sell: 25, count: 3, icon: '🐻', autoReduceOwn: 10,
      text: 'One-handed. Damage = die × 8 (8–48). Reduces auto-hit damage by 10.' },
    canis: { name: 'Canis', en: 'War Dog', type: 'weapon', cat: 'weapon', beast: 5, hands: 1, buy: 45, sell: 25, count: 3, icon: '🐕', ignoreArmor: true,
      text: 'One-handed. Damage = die × 5 (5–30). Ignores armor.' },

    // ---------- Armor (37) ----------
    subarmalis: { name: 'Subarmalis', en: 'Padded Vest', type: 'armor', cat: 'armor', def: 20, loc: 'body', buy: 15, sell: 10, count: 7, icon: '🦺', text: 'Body armor.' },
    parma: { name: 'Parma', en: 'Round Shield', type: 'armor', cat: 'armor', def: 25, loc: 'off', shield: true, buy: 20, sell: 10, count: 5, icon: '🛡️', text: 'Occupies the off-hand weapon slot.' },
    manica: { name: 'Manica', en: 'Arm Guard', type: 'armor', cat: 'armor', def: 25, loc: 'arm', buy: 20, sell: 10, count: 4, icon: '💪', text: 'Arm armor.' },
    ocreae: { name: 'Ocreae', en: 'Greaves', type: 'armor', cat: 'armor', def: 25, loc: 'legs', buy: 20, sell: 10, count: 4, icon: '🦵', text: 'Leg armor (a pair counts as one piece).' },
    cassis: { name: 'Cassis', en: 'Helmet', type: 'armor', cat: 'armor', def: 20, loc: 'head', helmet: true, buy: 10, sell: 5, count: 4, icon: '⛑️', text: 'Head armor.' },
    galea: { name: 'Galea', en: 'Visored Helmet', type: 'armor', cat: 'armor', def: 25, loc: 'head', helmet: true, buy: 25, sell: 15, count: 4, icon: '🪖', ignoresRete: true,
      text: "Head armor. Ignores the Rete's dodge reduction." },
    scutum: { name: 'Scutum', en: 'Large Shield', type: 'armor', cat: 'armor', def: 35, loc: 'off', shield: true, buy: 35, sell: 20, count: 4, icon: '🛡️', text: 'Occupies the off-hand weapon slot.' },
    squamata: { name: 'Lorica Squamata', en: 'Scale Armor', type: 'armor', cat: 'armor', def: 35, loc: 'body', buy: 40, sell: 20, count: 3, icon: '🐉', autoReduce: 10,
      text: 'Body armor. Reduces auto-hit damage by 10.' },
    segmentata: { name: 'Lorica Segmentata', en: 'Plate Armor', type: 'armor', cat: 'armor', def: 45, loc: 'body', buy: 55, sell: 30, count: 2, icon: '🏛️', autoReduce: 20,
      text: 'Body armor. Reduces auto-hit damage by 20.' },

    // ---------- Specials (24) — draw only ----------
    aqua: { name: 'Aqua Vitae', en: 'Water of Life', type: 'special', cat: 'special', sell: 15, count: 6, icon: '💧', heal: 30, text: 'Restore 30 VITA. Use any time your VITA is above 0.' },
    harena: { name: 'Harena', en: 'Sand', type: 'special', cat: 'special', sell: 10, count: 4, icon: '⏳', text: "Reduce an opponent's dodge by 1 for this attack. Declared before you roll." },
    furor: { name: 'Furor', en: 'Rage', type: 'special', cat: 'special', sell: 10, count: 4, icon: '🔥', text: 'Add 1 to your hit roll for this attack (a 5 becomes a 6 and auto-hits). Declared before you roll.' },
    volumen: { name: 'Volumen Medici', en: "Physician's Scroll", type: 'special', cat: 'special', sell: 10, count: 4, icon: '📜', heal: 20, text: 'Restore 20 VITA. Use any time your VITA is above 0.' },
    interceptio: { name: 'Interceptio', en: 'Sabotage', type: 'special', cat: 'special', sell: 10, count: 3, icon: '🕵️',
      text: "Equip Phase only. Remove one equipped one-handed weapon or armor from any opponent. Its owner receives half its sell value." },
    fortuna: { name: 'Fortuna', en: 'Fortune', type: 'special', cat: 'special', sell: 5, count: 3, icon: '🍀', text: 'Equip Phase only. Draw 2 equipment cards, keep 1 and discard the other.' },

    // ---------- Legendaries (6) — draw only, 1 each ----------
    fulgur: { name: 'Fulgur Iovis', en: 'Lightning of Jupiter', type: 'weapon', cat: 'legendary', legendary: true, atk: 60, hands: 2, sell: 50, count: 1, icon: '⚡', multi: 2,
      text: 'Two-handed. Attack 2 players of your choice without drawing an Attack card. Roll once and compare it to each target.' },
    hephaesti: { name: 'Lorica Hephaesti', en: 'Armor of Hephaestus', type: 'armor', cat: 'legendary', legendary: true, def: 45, loc: 'body', sell: 50, count: 1, icon: '🔨', negate: true,
      text: 'Body armor. Once per arena, negate one hit entirely (take 0 damage).' },
    ensis: { name: 'Ensis Martis', en: 'Blade of Mars', type: 'weapon', cat: 'legendary', legendary: true, atk: 70, hands: 1, sell: 50, count: 1, icon: '🔥', extra: true,
      text: 'One-handed. On a successful hit, make one extra attack against any Gladiator.' },
    talaria: { name: 'Talaria Mercurii', en: 'Sandals of Mercury', type: 'relic', cat: 'legendary', legendary: true, sell: 50, count: 1, icon: '🪽', dodgeBonus: 2,
      text: 'No slot. Adds 2 to your dodge (dodge cannot exceed 4).' },
    hasta: { name: 'Hasta Achillis', en: 'Spear of Achilles', type: 'weapon', cat: 'legendary', legendary: true, atk: 60, hands: 1, sell: 50, count: 1, icon: '☄️', autoOn: 5,
      text: 'One-handed. Auto-hits on a roll of 5 or 6.' },
    cerberus: { name: 'Cerberus', en: 'Hound of Hades', type: 'weapon', cat: 'legendary', legendary: true, beast: 8, hands: 1, sell: 50, count: 1, icon: '🐺', ignoreArmor: true, dodgeMod: 1,
      text: "One-handed. Damage = die × 8 (8–48). Ignores armor. Reduces opponent's dodge by 1." },
  };

  // The manual gives 30 Attack cards but not the split; this split is our assumption.
  const ATTACK_CARDS = {
    left: { name: 'Attack Left', count: 9, icon: '⬅️', text: 'Attack the player to your left.' },
    right: { name: 'Attack Right', count: 9, icon: '➡️', text: 'Attack the player to your right.' },
    choice: { name: 'Attack Your Choice', count: 8, icon: '🎯', text: 'Attack a player of your choice.' },
    pass: { name: 'Pass', count: 4, icon: '✋', text: 'Do nothing this Attack Phase.' },
  };

  // 10 Watch, 10 Minor, 10 Major, as in the manual. The specific Minor/Major cards follow
  // the effects the manual lists. Their exact split is our assumption.
  const HADES = {
    watch: { name: 'Watch', kind: 'watch', count: 10, icon: '👁️', text: 'No effect. The underworld is busy with its own business.' },
    m_dmg: { name: 'Whisper from Below: Chill', kind: 'minor', effect: 'dmg', amount: 5, count: 2, icon: '🌫️', text: 'One living Gladiator takes 5 damage (ignores armor).' },
    m_toll: { name: "Whisper from Below: Charon's Toll", kind: 'minor', effect: 'toll', amount: 5, count: 2, icon: '🪙', text: 'One living Gladiator pays 5 denarii.' },
    m_disc: { name: 'Whisper from Below: Grasp', kind: 'minor', effect: 'discard', count: 2, icon: '🖐️', text: 'One living Gladiator discards a random card from their hand.' },
    m_weak: { name: 'Whisper from Below: Trembling', kind: 'minor', effect: 'weak', count: 2, icon: '🫨', text: "One living Gladiator's next hit roll is reduced by 1." },
    m_rust: { name: 'Whisper from Below: Rust', kind: 'minor', effect: 'rust', amount: 20, count: 2, icon: '🧪', text: "One living Gladiator's armor counts 20 less against the next attack on them." },
    M_dmg: { name: 'Wrath of the Dead: Strike', kind: 'major', effect: 'dmg', amount: 10, count: 2, icon: '💀', text: 'One living Gladiator takes 10 damage (ignores armor).' },
    M_toll: { name: 'Wrath of the Dead: Plunder', kind: 'major', effect: 'toll', amount: 20, count: 2, icon: '💰', text: 'One living Gladiator pays 20 denarii.' },
    M_weap: { name: 'Wrath of the Dead: Disarm', kind: 'major', effect: 'loseWeapon', count: 1, icon: '🪓', text: 'One living Gladiator discards an equipped weapon.' },
    M_alldmg: { name: 'Wrath of the Dead: Plague', kind: 'major', effect: 'dmg', amount: 10, all: true, count: 3, icon: '☠️', text: 'Flip the Sacred Coin. Heads: every living Gladiator takes 10 damage.' },
    M_alltoll: { name: 'Wrath of the Dead: Tribute', kind: 'major', effect: 'toll', amount: 10, all: true, count: 2, icon: '⚱️', text: 'Flip the Sacred Coin. Heads: every living Gladiator pays 10 denarii.' },
  };

  const RULES = {
    income: 30,
    refreshCost: 20,
    maxBuys: 2,
    marketSize: 3,
    fists: 10,
    reviveVita: 30,
    laurelsToWin: 3,
    dodgeMin: 1,
    dodgeMax: 4,
  };

  root.GLAD_DATA = { GLADIATORS, CARDS, ATTACK_CARDS, HADES, RULES };
})(typeof window !== 'undefined' ? window : globalThis);
