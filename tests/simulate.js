/* Headless AI-vs-AI simulation: node tests/simulate.js [games] */
require('../js/data.js');
require('../js/engine.js');
require('../js/ai.js');
const { Game, loadoutError } = globalThis.GladiatorEngine;

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const N = +process.argv[2] || 200;
let totalArenas = 0, totalTurns = 0, timeouts = 0;
const wins = {};
(async () => {
  for (let g = 0; g < N; g++) {
    const n = 2 + (g % 5);
    let game;
    const check = () => {
      for (const p of game.players) {
        if (!p.glad) continue;
        const e = loadoutError(p.glad.key, p.glad.equipped);
        if (e) throw new Error(`illegal loadout for ${p.name}: ${e}`);
        if (p.gold < 0) throw new Error('negative gold');
        if (p.glad.vita < 0 || p.glad.vita > p.glad.max) throw new Error(`bad vita ${p.glad.vita}`);
      }
    };
    const io = {
      log: (m) => { if (/Emperor grows bored/.test(m)) timeouts++; },
      update: check,
      delay: async () => {},
      choose: async () => { throw new Error('no humans'); },
      humanEquip: async () => { throw new Error('no humans'); },
      showRoll: async () => {}, showFlip: async () => {}, showCard: async () => {},
    };
    game = new Game({ players: Array.from({ length: n }, (_, i) => ({ name: `AI${i}`, ai: true })) }, io, mulberry32(g + 1));
    const champ = await game.run();
    totalArenas += game.arena;
    wins[n] = (wins[n] || 0) + 1;
  }
  console.log(`OK: ${N} games, avg ${(totalArenas / N).toFixed(1)} arenas/game, ${timeouts} arena timeouts`);
})().catch((e) => { console.error(e); process.exit(1); });
