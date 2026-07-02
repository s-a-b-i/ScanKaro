import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

async function ensurePermission(
  request: () => Promise<ImagePicker.PermissionResponse>,
  label: string,
): Promise<boolean> {
  const result = await request();

  if (result.granted) {
    return true;
  }

  if (!result.canAskAgain) {
    Alert.alert(
      `${label} permission required`,
      `Enable ${label.toLowerCase()} access for ScanKaro in your device Settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }

  Alert.alert('Permission needed', `Allow ${label.toLowerCase()} access to scan documents.`);
  return false;
}

export async function pickScanImage(): Promise<string | null> {
  const allowed = await ensurePermission(
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    'Photo library',
  );
  if (!allowed) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    Alert.alert('Gallery error', error instanceof Error ? error.message : 'Could not open photo library.');
    return null;
  }
}

export async function pickScanCamera(): Promise<string | null> {
  const cameraAllowed = await ensurePermission(
    () => ImagePicker.requestCameraPermissionsAsync(),
    'Camera',
  );
  if (!cameraAllowed) return null;

  // iOS also needs photo-library permission to save the captured image (Expo docs).
  if (Platform.OS !== 'web') {
    const libraryAllowed = await ensurePermission(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      'Photo library',
    );
    if (!libraryAllowed) return null;
  }

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    Alert.alert(
      'Camera error',
      error instanceof Error
        ? error.message
        : 'Could not open the camera. Use a physical device (not a simulator) and allow Camera + Photos permissions.',
    );
    return null;
  }
}

export async function pickScanImageWithPrompt(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return pickScanImage();
  }

  return new Promise((resolve) => {
    Alert.alert('Add Page', 'Choose a source for your scan', [
      { text: 'Camera', onPress: () => void pickScanCamera().then(resolve) },
      { text: 'Gallery', onPress: () => void pickScanImage().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
