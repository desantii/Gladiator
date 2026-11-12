# Gladiator

A browser version of **Gladiator**, a card game for 2–6 players, built from the v6.4 rules manual ([`docs/rules-v6.4.md`](docs/rules-v6.4.md)).

Equip your Gladiator with weapons and armor, attack with cards and dice, and be the last one standing. Win 3 arenas to be crowned Champion.

## Play

Open `index.html` in any modern browser. There's nothing to install or build.

- Choose 2–6 players. Each seat can be a human (hot-seat on one device) or a computer opponent.
- **Equip Phase:** collect 25 denarii, sell cards, refresh the Market (20), then draw 1 free card **or** buy up to 2. Equip and unequip freely, then press **End Equip Phase**.
- **Attack Phase:** runs automatically. You're prompted for any decision: targets, Harena/Furor, Velox reroll, Lorica Hephaesti, Flagrum discards, healing.
- Use the **Speed** menu to slow down or skip animations. **Rules** opens the in-game reference.

## Project layout

| File | What it does |
| --- | --- |
| `js/data.js` | All Gladiator, Equipment, Attack and Hades card data |
| `js/engine.js` | Rules engine (no DOM), driven through a small `io` interface |
| `js/ai.js` | Computer opponents |
| `js/ui.js`, `css/style.css`, `index.html` | Browser interface |
| `tests/simulate.js` | Headless AI-vs-AI games that check rule invariants |
| `lab.html`, `js/lab.js` | Balance lab: edit rules and card stats, run AI games, compare with v6.4 |
| `art/` | Card images (see `art/README.md`) |

Run the simulation with `node tests/simulate.js 300`.

## Sources

- Rules: v6.4 manual ([`docs/rules-v6.4.md`](docs/rules-v6.4.md)).
- Card counts and texts: v6.3 print sheets, including the 30 unique Hades cards and the Attack deck split (9 Left, 9 Right, 6 Your Choice, 6 Pass).
- Card art: none yet. Each card shows an emoji in its art box. To add art, map card keys to image paths in `window.GLAD_ART`, e.g. `{ pugio: 'art/pugio.png' }`, loaded before `js/data.js`.

## Changes after v6.4

Playtest changes not yet in the printed manual:

- **Laurels to win:** 3 with 2–3 players, **2 with 4 or more**.
- **Gladius** 9 → **8** copies; **Sica** 3 → **4** copies.
- **Scutum:** buy 35 → **45**, sell 20 → **25**.
- **Lorica Segmentata:** buy 55 → **70**, sell 30 → **35**.

The printed Scutum and Lorica Segmentata card art still shows the old prices.

## Interpretations

The crowd, archers, Furor Mortis and Bribe the Lanista rules below come from the v6.4 manual; the rest are this version's readings of details the rules leave open:

- **The Crowd Grows Restless**: the crowd hurls stones. From turn 11 of an arena, at the start of each turn every living Gladiator loses 10 VITA, in turn order. It ignores armor and can't trigger Furor Mortis; the Sacred Coin flip applies as usual. If the stones eliminate everyone at once, the Gladiator with the most VITA before the stones wins the arena; a tie means no laurel.
- **The Emperor's Archers**: on turn 15 the volley does 30 VITA instead of 10 (70 VITA lost in total by the end of turn 15); the stones return to 10 from turn 16. The stones tiebreak also covers the archers.
- **Bribe the Lanista:** before drawing an Attack card, a living Gladiator may pay 30 denarii to attack a Gladiator of their choice instead (not in 2-player games). It isn't offered when Turned Blade already sets the target, or when Fulgur Iovis replaces the Attack card.
- **Furor Mortis on the last Gladiator**: if a final attack eliminates the last Gladiator standing, that Gladiator (the killer) still wins the arena, since they outlived their opponent. Any other way that nobody is left standing earns no laurel.
- **Armor-ignoring weapons:** Pilum (ignores shield and body armor) and Sica (ignores shield and arm armor) apply to the whole attack, so a Pilum + Sica pair skips shield, body and arm armor. Ignored body armor also loses its auto-hit reduction. Clava then halves the remaining armor. Leo, Canis and Cerberus damage ignores armor entirely.
- **Auto-hit reductions:** Lorica Squamata (−10), Lorica Segmentata (−20) and Ursus (−10) reduce auto-hit damage, to a minimum of 5.
- A Gladiator whose only weapon is a Rete still punches for 10.
- The 1-Legendary limit applies to equipped items.
- "Left" is the next seat; dead Gladiators are skipped. When a single-target Hades card is drawn, the dead player chooses the living target.
- **Haunted Dreams** also blocks unequipping and playing Fortuna. **Turned Blade** lasts until that Gladiator's next attack, and overrides a Pass. **Weak Knees** is a dodge reduction, so it doesn't affect Amazonia. The Retiarius' locked Rete can't be lost to Hades either.
- Healing (Aqua Vitae, Volumen Medici) can be used during your Equip Phase, from your hand at any time, and is offered after you take damage.
