# Startup build

`app-fast.js` is generated from `js/app.js` and its static dependencies with esbuild 0.28.2. It contains the unchanged source implementations of the TravelIt modules, including its KeepIt consumer hooks. The canonical KeepIt native writer is not rebuilt or changed.

Build from repository root:

```
npx esbuild@0.28.2 partners/travelit/thinkit/afda98f5ced9406d0fe5/js/app.js --bundle --format=esm --platform=browser --target=es2020 --minify '--external:./excel-preview.js*' --outfile=partners/travelit/thinkit/afda98f5ced9406d0fe5/js/app-fast.js
```

Commit source and generated output together. CI rebuilds and compares the bytes. Excel parsing and its worker/vendor code stay on demand. The connected entry preloads native shell dependencies, defers nonessential presentation styles, and preloads the TravelIt bundle only on the TravelIt route. No network or application data are copied into a different repository or origin.

Map pack integrity checks are deferred until offline-map tools or More need them, then cached by the existing map revision. Online street maps do not require offline map archives to open. Every map mutation still increments the map revision and forces revalidation when offline references are next used.
