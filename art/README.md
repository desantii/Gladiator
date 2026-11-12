# Card art

All 40 gladiator and equipment cards are in place (final versions). `web/` holds the 560px WebP copies the game loads; regenerate them if a card changes, and bump the `?v=` number in `js/art.js` so browsers fetch the new image. Attack, Hades and card-back art can be added the same way.

Put card images in this folder. Finished cards (with name, text and stats printed on them) are fine.

Name each file after its card, in lower case, e.g. `vulgaris.png`. PNG, JPG and WebP all work.

| Group | File names |
| --- | --- |
| Gladiators | `vulgaris`, `velox`, `bestia`, `retiarius`, `debilis`, `invictus`, `amazonia` |
| Weapons | `pugio`, `gladius`, `pilum`, `sica`, `clava`, `tridens`, `spatha`, `flagrum`, `rete`, `leo`, `ursus`, `canis` |
| Armor | `subarmalis`, `parma`, `manica`, `ocreae`, `cassis`, `galea`, `scutum`, `squamata`, `segmentata` |
| Specials | `aqua`, `harena`, `furor`, `volumen`, `interceptio`, `fortuna` |
| Legendaries | `fulgur`, `hephaesti`, `ensis`, `talaria`, `hasta`, `cerberus` |
| Attack / Hades / backs | `attack-left`, `attack-right`, `attack-choice`, `attack-pass`, `hades-<card>`, `back-gladiator`, `back-equipment`, `back-attack`, `back-hades` |

Cards without an image keep their placeholder icon.
