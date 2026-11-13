# Startup build

`app-fast.js` is generated from `js/app.js` and its static dependencies with esbuild 0.28.2. It contains the unchanged source implementations of the TravelIt modules, including its KeepIt consumer hooks. The canonical KeepIt native writer is not rebuilt or changed.

Build from repository root:

```
KEEPIT_ESBUILD=/path/to/esbuild node ops/ui/build-travelit-runtime.mjs
```

Commit source and generated output together. CI rebuilds and compares the bytes. Excel parsing and its worker/vendor code stay on demand. The connected entry preloads native shell dependencies, defers nonessential presentation styles, and preloads the TravelIt bundle only on the TravelIt route. No network or application data are copied into a different repository or origin.

Map pack integrity checks are deferred until offline-map tools or More need them, then cached by the existing map revision. Online street maps do not require offline map archives to open. Every map mutation still increments the map revision and forces revalidation when offline references are next used.

Leaflet is loaded on demand when the street-map view opens. Other views become interactive without downloading or executing it. Failed loads can be retried from Map tools. A late response cannot mount a map after the user leaves Map. Foreground returns read workspace metadata first; unchanged data retain their live map and tiles, while real record, map or generation changes still refresh.
