import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppProvider';
import {
  biometricsAvailable,
  disableLock,
  isBiometricEnabled,
  isLockEnabled,
  PIN_LENGTH,
  unlockWithBiometrics,
  verifyPin,
} from '../../services/appLock';
import { PinPad } from './PinPad';

/** Re-lock after the app has been in the background this long (pickers and share sheets are shorter). */
const RELOCK_AFTER_MS = 60_000;

type LockContextValue = {
  /** Re-reads the lock settings (call after changing them in Settings). */
  refreshLock: () => Promise<void>;
};

const LockContext = createContext<LockContextValue>({ refreshLock: async () => {} });

export const useAppLock = () => useContext(LockContext);

/** Covers the whole app with a PIN screen while locked. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useApp();

  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [pin, setPinValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const backgroundAt = useRef<number | null>(null);

  const refreshLock = useCallback(async () => {
    const on = await isLockEnabled();
    setEnabled(on);
    setBiometric(on && (await isBiometricEnabled()) && (await biometricsAvailable()));
  }, []);

  const tryBiometric = useCallback(async () => {
    if (await unlockWithBiometrics()) {
      setLocked(false);
      setPinValue('');
      setMessage(null);
    }
  }, []);

  // Lock at launch when enabled.
  useEffect(() => {
    void (async () => {
      const on = await isLockEnabled();
      setEnabled(on);
      const bio = on && (await isBiometricEnabled()) && (await biometricsAvailable());
      setBiometric(bio);
      setLocked(on);
      setChecked(true);
      if (on && bio) void tryBiometric();
    })();
  }, [tryBiometric]);

  // Re-lock after a while in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active' && backgroundAt.current !== null) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (enabled && away > RELOCK_AFTER_MS) {
          setLocked(true);
          setPinValue('');
          if (biometric) void tryBiometric();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, biometric, tryBiometric]);

  const onPinChange = async (value: string) => {
    setPinValue(value);
    setMessage(null);
    if (value.length < PIN_LENGTH) return;
    const result = await verifyPin(value);
    if (result.ok) {
      setLocked(false);
      setPinValue('');
      return;
    }
    setPinValue('');
    setMessage(
      result.waitSeconds
        ? `Too many attempts. Try again in ${result.waitSeconds} s.`
        : `Wrong PIN. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`,
    );
  };

  const forgotPin = () => {
    Alert.alert(
      'Forgot your PIN?',
      'Log out and sign in again with your password to turn the lock off. Your documents stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await disableLock();
            await signOut();
            setEnabled(false);
            setLocked(false);
            router.replace('/login');
          },
        },
      ],
    );
  };

  // Hide content until the lock state is known, so nothing flashes before the PIN screen.
  const showLock = !checked || locked;

  return (
    <LockContext.Provider value={{ refreshLock }}>
      {children}
      {showLock ? (
        <View
          className="absolute inset-0 items-center justify-center bg-background"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          {checked ? (
            <>
              <PinPad
                title="Enter your PIN"
                subtitle="ScanKaro is locked"
                message={message}
                value={pin}
                onChange={(v) => void onPinChange(v)}
                onBiometric={biometric ? () => void tryBiometric() : undefined}
              />
              {profile ? (
                <Pressable onPress={forgotPin} hitSlop={8} className="mt-6 px-4 py-2">
                  <Text className="font-inter-semibold text-[14px] text-primary">Forgot PIN?</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </LockContext.Provider>
  );
}
