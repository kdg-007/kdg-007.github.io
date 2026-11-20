import {hashText} from './app-repository-store.mjs';
import {offlineCopyLabel} from './offline-originals-ui.mjs';
import {CALENDAR_SOURCE, CALENDAR_TAG} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs?v=keepit-links-1';
import '../liveit/thinkit/connected-w18e-c15396/keepit-reference.js?v=1';

const {isItemId, normalize} = globalThis.LiveItKeepItReferences;
const apps = Object.freeze({
  liveit: {name:'LiveIt', path:'/partners/liveit/thinkit/connected-w18e-c15396/index.html', property:'liveItKeepItLinks'},
  travelit: {name:'TravelIt', path:'/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html', property:'travelItKeepItLinks'}
});
const isVisible = item => item && !item.trashedAt && isItemId(item.id) &&
  !(item.source === CALENDAR_SOURCE &&
    item.tags?.includes(CALENDAR_TAG));

export function mountKeepItItemLinks({app='liveit', frame, getLibrary, getTarget, openItem, isNote, downloadFile,prepareOffline=async()=>{}}) {
  if (!Object.hasOwn(apps,app)) throw Error('Unsupported KeepIt link consumer.');
  const target = apps[app];
  function install() {
    const child = frame.contentWindow;
    const document = frame.contentDocument;
    if (!document || child.location.pathname !== target.path) return;
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
    child[target.property] = Object.freeze({
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
