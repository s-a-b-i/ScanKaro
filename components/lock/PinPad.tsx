import { Pressable, Text, View } from 'react-native';

import { PIN_LENGTH } from '../../services/appLock';
import { Icon } from '../Icon';

type PinPadProps = {
  title: string;
  subtitle?: string;
  /** Error or hint shown under the dots. */
  message?: string | null;
  value: string;
  onChange: (value: string) => void;
  /** Shows a fingerprint key in the bottom-left corner. */
  onBiometric?: () => void;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Four PIN dots and a large numeric keypad (48dp+ touch targets). */
export function PinPad({ title, subtitle, message, value, onChange, onBiometric, disabled }: PinPadProps) {
  const press = (digit: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    onChange(value + digit);
  };

  const Key = ({ label, onPress, icon, a11y }: { label?: string; onPress?: () => void; icon?: 'backspace' | 'fingerprint'; a11y: string }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityLabel={a11y}
      className="h-[72px] w-[72px] items-center justify-center rounded-full active:bg-surface-container-high"
    >
      {icon ? (
        <Icon name={icon} size={28} className="text-on-surface" />
      ) : (
        <Text className="font-inter-semibold text-[30px] text-on-surface">{label}</Text>
      )}
    </Pressable>
  );

  return (
    <View className="items-center">
      <Text className="text-center font-inter-semibold text-[26px] tracking-[-0.6px] text-on-surface">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 px-8 text-center font-inter text-[15px] text-on-surface-variant">{subtitle}</Text>
      ) : null}

      <View className="my-7 flex-row gap-5" accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-on-surface ${i < value.length ? 'bg-on-surface' : ''}`}
          />
        ))}
      </View>
      <Text className="mb-4 h-5 text-center font-inter text-[14px] text-error">{message ?? ''}</Text>

      <View className="w-[264px] flex-row flex-wrap justify-between gap-y-3">
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} a11y={k} />
        ))}
        {onBiometric ? <Key icon="fingerprint" onPress={onBiometric} a11y="Unlock with fingerprint" /> : <View className="h-[72px] w-[72px]" />}
        <Key label="0" onPress={() => press('0')} a11y="0" />
        <Key icon="backspace" onPress={() => onChange(value.slice(0, -1))} a11y="Delete digit" />
      </View>
    </View>
  );
}
