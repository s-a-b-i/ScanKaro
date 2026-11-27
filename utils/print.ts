/**
 * Printing through Android's print service (any Wi-Fi printer, or "Save as PDF").
 */
import * as Print from 'expo-print';

import { imagesToSheets, PagesPerSheet } from './pdf';

export async function printPages(pageUris: string[], title: string, perSheet: PagesPerSheet) {
  const pdf = await imagesToSheets(pageUris, title, perSheet);
  try {
    await Print.printAsync({ uri: pdf.uri });
  } catch (error) {
    // Closing the print dialog is not an error.
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|did not complete/i.test(message)) return;
    throw error;
  }
}
