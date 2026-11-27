import '../global.css';

import { Buffer } from 'buffer';

import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
  InterTight_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter-tight';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from '../context/AppProvider';
import { AppLockGate } from '../components/lock/AppLockGate';
import { ReminderSync } from '../components/ReminderSync';
import { ToastProvider } from '../components/Toast';
import { ThemeProvider } from '../constants/theme';
import { ScanProvider } from '../context/ScanProvider';
import { emptyOldTrash } from '../services/local/library';
import { clearTempFiles } from '../utils/tempFiles';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });

  // No scan can be in progress at launch: drop leftover working files from earlier sessions.
  useEffect(() => {
    // Page images of unsaved scans (drafts on Home) are kept; see utils/tempFiles.ts.
    clearTempFiles();
    emptyOldTrash();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider>
        <AppLockGate>
        <ScanProvider>
        <ToastProvider>
        <ReminderSync />
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="crop" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="enhance" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="export" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ocr" />
        <Stack.Screen name="pdf-tools" />
        <Stack.Screen name="pdf-viewer" />
        <Stack.Screen name="qr" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="qr-create" />
        <Stack.Screen name="qr-history" />
        <Stack.Screen name="card" />
        <Stack.Screen name="trash" />
        <Stack.Screen name="duplicates" />
        <Stack.Screen name="id-photo" />
        <Stack.Screen name="restore-photo" />
        <Stack.Screen name="translate" />
        <Stack.Screen name="locker" />
        <Stack.Screen name="document/[id]" />
        <Stack.Screen name="account" />
        <Stack.Screen name="folder/[id]" />
        <Stack.Screen name="manage-pages/[id]" />
        <Stack.Screen name="annotate/[id]" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
        </ToastProvider>
        </ScanProvider>
        </AppLockGate>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
