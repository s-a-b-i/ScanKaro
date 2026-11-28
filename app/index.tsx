import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { hasSeenOnboarding } from '../utils/onboarding';

/** Start screen. No account: first launch shows the intro, every launch after that opens the app. */
export default function Index() {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenOnboarding().then(setSeen);
  }, []);

  if (seen === null) return null;
  return <Redirect href={seen ? '/(tabs)' : '/onboarding'} />;
}
