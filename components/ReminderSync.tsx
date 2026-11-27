import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useApp } from '../context/AppProvider';
import { onReminderTapped, syncReminders } from '../utils/reminders';

/** Keeps expiry reminders in step with the library, and opens a document from its reminder. */
export function ReminderSync() {
  const router = useRouter();
  const { documents } = useApp();

  // Only expiry dates and titles matter, so only re-sync when those change.
  const key = documents
    .filter((d) => d.expiresAt)
    .map((d) => `${d.id}:${d.expiresAt}:${d.title}`)
    .join('|');

  useEffect(() => {
    void syncReminders(documents.filter((d) => d.expiresAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => onReminderTapped((id) => router.push(`/document/${id}`)), [router]);

  return null;
}
