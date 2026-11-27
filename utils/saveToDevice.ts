/**
 * Saves tool results (PDFs, images, documents) into a folder the user picks, e.g.
 * Downloads, through Android's folder picker. Tool outputs otherwise live in the app's
 * temporary folder, which is cleared on the next launch.
 */
import { Directory, File } from 'expo-file-system';

export type SavableFile = { uri: string; name: string; mimeType: string };

/**
 * Asks for a folder once, then copies every file into it. Returns how many were saved,
 * or null when the user closed the folder picker.
 */
export async function saveFilesToDevice(files: SavableFile[]): Promise<number | null> {
  let folder: Awaited<ReturnType<typeof Directory.pickDirectoryAsync>>;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return null; // picker closed
  }
  if (!folder) return null;
  let saved = 0;
  for (const f of files) {
    // Android adds " (1)" itself when the name is taken, so nothing is overwritten.
    const out = folder.createFile(f.name, f.mimeType);
    out.write(await new File(f.uri).bytes());
    saved++;
  }
  return saved;
}

export const PDF_MIME = 'application/pdf';
