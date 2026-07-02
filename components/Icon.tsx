import { MaterialIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, size = 24, className, filled }: IconProps) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      className={className}
      style={filled ? { fontWeight: 'bold' as const } : undefined}
    />
  );
}
