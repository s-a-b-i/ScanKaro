import { Redirect } from 'expo-router';

import { appConfig } from '../constants/config';
import { useApp } from '../context/AppProvider';

export default function Index() {
  const { profile, authReady, loading } = useApp();

  if (!authReady || loading) {
    return null;
  }

  if (appConfig.api.enabled && !profile) {
    return <Redirect href="/login" />;
  }

  if (profile) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
