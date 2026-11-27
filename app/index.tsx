import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { useApp } from '../context/AppProvider';
import { hasSeenOnboarding } from '../utils/onboarding';

/**
 * Start screen. No sign-in is needed to use ScanKaro: first launch shows the intro,
 * every launch after that opens the app. Signing in is optional (Settings > Account).
 */
export default function Index() {
  const { profile, authReady } = useApp();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenOnboarding().then(setSeen);
  }, []);

  if (seen === null) return null;
  // Not marked yet: wait for the account check, so someone already signed in on an
  // earlier version goes straight in instead of seeing the intro again.
  if (!seen && !authReady) return null;
  // People who already signed in on an earlier version have seen the intro.
  return <Redirect href={seen || profile ? '/(tabs)' : '/onboarding'} />;
}
