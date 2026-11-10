// Canvas arrangement adapted from Strategyzer AG, CC BY-SA 3.0.
function createThinkItBusinessCanvas({ dom, $, esc, modal, uid, transact, sanitizeMindNote, mindCompressImage, getPage, diNoTabs, closeModal }) {
  const BUSINESS_BLOCKS = [
    ['partners', 'Key Partnerships', 'Who helps you deliver the offer?'],
    ['activities', 'Key Activities', 'What must you do well?'],
    ['resources', 'Key Resources', 'Which assets or capabilities do you need?'],
    ['value', 'Value Propositions', 'What customer problem do you solve, and how?'],
    ['relationships', 'Customer Relationships', 'How do you attract, support and retain customers?'],
    ['channels', 'Channels', 'How will customers discover, buy and receive the offer?'],
    ['customers', 'Customer Segments', 'Whom are you serving?'],
    ['cost', 'Cost Structure', 'What are the major costs?'],
    ['revenue', 'Revenue Streams', 'Who pays, for what and how?'],
  ];
  const BUSINESS_CREDIT = '<a href="https://www.strategyzer.com/library/the-business-model-canvas">Business Model Canvas</a> adapted from Strategyzer AG · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>';

  function businessBoard(model, interactive) {
    const board = dom('div', 'business-board');
    for (const [key, title, guide] of BUSINESS_BLOCKS) {
      const block = dom('section', 'business-block', undefined, board);
      block.dataset.block = key;
      dom('h2', '', title, block);
      if (interactive) dom('p', 'business-guide', guide, block);
      for (const entry of model?.[key] || []) {
        const card = dom('article', 'business-card', undefined, block);
        card.dataset.kind = entry.kind;
        const heading = dom('div', 'business-card-heading', undefined, card);
        dom('strong', '', entry.title || (entry.kind === 'note' ? 'Note' : 'Text'), heading);
        if (interactive) {
          const edit = dom('button', 'business-action', 'Edit', heading);
          edit.type = 'button';
          edit.setAttribute('aria-label', 'Edit ' + (entry.title || entry.kind) + ' in ' + title);
          edit.onclick = () => editBusinessEntry(key, title, entry.kind, entry);
        }
        const content = dom('div', 'business-rich', undefined, card);
        // Imported cards and edited cards are both sanitized before entering the document.
        content.innerHTML = entry.html;
      }
      if (interactive) {
        const actions = dom('div', 'business-add', undefined, block);
        for (const [kind, label] of [['text', 'Text'], ['note', 'Note']]) {
          const add = dom('button', 'business-action', '＋ ' + label, actions);
          add.type = 'button';
          add.setAttribute('aria-label', 'Add ' + label.toLowerCase() + ' to ' + title);
          add.onclick = () => editBusinessEntry(key, title, kind);
        }
      }
    }
    const credit = dom('footer', 'business-credit', undefined, board);
    credit.innerHTML = BUSINESS_CREDIT;
    return board;
  }

  function renderBusinessCanvas() {
    const page = getPage();
    const wrap = $('businessCanvas');
    const visible = page.mode === 'business' && !diNoTabs();
    wrap.hidden = !visible;
    if (!visible) return;
    const offset = wrap.scrollTop;
    wrap.replaceChildren(businessBoard(page.businessCanvas, true));
    wrap.scrollTop = offset;
    const count = Object.values(page.businessCanvas || {}).flat().length;
    $('statusCounts').textContent = `9 blocks · ${count} ${count === 1 ? 'card' : 'cards'}`;
  }

  function validateBusinessCanvas(model) {
    const clean = {};
    for (const [key] of BUSINESS_BLOCKS) {
      const entries = model?.[key];
      if (entries === undefined) continue;
      if (!Array.isArray(entries) || entries.length > 50) throw Error('A Business Model Canvas block can have up to 50 cards.');
      const ids = new Set();
      clean[key] = entries.map(entry => {
        if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
            !['text', 'note'].includes(entry.kind) || typeof entry.title !== 'string' ||
            typeof entry.html !== 'string') throw Error('Invalid Business Model Canvas card.');
        ids.add(entry.id);
        return { id: entry.id, kind: entry.kind, title: entry.title.slice(0, 120), html: sanitizeMindNote(entry.html) };
      });
    }
    return clean;
  }

  function editBusinessEntry(key, blockTitle, kind, entry) {
    const page = getPage();
    const buttons = [
      { text: 'Cancel' },
      { text: 'Save card', primary: true, action: save },
    ];
    if (entry) buttons.unshift({ text: 'Delete card', action: () => {
      if (!window.confirm('Delete this card? You can undo this from the Edit menu.')) return false;
      transact(() => { page.businessCanvas[key] = page.businessCanvas[key].filter(card => card.id !== entry.id); });
    } });
    const body = modal(`${blockTitle} · ${kind === 'note' ? 'Note' : 'Text'}`, `
      <label class="business-field">Card title <input id="businessTitle" maxlength="120"></label>
      <div class="business-tools" role="toolbar" aria-label="Rich text tools">
        <button type="button" data-format="bold"><b>Bold</b></button>
        <button type="button" data-format="italic"><i>Italic</i></button>
        <button type="button" data-format="underline"><u>Underline</u></button>
        <button type="button" data-format="formatBlock" data-value="h3">Heading</button>
        <button type="button" data-format="formatBlock" data-value="p">Paragraph</button>
        <button type="button" data-format="insertUnorderedList">Bullets</button>
        <button type="button" data-format="insertOrderedList">Numbering</button>
        <button type="button" data-format="removeFormat">Clear style</button>
        <button type="button" id="businessTable">Insert table</button>
        <button type="button" id="businessRow">Add row</button>
        <button type="button" id="businessColumn">Add column</button>
        <button type="button" id="businessPicture">Insert picture</button>
      </div>
      <input type="file" id="businessImage" accept="image/jpeg,image/png,image/webp" hidden>
      <div id="businessEditor" class="business-rich business-edit" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Card content"></div>
      <p id="businessMessage" class="business-message" role="status"></p>`, buttons);
    const editor = body.querySelector('#businessEditor');
    const title = body.querySelector('#businessTitle');
    const message = body.querySelector('#businessMessage');
    const image = body.querySelector('#businessImage');
    title.value = entry?.title || '';
    editor.innerHTML = entry?.html || '';
    let savedRange = null;
    let pendingPicture = false;

    function save() {
      try {
        if (pendingPicture) throw Error('Wait for the picture to finish loading.');
        const html = sanitizeMindNote(editor.innerHTML);
        if (!title.value.trim() && !editor.textContent.trim() && !editor.querySelector('img,table')) {
          throw Error('Add a title or some content before saving.');
        }
        const cards = page.businessCanvas?.[key] || [];
        if (!entry && cards.length >= 50) throw Error('This block already has 50 cards.');
        const next = { id: entry?.id || uid(), kind, title: title.value.trim(), html };
        transact(() => {
          page.businessCanvas ||= {};
          page.businessCanvas[key] = entry ? cards.map(card => card.id === entry.id ? next : card) : [...cards, next];
        });
      } catch (error) {
        message.textContent = error.message;
        return false;
      }
    }

    function focusEditor() {
      editor.focus();
      const selection = window.getSelection();
      const range = savedRange && editor.contains(savedRange.commonAncestorContainer) ? savedRange : document.createRange();
      if (range !== savedRange) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function rememberSelection() {
      const selection = window.getSelection();
      if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    }

    function insert(html) {
      focusEditor();
      document.execCommand('insertHTML', false, html);
      rememberSelection();
    }

    async function insertPicture(file) {
      if (pendingPicture) return;
      pendingPicture = true;
      message.textContent = 'Preparing picture…';
      try {
        const src = await mindCompressImage(file);
        if (editor.isConnected) {
          insert(`<figure style="width:75%"><img src="${src}" alt="${esc(file.name)}"><figcaption>Caption</figcaption></figure><p><br></p>`);
          message.textContent = 'Picture inserted. You can edit its caption.';
        }
      } catch (error) {
        message.textContent = error.message;
      } finally {
        pendingPicture = false;
        image.value = '';
      }
    }

    editor.addEventListener('keyup', rememberSelection);
    editor.addEventListener('pointerup', rememberSelection);
    editor.addEventListener('input', rememberSelection);
    editor.addEventListener('paste', event => {
      event.preventDefault();
      rememberSelection();
      const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/'));
      if (file) { insertPicture(file); return; }
      try {
        const markup = event.clipboardData.getData('text/html');
        insert(markup ? sanitizeMindNote(markup) : esc(event.clipboardData.getData('text/plain')).replace(/\r?\n/g, '<br>'));
      } catch (error) { message.textContent = error.message; }
    });
    editor.addEventListener('drop', event => event.preventDefault());
    body.querySelectorAll('.business-tools button').forEach(button => {
      button.onmousedown = event => { rememberSelection(); event.preventDefault(); };
    });
    body.querySelectorAll('[data-format]').forEach(button => {
      button.onclick = () => {
        focusEditor();
        document.execCommand(button.dataset.format, false, button.dataset.value || null);
        rememberSelection();
      };
    });
    body.querySelector('#businessTable').onclick = () => {
      insert('<table><thead><tr><th><br></th><th><br></th></tr></thead><tbody><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>');
    };
    for (const [selector, column] of [['#businessRow', false], ['#businessColumn', true]]) {
      body.querySelector(selector).onclick = () => {
        focusEditor();
        const node = window.getSelection().anchorNode;
        const cell = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('td,th');
        if (!cell || !editor.contains(cell)) { message.textContent = 'Place the cursor in a table cell first.'; return; }
        const row = cell.parentElement;
        const table = cell.closest('table');
        if (column) {
          if (row.cells.length >= 12) { message.textContent = 'This table already has 12 columns.'; return; }
          for (const item of table.rows) {
            const next = document.createElement(item.parentElement.tagName === 'THEAD' ? 'th' : 'td');
            next.append(document.createElement('br'));
            item.insertBefore(next, item.cells[cell.cellIndex + 1] || null);
          }
        } else {
          if (table.rows.length >= 40) { message.textContent = 'This table already has 40 rows.'; return; }
          const next = document.createElement('tr');
          for (let index = 0; index < row.cells.length; index++) next.insertCell().append(document.createElement('br'));
          if (row.parentElement.tagName === 'THEAD') (table.tBodies[0] || table.createTBody()).prepend(next);
          else row.after(next);
        }
        message.textContent = '';
      };
    }
    body.querySelector('#businessPicture').onclick = () => image.click();
    image.onchange = () => { if (image.files[0]) insertPicture(image.files[0]); };
    title.focus();
  }

  function chooseBusinessEntry() {
    const options = BUSINESS_BLOCKS.map(([key, title]) => `<option value="${key}">${title}</option>`).join('');
    const body = modal('Add to Business Model Canvas', `<label class="business-field">Business model block <select>${options}</select></label><p class="modal-subtext">Both card types support formatted text, pictures and editable tables.</p>`, [{ text: 'Cancel' }]);
    for (const kind of ['text', 'note']) {
      const button = dom('button', 'business-action', 'Add ' + kind, body);
      button.type = 'button';
      button.onclick = () => {
        const [key, title] = BUSINESS_BLOCKS.find(([id]) => id === body.querySelector('select').value);
        closeModal();
        editBusinessEntry(key, title, kind);
      };
    }
  }

  return { businessBoard, renderBusinessCanvas, validateBusinessCanvas, chooseBusinessEntry };
}
