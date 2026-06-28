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

  const BLOG_EDITOR_IDS = ['blog-content'];

  const BLOG_TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ];

  /** Raw HTML textarea — no Quill (preserves <table class="legal-table"> etc.) */
  const PLAIN_HTML_EDITOR_IDS = ['legal-points-content'];

  function isPlainHtmlEditor(textareaId) {
    return PLAIN_HTML_EDITOR_IDS.includes(textareaId);
  }

  const PRODUCT_EDITOR_IDS = ['pf-short-desc', 'pf-desc'];

  function quillReady() {
    return typeof window.Quill === 'function';
  }

  function editorBoxClass(textareaId) {
    if (PRODUCT_EDITOR_IDS.includes(textareaId)) return 'rich-editor-box rich-editor-box--product';
    if (textareaId === 'blog-content') return 'rich-editor-box rich-editor-box--blog';
    return 'rich-editor-box';
  }

  function isBlogEditor(textareaId) {
    return BLOG_EDITOR_IDS.includes(textareaId);
  }

  function cleanupEditorDom(textareaId) {
    const ta = document.getElementById(textareaId);
    if (!ta?.parentNode) return;
    ta.parentNode.querySelectorAll(`#${textareaId}-quill, .rich-editor-box`).forEach((el) => {
      if (el !== ta) el.remove();
    });
  }

  function destroyEditor(textareaId) {
    editors.delete(textareaId);
    cleanupEditorDom(textareaId);
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    ta.classList.remove('rich-editor-source');
    ta.removeAttribute('aria-hidden');
    ta.hidden = false;
    ta.style.display = '';
  }

  function blogUploadFn() {
    return typeof window._rakuAdminUploadImage === 'function' ? window._rakuAdminUploadImage : null;
  }

  async function uploadBlogEditorImage(file) {
    const upload = blogUploadFn();
    if (!upload || !file?.type?.startsWith('image/')) return null;
    const data = await upload(file);
    return data?.ok ? data.url : null;
  }

  async function insertBlogImages(quill, files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    let index = quill.getSelection()?.index ?? quill.getLength();
    for (const file of images) {
      const url = await uploadBlogEditorImage(file);
      if (!url) continue;
      quill.insertEmbed(index, 'image', url, 'user');
      index += 1;
      quill.insertText(index, '\n', 'user');
      index += 1;
    }
    quill.setSelection(index, 0, 'user');
  }

  function lockBlogEditorScroll(quill) {
    const container = quill?.container;
    const editor = quill?.root;
    if (!container || !editor) return;
    const height = Math.min(Math.max(Math.round(window.innerHeight * 0.52), 280), 560);
    container.style.height = `${height}px`;
    container.style.maxHeight = `${height}px`;
    container.style.overflow = 'hidden';
    editor.style.minHeight = '0';
    editor.style.overflowY = 'auto';
    editor.style.overflowX = 'hidden';
  }

  function bindBlogEditorMedia(quill, box) {
    const toolbar = quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('image', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async () => {
          if (input.files?.length) await insertBlogImages(quill, input.files);
        };
        input.click();
      });
    }

    const onDragOver = (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      box?.classList.add('is-dragover');
    };
    const onDragLeave = (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      box?.classList.remove('is-dragover');
    };
    const onDrop = async (e) => {
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      box?.classList.remove('is-dragover');
      await insertBlogImages(quill, files);
    };
    const onPaste = async (e) => {
      const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'));
      if (!items.length) return;
      e.preventDefault();
      const files = items.map((i) => i.getAsFile()).filter(Boolean);
      await insertBlogImages(quill, files);
    };

    box?.addEventListener('dragover', onDragOver);
    box?.addEventListener('dragleave', onDragLeave);
    box?.addEventListener('drop', onDrop);
    quill.root.addEventListener('paste', onPaste);
  }

  function mountEditor(textareaId, options) {
    if (isPlainHtmlEditor(textareaId)) return null;
    if (editors.has(textareaId)) {
      const box = document.getElementById(`${textareaId}-quill`);
      if (box) box.className = editorBoxClass(textareaId);
      return editors.get(textareaId);
    }
    const ta = document.getElementById(textareaId);
    if (!ta || !quillReady()) return null;

    cleanupEditorDom(textareaId);

    const boxId = `${textareaId}-quill`;
    const box = document.createElement('div');
    box.id = boxId;
    box.className = editorBoxClass(textareaId);
    ta.parentNode.insertBefore(box, ta);

    ta.classList.add('rich-editor-source');
    ta.setAttribute('aria-hidden', 'true');
    ta.hidden = true;
    ta.style.display = 'none';

    const toolbar = isBlogEditor(textareaId)
      ? BLOG_TOOLBAR
      : options?.toolbar || PAGE_TOOLBAR;
    const quill = new Quill(`#${boxId}`, {
      theme: 'snow',
      modules: { toolbar },
      placeholder: options?.placeholder || ta.getAttribute('placeholder') || 'Write content…',
    });

    if (isBlogEditor(textareaId)) {
      bindBlogEditorMedia(quill, box);
      lockBlogEditorScroll(quill);
      if (!window._rakuBlogEditorResizeBound) {
        window._rakuBlogEditorResizeBound = true;
        window.addEventListener('resize', () => {
          BLOG_EDITOR_IDS.forEach((id) => {
            const q = editors.get(id);
            if (q) lockBlogEditorScroll(q);
          });
        });
      }
    }

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

    destroy(textareaId) {
      destroyEditor(textareaId);
    },

    initBlogEditor() {
      initEditors(BLOG_EDITOR_IDS, { toolbar: BLOG_TOOLBAR });
    },

    initPageEditors() {
      initEditors(PAGE_EDITOR_IDS);
    },

    initProductEditors() {
      if (!quillReady()) return;
      PRODUCT_EDITOR_IDS.forEach((id) => destroyEditor(id));
      initEditors(PRODUCT_EDITOR_IDS, { toolbar: PRODUCT_TOOLBAR });
    },

    setContent(textareaId, html) {
      const ta = document.getElementById(textareaId);
      const value = html || '';
      if (ta) ta.value = value;
      if (isPlainHtmlEditor(textareaId)) return;
      if (isBlogEditor(textareaId) && !editors.has(textareaId)) return;
      const quill = editors.get(textareaId) || mountEditor(textareaId, {
        toolbar: isBlogEditor(textareaId)
          ? BLOG_TOOLBAR
          : PRODUCT_EDITOR_IDS.includes(textareaId)
            ? PRODUCT_TOOLBAR
            : PAGE_TOOLBAR,
      });
      if (quill) quill.root.innerHTML = value;
    },

    getContent(textareaId) {
      syncEditor(textareaId);
      let value = document.getElementById(textareaId)?.value || '';
      if (PRODUCT_EDITOR_IDS.includes(textareaId) && window._rakuNormalizeProductDescriptionHtml) {
        value = window._rakuNormalizeProductDescriptionHtml(value);
      }
      return value;
    },

    sync(textareaId) {
      syncEditor(textareaId);
    },

    syncAll() {
      [...PAGE_EDITOR_IDS, ...BLOG_EDITOR_IDS, ...PRODUCT_EDITOR_IDS]
        .filter((id) => !isPlainHtmlEditor(id))
        .forEach((id) => syncEditor(id));
    },

    isPlainHtmlEditor,
    plainHtmlEditorIds: PLAIN_HTML_EDITOR_IDS,

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
