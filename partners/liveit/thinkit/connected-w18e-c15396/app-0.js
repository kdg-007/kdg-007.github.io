
/* LiveIt reusable core; persistent records are stored via the IndexedDB repository below. No cloud connection. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LiveItCore = api;
})(typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';
  const DEMO_DATE = '2026-10-29';
  const KEY = 'liveit_v05_demo_records_v1';
  const DRAFT_PREFIX = 'liveit_v05_draft_';
  const defaultSpaces = {
    work: ['Architecture', 'Meetings', 'Planning', 'Finance'],
    personal: ['Family', 'Travel', 'Finance', 'Music', 'Philosophy', 'Investments']
  };
  // W17F: record IDs, command/operation IDs and draft keys must survive browser
  // restarts and concurrent tabs without relying on a millisecond clock and
  // resettable tab-local sequence. Always use OS-backed browser randomness.
  const uid = () => {
    const entropy = globalThis.crypto;
    if (entropy && typeof entropy.randomUUID === 'function') return `li-${entropy.randomUUID()}`;
    if (entropy && typeof entropy.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      entropy.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      return `li-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    // Failing closed is safer than silently generating a duplicate note ID.
    throw new Error('Secure random identifiers are unavailable in this browser. Nothing was saved.');
  };
  const r = (id, workspace, type, body, date, time, options = {}) => ({
    id, workspace, type, body, date, time, dueDate: '', remindAt: '',
    occurredOn: '', complete: false, archived: false, inbox: type === 'note' || type === 'quote',
    categories: [], createdAt: `${date}T${time || '12:00'}:00+08:00`, opId: `seed-${id}`,
    ...options
  });
  function seed() {
    return {
      schema: 1,
      records: [
        r('w-event-1', 'work', 'event', 'Project design review', DEMO_DATE, '09:00', { categories: ['Architecture'], inbox: false }),
        r('w-event-2', 'work', 'event', 'Coordination meeting', DEMO_DATE, '14:00', { categories: ['Meetings'], inbox: false }),
        r('w-task-1', 'work', 'task', 'Review updated concept report', '2026-10-28', '09:00', { dueDate: '2026-10-28', categories: ['Planning'], inbox: false }),
        r('w-task-2', 'work', 'task', 'Send meeting summary', '2026-10-29', '09:10', { dueDate: '2026-10-30', categories: ['Meetings'], inbox: false }),
        r('w-note-1', 'work', 'note', 'Check the drawing revisions before the next review.', DEMO_DATE, '11:10', { categories: ['Architecture'] }),
        r('w-quote-1', 'work', 'quote', 'The simplest working interface is the one people keep using.', DEMO_DATE, '13:30', { categories: ['Architecture', 'Finance'] }),
        r('w-journal-1', 'work', 'journal', 'Reviewed a sample concept and recorded decisions for follow-up.', '2026-10-23', '17:45', { occurredOn: '2026-10-23', inbox: false, categories: ['Meetings'] }),
        r('w-event-3', 'work', 'event', 'Weekly coordination', '2026-11-03', '09:00', { categories: ['Meetings'], inbox: false }),
        r('p-event-1', 'personal', 'event', 'Family appointment', DEMO_DATE, '16:00', { categories: ['Family'], inbox: false }),
        r('p-task-1', 'personal', 'task', 'Review household budget', '2026-10-29', '12:00', { dueDate: '2026-10-31', categories: ['Finance'], inbox: false }),
        r('p-note-1', 'personal', 'note', 'Consider a new place for a short family weekend trip.', DEMO_DATE, '12:25', { categories: ['Travel'] }),
        r('p-quote-1', 'personal', 'quote', 'A good day is not always the busiest day.', DEMO_DATE, '17:15', { categories: ['Philosophy'] }),
        r('p-memory-1', 'personal', 'journal', 'A quiet afternoon at home and a lovely shared meal.', '2025-10-29', '18:15', { occurredOn: '2025-10-29', categories: ['Family'], inbox: false })
      ],
      spaces: JSON.parse(JSON.stringify(defaultSpaces)),
      operations: []
    };
  }
  const allowed = new Set(['note', 'quote', 'task', 'reminder', 'event', 'journal']);
  const workspaces = new Set(['work', 'personal']);
  function validateRecord(rec) {
    return rec && typeof rec.id === 'string' && workspaces.has(rec.workspace) && allowed.has(rec.type) &&
      typeof rec.body === 'string' && typeof rec.date === 'string' && Array.isArray(rec.categories) &&
      (rec.repeat===undefined || rec.repeat==='none' || (rec.type==='event' && rec.repeat==='yearly'));
  }
  function assertData(data) {
    if (!data || data.schema !== 1 || !Array.isArray(data.records) || !Array.isArray(data.operations)) throw new Error('Invalid prototype store');
    if (!data.records.every(validateRecord)) throw new Error('Invalid prototype record');
    if (!data.spaces || !Array.isArray(data.spaces.work) || !Array.isArray(data.spaces.personal)) throw new Error('Invalid spaces');
    return data;
  }
  function normalize(text) { return String(text || '').trim(); }
  function create(data, input) {
    assertData(data);
    if (!workspaces.has(input.workspace)) throw new Error('Invalid workspace');
    if (!allowed.has(input.type)) throw new Error('Invalid type');
    if (!normalize(input.body)) throw new Error('Empty capture');
    if (!input.opId) throw new Error('Missing operation ID');
    const existed = data.records.find(x => x.opId === input.opId);
    if (existed) return existed;
    const date = input.date || DEMO_DATE;
    const rec = r(uid(), input.workspace, input.type, normalize(input.body), date, input.time || '12:00', {
      categories: Array.from(new Set((input.categories || []).filter(v => typeof v === 'string'))),
      inbox: input.type === 'note' || input.type === 'quote',
      dueDate: input.dueDate || '', remindAt: input.remindAt || '',
      repeat: input.type==='event'&&input.repeat==='yearly'?'yearly':'none',
      occurredOn: input.type === 'journal' ? (input.occurredOn || date) : '',
      opId: input.opId,
      createdAt: new Date().toISOString()
    });
    data.records.unshift(rec);
    data.operations.push(input.opId);
    return rec;
  }
  function update(data, id, workspace, changes) {
    const rec = data.records.find(x => x.id === id && x.workspace === workspace);
    if (!rec) throw new Error('Record unavailable in active workspace');
    if (changes.workspace && changes.workspace !== workspace) throw new Error('Cross-workspace move forbidden');
    const allowedFields = ['body','type','categories','dueDate','remindAt','date','time','occurredOn','complete','archived','inbox','repeat'];
    for (const key of allowedFields) if (Object.prototype.hasOwnProperty.call(changes,key)) rec[key] = changes[key];
    if (!validateRecord(rec)) throw new Error('Invalid update');
    return rec;
  }
  function scoped(data, workspace, opts = {}) {
    if (!workspaces.has(workspace)) return [];
    return data.records.filter(x => x.workspace === workspace && (!x.archived || opts.includeArchived) &&
      (!opts.category || x.categories.includes(opts.category)) &&
      (!opts.type || x.type === opts.type) &&
      (!opts.inbox || x.inbox) &&
      (!opts.query || `${x.body} ${x.categories.join(' ')}`.toLocaleLowerCase().includes(opts.query.toLocaleLowerCase())));
  }
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dayAdd = (iso, amount) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); };
  const monthAdd = (iso, amount) => { const [y,m] = iso.split('-').map(Number); return new Date(Date.UTC(y,m-1+amount,1)).toISOString().slice(0,10); };
  const dateLabel = iso => new Intl.DateTimeFormat('en', {weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
  return { DEMO_DATE, KEY, DRAFT_PREFIX, defaultSpaces, seed, assertData, normalize, create, update, scoped, esc, dayAdd, monthAdd, dateLabel, uid };
});

