import { MaterialIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// Let NativeWind turn `text-*` classes into the icon's `color` prop.
// Without this, className colors are ignored and every icon renders black.
cssInterop(MaterialIcons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, size = 24, className }: IconProps) {
  return <MaterialIcons name={name} size={size} className={className} />;
}
