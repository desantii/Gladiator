# Gladiator

A browser version of **Gladiator**, a card game for 2–6 players, built from the v6.1 rules manual ([`docs/rules-v6.1.md`](docs/rules-v6.1.md)).

Equip your Gladiator with weapons and armor, attack with cards and dice, and be the last one standing. Win 3 arenas to be crowned Champion.

## Play

Open `index.html` in any modern browser. There's nothing to install or build.

- Choose 2–6 players. Each seat can be a human (hot-seat on one device) or a computer opponent.
- **Equip Phase:** collect 30 denarii, sell cards, refresh the Market (20), then draw 1 free card **or** buy up to 2. Equip and unequip freely, then press **End Equip Phase**.
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

Run the simulation with `node tests/simulate.js 300`.

## Sources

- Rules: v6.1 manual ([`docs/rules-v6.1.md`](docs/rules-v6.1.md)).
- Card counts and texts: v6 print sheets, including the 30 unique Hades cards and the Attack deck split (9 Left, 9 Right, 6 Your Choice, 6 Pass).
- Card art: none yet. Each card shows an emoji in its art box. To add art, map card keys to image paths in `window.GLAD_ART`, e.g. `{ pugio: 'art/pugio.png' }`, loaded before `js/data.js`.

## Interpretations

The rules leave a few details open. This version assumes:

- **Armor piercing:** Pilum and Sica stack and apply to the whole attack. Clava then halves the remaining armor. Leo, Canis and Cerberus damage ignores armor entirely.
- **Auto-hit reductions:** Lorica Squamata (−10), Lorica Segmentata (−20) and Ursus (−10) reduce auto-hit damage, to a minimum of 5.
- A Gladiator whose only weapon is a Rete still punches for 10.
- The 1-Legendary limit applies to equipped items.
- "Left" is the next seat; dead Gladiators are skipped. When a single-target Hades card is drawn, the dead player chooses the living target.
- **Haunted Dreams** also blocks unequipping and playing Fortuna. **Turned Blade** lasts until that Gladiator's next attack, and overrides a Pass. **Weak Knees** is a dodge reduction, so it doesn't affect Amazonia. The Retiarius' locked Rete can't be lost to Hades either.
- Healing (Aqua Vitae, Volumen Medici) can be used during your Equip Phase, from your hand at any time, and is offered after you take damage.
