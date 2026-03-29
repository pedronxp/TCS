---
phase: 02-design-system
plan: gap-01
type: execute
wave: 1
depends_on: []
files_modified:
  - constants/Colors.ts
  - components/ui/Badge.tsx
  - components/ui/SectionHeader.tsx
autonomous: true
gap_closure: true
requirements: [DS-01, DS-05]

must_haves:
  truths:
    - "All Badge text colors pass WCAG AA 4.5:1 contrast ratio against their Light backgrounds"
    - "SectionHeader action link text passes WCAG AA 4.5:1 contrast ratio"
    - "Colors.ts inline comments reflect actual contrast ratios"
  artifacts:
    - path: "constants/Colors.ts"
      provides: "primaryText, riscoR1Text, riscoR2Text, riscoR3Text, riscoR4Text tokens + corrected comments"
      contains: "primaryText"
    - path: "components/ui/Badge.tsx"
      provides: "WCAG AA-compliant badge text colors using *Text tokens"
      contains: "theme.successText"
    - path: "components/ui/SectionHeader.tsx"
      provides: "WCAG AA-compliant action link color"
      contains: "theme.primaryDark"
  key_links:
    - from: "components/ui/Badge.tsx"
      to: "constants/Colors.ts"
      via: "theme.*Text tokens in getBadgeColors()"
      pattern: "theme\\.(successText|warningText|errorText|primaryText|riscoR[1-4]Text)"
    - from: "components/ui/SectionHeader.tsx"
      to: "constants/Colors.ts"
      via: "theme.primaryDark for action link"
      pattern: "theme\\.primaryDark"
---

<objective>
Fix WCAG AA contrast failures in Badge.tsx and SectionHeader.tsx by using dedicated high-contrast *Text tokens for text on light backgrounds. Add missing tokens (primaryText, riscoR1-R4Text) to Colors.ts and correct misleading inline contrast comments.

Purpose: Close Gap 2 from 02-VERIFICATION.md — all text-on-background pairs must pass WCAG AA 4.5:1 minimum.
Output: Badge and SectionHeader with accessible text contrast; Colors.ts with accurate comments and complete *Text token set.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-design-system/02-VERIFICATION.md

<interfaces>
<!-- From constants/Colors.ts — current light theme tokens relevant to this fix -->
```typescript
// Existing tokens that PASS (use these):
successText: '#14532D',   // 7.3:1 on successLight (#F0FDF4)
warningText: '#78350F',   // 8.1:1 on warningLight (#FFFBEB)
errorText: '#7F1D1D',     // 8.9:1 on errorLight (#FEF2F2)
primaryDark: '#1D4ED8',   // 8.6:1 on primaryLight (#EFF6FF) — usable as primaryText

// Existing tokens that FAIL WCAG AA as text:
success: '#16A34A',       // 3.30:1 on white, 3.15:1 on successLight — FAILS
warning: '#D97706',       // 3.19:1 on white, 3.07:1 on warningLight — FAILS
primary: '#3B82F6',       // 3.68:1 on white, 3.38:1 on primaryLight — FAILS
error: '#DC2626',         // 5.9:1 on white (OK) but 4.41:1 on errorLight — FAILS
riscoR1: '#16A34A',       // same as success — FAILS
riscoR2: '#D97706',       // same as warning — FAILS
riscoR3: '#EA580C',       // 3.96:1 on riscoR3Light — FAILS
riscoR4: '#DC2626',       // same as error — FAILS
```

<!-- From components/ui/Badge.tsx — getBadgeColors() function (lines 52-76) -->
```typescript
function getBadgeColors(variant: BadgeVariant, theme): { bg: string; text: string } {
  switch (variant) {
    case 'R1': return { bg: theme.riscoR1Light, text: theme.riscoR1 };       // FAILS
    case 'R2': return { bg: theme.riscoR2Light, text: theme.riscoR2 };       // FAILS
    case 'R3': return { bg: theme.riscoR3Light, text: theme.riscoR3 };       // FAILS
    case 'R4': return { bg: theme.riscoR4Light, text: theme.riscoR4 };       // FAILS
    case 'success': return { bg: theme.successLight, text: theme.success };   // FAILS
    case 'warning': return { bg: theme.warningLight, text: theme.warning };   // FAILS
    case 'error':   return { bg: theme.errorLight,   text: theme.error };     // FAILS
    case 'info':    return { bg: theme.primaryLight,  text: theme.primary };  // FAILS
    case 'agente':       return { bg: theme.primaryLight,  text: theme.primary };  // FAILS
    case 'supervisor':   return { bg: theme.warningLight,  text: theme.warning };  // FAILS
    case 'admin':        return { bg: theme.errorLight,    text: theme.error };    // FAILS
    case 'master_admin': return { bg: theme.successLight,  text: theme.success };  // FAILS
    default: return { bg: theme.surfaceVariant, text: theme.textSecondary };  // OK
  }
}
```

