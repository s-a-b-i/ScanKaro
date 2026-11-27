import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';
import { DocumentQuadOverlay } from './DocumentQuadOverlay';
import { useScan } from '../../context/ScanProvider';
import { frameRectToCorners, getScanFrameRect } from '../../utils/documentFrame';
import { pickScanImage } from '../../utils/scanPicker';

const BOTTOM_HEIGHT = 220;

type FallbackCameraScanProps = {
  batchMode: boolean;
  onClose: () => void;
};

/** Expo Go fallback — basic camera with a static guide frame only. */
export function FallbackCameraScan({ batchMode, onClose }: FallbackCameraScanProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { addPage, pageCount, pages, setActiveIndex } = useScan();
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const { width, height } = Dimensions.get('window');
  const topBarHeight = insets.top + 56;
  const guideCorners = useMemo(
    () => frameRectToCorners(getScanFrameRect(width, height, topBarHeight, BOTTOM_HEIGHT + insets.bottom)),
    [height, insets.bottom, topBarHeight, width],
  );

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const capture = async () => {
    if (capturing || !cameraRef.current || !cameraReady) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.88 });
      if (!photo?.uri) return;
      addPage(photo.uri);
      if (!batchMode) {
        router.push('/crop');
      }
    } catch (error) {
      Alert.alert('Capture failed', error instanceof Error ? error.message : 'Could not take photo.');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Camera permission is required.</Text>
        <Pressable onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={styles.permissionBtnText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
      />

      <DocumentQuadOverlay width={width} height={height} corners={guideCorners} detected={false} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.topBtn}>
          <Icon name="close" size={24} className="text-white" />
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.hintWrap}>
        <Text style={styles.hint}>Align document in frame (basic mode)</Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {pageCount > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.thumbRow}>
            {pages.map((uri, index) => (
              <Pressable key={`${uri}-${index}`} onPress={() => setActiveIndex(index)}>
                <Image source={{ uri }} style={styles.thumb} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.shutterRow}>
          <Pressable accessibilityLabel="Choose from photos"
            onPress={() => void pickScanImage().then((uri) => uri && addPage(uri))}
            style={styles.sideBtn}
          >
            <Icon name="photo-library" size={28} className="text-white" />
          </Pressable>
          <Pressable onPress={() => void capture()} disabled={capturing} style={styles.shutterOuter}>
            {capturing ? <ActivityIndicator color="#8e8e93" /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Pressable accessibilityLabel="Done"
            onPress={() => {
              if (pageCount === 0) return;
              router.push(pageCount === 1 ? '/crop' : '/enhance');
            }}
            style={styles.sideBtn}
          >
            <Icon name="check-circle" size={28} className="text-white" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  permissionText: { color: '#fff', marginBottom: 16, textAlign: 'center' },
  permissionBtn: { backgroundColor: '#1d1d1f', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontFamily: 'InterTight_600SemiBold' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 8 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hintWrap: { position: 'absolute', top: '46%', left: 0, right: 0, alignItems: 'center', zIndex: 8 },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    fontFamily: 'InterTight_500Medium',
    fontSize: 13,
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.75)' },
  thumbRow: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  thumb: { width: 48, height: 64, borderRadius: 6 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 36, paddingTop: 12 },
  sideBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
