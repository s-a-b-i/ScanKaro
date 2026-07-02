import { Share } from 'react-native';

export async function shareDocument(title: string, url?: string) {
  const message = url ? `${title}\n${url}` : title;
  await Share.share({ title, message, url });
}
