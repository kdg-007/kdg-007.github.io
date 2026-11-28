import {hashText} from './app-repository-store.mjs';
import {offlineCopyLabel} from './offline-originals-ui.mjs';
import {CALENDAR_SOURCE, CALENDAR_TAG} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs?v=keepit-links-1';
import '../liveit/thinkit/connected-w18e-c15396/keepit-reference.js?v=1';

const {isItemId, normalize} = globalThis.LiveItKeepItReferences;
const apps = Object.freeze({
  liveit: {name:'LiveIt', path:'/partners/liveit/thinkit/connected-w18e-c15396/index.html', property:'liveItKeepItLinks'},
  travelit: {name:'TravelIt', path:'/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html', paths:['/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html','/partners/travelit/thinkit/afda98f5ced9406d0fe5/trips.html'], property:'travelItKeepItLinks'}
});
const isVisible = item => item && !item.trashedAt && isItemId(item.id) &&
  !(item.source === CALENDAR_SOURCE &&
    item.tags?.includes(CALENDAR_TAG));

const NOTE_MAGIC = new TextEncoder().encode('KEEPIT-NOTE-1\n');
/** Reads a KeepIt note file: its text blocks and its embedded images (drawings and photos). */
async function readNoteFile(blob, {maxImages = 6} = {}) {
  const head = new Uint8Array(await blob.slice(0, NOTE_MAGIC.length + 4).arrayBuffer());
  if (!NOTE_MAGIC.every((byte, i) => head[i] === byte)) throw Error('This KeepIt note could not be read.');
  const size = new DataView(head.buffer).getUint32(NOTE_MAGIC.length);
  if (!size || size > 32 * 1024 ** 2) throw Error('This KeepIt note could not be read.');
  const header = JSON.parse(await blob.slice(NOTE_MAGIC.length + 4, NOTE_MAGIC.length + 4 + size).text());
  const blocks = [], walk = (node, out) => { if (node.type === 'text') out.push(node.text || ''); else if (node.type === 'hardBreak') out.push('\n'); for (const child of node.content || []) walk(child, out); return out; };
  for (const node of header.document?.content || []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') { for (const item of node.content || []) { const text = walk(item, []).join('').trim(); if (text) blocks.push({type: 'item', text}); } continue; }
    const text = walk(node, []).join('').trim();
    if (text) blocks.push({type: node.type === 'heading' ? 'heading' : 'paragraph', text: text.slice(0, 20000)});
  }
  let offset = NOTE_MAGIC.length + 4 + size; const images = [];
  for (const asset of header.assets || []) {
    if (/^image\//.test(asset.mime) && images.length < maxImages && asset.bytes <= 12 * 1024 ** 2) images.push(blob.slice(offset, offset + asset.bytes, asset.mime));
    offset += asset.bytes;
  }
  return {blocks: blocks.slice(0, 400), images};
}
const noteDocument = (blocks = []) => ({type: 'doc', content: blocks.slice(0, 400).map(block => {
  const text = String(block.text || '').slice(0, 20000), inline = text ? [{type: 'text', text}] : undefined;
  if (block.type === 'heading') return {type: 'heading', attrs: {level: 2}, content: inline};
  if (block.type === 'list') return {type: 'bulletList', content: (block.items || []).slice(0, 200).map(item => ({type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: String(item).slice(0, 2000)}]}]}))};
  return {type: 'paragraph', content: inline};
}).filter(node => node.type !== 'bulletList' || node.content.length)});
export function mountKeepItItemLinks({app='liveit', frame, getLibrary, getWritableLibrary=null, getTarget, openItem, isNote, downloadFile,prepareOffline=async()=>{},newSketch=null,newNote=null}) {
  if (!Object.hasOwn(apps,app)) throw Error('Unsupported KeepIt link consumer.');
  const target = apps[app];
  function install() {
    const child = frame.contentWindow;
    const document = frame.contentDocument;
    if (!document || !(target.paths || [target.path]).includes(child.location.pathname)) return;
    async function connection() {
      if (!frame.isConnected || frame.contentDocument !== document) throw Error('Reopen '+target.name+' to use KeepIt links.');
      const library = getLibrary();
      if (!library) throw Error('Open your KeepIt library to browse or open linked items.');
      const assertCurrent = () => {
        if (!frame.isConnected || frame.contentDocument !== document || getLibrary() !== library)
          throw Error('The active KeepIt library changed. Try again.');
      };
      const scope = 'sha256:' + await hashText(await getTarget());
      assertCurrent();
      return {library, scope, assertCurrent};
    }
    async function resolve(reference) {
      const [link] = normalize([reference]);
      const {library, scope, assertCurrent} = await connection();
      if (link.scope !== scope) throw Error('Open the original KeepIt library to use this link.');
      const item = await library.getItem(link.itemId);
      assertCurrent();
      if (!isVisible(item)) throw Error('This item is unavailable in KeepIt. It may have been removed or moved to Trash.');
      return {item, library, assertCurrent};
    }
    const isImage = item => !isNote(item) && (/^image\//i.test(item.mime || '') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(item.originalName || ''));
    child[target.property] = Object.freeze({
      /** Small JPEG preview of an image item, or null for notes and other files. */
      async thumbnail(reference, size = 320) {
        const {item, library, assertCurrent} = await resolve(reference);
        if (!isImage(item) && !isNote(item)) return null;
        let original = await library.original(item.id);
        assertCurrent();
        // A note's preview is its first drawing or photo.
        if (isNote(item)) { original = (await readNoteFile(original, {maxImages: 1}).catch(() => ({images: []}))).images[0]; if (!original) return null; }
        const bitmap = await createImageBitmap(original).catch(() => null);
        if (!bitmap) return null;
        const scale = Math.min(1, Math.max(64, Math.min(640, Number(size) || 320)) / Math.max(bitmap.width, bitmap.height));
        const canvas = frame.ownerDocument.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
        return new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.78));
      },
      /** Opens KeepIt's sketchbook on a new note; resolves with its link once saved, or null if cancelled. */
      async sketch({title = ''} = {}) {
        if (typeof newSketch !== 'function') throw Error('Update KeepIt to sketch from ' + target.name + '.');
        const {scope, assertCurrent} = await connection();
        const name = String(title || 'Sketch').trim().slice(0, 200) || 'Sketch';
        const itemId = await newSketch(name);
        if (!itemId) return null;
        // Wait for KeepIt to finish saving the note before handing back its link.
        for (let attempt = 0; attempt < 90; attempt++) {
          try { const item = await getLibrary().getItem(itemId); assertCurrent(); if (isVisible(item)) return {scope, itemId, kind: 'note', title: String(item.title || name).slice(0, 256)}; } catch {}
          await new Promise(done => setTimeout(done, 500));
        }
        throw Error('The sketch is still saving in KeepIt. Attach it from KeepIt once it appears.');
      },
      /** Creates a KeepIt note from text blocks, saves it, and returns its link. */
      async createNote({title = '', blocks = []} = {}) {
        if (typeof newNote !== 'function') throw Error('Update KeepIt to create notes from ' + target.name + '.');
        const {scope, assertCurrent} = await connection();
        const name = String(title || 'Note').trim().slice(0, 200) || 'Note';
        const itemId = await newNote({title: name, document: noteDocument(Array.isArray(blocks) ? blocks : [])});
        for (let attempt = 0; attempt < 90; attempt++) {
          try { const item = await getLibrary().getItem(itemId); assertCurrent(); if (isVisible(item)) return {scope, itemId, kind: 'note', title: String(item.title || name).slice(0, 256)}; } catch {}
          await new Promise(done => setTimeout(done, 500));
        }
        throw Error('The note is still saving in KeepIt. Open KeepIt to finish it.');
      },
      /** Text blocks and images of a linked KeepIt note, for showing it inside the app. */
      async readNote(reference) {
        const {item, library, assertCurrent} = await resolve(reference);
        if (!isNote(item)) throw Error('This KeepIt item is not a note.');
        const original = await library.original(item.id);
        assertCurrent();
        const {blocks, images} = await readNoteFile(original);
        return {title: String(item.title || '').slice(0, 256), modified: item.modified || item.updatedAt || '', blocks, images: await Promise.all(images.map(async image => ({type: image.type, bytes: await image.arrayBuffer()})))};
      },
      /** Saves a new file (such as a trip photo) into the writable KeepIt library and returns its link. */
      async addFile(file, {title = ''} = {}) {
        // The file comes from the app's frame (another realm), so check its shape, not instanceof.
        if (!file || typeof file.size !== 'number' || typeof file.arrayBuffer !== 'function' || !file.size) throw Error('Choose a photo or file to add.');
        const library = getWritableLibrary?.();
        if (!library || library.readOnly || typeof library.importFile !== 'function') throw Error('Connect your KeepIt library with OneDrive to add photos from ' + target.name + '.');
        const {scope, assertCurrent} = await connection();
        const name = String(title || file.name || 'Photo').slice(0, 200);
        const local = new File([await file.arrayBuffer()], String(file.name || name).slice(0, 200), {type: file.type || 'application/octet-stream', lastModified: Number(file.lastModified) || Date.now()});
        const saved = await library.importFile(local, {title: name.replace(/\.[a-z0-9]+$/i, '')});
        assertCurrent();
        if (!saved?.item?.id) throw Error('KeepIt did not confirm the saved file.');
        return {scope, itemId: saved.item.id, kind: 'file', title: String(saved.item.title || name).slice(0, 256)};
      },
      async list() {
        const {library, scope, assertCurrent} = await connection();
        // Travel documents may have just been added in a separate KeepIt tab.
        if (app === 'travelit' && library.isFolder && !library.readOnly && globalThis.navigator?.onLine!==false) await library.reload();
        assertCurrent();
        const items = await library.list();
        assertCurrent();
        return items.filter(isVisible).map(item => ({
          scope, itemId:item.id, kind:isNote(item) ? 'note' : 'file',
          title:(String(item.title || item.originalName || 'Untitled').trim() || 'Untitled').slice(0,256),
          filename:String(item.originalName || '').slice(0,256)
        })).sort((a,b) => a.title.localeCompare(b.title));
      },
      async open(reference) {
        const {item, library} = await resolve(reference);
        await openItem(item.id, library);
      },
      async offlineStatus(reference) {
        const {item,library,assertCurrent}=await resolve(reference);
        const status=typeof library.offlineStatus==='function'?await library.offlineStatus(item.id):{available:!library.isCloud,pinned:!library.isCloud,olderCopy:false};
        assertCurrent();return {...status,managed:typeof library.offlineStatus==='function',label:typeof library.offlineStatus==='function'?offlineCopyLabel(status):'Available in the selected local library'};
      },
      async keepOffline(reference) {
        const {item,library,assertCurrent}=await resolve(reference);
        if(typeof library.keepOffline!=='function')throw Error('This library already keeps its files locally.');
        await prepareOffline(item);assertCurrent();
        const status=await library.keepOffline(item.id);assertCurrent();return {...status,managed:true,label:offlineCopyLabel(status)};
      },
      async removeOffline(reference) {
        const {item,library,assertCurrent}=await resolve(reference);
        if(typeof library.removeOffline!=='function')throw Error('Only a OneDrive device copy can be removed here.');
        const status=await library.removeOffline(item.id);assertCurrent();return {...status,managed:true,label:offlineCopyLabel(status)};
      },
      ...(downloadFile ? {async download(reference) {
        const {item, library, assertCurrent} = await resolve(reference);
        if (isNote(item)) throw Error('Open this note in KeepIt to print or export it.');
        const original = await library.original(item.id);
        assertCurrent();
        if (!(original instanceof Blob)) throw Error('KeepIt could not read the original file.');
        downloadFile(original, item.originalName || item.title || 'KeepIt file');
      }} : {})
    });
  }
  frame.addEventListener('load', install);
}

export const mountLiveItKeepItLinks = mountKeepItItemLinks;
