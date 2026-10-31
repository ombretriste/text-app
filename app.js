'use strict';

// Versión de la app (se ve en la pantalla de inicio). Arreglos y ajustes: 0.1.x; novedades: 0.x.0.
const APP_VERSION = '0.2.0';
// Uso de la app en Vercel Analytics: es una sola página, así que cada función se cuenta como una
// página virtual. Solo se envía el nombre de la función, nunca el contenido de los documentos.
const track = (path) => { try { window.va?.('pageview', { path }); } catch (_) { /* sin analítica */ } };
const trackLabel = (label) => track(`/${label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
const DISPLAY_KEY = 'text:display';
const INSTALL_HINT_KEY = 'text:installHint';
const SAVE_DELAY_MS = 500;
const CLOUD_DELAY_MS = 5000;
const IMAGE_MAX_PX = 1600;

const ICONS = {
  undo: '<path d="M8.5 7.5L4.5 11.5l4 4"/><path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-2.5"/>',
  redo: '<path d="M15.5 7.5l4 4-4 4"/><path d="M19.5 11.5H9a4.5 4.5 0 0 0 0 9h2.5"/>',
  left: '<path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10"/>',
  center: '<path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10"/>',
  right: '<path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10"/>',
  justify: '<path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h16"/>',
  ul: '<circle cx="5" cy="7" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="17" r="1" fill="currentColor"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/>',
  ol: '<path d="M4 5.5l1.5-1v5M9.5 7H20M9.5 12H20M9.5 17H20M3.8 14.5c.4-.8 2.7-.8 2.7.6 0 1.1-2.7 2-2.7 3.4h2.9"/>',
  quote: '<path d="M6 7v10M10.5 8H20M10.5 12H20M10.5 16H16"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M20.5 15.5L16 11l-7.5 8"/>',
  table: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 9.7h17M3.5 14.3h17M9.2 5v14M14.8 5v14"/>',
  hr: '<path d="M3.5 12h17"/><path d="M8 7h8M8 17h8" opacity=".45"/>',
  clear: '<path d="M6 5.5h12M12 5.5l-3 13M7 18.5h5"/><path d="M15 14l5 5M20 14l-5 5"/>',
  doc: '<path d="M7 3.5h7l4.5 4.5v12.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cloud: '<path d="M7 18.5h9.5a4 4 0 0 0 .8-7.9 5.8 5.8 0 0 0-11.1-1.5A4.8 4.8 0 0 0 7 18.5z"/>',
  open: '<path d="M3.5 18V7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h6.5A1.5 1.5 0 0 1 19 9.5V11"/><path d="M3.5 18l2.5-7h15l-2.5 7.5h-14z"/>',
  print: '<path d="M7 8.5v-5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  save: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5"/><path d="M4.5 16v2.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  more: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6A2 2 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  caret: '<path d="M7 10l5 5 5-5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
};
const icon = (name, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Logo de TextCTRL: anillo fino, anillo discontinuo, arco y una T con el cursor de escritura
let logoCount = 0;
function logoSVG(size) {
  const id = `txt-g${logoCount++}`;
  return `
    <svg class="logo-mark" viewBox="0 0 120 120" width="${size}" height="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#4f46e5"/><stop offset=".55" stop-color="#818cf8"/><stop offset="1" stop-color="#c7d2fe"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" stroke="url(#${id})" stroke-width="1.2" opacity=".55"/>
      <circle cx="60" cy="60" r="42" stroke="url(#${id})" stroke-width=".8" stroke-dasharray="2 5" opacity=".6"/>
      <path class="logo-arc" pathLength="1" d="M60 8 A52 52 0 1 1 14.97 86" stroke="url(#${id})" stroke-width="3"/>
      <circle class="logo-dot" cx="14.97" cy="86" r="3" fill="#c7d2fe" stroke="none"/>
      <path d="M34 47v-7h40v7M54 40v40M46 80h16" stroke="url(#${id})" stroke-width="2"/>
      <path d="M84 40v40M79 38c2 0 4 .6 5 2 1-1.4 3-2 5-2M79 82c2 0 4-.6 5-2 1 1.4 3 2 5 2" stroke="url(#${id})" stroke-width="1.5"/>
    </svg>`;
}
document.querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = logoSVG(Number(el.dataset.logo)); });
document.getElementById('app-version').textContent = `Versión ${APP_VERSION}`;

// ---------- Utilidades ----------

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (_) { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* sin almacenamiento */ } };
const isTouch = matchMedia('(pointer: coarse)').matches;
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fmtDate = (t) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------- Documentos: se guardan en este dispositivo (IndexedDB, caben con imágenes) ----------

let dbPromise = null;
function db() {
  dbPromise = dbPromise || new Promise((resolve, reject) => {
    const req = indexedDB.open('textctrl', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('docs', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function store(mode, fn) {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('docs', mode);
    const req = fn(tx.objectStore('docs'));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const allDocs = () => store('readonly', (s) => s.getAll());
const getDoc = (id) => store('readonly', (s) => s.get(id));
const putDoc = (doc) => store('readwrite', (s) => s.put(doc));
const deleteDoc = (id) => store('readwrite', (s) => s.delete(id));

const htmlText = (html) => new DOMParser().parseFromString(html.replace(/<\/(p|h[1-3]|li|td|th|blockquote)>|<br>/g, ' $&'), 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
const docName = (doc) => doc.title.trim() || htmlText(doc.html).slice(0, 60) || 'Sin título';

// ---------- Nube (CloudCTRL): opcional; el cliente está en cloud.js ----------

const cloudAdapter = {
  kind: 'text',
  list: async () => (await allDocs()).map((d) => ({ id: d.id, upd: d.upd })),
  read: async (id) => {
    const d = await getDoc(id);
    return { name: docName(d), payload: { title: d.title, html: d.html, created: d.created } };
  },
  write: (id, name, p, upd) => putDoc({ id, title: p.title, html: p.html, created: p.created, upd }),
  remove: deleteDoc,
  fork: async (id) => {
    const d = await getDoc(id);
    await putDoc({ ...d, id: newId(), title: `${docName(d)} (otra versión)`, upd: Date.now() });
  },
  busy: (id) => current?.id === id,
  done: (s) => {
    if (s.forked) toast('Había dos versiones de un documento: se han guardado las dos', { warn: true });
    if (s.tooLarge) toast('Un documento es demasiado grande para la nube', { warn: true });
    if (current) return;
    if (s.down || s.removed || s.forked) renderHome();
    else updateCloudNote();
  },
};
function cloudNoteText() {
  if (!Cloud.account) return 'Tus documentos se guardan solo en este dispositivo.';
  if (Cloud.status.state === 'error') return `${Cloud.status.error} Tus documentos siguen en este dispositivo.`;
  return 'Tus documentos se guardan aquí y en tu nube, cifrados.';
}
function updateCloudNote() {
  if ($('cloud-note')) $('cloud-note').textContent = cloudNoteText();
}
function openCloudSheet() {
  Cloud.accountSheet(newSheet(true), {
    title: 'documentos', close: closeSheet, adapter: cloudAdapter, esc,
    onChange: () => { if (!current) renderHome(); },
  });
}

// ---------- Lista de documentos ----------

const view = $('view');
let current = null; // documento abierto
let filter = '';

async function renderHome() {
  current = null;
  document.body.classList.remove('editing');
  $('brand').hidden = false;
  for (const id of ['back-btn', 'doc-title', 'save-btn']) $(id).hidden = true;
  let docs = [];
  try { docs = await allDocs(); } catch (_) { toast('Este navegador no permite guardar documentos', { warn: true }); }
  docs.sort((a, b) => b.upd - a.upd);
  view.innerHTML = `
    <section class="home-hero">
      <h1>Escribe, sin más</h1>
      <p>Un editor sencillo que guarda en PDF, Word, HTML, Markdown o texto.</p>
    </section>
    <div class="home-actions">
      <button class="primary-btn" id="new-doc" type="button">${icon('plus', 20)} Nuevo</button>
      <button class="ghost-big" id="open-file" type="button">${icon('open', 20)} Abrir archivo</button>
    </div>
    ${docs.length > 5 ? `<input class="search" id="search" type="search" placeholder="Buscar documentos" aria-label="Buscar documentos" value="${esc(filter)}" />` : ''}
    <section class="doc-list" id="doc-list"></section>
    <p class="home-note" id="cloud-note">${cloudNoteText()}</p>`;
  $('new-doc').addEventListener('click', () => { track('/nuevo'); createDoc(); });
  $('open-file').addEventListener('click', () => $('file-open').click());
  const draw = () => {
    const q = filter.toLowerCase();
    const list = docs.filter((d) => !q || docName(d).toLowerCase().includes(q) || htmlText(d.html).toLowerCase().includes(q));
    $('doc-list').innerHTML = list.map((d) => `
      <div class="card doc-row">
        <button class="doc-open" type="button" data-open="${d.id}">
          ${icon('doc', 22)}
          <span><b>${esc(docName(d))}</b><small>${fmtDate(d.upd)}${d.title.trim() && htmlText(d.html) ? ` · ${esc(htmlText(d.html).slice(0, 70))}` : ''}</small></span>
        </button>
        <button class="doc-more" type="button" data-more="${d.id}" aria-label="Más opciones de ${esc(docName(d))}">${icon('more', 18)}</button>
      </div>`).join('');
    $('doc-list').querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => openDoc(await getDoc(b.dataset.open))));
    $('doc-list').querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const doc = docs.find((d) => d.id === b.dataset.more);
      showPop(b, [
        { label: 'Duplicar', icon: 'copy', run: () => duplicateDoc(doc) },
        { label: 'Eliminar', icon: 'trash', run: () => confirmDelete(doc) },
      ]);
    }));
  };
  draw();
  $('search')?.addEventListener('input', (e) => { filter = e.target.value; draw(); });
}

async function createDoc(title = '', html = '<p><br></p>') {
  const now = Date.now();
  const doc = { id: newId(), title, html, created: now, upd: now };
  try { await putDoc(doc); } catch (_) { toast('No se ha podido crear el documento', { warn: true }); return; }
  openDoc(doc);
}
async function duplicateDoc(doc) {
  const now = Date.now();
  await putDoc({ ...doc, id: newId(), title: `${docName(doc)} (copia)`, created: now, upd: now });
  renderHome();
}
function confirmDelete(doc) {
  const back = newSheet(true);
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Eliminar documento">
      <h2 class="sheet-title">¿Eliminar «${esc(docName(doc))}»?</h2>
      <p class="small muted">${Cloud.account ? 'Se quita de todos tus dispositivos. Podrás recuperarlo durante 30 días desde la papelera de CloudCTRL.' : 'No se puede deshacer.'}</p>
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-close>Cancelar</button>
        <button class="danger-btn" type="button" id="del-ok">Eliminar</button>
      </div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
  back.querySelector('#del-ok').addEventListener('click', async () => {
    await deleteDoc(doc.id);
    Cloud.forget('text', doc.id);
    closeSheet();
    renderHome();
    Cloud.schedule(cloudAdapter, 0);
  });
}

$('file-open').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  track('/abrir-archivo');
  try {
    const html = await importFile(file);
    await createDoc(file.name.replace(/\.[^.]+$/, ''), html || '<p><br></p>');
  } catch (_) {
    toast('No se puede abrir ese archivo. Formatos: docx, txt, md y html', { warn: true });
  }
});

// ---------- Editor ----------
// Se apoya en contenteditable y execCommand: así deshacer funciona solo y no hacen falta librerías.

let saveTimer = 0;
let lastRange = null;
let selectedImg = null;

const TEXT_COLORS = ['#000000', '#555555', '#c0262d', '#d97706', '#15803d', '#0e7490', '#1d4ed8', '#4f46e5', '#a21caf', '#be185d'];
const MARK_COLORS = ['', '#fef08a', '#bbf7d0', '#a5f3fc', '#c7d2fe', '#fbcfe8', '#fed7aa', '#fecaca', '#e5e7eb', '#d9f99d'];
const STYLES = [['p', 'Normal'], ['h1', 'Título 1'], ['h2', 'Título 2'], ['h3', 'Título 3']];
const FONTS = [['Arial', 'Arial'], ['Times New Roman', 'Times'], ['Courier New', 'Courier']];
const SIZES = [[1, 8], [2, 10], [3, 11], [4, 12], [5, 14], [6, 18], [7, 24]];
const ALIGNS = [['justifyLeft', 'left', 'Izquierda'], ['justifyCenter', 'center', 'Centrado'], ['justifyRight', 'right', 'Derecha'], ['justifyFull', 'justify', 'Justificado']];

const toolBtn = (id, content, label, cls = '') => `<button class="tool ${cls}" type="button" data-tool="${id}" aria-label="${label}" title="${label}">${content}</button>`;
const sep = '<span class="tool-sep"></span>';

function openDoc(doc) {
  if (!doc) return;
  current = doc;
  document.body.classList.add('editing');
  $('brand').hidden = true;
  for (const id of ['back-btn', 'doc-title', 'save-btn']) $(id).hidden = false;
  $('doc-title').value = doc.title;
  view.innerHTML = `
    <div class="ed-tools" id="tools" role="toolbar" aria-label="Formato">
      ${toolBtn('undo', icon('undo', 20), 'Deshacer')}${toolBtn('redo', icon('redo', 20), 'Rehacer')}${sep}
      ${toolBtn('style', `<span id="t-style">Normal</span>${icon('caret', 14)}`, 'Estilo de párrafo', 'tool-wide')}
      ${toolBtn('font', `<span id="t-font">Arial</span>${icon('caret', 14)}`, 'Tipo de letra', 'tool-mid')}
      ${toolBtn('size', `<span id="t-size">11</span>${icon('caret', 14)}`, 'Tamaño de letra', 'tool-mid')}${sep}
      ${toolBtn('bold', '<b style="font-size:16px">N</b>', 'Negrita')}
      ${toolBtn('italic', '<i style="font-size:16px;font-family:Georgia,serif">K</i>', 'Cursiva')}
      ${toolBtn('underline', '<u style="font-size:16px">S</u>', 'Subrayado')}
      ${toolBtn('strikeThrough', '<s style="font-size:16px">T</s>', 'Tachado')}
      ${toolBtn('color', '<span class="tool-stack"><span style="font-size:15px;font-weight:600">A</span><span class="mark" id="t-color" style="background:#c0262d"></span></span>', 'Color del texto')}
      ${toolBtn('mark', '<span class="tool-stack"><span style="font-size:15px;font-weight:600">ab</span><span class="mark" style="background:#fef08a"></span></span>', 'Resaltar')}${sep}
      ${toolBtn('align', `<span id="t-align">${icon('left', 20)}</span>`, 'Alineación')}
      ${toolBtn('insertUnorderedList', icon('ul', 20), 'Lista con viñetas')}
      ${toolBtn('insertOrderedList', icon('ol', 20), 'Lista numerada')}
      ${toolBtn('quote', icon('quote', 20), 'Cita')}${sep}
      ${toolBtn('link', icon('link', 20), 'Enlace')}
      ${toolBtn('image', icon('image', 20), 'Imagen')}
      ${toolBtn('table', icon('table', 20), 'Tabla')}
      ${toolBtn('insertHorizontalRule', icon('hr', 20), 'Línea separadora')}
      ${toolBtn('clear', icon('clear', 20), 'Quitar formato')}
    </div>
    <div class="find-bar" id="find" hidden>
      <input id="find-q" placeholder="Buscar" aria-label="Buscar" autocomplete="off" />
      <input id="find-r" placeholder="Reemplazar por" aria-label="Reemplazar por" autocomplete="off" />
      <small id="find-n"></small>
      <button type="button" id="find-next">Siguiente</button>
      <button type="button" id="find-all">Reemplazar todo</button>
      <button type="button" id="find-close" aria-label="Cerrar">×</button>
    </div>
    <div class="paper-wrap"><article class="paper" id="ed" contenteditable="true" spellcheck="true" lang="es" role="textbox" aria-multiline="true" aria-label="Documento"></article></div>
    <footer class="ed-foot"><span id="stats"></span><span id="state">Guardado</span></footer>`;
  const ed = $('ed');
  ed.innerHTML = sanitize(doc.html) || '<p><br></p>';
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) { /* opcional */ }
  ed.addEventListener('input', changed);
  ed.addEventListener('paste', onPaste);
  ed.addEventListener('drop', onDrop);
  ed.addEventListener('click', onEditorClick);
  ed.addEventListener('keydown', onEditorKey);
  const tools = $('tools');
  tools.addEventListener('mousedown', (e) => e.preventDefault()); // conserva el cursor en el texto
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) { e.stopPropagation(); runTool(b.dataset.tool, b); }
  });
  $('find-next').addEventListener('click', findNext);
  $('find-q').addEventListener('input', () => { findIdx = -1; $('find-n').textContent = ''; });
  $('find-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(); } });
  $('find-all').addEventListener('click', replaceAll);
  $('find-close').addEventListener('click', () => { $('find').hidden = true; ed.focus(); });
  updateStats();
  syncTools();
  if (!htmlText(doc.html) && !doc.html.includes('<img') && !isTouch) ed.focus();
}

function markDirty() {
  if (!current) return;
  $('state').textContent = 'Guardando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
}
async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const ed = $('ed');
  if (!current || !ed) return;
  ed.querySelector('img.sel')?.classList.remove('sel');
  selectedImg = null;
  if (current.html === ed.innerHTML && current.title === $('doc-title').value) {
    if ($('state')) $('state').textContent = 'Guardado';
    return;
  }
  current.html = ed.innerHTML;
  current.title = $('doc-title').value;
  current.upd = Date.now();
  try {
    await putDoc(current);
    if ($('state')) $('state').textContent = 'Guardado';
    Cloud.schedule(cloudAdapter, CLOUD_DELAY_MS);
  } catch (_) {
    if ($('state')) $('state').textContent = 'Sin guardar';
    toast('No se ha podido guardar: quizá no queda espacio en el dispositivo', { warn: true });
  }
}
function changed() {
  markDirty();
  updateStats();
  syncTools();
}
function updateStats() {
  const ed = $('ed');
  if (!ed) return;
  const text = ed.innerText.replace(/ /g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  ed.classList.toggle('empty', !text && !ed.querySelector('img,table,hr,ul,ol,blockquote,h1,h2,h3'));
  $('stats').textContent = `${words.toLocaleString('es-ES')} ${words === 1 ? 'palabra' : 'palabras'} · ${text.length.toLocaleString('es-ES')} caracteres`;
}

// Selección: se recuerda para que hojas y desplegables puedan volver a ella
const inEditor = (node) => { const ed = $('ed'); return !!ed && !!node && ed.contains(node); };
function restoreSel() {
  const ed = $('ed');
  const sel = getSelection();
  if (document.activeElement !== ed) ed.focus({ preventScroll: true });
  if (lastRange && inEditor(lastRange.commonAncestorContainer) && !(sel.rangeCount && inEditor(sel.anchorNode) && !sel.isCollapsed)) {
    sel.removeAllRanges();
    sel.addRange(lastRange);
  }
}
document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (!$('ed') || !sel.rangeCount || !inEditor(sel.anchorNode)) return;
  lastRange = sel.getRangeAt(0).cloneRange();
  syncTools();
});
function exec(cmd, value = null, css = false) {
  restoreSel();
  document.execCommand('styleWithCSS', false, css);
  document.execCommand(cmd, false, value);
  changed();
}
const currentBlock = () => {
  let n = lastRange?.startContainer;
  const ed = $('ed');
  while (n && n !== ed && !(n.nodeType === 1 && /^(P|H[1-3]|BLOCKQUOTE|LI|DIV|TD|TH)$/.test(n.tagName))) n = n.parentNode;
  return n && n !== ed ? n : null;
};
function syncTools() {
  if (!$('tools')) return;
  for (const c of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']) {
    let state = false;
    try { state = document.queryCommandState(c); } catch (_) { /* sin estado */ }
    $('tools').querySelector(`[data-tool="${c}"]`).classList.toggle('on', state);
  }
  const block = currentBlock();
  const tag = block?.tagName.toLowerCase();
  $('t-style').textContent = (STYLES.find(([k]) => k === tag) || STYLES[0])[1];
  $('tools').querySelector('[data-tool="quote"]').classList.toggle('on', !!block?.closest('blockquote'));
  const start = lastRange?.startContainer;
  const el = start?.nodeType === 3 ? start.parentElement : start;
  const size = el?.closest?.('font[size]')?.getAttribute('size');
  const fallback = { h1: 22, h2: 16, h3: 13 }[tag] || 11;
  $('t-size').textContent = SIZES.find(([k]) => String(k) === size)?.[1] ?? fallback;
  const face = el?.closest?.('font[face]')?.getAttribute('face') || '';
  $('t-font').textContent = FONTS.find(([k]) => k === face)?.[1] || 'Arial';
  const a = block?.style?.textAlign || 'left';
  $('t-align').innerHTML = icon(['left', 'center', 'right', 'justify'].includes(a) ? a : 'left', 20);
}

function runTool(id, btn) {
  closePop();
  switch (id) {
    case 'undo': case 'redo': case 'bold': case 'italic': case 'underline': case 'strikeThrough':
    case 'insertUnorderedList': case 'insertOrderedList': case 'insertHorizontalRule':
      exec(id);
      break;
    case 'style':
      showPop(btn, STYLES.map(([k, label]) => ({ label, html: `<span style="${{ h1: 'font-size:20px;font-weight:700', h2: 'font-size:17px;font-weight:700', h3: 'font-size:15px;font-weight:700' }[k] || ''}">${label}</span>`, on: $('t-style').textContent === label, run: () => exec('formatBlock', k) })));
      break;
    case 'font':
      showPop(btn, FONTS.map(([k, label]) => ({ label, html: `<span style="font-family:'${k}'">${label}</span>`, on: $('t-font').textContent === label, run: () => exec('fontName', k) })));
      break;
    case 'size':
      showPop(btn, SIZES.map(([k, pt]) => ({ label: String(pt), on: $('t-size').textContent === String(pt), run: () => exec('fontSize', String(k)) })));
      break;
    case 'color':
      showSwatches(btn, TEXT_COLORS, (c) => { exec('foreColor', c); $('t-color').style.background = c; });
      break;
    case 'mark':
      showSwatches(btn, MARK_COLORS, (c) => exec('hiliteColor', c || 'transparent', true));
      break;
    case 'align':
      showPop(btn, ALIGNS.map(([cmd, ic, label]) => ({ label, icon: ic, run: () => exec(cmd) })));
      break;
    case 'quote':
      exec('formatBlock', currentBlock()?.closest('blockquote') ? 'p' : 'blockquote');
      break;
    case 'clear':
      exec('removeFormat');
      if (currentBlock()?.closest('h1,h2,h3,blockquote')) exec('formatBlock', 'p');
      break;
    case 'link':
      openLinkSheet();
      break;
    case 'image':
      $('file-image').click();
      break;
    case 'table':
      if (currentBlock()?.closest('table')) showTableTools(btn);
      else openTableSheet();
      break;
    default:
  }
}

// ---------- Desplegables ----------

function placePop(anchor) {
  const pop = $('pop');
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  pop.style.top = `${r.bottom + h + 12 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6}px`;
}
function showPop(anchor, items) {
  const pop = $('pop');
  pop.innerHTML = items.map((it, i) =>
    `<button class="pop-item ${it.on ? 'on' : ''}" type="button" data-i="${i}">${it.icon ? icon(it.icon, 18) : ''}${it.html || esc(it.label)}</button>`).join('');
  pop.querySelectorAll('.pop-item').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    closePop();
    items[b.dataset.i].run();
  }));
  placePop(anchor);
}
function showSwatches(anchor, colors, run) {
  const pop = $('pop');
  pop.innerHTML = `<div class="swatches">${colors.map((c) =>
    `<button class="swatch" type="button" data-c="${c}" aria-label="${c ? `Color ${c}` : 'Sin color'}" ${c ? `style="background:${c}"` : ''}>${c ? '' : '×'}</button>`).join('')}</div>`;
  pop.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    closePop();
    run(b.dataset.c);
  }));
  placePop(anchor);
}
function closePop() { $('pop').hidden = true; }
$('pop').addEventListener('mousedown', (e) => e.preventDefault());
document.addEventListener('click', (e) => { if (!e.target.closest('#pop')) closePop(); });

// ---------- Enlaces, imágenes y tablas ----------

function openLinkSheet() {
  const sel = lastRange && !lastRange.collapsed ? lastRange.toString() : '';
  const back = newSheet();
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Enlace">
      <h2 class="sheet-title">Enlace</h2>
      <label class="field"><span>Dirección</span><input id="link-url" type="url" inputmode="url" autocapitalize="none" autocorrect="off" placeholder="https://" /></label>
      ${sel ? '' : '<label class="field"><span>Texto</span><input id="link-text" placeholder="Texto que se verá" /></label>'}
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-close>Cancelar</button>
        <button class="done-btn" type="button" id="link-ok">Insertar</button>
      </div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
  $('link-url').focus();
  back.querySelector('#link-ok').addEventListener('click', () => {
    let url = $('link-url').value.trim();
    if (!url) return;
    if (!/^[a-z]+:/i.test(url)) url = url.includes('@') ? `mailto:${url}` : `https://${url}`;
    if (!/^(https?:|mailto:)/i.test(url)) { toast('Esa dirección no es válida', { warn: true }); return; }
    const text = $('link-text')?.value.trim();
    closeSheet();
    if (sel) exec('createLink', url);
    else exec('insertHTML', `<a href="${esc(url)}">${esc(text || url)}</a>&nbsp;`);
  });
}

