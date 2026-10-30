'use strict';

// Conversión de documentos, sin librerías. El editor guarda HTML limpio (sanitize); cada formato de
// salida parte del mismo modelo de bloques (parseBlocks): párrafos, títulos, listas, tablas e imágenes.

const xmlEsc = (s) => String(s ?? '').replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const utf8Bytes = (s) => new TextEncoder().encode(s);

// ---------- HTML limpio ----------
// Todo lo que entra (pegar, importar) pasa por aquí: solo etiquetas y estilos de texto, nada de
// scripts ni imágenes remotas. Lo que no se conoce se sustituye por su contenido.

const KEEP_TAGS = new Set('P DIV H1 H2 H3 BLOCKQUOTE UL OL LI TABLE TBODY THEAD TR TD TH HR BR A B STRONG I EM U S STRIKE DEL SPAN FONT IMG'.split(' '));
const DROP_TAGS = new Set('SCRIPT STYLE IFRAME OBJECT EMBED META LINK TITLE HEAD NOSCRIPT SVG MATH FORM TEMPLATE VIDEO AUDIO CANVAS BUTTON INPUT SELECT TEXTAREA'.split(' '));
const KEEP_STYLES = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-align', 'text-decoration-line', 'width'];
const SAFE_IMG = /^data:image\/(png|jpeg|gif|webp);base64,/i;
const SAFE_URL = /^(https?:|mailto:)/i;

function cleanNode(parent) {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3) continue;
    if (node.nodeType !== 1) { node.remove(); continue; }
    const tag = node.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) { node.remove(); continue; }
    cleanNode(node);
    let el = node;
    if (/^H[4-6]$/.test(tag)) {
      el = node.ownerDocument.createElement('h3');
      el.append(...node.childNodes);
      node.replaceWith(el);
    } else if (!KEEP_TAGS.has(tag)) {
      node.replaceWith(...node.childNodes);
      continue;
    }
    const styles = KEEP_STYLES
      .filter((p) => (p !== 'width' || tag === 'IMG') && el.style?.getPropertyValue(p) && !/url|expression/i.test(el.style.getPropertyValue(p)))
      .map((p) => `${p}: ${el.style.getPropertyValue(p)}`);
    const keep = {};
    if (tag === 'A' && SAFE_URL.test(el.getAttribute('href') || '')) keep.href = el.getAttribute('href');
    if (tag === 'FONT') for (const a of ['size', 'face', 'color']) if (el.hasAttribute(a)) keep[a] = el.getAttribute(a);
    if (tag === 'IMG') {
      if (!SAFE_IMG.test(el.getAttribute('src') || '')) { el.remove(); continue; }
      keep.src = el.getAttribute('src');
    }
    const align = el.getAttribute('align');
    if (/^(left|center|right|justify)$/i.test(align || '') && !styles.some((s) => s.startsWith('text-align'))) styles.push(`text-align: ${align.toLowerCase()}`);
    for (const a of [...el.attributes]) el.removeAttribute(a.name);
    for (const [k, v] of Object.entries(keep)) el.setAttribute(k, v);
    if (styles.length) el.setAttribute('style', styles.join('; '));
  }
}
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  cleanNode(doc.body);
  // Chrome deja <p></p> alrededor de las listas; los vacíos de verdad llevan <br>
  doc.body.querySelectorAll('p').forEach((p) => { if (!p.firstChild) p.remove(); });
  return doc.body.innerHTML;
}

// ---------- Modelo de bloques ----------

const FONT_SIZES = { 1: 8, 2: 10, 3: 11, 4: 12, 5: 14, 6: 18, 7: 24 }; // <font size> → puntos
const BASE_SIZE = 11;
const BLOCK_STYLE = { p: { size: BASE_SIZE }, quote: { size: BASE_SIZE, i: true }, li: { size: BASE_SIZE }, h1: { size: 22, b: true }, h2: { size: 16, b: true }, h3: { size: 13, b: true } };
const BLOCK_SEL = 'p,div,h1,h2,h3,blockquote,ul,ol,li,table,hr';

