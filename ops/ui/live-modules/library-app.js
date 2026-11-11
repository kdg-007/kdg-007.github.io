import { readCalendarNotes } from "/partners/connected/liveit-calendar-read.mjs?v=1";
import { CALENDAR_SOURCE as ft, CALENDAR_TAG as mt, eventRecord as Qe, eventSignature as Fe, eventNoteId as Mt, eventEnvelope as $i, readEventEnvelope as $t } from "/partners/liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs?v=keepit-links-1";
import { mountKeepItItemLinks as mountLiveItKeepItLinks } from "/partners/connected/liveit-keepit-links.mjs?v=2";
import { mountAppRepository as mountKeepItAppFiles } from "/partners/connected/app-repository-sync.mjs?v=trip-sync-1";
import { a as qt } from "./chunk-W72KRQYW.js";
import { b as Ri, c as pt } from "./chunk-C6CZGXK7.js";
import { b as Dt } from "./chunk-I45DYT36.js";
import { a as Li, b as Ut, c as Pt, d as ze, e as jt, f as Ui } from "./chunk-N6CLEFXZ.js";
import { a as ct } from "./chunk-L3TF6PEU.js";
import { a as He, b as Ni, c as Di } from "./chunk-O6257ALA.js";
import { b as Pe, d as Rt } from "./chunk-ZYO32GI7.js";
import { a as ut, b as Pi, c as Fi, d as qi } from "./chunk-SMVO73KC.js";
import { a as Oi } from "./chunk-GPSOO2TA.js";
import { a as mi, b as gi, c as st, d as hi, e as bi, f as wi } from "./chunk-M3DGA7O5.js";
import "./chunk-VUEURUCM.js";
import { a as Ft } from "./chunk-4IPXVWW5.js";
import { A as Ti, F as lt, G as Si, H as Lt, L as Nt, M as A, Q as Ae, R as Ai, S as zi, b as xi, h as At, l as yi, m as vi, n as zt, o as ki, p as Se, q as Ii, t as Re, u as Ei, v as Ue, x as Ci, y as Ot } from "./chunk-3XLEL25X.js";
import { m as dt } from "./chunk-AAYJLHGB.js";
import { d as St } from "./chunk-ZJV7P25W.js";
import { l as ue, q as fi, r as _e } from "./chunk-G42SHEZJ.js";
import { b as de } from "./chunk-ZKN76T53.js";
import "./chunk-OOJM4CTU.js";
async function _i(e, t, i) {
  let o = Qe(t), n = await Mt(o.id), r = JSON.stringify($i(o)), s = await e.getItem(n);
  if (s && (s.source !== ft || !s.tags?.includes(mt))) throw Error("This note is not owned by the LiveIt calendar.");
  let p = { title: (o.archived ? "[Archived] " : "") + o.body.slice(0, 180), domain: s?.domain || "LiveIt calendar", notes: r, tags: [.../* @__PURE__ */ new Set([...(s?.tags || []).filter((y) => !["work", "personal"].includes(y)), mt, o.workspace])], source: ft, favorite: s?.favorite === true, ...s?.customFields ? { customFields: s.customFields } : {}, ...s?.recordType ? { recordType: s.recordType } : {} }, d = (y) => ({ type: "paragraph", content: [{ type: "text", text: y }] }), m = await fi({ noteId: n, revisionId: i.operationId, exportMetadata: p, document: { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: o.body }] }, d(o.date + (o.endDate !== o.date ? " to " + o.endDate : "") + (o.allDay ? " \xB7 All day" : " \xB7 " + o.time + (o.endTime ? " to " + o.endTime : ""))), d((o.workspace === "work" ? "Work" : "Personal") + " calendar \xB7 Edit this event in LiveIt.")] } }), f = await de(m), g = await e.saveNote({ id: n, expectedVersion: i.version || 0, blob: m, digest: f, values: p });
  await e.reload();
  let h = await e.getItem(n);
  if (!h || h.digest !== f) throw Error("Calendar save needs reconciliation. Local event retained.");
  let b = await _e(await e.original(n));
  if (Fe($t(b.exportMetadata?.notes || "")) !== Fe(o)) throw Error("Calendar readback did not match. Local event retained.");
  return { itemId: n, version: g.version, digest: f, record: o };
}
function Hi({ frame: e, getLibrary: t, getTarget: i, canSync: o = () => true }) {
  let n = false, r = false, s = false;
  async function p() {
    if (n) return;
    if (r) {
      s = true;
      return;
    }
    r = true;
    let g;
    try {
      if (g = e.contentWindow?.liveItCalendarAccess, !g || (await g.ready(), !o() || !g.canSync())) return;
      let h = t();
      if (!h?.isCloud) {
        g.status("offline", "Events saved on this device \xB7 waiting for OneDrive");
        return;
      }
      if (h.pending) return;
      let b = await i(), y = () => !n && t() === h;
      if (!await g.bind(b)) return;
      g.status("syncing", "Syncing events with KeepIt\u2026");
      let { rows: I, unavailable: missing } = await readCalendarNotes(h, _e);
      if (!y() || !await g.merge(I, b) || !y()) return;
      if (missing) {
        g.status("error", missing + " calendar item(s) could not be read. Saved events are retained. Retry sync.");
        return;
      }
      for (let c of g.pending(b)) {
        if (!y() || h.pending || !o() || !g.canSync()) return;
        let w = I.find((N) => N.record.id === c.record.id);
        if (w && Fe(w.record) === Fe(c.record)) {
          await g.ack(c.record.id, c.signature, w, b);
          continue;
        }
        if (w && w.version !== c.receipt.version) {
          await g.conflict(c.record.id, w, b);
          continue;
        }
        let v = await _i(h, c.record, c.receipt);
        if (!y()) return;
        await g.ack(c.record.id, c.signature, v, b);
      }
      let C = g.pending(b).length, l = g.conflicts();
      g.status(l ? "conflict" : C ? "pending" : "synced", l ? "Calendar changes need review" : C ? "Events waiting to sync" : "Events saved in KeepIt \xB7 available on your devices");
    } catch (h) {
      g?.status("error", "Events remain on this device \xB7 " + h.message);
    } finally {
      r = false, s && !n && (s = false, queueMicrotask(p));
    }
  }
  let d = () => {
    p();
  }, m = setInterval(d, 15e3), f = () => {
    e.contentWindow.addEventListener("liveit-calendar-change", d), e.contentWindow.addEventListener("online", d), d();
  };
  return e.addEventListener("load", f), window.addEventListener("keepit-connection-state", d), window.addEventListener("focus", d), document.addEventListener("visibilitychange", d), { sync: d, dispose() {
    n = true, clearInterval(m), window.removeEventListener("keepit-connection-state", d), window.removeEventListener("focus", d), document.removeEventListener("visibilitychange", d), e.removeEventListener("load", f);
    try {
      e.contentWindow.removeEventListener("liveit-calendar-change", d);
    } catch {
    }
  } };
}
function gt(e) {
  let i = Object.freeze(Object.fromEntries(["describeCapabilities", "createNativeNote", "openNativeNote", "getNativeNoteStatus"].map((o) => [o, (n) => e.host[o](structuredClone(n))])));
  return Object.freeze({ host: i, verifyHost: async (o) => o === i && await e.verifyHost(e.host) === true });
}
function Qi({ workspace: e, getLibrary: t, getTarget: i, getNoteUI: o, openItem: openKeepItItem, onClose: n = () => {
}, canSync: r = () => true }) {
  let s = document.createElement("section");
  s.setAttribute("aria-label", "LiveIt connected workspace"), s.style.cssText = "position:fixed;inset:0;background:#f7f7f3;z-index:1100;display:flex;flex-direction:column";
  let p = document.createElement("header");
  p.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#0d2f4f;color:white";
  let d = document.createElement("strong");
  d.textContent = "LiveIt \xB7 KeepIt notes";
  let m = document.createElement("select");
  m.setAttribute("aria-label", "LiveIt note target");
  let f = document.createElement("span");
  f.setAttribute("role", "status"), f.textContent = "Short entries stay local. Native notes use KeepIt.";
  let g = (O, P) => {
    let z = document.createElement("button");
    return z.textContent = O, z.onclick = () => {
      N(P);
    }, p.append(z), z;
  }, h = document.createElement("iframe");
  h.title = "LiveIt journal workspace", h.src = "/partners/liveit/thinkit/connected-w18e-c15396/index.html?v=trip-sync-1", h.style.cssText = "border:0;flex:1;width:100%;min-height:0", p.append(d, m, f), s.append(p, h), document.body.append(s);
  mountLiveItKeepItLinks({ frame: h, getLibrary: t, getTarget: i, openItem: openKeepItItem, isNote: ue });
  let b = Hi({ frame: h, getLibrary: t, getTarget: i, canSync: r }), y = null, I = null, C = false, l = null, c = () => {
    let O = h.contentWindow?.liveItOwnedAccess?.getScope();
    O && O !== l && (l = O, m.replaceChildren(), I = null, f.textContent = O + " workspace \xB7 refresh records to select a native note.");
  };
  h.addEventListener("load", () => {
    h.contentWindow.addEventListener("liveit-owned-workspace-render", c), c();
  });
  let w = () => {
    let O = h.contentWindow?.liveItOwnedHooks;
    if (!O) throw Error("LiveIt is still opening.");
    return O;
  };
  async function v() {
    if (!t()) throw Error("Connect OneDrive / KeepIt before opening a native note.");
    return (!y || !await y.verifyHost(y.host)) && (y = await ct({ consumer: "liveit", workspace: e, getLibrary: t, getTarget: i, getNoteUI: o, authorize: (O) => !C && w().authorize(O) })), gt(y);
  }
  async function N(O) {
    try {
      await O();
    } catch (P) {
      f.textContent = P.message;
    }
  }
  return g("Refresh LiveIt records", async () => {
    let O = await w().targets();
    m.replaceChildren();
    for (let P of O) {
      let z = document.createElement("option");
      z.value = JSON.stringify(P), z.textContent = P.type + " \xB7 " + P.title, m.append(z);
    }
    f.textContent = O.length ? "Select a record to create or reopen its native note." : "Save a synthetic Work or Personal entry below, then refresh records.";
  }), g("Open native note", async () => {
    if (!m.value) throw Error("Save a LiveIt entry below, then refresh records.");
    I = await w().openTarget(JSON.parse(m.value), await v()), f.textContent = "Native editor opened \xB7 LiveIt link saved locally \xB7 cloud save not yet verified";
  }), g("Verify note save", async () => {
    if (!I) throw Error("Open a note first.");
    let O = await w().status(I, await v());
    f.textContent = O.cloudVerified ? "Native note verified synced to OneDrive" : "Native note: " + O.state;
  }), g("Return to KeepIt", async () => {
    b.dispose(), C = true, y?.disconnect(), s.remove(), n();
  }), { root: s, syncCalendar: () => b.sync(), dispose() {
    b.dispose(), C = true, y?.disconnect(), s.remove(), n();
  } };
}
function Vi({ workspace: e, getLibrary: t, getTarget: i, getNoteUI: o, openItem: openTravelDocument, onClose: n = () => {
} }) {
  let r = document.createElement("section");
  r.setAttribute("aria-label", "TravelIt connected workspace"), r.style.cssText = "position:fixed;inset:0;background:#f7f7f3;z-index:1100;display:flex;flex-direction:column";
  let s = document.createElement("header");
  s.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#0d2f4f;color:white";
  let p = document.createElement("strong");
  p.textContent = "TravelIt \xB7 KeepIt notes";
  let d = document.createElement("select");
  d.setAttribute("aria-label", "TravelIt note target");
  let m = document.createElement("span");
  m.setAttribute("role", "status"), m.textContent = "Trip data stays local. Native notes use KeepIt.";
  let f = (c, w) => {
    let v = document.createElement("button");
    return v.textContent = c, v.onclick = () => {
      l(w);
    }, s.append(v), v;
  }, g = document.createElement("iframe");
  g.title = "TravelIt trip planning workspace", g.allowFullscreen = true, g.src = "/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html?v=trip-sync-1", g.style.cssText = "border:0;flex:1;width:100%;min-height:0", s.append(p, d, m), r.append(s, g), document.body.append(r);
  mountLiveItKeepItLinks({ app: "travelit", frame: g, getLibrary: t, getTarget: i, openItem: openTravelDocument, isNote: ue, downloadFile: at });
  let h = null, b = null, y = false, I = () => {
    let c = g.contentWindow?.travelItOwnedHooks;
    if (!c) throw Error("TravelIt is still opening.");
    return c;
  };
  async function C() {
    if (!t()) throw Error("Connect OneDrive / KeepIt before opening a native note.");
    return (!h || !await h.verifyHost(h.host)) && (h = await ct({ consumer: "travelit", workspace: e, getLibrary: t, getTarget: i, getNoteUI: o, authorize: (c) => !y && I().authorize(c) })), gt(h);
  }
  async function l(c) {
    try {
      await c();
    } catch (w) {
      m.textContent = w.message;
    }
  }
  return f("Refresh travel records", async () => {
    let c = await I().targets();
    d.replaceChildren();
    for (let w of c) {
      let v = document.createElement("option");
      v.value = JSON.stringify(w), v.textContent = w.type + " \xB7 " + w.title, d.append(v);
    }
    m.textContent = c.length ? "Select a record to create or reopen its native note." : "Create a trip or place below, then refresh records.";
  }), f("Open native note", async () => {
    if (!d.value) throw Error("Create a travel record below, then refresh records.");
    b = await I().openTarget(JSON.parse(d.value), await C()), m.textContent = "Native editor opened \xB7 TravelIt link saved locally \xB7 cloud save not yet verified";
  }), f("Verify note save", async () => {
    if (!b) throw Error("Open a note first.");
    let c = await I().status(b.association, await C());
    m.textContent = c.cloudVerified ? "Native note verified synced to OneDrive" : "Native note: " + c.state;
  }), f("Return to KeepIt", async () => {
    y = true, h?.disconnect(), r.remove(), n();
  }), { root: r, dispose() {
    y = true, h?.disconnect(), r.remove(), n();
  } };
}
var Oe = (e) => e?.mime === "application/vnd.keepit.note" || /\.keepitnote$/i.test(e?.originalName || e?.name || ""), Bo = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function Ko(e, t, i = "") {
  if (!Array.isArray(e) || !["note", "file"].includes(t) || typeof i != "string") throw Error("Invalid KeepIt selection.");
  let o = i.trim().toLocaleLowerCase().slice(0, 160);
  return e.filter((n) => n && Bo.test(n.id) && !n.trashedAt && !n.archivedAt && (t === "file" || Oe(n)) && (String(n.title || "").toLocaleLowerCase().includes(o) || String(n.originalName || "").toLocaleLowerCase().includes(o))).sort((n, r) => String(n.title || "").localeCompare(String(r.title || ""))).slice(0, 100);
}
async function Wi({ doc: e = document, library: t, kind: i = "note", isCurrent: o = () => true } = {}) {
  if (!t || !["note", "file"].includes(i) || !o()) throw Error("The original KeepIt library is unavailable.");
  let n = await t.list();
  if (!o()) throw Error("KeepIt library changed during selection.");
  return new Promise((r, s) => {
    let p = e.createElement("dialog");
    p.className = "keepit-existing-picker", p.setAttribute("aria-label", i === "note" ? "Link existing KeepIt note" : "Reference KeepIt file"), Object.assign(p.style, { zIndex: "15000", width: "min(560px,90vw)", maxHeight: "80vh", overflow: "auto", border: "2px solid #0a797a", borderRadius: "10px", background: "#f9fbfa", color: "#173b50", padding: "20px" });
    let d = e.createElement("h2");
    d.textContent = i === "note" ? "Choose an existing KeepIt note" : "Choose a KeepIt file to reference";
    let m = e.createElement("p");
    m.textContent = "Select from the current KeepIt library. No file or note is copied, renamed or modified.";
    let f = e.createElement("input");
    f.type = "search", f.placeholder = "Search the current library", f.setAttribute("aria-label", "Search KeepIt records"), f.style.cssText = "box-sizing:border-box;width:100%;padding:10px;margin:8px 0";
    let g = e.createElement("div");
    g.style.cssText = "display:flex;flex-direction:column;gap:6px;max-height:45vh;overflow:auto";
    let h = e.createElement("button");
    h.type = "button", h.textContent = "Cancel", h.style.marginTop = "12px", p.append(d, m, f, g, h), e.body.append(p);
    let b = false, y = (C, l) => {
      b || (b = true, p.close(), p.remove(), l ? s(l) : r(C));
    };
    h.onclick = () => y(null), p.addEventListener("cancel", (C) => {
      C.preventDefault(), y(null);
    });
    let I = () => {
      g.replaceChildren();
      let C = Ko(n, i, f.value);
      if (!C.length) {
        let l = e.createElement("p");
        l.textContent = "No matching KeepIt items.", g.append(l);
      }
      for (let l of C) {
        let c = e.createElement("button");
        c.type = "button", c.textContent = String(l.title || l.originalName || "Untitled").slice(0, 160) + (Oe(l) ? " \xB7 Note" : " \xB7 File"), c.style.cssText = "text-align:left;padding:9px 12px", c.onclick = async () => {
          c.disabled = true;
          try {
            if (!o()) throw Error("The selected KeepIt library changed.");
            let w = t.getItem ? await t.getItem(l.id) : (await t.list()).find((v) => v.id === l.id);
            if (!w || w.trashedAt || w.archivedAt || i === "note" && !Oe(w)) throw Error("This item was removed or changed. Please choose again.");
            if (!o()) throw Error("KeepIt library changed before the selection was confirmed.");
            y({ id: w.id, title: String(w.title || w.originalName || "Untitled").slice(0, 160), kind: Oe(w) ? "note" : "file", revision: Number.isSafeInteger(w.version) ? w.version : 0 });
          } catch (w) {
            y(null, w);
          }
        }, g.append(c);
      }
    };
    f.addEventListener("input", I), I(), p.showModal(), f.focus();
  });
}
var ht = "thinkit-native-note-v1", Gi = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i, ve = (e, t = 128) => typeof e == "string" && e.length > 0 && e.length <= t && /^[a-z0-9_:.-]+$/i.test(e);
function _o(e) {
  return !e || e.channel !== ht || e.type !== "open-note" || !ve(e.requestId) || !ve(e.projectId) || !ve(e.pageId) || !ve(e.topicId) || typeof e.title != "string" || e.title.length > 1e3 || e.noteId != null && !Gi.test(e.noteId) || e.reference != null && !mi(e.reference) || e.sourceHTML !== void 0 && (typeof e.sourceHTML != "string" || e.sourceHTML.length > 3 * 1024 * 1024) ? null : { requestId: e.requestId, projectId: e.projectId, pageId: e.pageId, topicId: e.topicId, title: e.title, noteId: e.noteId || null, reference: e.reference || null, ...e.sourceHTML !== void 0 ? { sourceHTML: e.sourceHTML } : {} };
}
function Ho(e) {
  return !e || e.channel !== ht || !["link-existing-note", "link-file", "open-file"].includes(e.type) || !ve(e.requestId) || !ve(e.projectId) || !ve(e.pageId) || !ve(e.topicId) || e.type === "open-file" && !bi(e.reference) || e.type !== "open-file" && e.reference != null ? null : { type: e.type, requestId: e.requestId, projectId: e.projectId, pageId: e.pageId, topicId: e.topicId, ...e.type === "open-file" ? { reference: e.reference } : {} };
}
function Yi({ frame: e, hostWindow: t = window, getLibrary: i, getTarget: o, getNoteUI: n, onLink: r = async () => {
}, onFileLink: s = async () => {
}, onOpenFile: p = async () => {
}, selectItem: d = Wi, onError: m = () => {
} }) {
  if (!e || !t || typeof i != "function" || typeof o != "function" || typeof n != "function" || typeof r != "function") throw new Error("ThinkIt native bridge requires a trusted KeepIt host.");
  let f = t.location.origin, g = new URL(e.src, t.location.href);
  if (g.origin !== f || !g.pathname.startsWith("/thinkit/")) throw new Error("ThinkIt must be served from the verified KeepIt origin and route.");
  let h = false, b = false, y = (C, l, c = {}) => {
    !h && e.contentWindow && e.contentWindow.postMessage({ channel: ht, type: C, requestId: l, ...c }, f);
  }, I = async (C) => {
    if (h || C.origin !== f || C.source !== e.contentWindow) return;
    let l = _o(C.data) || Ho(C.data);
    if (l) {
      if (b) {
        y("error", l.requestId, { message: "Finish opening the current note first." });
        return;
      }
      b = true;
      try {
        let c = i();
        if (!c) throw Error("KeepIt library unavailable. Your ThinkIt local note is retained.");
        let w = await o();
        if (!w || i() !== c) throw Error("KeepIt library changed. Your ThinkIt note was not linked.");
        let v = await gi(w);
        if (l.type === "open-file") {
          wi(l.reference, v);
          let x = c.getItem ? await c.getItem(l.reference.itemId) : (await c.list()).find((S) => S.id === l.reference.itemId);
          if (!x || x.trashedAt || x.archivedAt || i() !== c || w !== await o()) throw Error("Referenced KeepIt file is unavailable in the current library.");
          await p(x.id), y("file-opened", l.requestId);
          return;
        }
        if (l.type === "link-file") {
          let x = await d({ doc: t.document, library: c, kind: "file", isCurrent: () => i() === c });
          if (!x) {
            y("selection-cancelled", l.requestId);
            return;
          }
          if (i() !== c || w !== await o()) throw Error("KeepIt library changed while selecting the reference.");
          let S = c.getItem ? await c.getItem(x.id) : (await c.list()).find((F) => F.id === x.id);
          if (!S || S.trashedAt || S.archivedAt) throw Error("The selected KeepIt file is no longer available.");
          let D = { ...st(v, S.id, Number.isSafeInteger(S.version) ? S.version : 0), label: String(S.title || S.originalName || "Untitled").slice(0, 160), kind: Oe(S) ? "note" : "file" };
          await s({ projectId: l.projectId, pageId: l.pageId, topicId: l.topicId, reference: D }), y("file-reference-added", l.requestId, { reference: D });
          return;
        }
        let N;
        if (l.type === "link-existing-note") {
          if (N = await d({ doc: t.document, library: c, kind: "note", isCurrent: () => i() === c }), !N) {
            y("selection-cancelled", l.requestId);
            return;
          }
          if (i() !== c || w !== await o()) throw Error("KeepIt library changed while selecting the note.");
          let x = c.getItem ? await c.getItem(N.id) : (await c.list()).find((D) => D.id === N.id);
          if (!x || x.trashedAt || x.archivedAt || !Oe(x)) throw Error("The selected record is not an available KeepIt native note.");
          N = { id: x.id, title: String(x.title || "Untitled"), revision: Number.isSafeInteger(x.version) ? x.version : 0 };
          let S = st(v, N.id, N.revision);
          if (await r({ projectId: l.projectId, pageId: l.pageId, topicId: l.topicId, noteId: N.id, state: "existing-note", reference: S }), h || i() !== c || w !== await o()) throw Error("KeepIt library changed while saving the link; the note itself was not modified.");
          y("note-linked", l.requestId, { reference: S });
          return;
        }
        if (l.noteId) hi(l.reference, l.noteId, v);
        else if (l.reference) throw Error("The note reference is missing its matching item ID.");
        let O = await n();
        if (h || i() !== c || w !== await o()) throw Error("KeepIt library changed before opening the editor.");
        let P = { projectId: l.projectId, pageId: l.pageId, topicId: l.topicId }, z;
        if (!l.noteId && !N && l.sourceHTML?.trim() && (z = await O.migrateThinkIt({ html: l.sourceHTML, title: l.title, target: w, binding: P, library: c })), h || i() !== c || w !== await o()) throw Error("Library changed during migration; original source retained.");
        let R = await O.openLinked({ itemId: l.noteId || z?.itemId || void 0, title: l.title, expectedTarget: w, topicBinding: P, editing: true });
        if (i() !== c || w !== await o()) throw Error("KeepIt library changed while opening a note; the draft remains recoverable in its original library.");
        if (!Gi.test(R?.itemId) || R.target !== w || !["draft-saved-locally", "pending-library-save", "existing-note"].includes(R.state)) throw Error("KeepIt did not verify the native note identity and local draft state.");
        if (l.noteId && R.itemId !== l.noteId) throw Error("KeepIt returned a different note identity. The original link was retained.");
        let _ = st(v, R.itemId, R.repositoryVersion ?? 0), k = { projectId: l.projectId, pageId: l.pageId, topicId: l.topicId, noteId: R.itemId, state: R.state, reference: _, ...z ? { migration: { state: "verified", sourceHash: z.receipt.sourceHash, semanticHash: z.receipt.semanticHash, revision: z.receipt.revision } } : {} };
        if (await r(k), h || i() !== c || w !== await o()) throw Error("KeepIt library changed while the link was being saved. Its scoped reference remains in the original library.");
        y("note-opened", l.requestId, { record: k });
      } catch (c) {
        m(c), y("error", l.requestId, { message: String(c?.message || c).slice(0, 240) });
      } finally {
        b = false;
      }
    }
  };
  return t.addEventListener("message", I), { dispose() {
    h = true, t.removeEventListener("message", I);
  }, channel: ht };
}
var Ve = "thinkit-native-note-v1";
function Ji({ getLibrary: e, getTarget: t, getNoteUI: i, hostWindow: o = window, onClose: n = () => {
}, onOpenFile: r = async () => {
}, onVerifyRestore: s, onVerifyDownloadedProject: p } = {}) {
  let d = o.document, m = d.createElement("section");
  m.id = "thinkit-host-panel", m.setAttribute("role", "region"), m.setAttribute("aria-label", "ThinkIt workspace"), Object.assign(m.style, { position: "fixed", inset: "0", background: "#F7F7F3", zIndex: "1100", display: "flex", flexDirection: "column" });
  let f = d.createElement("header");
  Object.assign(f.style, { display: "flex", alignItems: "center", gap: "12px", minHeight: "48px", padding: "6px 14px", background: "#0D2F4F", color: "white" });
  let g = d.createElement("strong");
  g.textContent = "ThinkIt \xB7 Mind Map and Diagrams";
  let h = d.createElement("span");
  h.setAttribute("role", "status"), h.textContent = "Notes remain local until KeepIt verifies a save", Object.assign(h.style, { fontSize: "12px", marginLeft: "auto" });
  let b = d.createElement("button");
  b.type = "button", b.textContent = "Return to KeepIt", b.setAttribute("aria-label", "Close ThinkIt and return to KeepIt"), Object.assign(b.style, { padding: "8px 12px", borderRadius: "6px", background: "#fff", color: "#0D2F4F", border: "none" });
  let y = d.createElement("button");
  y.type = "button", y.textContent = "Migration recovery report", y.addEventListener("click", () => {
    Promise.resolve().then(i).then((k) => k.downloadThinkItMigrations()).catch((k) => {
      h.textContent = String(k.message || k).slice(0, 180);
    });
  });
  let I = d.createElement("select");
  I.setAttribute("aria-label", "Project backup and transfer");
  for (let [k, x] of [["", "Project backup and transfer\u2026"], ["light", "Lightweight map (requires KeepIt)"], ["full", "Portable full project / backup"], ["restore", "Restore portable backup (empty library)"]]) {
    let S = d.createElement("option");
    S.value = k, S.textContent = x, I.append(S);
  }
  let C = d.createElement("input");
  if (C.type = "file", C.accept = ".zip", C.hidden = true, f.style.flexWrap = "wrap", f.append(g, h, I, y, b, C), s) {
    let k = d.createElement("button");
    k.type = "button", k.textContent = "Verify current project in temporary QA library", k.addEventListener("click", () => {
      k.disabled = true, h.textContent = "Checking this Mind Map and its linked KeepIt files in fresh temporary storage\u2026", Promise.resolve().then(s).then((x) => {
        Dt(new Blob([JSON.stringify(x, null, 2)], { type: "application/json" }), "KeepIt-WP4K-Current-Project-QA-Receipt.json"), h.textContent = `Current project QA passed \xB7 ${x.verifiedRecords} original files verified \xB7 ${x.supportingFileLinks} references \xB7 temporary databases discarded. Same-session test only; receipt download requested.`;
      }).catch((x) => {
        h.textContent = String(x.message || x).slice(0, 240);
      }).finally(() => {
        k.disabled = false;
      });
    }), f.append(k);
  }
  if (p) {
    let k = d.createElement("button");
    k.type = "button", k.textContent = "Verify downloaded full-project ZIP (QA)";
    let x = d.createElement("input");
    x.type = "file", x.accept = ".zip,application/zip", x.hidden = true, k.addEventListener("click", () => {
      x.value = "", x.click();
    }), x.addEventListener("change", () => {
      let S = x.files?.[0];
      x.value = "", S && (k.disabled = true, h.textContent = "Reading your selected ZIP and checking it in disposable local storage\u2026", Promise.resolve().then(() => p(S)).then((D) => {
        Dt(new Blob([JSON.stringify(D, null, 2)], { type: "application/json" }), "KeepIt-WP4L-Disk-Project-QA-Receipt.json"), h.textContent = `Downloaded full-project ZIP verified \xB7 ${D.sourceRecords} originals \xB7 ${D.supportingFileLinks} file links \xB7 QA restored copy deleted. This does not witness a full browser restart.`;
      }).catch((D) => {
        h.textContent = "Disk backup verification failed: " + String(D?.message || D).slice(0, 210);
      }).finally(() => {
        k.disabled = false;
      }));
    }), f.append(k, x);
  }
  let l = d.createElement("iframe");
  l.src = "/thinkit/36f8901ec722db162bcf/index.html?v=keepit-files-1", l.title = "ThinkIt diagramming and Mind Map workspace", l.referrerPolicy = "no-referrer", l.style.cssText = "border:0;flex:1;width:100%;min-height:0;", m.append(f, l), d.body.append(m);
  let c = false, w = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), N = (k) => {
    if (c || k.origin !== o.location.origin || k.source !== l.contentWindow || k.data?.channel !== Ve) return;
    let x = k.data;
    if (["project-snapshot", "project-restored", "project-failed"].includes(x.type)) {
      let D = v.get(x.requestId);
      if (!D) return;
      v.delete(x.requestId), clearTimeout(D.timer), x.type === "project-failed" || x.type !== D.expectedType ? D.reject(Error(String(x.message || "Project transfer acknowledgement did not match the request").slice(0, 300))) : D.resolve(x.project);
      return;
    }
    if (!["link-stored", "link-failed", "file-link-stored"].includes(x.type)) return;
    let S = w.get(x.requestId);
    S && (w.delete(x.requestId), clearTimeout(S.timer), (x.type === "link-stored" || x.type === "file-link-stored") && x.noteId === S.noteId && x.scope === S.scope ? S.resolve() : S.reject(Error(String(x.message || "ThinkIt link verification failed").slice(0, 250))));
  };
  o.addEventListener("message", N);
  let O = (k, x) => new Promise((S, D) => {
    if (c) return D(Error("ThinkIt workspace closed."));
    let F = o.crypto.randomUUID(), B = setTimeout(() => {
      v.delete(F), D(Error("ThinkIt did not acknowledge the project transfer."));
    }, 15e3);
    v.set(F, { resolve: S, reject: D, timer: B, expectedType: k === "get-project" ? "project-snapshot" : "project-restored" }), l.contentWindow.postMessage({ channel: Ve, type: k, requestId: F, ...x ? { project: x } : {} }, o.location.origin);
  });
  I.addEventListener("change", () => {
    let k = I.value;
    if (I.value = "", !!k) {
      if (k === "restore") {
        C.value = "", C.click();
        return;
      }
      h.textContent = "Preparing and verifying project backup\u2026", Promise.resolve().then(() => O("get-project")).then(async (x) => {
        if (JSON.stringify(x).length > 24 * 1024 * 1024) throw Error("Project exceeds the 24 MiB transfer budget.");
        return (await i()).exportThinkItProject(x, k === "light");
      }).then((x) => {
        h.textContent = k === "light" ? "Lightweight map downloaded \xB7 requires KeepIt" : `Portable full project downloaded \xB7 ${x.notes} notes \xB7 ${x.drafts} drafts \xB7 ${x.pending} pending sources`;
      }).catch((x) => {
        h.textContent = String(x.message || x).slice(0, 240);
      });
    }
  }), C.addEventListener("change", () => {
    let k = C.files?.[0];
    k && (h.textContent = "Validating backup before restoring to an empty library\u2026", Promise.resolve().then(i).then((x) => x.restoreThinkItProject(k)).then(async (x) => {
      await O("restore-project", x.project), h.textContent = `Restore verified \xB7 ${x.records} records \xB7 ${x.drafts} drafts \xB7 ${x.pending} pending sources retained for review`;
    }).catch((x) => {
      h.textContent = String(x.message || x).slice(0, 240);
    }));
  });
  let R = Yi({ frame: l, hostWindow: o, getLibrary: e, getTarget: t, getNoteUI: i, onLink: (k) => new Promise((x, S) => {
    if (c || !l.contentWindow) return S(Error("ThinkIt window closed; link was not saved."));
    let D = o.crypto.randomUUID(), F = setTimeout(() => {
      w.delete(D), S(Error("ThinkIt did not confirm saving this link; native note is preserved."));
    }, 15e3);
    w.set(D, { resolve: x, reject: S, timer: F, noteId: k.noteId, scope: k.reference.scope }), l.contentWindow.postMessage({ channel: Ve, type: "link-note", requestId: D, record: k }, o.location.origin);
  }), onFileLink: (k) => new Promise((x, S) => {
    if (c || !l.contentWindow) return S(Error("ThinkIt window closed; file reference not saved."));
    let D = o.crypto.randomUUID(), F = setTimeout(() => {
      w.delete(D), S(Error("ThinkIt did not confirm saving the file reference."));
    }, 15e3);
    w.set(D, { resolve: x, reject: S, timer: F, noteId: k.reference.itemId, scope: k.reference.scope }), l.contentWindow.postMessage({ channel: Ve, type: "link-file", requestId: D, record: k }, o.location.origin);
  }), onOpenFile: r, onError: (k) => {
    h.textContent = "KeepIt: " + String(k?.message || k).slice(0, 120);
  } }), _ = () => {
    if (!c) {
      c = true, R.dispose(), o.removeEventListener("message", N);
      for (let k of [...w.values(), ...v.values()]) clearTimeout(k.timer), k.reject(Error("ThinkIt closed; acknowledgement cancelled."));
      w.clear(), v.clear(), m.remove(), n();
    }
  };
  return b.addEventListener("click", _), { dispose: _, frame: l, root: m, getProject: () => O("get-project"), loadProject: (k) => O("restore-project", k), notifyReady() {
    c || l.contentWindow?.postMessage({ channel: Ve, type: "library-ready" }, o.location.origin);
  } };
}
var Kt = Object.freeze({ thinkit: Object.freeze({ id: "thinkit", name: "ThinkIt" }), travelit: Object.freeze({ id: "travelit", name: "TravelIt" }), liveit: Object.freeze({ id: "liveit", name: "LiveIt" }) });
function Zi(e, { enabled: t = Pe } = {}) {
  if (!t) return null;
  let i = new URLSearchParams(e).getAll("connected-app");
  return i.length === 1 && Object.hasOwn(Kt, i[0]) ? Kt[i[0]] : null;
}
function Bt(e, { enabled: t = Pe } = {}) {
  if (!t || !Object.hasOwn(Kt, e)) throw Error("This app has not been integrated into this KeepIt build.");
  return "/?connected-app=" + e;
}
function Xi({ document: e = document, enabled: t = Pe } = {}) {
  if (!t) return;
  let i = e.createElement("a");
  i.href = Bt("thinkit", { enabled: t }), i.target = "_blank", i.rel = "noopener noreferrer", i.textContent = "Open ThinkIt in its own tab", i.id = "connected-thinkit-launch", i.style.cssText = "font:13px system-ui;color:#0a797a;padding:8px", e.getElementById("thinkit-launch")?.after(i);
  let o = i.cloneNode(true);
  o.href = Bt("travelit", { enabled: t }), o.id = "connected-travelit-launch", o.textContent = "Open TravelIt in its own tab", i.after(o);
  let n = i.cloneNode(true);
  return n.href = Bt("liveit", { enabled: t }), n.id = "connected-liveit-launch", n.textContent = "Open LiveIt in its own tab", o.after(n), i;
}
async function eo(e) {
  if (!e || typeof e.getRegistration != "function") return { status: "UNAVAILABLE", message: "QA service worker unavailable in this browser session. Note saving is not assessed by this check." };
  let t = await e.getRegistration();
  return t ? typeof t.update != "function" ? { status: "UNSUPPORTED", message: "QA service worker update checks are unavailable in this browser session." } : (await t.update(), { status: "CHECKED", registration: t }) : { status: "NOT_REGISTERED", message: "No QA service worker registered on this origin. This is not a note-save error." };
}
function to({ onResume: e = () => {
}, onNoteHost: t = () => {
}, onBackup: i = () => {
} } = {}) {
  if (!Pe) return;
  let o = document.createElement("aside"), n = document.createElement("span"), r = document.createElement("button"), s = document.createElement("a"), p = document.createElement("button");
  o.setAttribute("aria-label", "Private QA recovery controls"), o.style.cssText = "position:fixed;bottom:4px;left:4px;z-index:1200;background:#fff7d7;color:#173b50;padding:7px;border:1px solid #b39a50;font:12px system-ui;display:flex;gap:8px;align-items:center", n.setAttribute("role", "status"), n.textContent = "QA network: normal", r.type = "button", r.textContent = "Pause QA network (Ctrl Alt O)", s.href = "/?qa-session=secondary", s.target = "_blank", s.textContent = "Independent QA session", p.type = "button", p.textContent = "Check QA worker update", p.onclick = async () => {
    p.disabled = true;
    try {
      let b = await eo(navigator.serviceWorker);
      if (b.status !== "CHECKED") {
        n.textContent = b.message;
        return;
      }
      let y = b.registration, I = y.installing, C = () => {
        n.textContent = "QA worker: active " + (y.active?.state || "none") + "; waiting " + (y.waiting?.state || "none") + "; installing " + (y.installing?.state || "none");
      };
      I?.addEventListener("statechange", C), C();
    } catch (b) {
      n.textContent = "QA worker update check failed: " + b.message;
    } finally {
      p.disabled = false;
    }
  };
  let d = document.createElement("button");
  d.type = "button", d.textContent = "Shared note connection checks", d.onclick = () => {
    Promise.resolve(t()).catch((b) => {
      n.textContent = b.message;
    });
  };
  let m = document.createElement("button");
  m.type = "button", m.textContent = "Verify backup restore", m.onclick = () => {
    Promise.resolve(i()).catch((b) => {
      n.textContent = b.message;
    });
  }, o.style.flexWrap = "wrap", o.append(n, r, s, p, d, m), document.body.append(o);
  let f = false, g = false, h = async (b) => {
    if (g) return;
    let y = navigator.serviceWorker?.controller;
    if (!y) {
      n.textContent = "QA worker not controlling this tab. Close QA tabs and reopen.";
      return;
    }
    g = true, r.disabled = true;
    try {
      let I = await new Promise((C, l) => {
        let c = new MessageChannel(), w = setTimeout(() => {
          c.port1.close(), l(Error("QA worker did not acknowledge"));
        }, 5e3);
        c.port1.onmessage = (v) => {
          clearTimeout(w), c.port1.close(), C(v.data);
        }, y.postMessage({ type: "keepit-qa-network", paused: b }, [c.port2]);
      });
      if (I?.type !== "keepit-qa-network-state") throw Error("Unexpected QA worker reply");
      f = I.paused, n.textContent = (f ? "QA network: paused by service worker" : "QA network: normal") + " \xB7 " + (I.workerVersion || "older worker") + " \xB7 ThinkIt cache " + (I.thinkItCached ? "ready" : "unverified"), r.textContent = f ? "Resume QA network (Ctrl Alt O)" : "Pause QA network (Ctrl Alt O)", b === false && e();
    } catch (I) {
      n.textContent = I.message;
    } finally {
      g = false, r.disabled = false;
    }
  };
  r.onclick = () => {
    h(!f);
  }, document.addEventListener("keydown", (b) => {
    b.ctrlKey && b.altKey && b.key.toLowerCase() === "o" && (b.preventDefault(), b.stopPropagation(), h(!f));
  }, true), navigator.serviceWorker?.ready?.then(() => {
    navigator.serviceWorker.controller && h();
  }).catch(() => {
  });
}
var bt = class {
  constructor({ name: t = "keepit-thumbnails-v1", maxBytes: i = 64 * 1024 ** 2, maxEntries: o = 4e3 } = {}) {
    this.db = new dt(t), this.db.version(1).stores({ posters: "&key,used", sizes: "&key,used" }), this.maxBytes = i, this.maxEntries = o, this.disabled = false;
  }
  async get(t) {
    if (this.disabled) return null;
    try {
      let i = await this.db.posters.get(t);
      return i && await this.db.sizes.update(t, { used: Date.now() }), i || null;
    } catch {
      return this.disabled = true, null;
    }
  }
  async put(t, i, o = {}) {
    if (!(this.disabled || !i || i.size > 512 * 1024)) try {
      await this.db.transaction("rw", this.db.posters, this.db.sizes, async () => {
        await this.db.posters.put({ key: t, blob: i, bytes: i.size, used: Date.now(), duration: o.duration }), await this.db.sizes.put({ key: t, bytes: i.size, used: Date.now() });
        let n = await this.db.sizes.orderBy("used").toArray(), r = n.reduce((p, d) => p + d.bytes, 0), s = n.length;
        for (let p of n) {
          if (r <= this.maxBytes && s <= this.maxEntries) break;
          await this.db.posters.delete(p.key), await this.db.sizes.delete(p.key), r -= p.bytes, s--;
        }
      });
    } catch {
      this.disabled = true;
    }
  }
};
function io(e, t) {
  return JSON.stringify(["thumb-v1", e, t.id, t.digest, t.mime === "application/vnd.keepit.note" ? t.title : ""]);
}
var oo = (e) => typeof e == "string" && /^[a-f0-9]{64}$/i.test(e), We = "STAGING_INTEGRITY_FAILED";
async function ke(e, { expectedBytes: t, expectedDigest: i, hashBlob: o } = {}) {
  if (!(e instanceof Blob) || !Number.isSafeInteger(e.size) || e.size < 0 || typeof o != "function") throw new Error("KeepIt cannot verify the queued original. Re-select the original file.");
  if (t !== void 0 && (!Number.isSafeInteger(t) || e.size !== t)) throw new Error("The queued original size changed. Upload stopped; keep or export the local copy for review.");
  let n = await o(e);
  if (!oo(n)) throw new Error("The queued original checksum could not be verified. Upload stopped.");
  if (i !== void 0 && (!oo(i) || n.toLowerCase() !== i.toLowerCase())) throw new Error("The queued original bytes changed. Upload stopped; never publish these bytes as the original.");
  return Object.freeze({ bytes: e.size, digest: n.toLowerCase() });
}
var no = "keepit-original-readback-v1", ro = (e) => typeof e == "string" && /^[a-f0-9]{64}$/i.test(e), _t = (e) => e?.options?.uploadIdentity?.id;
function ao(e, t) {
  if (!e?.id || !e.target || !_t(e) || !t?.id || !ro(t.digest) || !Number.isSafeInteger(t.bytes) || t.bytes < 0 || t.digest.toLowerCase() !== e.stagedDigest?.toLowerCase() || t.bytes !== e.stagedBytes) throw new Error("Verified original receipt cannot be created for an unbound queued file.");
  return Object.freeze({ format: no, jobId: e.id, target: e.target, uploadIdentity: _t(e), itemId: t.id, digest: t.digest.toLowerCase(), bytes: t.bytes });
}
function Ht(e, t, i) {
  let o = _t(t);
  if (!e || e.format !== no || e.jobId !== t?.id || e.target !== t?.target || e.uploadIdentity !== o || !e.itemId || !ro(e.digest) || e.digest.toLowerCase() !== t?.stagedDigest?.toLowerCase() || e.bytes !== t?.stagedBytes || !i || i.state !== "saving" || i.id !== t.id || i.target !== t.target || i.options?.uploadIdentity?.id !== o || i.name !== t.name || i.stagedBytes !== t.stagedBytes || i.stagedDigest?.toLowerCase() !== t.stagedDigest?.toLowerCase() || i.attempts !== t.attempts || !(i.blob instanceof Blob)) {
    let n = new Error("KeepIt cannot match the verified save to this queued original. The staged copy has been retained for review.");
    throw n.code = "SAVE_UNVERIFIED", n;
  }
  return true;
}
var wt = class {
  constructor({ name: t = "keepit-upload-queue-v1", locks: i = globalThis.navigator?.locks, onChange: o = () => {
  }, preferArrayBuffer: n = void 0 } = {}) {
    this.db = new dt(t), this.db.version(1).stores({ jobs: "&id,target,state,order" }), this.locks = i, this.onChange = o, this.running = false, this.preferArrayBuffer = n ?? (typeof navigator < "u" && /AppleWebKit/i.test(navigator.userAgent || "") && !/Chrome\/|Chromium\/|Edg\//i.test(navigator.userAgent || "")), this.db.jobs.hook("reading", (r) => (r?.blobData instanceof ArrayBuffer && !(r.blob instanceof Blob) && (r.blob = new Blob([r.blobData], { type: r.mime || "application/octet-stream" })), r));
  }
  async notify() {
    try {
      await this.onChange();
    } catch {
    }
  }
  async open() {
    return await this.db.open(), this;
  }
  async list() {
    return this.db.jobs.orderBy("order").toArray();
  }
  async enqueue(t, i, o, n = null) {
    let r = Date.now(), s = [];
    for (let [p, d] of i.entries()) {
      if (typeof d?.name != "string" || !d.name || d.name.length > 4096) throw new Error("Choose a file with a valid name.");
      let m = await ke(d, { hashBlob: de }), f = this.preferArrayBuffer ? await d.arrayBuffer() : null;
      if (f && f.byteLength !== m.bytes) throw new Error("The staged file changed size during WebKit-safe conversion.");
      s.push({ id: crypto.randomUUID(), target: t, rootHandle: n, blob: f ? null : d, blobData: f, name: d.name, mime: d.type, stagedBytes: m.bytes, stagedDigest: m.digest, options: { ...structuredClone(o), uploadIdentity: { id: crypto.randomUUID(), shortCode: Se() } }, state: "queued", order: r + p / 1e3, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    await this.db.transaction("rw", this.db.jobs, async () => {
      let p = await this.db.jobs.orderBy("order").last(), d = Math.max(r, (p?.order || 0) + 1);
      s.forEach((m, f) => {
        m.order = d + f;
      }), await this.db.jobs.bulkAdd(s);
    });
    try {
      for (let p of s) {
        let d = await this.db.jobs.get(p.id);
        if (!d || d.target !== t || d.name !== p.name) throw new Error("KeepIt could not reopen the queued original.");
        await ke(d.blob, { expectedBytes: p.stagedBytes, expectedDigest: p.stagedDigest, hashBlob: de });
      }
    } catch (p) {
      for (let d of s) await this.db.jobs.update(d.id, { state: "review", error: "Queued file readback failed: " + p.message, errorCode: We, retryAt: null }).catch(() => {
      });
      throw await this.notify(), p;
    }
    return await this.notify(), s.map((p) => p.id);
  }
  async retargetZeroByte(t, { target: i, shortCode: o, expectedBytes: n } = {}) {
    let r = await this.db.transaction("rw", this.db.jobs, async () => {
      let s = await this.db.jobs.get(t);
      if (!s || !["failed", "review"].includes(s.state) || s.errorCode !== "ORIGINAL_UNVERIFIED") throw new Error("This upload is no longer awaiting original-file review.");
      if (s.target !== i || !String(i || "").startsWith('["cloud",')) throw new Error("The selected cloud library changed. Queued bytes were retained.");
      if (s.blob?.size !== n || !Number.isSafeInteger(n) || n <= 0) throw new Error("The queued PDF size changed. Recovery refused.");
      let p = s.options?.uploadIdentity;
      if (!p || p.shortCode !== o || !/^[0-9A-HJKMNP-TV-Z]{8}$/.test(o || "")) throw new Error("The original upload identity changed. Recovery refused.");
      if ((s.zeroByteSalvage?.count || 0) > 0) throw new Error("This file already received a fresh recovery name. Inspect before any further attempt.");
      let d = Se();
      for (let m = 0; m < 4 && d === o; m++) d = Se();
      if (d === o) throw new Error("Unable to generate a different recovery filename.");
      return await this.db.jobs.update(t, { options: { ...s.options, uploadIdentity: { ...p, shortCode: d } }, zeroByteSalvage: { count: 1, previousShortCode: o, retargetedAt: (/* @__PURE__ */ new Date()).toISOString() }, state: "queued", attempts: 0, error: null, errorCode: null, retryAt: null }), { previousShortCode: o, newShortCode: d };
    });
    return await this.notify(), r;
  }
  async retry(t) {
    await this.db.transaction("rw", this.db.jobs, async () => {
      let i = await this.db.jobs.get(t);
      if (!i || !["failed", "review"].includes(i.state)) throw new Error("That upload is not waiting for review.");
      if (i.errorCode === We) throw new Error("Queued bytes failed integrity checks. Re-select the original file; do not retry the damaged queue entry.");
      if (i.errorCode === "SAVE_INTEGRITY_FAILED") throw new Error("The saved original failed verification. Keep the queued original; review the library before retrying.");
      await this.db.jobs.update(t, { state: "queued", error: null, errorCode: null, attempts: 0, retryAt: null });
    }), await this.notify();
  }
  async cancel(t) {
    await this.db.transaction("rw", this.db.jobs, async () => {
      let i = await this.db.jobs.get(t);
      if (!i || i.state === "saving") throw new Error("Wait for the current save before removing it.");
      await this.db.jobs.delete(t);
    }), await this.notify();
  }
  async exportable(t) {
    let i = await this.db.jobs.get(t);
    if (!i || i.state === "saved" || !(i.blob instanceof Blob)) throw new Error("No pending original is available for export.");
    return await ke(i.blob, { expectedBytes: i.stagedBytes, expectedDigest: i.stagedDigest, hashBlob: de }), new File([i.blob], i.name, { type: i.mime || "application/octet-stream" });
  }
  async drain(t, i) {
    if (!this.running) {
      if (!this.locks?.request) throw new Error("This browser cannot safely coordinate the upload queue. Open KeepIt in Safari or Chrome.");
      this.running = true;
      try {
        await this.locks.request("keepit-upload-queue-writer", { mode: "exclusive", ifAvailable: true }, async (o) => {
          if (o) for (await this.db.jobs.where("state").equals("saving").modify({ state: "review", error: "Checking an interrupted save before resuming.", errorCode: "NETWORK_UNKNOWN", retryAt: Date.now() }); ; ) {
            let n = await this.db.transaction("rw", this.db.jobs, async () => {
              let r = (await this.db.jobs.where("target").equals(t).toArray()).filter((s) => He(s)).sort((s, p) => s.order - p.order || s.id.localeCompare(p.id))[0];
              return r && (r.attempts = (r.attempts || 0) + 1, r.options.uploadIdentity ||= { id: crypto.randomUUID(), shortCode: Se() }, await this.db.jobs.update(r.id, { state: "saving", attempts: r.attempts, options: r.options })), r;
            });
            if (!n) break;
            await this.notify();
            try {
              let r = await ke(n.blob, { expectedBytes: n.stagedBytes, expectedDigest: n.stagedDigest, hashBlob: de });
              n.stagedDigest === void 0 && (await this.db.jobs.update(n.id, { stagedDigest: r.digest, stagedBytes: r.bytes }), n.stagedDigest = r.digest, n.stagedBytes = r.bytes);
              let s = await i(n);
              if (s?.verifiedOriginal !== true) throw Object.assign(new Error("KeepIt has not verified the saved original. The staged copy is retained for review."), { code: "SAVE_UNVERIFIED" });
              let p = await this.db.jobs.get(n.id);
              Ht(s.receipt, n, p), await this.db.transaction("rw", this.db.jobs, async () => {
                let d = await this.db.jobs.get(n.id);
                Ht(s.receipt, n, d), await this.db.jobs.update(n.id, { state: "saved", duplicate: !!s?.duplicate, blob: null, blobData: null, rootHandle: null, error: null });
                let m = (await this.db.jobs.where("state").equals("saved").toArray()).sort((f, g) => g.order - f.order);
                await this.db.jobs.bulkDelete(m.slice(20).map((f) => f.id));
              });
            } catch (r) {
              let s = r?.code === "SAVE_INTEGRITY_FAILED", p = r?.code === We || !r?.code && /queued original|queued bytes|queued original checksum|checksum could not be verified/i.test(String(r?.message || ""));
              if (await this.db.jobs.update(n.id, s ? { state: "review", error: String(r.message), errorCode: "SAVE_INTEGRITY_FAILED", retryAt: null } : p ? { state: "review", error: String(r.message), errorCode: We, retryAt: null } : Ni(r, n.attempts)), ["AUTH_REQUIRED", "AUTH_TIMEOUT"].includes(r.code)) {
                await this.notify();
                break;
              }
            }
            await this.notify();
          }
        });
      } finally {
        this.running = false;
      }
    }
  }
};
function lo(e) {
  return e === "ORIGINAL_UNVERIFIED" ? "inspect" : "retry";
}
var Qo = /^[0-9A-HJKMNP-TV-Z]{8}$/, so = (e) => Number.isSafeInteger(e) && e >= 0 ? e : null;
function Vo(e, { shortCode: t, expectedBytes: i, folderId: o }) {
  if (!Qo.test(t || "") || so(i) === null || !o) throw new Error("Queued file identification is incomplete. No cloud changes were made.");
  if (!Array.isArray(e)) throw new Error("OneDrive did not return an inspectable QA folder listing.");
  let n = new RegExp("-" + t + "\\.[a-z0-9]{1,10}$", "i"), r = e.filter((h) => typeof h?.name == "string" && n.test(h.name));
  if (!r.length) return { status: "missing", count: 0, expectedBytes: i, observedBytes: null, summary: "No file with this upload ID is visible in QA Files. The upload session or a different folder may still need reconciliation. Queued copy retained." };
  if (r.length !== 1) return { status: "ambiguous", count: r.length, expectedBytes: i, observedBytes: null, summary: "Multiple OneDrive files share this upload ID. Do not retry or delete any file; queued copy retained." };
  let s = r[0], p = so(s.size), d = !!s.file && !s.folder, m = s.parentReference?.id === o, f = m && d && p === i, g;
  return m ? d ? p === null ? g = "OneDrive omitted the file byte size. Nothing was overwritten." : p !== i ? g = `The queued original is ${i} bytes; OneDrive reports ${p} bytes. The existing item is not reusable. No changes were made.` : g = "OneDrive reports the expected file size and folder. Content has NOT been verified; nothing was saved or changed." : g = "The matching item is not confirmed as a file. Nothing was overwritten." : g = "The existing file is not confirmed in the QA Files folder. No changes were made.", { status: f ? "metadata-match" : "metadata-mismatch", count: 1, expectedBytes: i, observedBytes: p, summary: g };
}
async function co({ library: e, job: t, requireQaRepository: i }) {
  if (!e?.isCloud || e.readOnly) return { status: "offline", summary: "OneDrive is reconnecting. This is only the last verified gallery; the queued original stays on this device. Inspect after the connection is live." };
  let o = e.fs;
  if (!o?.qaDriveRootId || !e.root?.item || !e.files?.item) return { status: "unsafe", summary: "Verified QA folder context unavailable. No inspection or cloud changes were made." };
  i(o, e.root.item, { enabled: true });
  let n = await o.children(e.files.item.id);
  return Vo(n, { shortCode: t.options?.uploadIdentity?.shortCode, expectedBytes: t.blob?.size, folderId: e.files.item.id });
}
var xt = (e) => Object.assign(new Error(e), { code: "SAVE_INTEGRITY_FAILED" }), Ie = (e) => {
  if (e() !== true) throw Error("Selected KeepIt library changed during the upload. The queued original remains available.");
};
async function po({ library: e, job: t, hashBlob: i, checkActive: o = () => true } = {}) {
  if (!e || typeof e.list != "function" || typeof e.original != "function" || typeof i != "function" || !t?.blob) throw Error("Cannot verify this KeepIt upload. Its queued original must be retained.");
  Ie(o);
  let n = await ke(t.blob, { expectedBytes: t.stagedBytes, expectedDigest: t.stagedDigest, hashBlob: i });
  Ie(o), (t.attempts || 0) > 1 && typeof e.reload == "function" && (await e.reload(), Ie(o));
  let r = await e.list();
  Ie(o);
  let s = t.options?.uploadIdentity?.id;
  if (s) {
    let h = r.find((b) => b.id === s);
    if (h && h.digest !== n.digest) throw xt("A different original already uses the queued upload identity. Upload stopped; review the original.");
  }
  let p = r.filter((h) => h.digest === n.digest && !h.trashedAt), d;
  if (p.length) d = { item: p.find((h) => h.id === s) || p[0], duplicate: true, reconciled: true };
  else {
    let h = new File([t.blob], t.name, { type: t.mime || "application/octet-stream" });
    d = await e.importFile(h, t.options || {}), Ie(o);
  }
  let m = d?.item;
  if (!m?.id || m.digest !== n.digest || m.bytes !== n.bytes || m.trashedAt) throw xt("KeepIt could not confirm the saved catalog record matches the queued original. The queued bytes were retained.");
  let f = typeof e.getItem == "function" ? await e.getItem(m.id) : (await e.list()).find((h) => h.id === m.id);
  if (Ie(o), !f || f.digest !== n.digest || f.bytes !== n.bytes || f.trashedAt) throw xt("The saved catalog record could not be read back unchanged. Keep the queued original for review.");
  let g = await e.original(m.id);
  Ie(o);
  try {
    await ke(g, { expectedBytes: n.bytes, expectedDigest: n.digest, hashBlob: i });
  } catch (h) {
    throw xt("KeepIt could not verify the saved original bytes. " + String(h?.message || h));
  }
  return Ie(o), { ...d, item: f, verifiedOriginal: true, verification: "selected-library-readback-not-independent-cloud-audit", receipt: ao(t, f) };
}
var yt = class {
  constructor({ maxBytes: t = 16 * 1024 ** 2, maxEntries: i = 200, urls: o = URL } = {}) {
    this.maxBytes = t, this.maxEntries = i, this.urls = o, this.entries = /* @__PURE__ */ new Map(), this.bytes = 0;
  }
  get(t) {
    let i = this.entries.get(t);
    return i && (this.entries.delete(t), this.entries.set(t, i)), i;
  }
  put(t, i, o = {}) {
    if (i.size > this.maxBytes || this.maxEntries < 1) return null;
    for (this.remove(t); this.bytes + i.size > this.maxBytes || this.entries.size >= this.maxEntries; ) this.remove(this.entries.keys().next().value);
    let n = { ...o, url: this.urls.createObjectURL(i), bytes: i.size };
    return this.entries.set(t, n), this.bytes += n.bytes, n;
  }
  remove(t) {
    let i = this.entries.get(t);
    i && (this.urls.revokeObjectURL(i.url), this.bytes -= i.bytes, this.entries.delete(t));
  }
  clear() {
    for (let t of this.entries.keys()) this.remove(t);
  }
};
function uo({ onSlow: e, delay: t = 15e3, schedule: i = setTimeout, cancel: o = clearTimeout }) {
  let n = "Opening your library\u2026", r = false, s = i(() => {
    r || e(n);
  }, t);
  return { stage(p) {
    n = p;
  }, finish() {
    r = true, o(s);
  } };
}
var fo = "mylibrary-appearance-1", Wo = () => {
  try {
    return JSON.parse(localStorage.getItem(fo) || "{}") || {};
  } catch {
    return {};
  }
};
function mo() {
  let e = (c) => document.getElementById(c), t = Wo(), i = matchMedia("(max-width:820px)"), o = matchMedia("(prefers-color-scheme:dark)"), n = ["system", "light", "dark"].includes(t.theme) ? t.theme : "system", r = typeof t.sidebarHidden == "boolean" ? t.sidebarHidden : i.matches, s = () => {
    try {
      localStorage.setItem(fo, JSON.stringify({ theme: n, sidebarHidden: r, tileSize: Number(e("thumbnail-size").value), captions: e("show-captions").getAttribute("aria-pressed") === "true", list: e("items").classList.contains("list-mode") }));
    } catch {
    }
  };
  function p() {
    let c = n === "dark" || n === "system" && o.matches;
    document.documentElement.dataset.theme = c ? "dark" : "light", e("appearance").value = n, e("theme-toggle").setAttribute("aria-label", c ? "Switch to light mode" : "Switch to dark mode"), e("theme-toggle").title = c ? "Switch to light mode" : "Switch to dark mode", document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c ? "#141416" : "#f9f9fb");
  }
  function d() {
    document.body.classList.toggle("sidebar-hidden", r), e("sidebar-toggle").setAttribute("aria-expanded", String(!r)), e("sidebar-toggle").setAttribute("aria-label", r ? "Show sidebar" : "Hide sidebar"), e("library-sidebar").inert = r;
  }
  p(), d(), o.addEventListener("change", p), e("theme-toggle").onclick = () => {
    n = document.documentElement.dataset.theme === "dark" ? "light" : "dark", p(), s();
  }, e("appearance").onchange = () => {
    n = e("appearance").value, p(), s();
  }, e("sidebar-toggle").onclick = () => {
    r = !r, d(), s();
  }, document.addEventListener("keydown", (c) => {
    c.defaultPrevented || document.querySelector("dialog[open]") || ((c.metaKey || c.ctrlKey) && !c.shiftKey && c.key === "\\" && (c.preventDefault(), e("sidebar-toggle").click()), c.key === "Escape" && i.matches && !r && (r = true, d(), s()), (c.metaKey || c.ctrlKey) && c.key.toLowerCase() === "f" && (c.preventDefault(), e("search").focus()));
  }), document.querySelector(".library-main").addEventListener("pointerdown", (c) => {
    i.matches && !r && !c.target.closest("#sidebar-toggle") && (r = true, d(), s());
  }), e("thumbnail-size").value = String(Math.min(320, Math.max(130, Number(t.tileSize) || (i.matches ? 150 : 190))));
  let m = () => {
    document.documentElement.style.setProperty("--tile-size", e("thumbnail-size").value + "px"), s();
  };
  m(), e("thumbnail-size").oninput = m;
  function f(c) {
    document.body.classList.toggle("show-captions", c), e("show-captions").setAttribute("aria-pressed", String(c)), e("show-captions").setAttribute("aria-label", c ? "Hide file titles" : "Show file titles"), e("show-captions").title = c ? "Hide file titles" : "Show file titles";
  }
  f(!!t.captions), e("show-captions").onclick = () => {
    f(!document.body.classList.contains("show-captions")), s();
  }, t.list && (e("items").classList.add("list-mode"), e("density-switch").textContent = "Grid view", e("density-switch").setAttribute("aria-pressed", "true")), new MutationObserver(s).observe(e("items"), { attributes: true, attributeFilter: ["class"] });
  let g = () => {
    e("more-menu").hidden = true, e("more-trigger").setAttribute("aria-expanded", "false");
  };
  function h() {
    g(), e("settings-folder").textContent = e("storage-location-label").textContent, e("settings-change-folder").hidden = !document.body.classList.contains("folder-library-mode") || typeof window.showDirectoryPicker != "function", e("settings-dialog").showModal();
  }
  e("sidebar-settings").onclick = h, e("menu-settings").onclick = h, e("settings-close").onclick = () => e("settings-dialog").close(), e("settings-change-folder").onclick = () => {
    e("settings-dialog").close(), e("choose-folder").click();
  };
  for (let c of document.querySelectorAll("[data-media]")) c.onclick = () => {
    document.querySelector('[data-filter="all"]').click(), e("type-filter").value = c.dataset.media, e("type-filter").dispatchEvent(new Event("change")), i.matches && (r = true, d(), s());
  };
  let b = () => {
    let c = e("type-filter").value;
    document.querySelectorAll("[data-media]").forEach((w) => {
      let v = w.dataset.media === c && document.querySelector('[data-filter="all"]').classList.contains("selected");
      w.classList.toggle("selected", v), w.setAttribute("aria-pressed", String(v));
    });
  };
  e("type-filter").addEventListener("change", b), document.querySelector('nav[aria-label="Library"]').addEventListener("click", b);
  let y = null;
  window.addEventListener("beforeinstallprompt", (c) => {
    c.preventDefault(), y = c;
  });
  let I = matchMedia("(display-mode:standalone)");
  function C() {
    if (I.matches) {
      for (let c of ["install-app", "menu-install"]) e(c).hidden = true;
      e("settings-install").textContent = "Installed", e("settings-install").hidden = true, document.querySelector("#settings-install + .fineprint").textContent = "KeepIt \xB7 Installed app";
    }
  }
  window.addEventListener("appinstalled", () => {
    y = null, C();
  }), I.addEventListener("change", C), C();
  async function l() {
    if (g(), e("settings-dialog").close(), y) {
      let c = y;
      y = null;
      try {
        await c.prompt(), await c.userChoice;
        return;
      } catch {
      }
    }
    e("install-dialog").open || e("install-dialog").showModal();
  }
  for (let c of ["install-app", "menu-install", "settings-install"]) e(c).onclick = l;
  e("install-close").onclick = () => e("install-dialog").close(), e("search").placeholder = "Search your library";
}
async function Go(e) {
  A(e?.kind === "directory", "Choose the Mac library folder containing Files and _Catalog.");
  let t = await e.getDirectoryHandle("_Catalog"), i;
  try {
    i = await t.getFileHandle("keepit-cloud.json");
  } catch (s) {
    if (s.name !== "NotFoundError") throw s;
  }
  A(!i, "That folder is already a OneDrive library. Choose the earlier local Mac library instead.");
  let o = await (await t.getFileHandle("library.json")).getFile();
  A(o.size > 0 && o.size <= 256 * 1024 ** 2, "The Mac library identity could not be read.");
  let n = JSON.parse(await o.text());
  A(n.format === "mylibrary-folder-1" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(n.libraryId), "This is not an existing KeepIt Mac library.");
  let r = new pt(e);
  return r.identity = n, r.files = await e.getDirectoryHandle("Files"), r.commits = await t.getDirectoryHandle("commits"), r.state = await r.readHead(), A(r.state, "The Mac catalog is missing. Its files were not changed."), r.snapshot();
}
async function go(e, t, { onProgress: i = () => {
} } = {}) {
  A(t?.isCloud, "Connect the destination OneDrive library first.");
  let o = await Go(e);
  A(o.info.libraryId !== (await t.info()).libraryId, "This is already the connected library."), A(o.items.length, "This Mac library is empty. Choose the folder used for your earlier files.");
  let n = [];
  for (let s of o.items) i({ name: s.originalName, done: n.length, total: o.items.length }), n.push({ item: s, blob: await o.getOriginal(s.id) });
  return n.metadataSchema = o.info.metadataSchema, n.printTemplates = o.info.printTemplates, { ...await t.restore(n), total: o.items.length };
}
function ho(e, { signal: t } = {}) {
  return new Promise((i, o) => {
    let n = document.createElement("video"), r = URL.createObjectURL(e), s = false, p, d = (g, h) => {
      s || (s = true, clearTimeout(p), t?.removeEventListener("abort", m), n.onloadedmetadata = n.onseeked = n.onerror = null, n.pause(), n.removeAttribute("src"), n.load(), URL.revokeObjectURL(r), g ? o(g) : i(h));
    }, m = () => d(new DOMException("Thumbnail cancelled", "AbortError"));
    if (t?.aborted) {
      m();
      return;
    }
    t?.addEventListener("abort", m, { once: true }), p = setTimeout(() => d(new Error("Video thumbnail unavailable")), 12e3), n.muted = true, n.preload = "metadata", n.playsInline = true;
    let f = () => {
      try {
        if (!n.videoWidth || !n.videoHeight) throw new Error("Video picture unavailable");
        let g = 360, h = Math.max(1, Math.round(g * n.videoHeight / n.videoWidth)), b = document.createElement("canvas");
        b.width = g, b.height = Math.min(640, h), b.getContext("2d").drawImage(n, 0, 0, b.width, b.height), b.toBlob((I) => I ? d(null, { poster: I, duration: Number.isFinite(n.duration) ? n.duration : null }) : d(new Error("Video thumbnail unavailable")), "image/webp", 0.8);
      } catch (g) {
        d(g);
      }
    };
    n.onloadedmetadata = () => {
      s || (n.onseeked = f, n.currentTime = Number.isFinite(n.duration) ? Math.min(1, Math.max(1e-3, n.duration * 0.1)) : 1e-3);
    }, n.onerror = () => d(new Error("Video codec unavailable")), n.src = r;
  });
}
function bo(e) {
  if (!Number.isFinite(e) || e < 0) return "";
  let t = Math.floor(e), i = Math.floor(t / 3600), o = Math.floor(t % 3600 / 60), n = String(t % 60).padStart(2, "0");
  return i ? `${i}:${String(o).padStart(2, "0")}:${n}` : `${o}:${n}`;
}
async function wo(e, { onText: t = () => {
}, onProgress: i = () => {
}, signal: o } = {}) {
  let n = () => {
    if (o?.aborted) throw new DOMException("Preview cancelled", "AbortError");
  };
  n();
  let r = await ut.open(e);
  n();
  let s = 0;
  for (let [d, m] of r.entries) if (!d.endsWith("/")) {
    if (m.size > 64 * 1024 ** 2) throw new Error("An Office component exceeds the 64 MiB preview budget.");
    if (s += m.size, s > 256 * 1024 ** 2) throw new Error("Office content is too large for the bounded preview. Open the original for its full contents.");
  }
  if (r.entries.has("word/document.xml")) {
    let d = await r.xml("word/document.xml");
    n(), t(Pi(d));
  }
  let p = 0;
  for (let [d] of r.entries) n(), !d.endsWith("/") && (/\.(xml|rels)$/i.test(d) ? await r.xml(d) : await r.read(d), p++, i({ done: p, total: r.entries.size }));
  return n(), r.bytes.buffer;
}
function xo(e, { onText: t, onProgress: i, signal: o } = {}) {
  let n = "/assets/office-preflight-XK5K5XPU.js";
  return !n || typeof Worker != "function" ? wo(e, { onText: t, onProgress: i, signal: o }) : new Promise((r, s) => {
    let p = new Worker(n, { type: "module" }), d = false, m = (g, h) => {
      d || (d = true, o?.removeEventListener("abort", f), p.terminate(), g ? s(g) : r(h));
    }, f = () => m(new DOMException("Preview cancelled", "AbortError"));
    if (o?.aborted) {
      f();
      return;
    }
    o?.addEventListener("abort", f, { once: true }), p.onmessage = ({ data: g }) => {
      d || (g.type === "text" ? t?.(g.value) : g.type === "progress" ? i?.(g.value) : g.type === "ready" ? m(null, g.buffer) : g.type === "error" && m(new Error(g.message)));
    }, p.onerror = () => m(new Error("The document could not be prepared. Try opening it again.")), p.postMessage({ blob: e });
  });
}
var Ge = /* @__PURE__ */ new Map();
async function Yo(e) {
  if (!Ge.has(e)) {
    let i = fetch(e === "word" ? "/word-preview-64fead4e7e7c.html" : "/office-preview-370474ffb9b6.html", { credentials: "same-origin" }).then(async (o) => {
      if (!o.ok) throw new Error("The viewer could not load. Reopen KeepIt and try again.");
      let n = await o.text();
      if (!n.includes(`data-mylibrary-office="${e}"`)) throw new Error("The viewer could not load. Reopen KeepIt and try again.");
      return n;
    }).catch((o) => {
      throw Ge.delete(e), o;
    });
    Ge.set(e, i);
  }
  return Ge.get(e);
}
var ee = (e, t, i) => {
  let o = document.createElement(e);
  return t !== void 0 && (o.textContent = t), i && (o.className = i), o;
};
async function yo(e, t, i, o = () => true) {
  let n = /\.(docx|docm)$/i.test(t.originalName), r = n ? "word" : "powerpoint", s = ee("div", void 0, "office-preview-shell"), p = ee("div", void 0, "office-host-tools"), d = ee("span", n ? "Opening document\u2026" : "Opening presentation\u2026", "office-host-status"), m = ee("button", "Page view"), f = ee("button", "Text view"), g = ee("button", "Retry"), h = ee("div", void 0, "office-page-host"), b = ee("div", void 0, "office-text-view"), y = ee("div", n ? "Opening document\u2026" : "Opening presentation\u2026", "office-loading");
  d.setAttribute("role", "status"), b.setAttribute("aria-label", "Document text");
  for (let q of [m, f, g]) q.type = "button";
  m.hidden = f.hidden = !n, g.hidden = true, m.setAttribute("aria-pressed", "true"), f.setAttribute("aria-pressed", "false"), b.hidden = true, h.append(y), p.append(d, m, f, g);
  let I = ee("div", void 0, "office-view-body");
  I.append(h, b), s.append(p, I), i.append(s);
  let C = false, l = null, c = null, w = 0, v = false, N = false, O = false, P = null, z = false, R = null, _ = () => !C && o(), k = () => {
    clearTimeout(c), c = null;
  };
  function x(q) {
    b.hidden = !q, s.dataset.view = q ? "text" : "page", h.setAttribute("aria-hidden", String(q)), h.inert = q, m.setAttribute("aria-pressed", String(!q)), f.setAttribute("aria-pressed", String(q));
  }
  function S(q) {
    _() && (k(), w++, R?.abort(), P = null, d.textContent = q, g.hidden = false, s.dataset.loading = "error", y.textContent = q, O && x(true), l?.remove(), l = null);
  }
  function D(q, H) {
    k(), c = setTimeout(() => S(H), q);
  }
  function F(q) {
    if (!(!_() || !n)) {
      b.replaceChildren(), O = true;
      for (let H of q.paragraphs) b.append(ee("p", H || "\xA0"));
      q.paragraphs.some((H) => H.trim()) || b.append(ee("p", "This document has no readable text. Use page view to see its images and layout.", "office-text-hint")), q.truncated && b.append(ee("p", "Text view is abbreviated. Use page view for the full document.", "office-text-hint")), v || (x(true), d.textContent = "Preparing page layout\u2026");
    }
  }
  let B = (q) => {
    if (!_() || !l || q.source !== l.contentWindow) return;
    let H = q.data?.type;
    if (H === "mylibrary:office-loaded" && !z && P) {
      z = true;
      let se = P;
      P = null, l.contentWindow.postMessage({ type: "mylibrary:office-open", format: r, buffer: se }, "*", [se]), D(3e4, "Page view is taking too long. You can read the text or retry.");
    } else H === "mylibrary:office-ready" ? (v = true, s.dataset.loading = "ready", k(), g.hidden = true, y.hidden = true, l.style.opacity = "1", d.textContent = q.data.message || "Ready", N || x(false), l.contentWindow.postMessage({ type: "mylibrary:office-immersive", active: !!i.closest(".viewer-fullscreen") }, "*")) : H === "mylibrary:office-error" && S("Page view could not open. " + (O ? "Text view is available." : "Try again or download the original."));
  };
  window.addEventListener("message", B);
  async function Ke() {
    R?.abort(), R = new AbortController();
    let q = ++w;
    z = false, v = false, P = null, l?.remove(), l = null, g.hidden = true, s.dataset.loading = "loading", y.hidden = false, y.textContent = "Preparing preview\u2026", d.textContent = "Preparing preview\u2026", D(3e4, "The preview is taking too long. Try again or download the original.");
    try {
      let [H, se] = await Promise.all([Yo(r), xo(e, { signal: R.signal, onText: ($o) => {
        q === w && F($o);
      } })]);
      if (!_() || q !== w) return;
      P = se, l = document.createElement("iframe"), l.className = "office-frame", l.title = `Preview of ${t.title || t.originalName}`, l.setAttribute("sandbox", "allow-scripts"), l.setAttribute("referrerpolicy", "no-referrer"), l.style.opacity = "0", l.srcdoc = H, h.append(l), D(1e4, "The page viewer could not start. Try again or use text view.");
    } catch (H) {
      _() && q === w && H.name !== "AbortError" && S(H.message);
    }
  }
  return b.addEventListener("pointerdown", () => {
    N = true;
  }), b.addEventListener("wheel", () => {
    N = true;
  }, { passive: true }), f.onclick = () => {
    N = true, x(true), O || b.replaceChildren(ee("p", "Preparing text\u2026"));
  }, m.onclick = () => {
    N = false, x(false);
  }, g.onclick = () => {
    Ge.delete(r), Ke();
  }, Ke(), () => {
    C = true, w++, R?.abort(), k(), window.removeEventListener("message", B), l?.remove(), P = null, s.remove();
  };
}
var K = (e, t, i) => {
  let o = document.createElement(e);
  return t !== void 0 && (o.textContent = t), i && (o.className = i), o;
};
function Jo(e) {
  let t = K("div", void 0, "table-preview-scroll"), i = K("table");
  for (let o of e) {
    let n = K("tr");
    for (let r of o) n.append(K("td", String(r)));
    i.append(n);
  }
  return t.append(i), t;
}
async function Qt(e, t, i) {
  let o = K("div", void 0, "table-pages"), n = K("button", "\u2190 Rows"), r = K("button", "Rows \u2192"), s = K("button", "\u2190 Columns"), p = K("button", "Columns \u2192"), d = K("span"), m = K("div"), f = 0, g = 0, h = 0;
  for (let y of [n, r, s, p]) y.type = "button";
  o.append(n, r, d, s, p), e.append(o, m);
  async function b() {
    let y = ++h;
    for (let I of [n, r, s, p]) I.disabled = true;
    try {
      let I = await t({ startRow: f, startColumn: g, maxRows: 200, maxCols: 30 });
      if (y !== h || !i()) return;
      m.replaceChildren(Jo(I.rows)), d.textContent = `Rows ${f + 1}\u2013${f + I.rows.length} \xB7 Columns ${g + 1}\u2013${g + 30}`, n.hidden = f === 0, s.hidden = g === 0, r.hidden = !I.hasMoreRows, p.hidden = !I.moreColumns;
    } catch (I) {
      m.replaceChildren(K("p", I.message));
    } finally {
      for (let I of [n, r, s, p]) I.disabled = false;
    }
  }
  return n.onclick = () => {
    f = Math.max(0, f - 200), b();
  }, r.onclick = () => {
    f += 200, b();
  }, s.onclick = () => {
    g = Math.max(0, g - 30), b();
  }, p.onclick = () => {
    g += 30, b();
  }, await b(), { reset: async () => {
    f = g = 0, await b();
  } };
}
async function Vt(e, t, i, o = () => true) {
  let n = Re(t), r = K("div", void 0, "rich-preview"), s = K("p", void 0, "preview-note"), p = () => {
  };
  try {
    if (n === "pdf") {
      let d = URL.createObjectURL(new Blob([e], { type: "application/pdf" })), m = K("iframe");
      m.className = "office-frame", m.title = "PDF attachment preview", m.src = d, r.append(m), p = () => {
        m.remove(), URL.revokeObjectURL(d);
      };
    } else if (["audio", "video"].includes(n)) {
      let d = K(n), m = URL.createObjectURL(new Blob([e], { type: Ue(t) }));
      d.controls = true, d.preload = "metadata", d.src = m, d.setAttribute("playsinline", ""), d.addEventListener("error", () => {
        s.textContent = "This browser cannot play this format or codec. Download the original to open it in its usual app.";
      }), r.append(d, s), p = () => {
        d.pause(), d.removeAttribute("src"), d.load(), URL.revokeObjectURL(m);
      };
    } else {
      if (/\.(docx|docm|pptx|pptm)$/i.test(t.originalName)) return s.textContent = "", r.append(s), o() && i.append(r), p = await yo(e, t, r, o), { handled: true, cleanup: p };
      if (/\.(xlsx|xlsm)$/i.test(t.originalName)) {
        let d = await qi(e), m = K("select"), f = K("div");
        m.setAttribute("aria-label", "Worksheet");
        for (let b = 0; b < d.sheets.length; b++) {
          let y = K("option", d.sheets[b].name);
          y.value = String(b), m.append(y);
        }
        let g = 0;
        r.append(m, s), s.textContent = "Spreadsheet values preview \xB7 browse rows and columns. Formulas use saved cached values.";
        let h = await Qt(r, (b) => d.readSheet(Number(m.value), b), o);
        m.onchange = () => h.reset();
      } else if (/\.(csv|tsv)$/i.test(t.originalName)) {
        let d = await e.slice(0, 16777216).text(), m = /\.tsv$/i.test(t.originalName) ? "	" : ",";
        r.append(K("p", "Table preview \xB7 browse rows and columns." + (e.size > 16 * 1024 ** 2 ? " Showing the first 16 MiB; the full original is stored." : ""), "preview-note")), await Qt(r, (f) => Fi(d, m, f.maxRows, f.maxCols, f), o);
      } else if (n === "text" || /\.dxf$/i.test(t.originalName)) {
        let d = Math.min(e.size, 2097152), m = K("pre"), f = K("button", "Load more text");
        f.type = "button";
        let g = async () => {
          m.textContent = await e.slice(0, d).text(), s.textContent = /\.dxf$/i.test(t.originalName) ? "DXF source text \xB7 open in CAD for the drawing." : `Text preview \xB7 ${d.toLocaleString()} / ${e.size.toLocaleString()} bytes`, f.hidden = d >= e.size || d >= 16 * 1024 ** 2;
        };
        f.onclick = async () => {
          d = Math.min(e.size, d + 2 * 1024 ** 2), await g();
        }, r.append(s, m, f), await g();
      } else if (/\.zip$/i.test(t.originalName)) {
        let d = await ut.open(e), m = [...d.entries.entries()];
        r.append(K("p", `ZIP contents \xB7 ${m.length} entries. Originals remain inside the archive.`, "preview-note")), await Qt(r, ({ startRow: f, maxRows: g }) => ({ rows: m.slice(f, f + g).map(([h, b]) => [h, `${b.size.toLocaleString()} bytes`]), hasMoreRows: f + g < m.length, moreColumns: false }), o);
      } else return { handled: false, cleanup: p };
    }
    return o() ? i.append(r) : p(), { handled: true, cleanup: p };
  } catch (d) {
    return o() && i.append(K("p", `${d.message} The original remains available through Download original.`, "preview-fallback")), p(), { handled: true, cleanup: () => {
    } };
  }
}
var Ye = "keepit-device-backup-5", Zo = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i, Xo = /^[a-f0-9]{64}$/, vo = 1e5, Wt = (e) => (A(e && Object.keys(e).sort().join(",") === "digest,id,version" && Zo.test(e.id) && Number.isSafeInteger(e.version) && e.version > 0 && Xo.test(e.digest), "Invalid native-note history backup descriptor."), e), en = (e) => ({ id: e.id, version: e.version, digest: e.digest });
function Gt(e) {
  let t = Wt(e);
  return `NoteHistory/${t.id}/${t.version}-${t.digest}.keepitnote`;
}
function Yt(e) {
  let t = Wt(e);
  return `_Catalog/note-history/${t.id}/${t.version}-${t.digest}.json`;
}
function ko(e) {
  if (e.noteHistory === void 0) return null;
  A(Array.isArray(e.noteHistory) && e.noteHistory.length <= vo, "Invalid note revision archive. No backup was created.");
  let t = new Map(e.items.map((r) => [r.id, Ae(r)])), i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), n = [];
  for (let r of e.noteHistory) {
    let s = Ae(r?.item), p = t.get(s.id), d = en(s), m = `note-history:${s.id}:${s.digest}`;
    A(p && ue(p) && ue(s) && s.version < p.version && s.digest !== p.digest && r.key === m && r.blob instanceof Blob && r.blob.size === s.bytes, "Saved note history contains an invalid or unrelated original. No backup was created.");
    let f = s.id + ":" + s.version, g = s.id + ":" + s.digest;
    A(!i.has(f) && !o.has(g), "Duplicate native-note revision in source library. No backup was created."), i.add(f), o.add(g), n.push({ item: s, blob: r.blob, descriptor: d });
  }
  return n.sort((r, s) => r.item.id.localeCompare(s.item.id) || r.item.version - s.item.version);
}
async function Io(e, t, i) {
  A(t.format === Ye && Array.isArray(t.noteHistory) && t.noteHistory.length <= vo, "Malformed native-note revision manifest. Nothing was restored.");
  let o = new Map(i.map((p) => [p.item.id, p.item])), n = [], r = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
  for (let p of t.noteHistory) {
    let d = Wt(p), m = o.get(d.id);
    A(m && ue(m) && d.version < m.version && d.digest !== m.digest, "Native-note revision is missing its matching current note.");
    let f = d.id + ":" + d.version, g = d.id + ":" + d.digest;
    A(!r.has(f) && !s.has(g), "Duplicate native-note version or checksum in backup."), r.add(f), s.add(g);
    let h = e.get(Yt(d)), b = e.get(Gt(d));
    A(h?.size > 0 && h.size <= 64 * 1024 ** 2 && b instanceof Blob, "Native-note revision file or metadata is missing. Nothing was restored.");
    let y = Ae(JSON.parse(await h.text()));
    A(y.id === d.id && y.version === d.version && y.digest === d.digest && ue(y) && b.size === y.bytes, "Native-note revision metadata does not match the archive manifest.");
    let I = b.slice(0, b.size, y.mime);
    A(await de(I) === y.digest, "Native-note revision checksum mismatch. Nothing was restored.");
    let C = await _e(I);
    A(C.noteId === y.id, "Native-note revision identity mismatch."), n.push({ item: y, blob: I });
  }
  return n;
}
var tn = new TextEncoder(), Eo = new TextDecoder("utf-8", { fatal: true }), Y = 4294967295, vt = 65535, qe = (e) => {
  let t = new Uint8Array(e);
  return { bytes: t, view: new DataView(t.buffer) };
}, ie = (e, t, i) => e.setBigUint64(t, BigInt(i), true), ge = (e, t) => {
  let i = e.getBigUint64(t, true);
  return A(i <= BigInt(Number.MAX_SAFE_INTEGER), "ZIP64 value is outside the browser\u2019s safe file range."), Number(i);
};
function To(e) {
  let t = /\.([a-z0-9]{1,10})$/i.exec(e.originalName)?.[1].toLowerCase() || "bin";
  return `Files/${e.kind.toUpperCase()}-${e.id}.${t}`;
}
function on(e, t) {
  let i = t || [], o = e.items.map((r) => [`_Catalog/records/${r.id}.json`, new Blob([JSON.stringify(r, null, 2)])]);
  for (let r of i) o.push([Yt(r.descriptor), new Blob([JSON.stringify(r.item, null, 2)])]);
  let n = { format: t !== null ? Ye : e.info.printTemplates?.length ? "keepit-device-backup-4" : e.items.some((r) => r.archivedAt || r.duplicateOf) ? "keepit-device-backup-3" : Nt, libraryId: e.info.libraryId, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), revision: e.info.revision, records: e.items.map((r) => r.id), scope: "Portable library backup", ...t !== null ? { noteHistory: i.map((r) => r.descriptor) } : {}, ...e.info.printTemplates ? { printTemplates: St(e.info.printTemplates) } : {}, ...e.info.metadataSchema ? { metadataSchema: Ot(e.info.metadataSchema) } : {}, ...e.info.platformAssociationsV1 ? { platformAssociationsV1: At(e.info.platformAssociationsV1) } : {} };
  return o.push(["_Catalog/manifest.json", new Blob([JSON.stringify(n, null, 2)])]), o;
}
async function Jt(e, t, { signal: i, onProgress: o = () => {
}, forceZip64: n = false } = {}) {
  let r = new Map(e.originals?.map((l) => [l.id, l.blob]) || []), s = ko(e), p = [], d = 0, m = 0, f = e.items.reduce((l, c) => l + c.bytes, 0) + (s || []).reduce((l, c) => l + c.item.bytes, 0), g = async (l) => {
    if (i?.aborted) throw new DOMException("Cancelled", "AbortError");
    await t.write(l), d += l.size ?? l.byteLength, A(Number.isSafeInteger(d), "Archive exceeds the browser\u2019s safe file range.");
  }, h = [];
  for (let l of e.items) Ae(l), h.push({ name: To(l), item: l });
  for (let l of s || []) h.push({ name: Gt(l.descriptor), item: l.item, blob: l.blob });
  for (let [l, c] of on(e, s)) h.push({ name: l, blob: c });
  for (let l of h) {
    let c = l.blob || r.get(l.item.id) || await e.getOriginal?.(l.item.id);
    A(c instanceof Blob && (!l.item || c.size === l.item.bytes), "An original failed verification. Backup was not created.");
    let w = tn.encode(l.name), v = n || c.size >= Y, N = n || d >= Y, O = v ? 20 : 0, P = qe(30 + w.length + O), z = P.view, R = d;
    if (z.setUint32(0, 67324752, true), z.setUint16(4, v ? 45 : 20, true), z.setUint16(6, 2056, true), z.setUint32(18, v ? Y : c.size, true), z.setUint32(22, v ? Y : c.size, true), z.setUint16(26, w.length, true), z.setUint16(28, O, true), P.bytes.set(w, 30), v) {
      let B = 30 + w.length;
      z.setUint16(B, 1, true), z.setUint16(B + 2, 16, true), ie(z, B + 4, c.size), ie(z, B + 12, c.size);
    }
    await g(P.bytes);
    let _ = await Ft(c, { write: g }, { digest: l.item?.digest, signal: i, onProgress: (B) => {
      l.item && o({ name: l.item.originalName, done: m + B, total: f });
    } }), k = qe(v ? 24 : 16), x = k.view;
    x.setUint32(0, 134695760, true), x.setUint32(4, _, true), v ? (ie(x, 8, c.size), ie(x, 16, c.size)) : (x.setUint32(8, c.size, true), x.setUint32(12, c.size, true)), await g(k.bytes);
    let S = v || N ? 4 + (v ? 16 : 0) + (N ? 8 : 0) : 0, D = qe(46 + w.length + S), F = D.view;
    if (F.setUint32(0, 33639248, true), F.setUint16(4, 45, true), F.setUint16(6, v || N ? 45 : 20, true), F.setUint16(8, 2056, true), F.setUint32(16, _, true), F.setUint32(20, v ? Y : c.size, true), F.setUint32(24, v ? Y : c.size, true), F.setUint16(28, w.length, true), F.setUint16(30, S, true), F.setUint32(42, N ? Y : R, true), D.bytes.set(w, 46), S) {
      let B = 46 + w.length;
      F.setUint16(B, 1, true), F.setUint16(B + 2, S - 4, true), B += 4, v && (ie(F, B, c.size), ie(F, B + 8, c.size), B += 16), N && ie(F, B, R);
    }
    p.push(D.bytes), l.item && (m += c.size);
  }
  let b = d;
  for (let l of p) await g(l);
  let y = d - b, I = n || h.length >= vt || b >= Y || y >= Y;
  if (I) {
    let l = d, c = qe(56), w = c.view;
    w.setUint32(0, 101075792, true), ie(w, 4, 44), w.setUint16(12, 45, true), w.setUint16(14, 45, true), ie(w, 24, h.length), ie(w, 32, h.length), ie(w, 40, y), ie(w, 48, b), await g(c.bytes);
    let v = qe(20);
    v.view.setUint32(0, 117853008, true), ie(v.view, 8, l), v.view.setUint32(16, 1, true), await g(v.bytes);
  }
  let C = qe(22);
  return C.view.setUint32(0, 101010256, true), C.view.setUint16(8, I ? vt : h.length, true), C.view.setUint16(10, I ? vt : h.length, true), C.view.setUint32(12, I ? Y : y, true), C.view.setUint32(16, I ? Y : b, true), await g(C.bytes), o({ done: m, total: f }), { bytes: d, files: e.items.length };
}
async function So(e, t) {
  let i = [];
  return await Jt(e, { write: async (o) => {
    i.push(o);
  } }, t), new Blob(i, { type: "application/zip" });
}
var fe = async (e, t, i) => (A(Number.isSafeInteger(t) && Number.isSafeInteger(i) && t >= 0 && i >= 0 && t + i <= e.size, "Damaged backup ZIP bounds."), new Uint8Array(await e.slice(t, t + i).arrayBuffer())), Le = (e) => new DataView(e.buffer, e.byteOffset, e.byteLength);
function Co(e, t) {
  let i = Le(e), o = 0;
  for (; o + 4 <= e.length; ) {
    let n = i.getUint16(o, true), r = i.getUint16(o + 2, true);
    if (A(o + 4 + r <= e.length, "Invalid ZIP extra data."), n === 1) {
      let s = o + 4;
      for (let p of ["size", "compressed", "local"]) t[p] === Y && (A(s + 8 <= o + 4 + r, "Missing ZIP64 entry size."), t[p] = ge(i, s), s += 8);
      return t;
    }
    o += 4 + r;
  }
  return A(!Object.values(t).includes(Y), "Missing ZIP64 extra data."), t;
}
async function Ao(e, { onProgress: t = () => {
}, signal: i } = {}) {
  A(e instanceof Blob && Number.isSafeInteger(e.size) && e.size >= 22, "Choose an unchanged ZIP exported by KeepIt.");
  let o = await fe(e, e.size - 22, 22), n = Le(o);
  A(n.getUint32(0, true) === 101010256 && n.getUint16(4, true) === 0 && n.getUint16(6, true) === 0, "Choose an unchanged ZIP exported by KeepIt.");
  let r = n.getUint16(10, true), s = n.getUint32(16, true), p = n.getUint32(12, true), d = e.size - 22;
  if (r === vt || s === Y || p === Y) {
    let C = Le(await fe(e, e.size - 42, 20));
    A(C.getUint32(0, true) === 117853008 && C.getUint32(4, true) === 0 && C.getUint32(16, true) === 1, "Unsupported split ZIP64 archive.");
    let l = ge(C, 8), c = Le(await fe(e, l, 56));
    A(c.getUint32(0, true) === 101075792 && ge(c, 4) === 44 && c.getUint32(16, true) === 0 && c.getUint32(20, true) === 0 && l + 56 === e.size - 42, "Invalid ZIP64 directory."), r = ge(c, 32), A(r === ge(c, 24), "Inconsistent ZIP64 entry count."), s = ge(c, 48), p = ge(c, 40), d = l;
  } else A(r === n.getUint16(8, true), "Inconsistent ZIP entry count.");
  A(r > 0 && Number.isSafeInteger(r) && s + p === d && r * 46 <= p, "Invalid backup ZIP directory.");
  let m = /* @__PURE__ */ new Map(), f = s, g = 0;
  for (let C = 0; C < r; C++) {
    let l = Le(await fe(e, f, 46));
    A(l.getUint32(0, true) === 33639248, "Damaged backup ZIP directory.");
    let c = l.getUint16(8, true), w = l.getUint16(28, true), v = l.getUint16(30, true), N = l.getUint16(32, true), O = 46 + w + v + N;
    A([2048, 2056].includes(c) && l.getUint16(10, true) === 0 && l.getUint16(34, true) === 0 && f + O <= d, "Unsupported or damaged backup entry.");
    let P = await fe(e, f + 46, w), z = Eo.decode(P), R = await fe(e, f + 46 + w, v), _ = Co(R, { size: l.getUint32(24, true), compressed: l.getUint32(20, true), local: l.getUint32(42, true) }), { size: k, local: x } = _;
    A(_.compressed === k && x === g && x + 30 <= s, "Unsupported or damaged backup entry."), A(!m.has(z) && /^(?:Files\/[A-Z]+-[a-f0-9-]{36}\.[a-z0-9]{1,10}|_Catalog\/records\/[a-f0-9-]{36}\.json|_Catalog\/manifest\.json|NoteHistory\/[a-f0-9-]{36}\/[1-9][0-9]*-[a-f0-9]{64}\.keepitnote|_Catalog\/note-history\/[a-f0-9-]{36}\/[1-9][0-9]*-[a-f0-9]{64}\.json)$/.test(z), "Unexpected or duplicate backup path.");
    let S = Le(await fe(e, x, 30)), D = S.getUint16(28, true);
    A(S.getUint32(0, true) === 67324752 && S.getUint16(6, true) === c && S.getUint16(8, true) === 0 && S.getUint16(26, true) === w && Eo.decode(await fe(e, x + 30, w)) === z, "Damaged backup local header.");
    let F = Co(await fe(e, x + 30 + w, D), { size: S.getUint32(22, true), compressed: S.getUint32(18, true) });
    A(F.size === k && F.compressed === k, "Backup entry size mismatch.");
    let B = x + 30 + w + D;
    A(B + k <= s, "Truncated backup original.");
    let Ke = e.slice(B, B + k), q = l.getUint32(16, true);
    if (A(await Ft(Ke, null, { signal: i, onProgress: (H) => t({ name: z, done: H, total: k }) }) === q, "Backup checksum failed. Nothing was restored."), g = B + k, c & 8) {
      let H = S.getUint32(22, true) === Y, se = Le(await fe(e, g, H ? 24 : 16));
      A(se.getUint32(0, true) === 134695760 && se.getUint32(4, true) === q && (H ? ge(se, 8) : se.getUint32(8, true)) === k && (H ? ge(se, 16) : se.getUint32(12, true)) === k, "Backup descriptor checksum or size failed."), g += H ? 24 : 16;
    } else A(S.getUint32(14, true) === q, "Backup local checksum failed.");
    m.set(z, Ke), f += O;
  }
  A(f === d && g === s, "Unexpected backup ZIP data.");
  let h = m.get("_Catalog/manifest.json");
  A(h && h.size <= 64 * 1024 ** 2, "Backup manifest is missing or exceeds the metadata processing budget.");
  let b = JSON.parse(await h.text()), y = b.format === Ye;
  A([Nt, "mylibrary-device-backup-1", "keepit-device-backup-3", "keepit-device-backup-4", Ye].includes(b.format) && Array.isArray(b.records) && new Set(b.records).size === b.records.length && (y ? Array.isArray(b.noteHistory) : b.noteHistory === void 0) && m.size === b.records.length * 2 + 1 + (y ? b.noteHistory.length * 2 : 0), "Unsupported or inconsistent KeepIt backup.");
  let I = [];
  for (let C of b.records) {
    A(typeof C == "string" && /^[a-f0-9-]{36}$/.test(C), "Invalid manifest record identity.");
    let l = m.get(`_Catalog/records/${C}.json`);
    A(l && l.size <= 64 * 1024 ** 2, "Backup record is missing or exceeds the metadata processing budget.");
    let c = Ae(JSON.parse(await l.text()));
    A(c.id === C, "Backup record identity does not match.");
    let w = m.get(To(c));
    A(w?.size === c.bytes, "Backup original is missing or has the wrong size."), I.push({ item: c, blob: w.slice(0, w.size, c.mime) });
  }
  return b.printTemplates && (I.printTemplates = St(b.printTemplates)), b.metadataSchema && (I.metadataSchema = Ot(b.metadataSchema)), b.platformAssociationsV1 && (I.platformAssociationsV1 = At(b.platformAssociationsV1), I.associationSourceLibraryId = b.libraryId), y && (I.noteHistory = await Io(m, b, I)), I;
}
var a = (e) => document.getElementById(e), nn = /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1, $e = false, Be = false, he = typeof window.showDirectoryPicker == "function" && !!navigator.locks?.request, rn = new Ri(), u = Be ? null : new zi("keepit-owner-device-v1"), le = null, J = null, ye = false, tt = false, me = false, re = false, Ro = false, be = new wt({ name: "keepit-owner-upload-queue-v1", onChange: ci }), te = false, Z = null, an = $e ? xi([...Oi, "neutral-demo"].map((e) => ({ appId: e, contractMajor: 1, capabilities: ["notes.native"] }))) : null, V = new Di({ registry: an, name: "keepit-owner-note-workspace-v1", onChange: async () => {
  te && (await M({ reload: false }), !V.running && u && (await V.jobs(await G())).some((e) => e.state === "queued") && setTimeout(() => {
    Ee();
  }, 0));
} });
async function ce() {
  if (!te) throw new Error("Notes storage is not available yet.");
  if (!Z) {
    let { NoteUI: e } = await import("./keepit-note-link-256bd3efc430.js");
    Z = new e({ workspace: V, getLibrary: () => u, getTarget: G, getSchema: () => ae, getRecords: () => oe, attachmentHooks: It, onChange: () => M({ reload: false }), canWrite: () => !$ && !ye && !J?.startTask && !u?.pending && !u?.readOnly });
  }
  return Z;
}
var Q = null, Je = Zi(location.search, { enabled: true }), zo = false;
Xi();
function ii() {
  if (!(!Je || zo)) {
    if (zo = true, document.title = Je.name + " \xB7 KeepIt connected", Je.id === "liveit") {
      Q = Qi({ canSync: () => !$ && !re && !Te() && !V.running, workspace: V, getLibrary: () => te && !ye && !J?.startTask && u && !u.readOnly ? u : null, getTarget: G, getNoteUI: ce, openItem: ot, onClose: () => {
        Q = null;
      } });
      return;
    }
    if (Je.id === "travelit") {
      Q = Vi({ workspace: V, getLibrary: () => te && !ye && !J?.startTask && u && !u.readOnly ? u : null, getTarget: G, getNoteUI: ce, openItem: ot, onClose: () => {
        Q = null;
      } });
      return;
    }
    if (oi.click(), Q) {
      Q.root.dataset.connectedApp = Je.id;
      let e = Q.root.querySelector("strong");
      e && (e.textContent = "ThinkIt \xB7 Connected to KeepIt");
    }
  }
}
if ($e) {
  let e = document.createElement("button");
  e.type = "button", e.id = "keepit-platform-neutral-qa", e.textContent = "Shared platform demo (QA)", e.className = "secondary", e.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:90", e.onclick = async () => {
    e.disabled = true;
    try {
      if (!te || !u || u.isCloud) throw Error("Open a disposable local KeepIt library before testing integrations.");
      let { mountNeutralConsumerQa: t } = await import("./chunk-66CWR3WK.js");
      await t({ getLibrary: () => u, getTarget: G, getNoteUI: ce, workspace: V, onOpenRecord: async (i) => {
        await ot(i.reference.itemId);
      } });
    } catch (t) {
      E(t.message, true);
    } finally {
      e.disabled = false;
    }
  }, document.body.append(e);
}
var oi = document.getElementById("thinkit-launch");
oi && oi.addEventListener("click", () => {
  if (Q) {
    Q.dispose(), Q = null;
    return;
  }
  Q = Ji({ getLibrary: () => u, getTarget: G, getNoteUI: ce, onClose: () => {
    Q = null;
  }, onOpenFile: async (e) => {
    if (Z?.mode === "edit") throw Error("Close the current KeepIt note editor before opening a referenced file. Your draft is retained.");
    Q?.dispose(), await ot(e);
  }, onVerifyRestore: $e ? async () => {
    let e = u, t = Q, i = await G(), { verifyCurrentThinkItQa: o } = await import("./chunk-2N2DVVIV.js"), { exportThinkItProject: n } = await import("./chunk-GQL3VFES.js"), { verifyQaBackupRestore: r } = await import("./chunk-7UTHIQYN.js"), { discardQaRestoreResources: s } = await import("./chunk-ISDJ67GM.js");
    return o({ enabled: true, getProject: () => t.getProject(), sourceLibrary: e, sourceWorkspace: V, sourceTarget: i, isCurrent: () => e === u && t === Q, exportProject: n, verifyBackup: r, cleanup: s });
  } : void 0, onVerifyDownloadedProject: $e ? async (e) => {
    let { verifyDownloadedThinkItQa: t } = await import("./chunk-NDINO6SV.js"), { readThinkItProjectBackup: i } = await import("./chunk-GQL3VFES.js"), { hashBlob: o } = await import("./chunk-HY3XRHL2.js"), { verifyQaBackupRestore: n } = await import("./chunk-7UTHIQYN.js"), { discardQaRestoreResources: r } = await import("./chunk-ISDJ67GM.js");
    return t({ enabled: true, file: e, sourceLibrary: u, readBackup: i, hashFile: o, verifyBackup: n, cleanup: r });
  } : void 0 });
});
async function Ee() {
  if (!(!te || ye || J?.startTask || u?.pending || !u || u.readOnly || $ || V.running)) try {
    let e = u, t = await G();
    await V.drain(t, e, { isCurrent: () => u === e && !$ }), (await V.db.thinkitLinks.where("target").equals(t).count() || (await V.drafts(t)).some(d=>d.connectedAuto)) && await (await ce()).resumeThinkItDrafts(), Z?.pending && Z.mode === "preview" && await Z.open(Z.pending.itemId);
  } catch (e) {
    E(j(e), true);
  }
}
var oe = [], X = "all", T = null, $ = false, ne = null, Ne = 0, Ze = new yt(), Oo = new bt(), Lo = null, De = null, ni = null, it = null, Xe = 0, It = { thumbnail: async (e) => {
  let t = await It.original(e);
  return t ? qt(t) : null;
}, original: async (e) => {
  let t = (await u.list()).find((i) => i.digest === e.digest);
  return t ? u.original(t.id) : null;
}, open: async (e) => {
  try {
    let t = (await u.list()).find((s) => s.digest === e.digest);
    if (!t) throw new Error("This linked file is missing. Restore it from backup.");
    it?.();
    let i = ++Xe, o = a("attachment-preview");
    o.replaceChildren(), a("attachment-heading").textContent = t.title, a("attachment-dialog").showModal();
    let n = await u.original(t.id);
    if (i !== Xe) return;
    if (await Lt(n, t) === "image") {
      let s = U("img"), p = URL.createObjectURL(new Blob([n], { type: Ue(t) }));
      s.alt = t.title, s.src = p, o.append(s), it = () => URL.revokeObjectURL(p);
    } else {
      let s = await Vt(n, t, o, () => i === Xe);
      if (i !== Xe) {
        s.cleanup();
        return;
      }
      it = s.cleanup, s.handled || o.append(U("p", "Download the original to open this format in its usual app.", "preview-fallback"));
    }
    a("attachment-download").onclick = () => at(n, t.originalName);
  } catch (t) {
    E(t.message, true, T ? "detail-message" : "message");
  }
}, upload: async (e, t) => {
  if ($) throw new Error("Wait for the current operation to finish.");
  let i = [], o = [], n;
  if (await W(async () => {
    try {
      for (let r of e) try {
        if (t.type === "photos" && Re({ name: r.name, type: r.type }) !== "image") throw new Error("Choose an image for a Photos field.");
        let s = await u.importFile(r, { attachmentOnly: true });
        i.push({ digest: s.item.digest, name: s.item.originalName, mime: s.item.mime });
      } catch (s) {
        o.push(r.name + ": " + s.message);
      }
      await M(), o.length && E(o.join(" "), true, T ? "detail-message" : "message"), i.length || (n = new Error(o.join(" ") || "No files were saved."));
    } catch (r) {
      throw n = r, r;
    }
  }), n) throw n;
  return i;
} };
a("attachment-close").onclick = () => a("attachment-dialog").close();
a("attachment-dialog").addEventListener("close", () => {
  Xe++, it?.(), it = null, a("attachment-preview").replaceChildren();
});
var we = null, ri = [], ae = Ci(), je = null, Me = null, Et = null;
function li(e = je?.read() || []) {
  je?.dispose(), je = jt(a("item-custom-fields"), ae, a("item-collection").value, e, It);
}
function Uo(e = Me?.read() || []) {
  Me?.dispose(), Me = jt(a("capture-custom-fields"), ae, a("capture-category").value, e, It), ae.fields.some((t) => !t.archived && t.required && (!t.category || t.category === a("capture-category").value)) && (a("capture-extra").open = true);
}
var kt = null, Ce = null, ai = null, pe = (e) => e >= 1024 ** 4 ? `${(e / 1024 ** 4).toFixed(1)} TiB` : e >= 1024 ** 3 ? `${(e / 1024 ** 3).toFixed(1)} GiB` : e >= 1024 ** 2 ? `${(e / 1024 ** 2).toFixed(1)} MiB` : `${Math.round(e / 1024)} KiB`, U = (e, t, i) => {
  let o = document.createElement(e);
  return t !== void 0 && (o.textContent = t), i && (o.className = i), o;
}, Zt;
function E(e, t = false, i = "message") {
  let o = a(i);
  if (o.textContent = e, o.className = `message${t ? " error" : ""}`, o.hidden = false, i === "message" && (clearTimeout(Zt), !t)) {
    let n = () => {
      if ($) {
        Zt = setTimeout(n, 2e3);
        return;
      }
      o.hidden = true;
    };
    Zt = setTimeout(n, 6500);
  }
}
function j(e) {
  return e.name === "AbortError" ? "Operation cancelled. Existing library files were retained." : Be && ["NotAllowedError", "SecurityError"].includes(e.name) ? "Folder permission is unavailable. Reconnect the folder or choose another one. Files are not saved into browser storage as a fallback." : /quota/i.test(`${e.name} ${e.message}`) ? "Device storage is full. Existing items were retained. Export a backup before making space." : e.name === "OpenFailedError" || e.name === "SecurityError" ? "Browser storage is unavailable. Open in a normal browser tab and allow site storage." : e.message || "The operation stopped. Your existing library is retained.";
}
function sn(e) {
  for (let t of ["add-files", "add-upload", "write-note", "note-drafts", "take-photo", "empty-add", "capture-close"]) a(t).disabled = !e;
  a("capture-form").querySelectorAll("button").forEach((t) => t.disabled = !e);
}
async function ci() {
  if (!me) return;
  let e = await be.list(), t = e.filter((i) => i.state !== "saved");
  Ro = t.length > 0, a("upload-queue").hidden = !e.length, a("upload-summary").textContent = t.length ? t.length + " upload" + (t.length === 1 ? "" : "s") + " remaining \xB7 " + e.filter((i) => i.state === "saved").length + " saved" : "Uploads complete", a("upload-jobs").replaceChildren();
  for (let i of e) {
    let o = U("div", void 0, "upload-job"), n = i.state === "saved" ? i.duplicate ? "Already in library" : "Saved" : i.state === "saving" ? "Saving\u2026" : i.state === "queued" ? "Saved on device \xB7 Waiting to upload" : i.retryAt ? "Waiting for connection \xB7 Will retry" : "Needs attention";
    if (o.append(U("span", i.name + " \xB7 " + n)), i.error && o.append(U("p", i.error, "fineprint")), ["failed", "review"].includes(i.state) && !["STAGING_INTEGRITY_FAILED", "SAVE_INTEGRITY_FAILED"].includes(i.errorCode)) if (lo(i.errorCode) === "inspect") {
      let r = U("button", "Inspect OneDrive copy \xB7 read-only", "secondary");
      r.type = "button", r.onclick = async () => {
        r.disabled = true, r.textContent = "Checking OneDrive metadata\u2026";
        let s;
        try {
          s = await co({ library: u, job: i, requireQaRepository: Rt });
        } catch (d) {
          s = { status: "not-available", summary: "Inspection unavailable: " + j(d) + ". The queued file was not changed." };
        }
        let p = o.querySelector(".qa-original-inspection");
        if (p || (p = U("p", void 0, "fineprint qa-original-inspection"), p.setAttribute("role", "status"), o.append(p)), p.textContent = "Read-only QA inspection: " + s.summary, o.querySelector(".qa-zero-byte-salvage")?.remove(), s.status === "metadata-mismatch" && s.observedBytes === 0 && s.count === 1 && u?.isCloud && !u.readOnly && i.blob?.size === s.expectedBytes && i.errorCode === "ORIGINAL_UNVERIFIED") {
          let d = U("button", "Recover using fresh filename \xB7 retain 0-byte item", "secondary qa-zero-byte-salvage");
          d.type = "button", d.onclick = async () => {
            d.disabled = true;
            try {
              if (!u?.isCloud || u.readOnly) throw Error("Reconnect the QA library before recovering.");
              if (Rt(u.fs, u.root.item, { enabled: true }), await G() !== i.target) throw Error("The selected QA library changed. No recovery attempted.");
              if (!window.confirm("KeepIt will upload the retained PDF under a NEW managed filename. The existing 0-byte OneDrive item will not be modified or deleted. This transfers the large file again. Proceed?")) return;
              await be.retargetZeroByte(i.id, { target: i.target, shortCode: i.options?.uploadIdentity?.shortCode, expectedBytes: i.blob.size }), E("Fresh-filename recovery queued; 0-byte item preserved for review."), xe();
            } catch (m) {
              E("Safe recovery refused: " + j(m), true);
            } finally {
              d.disabled = false;
            }
          }, o.append(d);
        }
        r.disabled = false, r.textContent = "Inspect OneDrive copy \xB7 read-only";
      }, o.append(r);
    } else {
      let r = U("button", "Retry", "secondary");
      r.type = "button", r.onclick = () => be.retry(i.id).then(xe).catch((s) => E(j(s), true)), o.append(r);
    }
    if (i.state !== "saved" && i.blob instanceof Blob) {
      let r = U("button", "Prepare recovery copy", "secondary");
      r.type = "button", r.onclick = async () => {
        r.disabled = true, r.textContent = "Verifying queued bytes\u2026";
        try {
          let s = await be.exportable(i.id);
          r.textContent = "Download verified copy", r.disabled = false, r.onclick = () => {
            at(s, s.name), E("Download requested. Confirm the copy exists in Files before removing the queued original.");
          }, E("Queue bytes verified. Tap Download verified copy to save a separate copy.");
        } catch (s) {
          r.textContent = "Recovery copy unavailable", E("Cannot verify the queued bytes: " + j(s), true);
        }
      }, o.append(r);
    }
    if (i.state !== "saving") {
      let r = U("button", i.state === "saved" ? "Dismiss" : "Remove queued copy", "link-button");
      r.type = "button", r.onclick = () => {
        i.state !== "saved" && !confirm("This copy has NOT been verified in your KeepIt library. Remove the only queued copy from this device? Keep your original file somewhere safe before continuing.") || be.cancel(i.id).catch((s) => E(j(s), true));
      }, o.append(r);
    }
    a("upload-jobs").append(o);
  }
}
async function G() {
  if (!u) throw new Error("Choose a library first.");
  let e = await u.info();
  return u.isCloud ? JSON.stringify(["cloud", u.fs.homeId, u.fs.driveId, u.root.item.id, e.libraryId]) : JSON.stringify([u.isFolder ? "folder" : "device", e.libraryId]);
}
async function xe() {
  if (!me || ye || J?.startTask || $ || re || !u || u.readOnly) return;
  re = true;
  let e = u;
  try {
    let t = await G();
    await be.drain(t, async (i) => {
      if (u !== e) throw new Error("Reconnect the library selected for this upload.");
      if (i.rootHandle && (!e.root.isSameEntry || !await e.root.isSameEntry(i.rootHandle))) throw new Error("Choose the original folder for this queued upload.");
      let o;
      return await W(async () => {
        E("Saving " + i.name), o = await po({ library: e, job: i, hashBlob: de, checkActive: () => u === e }), await M({ reload: false }).catch((n) => E("Original verified in KeepIt. Gallery refresh needs retry: " + j(n), true));
      }, "message", { capture: true, propagate: true }), o;
    });
  } catch (t) {
    E(j(t), true);
  } finally {
    re = false, await ci(), Ee();
  }
}
async function W(e, t = "message", { capture: i = false, propagate: o = false } = {}) {
  if ($) {
    if (o) throw new Error("Another operation is still running. Retry this upload.");
    return E("Please wait for the current operation to finish.", false, t);
  }
  $ = true, document.querySelectorAll("button:not(#startup-reload):not(.viewer-exit):not(.card-open):not(.viewer-dock button)").forEach((n) => {
    n.closest(".note-dialog") || (n.disabled = true);
  }), i && sn(true);
  try {
    await e();
  } catch (n) {
    if (E(j(n), true, t), o) throw n;
  } finally {
    $ = false, document.querySelectorAll("button").forEach((n) => {
      n.closest(".note-dialog") || (n.disabled = false);
    }), Fo(), Be && !he && !u?.isCloud && (a("add-files").disabled = true, a("empty-add").disabled = false), me && !re && xe();
  }
}
async function M({ reload: e = true } = {}) {
  if (e && u?.isFolder && !u.readOnly && await u.reload(), oe = u ? (await u.list()).filter((item) => item.source !== ft || !item.tags?.includes(mt)) : [], te && u) {
    let n = await V.pendingRows(await G()), r = new Set(n.map((s) => s.id));
    oe = [...oe.filter((s) => !r.has(s.id)), ...n];
  }
  let t = [...new Set(oe.filter((n) => !n.trashedAt && n.domain).map((n) => n.domain))].sort((n, r) => n.localeCompare(r)), i = a("collection-filter").value;
  a("collection-filter").replaceChildren(new Option("All categories", ""), ...t.map((n) => new Option(n, n))), t.includes(i) && (a("collection-filter").value = i), a("collection-suggestions").replaceChildren(...t.map((n) => {
    let r = U("option");
    return r.value = n, r;
  })), a("all-count").textContent = oe.filter((n) => !n.trashedAt && !n.archivedAt).length, a("archive-count").textContent = oe.filter((n) => !n.trashedAt && n.archivedAt).length, a("trash-count").textContent = oe.filter((n) => n.trashedAt).length, a("usage").textContent = `${pe(oe.reduce((n, r) => n + r.bytes, 0))} used`;
  let o = u ? await u.info() : {};
  ae = Ti(o.metadataSchema, oe), a("backup-state").textContent = o.backupExportedAt ? `Last export requested ${new Date(o.backupExportedAt).toLocaleString()}. ${o.backupRevision === o.revision ? "No changes since that export." : "Your library has changed since then."}` : "No backup exported from this browser yet.", si(), await L();
}
async function L() {
  Lo !== u && (Ze.clear(), Lo = u);
  let e = Ai(oe, { query: a("search").value, collection: a("collection-filter").value, kind: a("type-filter").value, sort: a("sort").value, view: X }), t = JSON.stringify([a("search").value, a("collection-filter").value, a("type-filter").value, a("sort").value, X]);
  L.signature !== t && (L.page = 0, L.signature = t);
  let i = Math.ceil(e.length / 100);
  L.page = Math.min(L.page || 0, Math.max(0, i - 1));
  let o = e.slice(L.page * 100, (L.page + 1) * 100);
  a("list-pagination").hidden = i <= 1, a("page-status").textContent = `Page ${L.page + 1} of ${i}`, a("page-previous").hidden = L.page === 0, a("page-next").hidden = L.page >= i - 1;
  let n = { image: "Photos", video: "Videos", document: "Documents", audio: "Audio" };
  a("view-title").textContent = X === "all" ? n[a("type-filter").value] || "Library" : X === "favorites" ? "Favorites" : X === "archives" ? "Archives" : "Recently deleted", a("result-count").textContent = `${e.length} ${e.length === 1 ? "item" : "items"}`;
  let r = JSON.stringify([t, L.page, o]);
  if (L.contentSignature === r && L.contentLibrary === u) return;
  L.contentSignature = r, L.contentLibrary = u, L.thumbObserver?.disconnect(), L.thumbAbort?.abort(), L.thumbAbort = new AbortController(), a("items").replaceChildren(), a("empty").hidden = !!e.length;
  let s = a("search").value || a("collection-filter").value || a("type-filter").value;
  a("empty-title").textContent = s ? "No matches yet." : X === "archives" ? "Archives is empty." : X === "trash" ? "Trash is empty." : X === "favorites" ? "Keep your favorites close." : "Start with something worth keeping.", a("empty-copy").textContent = s ? "Try another search or change your filters." : X === "archives" ? "Archived entries appear only here. Unarchive an entry to return it to your library." : X === "trash" ? "Items moved here can be restored or deleted permanently." : X === "favorites" ? "Open an item and mark it as a favorite." : "Add photos, videos, documents and more. Keep everything together, with details that work for you.", u?.isFolder && X === "trash" && !s && (a("empty-copy").textContent = "Items moved here can be restored or deleted permanently."), a("empty-add").hidden = !!s || X !== "all", a("empty-add").textContent = u ? "Add your first files" : "Connect OneDrive";
  let p = u?.isCloud && !oe.length && X === "all" && !s;
  a("empty-copy-mac").hidden = !(p && he), p && (a("empty-title").textContent = "Your OneDrive library is empty.", a("empty-copy").textContent = "Files in your earlier Mac library stay in that folder. Copy that library here to share its files and details across your devices."), u?.readOnly && (a("empty-title").textContent = "Last verified gallery", a("empty-copy").textContent = "Checking OneDrive for updates. This view may be out of date."), Be && !u && (a("empty-title").textContent = "Make room for what matters.", a("empty-copy").textContent = "Connect OneDrive to use one library on your Mac and iPhone, or choose a folder on your Mac.", a("empty-add").disabled = false);
  let d = ++L.generation, m = L.thumbAbort.signal, f = [], g = 0;
  function h(l, c, w) {
    let v = U("img");
    v.alt = "", v.decoding = "async", v.src = c.url, v.onload = () => {
      m.aborted || (l.querySelector(".file-glyph").hidden = true, l.classList.add("has-thumbnail"));
    }, v.onerror = () => {
      v.remove(), l.querySelector(".file-glyph").hidden = false;
    }, l.prepend(v), w && c.duration != null && l.append(U("span", bo(c.duration), "video-duration"));
  }
  let b = u, y = u ? await G() : null;
  if (m.aborted || b !== u) return;
  async function I({ item: l, preview: c }) {
    try {
      let w = io(y, l), v = Re(l), N = v === "video", O = Ze.get(w);
      if (O) {
        h(c, O, N);
        return;
      }
      let P = await Oo.get(w);
      if (m.aborted) return;
      if (P) {
        let k = Ze.put(w, P.blob, { duration: P.duration });
        k && h(c, k, N);
        return;
      }
      for (; re && !m.aborted; ) await new Promise((k) => setTimeout(k, 250));
      if (m.aborted) return;
      let z = await (["pdf", "note"].includes(v) ? b.original(l.id) : b.thumbnailSource ? b.thumbnailSource(l.id) : b.original(l.id));
      if (m.aborted) return;
      let R = N ? await ho(new Blob([z], { type: Ue(l) }), { signal: m }) : { poster: ["pdf", "note"].includes(v) ? await (await import("./chunk-XSEUL35T.js")).documentThumbnail(z, l, { signal: m }) : await qt(z) };
      if (m.aborted || d !== L.generation || !R.poster || (await Oo.put(w, R.poster, { duration: R.duration }), m.aborted)) return;
      let _ = Ze.put(w, R.poster, { duration: R.duration });
      _ && h(c, _, N);
    } catch {
    }
  }
  function C() {
    for (; g < 2 && f.length && !m.aborted; ) {
      let l = f.shift();
      g++, I(l).finally(() => {
        g--, C();
      });
    }
  }
  L.thumbObserver = typeof IntersectionObserver == "function" ? new IntersectionObserver((l) => {
    for (let c of l) if (c.isIntersecting) {
      let w = c.target.thumbnailJob;
      L.thumbObserver.unobserve(c.target), f.push(w);
    }
    C();
  }, { rootMargin: "240px" }) : null;
  for (let l of o) {
    let c = U("article", void 0, "item-card"), w = U("button", void 0, "card-open"), v = U("div", void 0, "card-preview"), N = U("div", void 0, "card-body"), O = Re(l);
    c.classList.add(["image", "video"].includes(O) ? "card-media" : "card-document"), w.type = "button", w.title = l.title, w.setAttribute("aria-label", `Open ${l.title}`);
    let P = O === "note" ? "NOTE" : (l.originalName.split(".").pop() || "FILE").slice(0, 6).toUpperCase();
    if (v.append(U("span", P, "file-glyph"), U("span", Ei[O], "kind-label")), N.append(U("h3", l.title), U("p", `${l.domain || "Unsorted"} \xB7 ${pe(l.bytes)}`, "card-meta")), l.pendingNote && N.append(U("p", l.pendingState === "saving" ? "Saving to library\u2026" : l.pendingState === "queued" ? "Saved on device \xB7 Pending sync" : l.pendingRetryAt ? "Saved on device \xB7 Waiting to retry" : "Save needs attention", "card-meta note-sync-status")), l.tags.length) {
      let R = U("div", void 0, "card-tags");
      l.tags.slice(0, 3).forEach((_) => R.append(U("span", _, "tag"))), l.tags.length > 3 && R.append(U("span", `+${l.tags.length - 3}`, "tag")), N.append(R);
    }
    w.append(v, N), c.append(w), l.favorite && c.append(U("span", "\u2605", "card-favorite")), w.onclick = () => ue(l) ? ce().then((R) => R.open(l.id)).catch((R) => E(j(R), true)) : re ? ot(l.id).catch((R) => E(j(R), true)) : W(() => ot(l.id)), a("items").append(c);
    let z = U("button", "\u22EF", "card-more");
    z.type = "button", z.setAttribute("aria-label", `Actions for ${l.title}`), z.setAttribute("aria-haspopup", "dialog"), z.onclick = () => No(l, z), c.append(z), Li(w, () => No(l, w)), (O === "image" && l.bytes <= 128 * 1024 ** 2 || ["video", "pdf", "note"].includes(O)) && (v.thumbnailJob = { item: l, preview: v }, L.thumbObserver ? L.thumbObserver.observe(v) : f.push(v.thumbnailJob));
  }
  C();
}
L.generation = 0;
L.page = 0;
a("page-previous").onclick = () => {
  L.page = Math.max(0, L.page - 1), L().catch((e) => E(e.message, true));
};
a("page-next").onclick = () => {
  L.page++, L().catch((e) => E(e.message, true));
};
async function dn(e) {
  let t = u, i = await G();
  if (ue(e)) {
    let n = [["Word document", "word"], ["Markdown + images", "markdown"], ["HTML with images", "html"], ["Plain text", "text"], ["Editable KeepIt note", "native"]];
    Ut("Share " + e.title, n.map(([r, s]) => ({ label: r, error: (p) => E(j(p), true), run: async () => {
      E("Preparing " + r + "\u2026");
      let d = (await V.jobs(i)).find((h) => h.itemId === e.id && h.state !== "saved")?.blob || await t.original(e.id), { unpackNote: m } = await import("./chunk-SGTLM5CQ.js"), { portableNote: f } = await import("./chunk-HG7NYSTC.js"), g = await f(await m(d), e, s);
      Pt(new File([g.blob], g.name, { type: g.blob.type }), e.title);
    } })));
    return;
  }
  E("Preparing file\u2026");
  let o = await t.original(e.id);
  Pt(new File([o], e.originalName, { type: e.mime }), e.title);
}
function No(e, t) {
  let i = u, o = () => ue(e) ? ce().then((p) => p.open(e.id)) : ot(e.id), n = (p) => W(async () => {
    if (u !== i) throw new Error("The selected library changed. Reopen this menu.");
    if (e.pendingNote) throw new Error("This note still has a pending save. Open it to review its status first.");
    await p(i), await M({ reload: false });
  }), r = (p) => E(j(p), true), s = [{ label: "Open", run: o, error: r }, { label: "Share\u2026", run: () => dn(e), error: r }];
  e.trashedAt ? s.push({ label: "Restore from Trash", disabled: u?.readOnly, run: () => n((p) => p.trash(e.id, e.version, true)), error: r }) : s.push({ label: "Duplicate", disabled: e.pendingNote || u?.readOnly, run: () => n(async (p) => {
    await p.duplicate(e.id, e.version), E("Copy added to your library.");
  }), error: r }, { label: e.archivedAt ? "Unarchive" : "Archive", disabled: e.pendingNote || u?.readOnly, run: () => n(async (p) => {
    await p.archive(e.id, e.version, !!e.archivedAt), E(e.archivedAt ? "Returned to Library." : "Moved to Archives.");
  }), error: r }, { label: "Move to Trash", danger: true, disabled: e.pendingNote || u?.readOnly, run: () => n(async (p) => {
    await p.trash(e.id, e.version), E("Moved to Recently deleted. You can restore it there.");
  }), error: r }), Ut(e.title, s, { returnFocus: t });
}
async function Po() {
  Ne++, ni?.(), ni = null, ne && (await ne.close(), ne = null), De && URL.revokeObjectURL(De), De = null, a("preview").replaceChildren(), a("pdf-controls").hidden = true, a("preview-status").textContent = "";
}
function Fo() {
  a("pdf-previous").disabled = $ || !ne?.doc || ne.page <= 1, a("pdf-forward").disabled = $ || !ne?.doc || (ne.pageEnd || ne.page) >= ne.doc.numPages;
}
async function ot(e, expectedLibrary) {
  await Po();
  if (expectedLibrary && u !== expectedLibrary) throw Error("The active KeepIt library changed. Try again.");
  let t = Ne, item = u.getItem ? await u.getItem(e) : await u.db.items.get(e);
  if (expectedLibrary && u !== expectedLibrary) throw Error("The active KeepIt library changed. Try again.");
  if (T = item, !T) throw new Error("This item is no longer available. Refresh your library.");
  if (ue(T)) {
    let n = T.id;
    T = null;
    let editor = await ce();
    if (expectedLibrary && u !== expectedLibrary) throw Error("The active KeepIt library changed. Try again.");
    await editor.open(n, { expectedLibrary });
    return;
  }
  if (u?.readOnly) throw T = null, new Error("The gallery is available, but OneDrive is still reconnecting. Wait for the connection to open originals.");
  for (let [n, r] of [["title", T.title], ["tags", T.tags.join(", ")], ["source", T.source], ["notes", T.notes]]) a(`item-${n}`).value = r;
  ze(a("item-collection"), ae.categories, T.domain), ze(a("item-record-type"), lt(ae), T.recordType || "", "Unspecified"), li(T.customFields || []), a("item-favorite").checked = T.favorite, Et = nt(), a("item-heading").textContent = T.title, a("detail-message").hidden = true, a("item-info").textContent = `${T.originalName} \xB7 ${pe(T.bytes)} \xB7 Added ${new Date(T.createdAt).toLocaleDateString()}`, ai = T.shortCode || Se(), Ce = null, kt = null, a("item-name-options").hidden = true, a("item-name-edit").setAttribute("aria-expanded", "false"), a("item-domain-code").value = T.domainCode || zt(T.domain), a("item-type-code").value = T.typeCode || ki(T.originalName, T.mime, T.title), a("item-managed-name").textContent = T.managedName || "Original filename retained", a("trash-item").textContent = T.trashedAt ? "Restore from Trash" : "Move to Trash", a("delete-item").hidden = !T.trashedAt, a("item-dialog").open || a("item-dialog").showModal(), a("preview").append(U("p", "Opening preview\u2026", "preview-fallback"));
  let i = await u.original(e);
  if (t !== Ne) return;
  a("preview").replaceChildren();
  let o = await Lt(i, T);
  if (t === Ne) if (o === "pdf") {
    if (i.size > 128 * 1024 ** 2) {
      a("preview").append(U("p", "This PDF is stored. It exceeds the 128 MiB in-browser rendering budget; download the original to open it in your PDF app.", "preview-fallback"));
      return;
    }
    if (!await Si(i)) {
      a("preview").append(U("p", "This file does not contain a recognizable PDF header.", "preview-fallback"));
      return;
    }
    let n = U("canvas");
    a("preview").append(n), a("preview-status").textContent = "Opening PDF\u2026";
    try {
      let { PdfReader: r } = await import("./chunk-V6NBNB24.js");
      if (t !== Ne) return;
      ne = new r(n, a("preview"), (s, p, d) => {
        a("preview-status").textContent = /^(?:PDF page ready|Rendered within|No document open)/.test(s) ? "" : s, a("pdf-position").textContent = `Page ${p} of ${d}`, Fo();
      }), await ne.load({ data: new Uint8Array(await i.arrayBuffer()) }), a("pdf-controls").hidden = false;
    } catch {
      a("preview-status").textContent = "This PDF could not be displayed here. Download the original to open it in your PDF reader.";
    }
  } else if (o === "image") {
    let n = U("img");
    n.alt = T.title, n.onerror = () => {
      n.remove(), a("preview").append(U("p", "This image format cannot be previewed in this browser. Download the original to view it.", "preview-fallback"));
    }, De = URL.createObjectURL(new Blob([i], { type: Ue(T) })), n.src = De, a("preview").append(n);
  } else {
    let n = await Vt(i, T, a("preview"), () => t === Ne);
    if (t !== Ne) {
      n.cleanup();
      return;
    }
    ni = n.cleanup, n.handled || a("preview").append(U("p", "Original stored unchanged. This format needs its usual application for viewing. Use Download original.", "preview-fallback"));
  }
}
function nt() {
  return { title: a("item-title").value, domain: a("item-collection").value, tags: a("item-tags").value.split(",").map((e) => e.trim()).filter(Boolean), notes: a("item-notes").value, source: a("item-source").value, favorite: a("item-favorite").checked, recordType: a("item-record-type").value, customFields: je?.read() || [] };
}
function qo() {
  return T ? (kt = { domainCode: a("item-domain-code").value, typeCode: a("item-type-code").value, shortCode: ai }, Ii({ ...kt, shortId: ai, title: a("item-title").value, originalName: T.originalName, mime: T.mime })) : "";
}
function Ct() {
  !T || a("item-name-options").hidden || (a("item-name-proposal").textContent = qo());
}
for (let [e, t] of [["item-domain-code", yi], ["item-type-code", vi]]) a(e).replaceChildren(...Object.entries(t).map(([i, o]) => new Option(`${i} \xB7 ${o}`, i)));
a("item-name-edit").onclick = () => {
  a("item-name-options").hidden = !a("item-name-options").hidden;
  let e = !a("item-name-options").hidden;
  a("item-name-edit").setAttribute("aria-expanded", String(e)), e && Ct();
};
for (let e of ["item-domain-code", "item-type-code"]) a(e).addEventListener("input", Ct);
a("item-title").addEventListener("input", () => {
  Ce && (Ce = null, a("item-managed-name").textContent = T?.managedName || "Original filename retained", E("The title changed. Please approve the filename again if you want to rename it.", false, "detail-message")), Ct();
});
a("item-collection").addEventListener("change", () => {
  li(), (!T?.domainCode || T.domainCode === "GEN") && (a("item-domain-code").value = zt(a("item-collection").value)), Ct();
});
a("item-name-approve").onclick = () => {
  try {
    let e = qo();
    Ce = { ...kt }, a("item-managed-name").textContent = e, a("item-name-options").hidden = true, a("item-name-edit").setAttribute("aria-expanded", "false"), E("Filename selected. Tap Save changes to keep it.", false, "detail-message");
  } catch (e) {
    E(j(e), true, "detail-message");
  }
};
function Te() {
  let e = (t) => JSON.stringify({ ...t, customFields: [...t.customFields || []].sort((i, o) => i.id.localeCompare(o.id)) });
  return T && (Ce !== null || e(nt()) !== e(Et));
}
async function rt(e = false) {
  $ && !e || !e && Te() && !confirm("Discard unsaved changes to this item?") || (a("item-dialog").close(), T = null, je?.dispose(), je = null, await Po());
}
function at(e, t) {
  let i = URL.createObjectURL(e), o = U("a");
  o.href = i, o.download = t, document.body.append(o), o.click(), o.remove(), setTimeout(() => URL.revokeObjectURL(i), 6e4);
}
function ln() {
  if (!u) return E("Choose a library folder first.");
  a("backup-message").hidden = true, a("backup-dialog").showModal();
}
a("add-files").onclick = () => {
  a("add-menu").hidden = !a("add-menu").hidden;
};
a("add-upload").onclick = a("empty-add").onclick = () => {
  a("add-menu").hidden = true, u ? a("file-input").click() : J?.show();
};
a("write-note").onclick = () => {
  a("add-menu").hidden = true, ce().then((e) => e.newNote()).catch((e) => E(j(e), true));
};
a("note-drafts").onclick = () => {
  a("add-menu").hidden = true, ce().then((e) => e.menu()).catch((e) => E(j(e), true));
};
a("take-photo").onclick = () => a("camera-input").click();
function pi(e) {
  if (!u) return E("Choose a library folder first.");
  let t = [...e];
  if (!t.length) return;
  ri = t, we = t[0];
  let i = t.length > 1;
  a("capture-title").hidden = i, a("capture-title").disabled = i, document.querySelector('[for="capture-title"]').hidden = i, a("capture-form").querySelector("button[type=submit]").textContent = i ? `Save ${t.length} files` : "Save", a("capture-title").value = we.name.replace(/\.[^.]+$/, "") || we.name, a("capture-file").textContent = t.length > 1 ? `${t.length} files \xB7 ${pe(t.reduce((o, n) => o + n.size, 0))} \xB7 Filenames supply individual titles. These metadata values apply to all selected files.` : `${we.name} \xB7 ${pe(we.size)}`, ze(a("capture-category"), ae.categories), ze(a("capture-record-type"), lt(ae), "", "Unspecified"), a("capture-extra").open = false, Uo([]), a("capture-dialog").showModal();
}
a("capture-category").onchange = () => Uo();
a("capture-dialog").addEventListener("close", () => Me?.dispose());
a("capture-close").onclick = () => {
  we = null, a("capture-dialog").close();
};
a("capture-dialog").addEventListener("cancel", (e) => {
  if ($ && !re) {
    e.preventDefault();
    return;
  }
  we = null, Me?.dispose();
});
a("capture-form").onsubmit = (e) => {
  if (e.preventDefault(), !we || $ && !re) return;
  let t = [...ri], i = a("capture-title").value.trim();
  if (t.length === 1 && !i) return a("capture-title").focus();
  let o = { ...t.length === 1 ? { title: i } : {}, domain: a("capture-category").value, recordType: a("capture-record-type").value, customFields: Me?.read() || [] }, n = u;
  we = null, ri = [], a("capture-dialog").close(), (async () => {
    try {
      if (!me) throw new Error("The upload queue is not available. Reload KeepIt and try again.");
      let r = await G();
      if (u !== n) throw new Error("Your library changed. Choose the files again.");
      navigator.storage?.persist?.().catch(() => {
      }), await be.enqueue(r, t, o, n.isFolder && !n.isCloud ? n.root : null), E(t.length + " file" + (t.length === 1 ? "" : "s") + " queued. You can add more."), xe();
    } catch (r) {
      E("The upload queue could not verify these files. Check Uploads for any retained copies, and keep your original files safe. " + j(r), true);
    }
  })();
};
for (let e of ["file-input", "camera-input"]) a(e).onchange = (t) => {
  let i = [...t.target.files];
  t.target.value = "", pi(i);
};
for (let e of ["search", "collection-filter", "type-filter", "sort"]) a(e).addEventListener(e === "search" ? "input" : "change", () => {
  clearTimeout(L.searchTimer), e === "search" ? L.searchTimer = setTimeout(() => L().catch((t) => E(j(t), true)), 90) : L().catch((t) => E(j(t), true));
});
document.querySelectorAll("[data-filter]").forEach((e) => e.onclick = () => {
  X = e.dataset.filter, a("type-filter").value = "", document.querySelectorAll("[data-filter]").forEach((t) => t.classList.toggle("selected", t === e)), L().catch((t) => E(j(t), true));
});
a("close-item").onclick = () => rt();
a("item-dialog").addEventListener("cancel", (e) => {
  e.preventDefault(), rt();
});
a("item-form").onsubmit = (e) => {
  e.preventDefault(), W(async () => {
    T = await u.edit(T.id, T.version, { ...nt(), ...Ce ? { namingChange: Ce } : {} }), Ce = null, Et = nt(), a("item-managed-name").textContent = T.managedName || "Original filename retained", a("item-heading").textContent = T.title, await M({ reload: false }), E("Changes saved.", false, "detail-message");
  }, "detail-message");
};
a("download-original").onclick = () => W(async () => at(await u.original(T.id), T.originalName), "detail-message");
a("download-named").onclick = () => W(async () => at(await u.original(T.id), T.managedName || T.originalName), "detail-message");
a("trash-item").onclick = () => W(async () => {
  let e = !!T.trashedAt;
  await u.trash(T.id, T.version, e), await rt(true), await M(), E(e ? "Item restored from Trash." : "Item moved to Trash. You can restore it there.");
}, "detail-message");
a("delete-item").onclick = () => {
  confirm("Permanently delete this original from your library? This cannot be undone here. Exported backups remain unchanged.") && W(async () => {
    let e = await u.remove(T.id, T.version);
    await rt(true), await M(), E(e?.originalsRetained ? "Item removed from the catalog. Some original copies could not be deleted; they remain in Files." : "Item and its original deleted from your library. Exported backups remain unchanged.", !!e?.originalsRetained);
  }, "detail-message");
};
a("pdf-previous").onclick = () => W(() => ne.step(-1), "detail-message");
a("pdf-forward").onclick = () => W(() => ne.step(1), "detail-message");
a("open-backup").onclick = a("backup-shortcut").onclick = ln;
a("backup-dialog").addEventListener("cancel", (e) => {
  $ && e.preventDefault();
});
a("close-backup").onclick = () => a("backup-dialog").close();
var et = null;
a("cancel-backup-export").onclick = () => et?.abort();
a("export-backup").onclick = async () => {
  if ($ || !u) return;
  let e = `KeepIt_Backup_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.zip`, t;
  if (typeof window.showSaveFilePicker == "function") try {
    t = await window.showSaveFilePicker({ suggestedName: e, types: [{ description: "KeepIt ZIP backup", accept: { "application/zip": [".zip"] } }] });
  } catch (i) {
    return i.name === "AbortError" ? void 0 : E(j(i), true, "backup-message");
  }
  W(async () => {
    E("Verifying originals and exporting backup\u2026", false, "backup-message");
    let i = await u.snapshot(), o;
    et = new AbortController(), a("cancel-backup-export").hidden = false, a("cancel-backup-export").disabled = false;
    try {
      let n = (r) => E(`Backup: ${pe(r.done)} / ${pe(r.total)}${r.name ? " \xB7 " + r.name : ""}`, false, "backup-message");
      if (t) {
        let r = u.isFolder && await u.root.resolve?.(t);
        if (r && ["Files", "_Catalog"].includes(r[0])) throw new Error("Choose a backup file outside this library\u2019s Files and _Catalog folders.");
        o = await t.createWritable(), await Jt(i, o, { onProgress: n, signal: et.signal }), await o.close(), o = null;
      } else at(await So(i, { onProgress: n, signal: et.signal }), e);
    } catch (n) {
      throw await o?.abort?.().catch(() => {
      }), n;
    } finally {
      a("cancel-backup-export").hidden = true, et = null;
    }
    await u.markBackup(i.info.revision), await M(), E(t ? "Backup saved to the file you chose." : "Backup download requested. Keep the ZIP outside this app.", false, "backup-message");
  }, "backup-message");
};
a("choose-backup").onclick = () => a("restore-input").click();
a("restore-input").onchange = (e) => {
  let t = e.target.files[0];
  e.target.value = "", t && W(async () => {
    E("Checking every backup entry before restoring\u2026", false, "backup-message");
    let i = await Ao(t, { onProgress: (n) => E(`Checking backup: ${n.name} \xB7 ${pe(n.done)} / ${pe(n.total)}`, false, "backup-message") }), o = await (async () => {
      if (i.noteHistory?.length && (u.isCloud || u.isFolder)) throw new Error("This backup includes historical native-note revisions. The selected cloud or folder library cannot preserve revision history. Choose the device-local library for a complete restore; no records were changed.");
      return u.restore(i);
    })();
    await M(), E(`${o.added} files restored; ${o.skipped} identical originals already present. Existing metadata was retained.${o.associationRecovery === "review-required" ? " Linked-app associations were preserved for review, but are NOT reconnected to the destination library until their scope is verified." : ""}`, o.associationRecovery === "review-required", "backup-message");
  }, "backup-message");
};
a("request-persistence").onclick = () => W(async () => {
  let e = await navigator.storage?.persist?.();
  a("persistence-status").textContent = e ? "Browser persistence granted. Backups are still needed if site data is cleared or the device is lost." : "The browser did not grant persistent storage. Keep a backup outside this app.";
}, "backup-message");
document.addEventListener("dragover", (e) => {
  e.target.closest?.(".note-dialog") || [...e.dataTransfer.types].includes("Files") && (e.preventDefault(), document.body.classList.add("dragging"));
});
document.addEventListener("dragleave", (e) => {
  e.relatedTarget || document.body.classList.remove("dragging");
});
document.addEventListener("drop", (e) => {
  document.body.classList.remove("dragging"), !e.target.closest?.(".note-dialog") && e.dataTransfer.files.length && (e.preventDefault(), !a("item-dialog").open && !a("backup-dialog").open && !a("metadata-dialog").open && !a("capture-dialog").open && pi(e.dataTransfer.files));
});
document.addEventListener("paste", (e) => {
  if (e.target.isContentEditable || e.target.closest?.(".note-dialog") || /INPUT|TEXTAREA/.test(e.target.tagName) || a("item-dialog").open || a("backup-dialog").open || a("metadata-dialog").open || a("capture-dialog").open) return;
  let t = [...e.clipboardData.files];
  t.length && (e.preventDefault(), pi(t));
});
var Do = 0, Xt = false;
window.addEventListener("focus", () => {
  Ee(), !($ || Xt || Date.now() - Do < 15e3 || document.querySelector("dialog[open]")) && (Do = Date.now(), Xt = true, M().catch((e) => E(j(e), true)).finally(() => {
    Xt = false;
  }));
});
window.addEventListener("beforeunload", (e) => {
  ($ || Ro || Te() || Z?.mode === "edit" && (Z.autosavePending > 0 || Z.autosaveError || Z.preparing)) && (e.preventDefault(), e.returnValue = "");
});
window.addEventListener("pagehide", () => {
  L.contentSignature = null, L.thumbObserver?.disconnect(), L.thumbAbort?.abort(), Ze.clear(), De && URL.revokeObjectURL(De);
});
var cn = new Ui({ schema: () => ae, records: () => oe, save: async (e, t) => {
  await u.saveSchema(e, t), await M(), T && (ze(a("item-collection"), ae.categories, T.domain), ze(a("item-record-type"), lt(ae), T.recordType || "", "Unspecified"), li(T.customFields || []), Et = nt()), E("Fields and categories saved.");
} });
for (let e of ["open-metadata", "menu-metadata", "item-customize-fields"]) a(e).onclick = () => {
  if (!u) return E("Choose a library folder first.");
  if (Te()) return E("Save item changes before customizing fields.", false, "detail-message");
  a("more-menu").hidden = true, a("more-trigger").setAttribute("aria-expanded", "false"), cn.open();
};
function si() {
  if (document.body.dataset.libraryConnected = String(!!u && !u.readOnly), a("settings-copy-mac").hidden = !(u?.isCloud && !u.readOnly && he), a("settings-copy-other").hidden = !(u?.isCloud && !u.readOnly && he), a("connect-onedrive").textContent = u?.isCloud ? "OneDrive connection" : "Connect OneDrive", !u && tt) {
    document.body.classList.remove("folder-library-mode"), a("storage-description").textContent = "Waiting for OneDrive. Your library will appear when the connection is ready.", a("storage-location-label").textContent = "OneDrive \xB7 Not connected", document.querySelector(".device-badge").textContent = "Connecting", a("backup-location-copy").textContent = "Connect OneDrive before exporting your library.";
    return;
  }
  if (u?.readOnly) {
    document.body.classList.remove("folder-library-mode"), a("storage-location-label").textContent = "OneDrive \xB7 Last verified gallery", document.querySelector(".device-badge").textContent = "Reconnecting", a("settings-folder").textContent = u.displayPath, a("storage-description").textContent = "Showing your last verified gallery while OneDrive reconnects. New files can queue on this device. Originals need a connection.", a("backup-location-copy").textContent = "Connect OneDrive before exporting a complete backup of your originals.";
    return;
  }
  if (u?.isCloud) {
    document.body.classList.remove("folder-library-mode"), a("choose-folder").hidden = true, a("choose-other-folder").hidden = true, a("request-persistence").hidden = true, a("take-photo").hidden = !nn, a("storage-location-label").textContent = "OneDrive \xB7 " + u.root.name, document.querySelector(".device-badge").textContent = "\u25CF OneDrive", a("settings-folder").textContent = u.displayPath, a("storage-description").textContent = "Saved in OneDrive. Changes are shared across your connected devices.", a("backup-location-copy").textContent = "Your originals and catalog are saved in OneDrive. Export a ZIP for an independent backup.";
    return;
  }
  Be && (document.body.classList.add("folder-library-mode"), a("choose-folder").hidden = !he, a("choose-folder").textContent = u ? "Change folder" : le ? "Reconnect folder" : "Choose folder", a("choose-other-folder").hidden = !he || !!u || !le, a("backup-shortcut").hidden = true, a("request-persistence").hidden = true, a("take-photo").hidden = true, a("storage-location-label").textContent = u ? "Local folder \xB7 " + u.root.name : "Folder library", document.querySelector(".device-badge").textContent = u ? "\u25CF In your folder" : "Choose a folder", document.querySelector(".sidebar-bottom p").textContent = "Your files, close at hand.", a("storage-description").textContent = u ? `Saved in ${u.root.name}.` : he ? "Connect OneDrive or choose a folder on this Mac." : "Connect OneDrive to open your shared library.", a("backup-location-copy").textContent = "Your library is saved in your chosen folder. Keep a separate backup for extra peace of mind, or bring in a backup from another device.");
}
async function jo(e) {
  if (u?.isFolder && u.release && await u.root.isSameEntry(e)) {
    await M();
    return;
  }
  let t = await new pt(e).open(), i = u;
  u = t, le = e, tt = false;
  let { preferLocal: o } = await import("./keepit-onedrive-connect-7eae6a4687c3.js");
  o(), await i?.close?.();
  try {
    await rn.remember(e);
  } catch {
    E("Folder connected. You may need to select it again next time.");
  }
  await M();
}
function Mo(e = false) {
  if (!he) return E("Use Chrome or Edge on your Mac to select a writable library folder.");
  if ($ || re || Te()) return E("Finish the current operation or close the item before changing folders.");
  W(async () => {
    try {
      let t;
      if (!e && !u && le) {
        if (t = le, await t.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Folder access was not granted. Reconnect or choose another folder; no files were changed.");
      } else t = await window.showDirectoryPicker({ id: "mylibrary-folder", mode: "readwrite" });
      if (await t.queryPermission({ mode: "readwrite" }) !== "granted" && await t.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Permission to save into the folder was not granted. No files were changed.");
      await jo(t), E(`Opened ${t.name}.`);
    } catch (t) {
      if (t.name !== "AbortError") throw t;
    }
  });
}
a("choose-folder").onclick = () => Mo();
a("choose-other-folder").onclick = () => Mo(true);
function ui(e = false) {
  if ($ || Te()) return E("Finish your current edit before copying the Mac library.");
  if (!u?.isCloud || u.readOnly) return E("Connect OneDrive first.", true);
  let t = u, i = le && !e ? le.requestPermission({ mode: "read" }).then((o) => {
    if (o !== "granted") throw new Error("Allow access to the earlier Mac library to copy it.");
    return le;
  }) : window.showDirectoryPicker({ id: "keepit-copy-mac", mode: "read" });
  a("settings-dialog").close(), W(async () => {
    try {
      let o = await i;
      E("Reading your Mac library. The source files will stay in place.");
      let n = await go(o, t, { onProgress: (r) => E(`Checking Mac library \xB7 ${r.done + 1} / ${r.total} \xB7 ${r.name}`) });
      await M(), E(`Copied ${n.added} items to OneDrive. ${n.skipped ? n.skipped + " already present. " : ""}Your Mac originals were retained.`);
    } catch (o) {
      if (await M().catch(() => {
      }), o.name !== "AbortError") throw new Error("The Mac copy did not finish. Source files were not changed. " + o.message);
    }
  });
}
a("empty-copy-mac").onclick = () => ui();
a("settings-copy-mac").onclick = () => ui();
a("settings-copy-other").onclick = () => ui(true);
window.addEventListener("pagehide", () => {
  u?.close?.();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted && u?.isCloud) {
    (async () => {
      await J.previewRemembered(), await J.start();
    })().catch((t) => E(j(t), true));
    return;
  }
  e.persisted && u?.isFolder && !u.release && (u = null, W(async () => {
    T && await rt(true), await M(), E("Reconnect your folder to continue saving.");
  }));
});
async function pn() {
  let e = a("startup-recovery"), t = a("startup-status");
  a("startup-reload").onclick = () => location.reload();
  let i = uo({ onSlow: (d) => {
    t.textContent = u?.readOnly ? "Your last verified gallery is available. OneDrive is still reconnecting; queued files are retained." : d + " This is taking longer than expected. You can wait or reload KeepIt. Your saved files are retained.", e.hidden = false, a("startup-reload").disabled = false;
  } }), o = (d) => {
    i.stage(d), u?.readOnly || (a("result-count").textContent = d), !e.hidden && !u?.readOnly && (t.textContent = d + " You can wait or reload KeepIt.");
  }, n = false, r = false;
  await W(async () => {
    let { OneDriveConnection: d, wantsOneDrive: m } = await import("./keepit-onedrive-connect-7eae6a4687c3.js");
    r = m(), tt = r;
    try {
      await V.open(), te = true;
    } catch (f) {
      E("Notes drafts could not open. " + j(f), true);
    }
    try {
      await be.open(), me = true, await ci();
    } catch (f) {
      E("The upload queue could not open. " + j(f), true);
    }
    if (J = new d({ settled: () => {
      Q?.syncCalendar?.(), window.dispatchEvent(new Event("keepit-library-ready")), te && Ee(), me && xe();
    }, canChange: () => !ye && !J?.startTask && !u?.pending && !$ && !re && !Te(), pause: async () => {
      await u?.close?.(), u = null, await M({ reload: false });
    }, preview: async (f) => {
      let g = u;
      u = f, await g?.close?.(), await M({ reload: false });
    }, clearPreview: async () => {
      u?.readOnly && (u = null, await M({ reload: false }));
    }, ready: async (f) => {
      tt = true;
      let g = u;
      u = f, await g?.close?.(), await Z?.reconnectThinkItLibrary(f), await retryVerifiedAuthSaves(f), await M({ reload: false }), E("OneDrive library connected."), Q?.notifyReady?.(), queueMicrotask(ii), me && xe(), te && Ee();
    }, disconnected: async () => {
      tt = false, u = null, await M({ reload: false }), E("OneDrive disconnected. Connect again or choose a local folder.");
    }, progress: (f) => {
      if (f.stage || f.error) {
        let g = { phase: f.error ? "error" : "connecting", message: f.error || f.stage };
        window.keepItConnectionState = g, window.dispatchEvent(new CustomEvent("keepit-connection-state", { detail: g }));
      }
      return f.stage ? o(f.stage) : f.error ? E(f.error, true) : E(`Uploading ${f.name} \xB7 ${pe(f.done)} / ${pe(f.total)}`);
    } }), r) u = null, await J.previewRemembered(), u || (si(), a("result-count").textContent = "Connecting to OneDrive\u2026", a("empty").hidden = true);
    else if (Be) {
      if (si(), he && le && await le.queryPermission({ mode: "readwrite" }).catch(() => "denied") === "granted") try {
        await jo(le);
      } catch (f) {
        E(j(f), true);
      }
    } else o("Opening device storage\u2026"), await u.open(), await M({ reload: false });
    n = true;
  }), ii();
  let s = new URL(location.href).searchParams.get("connect-onedrive") === "1" || sessionStorage.getItem("keepit-open-onedrive") === "1" || sessionStorage.getItem("keepit-owner-connect-return") === "1";
  sessionStorage.removeItem("keepit-open-onedrive"), sessionStorage.removeItem("keepit-owner-connect-return");
  let p = new URL(location.href);
  if (p.searchParams.has("connect-onedrive") && (p.searchParams.delete("connect-onedrive"), history.replaceState(null, "", p.pathname + p.search + p.hash)), J && !$e && (ye = true, J.start({ interactive: s }).then(async (d) => {
    r && !d && !u?.readOnly && (u = null, await M({ reload: false }), a("result-count").textContent = "OneDrive is not connected", a("empty-title").textContent = "OneDrive is unavailable", a("empty-copy").textContent = "Reconnect to retrieve your library. Saved entries are retained.");
  }).catch((d) => E(j(d), true)).finally(() => {
    ye = false, Q?.syncCalendar?.(), window.dispatchEvent(new Event("keepit-library-ready")), te && Ee(), me && xe();
  })), $e) {
    J = null;
    for (let m of ["connect-onedrive", "settings-onedrive", "settings-copy-mac", "settings-copy-other", "settings-change-folder"]) a(m).disabled = true, a(m).hidden = true;
    let d = U("p", "QA STAGING \xB7 Disposable browser library only \xB7 OneDrive disabled", "message");
    document.querySelector("main")?.prepend(d);
  }
  te && Ee(), me && xe(), i.finish(), e.hidden = n, n || (t.textContent = "KeepIt could not finish opening. Reload to retry. Your saved files are retained.", a("result-count").textContent = "Library could not open");
}
mo();
var ei = false;
setInterval(async () => {
  if (!(!u?.isCloud || u.readOnly || u.pending || u.fs.auth.reconnectRequired || $ || ei || document.hidden || document.querySelector("dialog[open]"))) {
    ei = true;
    try {
      let e = u, t = await e.readHead();
      !$ && !document.querySelector("dialog[open]") && u === e && t.revision !== e.state.revision && (e.state = t, await M());
    } catch (e) {
      E(j(e), true);
    } finally {
      ei = false;
    }
  }
}, 3e4);
pn().then(ii).catch((e) => E(j(e), true));
var ti = false, di = 0;
async function Tt() {
  if (!(ti || document.visibilityState === "hidden" || navigator.onLine === false)) {
    ti = true;
    try {
      let e = [...document.querySelectorAll("dialog[open]")], t = Z?.mode === "edit" && e.every((o) => o === Z.dialog);
      if ((!u?.isCloud || u.readOnly || !J?.bound && !u?.fs?.auth?.reconnectRequired) && J && !ye && !$ && !re && !Te() && (!e.length || t) && Date.now() - di > 6e4 && (di = Date.now(), await J.start()), !u) return;
      let i = await G();
      me && (await be.list()).some((o) => o.target === i && He(o)) && await xe(), te && ((await V.jobs(i)).some((o) => He(o)) || (await V.drafts(i)).length) && await Ee();
    } finally {
      ti = false;
    }
  }
}
var ba = setInterval(() => {
  Tt().catch(() => {
  });
}, 15e3);
to({ onResume: () => {
  di = 0, Tt().catch(() => {
  });
}, onNoteHost: async () => {
  if (!te || !u) throw Error("Choose the private QA library before checking native notes.");
  let { mountQaNoteHostPanel: e } = await import("./chunk-P372LW5E.js");
  e({ workspace: V, getLibrary: () => u, getTarget: G, getNoteUI: ce });
}, onBackup: async () => {
  let { mountQaBackupPanel: e } = await import("./keepit-note-entry-79b88dd8e8ec.js");
  e({ workspace: V, getLibrary: () => u, getTarget: G });
} });
window.addEventListener("online", () => {
  Tt().catch(() => {
  });
});
document.addEventListener("visibilitychange", () => {
  document.visibilityState === "visible" && Tt().catch(() => {
  });
});
a("menu-archives").onclick = () => {
  a("more-menu").hidden = true, a("more-trigger").setAttribute("aria-expanded", "false"), document.querySelector("[data-filter=archives]").click();
};
mountKeepItAppFiles({ getLibrary: () => te && !ye && !J?.startTask && u?.isCloud && !u.readOnly ? u : null });

async function retryVerifiedAuthSaves(library){
  if(!library?.isCloud||library.readOnly||library!==u)return;
  const target=await G();if(library!==u)return;
  for(const job of await V.jobs(target)){
    if(['AUTH_REQUIRED','AUTH_TIMEOUT'].includes(job.errorCode)&&(job.attempts||0)<8)
      await V.db.operations.update(job.id,{state:'queued',retryAt:null,error:null});
  }
}
window.addEventListener('keepit-auth-restored', event=>{
  const library=u;
  if(library?.fs?.homeId!==event.detail?.homeId)return;
  retryVerifiedAuthSaves(library).then(()=>Ee()).catch(error=>E(j(error),true));
});
