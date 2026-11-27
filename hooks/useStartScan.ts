import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useScan } from '../context/ScanProvider';

/**
 * Opens the scanner for a NEW scan. An unfinished scan is not lost: it was already
 * saved as a draft and stays listed on Home, where it can be continued.
 */
export function useStartScan() {
  const router = useRouter();
  const { reset } = useScan();
  return useCallback(
    (params?: { mode?: string; folderId?: string }) => {
      reset();
      router.push(params ? { pathname: '/scan', params } : '/scan');
    },
    [reset, router],
  );
}
