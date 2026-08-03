import { Colors, TCSDarkPalette, TCSPalette } from '../Colors';
import { ComponentSize, Spacing, TouchTarget } from '../Spacing';

describe('TCS Mobile V5 design tokens', () => {
  it('uses the palette approved in Penpot', () => {
    expect(TCSPalette).toMatchObject({
      background: '#F7F8F7',
      foreground: '#171A18',
      primary: '#2F6B5B',
      secondary: '#EDF3F0',
      accent: '#B9D8CD',
      border: '#DCE4E0',
      success: '#2E7D5A',
      warning: '#A66B22',
      danger: '#B24A4A',
    });
  });

  it('does not reintroduce the former blue brand palette', () => {
    expect(JSON.stringify(Colors)).not.toMatch(/3B82F6|1D4ED8|EFF6FF|BFDBFE/i);
  });

  it('provides a dedicated dark palette with readable surfaces', () => {
    expect(Colors.dark).not.toEqual(Colors.light);
    expect(TCSDarkPalette).toMatchObject({
      background: '#0F1411',
      surface: '#171D19',
      foreground: '#F0F5F1',
      primary: '#7ABAA5',
      border: '#2C3A33',
    });
    expect(Colors.dark.background).not.toBe(Colors.dark.surface);
    expect(Colors.dark.text).not.toBe(Colors.dark.background);
  });

  it('defines native touch targets and the 4 px spacing grid', () => {
    expect(TouchTarget.ios).toBe(44);
    expect(TouchTarget.android).toBe(48);
    expect(ComponentSize.buttonMd).toBe(48);
    expect(Spacing[1]).toBe(4);
    expect(Spacing[4]).toBe(16);
  });
});
