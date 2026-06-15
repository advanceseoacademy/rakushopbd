/**
 * Lightweight rich text editor for admin (Quill).
 * Syncs HTML into hidden/source textareas for existing save handlers.
 */
(function () {
  const editors = new Map();

  const PAGE_TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ];

  const PRODUCT_TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean'],
  ];

  const PAGE_EDITOR_IDS = [
    'legal-privacy-content',
    'legal-terms-content',
    'legal-return-content',
    'legal-preorder-content',
    'legal-points-content',
    'faq-answer',
  ];

  /** Keep HTML tables intact — no Quill mount */
  const PLAIN_HTML_EDITOR_IDS = ['legal-points-content'];

  const PRODUCT_EDITOR_IDS = ['pf-short-desc', 'pf-desc'];

  function quillReady() {
    return typeof window.Quill === 'function';
  }

  function mountEditor(textareaId, options) {
    if (PLAIN_HTML_EDITOR_IDS.includes(textareaId)) return null;
    if (editors.has(textareaId)) return editors.get(textareaId);
    const ta = document.getElementById(textareaId);
    if (!ta || !quillReady()) return null;

    const boxId = `${textareaId}-quill`;
    let box = document.getElementById(boxId);
    if (!box) {
      box = document.createElement('div');
      box.id = boxId;
      box.className = 'rich-editor-box rich-editor-box--product';
      ta.parentNode.insertBefore(box, ta);
    }

    ta.classList.add('rich-editor-source');
    ta.setAttribute('aria-hidden', 'true');
    ta.hidden = true;
    ta.style.display = 'none';

    const toolbar = options?.toolbar || PAGE_TOOLBAR;
    const quill = new Quill(`#${boxId}`, {
      theme: 'snow',
      modules: { toolbar },
      placeholder: options?.placeholder || ta.getAttribute('placeholder') || 'Write content…',
    });

    if (ta.value) {
      quill.root.innerHTML = ta.value;
    }

    quill.on('text-change', () => {
      ta.value = quill.root.innerHTML;
    });

    editors.set(textareaId, quill);
    return quill;
  }

  function syncEditor(textareaId) {
    const ta = document.getElementById(textareaId);
    const quill = editors.get(textareaId);
    if (ta && quill) ta.value = quill.root.innerHTML;
  }

  function initEditors(ids, options) {
    if (!quillReady()) return;
    ids.forEach((id) => {
      if (document.getElementById(id)) mountEditor(id, options);
    });
  }

  window.RakuRichEditor = {
    init(textareaId, options) {
      return mountEditor(textareaId, options);
    },

    initPageEditors() {
      initEditors(PAGE_EDITOR_IDS);
    },

    initProductEditors() {
      initEditors(PRODUCT_EDITOR_IDS, { toolbar: PRODUCT_TOOLBAR });
    },

    setContent(textareaId, html) {
      const ta = document.getElementById(textareaId);
      const value = html || '';
      if (ta) ta.value = value;
      if (PLAIN_HTML_EDITOR_IDS.includes(textareaId)) return;
      const quill = editors.get(textareaId) || mountEditor(textareaId, {
        toolbar: PRODUCT_EDITOR_IDS.includes(textareaId) ? PRODUCT_TOOLBAR : PAGE_TOOLBAR,
      });
      if (quill) quill.root.innerHTML = value;
    },

    getContent(textareaId) {
      syncEditor(textareaId);
      return document.getElementById(textareaId)?.value || '';
    },

    sync(textareaId) {
      syncEditor(textareaId);
    },

    syncAll() {
      [...PAGE_EDITOR_IDS, ...PRODUCT_EDITOR_IDS].forEach((id) => syncEditor(id));
    },

    syncProductEditors() {
      PRODUCT_EDITOR_IDS.forEach((id) => syncEditor(id));
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.RakuRichEditor.initPageEditors());
  } else {
    window.RakuRichEditor.initPageEditors();
  }
})();
