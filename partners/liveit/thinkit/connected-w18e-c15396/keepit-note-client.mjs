// src/thinkit-note-binding.js
var UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function validNoteReference(value) {
  return !!value && value.provider === "keepit" && value.version === 1 && /^sha256:[a-f0-9]{64}$/.test(value.scope) && UUID.test(value.itemId) && Number.isSafeInteger(value.revision) && value.revision >= 0;
}

// src/keepit-note-owner.js
var NOTE_CONSUMERS = Object.freeze(["thinkit", "liveit", "planit", "travelit"]);
var field = (v) => typeof v === "string" && /^[a-z0-9_:.-]{1,128}$/i.test(v);
function validateNoteOwner(value, consumer) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || value.appId !== consumer || !NOTE_CONSUMERS.includes(consumer) || !field(value.workspace) || !field(value.entityId) || !field(value.associationId) || consumer === "liveit" && !["personal", "work"].includes(value.workspace)) throw Error("Invalid note owner or workspace.");
  return Object.freeze({ appId: consumer, workspace: value.workspace, entityId: value.entityId, associationId: value.associationId });
}

// src/keepit-note-client.js
var KeepItNoteClient = class {
  constructor({ consumer, host, verifyHost }) {
    this.consumer = consumer;
    this.host = host;
    this.verifyHost = verifyHost;
    this.capability = null;
  }
  async connect() {
    this.capability = null;
    if (!NOTE_CONSUMERS.includes(this.consumer) || typeof this.verifyHost !== "function" || await this.verifyHost(this.host) !== true) throw Error("KeepIt host is not trusted or its session expired.");
    const c = await this.host.describeCapabilities({ consumer: this.consumer, contractMajor: 1 });
    if (c?.consumer !== this.consumer || c.contractMajor !== 1 || c.sessionState !== "authorized" || !/^sha256:[a-f0-9]{64}$/.test(c.scope)) throw Error("Incompatible KeepIt host.");
    this.capability = { ...c };
    return { ...c };
  }
  async request(method, { requestId, owner, reference, ...rest }) {
    const c = this.capability;
    if (!c || await this.verifyHost(this.host) !== true || c[method] !== true) throw Error("KeepIt capability is unavailable. Retain the local source.");
    owner = validateNoteOwner(owner, this.consumer);
    if (typeof requestId !== "string" || !/^[-a-z0-9_:.]{1,128}$/i.test(requestId) || method !== "createNativeNote" && (!validNoteReference(reference) || reference.scope !== c.scope)) throw Error("Invalid note request or original library reference.");
    const req = { consumer: this.consumer, contractMajor: 1, requestId, owner, reference: reference ? { ...reference } : reference, ...rest };
    const result = await this.host[method](req);
    if (this.capability !== c || await this.verifyHost(this.host) !== true || result?.requestId !== requestId || !validNoteReference(result.reference) || result.reference.scope !== c.scope || method !== "createNativeNote" && (result.reference.itemId !== reference.itemId || result.reference.revision < reference.revision)) throw Error("KeepIt response did not verify the original note identity. Retain the local source.");
    if (method === "getNativeNoteStatus") {
      if (!["attention", "pending-library-save", "saved-on-device", "last-verified-device-copy", "verified"].includes(result.state) || typeof result.cloudVerified !== "boolean" || result.cloudVerified && (result.state !== "verified" || result.destination !== "OneDrive" || !/^[a-f0-9]{64}$/.test(result.digest))) throw Error("KeepIt save receipt was not verified.");
    } else if (result.status !== "opened" || result.saveStatus !== "unverified" || !["draft-saved-locally", "pending-library-save", "existing-note"].includes(result.localState)) throw Error("KeepIt editor opening was not verified.");
    return result;
  }
  open(input) {
    return this.request("openNativeNote", input);
  }
  create(input) {
    return this.request("createNativeNote", input);
  }
  status(input) {
    return this.request("getNativeNoteStatus", input);
  }
  disconnect() {
    this.capability = null;
  }
};
export {
  KeepItNoteClient
};
