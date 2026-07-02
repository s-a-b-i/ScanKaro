import { Href, Router } from 'expo-router';

/** Navigate back, or replace with fallback when there is no history (avoids GO_BACK warning). */
export function goBackOr(router: Router, fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
