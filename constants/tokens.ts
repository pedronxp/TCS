/**
 * TCS · Design System 4.0.0 — constantes geradas
 *
 * NÃO EDITE ESTE ARQUIVO. Fonte: design-tokens/tokens.json
 * Gerado por: scripts/build-design-tokens.mjs
 */

export const tcColor = {
  "surface-base": "#FBF8F2",
  "surface-cream": "#F3EEE3",
  "surface-sunken": "#E9E2D3",
  "surface-bar": "#F7F3EA",
  "surface-inverse": "#111111",
  "ink-primary": "#111111",
  "ink-secondary": "#3A342B",
  "ink-tertiary": "#635B4E",
  "ink-faint": "#78705F",
  "ink-on-accent": "#F3EEE3",
  "accent-base": "#D9541E",
  "accent-pressed": "#A63A0D",
  "accent-subtle": "#F7E3D8",
  "accent-ink": "#A33A0C",
  "accent-deep": "#8A320C",
  "line-hairline": "#E0D8C6",
  "line-strong": "#C4B79B",
  "line-focus": "#D9541E",
  "risk-r1-base": "#2A7340",
  "risk-r1-subtle": "#E2EFE2",
  "risk-r1-ink": "#1F5C31",
  "risk-r2-base": "#8A6412",
  "risk-r2-subtle": "#F5EBD2",
  "risk-r2-ink": "#6B4C0C",
  "risk-r3-base": "#B03E0E",
  "risk-r3-subtle": "#F5E0D8",
  "risk-r3-ink": "#8A320C",
  "risk-r4-base": "#A3261A",
  "risk-r4-subtle": "#F8E0DC",
  "risk-r4-ink": "#7E1C12",
  "data-positive": "#1F5C31",
  "data-negative": "#7E1C12",
  "data-neutral": "#635B4E"
} as const;

export const tcRadius = {
  "xs": 3,
  "sm": 5,
  "md": 7,
  "lg": 10,
  "xl": 14,
  "2xl": 20,
  "3xl": 28,
  "pill": 999
} as const;

export const tcSpace = {
  "0": 0,
  "1": 2,
  "2": 4,
  "3": 8,
  "4": 12,
  "5": 16,
  "6": 20,
  "7": 24,
  "8": 32,
  "9": 40,
  "10": 48,
  "11": 64
} as const;

export const tcSize = {
  "touch-target": 44,
  "control-height": 48,
  "control-height-sm": 36,
  "chip-height": 30,
  "tab-bar": 56,
  "nav-bar": 52,
  "large-nav-bar": 104,
  "status-bar": 59,
  "home-indicator": 34,
  "icon-sm": 16,
  "icon-md": 20,
  "icon-lg": 24,
  "icon-xl": 32,
  "avatar": 40,
  "gauge": 168,
  "progress": 4
} as const;

export const tcMotion = {
  "instant": 0,
  "fast": 140,
  "normal": 240,
  "slow": 340,
  "ease-out": "cubic-bezier(0.32, 0.72, 0, 1)",
  "ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  "ease-standard": "cubic-bezier(0.25, 0.1, 0.25, 1)"
} as const;

export const tcFont = {
  "ui": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "mono": "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  "brand": "'Space Grotesk', 'Inter', sans-serif"
} as const;

export const tcType = {
  "display": {
    "size": 40,
    "weight": 700,
    "lineHeight": 44,
    "tracking": -1.6,
    "family": "brand"
  },
  "title1": {
    "size": 30,
    "weight": 700,
    "lineHeight": 34,
    "tracking": -1.2,
    "family": "brand"
  },
  "title2": {
    "size": 22,
    "weight": 700,
    "lineHeight": 28,
    "tracking": -0.6,
    "family": "brand"
  },
  "title3": {
    "size": 19,
    "weight": 600,
    "lineHeight": 24,
    "tracking": -0.4,
    "family": "brand"
  },
  "headline": {
    "size": 17,
    "weight": 600,
    "lineHeight": 22,
    "tracking": -0.3,
    "family": "ui"
  },
  "body": {
    "size": 16,
    "weight": 400,
    "lineHeight": 24,
    "tracking": -0.2,
    "family": "ui"
  },
  "callout": {
    "size": 15,
    "weight": 400,
    "lineHeight": 21,
    "tracking": -0.1,
    "family": "ui"
  },
  "subhead": {
    "size": 14,
    "weight": 400,
    "lineHeight": 19,
    "tracking": 0,
    "family": "ui"
  },
  "footnote": {
    "size": 13,
    "weight": 400,
    "lineHeight": 18,
    "tracking": 0,
    "family": "ui"
  },
  "caption1": {
    "size": 12,
    "weight": 400,
    "lineHeight": 16,
    "tracking": 0.1,
    "family": "ui"
  },
  "caption2": {
    "size": 11,
    "weight": 500,
    "lineHeight": 15,
    "tracking": 0.3,
    "family": "ui"
  },
  "label": {
    "size": 12,
    "weight": 600,
    "lineHeight": 16,
    "tracking": 0.4,
    "family": "ui"
  },
  "dataLg": {
    "size": 28,
    "weight": 600,
    "lineHeight": 32,
    "tracking": -0.8,
    "family": "mono"
  },
  "dataMd": {
    "size": 20,
    "weight": 500,
    "lineHeight": 26,
    "tracking": -0.4,
    "family": "mono"
  },
  "dataSm": {
    "size": 15,
    "weight": 500,
    "lineHeight": 20,
    "tracking": -0.2,
    "family": "mono"
  },
  "dataXs": {
    "size": 11,
    "weight": 500,
    "lineHeight": 15,
    "tracking": 0.2,
    "family": "mono"
  }
} as const;

export type TcRisk = 'r1' | 'r2' | 'r3' | 'r4';

export const tcRiskScale: TcRisk[] = ['r1', 'r2', 'r3', 'r4'];
