/**
 * Expiry reminders for documents (passports, IDs, insurance, contracts…), as local
 * notifications on the phone: 30 days before, 7 days before and on the day.
 * No server: the schedule is rebuilt from the documents' expiry dates.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DocumentItem } from '../types';

const CHANNEL = 'expiry-reminders';
const PREFIX = 'expiry:';
/** Days before expiry to remind, and the message for each. */
const STEPS: { days: number; body: (title: string) => string }[] = [
  { days: 30, body: (t) => `"${t}" expires in 30 days.` },
  { days: 7, body: (t) => `"${t}" expires in a week.` },
  { days: 0, body: (t) => `"${t}" expires today.` },
];
/** Reminders fire at 9 am local time. */
const REMIND_HOUR = 9;

let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Document expiry reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks for notification permission (only when the user sets an expiry date). */
export async function ensureReminderPermission(): Promise<boolean> {
  configure();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Start of the given day at REMIND_HOUR, local time. */
function remindAt(expiresAt: number, daysBefore: number) {
  const d = new Date(expiresAt);
  d.setDate(d.getDate() - daysBefore);
  d.setHours(REMIND_HOUR, 0, 0, 0);
  return d;
}

/**
 * Rebuilds all expiry reminders from the documents. Safe to call often (app start, after
 * any change); does nothing without notification permission.
 */
export async function syncReminders(documents: DocumentItem[]) {
  configure();
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    const now = Date.now();
    for (const doc of documents) {
      if (!doc.expiresAt) continue;
      for (const step of STEPS) {
        const date = remindAt(doc.expiresAt, step.days);
        if (date.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${doc.id}:${step.days}`,
          content: {
            title: step.days === 0 ? 'Expires today' : 'Expiring soon',
            body: step.body(doc.title),
            data: { documentId: doc.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
        });
      }
    }
  } catch {
    // Reminders are a convenience; never let them break the library.
  }
}

/** Opens the document when a reminder is tapped. Returns an unsubscribe function. */
export function onReminderTapped(open: (documentId: string) => void) {
  configure();
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.content.data?.documentId;
    if (typeof id === 'string') open(id);
  });
  return () => sub.remove();
}

/** Whole days until expiry (negative when expired). */
export function daysUntil(expiresAt: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(expiresAt);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function expiryLabel(expiresAt: number) {
  const days = daysUntil(expiresAt);
  if (days < 0) return `Expired ${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 60) return `Expires in ${days} days`;
  return `Expires ${new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
