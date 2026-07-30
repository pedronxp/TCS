## ADDED Requirements

### Requirement: Penpot is the visual source of truth
Web, Android, and iOS implementations SHALL derive brand colors, typography, spacing, radii, status semantics, risk semantics, and component intent from the approved Penpot foundations.

#### Scenario: Platform token differs from Penpot
- **WHEN** a release candidate contains a semantic token value different from the approved Penpot token without an approved exception
- **THEN** the design validation SHALL fail and identify the divergent token

### Requirement: Platforms share semantics, not forced widgets
The platforms SHALL preserve the same information hierarchy, terminology, action intent, and state meaning while using navigation and interaction patterns appropriate to Web, Android, and iOS.

#### Scenario: Mobile replaces a desktop table
- **WHEN** a dense Web table is represented as a mobile list
- **THEN** the mobile design SHALL preserve the required information and actions without requiring pixel-identical composition

### Requirement: Subscription and access states use consistent language
Trial, active, grace, past due, cancel-at-period-end, canceled, plan-lock, permission-denied, loading, empty, and error states SHALL use a shared product glossary across platforms.

#### Scenario: Module is absent from the plan
- **WHEN** the same feature is unavailable on Web and mobile
- **THEN** both platforms SHALL identify a plan restriction and offer the equivalent allowed next action

### Requirement: Accessibility adapts per platform
Each platform SHALL meet its relevant focus, screen reader, contrast, text scaling, reduced motion, touch target, and navigation requirements.

#### Scenario: User increases system text size
- **WHEN** a user enables supported large-text settings
- **THEN** essential content and actions SHALL remain available without overlap or horizontal clipping

### Requirement: Shared identity is versioned
The semantic token and content contract SHALL have a version that can be traced to approved Penpot boards and platform releases.

#### Scenario: Token contract is updated
- **WHEN** a new identity contract version is approved
- **THEN** Web, Android, and iOS release records SHALL declare the adopted contract version or a documented temporary exception
