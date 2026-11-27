/**
 * In-place feedback banner ("Copied", "Moved to Recently deleted · Undo"). Apple's HIG asks
 * for feedback inside the interface rather than alerts for information, and for Undo
 * instead of a confirmation on common, undoable actions (alerts.md). Announced to screen
 * readers; the fade respects the system Reduce Motion setting.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../constants/theme';
import { GlassBackground } from './Glass';
import { Icon } from './Icon';

type ToastOptions = {
  message: string;
  /** e.g. { label: 'Undo', onPress } */
  action?: { label: string; onPress: () => void };
  /** ms; longer by default when there is an action to reach. */
  duration?: number;
};

type ToastApi = { show: (options: ToastOptions | string) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export const useToast = () => useContext(ToastContext);

/** Space kept free at the bottom for the floating tab bar. */
const BOTTOM_CLEARANCE = 96;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (input: ToastOptions | string) => {
      const options = typeof input === 'string' ? { message: input } : input;
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...options, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(
        options.action ? `${options.message}. ${options.action.label} available.` : options.message,
      );
      timer.current = setTimeout(hide, options.duration ?? (options.action ? 6000 : 2500));
    },
    [hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.key}
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(150)}
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + BOTTOM_CLEARANCE }}
        >
          <View
            accessibilityLiveRegion="polite"
            className="min-h-[52px] flex-row items-center gap-3 overflow-hidden rounded-[26px] py-2 pl-5 pr-2"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            {/* Dark glass in both appearances, so it reads as a passing message over any screen. */}
            <GlassBackground radius={26} variant="media" />
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: isDark ? 'rgba(40,42,48,0.55)' : 'rgba(28,30,34,0.5)' }} />
            <Text className="flex-1 font-inter-medium text-[15px] text-[#eff1f3]" numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  hide();
                  toast.action!.onPress();
                }}
                accessibilityRole="button"
                className="h-11 justify-center rounded-full px-4 active:opacity-70"
              >
                <Text className="font-inter-semibold text-[15px] text-[#ffffff]">{toast.action.label}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={hide} accessibilityLabel="Dismiss" className="h-11 w-11 items-center justify-center">
                <Icon name="close" size={18} className="text-[#eff1f3]" />
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
