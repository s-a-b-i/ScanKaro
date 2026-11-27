/**
 * Business card reading: turns recognised card text into contact fields and a vCard
 * that Android's Contacts app (or any contacts app) can import.
 */
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type CardContact = {
  name: string;
  jobTitle: string;
  company: string;
  phones: string[];
  email: string;
  website: string;
  address: string;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const WEBSITE = /\b((?:https?:\/\/)?(?:www\.)[^\s,;]+|(?:https?:\/\/)[^\s,;]+|[a-z0-9-]+\.(?:com|net|org|pk|in|ae|co|io|biz|info|uk|us)(?:\.[a-z]{2})?(?:\/[^\s,;]*)?)\b/i;
const PHONE = /(?:\+|00|\()?\d[\d\s().-]{6,}\d/g;
const HAS_PHONE = /(?:\+|00|\()?\d[\d\s().-]{6,}\d/;
const JOB_WORDS =
  /\b(ceo|cto|cfo|coo|founder|co-founder|director|manager|head|engineer|developer|designer|consultant|officer|president|partner|owner|executive|specialist|analyst|lead|sales|marketing|advocate|doctor|dr\.|architect|accountant|proprietor|chairman|supervisor|coordinator|representative|agent)\b/i;
const COMPANY_WORDS =
  /\b(ltd|limited|pvt|private|inc|llc|llp|corp|corporation|company|co\.|group|industries|technologies|technology|solutions|services|enterprises|traders|associates|studio|agency|bank|hospital|clinic|school|university|international|global|systems)\b/i;
const ADDRESS_WORDS =
  /\b(street|st\.|road|rd\.|avenue|ave|block|sector|floor|suite|plaza|tower|building|near|town|city|phase|lane|house|office|p\.?o\.? box|karachi|lahore|islamabad|rawalpindi|dubai|delhi|mumbai)\b/i;
const LABEL = /^(tel|phone|ph|mob|mobile|cell|fax|off|office|whatsapp|t|m|p|e|email|e-mail|w|web|website|address|add)\s*[:.]\s*/i;

const digitsOf = (s: string) => s.replace(/\D/g, '');

export function parseCardText(text: string): CardContact {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const email = text.match(EMAIL)?.[0] ?? '';

  // Phones: 7–15 digits, skip fax lines, de-duplicate.
  const phones: string[] = [];
  for (const line of lines) {
    if (/\bfax\b/i.test(line)) continue;
    for (const m of line.replace(EMAIL, ' ').match(PHONE) ?? []) {
      const d = digitsOf(m);
      if (d.length >= 7 && d.length <= 15 && !phones.some((p) => digitsOf(p) === d)) phones.push(m.trim());
    }
  }

  let website = '';
  for (const line of lines) {
    const candidate = line.replace(EMAIL, ' ').match(WEBSITE)?.[0];
    if (candidate) {
      website = candidate;
      break;
    }
  }

  const used = (line: string) =>
    (email && line.includes(email)) ||
    (website && line.includes(website)) ||
    (HAS_PHONE.test(line) && digitsOf(line).length >= 7);

  const rest = lines.filter((l) => !used(l));

  const jobTitle = rest.find((l) => JOB_WORDS.test(l)) ?? '';
  const companyIndex = rest.findIndex((l) => l !== jobTitle && COMPANY_WORDS.test(l));
  const companyLines = companyIndex >= 0 ? [rest[companyIndex]] : [];
  // A brand word printed on the line above ("BYTEGENS" / "TECHNOLOGIES PVT LTD") belongs to it.
  const above = rest[companyIndex - 1];
  if (
    companyIndex > 0 &&
    above !== jobTitle &&
    !/\d/.test(above) &&
    above.split(' ').length <= 2 &&
    /^[\p{L}&.' -]+$/u.test(above) &&
    COMPANY_WORDS.test(rest[companyIndex]) &&
    rest[companyIndex].split(' ').every((w) => COMPANY_WORDS.test(w) || w === '&')
  ) {
    companyLines.unshift(above);
  }
  const company = companyLines.join(' ');
  const addressLines = rest.filter(
    (l) =>
      l !== jobTitle &&
      !companyLines.includes(l) &&
      (ADDRESS_WORDS.test(l) || (/\d/.test(l) && l.includes(','))),
  );

  // Name: the first short line of plain words (2–4 words, no digits) that is nothing else.
  const name =
    rest.find(
      (l) =>
        l !== jobTitle &&
        !companyLines.includes(l) &&
        !addressLines.includes(l) &&
        !/\d/.test(l) &&
        /^[\p{L}.' -]+$/u.test(l) &&
        l.split(' ').length >= 2 &&
        l.split(' ').length <= 4,
    ) ?? '';

  return {
    name: toNameCase(name),
    jobTitle,
    company,
    phones: phones.slice(0, 3),
    email,
    website,
    address: addressLines.map((l) => l.replace(LABEL, '')).join(', '),
  };
}

/** "MUHAMMAD ALI" -> "Muhammad Ali"; leaves mixed-case names alone. */
function toNameCase(name: string) {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const vEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function toVCard(c: CardContact): string {
  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${vEscape(last)};${vEscape(first)};;;`,
    `FN:${vEscape(c.name.trim() || c.company.trim() || 'Contact')}`,
    c.company.trim() && `ORG:${vEscape(c.company.trim())}`,
    c.jobTitle.trim() && `TITLE:${vEscape(c.jobTitle.trim())}`,
    ...c.phones.filter((p) => p.trim()).map((p, i) => `TEL;TYPE=${i === 0 ? 'CELL' : 'WORK'}:${p.trim()}`),
    c.email.trim() && `EMAIL;TYPE=INTERNET:${c.email.trim()}`,
    c.website.trim() && `URL:${c.website.trim()}`,
    c.address.trim() && `ADR;TYPE=WORK:;;${vEscape(c.address.trim())};;;;`,
    'END:VCARD',
  ];
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

/** Opens the share sheet with a .vcf; choose Contacts to save it. */
export async function shareVCard(c: CardContact) {
  const safe = (c.name || c.company || 'Contact').replace(/[\/:*?"<>|]+/g, ' ').trim();
  const file = new File(Paths.cache, `${safe}.vcf`);
  if (file.exists) file.delete();
  file.create();
  file.write(toVCard(c));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/x-vcard', dialogTitle: 'Save contact' });
}

/**
 * Opens the phone's own "New contact" form with the fields filled in (Android).
 * Needs no contacts permission: the user reviews and saves in the Contacts app.
 * Returns false where that is not possible, so callers can fall back to a .vcf.
 */
export async function openNewContactForm(c: CardContact): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const extra: Record<string, string | number> = {};
  const put = (key: string, value: string | undefined) => {
    if (value?.trim()) extra[key] = value.trim();
  };
  put('name', c.name || c.company);
  put('company', c.company);
  put('job_title', c.jobTitle);
  put('phone', c.phones[0]);
  if (c.phones[0]?.trim()) extra.phone_type = 2; // Mobile
  put('secondary_phone', c.phones[1]);
  put('email', c.email);
  put('postal', c.address);
  // The insert form has no website field; keep it in the notes.
  put('notes', c.website ? `Website: ${c.website}` : '');
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
      type: 'vnd.android.cursor.dir/raw_contact',
      extra,
    });
    return true;
  } catch {
    return false;
  }
}
