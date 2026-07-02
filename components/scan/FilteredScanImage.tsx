import { useState } from 'react';
import { Image, ImageProps, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, FeColorMatrix, Filter, Image as SvgImage } from 'react-native-svg';

import { getSvgColorMatrix, ScanFilter } from '../../utils/scanFilters';

type FilteredScanImageProps = {
  uri: string;
  filter: ScanFilter;
  brightness: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: ImageProps['style'];
  resizeMode?: ImageProps['resizeMode'];
};

export function FilteredScanImage({
  uri,
  filter,
  brightness,
  style,
  imageStyle,
  resizeMode = 'contain',
}: FilteredScanImageProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const filterId = `scan-filter-${filter}-${brightness}`;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  };

  const preserveAspectRatio = resizeMode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';

  // Plain Image fallback while layout is measured, or if SVG fails on a URI scheme.
  if (size.width === 0 || size.height === 0) {
    return (
      <View style={[styles.container, style]} onLayout={onLayout}>
        <Image source={{ uri }} style={[styles.image, imageStyle]} resizeMode={resizeMode} />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <Svg width={size.width} height={size.height}>
        <Defs>
          <Filter id={filterId}>
            <FeColorMatrix type="matrix" values={getSvgColorMatrix(filter, brightness)} />
          </Filter>
        </Defs>
        <SvgImage
          href={uri}
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          preserveAspectRatio={preserveAspectRatio}
          filter={`url(#${filterId})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