// Reduce la imagen: el documento vive en este dispositivo y va entero en cada guardado
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = async () => {
      try {
        const img = await loadImage(reader.result);
        const k = Math.min(1, IMAGE_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
        if (k === 1 && file.size < 400000 && /png|jpeg/.test(file.type)) { resolve(reader.result); return; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * k);
        canvas.height = Math.round(img.naturalHeight * k);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) { reject(e); }
    };
    reader.readAsDataURL(file);
  });
}
async function insertImage(file) {
  try {
    exec('insertImage', await shrinkImage(file));
  } catch (_) {
    toast('No se puede usar esa imagen', { warn: true });
  }
}
$('file-image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) insertImage(file);
});

function onEditorClick(e) {
  const ed = $('ed');
  ed.querySelector('img.sel')?.classList.remove('sel');
  selectedImg = null;
  const img = e.target.closest('img');
  if (img) {
    e.stopPropagation();
    selectedImg = img;
    img.classList.add('sel');
    showPop(img, [
      ...[25, 50, 75, 100].map((pct) => ({ label: `${pct} %`, run: () => { img.style.width = `${pct}%`; img.classList.remove('sel'); changed(); } })),
      { label: 'Quitar imagen', icon: 'trash', run: () => { img.remove(); changed(); } },
    ]);
    return;
  }
  const a = e.target.closest('a');
  if (a) {
    e.preventDefault();
    e.stopPropagation();
    const range = document.createRange();
    range.selectNodeContents(a);
    lastRange = range;
    showPop(a, [
      { label: 'Abrir enlace', icon: 'link', run: () => window.open(a.href, '_blank', 'noopener') },
      { label: 'Quitar enlace', icon: 'clear', run: () => { getSelection().removeAllRanges(); getSelection().addRange(range); exec('unlink'); } },
    ]);
  }
}

