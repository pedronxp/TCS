## ADDED Requirements

### Requirement: Every canonical portal route has a Penpot board
Each individual and municipal canonical route SHALL have an approved Penpot board or an explicit approved derivation that identifies audience, role, plan/module context, states, and components.

#### Scenario: New portal route has no board
- **WHEN** implementation adds a canonical portal route without a registered approved board
- **THEN** the design governance check SHALL fail

### Requirement: Portal designs cover required breakpoints
Every canonical route SHALL be validated at 1440, 1024, 768, and 390 px without inaccessible actions or horizontal overflow.

#### Scenario: Mobile board clips a primary action
- **WHEN** the 390 px board places a required action outside the viewport or behind an unavailable interaction
- **THEN** the board SHALL remain pending approval

### Requirement: Transversal states are designed
The Penpot library SHALL contain reusable loading, empty, error/retry, plan-lock, permission-denied, trial, active, past-due, grace, cancel-at-period-end, canceled, and expired states for individual and municipal shells.

#### Scenario: Route fetch fails
- **WHEN** a data route is reviewed for implementation
- **THEN** its board or registered state pattern SHALL define the error, retry, preserved-data, and support behavior

### Requirement: Existing foundations and components are reused
New portal boards SHALL use the approved TCS Foundations and component library, and any new component SHALL be documented as a reusable component with semantic states.

#### Scenario: Board introduces an untracked literal color
- **WHEN** a portal board uses a color outside the approved semantic tokens without an approved exception
- **THEN** the board SHALL fail visual governance review

### Requirement: Accessibility is part of visual approval
Penpot handoff SHALL annotate keyboard/focus order, text alternatives for visual data, responsive transformation, reduced-motion behavior, and minimum contrast/touch targets where applicable.

#### Scenario: Map has no accessible alternative
- **WHEN** a map board is submitted without an equivalent list or textual summary
- **THEN** the board SHALL remain pending approval

### Requirement: Implementation starts only after visual approval
No portal implementation wave SHALL begin until the relevant Penpot boards and OpenSpec artifacts are approved and the work is started in a new branch.

#### Scenario: Tasks are ready but boards are pending
- **WHEN** OpenSpec tasks exist while one or more required boards remain `pending-approval`
- **THEN** `/opsx:apply` SHALL remain blocked for the affected wave
