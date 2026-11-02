// MyLibrary UI-01: interface-only enhancements. The original library engine remains authoritative.
(() => {
  const $ = id => document.getElementById(id);
  const item = $('item-dialog');
  const previewTab = $('item-tab-preview');
  const detailsTab = $('item-tab-details');
  function pane(value) {
    item.dataset.pane = value;
    for (const [button, active] of [[previewTab, value === 'preview'], [detailsTab, value === 'details']]) {
      if (!button) continue;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
  }
  const bottomAdd = $('bottom-add');
  const bottomBackup = $('bottom-backup');
  $('bottom-search')?.addEventListener('click', () => {
    const search = $('search');
    search?.scrollIntoView({behavior:'smooth',block:'center'});
    search?.focus({preventScroll:true});
  });
  const more = $('more-trigger'), menu = $('more-menu');
  function closeMore(){if(!menu)return;menu.hidden=true;more?.setAttribute('aria-expanded','false');}
  more?.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    more.setAttribute('aria-expanded',String(!menu.hidden));
  });
  for (const [menuId, selector] of [['menu-favorites','[data-filter="favorites"]'], ['menu-trash','[data-filter="trash"]']]) {
    $(menuId)?.addEventListener('click', () => { document.querySelector(selector)?.click(); closeMore(); });
  }
  $('menu-backup')?.addEventListener('click', () => { $('open-backup')?.click(); closeMore(); });
  document.addEventListener('pointerdown', e => {if(!menu?.hidden && !menu.contains(e.target) && e.target!==more) closeMore();});
  document.addEventListener('keydown', e => {if(e.key==='Escape')closeMore();});
  bottomAdd?.addEventListener('click', () => $('add-files')?.click());
  bottomBackup?.addEventListener('click', () => $('open-backup')?.click());
  previewTab?.addEventListener('click', () => pane('preview'));
  detailsTab?.addEventListener('click', () => pane('details'));
  item?.addEventListener('click', event => {
    if (event.target === item && window.innerWidth > 820) $('close-item')?.click();
  });
  new MutationObserver(() => {
    if (item.open) { if (item.dataset.wasOpen !== 'yes') { item.dataset.wasOpen = 'yes'; pane('preview'); item.classList.remove('reader-immersive'); } }
    else { item.dataset.wasOpen = 'no'; item.classList.remove('reader-immersive'); }
  }).observe(item, { attributes: true, attributeFilter: ['open'] });
  $('reader-expand')?.addEventListener('click', () => {
    const expanded = item.classList.toggle('reader-immersive');
    $('reader-expand').textContent = expanded ? 'Exit focus' : 'Focus view';
    $('reader-expand').setAttribute('aria-pressed', String(expanded));
  });
  const density = $('density-switch');
  density?.addEventListener('click', () => {
    const list = $('items').classList.toggle('list-mode');
    density.textContent = list ? 'Grid view' : 'List view';
    density.setAttribute('aria-pressed', String(list));
  });
  // Preserve the existing selected-tab logic; only synchronize aria-current for accessibility.
  const nav = document.querySelector('.library-sidebar nav');
  function syncNav() {
    nav?.querySelectorAll('[data-filter]').forEach(button => {
      if (button.classList.contains('selected')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  nav?.addEventListener('click', () => requestAnimationFrame(syncNav));
  syncNav();
})();
