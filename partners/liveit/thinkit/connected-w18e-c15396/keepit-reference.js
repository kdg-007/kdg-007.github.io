/* Shared by the LiveIt record store and its portable calendar envelope. */
(() => {
  'use strict';
  const limit = 20;
  const isScope = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
  const isItemId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  const key = link => link.scope + ':' + link.itemId;
  function normalize(links) {
    if (links === undefined) return [];
    if (!Array.isArray(links) || links.length > limit) throw Error('Invalid KeepIt links.');
    const seen = new Set();
    return links.map(link => {
      if (!link || !isScope(link.scope) || !isItemId(link.itemId) ||
          !['file', 'note'].includes(link.kind) ||
          typeof link.title !== 'string' || !link.title.trim() || link.title.length > 256) {
        throw Error('Invalid KeepIt link.');
      }
      if (seen.has(key(link))) throw Error('Duplicate KeepIt link.');
      seen.add(key(link));
      return {scope:link.scope, itemId:link.itemId, kind:link.kind, title:link.title};
    });
  }
  globalThis.LiveItKeepItReferences = Object.freeze({limit, isItemId, key, normalize});
})();
