/**
 * Web stand-in for expo-file-system (see metro.config.js), so the app can be opened in a
 * browser to check UI. expo-file-system has no web support, and the app keeps its library,
 * drafts, trash and settings files through it, so without this the web app crashes on start.
 *
 * Same File / Directory / Paths API the app uses, kept in memory. Small text files (the
 * JSON indexes, e.g. folders you create) are also saved in localStorage so they survive a
 * reload; images are not. Scanning, OCR and PDF tools stay phone-only.
 */

const STORE_KEY = 'scankaro-web-fs';
const DOC = '/web/document/';
const CACHE = '/web/cache/';

/** path -> string | Uint8Array */
const files = new Map();
const dirs = new Set(['/', '/web/', DOC, CACHE]);

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) ?? 'null');
    if (!saved) return;
    for (const d of saved.dirs ?? []) dirs.add(d);
    for (const [p, text] of Object.entries(saved.files ?? {})) files.set(p, text);
  } catch {
    // Storage blocked or corrupt: start empty.
  }
}

function persist() {
  try {
    const text = {};
    for (const [p, c] of files) if (typeof c === 'string' && c.length < 200_000) text[p] = c;
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify({ dirs: [...dirs], files: text }));
  } catch {
    // Quota or blocked: keep working in memory.
  }
}

load();

const notOnWeb = (what) => new Error(`${what} is only available in the phone app.`);

function toPath(uri) {
  let p = String(uri).replace(/^file:\/*/, '/');
  try {
    p = decodeURI(p);
  } catch {
    // keep
  }
  return p;
}

function joinParts(parts) {
  let base = '';
  for (const part of parts) {
    if (part == null) continue;
    if (typeof part === 'string') {
      if (!base || /^file:|^\//.test(part)) base = toPath(part);
      else base = (base.endsWith('/') ? base : `${base}/`) + part.replace(/^\/+/, '');
    } else {
      base = part._path;
    }
  }
  return base;
}

const parentOf = (path) => path.replace(/\/+$/, '').replace(/[^/]*$/, '');

function ensureParent(path, intermediates) {
  const parent = parentOf(path);
  if (dirs.has(parent)) return;
  if (!intermediates) throw new Error(`Folder does not exist: ${parent}`);
  let acc = '/';
  for (const seg of parent.split('/').filter(Boolean)) {
    acc += `${seg}/`;
    dirs.add(acc);
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const asBytes = (c) => (typeof c === 'string' ? encoder.encode(c) : c);
const asText = (c) => (typeof c === 'string' ? c : decoder.decode(c));

export class File {
  constructor(...parts) {
    if (parts.length === 1 && typeof parts[0] === 'string' && /^(blob|data|https?):/.test(parts[0])) {
      this._external = parts[0];
      this._path = parts[0];
      return;
    }
    this._path = joinParts(parts).replace(/\/+$/, '');
  }

  get uri() {
    return this._external ?? `file://${this._path}`;
  }

  get name() {
    return this._path.split('/').pop();
  }

  get extension() {
    const m = /\.[^./]+$/.exec(this.name);
    return m ? m[0] : '';
  }

  get exists() {
    // Photos picked or captured in a browser are blob:/data:/http(s) URLs, not files.
    // Count them as existing so scans and drafts made on web keep their pages.
    return this._external != null || files.has(this._path);
  }

  get size() {
    if (this._external != null) return null;
    const c = files.get(this._path);
    return c == null ? null : asBytes(c).length;
  }

  get parentDirectory() {
    return new Directory(`file://${parentOf(this._path)}`);
  }

  get contentUri() {
    return this.uri;
  }

  create(options = {}) {
    ensureParent(this._path, options.intermediates);
    if (files.has(this._path) && !options.overwrite) throw new Error(`File already exists: ${this._path}`);
    files.set(this._path, '');
    persist();
  }

  write(content) {
    ensureParent(this._path, true);
    files.set(this._path, typeof content === 'string' ? content : new Uint8Array(content));
    persist();
  }

  textSync() {
    if (!files.has(this._path)) throw new Error(`File does not exist: ${this._path}`);
    return asText(files.get(this._path));
  }

  async text() {
    return this.textSync();
  }

  bytesSync() {
    if (!files.has(this._path)) throw new Error(`File does not exist: ${this._path}`);
    return asBytes(files.get(this._path));
  }

  async bytes() {
    return this.bytesSync();
  }

  base64Sync() {
    let s = '';
    for (const b of this.bytesSync()) s += String.fromCharCode(b);
    return btoa(s);
  }

  async base64() {
    return this.base64Sync();
  }

  copy(dest) {
    if (!files.has(this._path)) throw notOnWeb('Copying this file');
    const target = dest instanceof Directory ? `${dest._path}${this.name}` : dest._path;
    ensureParent(target, true);
    files.set(target, files.get(this._path));
    persist();
  }

  move(dest) {
    this.copy(dest);
    files.delete(this._path);
    this._path = dest instanceof Directory ? `${dest._path}${this.name}` : dest._path;
    persist();
  }

  delete() {
    if (!files.delete(this._path)) throw new Error(`File does not exist: ${this._path}`);
    persist();
  }

  open() {
    throw notOnWeb('Reading or writing large files');
  }
}

export class Directory {
  constructor(...parts) {
    const p = joinParts(parts);
    this._path = p.endsWith('/') ? p : `${p}/`;
  }

  get uri() {
    return `file://${this._path}`;
  }

  get name() {
    return this._path.replace(/\/+$/, '').split('/').pop();
  }

  get exists() {
    return dirs.has(this._path);
  }

  get size() {
    let total = 0;
    for (const [p, c] of files) if (p.startsWith(this._path)) total += asBytes(c).length;
    return total;
  }

  get parentDirectory() {
    return new Directory(`file://${parentOf(this._path)}`);
  }

  create(options = {}) {
    if (dirs.has(this._path)) {
      if (options.idempotent) return;
      throw new Error(`Folder already exists: ${this._path}`);
    }
    ensureParent(this._path, options.intermediates);
    dirs.add(this._path);
    persist();
  }

  list() {
    const out = [];
    for (const d of dirs) {
      if (d !== this._path && d.startsWith(this._path) && !d.slice(this._path.length, -1).includes('/')) {
        out.push(new Directory(`file://${d}`));
      }
    }
    for (const p of files.keys()) {
      if (p.startsWith(this._path) && !p.slice(this._path.length).includes('/')) out.push(new File(`file://${p}`));
    }
    return out;
  }

  copy(dest) {
    const target = dest._path;
    for (const d of [...dirs]) if (d.startsWith(this._path)) dirs.add(target + d.slice(this._path.length));
    for (const [p, c] of [...files]) if (p.startsWith(this._path)) files.set(target + p.slice(this._path.length), c);
    dirs.add(target);
    persist();
  }

  move(dest) {
    this.copy(dest);
    this.delete();
    this._path = dest._path;
  }

  delete() {
    for (const p of [...files.keys()]) if (p.startsWith(this._path)) files.delete(p);
    for (const d of [...dirs]) if (d.startsWith(this._path)) dirs.delete(d);
    persist();
  }
}

export const Paths = {
  get document() {
    return new Directory(`file://${DOC}`);
  },
  get cache() {
    return new Directory(`file://${CACHE}`);
  },
  get availableDiskSpace() {
    return 0;
  },
  get totalDiskSpace() {
    return 0;
  },
};

export default { File, Directory, Paths };