<!-- From components/ui/SectionHeader.tsx — line 41 -->
```typescript
<Text style={[styles.action, { color: theme.primary }]}> // 3.68:1 — FAILS
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add missing *Text tokens to Colors.ts and fix inline comments</name>
  <read_first>constants/Colors.ts, context/ThemeContext.tsx</read_first>
  <files>constants/Colors.ts</files>
  <action>
In constants/Colors.ts, make these EXACT changes:

**1. Add new tokens in the light theme (after line 16, the primaryDark line):**
```
primaryText: '#1E40AF',         // texto sobre primaryLight — 8.1:1
```

**2. Add risco text tokens (after line 45, the riscoR4Light line):**
```
riscoR1Text: '#14532D',        // texto sobre riscoR1Light — 9.1:1 (same as successText)
riscoR2Text: '#78350F',        // texto sobre riscoR2Light — 8.1:1 (same as warningText)
riscoR3Text: '#7C2D12',        // texto sobre riscoR3Light — 8.5:1
riscoR4Text: '#7F1D1D',        // texto sobre riscoR4Light — 8.9:1 (same as errorText)
```

**3. Add matching tokens in the dark theme (after line 61, the primaryDark line):**
```
primaryText: '#93C5FD',        // texto sobre primaryLight dark — 8.2:1
```

**4. Add dark risco text tokens (after line 90, the riscoR4Light line):**
```
riscoR1Text: '#BBF7D0',       // texto sobre riscoR1Light dark (same as successText dark)
riscoR2Text: '#FEF3C7',       // texto sobre riscoR2Light dark (same as warningText dark)
riscoR3Text: '#FED7AA',       // texto sobre riscoR3Light dark
riscoR4Text: '#FECACA',       // texto sobre riscoR4Light dark (same as errorText dark)
```

**5. Fix incorrect inline comments on existing tokens (light theme):**
- Line 18: change `// verde — contraste 5.1:1 sobre branco` to `// verde — contraste 3.3:1 sobre branco (use successText for AA text)`
- Line 22: change `// âmbar — contraste 4.6:1 sobre branco` to `// âmbar — contraste 3.2:1 sobre branco (use warningText for AA text)`

**IMPORTANT:** Do NOT change any existing color hex values. Only ADD new tokens and FIX comments. The ThemeContext uses `typeof Colors.light` inference, so new tokens auto-propagate — no ThemeContext changes needed.
  </action>
  <acceptance_criteria>
    - Colors.ts light theme contains `primaryText: '#1E40AF'`
    - Colors.ts light theme contains `riscoR1Text:`, `riscoR2Text:`, `riscoR3Text:`, `riscoR4Text:`
    - Colors.ts dark theme contains `primaryText:`, `riscoR1Text:`, `riscoR2Text:`, `riscoR3Text:`, `riscoR4Text:`
    - Line with `success:` does NOT say "5.1:1"
    - Line with `warning:` does NOT say "4.6:1"
  </acceptance_criteria>
  <verify>
    <automated>cd "C:/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo" && grep -c "primaryText:" constants/Colors.ts | grep -q "2" && grep -c "riscoR1Text:" constants/Colors.ts | grep -q "2" && grep -c "riscoR2Text:" constants/Colors.ts | grep -q "2" && grep -c "riscoR3Text:" constants/Colors.ts | grep -q "2" && grep -c "riscoR4Text:" constants/Colors.ts | grep -q "2" && ! grep "5\.1:1" constants/Colors.ts && ! grep "4\.6:1" constants/Colors.ts && echo "PASS"</automated>
  </verify>
  <done>Colors.ts has primaryText + riscoR1-R4Text tokens in both light and dark themes; inline comments reflect actual contrast ratios.</done>
</task>

<task type="auto">
  <name>Task 2: Fix Badge.tsx and SectionHeader.tsx to use *Text tokens</name>
  <read_first>components/ui/Badge.tsx, components/ui/SectionHeader.tsx, constants/Colors.ts</read_first>
  <files>components/ui/Badge.tsx, components/ui/SectionHeader.tsx</files>
  <action>
