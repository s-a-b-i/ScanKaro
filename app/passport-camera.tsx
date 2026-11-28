/**
 * Passport photo camera: live camera with a frame in the chosen photo's shape and a face
 * guide (oval, eye line). The shot is cropped to the frame and handed to the ID photo maker,
 * which sizes it for print and lays out a sheet of copies.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackground } from '../components/Glass';
import { Icon } from '../components/Icon';
import { cropRegion, ID_PHOTO_SIZES } from '../utils/idPhoto';
import { goBackOr } from '../utils/navigation';

export default function PassportCameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const params = useLocalSearchParams<{ size?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [sizeIndex, setSizeIndex] = useState(() => Math.max(0, ID_PHOTO_SIZES.findIndex((s) => s.key === params.size)));
  const [busy, setBusy] = useState(false);
  const camera = useRef<CameraView>(null);

  const size = ID_PHOTO_SIZES[sizeIndex];
  // Frame: the photo's aspect ratio, as large as fits between the controls.
  const maxW = screenW * 0.78;
  const maxH = screenH * 0.52;
  const ratio = size.widthMm / size.heightMm;
  const frameW = Math.min(maxW, maxH * ratio);
  const frameH = frameW / ratio;
  const frameX = (screenW - frameW) / 2;
  const frameY = (screenH - frameH) / 2 - 20;

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!photo) throw new Error('No photo was taken.');
      // The preview fills the screen (cover); map the frame to photo pixels.
      const scale = Math.max(screenW / photo.width, screenH / photo.height);
      const offsetX = (photo.width * scale - screenW) / 2;
      const offsetY = (photo.height * scale - screenH) / 2;
      const cropped = await cropRegion(photo.uri, {
        x: (frameX + offsetX) / scale,
        y: (frameY + offsetY) / scale,
        width: frameW / scale,
        height: frameH / scale,
      });
      router.replace({ pathname: '/id-photo', params: { photo: cropped.uri, size: size.key } });
    } catch (e) {
      Alert.alert('Could not take the photo', e instanceof Error ? e.message : 'Please try again.');
      setBusy(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Icon name="photo-camera" size={40} className="text-white" />
        <Text className="mt-4 text-center font-inter-semibold text-[18px] text-white">Camera access needed</Text>
        <Text className="mt-2 text-center font-inter text-[14px] text-white/70">
          Allow the camera to take your passport photo.
        </Text>
        <Pressable onPress={() => void requestPermission()} className="mt-6 h-12 justify-center rounded-full bg-white px-6">
          <Text className="font-inter-semibold text-[15px] text-black">Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => goBackOr(router, '/(tabs)/tools')} className="mt-3 h-11 justify-center px-4">
          <Text className="font-inter-semibold text-[15px] text-white/70">Not now</Text>
        </Pressable>
      </View>
    );
  }

  const dim = 'rgba(0,0,0,0.55)';
  return (
    <View className="flex-1 bg-black">
      <CameraView ref={camera} style={{ flex: 1 }} facing={facing} />

      {/* Dim everything outside the frame */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: frameY, backgroundColor: dim }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: frameY + frameH, bottom: 0, backgroundColor: dim }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: frameX, top: frameY, height: frameH, backgroundColor: dim }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, width: frameX, top: frameY, height: frameH, backgroundColor: dim }} />

      {/* Frame + face guide */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: frameX,
          top: frameY,
          width: frameW,
          height: frameH,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.9)',
          borderRadius: 6,
        }}
      >
        {/* Head oval: about 70% of the photo height, chin to crown, per passport rules. */}
        <View
          style={{
            position: 'absolute',
            left: frameW * 0.22,
            right: frameW * 0.22,
            top: frameH * 0.1,
            height: frameH * 0.66,
            borderRadius: frameW,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#FFC21A',
          }}
        />
        {/* Eye line */}
        <View
          style={{
            position: 'absolute',
            left: frameW * 0.18,
            right: frameW * 0.18,
            top: frameH * 0.38,
            height: 1,
            backgroundColor: 'rgba(255,194,26,0.6)',
          }}
        />
      </View>

      {/* Top controls */}
      <View className="absolute left-0 right-0 flex-row items-center justify-between px-5" style={{ top: insets.top + 12 }}>
        <Pressable
          onPress={() => goBackOr(router, '/id-photo')}
          accessibilityLabel="Close"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} variant="media" />
          <Icon name="close" size={22} className="text-white" />
        </Pressable>
        <Pressable
          onPress={() => setSizeIndex((i) => (i + 1) % ID_PHOTO_SIZES.length)}
          accessibilityLabel={`Photo size: ${size.label}. Tap to change.`}
          className="h-12 flex-row items-center gap-1.5 overflow-hidden rounded-full px-4 active:opacity-70"
        >
          <GlassBackground radius={24} variant="media" />
          <Icon name="crop-portrait" size={18} className="text-white" />
          <Text className="font-inter-semibold text-[14px] text-white">
            {size.label} · {size.widthMm}×{size.heightMm}
          </Text>
          <Icon name="unfold-more" size={18} className="text-white" />
        </Pressable>
        <Pressable
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          accessibilityLabel="Switch camera"
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full active:opacity-70"
        >
          <GlassBackground radius={24} variant="media" />
          <Icon name="flip-camera-android" size={22} className="text-white" />
        </Pressable>
      </View>

      {/* Tip + shutter */}
      <View className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + 28 }}>
        <View className="mb-5 overflow-hidden rounded-full px-4 py-2.5">
          <GlassBackground radius={20} variant="media" />
          <Text className="font-inter-medium text-[13px] text-white">
            Face in the oval · plain light wall · even light
          </Text>
        </View>
        <Pressable
          onPress={() => void capture()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          className="h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-white active:opacity-80"
        >
          <View className="h-[62px] w-[62px] items-center justify-center rounded-full bg-white">
            {busy ? <ActivityIndicator color="#111111" /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