function openTableSheet() {
  const back = newSheet();
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Insertar tabla">
      <h2 class="sheet-title">Insertar tabla</h2>
      <label class="field"><span>Filas</span><input id="t-rows" type="number" inputmode="numeric" min="1" max="30" value="3" /></label>
      <label class="field"><span>Columnas</span><input id="t-cols" type="number" inputmode="numeric" min="1" max="8" value="3" /></label>
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-close>Cancelar</button>
        <button class="done-btn" type="button" id="t-ok">Insertar</button>
      </div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
  back.querySelector('#t-ok').addEventListener('click', () => {
    const clamp = (v, max) => Math.min(max, Math.max(1, Number(v) || 1));
    const rows = clamp($('t-rows').value, 30);
    const cols = clamp($('t-cols').value, 8);
    closeSheet();
    const row = `<tr>${'<td><br></td>'.repeat(cols)}</tr>`;
    exec('insertHTML', `<table><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`);
  });
}
function showTableTools(btn) {
  const td = currentBlock()?.closest('td,th') || lastRange?.startContainer.parentElement?.closest('td,th');
  if (!td) return;
  const tr = td.parentElement;
  const table = tr.closest('table');
  const cell = () => { const c = document.createElement('td'); c.innerHTML = '<br>'; return c; };
  const col = td.cellIndex;
  showPop(btn, [
    { label: 'Añadir fila', run: () => { const r = document.createElement('tr'); for (let i = 0; i < tr.cells.length; i += 1) r.append(cell()); tr.after(r); changed(); } },
    { label: 'Añadir columna', run: () => { for (const r of table.rows) r.cells[col]?.after(cell()); changed(); } },
    { label: 'Quitar fila', run: () => { if (table.rows.length > 1) tr.remove(); else table.remove(); changed(); } },
    { label: 'Quitar columna', run: () => { if (tr.cells.length > 1) for (const r of [...table.rows]) r.cells[col]?.remove(); else table.remove(); changed(); } },
    { label: 'Quitar tabla', icon: 'trash', run: () => { table.remove(); changed(); } },
  ]);
}

