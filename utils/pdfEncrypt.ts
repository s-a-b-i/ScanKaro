/**
 * PDF password protection: the PDF standard security handler, revision 4 with AES-128
 * (/V 4 /R 4 /CFM /AESV2), as defined in ISO 32000-1 §7.6. Opens in every common reader
 * (Adobe, Chrome, Edge, Android/Drive, Apple Preview) after entering the password.
 *
 * Pure JavaScript (MD5, RC4, AES-128) so it needs no native module. pdf-lib cannot
 * encrypt, so every string and stream is encrypted in place before a classic save.
 */
import { getRandomBytes } from 'expo-crypto';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
} from 'pdf-lib';

// ---------------------------------------------------------------- MD5 (RFC 1321)

const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const padded = new Uint8Array((((data.length + 8) >> 6) + 1) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const m = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(off + i * 4, true);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const s = MD5_S[(i >> 4) * 4 + (i % 4)];
      const sum = (a + f + MD5_K[i] + m[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << s) | (sum >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
  return out;
}

// ---------------------------------------------------------------- RC4

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = new Uint8Array(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

// ---------------------------------------------------------------- AES-128 (FIPS-197), CBC

const SBOX = (() => {
  const box = new Uint8Array(256);
  let p = 1;
  let q = 1;
  do {
    // p walks GF(2^8) multiplying by 3; q tracks its inverse (dividing by 3).
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    box[p] = (x ^ 0x63) & 0xff;
  } while (p !== 1);
  box[0] = 0x63;
  return box;
})();

const xtime = (b: number) => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;

function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key);
  let rcon = 1;
  for (let i = 16; i < 176; i += 4) {
    let t0 = w[i - 4];
    let t1 = w[i - 3];
    let t2 = w[i - 2];
    let t3 = w[i - 1];
    if (i % 16 === 0) {
      [t0, t1, t2, t3] = [SBOX[t1] ^ rcon, SBOX[t2], SBOX[t3], SBOX[t0]];
      rcon = xtime(rcon);
    }
    w[i] = w[i - 16] ^ t0;
    w[i + 1] = w[i - 15] ^ t1;
    w[i + 2] = w[i - 14] ^ t2;
    w[i + 3] = w[i - 13] ^ t3;
  }
  return w;
}

function encryptBlock(state: Uint8Array, w: Uint8Array) {
  for (let i = 0; i < 16; i++) state[i] ^= w[i];
  const t = new Uint8Array(16);
  for (let round = 1; round <= 10; round++) {
    // SubBytes + ShiftRows (column-major state: byte r + 4c).
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) t[r + 4 * c] = SBOX[state[r + 4 * ((c + r) % 4)]];
    }
    if (round < 10) {
      for (let c = 0; c < 4; c++) {
        const a0 = t[4 * c];
        const a1 = t[4 * c + 1];
        const a2 = t[4 * c + 2];
        const a3 = t[4 * c + 3];
        const all = a0 ^ a1 ^ a2 ^ a3;
        state[4 * c] = a0 ^ all ^ xtime(a0 ^ a1);
        state[4 * c + 1] = a1 ^ all ^ xtime(a1 ^ a2);
        state[4 * c + 2] = a2 ^ all ^ xtime(a2 ^ a3);
        state[4 * c + 3] = a3 ^ all ^ xtime(a3 ^ a0);
      }
    } else {
      state.set(t);
    }
    for (let i = 0; i < 16; i++) state[i] ^= w[round * 16 + i];
  }
}

/** AES-128-CBC with PKCS#7 padding and a random IV in front, as /AESV2 requires. */
export function aesCbcEncrypt(key: Uint8Array, data: Uint8Array, iv: Uint8Array = getRandomBytes(16)): Uint8Array {
  const w = expandKey(key);
  const pad = 16 - (data.length % 16);
  const out = new Uint8Array(16 + data.length + pad);
  out.set(iv);
  const block = new Uint8Array(16);
  let prev = iv;
  for (let off = 0; off < data.length + pad; off += 16) {
    for (let i = 0; i < 16; i++) {
      const n = off + i;
      block[i] = (n < data.length ? data[n] : pad) ^ prev[i];
    }
    encryptBlock(block, w);
    out.set(block, 16 + off);
    prev = out.subarray(16 + off, 32 + off);
  }
  return out;
}

// ---------------------------------------------------------------- Standard security handler

const PASSWORD_PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00,
  0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);
/** All permissions (print, copy, edit…) once opened: the password only guards opening. */
const PERMISSIONS = -4;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

