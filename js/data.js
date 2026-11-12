/* Gladiator v6.4 — card data, taken from the rules manual (docs/rules-v6.4.md). */
(function (root) {
  'use strict';

  const GLADIATORS = {
    vulgaris: { name: 'Vulgaris', vita: 100, dodge: 1, count: 8, icon: '🪖', text: 'No special ability.' },
    velox: { name: 'Velox', vita: 80, dodge: 2, count: 7, icon: '💨', text: 'Once per arena, make an opponent reroll an attack against you. They must keep the new roll.' },
    bestia: { name: 'Bestia', vita: 130, dodge: 0, count: 7, icon: '🐗', text: '+10 to all attacks. Cannot dodge.' },
    retiarius: { name: 'Retiarius', vita: 90, dodge: 2, count: 3, icon: '🕸️', text: 'Starts with a Rete equipped (1 weapon slot). Cannot be sold, unequipped or removed by Interceptio.' },
    debilis: { name: 'Debilis', vita: 80, dodge: 1, count: 3, icon: '🥀', text: 'No special ability.' },
    invictus: { name: 'Invictus', vita: 120, dodge: 3, count: 1, icon: '👑', text: 'No shields or helmets.' },
    amazonia: { name: 'Amazonia', vita: 70, dodge: 3, count: 3, icon: '🏹', text: "Dodge reductions don't affect her. No two-handed weapons." },
  };

  // type: weapon | armor | special | relic   ·   cat: weapon | armor | special | legendary
  const CARDS = {
    // ---------- Weapons (51) ----------
    pugio: { name: 'Pugio', en: 'Dagger', type: 'weapon', cat: 'weapon', atk: 15, hands: 1, buy: 20, sell: 10, count: 7, icon: '🗡️',
      text: "If the defending Gladiator has fewer than 30 VITA, double this weapon's ATK before subtracting armor." },
    gladius: { name: 'Gladius', en: 'Short Sword', type: 'weapon', cat: 'weapon', atk: 50, hands: 1, buy: 40, sell: 20, count: 8, icon: '⚔️',
      text: 'Cannot be paired with a Tridens.' },
    pilum: { name: 'Pilum', en: 'Spear', type: 'weapon', cat: 'weapon', atk: 50, hands: 1, buy: 60, sell: 30, count: 5, icon: '🏑', ignoreLocs: ['off', 'body'],
      text: "Ignores the defender's shield and body armor." },
    sica: { name: 'Sica', en: 'Curved Blade', type: 'weapon', cat: 'weapon', atk: 45, hands: 1, buy: 45, sell: 25, count: 4, icon: '🌙', ignoreLocs: ['off', 'arm'],
      text: "Ignores the defender's shield and arm armor." },
    clava: { name: 'Clava', en: 'Spiked Club', type: 'weapon', cat: 'weapon', atk: 40, hands: 1, buy: 45, sell: 25, count: 3, icon: '🏏', halfArmor: true,
      text: 'Armor counts half against this weapon (round up to the nearest 5).' },
    tridens: { name: 'Tridens', en: 'Trident', type: 'weapon', cat: 'weapon', atk: 60, hands: 1, mainOnly: true, buy: 60, sell: 30, count: 5, icon: '🔱',
      text: "Cannot be paired with a Gladius. Main hand only." },
    spatha: { name: 'Spatha', en: 'Long Sword', type: 'weapon', cat: 'weapon', atk: 90, hands: 2, buy: 65, sell: 35, count: 4, icon: '🗡️',
      text: "Occupies both weapon slots." },
    flagrum: { name: 'Flagrum', en: 'Whip', type: 'weapon', cat: 'weapon', atk: 25, hands: 1, buy: 30, sell: 15, count: 3, icon: '〰️',
      text: "On a hit, target must discard one card of their choice from their hand. If their hand is empty, no effect." },
    rete: { name: 'Rete', en: 'Net', type: 'weapon', cat: 'weapon', atk: 0, hands: 1, buy: 25, sell: 15, count: 4, icon: '🕸️', dodgeMod: 1, isRete: true,
      text: "Reduces opponent's dodge by 1 for this attack. Maximum 1 per Gladiator." },
    leo: { name: 'Leo', en: 'Lion', type: 'weapon', cat: 'weapon', beast: 10, hands: 2, buy: 70, sell: 35, count: 2, icon: '🦁', ignoreArmor: true, dodgeMod: 1,
      text: "Damage 10-60. Ignores armor. Reduces opponent's dodge by 1 for this attack." },
    ursus: { name: 'Ursus', en: 'Bear', type: 'weapon', cat: 'weapon', beast: 8, hands: 1, buy: 50, sell: 25, count: 3, icon: '🐻', autoReduceOwn: 10,
      text: "Damage 8-48. Reduces auto-hit damage by 10." },
    canis: { name: 'Canis', en: 'War Dog', type: 'weapon', cat: 'weapon', beast: 5, hands: 1, buy: 45, sell: 25, count: 3, icon: '🐕', ignoreArmor: true,
      text: "Damage 5-30. Ignores armor." },

    // ---------- Armor (37) ----------
    subarmalis: { name: 'Subarmalis', en: 'Padded Vest', type: 'armor', cat: 'armor', def: 20, loc: 'body', buy: 15, sell: 10, count: 7, icon: '🦺', text: "No special ability." },
    parma: { name: 'Parma', en: 'Round Shield', type: 'armor', cat: 'armor', def: 25, loc: 'off', shield: true, buy: 20, sell: 10, count: 5, icon: '🛡️', text: 'Occupies the off-hand weapon slot.' },
    manica: { name: 'Manica', en: 'Arm Guard', type: 'armor', cat: 'armor', def: 25, loc: 'arm', buy: 20, sell: 10, count: 4, icon: '💪', text: "No special ability." },
    ocreae: { name: 'Ocreae', en: 'Greaves', type: 'armor', cat: 'armor', def: 25, loc: 'legs', buy: 20, sell: 10, count: 4, icon: '🦵', text: "No special ability." },
    cassis: { name: 'Cassis', en: 'Helmet', type: 'armor', cat: 'armor', def: 20, loc: 'head', helmet: true, buy: 10, sell: 5, count: 4, icon: '⛑️', text: "No special ability." },
    galea: { name: 'Galea', en: 'Visored Helmet', type: 'armor', cat: 'armor', def: 25, loc: 'head', helmet: true, buy: 25, sell: 15, count: 4, icon: '🪖', ignoresRete: true,
      text: "Ignores the Rete's dodge reduction effect." },
    scutum: { name: 'Scutum', en: 'Large Shield', type: 'armor', cat: 'armor', def: 35, loc: 'off', shield: true, buy: 45, sell: 25, count: 4, icon: '🛡️', text: 'Occupies the off-hand weapon slot.' },
    squamata: { name: 'Lorica Squamata', en: 'Scale Armor', type: 'armor', cat: 'armor', def: 35, loc: 'body', buy: 40, sell: 20, count: 3, icon: '🐉', autoReduce: 10,
      text: "Reduces auto-hit damage by 10." },
    segmentata: { name: 'Lorica Segmentata', en: 'Plate Armor', type: 'armor', cat: 'armor', def: 45, loc: 'body', buy: 70, sell: 35, count: 2, icon: '🏛️', autoReduce: 20,
      text: "Reduces auto-hit damage by 20." },

    // ---------- Specials (24) — draw only ----------
    aqua: { name: 'Aqua Vitae', en: 'Water of Life', type: 'special', cat: 'special', sell: 15, count: 6, icon: '💧', heal: 30, text: "Restore 30 VITA. May be used any time your VITA is above 0." },
    harena: { name: 'Harena', en: 'Sand', type: 'special', cat: 'special', sell: 10, count: 4, icon: '⏳', text: "Reduce an opponent's dodge by 1 for this attack. Declare before you roll." },
    furor: { name: 'Furor', en: 'Rage', type: 'special', cat: 'special', sell: 10, count: 4, icon: '🔥', text: "Add 1 to your hit roll for this attack. Declare before you roll." },
    volumen: { name: 'Volumen Medici', en: "Physician's Scroll", type: 'special', cat: 'special', sell: 10, count: 4, icon: '📜', heal: 20, text: "Restore 20 VITA. May be used any time your VITA is above 0." },
    interceptio: { name: 'Interceptio', en: 'Sabotage', type: 'special', cat: 'special', sell: 10, count: 3, icon: '🕵️',
      text: "Remove an equipped one-handed weapon or armor from any opponent. Its owner gets half its sell value (rounded up to 5)." },
    fortuna: { name: 'Fortuna', en: 'Fortune', type: 'special', cat: 'special', sell: 5, count: 3, icon: '🍀', text: "Equip Phase only. Draw 2 equipment cards, keep 1, discard the other." },

    // ---------- Legendaries (6) — draw only, 1 each ----------
    fulgur: { name: 'Fulgur Iovis', en: 'Lightning of Jupiter', type: 'weapon', cat: 'legendary', legendary: true, atk: 60, hands: 2, sell: 50, count: 1, icon: '⚡', multi: 2,
      text: "Attack 2 players of your choice. Do not draw an Attack card. Roll once and compare it to each target's dodge." },
    hephaesti: { name: 'Lorica Hephaesti', en: 'Armor of Hephaestus', type: 'armor', cat: 'legendary', legendary: true, def: 45, loc: 'body', sell: 50, count: 1, icon: '🔨', negate: true,
      text: "Once per arena, negate one hit entirely (take 0 damage)." },
    ensis: { name: 'Ensis Martis', en: 'Blade of Mars', type: 'weapon', cat: 'legendary', legendary: true, atk: 70, hands: 1, sell: 50, count: 1, icon: '🔥', extra: true,
      text: "On a successful hit, make one extra attack against any Gladiator. The extra attack can't trigger this effect again." },
    talaria: { name: 'Talaria Mercurii', en: 'Sandals of Mercury', type: 'relic', cat: 'legendary', legendary: true, sell: 50, count: 1, icon: '🪽', dodgeBonus: 2,
      text: "Adds 2 to your dodge. Dodge cannot exceed 4." },
    hasta: { name: 'Hasta Achillis', en: 'Spear of Achilles', type: 'weapon', cat: 'legendary', legendary: true, atk: 60, hands: 1, sell: 50, count: 1, icon: '☄️', autoOn: 5,
      text: "Auto-hits on a roll of 5 or 6." },
    cerberus: { name: 'Cerberus', en: 'Hound of Hades', type: 'weapon', cat: 'legendary', legendary: true, beast: 8, hands: 1, sell: 50, count: 1, icon: '🐺', ignoreArmor: true, dodgeMod: 1,
      text: "Damage 8-48. Ignores armor. Reduces opponent's dodge by 1 for this attack." },
  };

  // Attack deck (30), from the v6 card sheets.
  const ATTACK_CARDS = {
    left: { name: 'Attack Left', count: 9, icon: '⬅️', text: 'Attack the player to your left.' },
    right: { name: 'Attack Right', count: 9, icon: '➡️', text: 'Attack the player to your right.' },
    choice: { name: 'Attack Your Choice', count: 6, icon: '🎯', text: 'Attack a player of your choice.' },
    pass: { name: 'Pass', count: 6, icon: '✋', text: 'Do nothing this Attack Phase.' },
  };

  // Hades deck (30 unique cards), from the v6 card sheets.
  //   target: 'one' (the dead player picks a living Gladiator) | 'all' (every living Gladiator)
  //   coin:   flip the Sacred Coin first; only Heads has an effect
  const W = (name, flavor) => ({ name, kind: 'watch', effect: 'none', count: 1, icon: '👁️', text: 'No effect.', flavor });
  const HADES = {
    w_beauty: W('Beauty Contest', 'Persephone is judging a beauty contest. Every shade in Hades is busy voting. You stay, drooling over her beauty.'),
    w_arena: W('The Other Arena', 'Hades is hosting his own games tonight. Nobody down here cares about the living. Bets are on!'),
    w_dog: W('Bad Dog', 'Cerberus slipped his leash again. The whole underworld is chasing him. Including you.'),
    w_lethe: W('Waters of Lethe', 'You drank from the river Lethe and forgot what you meant to do.'),
    w_styx: W('Race on the Styx', "Charon is racing the other ferrymen down the Styx. The dead are placing bets, and your fight isn't on the board."),
    w_fury: W('Bribing a Fury', "You tried to bribe a Fury. It did not go well, and now you're chained for six months."),
    w_sandal: W('Lost Sandal', 'You lost a sandal in the Styx and spent the night fishing for it.'),
    w_paper: W('Paperwork for the Damned', 'Hades put you on judgment duty. The scrolls never end. Bureaucracy is worse than death.'),
    w_funeral: W('Funeral Games', 'You linger to watch your own funeral games. Bittersweet. At least your friends showed up.'),
    w_patience: W('Patience', 'The dead have nothing but time, and today you just feel like watching from below.'),

    m_charon: { name: "Charon's Toll", kind: 'minor', target: 'one', effect: 'toll', amount: 5, count: 1, icon: '🪙',
      text: 'A living Gladiator of your choice pays 5 denarii to the Bank.', flavor: 'Charon short-changed you. Someone up there is paying the difference.' },
    m_fingers: { name: 'Light Fingers', kind: 'minor', target: 'all', effect: 'toll', amount: 5, count: 1, icon: '🤏',
      text: 'All living Gladiators pay 5 denarii to the Bank.', flavor: 'While everyone watched the fight, the shades lifted every purse in the arena.' },
    m_cold: { name: 'Cold Hand', kind: 'minor', target: 'one', effect: 'dmg', amount: 5, count: 1, icon: '🖐️',
      text: 'A living Gladiator of your choice takes 5 damage.', flavor: 'A cold hand brushes the back of their neck. They flinch into the blade.' },
    m_wind: { name: 'Grave Wind', kind: 'minor', target: 'all', effect: 'dmg', amount: 5, count: 1, icon: '🌬️',
      text: 'All living Gladiators take 5 damage.', flavor: 'A wind from the grave sweeps the sand. Everyone feels it in their bones.' },
    m_moan: { name: 'Ghostly Moan', kind: 'minor', target: 'one', effect: 'discard', count: 1, icon: '😱',
      text: 'A living Gladiator of your choice discards 1 card from their hand (their choice).', flavor: 'A moan rises from the sand. Something slips from their grip.' },
    m_face: { name: 'A Familiar Face', kind: 'minor', target: 'one', effect: 'weak', count: 1, icon: '🎭',
      text: 'A living Gladiator of your choice subtracts 1 from their next hit roll.', flavor: 'Among the shades they see a face they buried. Their aim wavers.' },
    m_stalls: { name: 'Stalls Shut', kind: 'minor', target: 'one', effect: 'noBuy', count: 1, icon: '🏚️',
      text: 'A living Gladiator of your choice cannot buy from the Market in their next Equip Phase.', flavor: 'The merchants saw a ghost and closed up shop.' },
    m_straps: { name: 'Rotten Straps', kind: 'minor', target: 'one', effect: 'armorDown', amount: 10, count: 1, icon: '🪢',
      text: 'A living Gladiator of your choice has 10 less armor for the rest of this Attack Phase.', flavor: 'Their straps rot in the underworld air. The armor sags.' },
    m_turned: { name: 'Turned Blade', kind: 'minor', target: 'one', effect: 'turned', count: 1, icon: '🔄',
      text: "You choose the target of a living Gladiator's next attack, instead of their Attack card.", flavor: 'A voice from below whispers in their ear, and their blade turns.' },
    m_knees: { name: 'Weak Knees', kind: 'minor', target: 'one', effect: 'dodgeDown', count: 1, icon: '🦵',
      text: "Reduce a living Gladiator's dodge by 1 for the rest of this Attack Phase.", flavor: "Their knees knock. They're slower than they think." },

    M_claws: { name: 'Claws from Below', kind: 'major', target: 'one', effect: 'dmg', amount: 10, count: 1, icon: '🦴',
      text: 'A living Gladiator of your choice takes 10 damage.', flavor: 'Hands burst from the sand and drag them down.' },
    M_robbers: { name: 'Grave Robbers', kind: 'major', target: 'one', effect: 'toll', amount: 20, count: 1, icon: '⚱️',
      text: 'A living Gladiator of your choice pays 20 denarii to the Bank.', flavor: 'The dead want their burial coins back, with interest.' },
    M_scared: { name: 'Scared to Death', kind: 'major', target: 'one', effect: 'loseWeapon', count: 1, icon: '😨',
      text: 'A living Gladiator of your choice discards 1 equipped weapon of their choice. No refund.', flavor: 'A shriek from below. They drop their sword, and the sand swallows it.' },
    M_breath: { name: 'Stolen Breath', kind: 'major', target: 'one', effect: 'miss', count: 1, icon: '💨',
      text: "A living Gladiator of your choice's next attack automatically misses.", flavor: 'Something whispers their name mid-swing.' },
    M_dreams: { name: 'Haunted Dreams', kind: 'major', target: 'one', effect: 'haunted', count: 1, icon: '🌘',
      text: 'A living Gladiator of your choice cannot draw, buy or equip in their next Equip Phase. They still collect income.',
      flavor: "The dead visit them in their sleep. By morning, they can't bring themselves to touch their gear." },
    M_wrath: { name: 'Wrath of Hades', kind: 'major', target: 'all', coin: true, effect: 'dmg', amount: 20, count: 1, icon: '☠️',
      text: 'Flip the Sacred Coin. Heads: all living Gladiators take 20 damage. Tails: no effect.', flavor: 'The Lord of the Underworld reaches up, and the whole arena trembles.' },
    M_tribute: { name: 'Tribute to the Dead', kind: 'major', target: 'all', coin: true, effect: 'toll', amount: 30, count: 1, icon: '💰',
      text: 'Flip the Sacred Coin. Heads: all living Gladiators pay 30 denarii to the Bank. Tails: no effect.', flavor: 'The dead demand tribute. Every purse in the arena feels lighter.' },
    M_panic: { name: 'Panic', kind: 'major', target: 'all', coin: true, effect: 'discardHand', count: 1, icon: '🏃',
      text: 'Flip the Sacred Coin. Heads: all living Gladiators discard their hand (equipped cards stay). Tails: no effect.', flavor: 'The sand splits open. Everyone drops everything and runs.' },
    M_tremor: { name: 'Tremor', kind: 'major', target: 'all', coin: true, effect: 'loseItem', count: 1, icon: '🌋',
      text: 'Flip the Sacred Coin. Heads: all living Gladiators discard 1 equipped item of their choice. No refund. Tails: no effect.', flavor: 'The ground heaves. Straps snap and buckles break.' },
    M_hands: { name: 'Hands in the Sand', kind: 'major', target: 'global', coin: true, effect: 'noDodge', count: 1, icon: '🙌',
      text: 'Flip the Sacred Coin. Heads: no living Gladiator can dodge for the rest of this Attack Phase. Tails: no effect.', flavor: 'Cold hands grip every ankle in the arena. No one can move.' },
  };

  // Card art: map a card key to an image path (e.g. pugio: 'art/pugio.png'). Empty = emoji placeholders.
  const ART = (root.GLAD_ART || {});

  const RULES = {
    income: 25,
    refreshCost: 20,
    maxBuys: 2,
    marketSize: 3,
    fists: 10,
    reviveVita: 30,
    restlessTurn: 11, // The Crowd Grows Restless
    restlessDmg: 10,
    archerTurn: 15, // the Emperor's archers fire once
    archerDmg: 30,
    bribeCost: 30, // Bribe the Lanista
    laurelsToWin: 3,      // up to 3 players
    laurelsToWinBig: 2,   // 4 or more players
    dodgeMin: 1,
    dodgeMax: 4,
  };

  root.GLAD_DATA = { GLADIATORS, CARDS, ATTACK_CARDS, HADES, RULES, ART };
})(typeof window !== 'undefined' ? window : globalThis);
