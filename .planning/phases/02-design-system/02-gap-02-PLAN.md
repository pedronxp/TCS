---
phase: 02-design-system
plan: gap-02
type: execute
wave: 1
depends_on: []
files_modified:
  - components/BottomNavBar.tsx
autonomous: true
gap_closure: true
requirements: [DS-06]

must_haves:
  truths:
    - "BottomNavBar does not re-render when AuthContext fields other than profile.role change"
    - "BottomNavBar renders correct tabs for each role (agente/supervisor/admin/master_admin)"
  artifacts:
    - path: "components/BottomNavBar.tsx"
      provides: "Inner memoized component that only receives role as prop"
      contains: "React.memo(BottomNavBarInner"
  key_links:
    - from: "components/BottomNavBar.tsx (outer)"
      to: "AuthContext"
      via: "useAuth() extracts profile.role only"
      pattern: "profile\\.role"
    - from: "components/BottomNavBar.tsx (BottomNavBarInner)"
      to: "role prop"
      via: "React.memo on props"
      pattern: "React\\.memo\\(BottomNavBarInner"
---

<objective>
Refactor BottomNavBar to use an inner memoized component that receives `role` as a prop, so React.memo actually prevents re-renders when AuthContext changes without a role change.

Purpose: Close Gap 1 from 02-VERIFICATION.md — React.memo must provide real memoization benefit, not just wrap a hook-driven component.
Output: BottomNavBar with effective React.memo via prop-based inner component.
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
<!-- From context/AuthContext.tsx — useAuth() return type -->
```typescript
// useAuth() returns { profile, user, session, signIn, signOut, ... }
// profile has: { role: string, ... } (many other fields that change frequently)
```

<!-- From components/BottomNavBar.tsx — current structure (167 lines) -->
```typescript
// Line 49: function BottomNavBarComponent() — uses useTheme, useAuth, usePathname hooks
// Line 51: const { profile } = useAuth();  — subscribes to ENTIRE AuthContext
// Line 62: switch (profile.role) — only field actually needed from auth
// Line 167: export const BottomNavBar = React.memo(BottomNavBarComponent);
// Since BottomNavBarComponent takes ZERO props, React.memo never prevents re-renders
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor BottomNavBar with inner memoized component</name>
  <read_first>components/BottomNavBar.tsx, context/AuthContext.tsx, context/ThemeContext.tsx</read_first>
  <files>components/BottomNavBar.tsx</files>
  <action>
Refactor components/BottomNavBar.tsx with the following architecture:

**1. Create `BottomNavBarInner` — the memoized inner component.**

This component receives `role` and `pathname` as props (NOT from hooks). It still uses `useTheme()` internally (theme changes should trigger re-render — that's correct behavior). It contains ALL the rendering logic currently in `BottomNavBarComponent`.

```typescript
interface BottomNavBarInnerProps {
  role: string;
  pathname: string;
}

const BottomNavBarInner = React.memo(function BottomNavBarInner({ role, pathname }: BottomNavBarInnerProps) {
  const { theme } = useTheme();

  const shouldShow = NAVBAR_VISIBLE_PATHS.some(p => {
    const norm = pathname.replace(/\/+$/, '');
    return norm === p || norm.endsWith(p);
  });

  if (!shouldShow) return null;

  let tabs: NavTab[];
  switch (role) {
    case 'master_admin': tabs = TABS_MASTER; break;
    case 'admin':        tabs = TABS_ADMIN; break;
    case 'supervisor':   tabs = TABS_SUPERVISOR; break;
    default:             tabs = TABS_AGENT;
  }

  const isActive = (tab: NavTab) => {
    const norm = pathname.replace(/\/+$/, '');
    return (tab.matchPaths ?? [tab.route]).some(p => norm === p || norm.endsWith(p));
  };

  return (
    <View style={[styles.container, {
      backgroundColor: theme.surfaceHighlight,
      borderTopColor: theme.border,
    }]}>
      {tabs.map(tab => {
        const active = isActive(tab);
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.topBar, active && { backgroundColor: theme.primary }]} />
            <View style={[
              styles.iconPill,
              active && { backgroundColor: `${theme.primary}18` },
            ]}>
              <Feather
                name={tab.icon}
                size={active ? 23 : 21}
                color={active ? theme.primary : theme.textSecondary}
              />
            </View>
            <Text style={[
              styles.label,
              { color: active ? theme.primary : theme.textSecondary },
              active && styles.labelActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
```

**2. Simplify the outer `BottomNavBar` to a thin wrapper.**

The outer component extracts ONLY `profile.role` from useAuth() and `pathname` from usePathname(), then passes them as props to the memoized inner:

```typescript
export function BottomNavBar() {
  const { profile } = useAuth();
  const pathname = usePathname();

  if (!profile) return null;

  return <BottomNavBarInner role={profile.role} pathname={pathname} />;
}
```

**3. Remove the old `React.memo(BottomNavBarComponent)` export at line 167.** The outer `BottomNavBar` is now a regular function (no memo needed — it's the thin wrapper). The inner `BottomNavBarInner` is the memo'd component.

**Key behavior preserved:**
- Still returns null when `!profile` (moved to outer)
- Still returns null when path not in NAVBAR_VISIBLE_PATHS (stays in inner)
- Tab selection by role works identically
- Active state detection works identically
- All styles unchanged

**Key improvement:**
- When AuthContext changes (e.g., user.email update, session refresh) but profile.role stays the same, React.memo on BottomNavBarInner skips re-render because the `role` prop hasn't changed.
- pathname changes still trigger re-render (correct — active tab must update).
  </action>
  <acceptance_criteria>
    - File contains `React.memo(function BottomNavBarInner`
    - File contains `interface BottomNavBarInnerProps` with `role: string`
    - Outer `BottomNavBar` function calls `useAuth()` and passes `profile.role` to inner
    - File does NOT contain `React.memo(BottomNavBarComponent)` (old pattern removed)
    - Outer export is `export function BottomNavBar()` (not memo-wrapped)
  </acceptance_criteria>
  <verify>
    <automated>cd "C:/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo" && grep "React.memo(function BottomNavBarInner" components/BottomNavBar.tsx && grep "role: string" components/BottomNavBar.tsx && grep "profile.role" components/BottomNavBar.tsx && grep "export function BottomNavBar" components/BottomNavBar.tsx && ! grep "React.memo(BottomNavBarComponent)" components/BottomNavBar.tsx && echo "PASS"</automated>
  </verify>
  <done>BottomNavBar uses inner React.memo component that receives role as prop. Re-renders from AuthContext changes that don't affect profile.role are prevented. All existing behavior (tab selection, visibility, active state) preserved.</done>
</task>

</tasks>

<verification>
1. `grep "BottomNavBarInner" components/BottomNavBar.tsx` — inner component exists
2. `grep "React.memo" components/BottomNavBar.tsx` — only wraps BottomNavBarInner, not outer
3. `grep "profile.role" components/BottomNavBar.tsx` — role extracted in outer, passed as prop
4. Outer component does NOT call useTheme (theme stays in inner)
</verification>

<success_criteria>
- BottomNavBarInner is memoized via React.memo and receives role + pathname as props
- Outer BottomNavBar is a thin wrapper extracting role from useAuth and pathname from usePathname
- React.memo now actually prevents re-renders when AuthContext changes without role change
- All existing navigation behavior preserved (tabs, visibility, active states)
</success_criteria>

<output>
After completion, create `.planning/phases/02-design-system/02-gap-02-SUMMARY.md`
</output>
