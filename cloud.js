'use strict';

// Cliente de CloudCTRL. Este archivo es IGUAL en cloudctrl, textctrl y sheetctrl: si cambia, se copia a las tres.
// Usuario y contraseña derivan (PBKDF2) una clave para identificarse y otra, que nunca sale del
// dispositivo, para cifrar (AES-GCM): contenido y nombres viajan ilegibles. Cada archivo se comprime,
// se cifra, se parte en trozos y se confirma al final, con su número de revisión.
//
// Cada app guarda sus documentos como siempre y `Cloud.sync(adapter)` los mantiene iguales que en la nube:
//   adapter = { kind, list(): [{id, upd}], read(id): {name, payload}, write(id, name, payload, upd),
//               remove(id), fork(id), busy(id), done(summary) }
// Qué revisión de cada documento hay en este dispositivo se apunta aparte, en localStorage.
const Cloud = (() => {
  const ORIGIN = 'https://cloud-app-wheat.vercel.app';
  const API = window.CLOUD_API || `${ORIGIN}/api/cloud`;
  const ACCOUNT_KEY = 'cloud:account';
  const TRASH_KEY = 'cloud:pendingTrash';
  const stateKey = (kind) => `cloud:state:${kind}`;
  const PBKDF2_ITERATIONS = 310000;
  const CHUNK_CHARS = 3000000;
  const utf8 = new TextEncoder();

  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* sin almacenamiento */ } };
  const drop = (key) => { try { localStorage.removeItem(key); } catch (_) { /* sin almacenamiento */ } };

  let account = load(ACCOUNT_KEY, null); // { username, user, auth, key }
  const status = { state: account ? 'idle' : 'off', at: 0, error: '' };

  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const sha256hex = async (text) => hex(await crypto.subtle.digest('SHA-256', utf8.encode(text)));
  const toB64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < bytes.length; i += 0x8000) str += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(str);
  };
  const fromB64 = (str) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));

  async function derive(username, password) {
    const u = username.trim().toLowerCase();
    const base = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = (salt) => crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: utf8.encode(salt), iterations: PBKDF2_ITERATIONS }, base, 256);
    const [auth, key] = await Promise.all([bits(`cloudctrl-auth:${u}`), bits(`cloudctrl-enc:${u}`)]);
    return { username: u, user: await sha256hex(`cloudctrl-user:${u}`), auth: hex(auth), key: toB64(key) };
  }
  const aesKey = (acc = account) => crypto.subtle.importKey('raw', fromB64(acc.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function encrypt(bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), bytes);
    return `${toB64(iv)}.${toB64(ct)}`;
  }
  async function decrypt(blob) {
    const [iv, ct] = blob.split('.');
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await aesKey(), fromB64(ct));
  }
  const pipe = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  const gzip = (bytes) => pipe(bytes, new CompressionStream('gzip'));
  const gunzip = (bytes) => pipe(bytes, new DecompressionStream('gzip'));

  async function call(action, extra = {}, acc = account) {
    if (!acc) throw new Error('no-account');
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, user: acc.user, auth: acc.auth, ...extra }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || `http ${res.status}`), { status: res.status, rev: out.rev });
    return out;
  }

  const errorText = (err) => ({
    auth: 'Usuario o contraseña incorrectos.',
    exists: 'Ese nombre de usuario ya existe. Elige otro o entra con tu cuenta.',
    'too-many': 'Demasiados intentos. Espera 15 minutos.',
    invite: 'La clave de registro no es correcta.',
    quota: 'La nube está llena. Vacía la papelera o borra archivos.',
    'not-configured': 'Falta conectar la base de datos en Vercel (Storage → Upstash Redis).',
    'too-large': 'Ese archivo es demasiado grande para la nube (máximo 36 MB).',
    OperationError: 'No se han podido descifrar los datos de la nube.',
  }[err.message || err.name] || 'No se ha podido conectar con la nube.');

  // ---------- Cuenta ----------

  async function connect(username, password, invite) {
    const acc = await derive(username, password);
    await call(invite === undefined ? 'login' : 'register', invite === undefined ? {} : { invite }, acc);
    account = acc;
    save(ACCOUNT_KEY, acc);
    status.state = 'idle';
    status.error = '';
  }
  function logout() {
    account = null;
    status.state = 'off';
    for (const k of ['text', 'sheet']) drop(stateKey(k));
    drop(ACCOUNT_KEY);
    drop(TRASH_KEY);
  }

  // ---------- Archivos ----------

  async function list() {
    const out = await call('list');
    const files = await Promise.all(out.files.map(async (f) => {
      const meta = JSON.parse(new TextDecoder().decode(await decrypt(f.meta)));
      return { ...f, ...meta, meta: undefined };
    }));
    return { files, used: out.used, quota: out.quota };
  }

  async function put({ id, kind, name, mime = '', upd = Date.now(), bytes, baseRev = 0, onProgress }) {
    const blob = await encrypt(await gzip(bytes));
    const chunks = Math.ceil(blob.length / CHUNK_CHARS);
    if (chunks > 12) throw new Error('too-large');
    const gen = hex(crypto.getRandomValues(new Uint8Array(8)));
    for (let n = 0; n < chunks; n += 1) {
      await call('chunk-put', { id, gen, n, blob: blob.slice(n * CHUNK_CHARS, (n + 1) * CHUNK_CHARS) });
      onProgress?.((n + 1) / chunks);
    }
    const meta = await encrypt(utf8.encode(JSON.stringify({ name, kind, mime, upd, bytes: bytes.byteLength })));
    const { rev } = await call('commit', { id, gen, chunks, size: blob.length, meta, baseRev });
    return rev;
  }

  async function get(file, onProgress) {
    const parts = [];
    for (let n = 0; n < file.chunks; n += 1) {
      parts.push((await call('chunk-get', { id: file.id, gen: file.gen, n })).blob);
      onProgress?.((n + 1) / file.chunks);
    }
    return gunzip(await decrypt(parts.join('')));
  }

  const trash = (id) => call('trash', { id });
  const restore = (id) => call('restore', { id });
  const purge = (id) => call('purge', { id });

  // Para las apps: el documento borrado va a la papelera, aunque ahora no haya conexión.
  function forget(kind, id) {
    if (!account) return;
    const state = load(stateKey(kind), {});
    if (!state[id]) return;
    delete state[id];
    save(stateKey(kind), state);
    save(TRASH_KEY, [...load(TRASH_KEY, []), id]);
  }

  // ---------- Sincronización de los documentos de una app ----------

  let busy = false;
  let again = false;
  let timer = 0;

  async function sync(adapter) {
    if (!account) return;
    if (busy) { again = true; return; }
    busy = true;
    status.state = 'syncing';
    const summary = { up: 0, down: 0, removed: 0, forked: 0, tooLarge: 0 };
    try {
      for (const id of load(TRASH_KEY, [])) {
        await trash(id);
        save(TRASH_KEY, load(TRASH_KEY, []).filter((x) => x !== id));
      }
      const { files } = await list();
      const remote = new Map(files.filter((f) => f.kind === adapter.kind).map((f) => [f.id, f]));
      const state = load(stateKey(adapter.kind), {});
      const mark = (id, rev, upd) => { state[id] = { rev, upd }; save(stateKey(adapter.kind), state); };
      const unmark = (id) => { delete state[id]; save(stateKey(adapter.kind), state); };
      const upload = async (id, upd, baseRev) => {
        const { name, payload } = await adapter.read(id);
        try {
          const bytes = utf8.encode(JSON.stringify(payload));
          mark(id, await put({ id, kind: adapter.kind, name, upd, bytes, baseRev }), upd);
          summary.up += 1;
        } catch (err) {
          if (err.status === 409) again = true;
          else if (err.message === 'too-large') summary.tooLarge += 1;
          else throw err;
        }
      };
      const download = async (file) => {
        const payload = JSON.parse(new TextDecoder().decode(await get(file)));
        await adapter.write(file.id, file.name, payload, file.upd);
        mark(file.id, file.rev, file.upd);
        summary.down += 1;
      };

      const locals = await adapter.list();
      const here = new Set(locals.map((l) => l.id));
      for (const l of locals) {
        const c = remote.get(l.id);
        const open = adapter.busy(l.id);
        if (!state[l.id] && c && !c.trashed && c.upd === l.upd) mark(l.id, c.rev, c.upd);
        const s = state[l.id];
        const dirty = !s || s.upd !== l.upd;
        if (!c) {
          if (!s) await upload(l.id, l.upd, 0);
          else if (!open) {
            // Borrado definitivamente en la nube. Si aquí había cambios, se conservan como documento nuevo.
            if (dirty) { await adapter.fork(l.id); summary.forked += 1; again = true; }
            await adapter.remove(l.id);
            unmark(l.id);
            summary.removed += 1;
          }
        } else if (c.trashed) {
          if (open) continue;
          if (dirty) { await adapter.fork(l.id); summary.forked += 1; again = true; }
          await adapter.remove(l.id);
          unmark(l.id);
          summary.removed += 1;
        } else if (s && s.rev === c.rev) {
          if (dirty) await upload(l.id, l.upd, c.rev);
        } else if (!open) {
          // La nube tiene otra versión. Si aquí también hay cambios, se guardan los dos.
          if (dirty) { await adapter.fork(l.id); summary.forked += 1; again = true; }
          await download(c);
        }
      }
      for (const c of remote.values()) if (!c.trashed && !here.has(c.id)) await download(c);

      status.state = 'ok';
      status.at = Date.now();
      status.error = '';
    } catch (err) {
      status.state = 'error';
      status.error = errorText(err);
    } finally {
      busy = false;
    }
    adapter.done?.(summary);
    if (again) { again = false; schedule(adapter, 300); }
  }

  function schedule(adapter, delay = 4000) {
    if (!account) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync(adapter), delay);
  }

  // Hoja «Cuenta» de TextCTRL y SheetCTRL: `back` es el fondo de una hoja de la app.
  function accountSheet(back, { title, close, adapter, onChange, esc }) {
    if (account) {
      const when = status.at ? new Date(status.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      back.innerHTML = `
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Nube">
          <h2 class="sheet-title">Nube</h2>
          <p class="small">Conectado a CloudCTRL como <b>${esc(account.username)}</b>.</p>
          <p class="small muted">${status.state === 'error' ? esc(status.error) : when ? `Última sincronización: ${when}.` : 'Aún sin sincronizar.'}</p>
          <p class="small muted">Tus ${title} se guardan aquí y en la nube, cifrados. Si desconectas, se quedan en este dispositivo y dejan de sincronizarse.</p>
          <div class="sheet-actions">
            <button type="button" class="ghost-btn" data-logout>Desconectar</button>
            <button type="button" class="done-btn" data-now>Sincronizar ahora</button>
          </div>
        </div>`;
      back.querySelector('[data-logout]').addEventListener('click', () => { logout(); close(); onChange(); });
      back.querySelector('[data-now]').addEventListener('click', () => { close(); sync(adapter); });
      return;
    }
    back.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Conectar con la nube">
        <h2 class="sheet-title">Conectar con la nube</h2>
        <p class="small muted">Entra con tu cuenta de CloudCTRL y tus ${title} se guardarán también en la nube, cifrados. Si no la tienes, créala antes en CloudCTRL.</p>
        <label class="field"><span>Usuario</span><input id="cl-user" autocomplete="username" autocapitalize="none" autocorrect="off" /></label>
        <label class="field"><span>Contraseña</span><input id="cl-pass" type="password" autocomplete="current-password" /></label>
        <p class="small" id="cl-err" hidden></p>
        <div class="sheet-actions">
          <a class="ghost-btn" href="${ORIGIN}/" target="_blank" rel="noopener">Abrir CloudCTRL</a>
          <button type="button" class="done-btn" data-go>Conectar</button>
        </div>
      </div>`;
    const go = back.querySelector('[data-go]');
    go.addEventListener('click', async () => {
      const username = back.querySelector('#cl-user').value;
      const password = back.querySelector('#cl-pass').value;
      if (!username.trim() || !password) return;
      go.disabled = true;
      go.textContent = 'Conectando…';
      try {
        await connect(username, password);
        close();
        onChange();
        sync(adapter);
      } catch (err) {
        go.disabled = false;
        go.textContent = 'Conectar';
        const el = back.querySelector('#cl-err');
        el.hidden = false;
        el.textContent = errorText(err);
      }
    });
  }

  return {
    ORIGIN, status, errorText, connect, logout, list, put, get, trash, restore, purge, forget, sync, schedule, accountSheet,
    get account() { return account; },
  };
})();
