import { ComponentProps, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, useTheme } from '../../constants/theme';

import { Icon } from '../Icon';
import { GlassBackground } from '../Glass';
import { shadows } from '../ui';

type IconName = ComponentProps<typeof Icon>['name'];

export type DocumentToolbarAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
};

type DocumentViewerToolbarProps = {
  actions: DocumentToolbarAction[];
};

export function DocumentViewerToolbar({ actions }: DocumentViewerToolbarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={[styles.bar, shadows.lifted]}>
        <GlassBackground radius={BAR_RADIUS} />
        {actions.map((action) =>
          action.primary ? (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityLabel={action.label}
              style={styles.primaryBtn}
            >
              <Icon name={action.icon} size={26} className="text-on-primary" />
            </Pressable>
          ) : (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              style={styles.actionBtn}
            >
              <Icon name={action.icon} size={24} className="text-on-surface-variant" />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const BAR_RADIUS = 36;

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 72,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    elevation: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  actionLabel: {
    color: c['on-surface-variant'],
    fontFamily: 'InterTight_400Regular',
    fontSize: 11,
  },
  primaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
