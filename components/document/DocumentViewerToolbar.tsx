import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';

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
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {actions.map((action) =>
          action.primary ? (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
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

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e3e5',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 8,
    minHeight: 72,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  actionLabel: {
    color: '#3d4947',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  primaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00685f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginHorizontal: 4,
    shadowColor: '#00685f',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
