/** Proof-of-contract adapter for an explicitly trusted KeepIt-owned in-process runtime.
 * NOT included in the approved TravelIt app or public staging build. No cross-origin
 * transport, no authorization grant and no cloud writer is supplied by this file.
 */
import {KeepItNoteClient} from '../SDK/keepit-note-client.mjs';
import {normalizeKeepItAssociation,validateKeepItReference} from './keepit-associations-v029.mjs';

const ownerField = /^[A-Za-z0-9_.:-]{1,128}$/;
function ownerFromAssociation(association) {
  const a = normalizeKeepItAssociation(association);
  return Object.freeze({appId:'travelit',workspace:a.workspaceId,entityId:a.entityId,associationId:a.id});
}
function preparedOwner({workspaceId,entityId,associationId}) {
  if (![workspaceId,entityId,associationId].every(v=>typeof v==='string' && ownerField.test(v)))
    throw Error('Stable TK05 owner fields must be ASCII identifiers (1–128 characters).');
  return Object.freeze({appId:'travelit',workspace:workspaceId,entityId,associationId});
}
function requestIdCheck(requestId) {
  if(typeof requestId!=='string'||!/^[-a-z0-9_:.]{1,128}$/i.test(requestId)) throw Error('Stable request ID is required.');
  return requestId;
}

/** The KeepIt owner must inject this actual pair from its trusted runtime.
 * A caller can supply a fake host/verifier for isolated tests; that is not authentication.
 * Do not expose this constructor in the independent-origin TravelIt UI until an approved
 * runtime/transport and caller identity are implemented.
 */
export class TravelItTK05Adapter {
  constructor({host,verifyHost}={}) {
    if(!host||typeof verifyHost!=='function') throw Error('An authorized KeepIt-owned host/verifier pair must be injected.');
    this.client = new KeepItNoteClient({consumer:'travelit',host,verifyHost});
    this.capability = null;
  }
  async connect() {
    this.capability = null;
    const c=await this.client.connect();
    if(c.transport!=='keepit-owned-in-process'||c.backgroundSync!==false||c.portableConsumerBackup!==false||c.copyNativeNote!==false) {
      this.client.disconnect();
      throw Error('Unexpected TK05 transport or unsupported capabilities.');
    }
    this.capability=c;
    return Object.freeze({connected:true,transport:c.transport,scope:c.scope,expiresAt:c.expiresAt,
      canOpen:c.openNativeNote===true,canCreate:c.createNativeNote===true,canCheckStatus:c.getNativeNoteStatus===true,
      backgroundSync:false,portableConsumerBackup:false,independentCopy:false});
  }
  async open({association,requestId}) {
    const a=normalizeKeepItAssociation(association);
    return this.client.open({requestId:requestIdCheck(requestId),owner:ownerFromAssociation(a),reference:a.reference});
  }
  async status({association,requestId}) {
    const a=normalizeKeepItAssociation(association);
    const s=await this.client.status({requestId:requestIdCheck(requestId),owner:ownerFromAssociation(a),reference:a.reference});
    // Status is specific to the native note, not to the TravelIt trip/backup/calendar.
    return Object.freeze({reference:s.reference,state:s.state,cloudVerified:s.cloudVerified===true,
      destination:s.destination??null,digest:s.digest??null,requestId:s.requestId});
  }
  /** Phase 1: reserve/open native draft; no TravelIt database write is performed here.
   * Phase 2 must persist a v0.29 association using guardedSaveRecord with a stable ID.
   * Keep owner+requestId durable on the TravelIt side for recoverable retries.
   */
  async reserveNativeNote({workspaceId,entityId,associationId,requestId,title}) {
    const owner=preparedOwner({workspaceId,entityId,associationId});
    if(typeof title!=='string'||!title.trim()||title.length>1000) throw Error('Creation requires a short title, not rich content.');
    const result=await this.client.create({owner,requestId:requestIdCheck(requestId),title});
    validateKeepItReference(result.reference);
    return Object.freeze({reference:result.reference,owner,requestId:result.requestId,
      saveStatus:'unverified',persistedInTravelIt:false,cloudVerified:false});
  }
  disconnect(){this.capability=null;this.client.disconnect();}
}