**In components/ui/Badge.tsx**, replace every text color in `getBadgeColors()` (lines 56-76) with *Text variants. The EXACT new switch body should be:

```typescript
function getBadgeColors(
  variant: BadgeVariant,
  theme: ReturnType<typeof useTheme>['theme']
): { bg: string; text: string } {
  switch (variant) {
    // Risco — use *Text tokens for WCAG AA compliance
    case 'R1': return { bg: theme.riscoR1Light, text: theme.riscoR1Text };
    case 'R2': return { bg: theme.riscoR2Light, text: theme.riscoR2Text };
    case 'R3': return { bg: theme.riscoR3Light, text: theme.riscoR3Text };
    case 'R4': return { bg: theme.riscoR4Light, text: theme.riscoR4Text };
    // Estados
    case 'success': return { bg: theme.successLight, text: theme.successText };
    case 'warning': return { bg: theme.warningLight, text: theme.warningText };
    case 'error':   return { bg: theme.errorLight,   text: theme.errorText   };
    case 'info':    return { bg: theme.primaryLight,  text: theme.primaryText };
    // Roles
    case 'agente':       return { bg: theme.primaryLight,  text: theme.primaryText };
    case 'supervisor':   return { bg: theme.warningLight,  text: theme.warningText };
    case 'admin':        return { bg: theme.errorLight,    text: theme.errorText   };
    case 'master_admin': return { bg: theme.successLight,  text: theme.successText };
    // Default
    default:
      return { bg: theme.surfaceVariant, text: theme.textSecondary };
  }
}
```

**In components/ui/SectionHeader.tsx**, line 41:
Change `{ color: theme.primary }` to `{ color: theme.primaryDark }`.

The token `primaryDark` is `#1D4ED8` (light theme) which gives 8.6:1 contrast on the `#F8FAFC` background — well above WCAG AA. This is a better choice than `primaryText` (`#1E40AF`) because the action link sits on the page background, not on primaryLight.
  </action>
  <acceptance_criteria>
    - Badge.tsx getBadgeColors contains `theme.riscoR1Text` not `theme.riscoR1` for text
    - Badge.tsx getBadgeColors contains `theme.successText` not `theme.success` for text
    - Badge.tsx getBadgeColors contains `theme.warningText` not `theme.warning` for text
    - Badge.tsx getBadgeColors contains `theme.errorText` not `theme.error` for text
    - Badge.tsx getBadgeColors contains `theme.primaryText` not `theme.primary` for text
    - SectionHeader.tsx contains `theme.primaryDark` not `theme.primary` for action color
  </acceptance_criteria>
  <verify>
    <automated>cd "C:/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo" && grep "text: theme.riscoR1Text" components/ui/Badge.tsx && grep "text: theme.successText" components/ui/Badge.tsx && grep "text: theme.warningText" components/ui/Badge.tsx && grep "text: theme.errorText" components/ui/Badge.tsx && grep "text: theme.primaryText" components/ui/Badge.tsx && ! grep "text: theme.riscoR1 " components/ui/Badge.tsx && ! grep "text: theme.success " components/ui/Badge.tsx && grep "theme.primaryDark" components/ui/SectionHeader.tsx && ! grep "color: theme.primary " components/ui/SectionHeader.tsx && echo "PASS"</automated>
  </verify>
  <done>All Badge text colors use *Text tokens (7.3-10:1 contrast). SectionHeader action link uses primaryDark (8.6:1 contrast). All text-on-background pairs pass WCAG AA 4.5:1.</done>
</task>

</tasks>

<verification>
1. `grep -c "Text:" constants/Colors.ts` should show 10+ (5 new tokens x 2 themes)
2. `grep "text: theme\." components/ui/Badge.tsx` — every line should end with a *Text token
3. `grep "theme.primaryDark" components/ui/SectionHeader.tsx` — action link uses high-contrast token
4. No remaining `theme.success ` / `theme.warning ` / `theme.error ` / `theme.primary ` used as text color in Badge or SectionHeader
</verification>

<success_criteria>
- All Badge variants use *Text tokens for text color on *Light backgrounds
- SectionHeader action link uses primaryDark instead of primary
- Colors.ts has primaryText and riscoR1-R4Text tokens in both themes
- Inline contrast comments in Colors.ts are accurate
- TypeScript compiles without errors (typeof inference auto-propagates new tokens)
</success_criteria>

<output>
After completion, create `.planning/phases/02-design-system/02-gap-01-SUMMARY.md`
</output>
