/**
 * QR codes: generate (payload formats, SVG preview path, PNG export) and keep a local
 * history of scanned codes with CSV export. Everything stays on the device.
 */
import { Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import qrcode from 'qrcode-generator';

import { makeSurface } from './skiaImage';

// ---------------------------------------------------------------- Generate

export type QrKind = 'text' | 'link' | 'wifi' | 'contact' | 'phone' | 'email' | 'sms';

export type QrFields = {
  text?: string;
  url?: string;
  ssid?: string;
  password?: string;
  security?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  message?: string;
};

/** Wi-Fi QR fields escape \ ; , : and " with a backslash. */
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
const vEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** The text encoded in the QR code for each kind. Empty string means "not enough input yet". */
export function qrPayload(kind: QrKind, f: QrFields): string {
  const t = (s?: string) => (s ?? '').trim();
  switch (kind) {
    case 'link': {
      const url = t(f.url);
      if (!url) return '';
      // Keep a real scheme (https://…, mailto:…). "example.com:8080/x" or "localhost:3000"
      // only look like one: without https:// scanners treat them as plain text, not links.
      const hasScheme =
        /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || /^(mailto|tel|sms|smsto|geo|market|whatsapp|bitcoin):/i.test(url);
      return hasScheme ? url : `https://${url}`;
    }
    case 'wifi': {
      if (!t(f.ssid)) return '';
      const sec = f.security ?? 'WPA';
      // A secured network with no password can't be joined: wait for it (or "No password").
      if (sec !== 'nopass' && !(f.password ?? '')) return '';
      const pass = sec === 'nopass' ? '' : `P:${wifiEscape(f.password ?? '')};`;
      return `WIFI:T:${sec};S:${wifiEscape(t(f.ssid))};${pass}${f.hidden ? 'H:true;' : ''};`;
    }
    case 'contact': {
      if (!t(f.name) && !t(f.phone) && !t(f.email)) return '';
      const parts = t(f.name).split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '';
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${vEscape(last)};${vEscape(first)};;;`,
        `FN:${vEscape(t(f.name) || t(f.company) || 'Contact')}`,
        t(f.company) && `ORG:${vEscape(t(f.company))}`,
        t(f.phone) && `TEL;TYPE=CELL:${t(f.phone)}`,
        t(f.email) && `EMAIL:${t(f.email)}`,
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'phone':
      return t(f.phone) ? `tel:${t(f.phone).replace(/[^\d+]/g, '')}` : '';
    case 'email':
      return t(f.email) ? `mailto:${t(f.email)}` : '';
    case 'sms':
      return t(f.phone) ? `SMSTO:${t(f.phone).replace(/[^\d+]/g, '')}:${f.message ?? ''}` : '';
    default:
      return f.text ?? '';
  }
}

/** QR module grid (true = dark). Throws if the text is too long for a QR code. */
export function qrMatrix(text: string): boolean[][] {
  // UTF-8, so Urdu, Hindi and emoji encode correctly.
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const code = qrcode(0, 'M');
  code.addData(text, 'Byte');
  try {
    code.make();
  } catch {
    throw new Error('This is too long for a QR code. Shorten the text.');
  }
  const n = code.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => code.isDark(r, c)));
}

/** One SVG path for all dark modules, in module units (viewBox 0 0 n n). */
export function qrSvgPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${c} ${r}h1v1h-1z`;
    }),
  );
  return d;
}

/** Renders the QR code to a PNG in the cache (white quiet zone of 4 modules) and returns its uri. */
export function saveQrPng(matrix: boolean[][], name = 'qr-code'): string {
  const n = matrix.length;
  const quiet = 4;
  const cell = Math.max(8, Math.floor(1024 / (n + quiet * 2)));
  const size = (n + quiet * 2) * cell;
  const surface = makeSurface(size, size);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  const path = Skia.Path.Make();
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) path.addRect(Skia.XYWHRect((c + quiet) * cell, (r + quiet) * cell, cell, cell));
    }),
  );
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('black'));
  paint.setAntiAlias(false);
  canvas.drawPath(path, paint);
  surface.flush();
  const png = surface.makeImageSnapshot().encodeToBytes();
  const safe = name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'qr-code';
  const file = new File(Paths.cache, `${safe}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(png);
  return file.uri;
}

export async function shareQrPng(uri: string) {
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share QR code' });
}

// ---------------------------------------------------------------- History

/** ML Kit's numeric barcode formats (Android photo scans report these instead of names). */
const MLKIT_FORMATS: Record<number, string> = {
  1: 'code128',
  2: 'code39',
  4: 'code93',
  8: 'codabar',
  16: 'datamatrix',
  32: 'ean13',
  64: 'ean8',
  128: 'itf14',
  256: 'qr',
  512: 'upc_a',
  1024: 'upc_e',
  2048: 'pdf417',
  4096: 'aztec',
};

/** A barcode format name ("qr", "ean13"…) whatever form the scanner reported it in. */
export function formatName(type: unknown): string {
  if (typeof type === 'number') return MLKIT_FORMATS[type] ?? 'unknown';
  const s = String(type ?? '').trim();
  if (/^\d+$/.test(s)) return MLKIT_FORMATS[Number(s)] ?? 'unknown';
  return s || 'qr';
}

export type QrHistoryItem = {
  id: string;
  /** Raw scanned content. */
  content: string;
  /** Barcode format, e.g. "qr", "ean13". */
  format: string;
  scannedAt: number;
};

const HISTORY_LIMIT = 500;
const historyFile = () => new File(Paths.document, 'qr-history.json');

export function loadQrHistory(): QrHistoryItem[] {
  try {
    const file = historyFile();
    return file.exists ? (JSON.parse(file.textSync()) as QrHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: QrHistoryItem[]) {
  const file = historyFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(items.slice(0, HISTORY_LIMIT)));
}

/** Adds a scan to the top of the history. A repeat of the newest item only refreshes its time. */
export function addQrHistory(content: string, format: string): QrHistoryItem[] {
  const items = loadQrHistory();
  if (items[0]?.content === content) {
    items[0].scannedAt = Date.now();
  } else {
    items.unshift({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      format: formatName(format),
      scannedAt: Date.now(),
    });
  }
  writeHistory(items);
  return items;
}

export function removeQrHistory(id?: string): QrHistoryItem[] {
  const items = id ? loadQrHistory().filter((i) => i.id !== id) : [];
  writeHistory(items);
  return items;
}

/** RFC 4180 CSV, with a BOM so Excel opens Urdu/Hindi text correctly. */
export function qrHistoryCsv(items: QrHistoryItem[]): string {
  const cell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = items.map((i) =>
    [new Date(i.scannedAt).toISOString(), formatName(i.format), i.content].map(cell).join(','),
  );
  return '\uFEFF' + ['Scanned at,Format,Content', ...rows].join('\r\n') + '\r\n';
}

export async function shareQrHistoryCsv(items: QrHistoryItem[]) {
  const file = new File(Paths.cache, `ScanKaro-QR-history-${new Date().toISOString().slice(0, 10)}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(new TextEncoder().encode(qrHistoryCsv(items)));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'QR scan history' });
}
