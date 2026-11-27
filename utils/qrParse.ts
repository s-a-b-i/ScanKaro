/**
 * Understands scanned QR/barcode content: links, Wi-Fi, phone, email, SMS, contact cards
 * and product codes, with the matching action for each.
 */
import { ComponentProps } from 'react';
import { Alert, Linking } from 'react-native';

import { Icon } from '../components/Icon';

type IconName = ComponentProps<typeof Icon>['name'];

export type Parsed = {
  kind: 'link' | 'wifi' | 'phone' | 'email' | 'sms' | 'contact' | 'text' | 'product';
  title: string;
  icon: IconName;
  /** Label/value rows shown to the user. */
  fields: { label: string; value: string }[];
  /** Main action, e.g. open the link. */
  action?: { label: string; icon: IconName; run: () => void };
  /** What "Copy" copies. */
  copy: string;
};

/** Splits "KEY:value;KEY:value" (Wi-Fi QR format), honouring backslash escapes. */
function wifiFields(body: string) {
  const out: Record<string, string> = {};
  let key = '';
  let value = '';
  let inKey = true;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      if (inKey) key += body[++i];
      else value += body[++i];
    } else if (inKey && c === ':') inKey = false;
    else if (!inKey && c === ';') {
      out[key.toUpperCase()] = value;
      key = '';
      value = '';
      inKey = true;
    } else if (inKey) key += c;
    else value += c;
  }
  if (key) out[key.toUpperCase()] = value;
  return out;
}

const open = (url: string) => () => {
  Linking.openURL(url).catch(() => Alert.alert('Cannot open', 'No app on this phone can open this.'));
};

export function parseCode(data: string, type: string): Parsed {
  const text = data.trim();
  const lower = text.toLowerCase();

  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
    const url = lower.startsWith('www.') ? `https://${text}` : text;
    return {
      kind: 'link',
      title: 'Link',
      icon: 'link',
      fields: [{ label: 'Address', value: text }],
      action: { label: 'Open link', icon: 'open-in-new', run: open(url) },
      copy: text,
    };
  }
  if (lower.startsWith('wifi:')) {
    const f = wifiFields(text.slice(5));
    const fields = [{ label: 'Network', value: f.S || '—' }];
    if (f.P) fields.push({ label: 'Password', value: f.P });
    fields.push({ label: 'Security', value: f.T && f.T !== 'nopass' ? f.T : 'None' });
    return {
      kind: 'wifi',
      title: 'Wi-Fi network',
      icon: 'wifi',
      fields,
      action: {
        label: 'Wi-Fi settings',
        icon: 'settings',
        run: () => void Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => Linking.openSettings()),
      },
      copy: f.P || f.S || text,
    };
  }
  if (lower.startsWith('tel:')) {
    const number = text.slice(4);
    return {
      kind: 'phone',
      title: 'Phone number',
      icon: 'call',
      fields: [{ label: 'Number', value: number }],
      action: { label: 'Call', icon: 'call', run: open(`tel:${number}`) },
      copy: number,
    };
  }
  if (lower.startsWith('mailto:') || lower.startsWith('matmsg:')) {
    const address = lower.startsWith('mailto:') ? text.slice(7).split('?')[0] : (text.match(/TO:([^;]*)/i)?.[1] ?? '');
    return {
      kind: 'email',
      title: 'Email',
      icon: 'mail',
      fields: [{ label: 'To', value: address }],
      action: { label: 'Write email', icon: 'mail', run: open(`mailto:${address}`) },
      copy: address,
    };
  }
  if (lower.startsWith('smsto:') || lower.startsWith('sms:')) {
    const [number, ...rest] = text.slice(text.indexOf(':') + 1).split(':');
    const fields = [{ label: 'To', value: number }];
    if (rest.length) fields.push({ label: 'Message', value: rest.join(':') });
    return {
      kind: 'sms',
      title: 'Text message',
      icon: 'sms',
      fields,
      action: {
        label: 'Send message',
        icon: 'sms',
        run: open(`sms:${number}${rest.length ? `?body=${encodeURIComponent(rest.join(':'))}` : ''}`),
      },
      copy: text,
    };
  }
  if (lower.startsWith('begin:vcard') || lower.startsWith('mecard:')) {
    const pick = (re: RegExp) => text.match(re)?.[1]?.trim();
    const name = pick(/\nFN[^:]*:(.*)/i) ?? pick(/N:([^;\n]*)/i)?.replace(/,/g, ' ');
    const phone = pick(/\nTEL[^:]*:(.*)/i) ?? pick(/TEL:([^;\n]*)/i);
    const email = pick(/\nEMAIL[^:]*:(.*)/i) ?? pick(/EMAIL:([^;\n]*)/i);
    const org = pick(/\nORG[^:]*:(.*)/i);
    const fields = [
      name && { label: 'Name', value: name },
      org && { label: 'Company', value: org.replace(/;/g, ' ') },
      phone && { label: 'Phone', value: phone },
      email && { label: 'Email', value: email },
    ].filter(Boolean) as { label: string; value: string }[];
    return {
      kind: 'contact',
      title: 'Contact',
      icon: 'contact-page',
      fields: fields.length ? fields : [{ label: 'Card', value: text }],
      action: phone ? { label: 'Call', icon: 'call', run: open(`tel:${phone}`) } : undefined,
      copy: [name, phone, email].filter(Boolean).join('\n') || text,
    };
  }
  if (type !== 'qr' && /^\d{8,14}$/.test(text)) {
    return {
      kind: 'product',
      title: 'Product barcode',
      icon: 'qr-code-2',
      fields: [{ label: 'Number', value: text }],
      action: {
        label: 'Search the web',
        icon: 'search',
        run: open(`https://www.google.com/search?q=${encodeURIComponent(text)}`),
      },
      copy: text,
    };
  }
  return { kind: 'text', title: 'Text', icon: 'notes', fields: [{ label: 'Content', value: text }], copy: text };
}
