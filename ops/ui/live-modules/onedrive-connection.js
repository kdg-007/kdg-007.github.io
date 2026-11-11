import { a as se, c as A } from "./chunk-C6CZGXK7.js";
import { a as ee, b as q, c as ie } from "./keepit-owner-preflight-c24bd88c2a1e.js";
import { k as he } from "./chunk-7XPOT35Y.js";
import { a as re, b as ae, c as ne, d as oe } from "./AUTH_MODULE.js";
import "./chunk-RUHSRXQX.js";
import "./chunk-J6337TYC.js";
import { a as b, f as k, g as D, l as j, m as te } from "./chunk-VUEURUCM.js";
import "./chunk-4IPXVWW5.js";
import { M as d, Q as P, h as W, y as Z } from "./chunk-3XLEL25X.js";
import { m as E } from "./chunk-AAYJLHGB.js";
import "./chunk-ZJV7P25W.js";
import { l as X } from "./chunk-G42SHEZJ.js";
import { b as y } from "./chunk-ZKN76T53.js";
import "./chunk-OOJM4CTU.js";
var N = (h, e) => JSON.stringify(["original-v1", h, e.id, e.digest, e.bytes]), O = class {
  constructor({ name: e = "keepit-originals-cache-v1", maxBytes: t = 256 * 1024 ** 2, maxFileBytes: i = 64 * 1024 ** 2, maxEntries: s = 512 } = {}) {
    this.db = new E(e), this.db.version(1).stores({ files: "&key", sizes: "&key,used" }), Object.assign(this, { maxBytes: t, maxFileBytes: i, maxEntries: s });
  }
  async get(e, t) {
    try {
      let i = await this.db.files.get(e);
      return i ? !(i.blob instanceof Blob) || i.blob.size !== t.bytes || await y(i.blob) !== t.digest ? (await this.remove(e), null) : (await this.db.transaction("rw", this.db.sizes, async () => {
        let s = await this.db.sizes.orderBy("used").last();
        await this.db.sizes.update(e, { used: Math.max(Date.now(), (s?.used || 0) + 1) });
      }), i) : null;
    } catch {
      return null;
    }
  }
  async put(e, t, i, s, { isCurrent: r = () => true } = {}) {
    try {
      return !r() || i.size > this.maxFileBytes || i.size > this.maxBytes || i.size !== t.bytes || await y(i) !== t.digest ? false : (await this.db.transaction("rw", this.db.files, this.db.sizes, async () => {
        if (!r()) return;
        let a = await this.db.sizes.orderBy("used").last();
        await this.db.files.put({ key: e, blob: i, version: s }), await this.db.sizes.put({ key: e, bytes: i.size, used: Math.max(Date.now(), (a?.used || 0) + 1) });
        let n = await this.db.sizes.orderBy("used").toArray(), o = n.reduce((u, c) => u + c.bytes, 0), l = n.length;
        for (let u of n) {
          if (o <= this.maxBytes && l <= this.maxEntries) break;
          await this.db.files.delete(u.key), await this.db.sizes.delete(u.key), o -= u.bytes, l--;
        }
      }), true);
    } catch {
      return false;
    }
  }
  async clearScope(e, t) {
    try {
      let i = await this.db.sizes.toArray();
      for (let s of i) {
        let r;
        try {
          r = JSON.parse(s.key);
        } catch {
          continue;
        }
        e.every((a, n) => r[1]?.[n] === a) && (!t || r[2] === t) && await this.remove(s.key);
      }
    } catch {
    }
  }
  async remove(e) {
    try {
      await this.db.transaction("rw", this.db.files, this.db.sizes, async () => {
        await this.db.files.delete(e), await this.db.sizes.delete(e);
      });
    } catch {
    }
  }
};
var J = (h) => typeof h == "string" && h.length <= 85 && /^(?:Archives\/)?[A-Z0-9]+(?:-[A-Z0-9]+)+\.[a-z0-9]{1,10}$/.test(h), F = (h) => JSON.stringify(["cloud-catalog-v1", h.homeId, h.driveId, h.rootId]);
function ce(h, e) {
  d(h?.libraryId === e && h.info?.libraryId === e && h.info.revision === h.revision && Array.isArray(h.items) && h.paths && typeof h.paths == "object", "Invalid cached catalog."), se(h, `${String(h.revision).padStart(10, "0")}-${h.commitId}.json`, e), h.info.metadataSchema && Z(h.info.metadataSchema), h.info.platformAssociationsV1 && W(h.info.platformAssociationsV1);
  let t = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
  for (let r of h.items) {
    let a = P(r), n = h.paths[a.id];
    d(!t.has(a.id) && (!s.has(a.digest) || a.duplicateOf) && J(n) && !i.has(n) && !!a.archivedAt === n.startsWith("Archives/"), "Invalid cached records."), t.add(a.id), i.add(n), a.duplicateOf || s.add(a.digest);
  }
  d(Object.keys(h.paths).length === t.size, "Unexpected cached paths.");
}
function de(h, e) {
  d(h?.format === "keepit-cloud-checkpoint-1" && h.scope === e, "Cached library binding changed.");
  let { identity: t, index: i, verified: s } = h;
  d(t?.libraryId === i?.libraryId && typeof s?.legacySignature == "string" && s.headId === i.headId && s.headName === `head-${s.state?.commitId}.json` && typeof s.headETag == "string", "Invalid cached connection."), ce(s.state, t.libraryId), s.legacyState && ce(s.legacyState, t.libraryId), d((s.legacyState?.commitId || null) === i.legacyCommitId, "Cached legacy identity changed.");
  let r = new Map(s.historicalPaths), a = new Map(s.historicalOriginals);
  for (let [n, o] of r) d(Array.isArray(o) && o.every(J), "Invalid cached history."), r.set(n, new Set(o));
  for (let [n, o] of a) if (d(J(n) && /^[a-f0-9]{64}$/.test(o?.digest) && Number.isSafeInteger(o.bytes) && o.bytes >= 0, "Invalid cached original."), o.item) {
    let l = P(o.item);
    d(l.digest === o.digest && l.bytes === o.bytes, "Cached original identity changed.");
  }
  for (let n of s.state.items) {
    let o = s.state.paths[n.id], l = a.get(o);
    d(r.get(n.id)?.has(o) && l?.digest === n.digest && l.bytes === n.bytes, "Cached original history is incomplete.");
  }
  return { ...h, verified: { ...s, historicalPaths: r, historicalOriginals: a } };
}
var x = class {
  constructor({ name: e = "keepit-cloud-catalog-v1", maxBytes: t = 32 * 1024 ** 2, maxEntries: i = 4 } = {}) {
    this.db = new E(e), this.db.version(1).stores({ checkpoints: "&scope,savedAt" }), this.maxBytes = t, this.maxEntries = i;
  }
  async get(e) {
    try {
      let t = F(e), i = await this.db.checkpoints.get(t);
      if (!i || i.text.length > this.maxBytes || await y(new Blob([i.text])) !== i.digest) return null;
      let s = de(JSON.parse(i.text), t);
      return d(s.index.rootId === e.rootId && s.index.driveId === e.driveId, "Cached root changed."), { ...s, savedAt: i.savedAt };
    } catch {
      return null;
    }
  }
  async put(e, { identity: t, index: i, verified: s, displayPath: r, rootName: a }) {
    try {
      let n = F(e), o = { format: "keepit-cloud-checkpoint-1", scope: n, identity: t, index: i, displayPath: r, rootName: a, verified: { ...s, historicalPaths: [...s.historicalPaths].map(([c, f]) => [c, [...f]]), historicalOriginals: [...s.historicalOriginals] } }, l = JSON.stringify(o);
      if (new Blob([l]).size > this.maxBytes) return false;
      de(JSON.parse(l), n);
      let u = { scope: n, text: l, bytes: new Blob([l]).size, digest: await y(new Blob([l])), savedAt: Date.now() };
      return await this.db.transaction("rw", this.db.checkpoints, async () => {
        let c = await this.db.checkpoints.get(n);
        if (c) try {
          if (JSON.parse(c.text).identity.libraryId === t.libraryId && JSON.parse(c.text).verified.state.revision > s.state.revision) return;
        } catch {
        }
        await this.db.checkpoints.put(u);
        let f = await this.db.checkpoints.orderBy("savedAt").toArray(), m = f.reduce((v, g) => v + (g.bytes ?? g.text.length), 0), w = f.length;
        for (let v of f) {
          if (m <= this.maxBytes && w <= this.maxEntries) break;
          await this.db.checkpoints.delete(v.scope), m -= v.bytes ?? v.text.length, w--;
        }
      }), true;
    } catch {
      return false;
    }
  }
  async remove(e) {
    try {
      await this.db.checkpoints.delete(F(e));
    } catch {
    }
  }
}, z = class {
  constructor(e, t, { originalCache: i = new O() } = {}) {
    this.isCloud = true, this.readOnly = true, this.cachedAt = t.savedAt, this.state = t.verified.state, this.identity = t.identity, this.root = { name: t.rootName || "KeepIt", item: { id: e.rootId } }, this.displayPath = e.path || t.displayPath, this.fs = { homeId: e.homeId, driveId: e.driveId, auth: { reconnectRequired: false } }, this.originalCache = i;
  }
  async list() {
    return structuredClone(this.state.items);
  }
  async info() {
    return structuredClone(this.state.info);
  }
  async close() {
  }
  async getItem(e) {
    return structuredClone(this.state.items.find((t) => t.id === e));
  }
  unavailable() {
    throw new Error("This is the last verified gallery. Reconnect OneDrive to open originals or change saved entries. Queued files remain on this device.");
  }
  async original(e) {
    let t = await this.getItem(e);
    if (!t || t.trashedAt || !X(t)) return this.unavailable();
    let i = [this.fs.homeId, this.fs.driveId, this.root.item.id, this.identity.libraryId, this.state.paths[e]], s = await this.originalCache.get(N(i, t), t);
    return d(s?.blob, "This note is not available on this device. Reconnect OneDrive; no empty replacement was created."), s.blob;
  }
  async savePrintTemplates() {
    return this.unavailable();
  }
  async restore() {
    return this.unavailable();
  }
  async edit() {
    return this.unavailable();
  }
  async trash() {
    return this.unavailable();
  }
  async archive() {
    return this.unavailable();
  }
  async duplicate() {
    return this.unavailable();
  }
  async remove() {
    return this.unavailable();
  }
  async saveNote() {
    return this.unavailable();
  }
  async importFile() {
    return this.unavailable();
  }
  async saveSchema() {
    return this.unavailable();
  }
  async snapshot() {
    return this.unavailable();
  }
  async markBackup() {
    return this.unavailable();
  }
};
var ue = (...h) => globalThis.fetch(...h), le = { AUTH_REQUIRED: "Microsoft needs you to reconnect. Your selected library and queued files are retained.", SERVER_CONFIGURATION_REQUIRED: "KeepIt\u2019s Microsoft connection needs a server configuration update. Repeated sign-in will not fix it.", NOT_CONNECTED: "Connect Microsoft once to enable persistent access.", SITE_SIGN_IN_REQUIRED: "Your KeepIt site session needs sign-in. Reopen KeepIt in your browser.", ACCOUNT_CHANGED: "Reconnect the Microsoft account that owns this library.", RENEWAL_IN_PROGRESS: "Microsoft access is renewing. Try again shortly.", MICROSOFT_UNAVAILABLE: "Microsoft is temporarily unavailable. Your connection details are retained." }, K = class {
  #e = null;
  invalidateToken() {
    this.#e = null;
  }
  constructor({ fetcher: e = ue, navigate: t = (s) => location.assign(s), wait: i = (s) => new Promise((r) => setTimeout(r, s)) } = {}) {
    this.fetcher = e, this.navigate = t, this.wait = i, this.current = null, this.reconnectRequired = false, this.pending = null, this.generation = 0;
  }
  async call(e, t) {
    let i = this.generation, s = [200, 400, 800, 1200, 1800];
    for (let r = 0; ; r++) {
      if (i !== this.generation) throw new b("ACCOUNT", "Connection changed during this request.");
      let a = await this.fetcher("/api/onedrive/" + e, { method: t === void 0 ? "GET" : "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: t === void 0 ? {} : { "Content-Type": "application/json", "X-KeepIt-Request": "1" }, body: t === void 0 ? void 0 : JSON.stringify(t), signal: AbortSignal.timeout(25e3) }), n = await a.json();
      if (!a.ok && n.error === "RENEWAL_IN_PROGRESS" && e === "access-token" && r < s.length) {
        await this.wait(s[r]);
        continue;
      }
      if (!a.ok) throw new b(["AUTH_REQUIRED", "NOT_CONNECTED"].includes(n.error) ? "AUTH_REQUIRED" : n.error || "CONNECTION_ERROR", le[n.error] || "The persistent connection could not finish. Retry shortly.");
      return n;
    }
  }
  async initialize() {
    this.invalidateToken();
    let e = await this.call("status");
    return this.current = e.account || null, this.reconnectRequired = !!e.reauthRequired, this.current;
  }
  account() {
    return this.current;
  }
  async signIn() {
    let e = await this.call("connect", { expectedHomeId: this.current?.homeAccountId || this.expectedHomeId || null }), t = new URL(e.authorizeUrl);
    if (t.origin !== "https://login.microsoftonline.com" || t.pathname !== "/consumers/oauth2/v2.0/authorize") throw new Error("Unexpected Microsoft sign-in destination.");
    this.navigate(t.href);
  }
  async token(e) {
    if (this.current?.homeAccountId !== e) throw new b("ACCOUNT", "Reconnect the account that owns this library.");
    if (this.reconnectRequired) throw new b("AUTH_REQUIRED", le.AUTH_REQUIRED);
    if (this.#e?.homeId === e && this.#e.until > Date.now()) return this.#e.value;
    if (this.pending) return this.pending;
    let t = this.generation;
    return this.pending = (async () => {
      try {
        let i = await this.call("access-token", { expectedHomeId: e });
        if (this.generation !== t || this.current?.homeAccountId !== e || i.account?.homeAccountId !== e) throw new b("ACCOUNT", "Connection changed during renewal.");
        if (typeof i.accessToken != "string" || !i.accessToken) throw new b("CONNECTION_ERROR", "Microsoft access could not be renewed.");
        return Number.isFinite(i.expiresAt) && i.expiresAt > Date.now() + 6e4 && (this.#e = { homeId: e, value: i.accessToken, until: Math.min(Date.now() + 12e4, i.expiresAt - 6e4) }), i.accessToken;
      } catch (i) {
        throw i.code === "AUTH_REQUIRED" && this.generation === t && this.current?.homeAccountId === e && (this.reconnectRequired = true), i;
      } finally {
        this.pending = null;
      }
    })(), this.pending;
  }
  async signOut() {
    this.invalidateToken(), await this.call("disconnect", {}), this.generation++, this.current = null, this.reconnectRequired = false;
  }
};
async function fe(h = ue, { required: e = false } = {}) {
  let t = e;
  try {
    t = e || globalThis.localStorage?.getItem("keepit-auth-kind-1") === "persistent";
  } catch {
  }
  let i;
  try {
    i = await h("/api/onedrive/status", { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5e3) });
  } catch {
    if (t) throw new b("BROKER_UNAVAILABLE", "Your persistent connection is temporarily unreachable. Retry shortly.");
    return null;
  }
  if (i.status === 404) {
    if (t) throw new b("BROKER_UNAVAILABLE", "The persistent connection service is unavailable.");
    return null;
  }
  let s;
  try {
    s = await i.json();
  } catch {
    if (t) throw new b("BROKER_UNAVAILABLE", "The persistent connection service is unavailable.");
    return null;
  }
  if (s.error === "BROKER_NOT_CONFIGURED") {
    if (t) throw new b("BROKER_UNAVAILABLE", "The persistent connection service needs configuration.");
    return null;
  }
  if (!i.ok) throw new b(s.error || "BROKER_UNAVAILABLE", "The persistent connection is unavailable. Retry shortly.");
  if (s.mode !== "persistent") {
    if (t) throw new b("BROKER_UNAVAILABLE", "The persistent connection service returned an unexpected response.");
    return null;
  }
  try {
    globalThis.localStorage?.setItem("keepit-auth-kind-1", "persistent");
  } catch {
  }
  let r = new K({ fetcher: h });
  return r.current = s.account || null, r.reconnectRequired = !!s.reauthRequired, r;
}
function H(h) {
  let e = h.errorCode || h.code || "";
  return ["AUTH_REQUIRED", "AUTH_TIMEOUT", "timed_out", "monitor_window_timeout"].includes(e) ? "Microsoft sign-in did not finish or needs renewal. Select Reconnect Microsoft to continue. Your selected folder and queued files are retained." : e === "interaction_in_progress" ? "A Microsoft sign-in is already in progress. Finish it in the window that opened, then return to KeepIt." : h.message || "The connection did not finish. Retry when your network is available.";
}
var U = class {
  constructor(e = "keepit-transfer-sessions-v1") {
    this.db = new E(e), this.db.version(1).stores({ sessions: "&key,expiresAt" }), this.memory = /* @__PURE__ */ new Map();
  }
  async get(e) {
    try {
      return await this.db.sessions.get(e) || this.memory.get(e);
    } catch {
      return this.memory.get(e);
    }
  }
  async put(e, t) {
    let i = { ...t, key: e, expiresAt: Date.parse(t.expirationDateTime) };
    this.memory.set(e, i);
    try {
      await this.db.sessions.put(i);
    } catch {
    }
  }
  async remove(e) {
    this.memory.delete(e);
    try {
      await this.db.sessions.delete(e);
    } catch {
    }
  }
};
function ge(h) {
  return h?.details?.status === 400 && /^invalidRequest$/i.test(h?.details?.providerCode || "");
}
async function pe({ error: h, size: e, minimalSession: t, directUpload: i } = {}) {
  if (!ge(h)) throw h;
  if (!Number.isSafeInteger(e) || e < 0) throw new Error("Invalid original size for OneDrive recovery.");
  if (e > 33554432) try {
    return { session: await t(), mode: "minimal-session" };
  } catch (s) {
    if (!ge(s)) throw s;
  }
  if (e <= 104857600) return { saved: await i(), mode: "bounded-direct" };
  throw new Error("OneDrive rejected both upload session formats. Original remains queued; cloud save is NOT confirmed.");
}
async function me({ item: h, parent: e, name: t, bytes: i, expectedDigest: s, read: r, hash: a }) {
  if (!h) return null;
  let n = (u) => {
    let c = new Error("OneDrive has not verified the original (" + u + "). The queued copy is retained; no overwrite was attempted.");
    throw c.code = "ORIGINAL_UNVERIFIED", c.details = { expectedBytes: i, observedBytes: Number.isSafeInteger(h?.size) ? h.size : null }, c;
  };
  (!h.file || !h.id || h.parentReference?.id !== e || h.name !== t || h.size !== i) && n("metadata differs");
  let o;
  try {
    o = await r(h);
  } catch {
    return n("readback unavailable");
  }
  o?.size !== i && n("byte length differs");
  let l;
  try {
    l = await a(o);
  } catch {
    return n("checksum unavailable");
  }
  return l !== s && n("checksum differs"), h;
}
var T = encodeURIComponent, B = () => new DOMException("File not found in OneDrive.", "NotFoundError"), _ = class {
  constructor(e, { fetcher: t = fetch, onProgress: i = () => {
  }, previewCacheBytes: s = 32 * 1024 ** 2, previewFileBytes: r = 8 * 1024 ** 2, previewCacheEntries: a = 128, sessionStore: n = new U() } = {}) {
    this.sessionStore = n, this.auth = e, this.homeId = e.account()?.homeAccountId, this.onProgress = i, this.provider = new he({ auth: e, fetcher: t, store: null }), this.originalDirectories = /* @__PURE__ */ new Set(), this.allowed = /* @__PURE__ */ new Set(), this.cache = /* @__PURE__ */ new Map(), this.observedReads = /* @__PURE__ */ new Map(), d(Number.isSafeInteger(s) && s >= 0 && Number.isSafeInteger(r) && r >= 0 && Number.isSafeInteger(a) && a >= 0, "Invalid preview cache budget."), this.previewBudget = s, this.previewFileBytes = r, this.previewEntries = a, this.previewBytes = 0, this.previewCache = /* @__PURE__ */ new Map();
  }
  clearPreviewCache() {
    this.previewCache.clear(), this.previewBytes = 0;
  }
  retainPreview(e, t) {
    if (!(!this.previewBudget || !this.previewEntries || t.size > this.previewFileBytes || t.size > this.previewBudget)) {
      for (this.previewCache.has(e) && (this.previewBytes -= this.previewCache.get(e).size, this.previewCache.delete(e)); (this.previewBytes + t.size > this.previewBudget || this.previewCache.size >= this.previewEntries) && this.previewCache.size; ) {
        let i = this.previewCache.keys().next().value;
        this.previewBytes -= this.previewCache.get(i).size, this.previewCache.delete(i);
      }
      this.previewCache.set(e, t), this.previewBytes += t.size;
    }
  }
  guard() {
    d(this.homeId && this.auth.account()?.homeAccountId === this.homeId, "Reconnect the Microsoft account that owns this library.");
  }
  path(e, t = "") {
    return `/v1.0/drives/${T(this.driveId)}/items/${T(e)}${t}`;
  }
  async json(e, t, i, s) {
    this.guard();
    try {
      return await this.provider.json(e, t, i, s);
    } catch (r) {
      let a = e === "POST" ? t.endsWith("/createUploadSession") ? "start file upload" : "create library folder" : e === "PATCH" ? "publish catalog change" : "read folder or catalog";
      throw r.message = r.message.replace("Graph metadata", a), r;
    }
  }
  async initialize() {
    let e = await this.json("GET", "/v1.0/me/drive");
    return d(e.driveType === "personal", "Connect your personal OneDrive account."), this.driveId = e.id, this.provider.context = { homeId: this.homeId, driveId: this.driveId }, this.json("GET", `/v1.0/drives/${T(this.driveId)}/root`);
  }
  async item(e) {
    return this.json("GET", this.path(e));
  }
  validate(e, t) {
    return d(e && !e.remoteItem && (!e.parentReference?.driveId || e.parentReference.driveId === this.driveId) && (!t || e.parentReference?.id === t), "OneDrive returned an item outside the selected folder."), e;
  }
  async children(e) {
    let t = [], i = this.path(e, "/children"), s = i;
    for (; s; ) {
      let r = new URL(s, "https://graph.microsoft.com");
      d(r.origin === "https://graph.microsoft.com" && r.pathname === i, "OneDrive returned an unexpected folder page.");
      let a = await this.json("GET", s);
      d(Array.isArray(a.value), "OneDrive returned an invalid folder listing."), t.push(...a.value.filter((n) => !n.remoteItem).map((n) => this.validate(n, e))), s = a["@odata.nextLink"];
    }
    return t;
  }
  async child(e, t) {
    k(t);
    try {
      return this.validate(await this.json("GET", this.path(e, `:/${T(t)}`)), e);
    } catch (i) {
      if (i.details?.status === 404) return null;
      throw i;
    }
  }
  allow(e) {
    this.allowed.add(e);
  }
  writable(e) {
    this.guard(), d(this.allowed.has(e), "Choose a library folder before saving files.");
  }
  async folder(e, t) {
    this.writable(e), k(t);
    let i = await this.child(e, t);
    if (i) return d(i.folder, "An existing file conflicts with a library folder."), this.allow(i.id), i;
    let s;
    try {
      s = await this.json("POST", this.path(e, "/children"), { name: t, folder: {}, "@microsoft.graph.conflictBehavior": "fail" });
    } catch (r) {
      if (r.details?.status !== 409) throw r;
      s = await this.child(e, t);
    }
    return this.validate(s, e), d(s.folder, "OneDrive could not create the library folder."), this.allow(s.id), s;
  }
  async read(e, { cache: t = false, max: i = Number.MAX_SAFE_INTEGER } = {}) {
    this.guard(), this.validate(e), d(e.file && Number.isSafeInteger(e.size) && e.size <= i, "The OneDrive file has an invalid size or exceeds the metadata budget."), this.observedReads.set(e.id, e.eTag);
    let s = e.id + "|" + e.eTag;
    if (t === true && this.cache.has(s)) return this.cache.get(s);
    let r = await this.item(e.id);
    if (this.validate(r, e.parentReference?.id), d(r.eTag === e.eTag && r.size === e.size, "The OneDrive file changed while loading. Refresh and try again."), t === "preview" && r.eTag && this.previewCache.has(s)) {
      let f = this.previewCache.get(s);
      return this.previewCache.delete(s), this.previewCache.set(s, f), f;
    }
    let a = D(r["@microsoft.graph.downloadUrl"]), n = await this.provider.request("GET", a.href, { transfer: true, tag: "KeepIt download" }), o = [], l = 0, u = n.body.getReader();
    for (; ; ) {
      let f = await u.read();
      if (f.done) break;
      if (l += f.value.byteLength, l > i || l > e.size) throw await u.cancel(), new Error("OneDrive returned an unexpected file length.");
      o.push(f.value);
    }
    d(l === e.size, "The OneDrive download was interrupted. Try again.");
    let c = new File(o, e.name, { type: e.file.mimeType || "application/octet-stream" });
    return t === true ? this.cache.set(s, c) : t === "preview" && r.eTag && this.retainPreview(s, c), c;
  }
  async readJSON(e) {
    return JSON.parse(await (await this.read(e, { cache: true, max: 256 * 1024 ** 2 })).text());
  }
  async verifyExistingOriginal(e, t, i, s) {
    return this.writable(e), me({ item: s, parent: e, name: t, bytes: i.size, expectedDigest: await y(i), read: (r) => this.read(r, { cache: false, max: i.size }), hash: y });
  }
  async create(e, t, i) {
    this.writable(e), k(t);
    let s, r = null, a = async ({ largeRecovery: n = false } = {}) => {
      try {
        return await (await this.provider.request("PUT", this.path(e, `:/${T(t)}:/content?@microsoft.graph.conflictBehavior=fail`), { body: i, headers: { "Content-Type": i.type || "application/octet-stream" }, tag: "save file", ...n ? { timeoutMs: 3e5 } : {} })).json();
      } catch (o) {
        let l = await this.child(e, t).catch(() => null);
        if (!l) throw o;
        return l;
      }
    };
    if (i.size <= 4 * 1024 ** 2) s = await a();
    else {
      let n = JSON.stringify([this.homeId, this.driveId, e, t, i.size, await y(i)]);
      r = n;
      let o = await this.sessionStore.get(n), l = 0, u = await this.child(e, t);
      if (u) {
        if (u.size === i.size) {
          let c = await this.verifyExistingOriginal(e, t, i, u);
          return o && await this.sessionStore.remove(n), c;
        }
        if (u.size !== 0 || !o || Date.parse(o.expirationDateTime) <= Date.now()) return this.verifyExistingOriginal(e, t, i, u);
      }
      if (o) {
        D(o.uploadUrl);
        let c = await this.child(e, t);
        if (c && c.size !== 0) {
          let f = await this.verifyExistingOriginal(e, t, i, c);
          return await this.sessionStore.remove(n), f;
        }
        if (Date.parse(o.expirationDateTime) <= Date.now()) await this.sessionStore.remove(n), o = null;
        else try {
          let f = await (await this.provider.request("GET", o.uploadUrl, { transfer: true, tag: "resume upload status" })).json();
          l = j(f.nextExpectedRanges, i.size), o = { ...o, expirationDateTime: f.expirationDateTime || o.expirationDateTime };
        } catch (f) {
          if ([404, 410].includes(f.details?.status)) await this.sessionStore.remove(n), o = null;
          else throw f;
        }
      }
      if (!o && u) return this.verifyExistingOriginal(e, t, i, u);
      try {
        o || (o = await this.json("POST", this.path(e, `:/${T(t)}:/createUploadSession`), { item: { name: t, "@microsoft.graph.conflictBehavior": "fail" } }));
      } catch (c) {
        let f = await pe({ error: c, size: i.size, minimalSession: async () => {
          let m = await this.child(e, t);
          return d(!m, "A different OneDrive original may already use this filename. No overwrite was attempted."), this.json("POST", this.path(e, `:/${T(t)}:/createUploadSession`));
        }, directUpload: () => a({ largeRecovery: i.size > 33554432 }) });
        o = f.session || null, s = f.saved || null;
      }
      if (o) {
        d(Number.isFinite(Date.parse(o.expirationDateTime)), "OneDrive did not provide an upload expiration."), D(o.uploadUrl), await this.sessionStore.put(n, o);
        try {
          for (; l < i.size; ) {
            this.writable(e);
            let c = te(l, i.size, 2 * 327680), f = await this.provider.request("PUT", o.uploadUrl, { transfer: true, body: i.slice(l, c), headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${l}-${c - 1}/${i.size}` }, tag: "KeepIt upload" }), m = await f.json();
            if (f.status === 200 || f.status === 201) s = m, l = i.size;
            else {
              d(f.status === 202, "Unexpected upload response.");
              let w = j(m.nextExpectedRanges, i.size);
              d(w > l && w <= c, "Upload progress could not be confirmed."), l = w;
            }
            m.expirationDateTime && (o.expirationDateTime = m.expirationDateTime), await this.sessionStore.put(n, o);
            try {
              this.onProgress({ name: t, done: l, total: i.size });
            } catch {
            }
          }
        } catch (c) {
          if (s = await this.child(e, t).catch(() => null), !s) throw c;
        }
      }
    }
    if (!s?.file || s.name !== t || s.size !== i.size || s.parentReference?.id !== e) {
      let n = await this.child(e, t);
      n && (s = await this.verifyExistingOriginal(e, t, i, n));
    }
    if (!s?.file || s.name !== t || s.size !== i.size || s.parentReference?.id !== e) {
      let n = new Error("OneDrive did not confirm the original file. Queued copy retained; do not upload another copy.");
      throw n.code = "ORIGINAL_UNVERIFIED", n;
    }
    return this.validate(s, e), r && await this.sessionStore.remove(r), s;
  }
  async rename(e, t) {
    return this.writable(e.parentReference?.id), k(t), d(e.eTag, "OneDrive did not supply a file version."), this.validate(await this.json("PATCH", this.path(e.id), { name: t }, { "If-Match": e.eTag }), e.parentReference.id);
  }
  async remove(e, t) {
    this.writable(e);
    let i = await this.child(e, t);
    if (!i) throw B();
    d(this.observedReads.get(i.id) === i.eTag, "The original changed after verification. It was retained in OneDrive."), await this.provider.request("DELETE", this.path(i.id), { headers: { "If-Match": i.eTag }, tag: "KeepIt delete" });
  }
  directory(e) {
    return d(e.folder, "Choose a OneDrive folder."), new V(this, e);
  }
}, V = class {
  constructor(e, t) {
    this.fs = e, this.item = t, this.kind = "directory", this.name = t.name;
  }
  async queryPermission() {
    return this.fs.guard(), "granted";
  }
  async getDirectoryHandle(e, { create: t = false } = {}) {
    let i = t ? await this.fs.folder(this.item.id, e) : await this.fs.child(this.item.id, e);
    if (!i) throw B();
    return d(i.folder, "A file conflicts with the requested folder."), this.fs.allow(i.id), this.fs.directory(i);
  }
  async getFileHandle(e, { create: t = false } = {}) {
    let i = await this.fs.child(this.item.id, e);
    if (!i && !t) throw B();
    d(!i || i.file, "A folder conflicts with the requested file.");
    let s = this.fs, r = this.item.id;
    return { kind: "file", name: e, getFile: async () => {
      let a = await s.child(r, e);
      if (!a) throw B();
      return s.read(a, { cache: r === s.originalsId || s.originalDirectories.has(r) ? "preview" : true });
    }, createWritable: async () => {
      d(!i, "An existing OneDrive file will not be overwritten.");
      let a = [], n = false;
      return { write: async (o) => {
        d(!n, "Upload cancelled."), a.push(o);
      }, abort: async () => {
        n = true, a = [];
      }, close: async () => {
        d(!n, "Upload cancelled."), await s.create(r, e, new Blob(a)), a = [];
      } };
    } };
  }
  async *entries() {
    for (let e of await this.fs.children(this.item.id)) yield [e.name, e.folder ? this.fs.directory(e) : { kind: "file", name: e.name, getFile: () => this.fs.read(e, { cache: true }) }];
  }
  async removeEntry(e) {
    return this.fs.remove(this.item.id, e);
  }
};
var G = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, we = (h) => new Blob([JSON.stringify(h, null, 2) + `
`], { type: "application/json" }), Y = "keepit-cloud.json", L = class extends A {
  constructor(e, t, { catalogCache: i = new x(), originalCache: s = new O() } = {}) {
    super(e.directory(t)), this.fs = e, this.isCloud = true, this.displayPath = t.name, this.snapshots = /* @__PURE__ */ new Map(), this.catalogCache = i, this.originalCache = s, this.originalLoads = /* @__PURE__ */ new Map(), this.originalVersions = /* @__PURE__ */ new Map();
  }
  async createJSON(e, t, i) {
    let s = we(i), r = await this.fs.create(e, t, s);
    return d(await y(await this.fs.read(r, { cache: true })) === await y(s), "The OneDrive catalog write could not be verified."), r;
  }
  async open() {
    this.fs.guard();
    let e = this.root.item;
    d(e.parentReference?.id, "Choose your library folder rather than the OneDrive root."), this.fs.allow(e.id);
    let [t, i] = await Promise.all([this.fs.child(e.id, "_Catalog"), this.fs.child(e.id, "Files")]), s = t && await this.fs.child(t.id, "library.json");
    if (s) this.catalog = this.fs.directory(t);
    else {
      let w = await this.fs.children(e.id), v = t?.folder && (await this.fs.children(t.id)).length === 0 && (!i || i.folder && (await this.fs.children(i.id)).length === 0) && w.every((g) => ["_Catalog", "Files"].includes(g.name));
      d(!t && !i || v, "This folder contains library folders without a valid catalog. Nothing was reset."), d(v || w.length === 0, "Choose an existing KeepIt library or an empty folder. Existing unrelated files were retained."), this.catalog = await this.root.getDirectoryHandle("_Catalog", { create: true }), this.identity = { format: "mylibrary-folder-1", libraryId: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      try {
        s = await this.createJSON(this.catalog.item.id, "library.json", this.identity);
      } catch (g) {
        if (s = await this.fs.child(this.catalog.item.id, "library.json"), !s) throw g;
      }
    }
    this.identity = await this.fs.readJSON(s), d(this.identity.format === "mylibrary-folder-1" && G.test(this.identity.libraryId) && Number.isFinite(Date.parse(this.identity.createdAt)), "This is not a supported KeepIt library."), this.fs.allow(this.catalog.item.id), this.files = i ? this.fs.directory(i) : await this.root.getDirectoryHandle("Files", { create: true }), this.fs.originalsId = this.files.item.id, this.legacyCommits = await this.catalog.getDirectoryHandle("commits", { create: true });
    let r = await this.fs.child(this.catalog.item.id, Y);
    this.cacheChoice = { homeId: this.fs.homeId, driveId: this.fs.driveId, rootId: e.id };
    let [a, n] = r ? await Promise.all([this.catalogCache.get(this.cacheChoice), this.fs.readJSON(r)]) : [null, null];
    a && (JSON.stringify(a.index) !== JSON.stringify(n) || JSON.stringify(a.identity) !== JSON.stringify(this.identity)) && (a = null), a && (this.verified = a.verified, this.historicalPaths = a.verified.historicalPaths, this.historicalOriginals = a.verified.historicalOriginals);
    let o = { identity: this.identity, commits: this.legacyCommits }, l = a ? a.verified.legacyState : await A.prototype.readHead.call(o);
    if (!r) {
      l || d((await this.fs.children(this.files.item.id)).length === 0, "Originals remain but the catalog is missing. Restore the catalog before connecting.");
      let w = await this.catalog.getDirectoryHandle("keepit-cloud", { create: true }), v = await w.getDirectoryHandle("commits", { create: true }), g = l;
      g || (g = { format: "mylibrary-folder-snapshot-2", libraryId: this.identity.libraryId, commitId: crypto.randomUUID(), revision: 0, parent: null, info: { libraryId: this.identity.libraryId, createdAt: this.identity.createdAt, backupRevision: -1, revision: 0 }, items: [], paths: {} });
      let C = await y(new Blob([JSON.stringify(g)]));
      await this.createJSON(v.item.id, g.commitId + ".json", { ...g, checksum: C });
      let R = await this.createJSON(w.item.id, `head-${g.commitId}.json`, { format: "keepit-cloud-anchor-1", libraryId: this.identity.libraryId }), p = { format: "keepit-cloud-index-1", libraryId: this.identity.libraryId, driveId: this.fs.driveId, rootId: e.id, filesId: this.files.item.id, cloudId: w.item.id, commitsId: v.item.id, headId: R.id, legacyCommitId: l?.commitId || null, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      try {
        r = await this.createJSON(this.catalog.item.id, Y, p);
      } catch (I) {
        if (r = await this.fs.child(this.catalog.item.id, Y), !r) throw I;
      }
    }
    this.index = n ?? await this.fs.readJSON(r), d(this.index.format === "keepit-cloud-index-1" && this.index.libraryId === this.identity.libraryId && this.index.driveId === this.fs.driveId && this.index.rootId === e.id && this.index.filesId === this.files.item.id && this.index.legacyCommitId === (l?.commitId || null), "The library connection or local catalog has changed. No catalog was overwritten.");
    let [u, c] = await Promise.all([this.fs.item(this.index.cloudId), this.fs.item(this.index.commitsId)]), f = this.fs.validate(u, this.catalog.item.id), m = this.fs.validate(c, f.id);
    return d(f.folder && f.name === "keepit-cloud" && m.folder && m.name === "commits", "The OneDrive catalog folders moved. Reconnect the library."), this.fs.allow(this.files.item.id), this.fs.allow(f.id), this.fs.allow(m.id), this.cloudCommits = this.fs.directory(m), this.closed = false, this.release = () => {
      this.closed = true;
    }, this.state = await this.readHead(), this.persistCheckpoint(), this;
  }
  async persistCheckpoint() {
    !this.verified || !this.cacheChoice || await this.catalogCache.put(this.cacheChoice, { identity: this.identity, index: this.index, verified: this.verified, displayPath: this.displayPath, rootName: this.root.name });
  }
  async permission() {
    this.fs.guard(), d(!this.closed, "Reconnect your OneDrive library.");
  }
  async acquire() {
  }
  async close() {
    this.closed = true, this.release = null, this.fs.clearPreviewCache();
  }
  async originalDirectory(e, t) {
    let i = await super.originalDirectory(e, t);
    return this.fs.allow(i.item.id), this.fs.originalDirectories.add(i.item.id), i;
  }
  async remove(e, t) {
    let i = await super.remove(e, t);
    return await this.originalCache.clearScope(this.originalScope(), e), i;
  }
  originalScope() {
    return [this.fs.homeId, this.fs.driveId, this.root.item.id, this.identity.libraryId];
  }
  async original(e) {
    await this.permission();
    let t = this.state.items.find((r) => r.id === e);
    d(t, "This item is no longer in the library.");
    let i = N([...this.originalScope(), this.state.paths[e]], t);
    if (this.originalLoads.has(i)) return this.originalLoads.get(i);
    let s = (async () => {
      let r = await this.originalCache.get(i, t);
      if (await this.permission(), r?.version) {
        let o = this.fs.validate(await this.fs.item(r.version.id), r.version.parentId);
        if (o.file && o.eTag === r.version.eTag && o.size === t.bytes && o.name === r.version.name) return await this.permission(), r.blob;
        await this.originalCache.remove(i);
      }
      let a = await this.thumbnailSource(e);
      d(a.size === t.bytes && await y(a) === t.digest, "The file was changed or damaged outside KeepIt. Its original record was retained."), await this.permission();
      let n = this.state.items.find((o) => o.id === e);
      return d(n?.digest === t.digest, "This item changed while opening. Reopen its current version."), this.originalCache.put(i, t, a, this.originalVersions.get(e), { isCurrent: () => !this.closed && this.fs.auth.account()?.homeAccountId === this.fs.homeId && this.state.items.some((o) => o.id === e && o.digest === t.digest) }), a;
    })();
    this.originalLoads.set(i, s);
    try {
      return await s;
    } finally {
      this.originalLoads.delete(i);
    }
  }
  async thumbnailSource(e) {
    let t = this.state.items.find((n) => n.id === e);
    d(t, "This item is no longer in the library.");
    let i = this.state.paths[e], s = await this.originalDirectory(i);
    this.fs.allow(s.item.id);
    let r = await this.fs.child(s.item.id, i.split("/").at(-1));
    d(r?.file, "The original is unavailable in OneDrive."), this.originalVersions.set(e, { id: r.id, eTag: r.eTag, parentId: s.item.id, name: r.name });
    let a = await this.fs.read(r, { cache: "preview" });
    return d(a.size === t.bytes, "The file was changed or damaged outside KeepIt. Its original record was retained."), a;
  }
  async readHead() {
    await this.permission();
    let [e, t] = await Promise.all([this.fs.item(this.index.headId), this.fs.children(this.legacyCommits.item.id)]), i = this.fs.validate(e, this.index.cloudId), s = /^head-([a-f0-9-]{36})\.json$/.exec(i.name);
    d(i.file && s && G.test(s[1]) && i.eTag, "The OneDrive catalog pointer is invalid.");
    let r = JSON.stringify(t.map((p) => [p.id, p.name, p.eTag, p.size, !!p.folder]).sort((p, I) => p[0] < I[0] ? -1 : p[0] > I[0] ? 1 : 0)), a = this.verified, n = a && a.legacySignature === r;
    if (n && a.headId === i.id && a.headName === i.name && a.headETag === i.eTag) return this.head = i, structuredClone(a.state);
    let o = t.map((p) => [p.name, p.folder ? this.fs.directory(p) : { kind: "file", getFile: () => this.fs.read(p, { cache: true }) }]), l = { identity: this.identity, commits: { async *entries() {
      yield* o;
    } } }, u = n ? a.legacyState : await A.prototype.readHead.call(l);
    d((u?.commitId || null) === this.index.legacyCommitId, "This library was changed through a local folder connection. Close local writers before using OneDrive. No cloud changes were overwritten.");
    let c = n ? null : new Map((await this.fs.children(this.index.commitsId)).map((p) => [p.name.toLowerCase(), p])), f = n ? a.state.commitId : this.index.legacyCommitId, m = n ? [] : [...o], w = /* @__PURE__ */ new Set(), v = /* @__PURE__ */ new Map(), g = s[1];
    for (; g && g !== f; ) {
      d(G.test(g) && !w.has(g), "The cloud catalog contains an invalid history link."), w.add(g);
      let p = this.snapshots.get(g);
      if (!p) {
        let $ = c ? c.get(g + ".json") : await this.fs.child(this.index.commitsId, g + ".json");
        d($?.file, "A cloud catalog snapshot is missing."), p = await this.fs.read($, { cache: true, max: 256 * 1024 ** 2 }).then(async (file) => ({ snapshot: JSON.parse(await file.text()), file })), v.set(g, p);
        if (v.size % 8 === 0) this.onConnectProgress?.(v.size);
      }
      let { snapshot: I, file: be } = p;
      d(I.commitId === g, "A cloud catalog snapshot has the wrong identity."), m.push([`${String(I.revision).padStart(10, "0")}-${g}.json`, { kind: "file", getFile: async () => be }]), g = I.parent;
    }
    d(g === f, n ? "The cloud history no longer includes the last verified save. Nothing was overwritten." : "The cloud history no longer joins the original catalog.");
    let C = { identity: this.identity, commits: { async *entries() {
      yield* m;
    } } }, R = await A.prototype.readHead.call(C, n ? { baseState: structuredClone(a.state), baseHistoricalPaths: a.historicalPaths, baseHistoricalOriginals: a.historicalOriginals } : {});
    d(R?.commitId === s[1], "The cloud catalog head could not be verified.");
    for (let [p, I] of v) this.snapshots.set(p, I);
    return this.verified = { state: structuredClone(R), historicalPaths: C.historicalPaths, historicalOriginals: C.historicalOriginals, legacySignature: r, legacyState: structuredClone(u), headId: i.id, headName: i.name, headETag: i.eTag }, this.historicalPaths = C.historicalPaths, this.historicalOriginals = C.historicalOriginals, this.head = i, this.persistCheckpoint(), R;
  }
  async commit(e, t, i = {}) {
    await this.permission();
    let s = await this.readHead();
    d(s.commitId === this.state.commitId, "This library changed on another device. Refresh, then reopen the item before saving. Your edits were not overwritten.");
    let r = this.head, a = s.revision + 1, n = { format: i.printTemplates?.length || s.info?.printTemplates?.length || s.format === "mylibrary-folder-snapshot-4" ? "mylibrary-folder-snapshot-4" : s.format === "mylibrary-folder-snapshot-3" || e.some((c) => c.archivedAt || c.duplicateOf) ? "mylibrary-folder-snapshot-3" : "mylibrary-folder-snapshot-2", libraryId: this.identity.libraryId, commitId: crypto.randomUUID(), revision: a, parent: s.commitId, info: { ...s.info, ...i, revision: a }, items: e, paths: t }, o = await y(new Blob([JSON.stringify(n)]));
    d(we({ ...n, checksum: o }).size <= 256 * 1024 ** 2, "The catalog metadata exceeds the processing budget."), await this.createJSON(this.index.commitsId, n.commitId + ".json", { ...n, checksum: o });
    try {
      await this.fs.rename(r, `head-${n.commitId}.json`);
    } catch (c) {
      if ((await this.fs.item(r.id).catch(() => null))?.name !== `head-${n.commitId}.json`) throw c.details?.status === 412 ? new Error("Another device saved first. Refresh, then reopen this item. Your existing files and metadata were retained.") : c;
    }
    let l = await this.readHead(), u = l;
    for (; u.commitId !== n.commitId && u.revision > n.revision; ) {
      let c = await this.fs.child(this.index.commitsId, u.parent + ".json");
      d(c, "Save history could not be confirmed."), u = await this.fs.readJSON(c);
    }
    d(u.commitId === n.commitId, "The cloud save could not be confirmed. Refresh before retrying."), this.state = l;
  }
};
var Q = "keepit-onedrive-owner-1", M = "keepit-storage-mode-owner-1", S = () => {
  try {
    return JSON.parse(localStorage.getItem(Q) || "null");
  } catch {
    return null;
  }
}, ye = () => {
  try {
    return localStorage.getItem(M) === "onedrive";
  } catch {
    return false;
  }
};
function pt() {
  try {
    localStorage.setItem(M, "local");
  } catch {
  }
}
var ve = class {
  constructor({ ready: e, pause: t, canChange: i, progress: s, disconnected: r, preview: a, clearPreview: n, settled: o }) {
    Object.assign(this, { ready: e, pause: t, canChange: i, progress: s, disconnected: r, preview: a, clearPreview: n, settled: o }), this.catalogCache = new x(), this.$ = (c) => document.getElementById(c), this.auth = new ae({ clientId: ne, scope: "visible_root" }), this.stack = [], this.pending = false, this.authChecked = false;
    window.addEventListener('keepit-auth-state',event=>{
      if(event.detail?.homeId!==this.auth.account()?.homeAccountId)return;
      const phase=event.detail.phase;
      if(phase==='signin')this.publish('signin','Reconnect Microsoft · local edits retained');
      else if(phase==='waiting'||phase==='renewing')this.publish('waiting','Waiting for OneDrive · local edits retained');
      else if(phase==='restored'&&this.bound)this.publish('connected','OneDrive / '+(S()?.path||'KeepIt')+' connected');
    });
    let l = this.$;
    l("onedrive-close").onclick = () => {
      this.pending || l("onedrive-dialog").close();
    }, l("onedrive-dialog").addEventListener("cancel", (c) => {
      this.pending && c.preventDefault();
    }), l("onedrive-signin").onclick = () => this.work(async () => {
      if (!this.canChange()) throw new Error("Finish your current edit before connecting OneDrive.");
      sessionStorage.setItem("keepit-open-onedrive", "1");
      let c = new URL(location.href).searchParams.get("connected-app");
      sessionStorage.setItem("keepit-owner-return-app", ["liveit", "keepit", "thinkit", "travelit"].includes(c) ? c : "keepit"), await this.prepareAuth(), await this.auth.signIn();
    }), l("onedrive-retry").onclick = () => this.work(async () => {
      await this.start({ force: true }) ? l("onedrive-dialog").close() : this.fs && await this.browse();
    }), l("onedrive-up").onclick = () => this.work(async () => {
      this.stack.length > 1 && (this.stack.pop(), await this.browse());
    }), l("onedrive-use").onclick = () => this.work(() => this.choose());
    let u = document.createElement("button");
    if (u.id = "onedrive-change-folder", u.type = "button", u.className = "secondary", u.textContent = "Choose another folder", u.hidden = true, u.onclick = () => this.work(async () => {
      if (!this.canChange()) throw Error("Save or close the current edit before changing libraries.");
      this.selecting = true, this.status(), await this.browse();
    }), l("onedrive-browser").before(u), q) {
      let c = document.createElement("button");
      this.qaCreateButton = c, c.type = "button", c.id = "onedrive-create-qa", c.textContent = "Create or open disposable QA folder", c.hidden = true, c.onclick = () => this.work(async () => {
        if (!this.canChange()) throw new Error("Finish your current edit before changing libraries.");
        let f = await ie(this.fs);
        this.stack = [this.stack[0], f], await this.browse(), await this.choose();
      }), l("onedrive-browser").append(c);
    }
    l("onedrive-disconnect").onclick = () => this.work(async () => {
      if (!this.canChange()) throw new Error("Finish your current edit before disconnecting.");
      let c = S();
      await this.pause(), await this.auth.signOut(), c && (await this.catalogCache.remove(c), await new O().clearScope([c.homeId, c.driveId, c.rootId])), this.fs = null, this.stack = [];
      try {
        localStorage.removeItem(Q), localStorage.setItem(M, "local");
      } catch {
      }
      this.bound = false, this.status(), await this.disconnected(), this.publish("signin", "Connect to OneDrive"), this.note("Disconnected. Your OneDrive files are retained.");
    });
    for (let c of ["connect-onedrive", "settings-onedrive"]) l(c).onclick = () => this.show();
  }
  note(e, t = false) {
    let i = this.$("onedrive-message");
    i.textContent = e, i.hidden = false, i.className = "message" + (t ? " error" : "");
  }
  status() {
    let e = this.$, t = this.auth.account();
    e("onedrive-signin").hidden = false, e("onedrive-signin").textContent = t ? "Reconnect Microsoft" : "Sign in with Microsoft", e("onedrive-retry").hidden = !t || this.auth.reconnectRequired, e("onedrive-disconnect").hidden = !t, e("onedrive-account").textContent = t?.username || t?.name || "Use the same personal OneDrive on your Mac and iPhone.", e("onedrive-browser").hidden = !this.fs || !this.selecting, e("onedrive-change-folder").hidden = !this.fs || this.selecting;
  }
  async work(e) {
    if (!(this.pending || this.startTask)) {
      this.pending = true;
      for (let t of this.$("onedrive-dialog").querySelectorAll("button")) t.disabled = true;
      try {
        return await e();
      } catch (t) {
        this.note(H(t), true), this.status();
      } finally {
        this.pending = false;
        for (let t of this.$("onedrive-dialog").querySelectorAll("button")) t.disabled = false;
        this.$("onedrive-up").disabled = this.stack.length < 2, this.$("onedrive-use").disabled = this.stack.length < 2;
      }
    }
  }
  async prepareAuth() {
    if (!this.authChecked) {
      let e = await fe(void 0, { required: oe });
      if (e) {
        e.expectedHomeId = S()?.homeId || null, this.auth = e, this.authChecked = true;
        return;
      }
      this.authChecked = true;
    }
    await this.auth.initialize();
  }
  async previewRemembered() {
    let e = S();
    if (!ye() || !e) return false;
    let t = await this.catalogCache.get(e);
    return t ? (await this.preview?.(new z(e, t)), true) : false;
  }
  publish(e, t) {
    let i = { phase: e, message: t };
    window.keepItConnectionState = i, window.dispatchEvent(new CustomEvent("keepit-connection-state", { detail: i }));
  }
  present() {
    document.querySelector("dialog[open]:not(#settings-dialog):not(#onedrive-dialog)") || (this.$("settings-dialog").close(), this.$("more-menu").hidden = true, this.$("more-trigger").setAttribute("aria-expanded", "false"), this.$("onedrive-dialog").open || this.$("onedrive-dialog").showModal(), this.status());
  }
  async start(e = {}) {
    if (this.startTask) return this.startTask;
    this.$("onedrive-signin").disabled = true, this.$("onedrive-retry").disabled = true;
    let t = this.bound;
    return this.bound = false, this.startTask = this.restore({ ...e, priorBound: t }).finally(() => {
      this.startTask = null, this.$("onedrive-signin").disabled = false, this.$("onedrive-retry").disabled = false, this.settled?.();
    }), this.startTask;
  }
  async bindLibrary(e, t) {
    let i = await ee(this.fs, e, async (s) => {
      const lib = new L(this.fs, s);
      lib.onConnectProgress = (count) => this.progress({ stage: "Verifying OneDrive catalog \xB7 " + count + " revisions checked" });
      try {
        return await lib.open();
      } finally {
        lib.onConnectProgress = null;
      }
    });
    return t = t || e.name, i.displayPath = t, localStorage.setItem(Q, JSON.stringify({ homeId: this.auth.account().homeAccountId, driveId: this.fs.driveId, rootId: e.id, path: t })), localStorage.setItem(M, "onedrive"), await this.ready(i), this.bound = true, this.selecting = false, this.status(), this.$("onedrive-message").hidden = true, this.publish("connected", "OneDrive / " + t + " connected"), this.$("onedrive-dialog").close(), true;
  }
  async restore({ force: e = false, interactive: t = false, selected: i = null, priorBound: s = false } = {}) {
    try {
      if (i) return await this.bindLibrary(i.root, i.path);
      if (!e && !t && !ye()) return false;
      if (this.progress({ stage: "Checking Microsoft sign-in\u2026" }), await this.prepareAuth(), !this.auth.account()) return this.status(), t && this.present(), this.publish("signin", "Sign in to OneDrive"), false;
      S()?.homeId && S().homeId !== this.auth.account().homeAccountId && await this.clearPreview?.(), this.progress({ stage: "Connecting to OneDrive\u2026" }), await this.connectFiles();
      let r = S();
      if (r && r.homeId === this.auth.account().homeAccountId && r.driveId === this.fs.driveId) try {
        this.progress({ stage: "Opening your OneDrive library\u2026" });
        let a = await this.fs.item(r.rootId);
        return await this.bindLibrary(a, r.path);
      } catch (a) {
        if (a.details?.status !== 404) throw a;
      }
      if ((e || t) && !r) {
        let a = await this.fs.child(this.stack[0].id, "KeepIt");
        if (a) return this.progress({ stage: "Opening your OneDrive library\u2026" }), await this.bindLibrary(a);
      }
      return this.selecting = true, this.present(), await this.browse(), this.note("Choose your library folder below. You can open subfolders."), this.publish("choose-folder", "Choose your OneDrive folder"), false;
    } catch (r) {
      this.bound = !!s && !!this.fs && this.auth.account()?.homeAccountId === S()?.homeId;
      let a = H(r);
      if (this.note(a, true), this.progress({ error: "OneDrive could not connect. " + a }), this.status(), this.fs && t) {
        this.selecting = true, this.present();
        try {
          await this.browse();
        } catch {
        }
      }
      return false;
    }
  }
  async connectFiles(){
    const fetcher=async(input,options={})=>{
      if(new URL(input.url||input,location.origin).hostname!=='graph.microsoft.com'||(options.method||'GET')!=='GET'){
        try{return await fetch(input,options);}catch(error){
          if(this.bound){this.transportWaiting=true;this.publish('waiting','Waiting for OneDrive · local edits retained');}throw error;
        }
      }
      const controller=new AbortController(),abort=()=>controller.abort();
      options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
      try{
        return await re(async()=>{
          let response=await fetch(input,{...options,signal:controller.signal});
          if(response.status===401){
            this.auth.invalidateToken?.();
            const token=await this.auth.token(this.fs?.homeId||this.auth.account()?.homeAccountId);
            const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+token);
            response=await fetch(input,{...options,headers,signal:controller.signal});
          }
          if(response.ok&&this.transportWaiting&&this.bound){this.transportWaiting=false;this.publish('connected','OneDrive / '+(S()?.path||'KeepIt')+' connected');}
          return response;
        },20000,'OneDrive did not respond in time. Retry the connection.');
      }catch(error){controller.abort();if(this.bound){this.transportWaiting=true;this.publish('waiting','Waiting for OneDrive · local edits retained');}throw error;}
      finally{options.signal?.removeEventListener('abort',abort);}
    };
    const fs=new _(this.auth,{onProgress:this.progress,fetcher}),root=await fs.initialize();
    fs.qaDriveRootId=root.id;this.fs=fs;this.stack=[root];this.status();
  }
  async show() {
    return this.startTask ? (this.present(), this.startTask) : this.canChange() ? (this.present(), this.bound && this.fs ? (this.$("onedrive-browser").hidden = true, this.note("Connected to OneDrive / " + (S()?.path || "your library") + "."), true) : this.start({ force: true, interactive: true })) : this.progress({ error: "Save or close the current edit before changing libraries." });
  }
  async browse() {
    let e = this.$, t = this.stack.at(-1);
    this.selecting = true, e("onedrive-browser").hidden = false, e("onedrive-path").textContent = "OneDrive / " + this.stack.slice(1).map((s) => s.name).join(" / "), e("onedrive-folders").replaceChildren(), q && (this.qaCreateButton.hidden = this.stack.length !== 1);
    let i = (await this.fs.children(t.id)).filter((s) => s.folder && !s.remoteItem).sort((s, r) => s.name.localeCompare(r.name));
    for (let s of i) {
      let r = document.createElement("button");
      r.type = "button", r.className = "onedrive-folder", r.textContent = "\u25B1  " + s.name + "  \u203A", r.onclick = () => this.work(async () => {
        this.stack.push(s), await this.browse();
      }), e("onedrive-folders").append(r);
    }
    if (!i.length) {
      let s = document.createElement("p");
      s.className = "fineprint", s.textContent = "No subfolders here. Use this folder for your library, or go Up to choose another.", e("onedrive-folders").append(s);
    }
    e("onedrive-up").disabled = this.stack.length < 2, e("onedrive-use").disabled = this.stack.length < 2;
  }
  async choose() {
    if (!this.canChange()) throw new Error("Save or close the current edit before changing libraries.");
    if (this.stack.length < 2) throw new Error("Open the folder you want to use first.");
    let e = this.stack.at(-1), t = this.stack.slice(1).map((i) => i.name).join(" / ");
    return this.note("Opening and verifying this library folder\u2026"), this.start({ selected: { root: e, path: t } });
  }
};
export {
  ve as OneDriveConnection,
  pt as preferLocal,
  ye as wantsOneDrive
};
