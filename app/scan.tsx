import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { FallbackCameraScan } from '../components/scan/FallbackCameraScan';
import { useScan } from '../context/ScanProvider';
import {
  getNativeScannerUnavailableMessage,
  isNativeDocumentScannerAvailable,
  scanDocumentsNative,
} from '../services/nativeDocumentScanner';
import { pickScanImage } from '../utils/scanPicker';
import { goBackOr } from '../utils/navigation';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folderId: folderParam } = useLocalSearchParams<{ folderId?: string }>();
  const { pageCount, setFolderId, addPage, reset } = useScan();

  const [scanning, setScanning] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [showFallbackCamera, setShowFallbackCamera] = useState(false);
  const launchedRef = useRef(false);

  const nativeScanner = isNativeDocumentScannerAvailable();

  useEffect(() => {
    if (folderParam) {
      setFolderId(folderParam);
    }
  }, [folderParam, setFolderId]);

  const openNativeScanner = useCallback(async () => {
    if (scanning) return;

    setScanning(true);
    try {
      const images = await scanDocumentsNative({
        croppedImageQuality: 92,
        maxNumDocuments: batchMode ? 20 : 1,
      });

      if (!images?.length) {
        if (!launchedRef.current) {
          goBackOr(router, '/(tabs)');
        }
        return;
      }

      images.forEach((uri) => addPage(uri));

      if (images.length === 1 && !batchMode) {
        router.push('/crop');
      } else {
        router.push('/export');
      }
    } catch (error) {
      Alert.alert(
        'Scanner error',
        error instanceof Error ? error.message : 'Could not open the document scanner.',
      );
    } finally {
      setScanning(false);
    }
  }, [addPage, batchMode, router, scanning]);

  useEffect(() => {
    if (!nativeScanner || launchedRef.current) return;
    launchedRef.current = true;
    void openNativeScanner();
  }, [nativeScanner, openNativeScanner]);

  const importFromGallery = async () => {
    const uri = await pickScanImage();
    if (!uri) return;
    addPage(uri);
    router.push(batchMode ? '/export' : '/crop');
  };

  const handleClose = () => {
    if (pageCount > 0) {
      Alert.alert('Discard scan?', 'Your captured pages will be lost.', [
        { text: 'Keep Scanning', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            reset();
            goBackOr(router, '/(tabs)');
          },
        },
      ]);
      return;
    }
    goBackOr(router, '/(tabs)');
  };

  if (showFallbackCamera && !nativeScanner) {
    return <FallbackCameraScan batchMode={batchMode} onClose={handleClose} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.iconBtn}>
          <Icon name="close" size={24} className="text-on-surface" />
        </Pressable>
        <Text style={styles.title}>Document Scanner</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        {scanning ? (
          <>
            <ActivityIndicator size="large" color="#00685f" />
            <Text style={styles.subtitle}>Opening native scanner…</Text>
            <Text style={styles.hint}>
              Live edge detection runs in native Vision / ML Kit with perspective correction.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.heroIcon}>
              <Icon name="document-scanner" size={48} className="text-primary" />
            </View>
            <Text style={styles.subtitle}>
              {nativeScanner
                ? 'Native live edge detection'
                : 'Development build required'}
            </Text>
            <Text style={styles.hint}>
              {nativeScanner
                ? 'The scanner shows a live outline around your document, then crops and straightens it automatically — like CamScanner.'
                : getNativeScannerUnavailableMessage()}
            </Text>
          </>
        )}

        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setBatchMode(false)}
            style={[styles.modeBtn, !batchMode && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, !batchMode && styles.modeTextActive]}>Single</Text>
          </Pressable>
          <Pressable
            onPress={() => setBatchMode(true)}
            style={[styles.modeBtn, batchMode && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, batchMode && styles.modeTextActive]}>Batch</Text>
          </Pressable>
        </View>

        {nativeScanner ? (
          <Pressable
            onPress={() => void openNativeScanner()}
            disabled={scanning}
            style={[styles.primaryBtn, scanning && styles.primaryBtnDisabled]}
          >
            <Icon name="photo-camera" size={22} className="text-on-primary" />
            <Text style={styles.primaryBtnText}>Scan Document</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => setShowFallbackCamera(true)}
              style={styles.primaryBtn}
            >
              <Icon name="photo-camera" size={22} className="text-on-primary" />
              <Text style={styles.primaryBtnText}>Use Basic Camera</Text>
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Text style={styles.buildHint}>
                For CamScanner-style live edges: npx expo prebuild → npx expo run:android
              </Text>
            ) : null}
          </>
        )}

        <Pressable onPress={() => void importFromGallery()} style={styles.secondaryBtn}>
          <Icon name="photo-library" size={20} className="text-primary" />
          <Text style={styles.secondaryBtnText}>Import from Gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e3e5',
    backgroundColor: '#fff',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#191c1e',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e6f4f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#191c1e',
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#3d4947',
    textAlign: 'center',
    marginBottom: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#eceef0',
    borderRadius: 20,
    padding: 3,
    marginTop: 8,
  },
  modeBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 18,
  },
  modeBtnActive: {
    backgroundColor: '#fff',
  },
  modeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#3d4947',
  },
  modeTextActive: {
    color: '#00685f',
    fontFamily: 'Inter_600SemiBold',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00685f',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#00685f',
  },
  buildHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#3d4947',
    textAlign: 'center',
    marginTop: 4,
  },
});