function onPaste(e) {
  const data = e.clipboardData;
  const file = [...(data?.files || [])].find((f) => f.type.startsWith('image/'));
  const html = data?.getData('text/html');
  if (file && !html) { e.preventDefault(); insertImage(file); return; }
  if (!html) return; // el texto plano lo pega el navegador
  e.preventDefault();
  exec('insertHTML', sanitize(html.replace(/<!--[\s\S]*?-->/g, '')));
}
function onDrop(e) {
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  insertImage(file);
}
function onEditorKey(e) {
  if (e.key === 'Tab' && !e.shiftKey && !currentBlock()?.closest('li')) {
    e.preventDefault();
    exec('insertText', '    ');
  } else if (e.key === 'Tab') {
    e.preventDefault();
    exec(e.shiftKey ? 'outdent' : 'indent');
  }
}
document.addEventListener('keydown', (e) => {
  if (!current || !(e.metaKey || e.ctrlKey)) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); openExportSheet(); }
  if (k === 'f') { e.preventDefault(); openFind(); }
  if (k === 'p') { e.preventDefault(); printDoc(); }
});

// ---------- Buscar y reemplazar ----------

let findIdx = -1;
function findMatches(q) {
  const out = [];
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker($('ed'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const hay = node.nodeValue.toLowerCase();
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) out.push({ node, i });
  }
  return out;
}
const matchRange = (m, len) => {
  const r = document.createRange();
  r.setStart(m.node, m.i);
  r.setEnd(m.node, m.i + len);
  return r;
};
function openFind() {
  $('find').hidden = false;
  const sel = lastRange && !lastRange.collapsed ? lastRange.toString() : '';
  if (sel && sel.length < 80) $('find-q').value = sel;
  $('find-q').focus();
  $('find-q').select();
}
function findNext() {
  const q = $('find-q').value;
  if (!q) return;
  const list = findMatches(q);
  if (!list.length) { $('find-n').textContent = 'Sin resultados'; return; }
  findIdx = (findIdx + 1) % list.length;
  $('find-n').textContent = `${findIdx + 1} de ${list.length}`;
  const range = matchRange(list[findIdx], q.length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  list[findIdx].node.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function replaceAll() {
  const q = $('find-q').value;
  if (!q) return;
  const list = findMatches(q).reverse(); // de atrás adelante: las posiciones anteriores no cambian
  const sel = getSelection();
  $('ed').focus({ preventScroll: true });
  for (const m of list) {
    sel.removeAllRanges();
    sel.addRange(matchRange(m, q.length));
    document.execCommand('insertText', false, $('find-r').value);
  }
  $('find-n').textContent = `${list.length} ${list.length === 1 ? 'cambio' : 'cambios'}`;
  findIdx = -1;
  changed();
}

// ---------- Guardar como ----------

const FORMATS = [
  { id: 'pdf', label: 'PDF', ext: 'pdf', text: 'Para enviar o imprimir, tal como queda' },
  { id: 'docx', label: 'WORD', ext: 'docx', text: 'Para seguir editando en Word, Pages o Google Docs' },
  { id: 'html', label: 'HTML', ext: 'html', text: 'Página web, con imágenes incluidas' },
  { id: 'md', label: 'MD', ext: 'md', text: 'Markdown, sin imágenes' },
  { id: 'txt', label: 'TXT', ext: 'txt', text: 'Solo texto, sin formato' },
];

function fileBase() {
  const name = docName(current).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 80);
  return name || 'Documento';
}

async function exportBlob(fmt) {
  const html = $('ed').innerHTML;
  const title = docName(current);
  if (fmt === 'pdf') {
    const { blob, lost } = await toPdf(html, title);
    if (lost) toast('Algunos caracteres (emojis, griego…) no caben en PDF y salen como «?»', { warn: true });
    return blob;
  }
  if (fmt === 'docx') return toDocx(html, title);
  if (fmt === 'html') return new Blob([toHtmlFile(html, title)], { type: 'text/html;charset=utf-8' });
  if (fmt === 'md') return new Blob([toMarkdown(html)], { type: 'text/markdown;charset=utf-8' });
  return new Blob([toText(html)], { type: 'text/plain;charset=utf-8' });
}

async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (isTouch && navigator.canShare?.({ files: [file] })) { // en móvil, abre «Guardar en Archivos» y compañía
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Guardado: ${name}`);
}

function openExportSheet() {
  const back = newSheet();
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Guardar como">
      <h2 class="sheet-title">Guardar como</h2>
      <p class="small muted">«${esc(fileBase())}»</p>
      <div class="fmt-list">
        ${FORMATS.map((f) => `<button class="fmt" type="button" data-fmt="${f.id}"><b>${f.label}</b><span>${f.text}</span></button>`).join('')}
      </div>
      <div class="sheet-actions"><button class="ghost-btn" type="button" data-close>Cerrar</button></div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
  back.querySelectorAll('[data-fmt]').forEach((b) => b.addEventListener('click', async () => {
    const f = FORMATS.find((x) => x.id === b.dataset.fmt);
    track(`/guardar/${f.id}`);
    await flushSave();
    try {
      const blob = await exportBlob(f.id);
      closeSheet();
      await deliver(blob, `${fileBase()}.${f.ext}`);
    } catch (_) {
      toast('No se ha podido generar el archivo', { warn: true });
    }
  }));
}

function printDoc() {
  flushSave();
  window.print();
}

// ---------- Hojas ----------

function closeSheet() {
  document.querySelector('.sheet-backdrop')?.remove();
}
function newSheet(center = false) {
  closeSheet();
  const back = document.createElement('div');
  back.className = `sheet-backdrop${center ? ' center' : ''}`;
  document.body.append(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeSheet(); });
  return back;
}

// ---------- Menú ⋯ ----------

const HOME_MENU = [
  { label: 'Nuevo documento', icon: 'plus', run: () => createDoc() },
  { label: 'Abrir archivo', icon: 'open', run: () => $('file-open').click() },
];
const EDIT_MENU = [
  { label: 'Guardar como', icon: 'save', run: () => openExportSheet() },
  { label: 'Buscar y reemplazar', icon: 'search', run: () => openFind() },
  { label: 'Imprimir', icon: 'print', run: () => printDoc() },
];
const COMMON_MENU = [
  { label: 'Nube', icon: 'cloud', run: () => openCloudSheet() },
  { label: 'Opciones de visualización', icon: 'palette', run: () => openDisplaySheet() },
  { label: 'Información', icon: 'info', run: () => openInfoSheet() },
];

function openMenu() {
  const menu = $('menu');
  const items = [...(current ? EDIT_MENU : HOME_MENU), ...COMMON_MENU];
  menu.innerHTML = items.map((m, i) =>
    `<button class="menu-item" role="menuitem" data-i="${i}">${icon(m.icon, 20)}<span>${m.label}</span></button>`).join('');
  menu.querySelectorAll('.menu-item').forEach((b) => b.addEventListener('click', () => {
    closeMenu();
    trackLabel(items[b.dataset.i].label);
    items[b.dataset.i].run();
  }));
  const r = $('menu-btn').getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  menu.hidden = false;
  $('menu-btn').setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  $('menu').hidden = true;
  $('menu-btn').setAttribute('aria-expanded', 'false');
}
$('menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if ($('menu').hidden) openMenu();
  else closeMenu();
});
document.addEventListener('click', (e) => {
  if (!$('menu').hidden && !e.target.closest('#menu')) closeMenu();
});
window.addEventListener('resize', () => { closeMenu(); closePop(); });

$('back-btn').addEventListener('click', async () => { await flushSave(); await renderHome(); Cloud.schedule(cloudAdapter, 0); });
$('save-btn').addEventListener('click', () => openExportSheet());
$('doc-title').addEventListener('input', markDirty);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && saveTimer) flushSave();
  Cloud.schedule(cloudAdapter, document.hidden ? 0 : 300);
});
window.addEventListener('pagehide', () => { if (saveTimer) flushSave(); });

// Con el teclado abierto, iOS desplaza la parte visible: las barras la siguen
if (window.visualViewport) {
  const follow = () => document.documentElement.style.setProperty('--vv', `${Math.max(0, visualViewport.offsetTop)}px`);
  visualViewport.addEventListener('scroll', follow);
  visualViewport.addEventListener('resize', follow);
}

function openInfoSheet() {
  const back = newSheet(true);
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Información">
      <span class="install-logo">${logoSVG(56)}</span>
      <h2 class="sheet-title">TextCTRL</h2>
      <p class="small muted">Versión ${APP_VERSION} · by OmT Finance</p>
      <p class="small">Editor de texto sencillo. Da formato, añade imágenes, tablas y enlaces, y guarda en PDF, Word, HTML, Markdown o texto. También abre archivos de Word, texto, Markdown y HTML.</p>
      <p class="small muted">${Cloud.account ? 'Los documentos se guardan en este dispositivo y en tu nube de CloudCTRL, cifrados.' : 'Los documentos se guardan solo en este dispositivo. Si borras los datos del navegador, se borran también: guarda una copia de lo importante, o conéctate a CloudCTRL desde ⋯ → Nube.'}</p>
      <div class="sheet-actions"><button type="button" class="done-btn" data-close>Cerrar</button></div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
}

// ---------- Opciones de visualización (modo y fondo) ----------

const WALLS = {
  tinta: { name: 'Tinta', c: ['79 70 229', '165 180 252', '99 102 241', '49 46 129'] },
  noche: { name: 'Noche', c: ['100 116 139', '148 163 184', '59 130 246', '30 64 175'] },
  sepia: { name: 'Sepia', c: ['217 119 6', '253 230 138', '180 83 9', '120 53 15'] },
  menta: { name: 'Menta', c: ['45 212 191', '134 239 172', '20 184 166', '6 95 70'] },
};
const lightQuery = matchMedia('(prefers-color-scheme: light)');
let display = { theme: 'auto', wall: 'tinta', ...load(DISPLAY_KEY, {}) };
if (!WALLS[display.wall]) display.wall = 'tinta';

function applyDisplay() {
  const light = display.theme === 'light' || (display.theme === 'auto' && lightQuery.matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.dataset.wall = display.wall;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f4f5ff' : '#090a18');
}
lightQuery.addEventListener('change', () => { if (display.theme === 'auto') applyDisplay(); });

function wallPreview(key) {
  const [c1, c2, c3, c4] = WALLS[key].c;
  const light = document.documentElement.dataset.theme === 'light';
  const a = light ? 0.4 : 0.5;
  const base = light ? '#f4f5ff' : '#090a18';
  return `radial-gradient(70% 60% at 15% 10%, rgb(${c1} / ${a}), transparent 70%), radial-gradient(60% 55% at 90% 25%, rgb(${c2} / ${a * 0.8}), transparent 72%),
    radial-gradient(70% 60% at 75% 95%, rgb(${c3} / ${a * 0.85}), transparent 70%), radial-gradient(60% 55% at 5% 85%, rgb(${c4} / ${a * 0.8}), transparent 72%), ${base}`;
}

function openDisplaySheet() {
  const back = newSheet();
  const draw = () => {
    back.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Opciones de visualización">
        <h2 class="sheet-title">Opciones de visualización</h2>
        <p class="opt-label">Modo</p>
        <div class="seg" role="group" aria-label="Modo">
          ${[['dark', 'Oscuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) =>
            `<button type="button" data-theme-opt="${v}" class="${display.theme === v ? 'on' : ''}" aria-pressed="${display.theme === v}">${l}</button>`).join('')}
        </div>
        <p class="muted small">${display.theme === 'auto' ? 'Sigue el modo claro u oscuro del sistema.' : '&nbsp;'}</p>
        <p class="opt-label">Fondo</p>
        <div class="walls">
          ${Object.entries(WALLS).map(([k, w]) =>
            `<button type="button" class="wall ${display.wall === k ? 'on' : ''}" data-wall-opt="${k}" style="background:${wallPreview(k)}" aria-pressed="${display.wall === k}">${w.name}</button>`).join('')}
        </div>
        <div class="sheet-actions"><button class="done-btn" type="button">Listo</button></div>
      </div>`;
    back.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
      display.theme = b.dataset.themeOpt;
      save(DISPLAY_KEY, display);
      applyDisplay();
      draw();
    }));
    back.querySelectorAll('[data-wall-opt]').forEach((b) => b.addEventListener('click', () => {
      display.wall = b.dataset.wallOpt;
      save(DISPLAY_KEY, display);
      applyDisplay();
      draw();
    }));
    back.querySelector('.done-btn').addEventListener('click', closeSheet);
  };
  draw();
}

