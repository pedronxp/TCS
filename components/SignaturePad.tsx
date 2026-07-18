import React, { useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SignatureStroke } from '../types/documentAcknowledgement';

interface SignaturePadProps {
  value: SignatureStroke[];
  onChange: (strokes: SignatureStroke[]) => void;
  color?: string;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
  onInteractionChange?: (active: boolean) => void;
}

export function SignaturePad({
  value,
  onChange,
  color = '#0F172A',
  borderColor = '#CBD5E1',
  backgroundColor = '#FFFFFF',
  textColor = '#475569',
  disabled = false,
  onInteractionChange,
}: SignaturePadProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const strokesRef = useRef(value);
  strokesRef.current = value;

  const pointFromEvent = (event: GestureResponderEvent) => ({
    x: Math.max(0, Math.min(1, event.nativeEvent.locationX / size.width)),
    y: Math.max(0, Math.min(1, event.nativeEvent.locationY / size.height)),
  });

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onStartShouldSetPanResponderCapture: () => !disabled,
    onMoveShouldSetPanResponderCapture: () => !disabled,
    onPanResponderGrant: event => {
      onInteractionChange?.(true);
      const next = [...strokesRef.current, { points: [pointFromEvent(event)] }];
      strokesRef.current = next;
      onChange(next);
    },
    onPanResponderMove: event => {
      const current = strokesRef.current;
      if (current.length === 0) return;
      const next = current.map((stroke, index) =>
        index === current.length - 1
          ? { points: [...stroke.points, pointFromEvent(event)] }
          : stroke
      );
      strokesRef.current = next;
      onChange(next);
    },
    onPanResponderRelease: () => onInteractionChange?.(false),
    onPanResponderTerminate: () => onInteractionChange?.(false),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [disabled, onChange, onInteractionChange, size.height, size.width]);

  return (
    <View>
      <View
        accessible
        accessibilityLabel="Área para assinatura manuscrita"
        accessibilityHint="Desenhe a assinatura com o dedo dentro desta área"
        onLayout={event => setSize({
          width: Math.max(1, event.nativeEvent.layout.width),
          height: Math.max(1, event.nativeEvent.layout.height),
        })}
        style={[styles.canvas, { borderColor, backgroundColor }]}
        {...responder.panHandlers}
      >
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`}>
          {value.map((stroke, index) => (
            <Polyline
              key={index}
              points={stroke.points.map(point => `${point.x * size.width},${point.y * size.height}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {value.length === 0 && (
          <Text pointerEvents="none" style={[styles.placeholder, { color: textColor }]}>Assine dentro da área</Text>
        )}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Limpar assinatura"
        disabled={disabled || value.length === 0}
        onPress={() => onChange([])}
        style={styles.clearButton}
      >
        <Text style={[styles.clearText, { color: value.length ? '#DC2626' : textColor }]}>Limpar e refazer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    height: 190,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 82,
    textAlign: 'center',
    fontSize: 13,
  },
  clearButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 2 },
  clearText: { fontSize: 12, fontWeight: '700' },
});
