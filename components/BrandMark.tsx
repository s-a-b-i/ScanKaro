/**
 * The ScanKaro logo: a page inside scanner corner brackets with one blue scan line, on
 * an ink tile. Same drawing as the launcher icon and splash (generated from these paths),
 * so the logo looks identical everywhere.
 */
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  /** "tile": rounded ink square (default). "circle": round badge. "mark": no background, for dark surfaces. */
  shape?: 'tile' | 'circle' | 'mark';
  accessibilityLabel?: string;
};

export function BrandMark({ size = 64, shape = 'tile', accessibilityLabel = 'ScanKaro' }: Props) {
  const scale = shape === 'mark' ? 1 : shape === 'circle' ? 0.8 : 0.86;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel={accessibilityLabel} accessible>
      <Defs>
        <LinearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2C2E35" />
          <Stop offset="1" stopColor="#131418" />
        </LinearGradient>
        <RadialGradient id="sheen" cx="0.3" cy="0.2" r="0.9">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {shape === 'tile' ? (
        <>
          <Rect width="1024" height="1024" rx="232" fill="url(#ink)" />
          <Rect width="1024" height="1024" rx="232" fill="url(#sheen)" />
        </>
      ) : shape === 'circle' ? (
        <>
          <Circle cx="512" cy="512" r="512" fill="url(#ink)" />
          <Circle cx="512" cy="512" r="512" fill="url(#sheen)" />
        </>
      ) : null}
      <G transform={`translate(512 512) scale(${scale}) translate(-512 -512)`}>
        <G fill="none" stroke="#FFFFFF" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M262 386 V318 A56 56 0 0 1 318 262 H386" />
          <Path d="M638 262 H706 A56 56 0 0 1 762 318 V386" />
          <Path d="M762 638 V706 A56 56 0 0 1 706 762 H638" />
          <Path d="M386 762 H318 A56 56 0 0 1 262 706 V638" />
        </G>
        <Path
          d="M402 330 H566 L652 416 V664 A30 30 0 0 1 622 694 H402 A30 30 0 0 1 372 664 V360 A30 30 0 0 1 402 330 Z"
          fill="#FFFFFF"
        />
        <Path d="M566 330 V388 A28 28 0 0 0 594 416 H652 Z" fill="#C9CCD6" />
        <G fill="#D3D6DE">
          <Rect x="410" y="424" width="132" height="22" rx="11" />
          <Rect x="410" y="584" width="204" height="22" rx="11" />
          <Rect x="410" y="630" width="150" height="22" rx="11" />
        </G>
        <Rect x="222" y="497" width="580" height="30" rx="15" fill="#3B9EFF" opacity={0.3} />
        <Rect x="222" y="501" width="580" height="22" rx="11" fill="#3B9EFF" />
      </G>
    </Svg>
  );
}
