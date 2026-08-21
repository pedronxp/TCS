import { Colors, TCSDarkPalette, TCSPalette } from '../Colors';
import { ComponentSize, Spacing, TouchTarget } from '../Spacing';

describe('TCS Mobile V5 design tokens', () => {
  it('uses the neutral monochrome light palette aligned with the web dashboard', () => {
    expect(TCSPalette).toMatchObject({
      background: '#FAFAFA',
      foreground: '#171717',
      primary: '#171717',
      secondary: '#F5F5F5',
      accent: '#EDEDED',
      border: '#E0E0E0',
      success: '#22C55E',
      warning: '#C77A00',
      danger: '#C0291D',
    });
  });

  it('does not reintroduce the former blue brand palette', () => {
    expect(JSON.stringify(Colors)).not.toMatch(/3B82F6|1D4ED8|EFF6FF|BFDBFE/i);
  });

  it('provides a dedicated dark palette with readable surfaces aligned with the web dashboard', () => {
    expect(Colors.dark).not.toEqual(Colors.light);
    expect(TCSDarkPalette).toMatchObject({
      background: '#171717',
      surface: '#1F1F1F',
      foreground: '#FAFAFA',
      primary: '#FAFAFA',
      border: '#333333',
    });
    expect(Colors.dark.background).not.toBe(Colors.dark.surface);
    expect(Colors.dark.text).not.toBe(Colors.dark.background);
  });

  it('provides the 6 web dashboard themes', () => {
    expect(Colors.orca).toBeDefined();
    expect(Colors.dracula).toBeDefined();
    expect(Colors.nord).toBeDefined();
    expect(Colors.gruvbox).toBeDefined();
    expect(Colors.orca.primary).toBe('#22C55E');
    expect(Colors.dracula.primary).toBe('#BD93F9');
    expect(Colors.nord.primary).toBe('#88C0D0');
    expect(Colors.gruvbox.primary).toBe('#FABD2F');
  });

  it('defines native touch targets and the 4 px spacing grid', () => {
    expect(TouchTarget.ios).toBe(44);
    expect(TouchTarget.android).toBe(48);
    expect(ComponentSize.buttonMd).toBe(48);
    expect(Spacing[1]).toBe(4);
    expect(Spacing[4]).toBe(16);
  });
});
