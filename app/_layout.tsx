import '../global.css';

import { Buffer } from 'buffer';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from '../context/AppProvider';
import { ScanProvider } from '../context/ScanProvider';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

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
        <ScanProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="crop" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="export" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ocr" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="security" />
        <Stack.Screen name="document/[id]" />
        <Stack.Screen name="account" />
        <Stack.Screen name="folder/[id]" />
        </Stack>
        </ScanProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
