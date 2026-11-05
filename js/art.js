/* Card images. Finished card faces (name, text and stats printed on the image) go in GLAD_CARD_FACES;
 * illustration-only art for the in-game card frame goes in GLAD_ART. Keys are card keys from data.js. */
(function (root) {
  root.GLAD_CARD_FACES = {
    vulgaris: 'art/web/vulgaris.webp',
    velox: 'art/web/velox.webp',
    bestia: 'art/web/bestia.webp',
    retiarius: 'art/web/retiarius.webp',
    invictus: 'art/web/invictus.webp',
    debilis: 'art/web/debilis.webp',
  };
  root.GLAD_ART = root.GLAD_ART || {};
})(typeof window !== 'undefined' ? window : globalThis);
