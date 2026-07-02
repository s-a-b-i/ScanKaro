import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { appConfig } from '../constants/config';
import { GoogleSignInTokens } from '../services/interfaces';

WebBrowser.maybeCompleteAuthSession();

/** Expo Go bundle IDs — must match the iOS/Android OAuth clients in Google Cloud */
const EXPO_GO_IOS_BUNDLE = 'host.exp.Exponent';
const EXPO_GO_ANDROID_PACKAGE = 'host.exp.exponent';

type UseGoogleAuthOptions = {
  onSuccess: (tokens: GoogleSignInTokens) => void;
  onError: (error: Error) => void;
};

function toReversedClientRedirectUri(clientId: string) {
  const id = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${id}:/oauthredirect`;
}

function getGoogleRedirectUri(iosClientId?: string, androidClientId?: string) {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (Platform.OS === 'ios') {
    if (isExpoGo) {
      return `${EXPO_GO_IOS_BUNDLE}:/oauthredirect`;
    }
    if (iosClientId) {
      return toReversedClientRedirectUri(iosClientId);
    }
  }

  if (Platform.OS === 'android') {
    if (isExpoGo) {
      return `${EXPO_GO_ANDROID_PACKAGE}:/oauthredirect`;
    }
    if (androidClientId) {
      return toReversedClientRedirectUri(androidClientId);
    }
  }

  return makeRedirectUri({ scheme: 'scankaro', path: 'oauth' });
}

function extractGoogleTokens(response: NonNullable<ReturnType<typeof Google.useIdTokenAuthRequest>[1]>) {
  if (response.type !== 'success') return null;

  const idToken = response.params.id_token ?? response.authentication?.idToken;
  const accessToken = response.params.access_token ?? response.authentication?.accessToken;

  if (!idToken) return null;

  return { idToken, accessToken: accessToken ?? undefined };
}

export function useGoogleAuth({ onSuccess, onError }: UseGoogleAuthOptions) {
  const { webClientId, iosClientId, androidClientId } = appConfig.google;
  const handledResponseRef = useRef<string | null>(null);

  const redirectUri = useMemo(
    () => getGoogleRedirectUri(iosClientId, androidClientId),
    [iosClientId, androidClientId],
  );

  const googleConfig = useMemo(
    () => ({
      clientId: webClientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
      ...(iosClientId ? { iosClientId } : {}),
      ...(androidClientId ? { androidClientId } : {}),
    }),
    [webClientId, iosClientId, androidClientId, redirectUri],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig);

  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const tokens = extractGoogleTokens(response);
      if (!tokens) {
        onError(new Error('Google sign-in did not return an ID token.'));
        setPending(false);
        return;
      }

      const responseKey = `${tokens.idToken}:${tokens.accessToken ?? ''}`;
      if (handledResponseRef.current === responseKey) return;
      handledResponseRef.current = responseKey;

      onSuccess(tokens);
      setPending(false);
      return;
    }

    if (response.type === 'error') {
      onError(new Error(response.error?.message ?? 'Google sign-in failed'));
      setPending(false);
      return;
    }

    if (response.type === 'dismiss' || response.type === 'cancel') {
      setPending(false);
    }
  }, [response, onSuccess, onError]);

  const missingClientError = useMemo(() => {
    if (Platform.OS === 'ios' && !iosClientId) {
      return 'iOS Google client ID is missing. Create an iOS OAuth client in Google Cloud (bundle ID: host.exp.Exponent) and add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env';
    }
    if (Platform.OS === 'android' && !androidClientId) {
      return 'Android Google client ID is missing. Create an Android OAuth client in Google Cloud and add EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env';
    }
    if (!webClientId) {
      return 'Google Web Client ID is missing. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.';
    }
    return null;
  }, [webClientId, iosClientId, androidClientId]);

  const promptGoogleSignIn = async () => {
    if (missingClientError) {
      onError(new Error(missingClientError));
      return;
    }

    handledResponseRef.current = null;

    if (__DEV__) {
      console.log('[Google Auth] platform:', Platform.OS);
      console.log('[Google Auth] expoGo:', Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
      console.log('[Google Auth] clientId:', Platform.OS === 'ios' ? iosClientId : webClientId);
      console.log('[Google Auth] redirectUri:', redirectUri);
    }

    setPending(true);
    await promptAsync({ showInRecents: true });
  };

  return {
    promptGoogleSignIn,
    googleReady: Boolean(request && !missingClientError),
    googlePending: pending,
    redirectUri,
  };
}