function padPassword(password: string) {
  // Revision 4 passwords are PDFDocEncoding; printable ASCII is identical in it.
  const bytes = Uint8Array.from(password.slice(0, 32), (ch) => ch.charCodeAt(0));
  return concat(bytes, PASSWORD_PAD.subarray(0, 32 - bytes.length));
}

const int32le = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, n, true);
  return b;
};

/** Algorithm 3: the /O entry. */
function ownerEntry(owner: Uint8Array, user: Uint8Array) {
  let hash = md5(owner);
  for (let i = 0; i < 50; i++) hash = md5(hash);
  let out = rc4(hash, user);
  for (let i = 1; i <= 19; i++) out = rc4(hash.map((b) => b ^ i), out);
  return out;
}

/** Algorithm 2: the file encryption key. */
function fileKey(user: Uint8Array, o: Uint8Array, id: Uint8Array) {
  let hash = md5(concat(user, o, int32le(PERMISSIONS), id));
  for (let i = 0; i < 50; i++) hash = md5(hash);
  return hash;
}

/** Algorithm 5: the /U entry (16 bytes of hash, 16 bytes of arbitrary padding). */
function userEntry(key: Uint8Array, id: Uint8Array) {
  let out = rc4(key, md5(concat(PASSWORD_PAD, id)));
  for (let i = 1; i <= 19; i++) out = rc4(key.map((b) => b ^ i), out);
  return concat(out, new Uint8Array(16));
}

/** Algorithm 1 (AES variant): the key for one object. */
function objectKey(key: Uint8Array, ref: PDFRef) {
  const n = ref.objectNumber;
  const g = ref.generationNumber;
  const salt = Uint8Array.from([0x73, 0x41, 0x6c, 0x54]); // "sAlT"
  return md5(concat(key, Uint8Array.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, (g >> 8) & 255]), salt));
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function encryptValue(value: PDFObject, key: Uint8Array): PDFObject {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return PDFHexString.of(toHex(aesCbcEncrypt(key, value.asBytes())));
  }
  if (value instanceof PDFArray) {
    for (let i = 0; i < value.size(); i++) value.set(i, encryptValue(value.get(i), key));
    return value;
  }
  if (value instanceof PDFDict) {
    for (const [name, item] of value.entries()) value.set(name, encryptValue(item, key));
    return value;
  }
  if (value instanceof PDFStream) {
    encryptValue(value.dict, key);
    // getContents() is the stream's data as stored (already compressed when filtered).
    return PDFRawStream.of(value.dict, aesCbcEncrypt(key, value.getContents()));
  }
  return value;
}

/** Only these characters are allowed, so every reader decodes the password the same way. */
export const PDF_PASSWORD_RULE = /^[\x20-\x7e]{4,32}$/;

/**
 * Encrypts `doc` in place with `password` and returns the saved bytes.
 * The document must not be used afterwards.
 */
export async function savePasswordProtected(doc: PDFDocument, password: string): Promise<Uint8Array> {
  if (!PDF_PASSWORD_RULE.test(password)) {
    throw new Error('Use 4–32 characters: English letters, numbers and symbols.');
  }
  const context = doc.context;
  if (context.trailerInfo.Encrypt) throw new Error('This PDF already has a password.');

  // Embed fonts and images now, so they are encrypted too.
  await doc.flush();

  const id = getRandomBytes(16);
  const user = padPassword(password);
  const o = ownerEntry(user, user);
  const key = fileKey(user, o, id);
  const u = userEntry(key, id);

  for (const [ref, object] of context.enumerateIndirectObjects()) {
    const encrypted = encryptValue(object, objectKey(key, ref));
    if (encrypted !== object) context.assign(ref, encrypted);
  }

  const cryptFilter = context.obj({ AuthEvent: 'DocOpen', CFM: 'AESV2', Length: 16 });
  const encryptDict = context.obj({
    Filter: 'Standard',
    V: 4,
    R: 4,
    Length: 128,
    CF: context.obj({ StdCF: cryptFilter }),
    StmF: 'StdCF',
    StrF: 'StdCF',
    O: PDFHexString.of(toHex(o)),
    U: PDFHexString.of(toHex(u)),
    P: PDFNumber.of(PERMISSIONS),
  });
  encryptDict.set(PDFName.of('EncryptMetadata'), context.obj(true));
  context.trailerInfo.Encrypt = context.register(encryptDict);
  const idHex = PDFHexString.of(toHex(id));
  context.trailerInfo.ID = context.obj([idHex, idHex]);

  // Classic cross-reference table: object streams would need their own handling.
  return doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
}
