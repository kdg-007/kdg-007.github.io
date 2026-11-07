(() => {
  'use strict';
  const storageKey = 'app_appearance_v1';
  const schemes = [
    ['journal', 'Leather Journal', 'Warm leather, parchment and copper'],
    ['midnight', 'Midnight', 'Deep navy and cool teal'],
    ['linen', 'Linen', 'Soft cream and natural ink'],
    ['lavender', 'Lavender', 'Gentle plum and pale lilac'],
    ['forest', 'Forest', 'Deep green and sage']
  ];
  const root = document.documentElement;
  let selected = 'journal';
  let button;
  let dialog;
  let select;

  function readPreference() {
    try {
      const saved = localStorage.getItem(storageKey);
      return schemes.some(([id]) => id === saved) ? saved : 'journal';
    } catch {
      return selected;
    }
  }

  function applyScheme(scheme) {
    selected = scheme;
    root.dataset.appScheme = scheme;
    root.style.colorScheme = ['midnight', 'forest'].includes(scheme) ? 'dark' : 'light';
    if (select) select.value = scheme;
    if (button) button.title = 'Appearance · ' + schemes.find(([id]) => id === scheme)[1];
  }
  applyScheme(readPreference());

  function initialize() {
    // Connected workspaces share their parent's appearance control.
    if (window.parent !== window) {
      try {
        if (window.parent.document.querySelector('script[src*="connected-nav.js"]')) {
          root.dataset.appearanceEmbedded = 'true';
          return;
        }
      } catch {}
    }

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-appearance-button';
    button.textContent = 'Appearance';
    button.setAttribute('aria-haspopup', 'dialog');

    dialog = document.createElement('dialog');
    dialog.className = 'app-appearance-dialog';
    dialog.setAttribute('aria-labelledby', 'app-appearance-title');
    const heading = document.createElement('h2');
    heading.id = 'app-appearance-title';
    heading.textContent = 'Make it feel like yours';
    const description = document.createElement('p');
    description.textContent = 'Choose one appearance for LiveIt, KeepIt, ThinkIt and TravelIt on this browser.';
    const label = document.createElement('label');
    label.htmlFor = 'app-appearance-select';
    label.textContent = 'Color scheme';
    select = document.createElement('select');
    select.id = 'app-appearance-select';
    const preview = document.createElement('p');
    preview.className = 'app-appearance-preview';
    for (const [value, name] of schemes) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-appearance-done';
    close.textContent = 'Done';
    close.addEventListener('click', () => dialog.close());
    select.addEventListener('change', () => {
      applyScheme(select.value);
      preview.textContent = schemes.find(([id]) => id === selected)[2];
      try {
        localStorage.setItem(storageKey, selected);
      } catch {
        preview.textContent += ' · Applied for this visit. Browser storage is unavailable.';
      }
      // A storage event updates other tabs. This also updates same-tab iframes.
      for (const frame of document.querySelectorAll('iframe')) {
        try {
          frame.contentWindow.dispatchEvent(new Event('app-appearance-refresh'));
        } catch {}
      }
    });
    dialog.append(heading, description, label, select, preview, close);
    document.body.append(dialog);
    button.addEventListener('click', () => {
      preview.textContent = schemes.find(([id]) => id === selected)[2];
      dialog.showModal();
    });
    applyScheme(selected);

    function placeButton() {
      const target = document.querySelector('.connected-shell-bar') ||
        document.querySelector('.library-top .top-actions') ||
        document.querySelector('.topbar');
      if (target && button.parentNode !== target) {
        const apps = target.querySelector('#connected-apps-nav');
        target.insertBefore(button, apps);
      }
    }
    placeButton();
    new MutationObserver(placeButton).observe(document.body, {childList: true, subtree: true});
  }
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyScheme(readPreference());
  });
  window.addEventListener('app-appearance-refresh', () => applyScheme(readPreference()));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, {once: true});
  } else {
    initialize();
  }
})();
