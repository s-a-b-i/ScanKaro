import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { shadows } from '../components/ui';
import { appConfig } from '../constants/config';
import { useApp } from '../context/AppProvider';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { authService } from '../services';
import { goBackOr } from '../utils/navigation';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, authReady } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Signing in is optional: this screen opens on top of the app and closes back to it.
  // Once only: a sign-in both resolves the form and updates the profile, and two
  // back() calls would also close the screen underneath.
  const closed = useRef(false);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    goBackOr(router, '/(tabs)');
  }, [router]);

  useEffect(() => {
    if (authReady && profile) close();
  }, [authReady, profile, close]);

  const handleAuthSuccess = close;

  const handleAuthError = useCallback((error: unknown) => {
    Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Please try again.');
  }, []);

  const { promptGoogleSignIn, googlePending } = useGoogleAuth({
    onSuccess: async (tokens) => {
      try {
        setLoading(true);
        await authService.signInWithGoogle(tokens);
        handleAuthSuccess();
      } catch (error) {
        handleAuthError(error);
      } finally {
        setLoading(false);
      }
    },
    onError: handleAuthError,
  });

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await authService.signIn(email, password);
      } else {
        await authService.signUp(email, password, name);
      }
      handleAuthSuccess();
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email address first, then tap Forgot.');
      return;
    }

    try {
      await authService.resetPassword(email);
      Alert.alert('Check your inbox', 'A password reset link has been sent to your email.');
    } catch (error) {
      handleAuthError(error);
    }
  };

  const busy = loading || googlePending;
  const submitLabel = isLogin ? 'Sign In' : 'Create Account';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="h-14 flex-row items-center px-3">
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close, continue without an account"
          hitSlop={6}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-container"
        >
          <Icon name="close" size={24} className="text-on-surface" />
        </Pressable>
      </View>
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center px-margin-mobile py-stack-lg"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-[440px] gap-stack-lg">
          <View className="items-center">
            <View className="mb-4">
              <BrandMark size={72} />
            </View>
            <Text className="font-inter-bold text-large-title text-on-surface">ScanKaro</Text>
            <Text className="mt-2 max-w-[320px] text-center font-inter text-body-lg text-on-surface-variant">
              {isLogin
                ? 'Your documents, digitized and organized in seconds.'
                : 'Join ScanKaro today and transform your workflow.'}
            </Text>
            <Text className="mt-2 max-w-[320px] text-center font-inter text-body-sm text-on-surface-variant">
              An account is optional. Everything works without one.
            </Text>
          </View>

          <View className="gap-stack-md rounded-4xl bg-surface-container-lowest p-6" style={shadows.soft}>
            {!isLogin ? (
              <View className="gap-1">
                <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Full Name</Text>
                <View className="relative">
                  <View className="absolute left-4 top-0 z-10 h-14 justify-center">
                    <Icon name="person" size={20} className="text-outline" />
                  </View>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    autoCapitalize="words"
                    className="h-14 rounded-2xl bg-surface-container-low pl-12 pr-4 font-inter text-body-lg text-on-surface"
                    placeholderTextColor="#6d7a77"
                  />
                </View>
              </View>
            ) : null}

            <View className="gap-1">
              <Text className="ml-1 font-inter text-label-md text-on-surface-variant">Email Address</Text>
              <View className="relative">
                <View className="absolute left-4 top-0 z-10 h-14 justify-center">
                  <Icon name="mail" size={20} className="text-outline" />
                </View>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="h-14 rounded-2xl bg-surface-container-low pl-12 pr-4 font-inter text-body-lg text-on-surface"
                  placeholderTextColor="#6d7a77"
                />
              </View>
            </View>

            <View className="gap-1">
              <View className="ml-1 flex-row items-center justify-between">
                <Text className="font-inter text-label-md text-on-surface-variant">Password</Text>
                {isLogin ? (
                  <Pressable onPress={handleForgotPassword}>
                    <Text className="font-inter text-label-md text-primary">Forgot?</Text>
                  </Pressable>
                ) : null}
              </View>
              <View className="relative">
                <View className="absolute left-4 top-0 z-10 h-14 justify-center">
                  <Icon name="lock" size={20} className="text-outline" />
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  className="h-14 rounded-2xl bg-surface-container-low pl-12 pr-12 font-inter text-body-lg text-on-surface"
                  placeholderTextColor="#6d7a77"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-0 h-14 w-11 items-center justify-center"
                >
                  <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={20} className="text-outline" />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={submit}
              disabled={busy}
              className="mt-2 h-14 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-85"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text className="font-inter-semibold text-body-lg text-on-primary">{submitLabel}</Text>
                  <Icon name="arrow-forward" size={20} className="text-on-primary" />
                </>
              )}
            </Pressable>

            <View className="flex-row items-center gap-4 py-2">
              <View className="h-px flex-1 bg-outline-variant/50" />
              <Text className="font-inter text-label-md text-on-surface-variant">or continue with</Text>
              <View className="h-px flex-1 bg-outline-variant/50" />
            </View>

            <View className="flex-row gap-stack-md">
              <Pressable
                onPress={promptGoogleSignIn}
                disabled={busy}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest active:bg-surface-container-low"
              >
                <Image
                  source={{
                    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAiLGlT-yRo8ylYOKMlyFSVy4Kvgky7VPXbdI0SwlisVxn2NriBY0rgudAS0aVdd4wi6pVWyW0QzE1XIG8zjVuS7Oh1EW9h2_m50Wyes8A5Hqy8x9jZks93gw5mNBWEAJTO8HT2pS0DzLhozBPE2fKyuFJ-Cj_141zIvUc75kB3axf8SD2QLfbKt2NQCHbt_j7didn8FCw-_TyAs53gzSyk8TyBRfIB6KgT3FYag_MhDHrvKshF_DE7kwZA4DPfpS-l1Miz2Bdn4Vu5',
                  }}
                  className="h-5 w-5"
                />
                <Text className="font-inter text-body-sm font-medium text-on-surface">Google</Text>
              </Pressable>
              <Pressable
                disabled
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low opacity-50"
              >
                <Icon name="phone-iphone" size={20} className="text-on-surface-variant" />
                <Text className="font-inter text-body-sm font-medium text-on-surface-variant">Apple</Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-row items-center justify-center">
            <Text className="font-inter text-body-sm text-on-surface-variant">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Pressable onPress={() => setIsLogin((v) => !v)}>
              <Text className="ml-1 font-inter-semibold text-body-sm text-primary">
                {isLogin ? 'Sign up' : 'Login'}
              </Text>
            </Pressable>
          </View>

          <Text className="text-center font-inter text-body-sm text-on-surface-variant">
            {appConfig.firebase.enabled
              ? 'Secured with Firebase Authentication'
              : 'Add Firebase keys to .env to enable real authentication'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
