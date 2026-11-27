import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Appearance as SystemAppearance, ColorSchemeName, View } from 'react-native';
import type { Appearance } from '../types';

import { useApp } from '../context/AppProvider';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const palette = require('./palette') as {
  light: Record<string, string>;
  dark: Record<string, string>;
  toVars: (p: Record<string, string>) => Record<string, string>;
};

export type ThemeColors = typeof palette.light;

const themeVars = {
  light: vars(palette.toVars(palette.light)),
  dark: vars(palette.toVars(palette.dark)),
};

type Theme = {
  isDark: boolean;
  /** Hex colors for places that cannot use classes (StyleSheet, ActivityIndicator, Switch, …). */
  colors: ThemeColors;
};

const ThemeContext = createContext<Theme>({ isDark: false, colors: palette.light });

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * The phone's light/dark setting. Besides the change event (which this Android build does not
 * always deliver while the app is open), it re-reads the setting whenever the app returns to
 * the foreground, which is when people usually change it.
 */
function useSystemScheme(): ColorSchemeName {
  const [scheme, setScheme] = useState(SystemAppearance.getColorScheme());
  useEffect(() => {
    const change = SystemAppearance.addChangeListener(({ colorScheme }) => setScheme(colorScheme));
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') setScheme(SystemAppearance.getColorScheme());
    });
    return () => {
      change.remove();
      app.remove();
    };
  }, []);
  return scheme;
}

/** The appearance in effect: the saved choice, or the old Dark Mode switch, or the phone's. */
export function resolveAppearance(settings: { appearance?: Appearance; darkMode?: boolean } | null | undefined): Appearance {
  if (settings?.appearance) return settings.appearance;
  // People who switched Dark Mode on before keep it; everyone else follows the phone.
  return settings?.darkMode ? 'dark' : 'system';
}

/**
 * Applies the light or dark palette to everything below it. By default it follows the
 * phone's light/dark setting (Apple HIG, Dark Mode: avoid an app-only appearance switch).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const system = useSystemScheme();
  const appearance = resolveAppearance(settings);
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');

  const theme = useMemo<Theme>(
    () => ({ isDark, colors: isDark ? palette.dark : palette.light }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <View style={[{ flex: 1, backgroundColor: theme.colors.background }, isDark ? themeVars.dark : themeVars.light]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