function hexColor(v) {
  const s = String(v || '').trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((c) => c + c).join('');
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return m[1];
  m = s.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?/);
  if (m) {
    if (m[4] === '0') return '';
    return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
  return '';
}
const fontFamily = (v) => {
  const s = String(v || '').toLowerCase();
  if (/courier|mono|consolas/.test(s)) return 'mono';
  if (/times|georgia|garamond|cambria|(^|[,\s"'])serif/.test(s)) return 'serif';
  return s ? 'sans' : '';
};
function fontPt(v) {
  const m = String(v || '').match(/^([\d.]+)(pt|px|em|rem)?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === 'px' ? n * 0.75 : m[2] === 'pt' ? n : m[2] ? n * BASE_SIZE : 0;
}

// Estilo heredado + lo que aporta este elemento
function inlineStyle(el, up) {
  const s = { ...up };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') s.b = true;
  if (tag === 'I' || tag === 'EM') s.i = true;
  if (tag === 'U') s.u = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.s = true;
  if (tag === 'A') { s.href = el.getAttribute('href') || ''; s.u = true; s.color = s.color || '1a4fd0'; }
  if (tag === 'FONT') {
    if (FONT_SIZES[el.getAttribute('size')]) s.size = FONT_SIZES[el.getAttribute('size')];
    if (el.getAttribute('face')) s.font = fontFamily(el.getAttribute('face'));
    if (hexColor(el.getAttribute('color'))) s.color = hexColor(el.getAttribute('color'));
  }
  const st = el.style;
  if (st) {
    if (st.fontWeight) s.b = st.fontWeight === 'bold' || Number(st.fontWeight) >= 600;
    if (st.fontStyle) s.i = st.fontStyle === 'italic';
    if (/underline/.test(st.textDecorationLine)) s.u = true;
    if (/line-through/.test(st.textDecorationLine)) s.s = true;
    if (hexColor(st.color)) s.color = hexColor(st.color);
    if (hexColor(st.backgroundColor)) s.bg = hexColor(st.backgroundColor);
    if (fontPt(st.fontSize)) s.size = fontPt(st.fontSize);
    if (st.fontFamily) s.font = fontFamily(st.fontFamily);
  }
  return s;
}

function parseBlocks(html) {
  const root = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html').body;
  const out = [];
  let listSeq = 0;
  const walk = (parent, ctx, blocks) => {
    let cur = null;
    const flush = () => {
      if (cur && (cur.runs.some((r) => r.text.trim() || r.br) || !ctx.skipEmpty)) blocks.push(cur);
      cur = null;
    };
    const open = () => {
      cur = cur || { type: ctx.type || 'p', align: ctx.align || '', runs: [], ...ctx.extra };
      return cur;
    };
    const inline = (node, style) => {
      if (node.nodeType === 3) {
        const text = node.nodeValue.replace(/[\r\n\t ]+/g, ' ');
        if (text && (text !== ' ' || cur)) open().runs.push({ ...style, text });
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') open().runs.push({ text: '', br: true });
        else if (node.tagName === 'IMG') {
          flush();
          const m = (node.style?.width || '').match(/([\d.]+)%/);
          blocks.push({ type: 'img', src: node.getAttribute('src'), pct: m ? Number(m[1]) / 100 : 0, align: ctx.align || '' });
        } else {
          const s = inlineStyle(node, style);
          node.childNodes.forEach((c) => inline(c, s));
        }
      }
    };
    for (const node of parent.childNodes) {
      const el = node.nodeType === 1 ? node : null;
      const isBlock = el && (el.matches(BLOCK_SEL) || el.querySelector(BLOCK_SEL));
      if (!isBlock) { inline(node, ctx.style); continue; }
      flush();
      const align = el.style?.textAlign || ctx.align || '';
      const tag = el.tagName;
      if (tag === 'HR') blocks.push({ type: 'hr' });
      else if (tag === 'TABLE') {
        const rows = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el).map((tr) =>
          [...tr.children].map((td) => {
            const cell = [];
            walk(td, { type: 'p', style: { ...BLOCK_STYLE.p, b: td.tagName === 'TH' || undefined }, skipEmpty: false }, cell);
            return cell;
          }));
        blocks.push({ type: 'table', rows });
      } else if (tag === 'UL' || tag === 'OL') {
        const ordered = tag === 'OL';
        const listId = ++listSeq;
        let n = 0;
        for (const li of el.children) {
          if (li.tagName === 'UL' || li.tagName === 'OL') { walk({ childNodes: [li] }, { ...ctx, level: ctx.level ?? 0 }, blocks); continue; }
          if (li.tagName !== 'LI') continue;
          n += 1;
          const level = ctx.level ?? 0;
          const before = blocks.length;
          walk(li, { type: 'li', style: BLOCK_STYLE.li, align, level: level + 1, extra: { level, ordered, listId, num: n }, skipEmpty: false }, blocks);
          // Si el elemento empieza por una sublista, los siguientes bloques no llevan viñeta propia
          for (let i = before + 1; i < blocks.length; i += 1) if (blocks[i].type === 'li' && blocks[i].level === level && blocks[i].listId === listId) blocks[i].cont = true;
        }
      } else if (/^H[1-3]$/.test(tag)) {
        const type = tag.toLowerCase();
        walk(el, { type, style: BLOCK_STYLE[type], align, skipEmpty: false }, blocks);
      } else if (tag === 'BLOCKQUOTE') {
        walk(el, { type: 'quote', style: BLOCK_STYLE.quote, align, skipEmpty: false }, blocks);
      } else if (tag === 'P' || tag === 'DIV') {
        const inner = el.querySelector(BLOCK_SEL);
        walk(el, { ...ctx, align, type: ctx.type || 'p', style: inlineStyle(el, ctx.style), skipEmpty: !!inner || ctx.skipEmpty }, blocks);
      } else {
        walk(el, { ...ctx, style: inlineStyle(el, ctx.style) }, blocks);
      }
    }
    flush();
  };
  walk(root, { type: 'p', style: BLOCK_STYLE.p, skipEmpty: true }, out);
  // Un <br> final no es una línea más: es lo que el editor pone para que el párrafo vacío se vea
  const trim = (list) => list.forEach((b) => {
    if (b.runs?.length > 1 && b.runs[b.runs.length - 1].br) b.runs.pop();
    if (b.rows) b.rows.forEach((r) => r.forEach(trim));
  });
  trim(out);
  return out;
}

const runsText = (runs) => runs.map((r) => (r.br ? '\n' : r.text)).join('');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
const dataBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));

// Imagen para Word y PDF: JPEG sobre blanco, salvo PNG que Word admite tal cual
async function imageData(src, keepPng) {
  const img = await loadImage(src);
  if (/^data:image\/jpeg/i.test(src) || (keepPng && /^data:image\/png/i.test(src))) {
    return { w: img.naturalWidth, h: img.naturalHeight, bytes: dataBytes(src), ext: /jpeg/i.test(src.slice(0, 20)) ? 'jpeg' : 'png' };
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return { w: img.naturalWidth, h: img.naturalHeight, bytes: dataBytes(canvas.toDataURL('image/jpeg', 0.9)), ext: 'jpeg' };
}

// ---------- ZIP (un .docx es un zip) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const header = (size) => { const b = new DataView(new ArrayBuffer(size)); return b; };
  for (const { name, data } of files) {
    const nameBytes = utf8Bytes(name);
    const crc = crc32(data);
    const h = header(30);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(10, 0, true); h.setUint16(12, 0x5021, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nameBytes.length, true);
    parts.push(h.buffer, nameBytes, data);
    const c = header(46);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 0x5021, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    central.push(c.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.byteLength, 0);
  const end = header(22);
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return [...parts, ...central, end.buffer];
}
async function unzip(buffer) {
  const view = new DataView(buffer);
  let e = buffer.byteLength - 22;
  while (e >= 0 && view.getUint32(e, true) !== 0x06054b50) e -= 1;
  if (e < 0) throw new Error('zip');
  const files = new Map();
  let p = view.getUint32(e + 16, true);
  const count = view.getUint16(e + 10, true);
  for (let i = 0; i < count; i += 1) {
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nlen = view.getUint16(p + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, p + 46, nlen));
    const local = view.getUint32(p + 42, true);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = new Uint8Array(buffer, start, csize);
    files.set(name, async () => {
      if (method === 0) return raw;
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    p += 46 + nlen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return files;
}

// ---------- Word (.docx) ----------

const DOCX_CW = 9026; // ancho útil de A4 con márgenes de 2,5 cm, en vigésimos de punto
const EMU_PT = 12700;

async function toDocx(html, title) {
  const blocks = parseBlocks(html);
  const rels = [];
  const media = [];
  const rel = (type, target, external) => {
    const id = `rId${rels.length + 10}`;
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${xmlEsc(target)}"${external ? ' TargetMode="External"' : ''}/>`);
    return id;
  };
  const run = (r, base) => {
    if (r.br) return '<w:r><w:br/></w:r>';
    const f = { sans: 'Arial', serif: 'Times New Roman', mono: 'Courier New' }[r.font];
    const props = [
      f && `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`,
      r.b && '<w:b/>', r.i && '<w:i/>', r.s && '<w:strike/>',
      r.color && `<w:color w:val="${r.color}"/>`,
      r.size && r.size !== base && `<w:sz w:val="${Math.round(r.size * 2)}"/>`,
      r.u && '<w:u w:val="single"/>',
      r.bg && `<w:shd w:val="clear" w:color="auto" w:fill="${r.bg}"/>`,
    ].filter(Boolean).join('');
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(r.text)}</w:t></w:r>`;
  };
  const runs = (list, base) => {
    let out = '';
    for (let i = 0; i < list.length;) {
      const href = list[i].href;
      if (!href) { out += run(list[i], base); i += 1; continue; }
      let group = '';
      while (i < list.length && list[i].href === href) { group += run(list[i], base); i += 1; }
      out += `<w:hyperlink r:id="${rel('hyperlink', href, true)}">${group}</w:hyperlink>`;
    }
    return out;
  };
  const JC = { center: 'center', right: 'right', justify: 'both' };
  const numIds = new Map();
  const numId = (b) => {
    if (!numIds.has(b.listId)) numIds.set(b.listId, { id: numIds.size + 1, ordered: b.ordered });
    return numIds.get(b.listId).id;
  };
  const para = (b) => {
    const style = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', quote: 'Quote' }[b.type];
    const props = [
      style && `<w:pStyle w:val="${style}"/>`,
      b.type === 'li' && !b.cont && `<w:numPr><w:ilvl w:val="${Math.min(b.level, 2)}"/><w:numId w:val="${numId(b)}"/></w:numPr>`,
      b.type === 'li' && b.cont && `<w:ind w:left="${(b.level + 1) * 360}"/>`,
      JC[b.align] && `<w:jc w:val="${JC[b.align]}"/>`,
    ].filter(Boolean).join('');
    return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs(b.runs, BLOCK_STYLE[b.type].size)}</w:p>`;
  };
  const block = async (b, cw) => {
    if (b.type === 'hr') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>';
    if (b.type === 'img') {
      const data = await imageData(b.src, true);
      const name = `image${media.length + 1}.${data.ext === 'jpeg' ? 'jpg' : 'png'}`;
      media.push({ name: `word/media/${name}`, data: data.bytes });
      const id = rel('image', `media/${name}`);
      const max = cw / 20;
      const w = Math.min(b.pct ? max * b.pct : data.w * 0.75, max);
      const cx = Math.round(w * EMU_PT);
      const cy = Math.round((w * data.h / data.w) * EMU_PT);
      const n = media.length;
      return `<w:p>${JC[b.align] ? `<w:pPr><w:jc w:val="${JC[b.align]}"/></w:pPr>` : ''}<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Imagen ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    if (b.type === 'table') {
      const cols = Math.max(...b.rows.map((r) => r.length), 1);
      const colW = Math.floor(cw / cols);
      let rows = '';
      for (const row of b.rows) {
        let cells = '';
        for (let c = 0; c < cols; c += 1) {
          const inner = await Promise.all((row[c] || []).map((x) => block(x, colW - 200)));
          cells += `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr>${inner.join('') || '<w:p/>'}</w:tc>`;
        }
        rows += `<w:tr>${cells}</w:tr>`;
      }
      const edge = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
      return `<w:tbl><w:tblPr><w:tblW w:w="${colW * cols}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${`<w:gridCol w:w="${colW}"/>`.repeat(cols)}</w:tblGrid>${rows}</w:tbl><w:p/>`;
    }
    return para(b);
  };
  let body = '';
  for (const b of blocks) body += await block(b, DOCX_CW);

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const documentXml = `${XML}<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1440" w:bottom="1417" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const heading = (id, name, sz, n) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${n}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const stylesXml = `${XML}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${heading('Heading1', 'heading 1', 44, 0)}${heading('Heading2', 'heading 2', 32, 1)}${heading('Heading3', 'heading 3', 26, 2)}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="10" w:color="818CF8"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/></w:rPr></w:style></w:styles>`;
  const lvl = (i, ordered) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${ordered ? 'decimal' : 'bullet'}"/><w:lvlText w:val="${ordered ? `%${i + 1}.` : ['•', '–', '▪'][i]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${(i + 1) * 360}" w:hanging="360"/></w:pPr></w:lvl>`;
  const abstract = (id, ordered) => `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => lvl(i, ordered)).join('')}</w:abstractNum>`;
  const nums = [...numIds.values()].map(({ id, ordered }) => `<w:num w:numId="${id}"><w:abstractNumId w:val="${ordered ? 1 : 0}"/>${ordered ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ''}</w:num>`).join('');
  const numberingXml = `${XML}<w:numbering ${NS}>${abstract(0, false)}${abstract(1, true)}${nums}</w:numbering>`;
  const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files = [
    ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(title)}</dc:title></cp:coreProperties>`],
    ['word/document.xml', documentXml],
    ['word/styles.xml', stylesXml],
    ['word/numbering.xml', numberingXml],
    ['word/_rels/document.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${OD}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${OD}/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>`],
  ].map(([name, text]) => ({ name, data: utf8Bytes(text) }));
  return new Blob(zipStore([...files, ...media]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Lee un .docx: párrafos, títulos, listas, tablas, enlaces, imágenes y formato de texto directo
async function fromDocx(buffer) {
  const files = await unzip(buffer);
  const readXml = async (name) => {
    const get = files.get(name);
    if (!get) return null;
    return new DOMParser().parseFromString(new TextDecoder().decode(await get()), 'application/xml');
  };
  const doc = await readXml('word/document.xml');
  if (!doc) throw new Error('docx');
  const local = (el) => el.localName;
  const kids = (el, name) => [...el.children].filter((c) => !name || local(c) === name);
  const kid = (el, name) => (el ? kids(el, name)[0] : undefined);
  const val = (el) => el?.getAttribute('w:val') ?? null;
  const on = (el) => !!el && !['0', 'false', 'none'].includes(val(el));

  const rels = new Map();
  const relDoc = await readXml('word/_rels/document.xml.rels');
  if (relDoc) for (const r of relDoc.documentElement.children) rels.set(r.getAttribute('Id'), r.getAttribute('Target'));
  // numId → ¿lista numerada?
  const ordered = new Map();
  const numDoc = await readXml('word/numbering.xml');
  if (numDoc) {
    const abs = new Map();
    for (const a of kids(numDoc.documentElement, 'abstractNum')) abs.set(a.getAttribute('w:abstractNumId'), val(kid(kid(a, 'lvl'), 'numFmt')));
    for (const n of kids(numDoc.documentElement, 'num')) ordered.set(n.getAttribute('w:numId'), (abs.get(val(kid(n, 'abstractNumId'))) || 'bullet') !== 'bullet');
  }

  const image = async (drawing) => {
    const blip = drawing.getElementsByTagNameNS('*', 'blip')[0];
    const target = rels.get(blip?.getAttribute('r:embed'));
    const get = target && files.get(`word/${target.replace(/^\/?(word\/)?/, '')}`);
    if (!get) return '';
    const ext = target.split('.').pop().toLowerCase();
    const mime = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif' }[ext];
    if (!mime) return '';
    const bytes = await get();
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return `<img src="data:image/${mime};base64,${btoa(bin)}">`;
  };
  const runHtml = async (r) => {
    const p = kid(r, 'rPr');
    let inner = '';
    for (const c of kids(r)) {
      if (local(c) === 't') inner += xmlEsc(c.textContent);
      else if (local(c) === 'tab') inner += ' ';
      else if (local(c) === 'br') inner += '<br>';
      else if (local(c) === 'drawing') inner += await image(c);
    }
    if (!inner || !p) return inner;
    const css = [];
    const color = val(kid(p, 'color'));
    if (color && /^[0-9a-f]{6}$/i.test(color)) css.push(`color: #${color}`);
    const fill = kid(p, 'shd')?.getAttribute('w:fill');
    if (fill && /^[0-9a-f]{6}$/i.test(fill)) css.push(`background-color: #${fill}`);
    const hl = val(kid(p, 'highlight'));
    if (hl && hl !== 'none') css.push(`background-color: ${/^[a-z]+$/i.test(hl) ? hl.replace(/^dark/i, '').toLowerCase() : 'yellow'}`);
    const sz = Number(val(kid(p, 'sz')));
    if (sz) css.push(`font-size: ${sz / 2}pt`);
    const font = kid(p, 'rFonts')?.getAttribute('w:ascii');
    if (font) css.push(`font-family: ${/^[\w ]+$/.test(font) ? `'${font}'` : 'sans-serif'}`);
    if (css.length) inner = `<span style="${css.join('; ')}">${inner}</span>`;
    if (on(kid(p, 'u'))) inner = `<u>${inner}</u>`;
    if (on(kid(p, 'strike'))) inner = `<s>${inner}</s>`;
    if (on(kid(p, 'i'))) inner = `<i>${inner}</i>`;
    if (on(kid(p, 'b'))) inner = `<b>${inner}</b>`;
    return inner;
  };
  const inlineHtml = async (p) => {
    let out = '';
    for (const c of kids(p)) {
      if (local(c) === 'r') out += await runHtml(c);
      else if (local(c) === 'hyperlink') {
        const href = rels.get(c.getAttribute('r:id'));
        let inner = '';
        for (const r of kids(c, 'r')) inner += await runHtml(r);
        out += href ? `<a href="${xmlEsc(href)}">${inner}</a>` : inner;
      } else if (['ins', 'smartTag', 'sdt', 'sdtContent'].includes(local(c))) out += await inlineHtml(c);
    }
    return out;
  };
  const blockTag = (style) => {
    const s = (style || '').toLowerCase();
    const m = s.match(/^(?:heading|t[ií]?tulo|ttulo)\s*([1-9])$/);
    if (m) return `h${Math.min(Number(m[1]), 3)}`;
    if (s === 'title' || s === 'ttulo' || s === 'titulo') return 'h1';
    if (/^(quote|cita|intensequote|citadestacada)$/.test(s)) return 'blockquote';
    return 'p';
  };
  const JC = { center: 'center', right: 'right', both: 'justify', end: 'right' };
  const blocksHtml = async (parent) => {
    const out = [];
    const stack = []; // listas abiertas
    const closeTo = (depth) => { while (stack.length > depth) out.push(`</li></${stack.pop()}>`); };
    for (const el of kids(parent)) {
      if (local(el) === 'p') {
        const pr = kid(el, 'pPr');
        const inner = await inlineHtml(el);
        if (!inner && kid(kid(pr, 'pBdr'), 'bottom')) { closeTo(0); out.push('<hr>'); continue; }
        const num = kid(pr, 'numPr');
        const jc = JC[val(kid(pr, 'jc'))];
        const align = jc ? ` style="text-align: ${jc}"` : '';
        if (num && val(kid(num, 'numId')) !== '0') {
          const depth = Number(val(kid(num, 'ilvl')) || 0) + 1;
          const tag = ordered.get(val(kid(num, 'numId'))) ? 'ol' : 'ul';
          if (stack.length >= depth) closeTo(depth);
          if (stack.length === depth && stack[depth - 1] !== tag) closeTo(depth - 1);
          if (stack.length === depth) out.push('</li>');
          while (stack.length < depth) { stack.push(tag); out.push(`<${tag}>`); if (stack.length < depth) out.push('<li>'); }
          out.push(`<li${align}>${inner || '<br>'}`);
        } else {
          closeTo(0);
          const tag = blockTag(val(kid(pr, 'pStyle')));
          out.push(`<${tag}${align}>${inner || '<br>'}</${tag}>`);
        }
      } else if (local(el) === 'tbl') {
        closeTo(0);
        let rows = '';
        for (const tr of kids(el, 'tr')) {
          let cells = '';
          for (const tc of kids(tr, 'tc')) cells += `<td>${await blocksHtml(tc)}</td>`;
          rows += `<tr>${cells}</tr>`;
        }
        out.push(`<table><tbody>${rows}</tbody></table>`);
      } else if (local(el) === 'sdt') {
        closeTo(0);
        const content = kid(el, 'sdtContent');
        if (content) out.push(await blocksHtml(content));
      }
    }
    closeTo(0);
    return out.join('');
  };
  return sanitize(await blocksHtml(kid(doc.documentElement, 'body')));
}

// ---------- PDF ----------
// PDF escrito a mano con las fuentes estándar (Helvetica, Times, Courier): texto seleccionable y
// archivo pequeño. Esas fuentes solo cubren el juego WinAnsi (español y Europa occidental): el resto de
// caracteres (emojis, griego…) sale como «?» y se avisa. Anchos medidos con sus equivalentes métricas.

const PDF_W = 595.28;
const PDF_H = 841.89;
const PDF_M = 70.9; // 2,5 cm
const PDF_FONTS = { sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'], serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'], mono: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'] };
const MEASURE_FONT = { sans: 'Arial, Helvetica, "Liberation Sans", sans-serif', serif: '"Times New Roman", Times, "Liberation Serif", serif', mono: '"Courier New", Courier, "Liberation Mono", monospace' };
const WIN_HIGH = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };

async function toPdf(html, title) {
  const blocks = parseBlocks(html);
  const ctx = document.createElement('canvas').getContext('2d');
  let lost = false;
  const fontIndex = (s) => (s.b ? 1 : 0) + (s.i ? 2 : 0);
  const fontName = (s) => { const fam = Object.keys(PDF_FONTS).indexOf(s.font || 'sans'); return `F${Math.max(fam, 0) * 4 + fontIndex(s) + 1}`; };
  const measure = (text, s) => {
    ctx.font = `${s.i ? 'italic ' : ''}${s.b ? 'bold ' : ''}100px ${MEASURE_FONT[s.font || 'sans']}`;
    return ctx.measureText(text).width * (s.size || BASE_SIZE) / 100;
  };
  const winHex = (text) => {
    let out = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      let b = cp;
      if (WIN_HIGH[cp]) b = WIN_HIGH[cp];
      else if (cp < 32 || (cp > 126 && cp < 160) || cp > 255) { b = 63; lost = true; }
      out += b.toString(16).padStart(2, '0');
    }
    return `<${out}>`;
  };
  const num = (n) => Number(n.toFixed(2));
  const rgb = (hex) => [0, 2, 4].map((i) => num(parseInt(hex.slice(i, i + 2), 16) / 255)).join(' ');

  const images = [];
  const pages = [];
  let page;
  let y;
  const newPage = () => { page = { ops: [], links: [] }; pages.push(page); y = PDF_M; };
  newPage();
  const py = (top) => PDF_H - top; // el PDF cuenta desde abajo

  // Parte los fragmentos en líneas del ancho dado
  const wrap = (runs, width) => {
    const lines = [];
    let line = { frags: [], w: 0 };
    const push = (brk) => { line.hard = brk; lines.push(line); line = { frags: [], w: 0 }; };
    const add = (text, s) => {
      let w = measure(text, s);
      if (!text.trim()) {
        if (line.frags.length) { line.frags.push({ text, s, w, space: true }); line.w += w; }
        return;
      }
      while (w > width && text.length > 1) { // palabra más larga que la línea
        if (line.frags.length) push(false);
        let n = text.length - 1;
        while (n > 1 && measure(text.slice(0, n), s) > width) n -= 1;
        const head = text.slice(0, n);
        line.frags.push({ text: head, s, w: measure(head, s) });
        line.w = measure(head, s);
        push(false);
        text = text.slice(n);
        w = measure(text, s);
      }
      if (line.w + w > width && line.frags.length) {
        while (line.frags.length && line.frags[line.frags.length - 1].space) line.w -= line.frags.pop().w;
        push(false);
      }
      line.frags.push({ text, s, w });
      line.w += w;
    };
    for (const r of runs) {
      if (r.br) { push(true); continue; }
      for (const piece of r.text.split(/(\s+)/)) if (piece) add(piece.replace(/\s/g, ' '), r);
    }
    push(true);
    for (const l of lines) {
      while (l.frags.length && l.frags[l.frags.length - 1].space) l.w -= l.frags.pop().w;
      l.size = Math.max(...l.frags.map((f) => f.s.size || BASE_SIZE), 0);
    }
    return lines;
  };

  const paintLine = (line, x, top, width, align, base, target) => {
    const size = line.size || base;
    const gaps = line.frags.filter((f) => f.space).length;
    let cx = x;
    let extra = 0;
    if (align === 'center') cx += (width - line.w) / 2;
    else if (align === 'right') cx += width - line.w;
    else if (align === 'justify' && !line.hard && gaps) extra = (width - line.w) / gaps;
    const baseline = top + size * 1.05;
    for (const f of line.frags) {
      const s = f.s;
      const w = f.w + (f.space ? extra : 0);
      if (s.bg) target.ops.push(`${rgb(s.bg)} rg ${num(cx)} ${num(py(baseline + size * 0.25))} ${num(w)} ${num(size * 1.2)} re f`);
      const col = s.color || '000000';
      if (!f.space) target.ops.push(`BT /${fontName(s)} ${num(s.size || BASE_SIZE)} Tf ${rgb(col)} rg ${num(cx)} ${num(py(baseline))} Td ${winHex(f.text)} Tj ET`);
      const stroke = (off) => target.ops.push(`${rgb(col)} RG ${num(size * 0.06)} w ${num(cx)} ${num(py(baseline + off))} m ${num(cx + w)} ${num(py(baseline + off))} l S`);
      if (s.u) stroke(size * 0.12);
      if (s.s) stroke(-size * 0.28);
      if (s.href) target.links.push({ href: s.href, rect: [cx, py(baseline + size * 0.25), cx + w, py(baseline - size * 0.9)] });
      cx += w;
    }
  };

  // Cada bloque se convierte en «losas» que no se parten: una línea, una imagen, una fila de tabla
  const slabsOf = async (list, width) => {
    const slabs = [];
    for (const b of list) {
      if (b.type === 'hr') {
        slabs.push({ h: 1, before: 8, after: 8, paint: (x, top, target) => target.ops.push(`0.67 0.67 0.67 RG 0.75 w ${num(x)} ${num(py(top))} m ${num(x + width)} ${num(py(top))} l S`) });
      } else if (b.type === 'img') {
        const data = await imageData(b.src, false);
        const name = `Im${images.length + 1}`;
        images.push({ name, data });
        const w = Math.min(b.pct ? width * b.pct : data.w * 0.75, width);
        const h = Math.min(w * data.h / data.w, PDF_H - 2 * PDF_M);
        const dw = h * data.w / data.h;
        slabs.push({ h, before: 4, after: 8, paint: (x, top, target) => {
          const ix = x + (b.align === 'center' ? (width - dw) / 2 : b.align === 'right' ? width - dw : 0);
          target.ops.push(`q ${num(dw)} 0 0 ${num(h)} ${num(ix)} ${num(py(top + h))} cm /${name} Do Q`);
        } });
      } else if (b.type === 'table') {
        const cols = Math.max(...b.rows.map((r) => r.length), 1);
        const colW = width / cols;
        const pad = 5;
        for (const row of b.rows) {
          const cells = [];
          for (let c = 0; c < cols; c += 1) cells.push(await slabsOf(row[c] || [], colW - 2 * pad));
          const heights = cells.map((list2) => list2.reduce((n, s) => n + s.before + s.h + s.after, 0));
          const h = Math.max(...heights, BASE_SIZE * 1.3) + 2 * pad;
          slabs.push({ h, before: 0, after: 0, paint: (x, top, target) => {
            target.ops.push(`0.6 0.6 0.6 RG 0.5 w`);
            cells.forEach((list2, c) => {
              const cx = x + c * colW;
              target.ops.push(`${num(cx)} ${num(py(top + h))} ${num(colW)} ${num(h)} re S`);
              let t = top + pad;
              for (const s of list2) { t += s.before; s.paint(cx + pad, t, target); t += s.h + s.after; }
            });
          } });
        }
        if (slabs.length) slabs[slabs.length - 1].after = 10;
      } else {
        const st = BLOCK_STYLE[b.type] || BLOCK_STYLE.p;
        const li = b.type === 'li';
        const indent = li ? (b.level + 1) * 18 : b.type === 'quote' ? 16 : 0;
        const lines = wrap(b.runs, width - indent);
        const before = /^h/.test(b.type) ? st.size * 0.7 : 0;
        const after = /^h/.test(b.type) ? st.size * 0.3 : list.length > 1 || !b.inCell ? 6 : 0;
        lines.forEach((line, i) => {
          const h = (line.size || st.size) * 1.3;
          slabs.push({
            h,
            before: i === 0 ? before : 0,
            after: i === lines.length - 1 ? after : 0,
            keep: /^h/.test(b.type),
            paint: (x, top, target) => {
              if (b.type === 'quote') target.ops.push(`0.51 0.55 0.97 RG 2 w ${num(x + 4)} ${num(py(top))} m ${num(x + 4)} ${num(py(top + h))} l S`);
              if (li && i === 0 && !b.cont) {
                const mark = b.ordered ? `${b.num}.` : ['•', '–', '•'][Math.min(b.level, 2)];
                const s = { size: line.size || st.size };
                target.ops.push(`BT /F1 ${num(s.size)} Tf 0 0 0 rg ${num(x + indent - 16)} ${num(py(top + s.size * 1.05))} Td ${winHex(mark)} Tj ET`);
              }
              paintLine(line, x + indent, top, width - indent, b.align, st.size, target);
            },
          });
        });
      }
    }
    return slabs;
  };

  const slabs = await slabsOf(blocks, PDF_W - 2 * PDF_M);
  const bottom = PDF_H - PDF_M;
  slabs.forEach((s, i) => {
    let need = s.before + s.h;
    if (s.keep) { // un título no se queda solo al final de la página
      for (let j = i + 1; j < slabs.length && j <= i + 2; j += 1) need += slabs[j].before + slabs[j].h;
    }
    if (y + need > bottom && y > PDF_M) newPage();
    if (y > PDF_M) y += s.before;
    s.paint(PDF_M, y, page);
    y += s.h + s.after;
  });

  // Archivo: objetos numerados + tabla xref
  const chunks = [];
  const offsets = [];
  let size = 0;
  const write = (data) => { const b = typeof data === 'string' ? Uint8Array.from(data, (c) => c.charCodeAt(0)) : data; chunks.push(b); size += b.length; };
  const hexUtf16 = (text) => { let h = 'FEFF'; for (let i = 0; i < text.length; i += 1) h += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase(); return `<${h}>`; };
  const asciiHex = (text) => `<${[...utf8Bytes(text)].map((b) => b.toString(16).padStart(2, '0')).join('')}>`;
  const objects = []; // [dict, stream?]
  const add = (dict, stream) => { objects.push([dict, stream]); return objects.length; };
  const catalog = add('');
  const pagesObj = add('');
  const info = add(`<< /Title ${hexUtf16(title)} /Producer (TextCTRL) >>`);
  let fontRes = '';
  let n = 0;
  for (const fam of Object.values(PDF_FONTS)) {
    for (const base of fam) {
      n += 1;
      fontRes += `/F${n} ${add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`)} 0 R `;
    }
  }
  let imgRes = '';
  for (const { name, data } of images) {
    imgRes += `/${name} ${add(`<< /Type /XObject /Subtype /Image /Width ${data.w} /Height ${data.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.bytes.length} >>`, data.bytes)} 0 R `;
  }
  const kidsRefs = [];
  for (const p of pages) {
    const body = utf8Bytes(p.ops.join('\n'));
    const content = add(`<< /Length ${body.length} >>`, body);
    const annots = p.links.map((l) => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(num).join(' ')}] /Border [0 0 0] /A << /S /URI /URI ${asciiHex(l.href)} >> >>`));
    kidsRefs.push(`${add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PDF_W} ${PDF_H}] /Contents ${content} 0 R /Resources << /Font << ${fontRes}>> /XObject << ${imgRes}>> >>${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(' ')}]` : ''} >>`)} 0 R`);
  }
  objects[catalog - 1][0] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1][0] = `<< /Type /Pages /Count ${pages.length} /Kids [${kidsRefs.join(' ')}] >>`;
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objects.forEach(([dict, stream], i) => {
    offsets.push(size);
    write(`${i + 1} 0 obj\n${dict}\n`);
    if (stream) { write('stream\n'); write(stream); write('\nendstream\n'); }
    write('endobj\n');
  });
  const xref = size;
  write(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  write(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return { blob: new Blob(chunks, { type: 'application/pdf' }), lost, pages: pages.length };
}

// ---------- Texto, Markdown y HTML ----------

function toText(html) {
  const lines = [];
  for (const b of parseBlocks(html)) {
    if (b.type === 'hr') lines.push('———');
    else if (b.type === 'img') lines.push('[imagen]');
    else if (b.type === 'table') for (const row of b.rows) lines.push(row.map((c) => c.map((x) => runsText(x.runs || [])).join(' ')).join('\t'));
    else if (b.type === 'li') lines.push(`${'  '.repeat(b.level)}${b.cont ? '  ' : b.ordered ? `${b.num}. ` : '• '}${runsText(b.runs)}`);
    else lines.push(runsText(b.runs));
  }
  return `${lines.join('\n')}\n`;
}

function mdRuns(runs) {
  let out = '';
  for (const r of runs) {
    if (r.br) { out += '  \n'; continue; }
    const [, lead, core, tail] = r.text.match(/^(\s*)(.*?)(\s*)$/s);
    if (!core) { out += r.text; continue; }
    let t = core.replace(/([\\`*_[\]])/g, '\\$1');
    if (r.href) t = `[${t}](${r.href})`;
    if (r.s) t = `~~${t}~~`;
    if (r.i) t = `*${t}*`;
    if (r.b) t = `**${t}**`;
    out += lead + t + tail;
  }
  return out.replace(/\*\*\*\*/g, '').replace(/~~~~/g, '');
}
function toMarkdown(html) {
  const parts = [];
  let prev = '';
  const plain = (b) => mdRuns((b.runs || []).map((r) => (/^h/.test(b.type) ? { ...r, b: false } : r)));
  for (const b of parseBlocks(html)) {
    let line = '';
    if (b.type === 'hr') line = '---';
    else if (b.type === 'img') line = '![imagen](imagen-no-incluida)';
    else if (b.type === 'table') {
      const rows = b.rows.map((row) => `| ${row.map((c) => c.map((x) => mdRuns(x.runs || [])).join(' ').replace(/\|/g, '\\|').trim()).join(' | ')} |`);
      rows.splice(1, 0, `|${' --- |'.repeat(b.rows[0]?.length || 1)}`);
      line = rows.join('\n');
    } else if (/^h/.test(b.type)) line = `${'#'.repeat(Number(b.type[1]))} ${plain(b)}`;
    else if (b.type === 'quote') line = `> ${plain(b).replace(/\n/g, '\n> ')}`;
    else if (b.type === 'li') line = `${'   '.repeat(b.level)}${b.cont ? '   ' : b.ordered ? `${b.num}. ` : '- '}${plain(b)}`;
    else line = plain(b);
    parts.push(`${parts.length ? (prev === 'li' && b.type === 'li' ? '\n' : '\n\n') : ''}${line}`);
    prev = b.type;
  }
  return `${parts.join('')}\n`;
}
function fromMarkdown(md) {
  const inline = (s) => xmlEsc(s)
    .replace(/\\([\\`*_[\]])/g, (_, c) => `&#${c.charCodeAt(0)};`)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<font face="Courier New">$1</font>');
  const out = [];
  let list = null;
  const endList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let m;
    if (!line.trim()) { endList(); continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*$/))) { endList(); const n = Math.min(m[1].length, 3); out.push(`<h${n}>${inline(m[2])}</h${n}>`); } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { endList(); out.push('<hr>'); } else if ((m = line.match(/^\s*[-*+]\s+(.*)/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (list !== tag) { endList(); list = tag; out.push(`<${tag}>`); }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^>\s?(.*)/))) { endList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); } else if (/^\s*\|.*\|\s*$/.test(line)) {
      endList();
      const rows = [];
      for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i += 1) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|'));
      }
      i -= 1;
      out.push(`<table><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c.trim())}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else { endList(); out.push(`<p>${inline(line)}</p>`); }
  }
  endList();
  return sanitize(out.join(''));
}
const fromText = (text) => text.replace(/\r\n?/g, '\n').split('\n').map((l) => `<p>${xmlEsc(l) || '<br>'}</p>`).join('');

function toHtmlFile(html, title) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${xmlEsc(title)}</title>
<style>
body { max-width: 720px; margin: 40px auto; padding: 0 20px; font: 11pt/1.4 Arial, Helvetica, sans-serif; color: #111; }
font[size="1"] { font-size: 8pt; } font[size="2"] { font-size: 10pt; } font[size="3"] { font-size: 11pt; } font[size="4"] { font-size: 12pt; }
font[size="5"] { font-size: 14pt; } font[size="6"] { font-size: 18pt; } font[size="7"] { font-size: 24pt; }
h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
blockquote { margin: 0 0 0 4px; padding-left: 14px; border-left: 3px solid #818cf8; font-style: italic; }
table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #999; padding: 5px; vertical-align: top; }
img { max-width: 100%; }
</style>
</head>
<body>
${sanitize(html)}
</body>
</html>
`;
}

async function importFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return fromDocx(await file.arrayBuffer());
  const text = await file.text();
  if (/\.html?$/.test(name)) return sanitize(text);
  if (/\.(md|markdown)$/.test(name)) return fromMarkdown(text);
  if (name.endsWith('.txt')) return fromText(text);
  throw new Error('format');
}