// ---------- Aviso breve ----------

let toastTimer = 0;
function toast(text, { warn = false, stay = false } = {}) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('warn', warn);
  el.hidden = false;
  clearTimeout(toastTimer);
  if (!stay) toastTimer = setTimeout(() => { el.hidden = true; }, warn ? 5000 : 2400);
}

// ---------- Pantalla de inicio ----------
// Sin botón Entrar: el logo aparece (el arco se dibuja), se ve un instante y se pasa sola a la app
// con la transición de cristal, como en las demás apps.
const SPLASH_HOLD_MS = 1700;
const SPLASH_OUT_MS = 1200;
function enterApp() {
  const body = document.body;
  if (!$('splash') || body.classList.contains('entering')) return;
  body.classList.add('entering');
  setTimeout(() => {
    $('splash').remove();
    body.classList.remove('booting', 'entering');
    maybeShowInstallHint();
  }, SPLASH_OUT_MS);
}
setTimeout(enterApp, SPLASH_HOLD_MS);

// ---------- Aviso: añadir a la pantalla de inicio (solo móvil y tablet) ----------

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const HINT_ICONS = {
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1"/>',
  more: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
  add: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const hintIcon = (name) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HINT_ICONS[name]}</svg>`;

function maybeShowInstallHint() {
  if (!(isIOS || isAndroid) || isStandalone()) return;
  if (load(INSTALL_HINT_KEY, null) === 'off') return;
  const steps = isIOS
    ? [
        ['share', 'Pulsa el botón <b>Compartir</b> de Safari (abajo en el iPhone, arriba en el iPad).'],
        ['add', 'Desliza hacia abajo y elige <b>Añadir a pantalla de inicio</b>.'],
        ['check', 'Pulsa <b>Añadir</b>. El icono de TextCTRL aparecerá junto a tus apps.'],
      ]
    : [
        ['more', 'Pulsa el menú <b>⋮</b> de Chrome, arriba a la derecha.'],
        ['add', 'Elige <b>Añadir a pantalla de inicio</b> o <b>Instalar aplicación</b>.'],
        ['check', 'Confirma con <b>Instalar</b>. El icono de TextCTRL aparecerá junto a tus apps.'],
      ];
  const back = newSheet(true);
  back.innerHTML = `
    <div class="sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <span class="install-logo">${logoSVG(56)}</span>
      <h2 class="sheet-title" id="install-title">Añade TextCTRL a tu pantalla de inicio</h2>
      <p class="muted small">Así la abrirás como una app más, a pantalla completa y con un solo toque.</p>
      <ol class="install-steps">
        ${steps.map(([ic, text]) => `<li><span class="step-icon">${hintIcon(ic)}</span><span>${text}</span></li>`).join('')}
      </ol>
      <div class="install-footer">
        <label class="no-more"><input type="checkbox" id="install-no-more" /> No mostrar más</label>
        <button class="done-btn" type="button" id="install-ok">Aceptar</button>
      </div>
    </div>`;
  back.querySelector('#install-ok').addEventListener('click', () => {
    if (back.querySelector('#install-no-more').checked) save(INSTALL_HINT_KEY, 'off');
    closeSheet();
  });
}

// ---------- Sin zoom (Safari en iOS ignora user-scalable=no) ----------
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- Service worker ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

applyDisplay();
renderHome().then(async () => {
  await Cloud.sync(cloudAdapter);
  const wanted = new URLSearchParams(location.search).get('open'); // enlace desde CloudCTRL
  if (wanted) openDoc(await getDoc(wanted));
});
