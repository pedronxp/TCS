## ADDED Requirements

### Requirement: Public commercial experience precedes authentication
The system SHALL expose a public Commercial page at `/` with Produto, Soluções, Planos and Segurança content and SHALL direct internal staff to `/login` before any protected console route.

#### Scenario: Unauthenticated visitor opens the web application
- **WHEN** a visitor opens `/` without a session
- **THEN** the system SHALL render the public Commercial experience without mounting protected console navigation or requesting privileged internal data

#### Scenario: Visitor chooses to enter the console
- **WHEN** the visitor activates an Entrar action from the Commercial page
- **THEN** the system SHALL navigate to `/login` and preserve a safe intended destination when one exists

### Requirement: Authenticated console has a distinct route boundary
The system SHALL host protected internal routes under `/app/*` and SHALL keep public and authenticated layouts independent.

#### Scenario: Authenticated staff opens the console root
- **WHEN** authorized staff opens `/app`
- **THEN** the system SHALL render the role-appropriate dashboard inside the authenticated console shell

#### Scenario: Unauthenticated visitor opens a protected route
- **WHEN** a visitor opens any `/app/*` route without a valid authorized session
- **THEN** the system SHALL redirect to `/login` without briefly rendering protected content

#### Scenario: Existing internal link uses a legacy route
- **WHEN** an approved legacy route is opened during migration
- **THEN** the system SHALL redirect to its `/app/*` equivalent without losing customer, agent or filter parameters

### Requirement: UI primitives use a versioned shadcn foundation
The system SHALL implement shared interactive primitives as repository-owned shadcn/ui components configured through `components.json` and semantic theme tokens.

#### Scenario: A page needs a primary action
- **WHEN** a migrated page renders a primary action
- **THEN** it SHALL use the shared Button variants and semantic tokens rather than duplicating literal color, radius and focus classes

#### Scenario: Theme values change
- **WHEN** an approved brand color, radius or surface token changes
- **THEN** migrated components SHALL receive the change through semantic variables without page-by-page class replacement

### Requirement: Visual tokens represent brand and operational meaning
The system SHALL provide semantic tokens for TCS brand surfaces, text, borders, focus, success, information, warning, destructive actions, sidebar, charts and risk R1–R4.

#### Scenario: Risk is displayed
- **WHEN** the console displays a persisted R1, R2, R3 or R4 classification
- **THEN** it SHALL use the corresponding risk token, textual label and accessible non-color indicator

#### Scenario: A destructive action is presented
- **WHEN** a control can revoke, cancel, block, publish or otherwise cause high impact
- **THEN** it SHALL use the destructive or warning semantics appropriate to the confirmed impact rather than a generic brand color

### Requirement: Console shell adapts to role and viewport
The system SHALL provide grouped navigation, header context, global search and contextual actions based on the internal role and available width.

#### Scenario: Owner opens the console
- **WHEN** an owner enters `/app`
- **THEN** the shell SHALL prioritize executive, customer, commercial, support and governance tasks permitted to that owner

#### Scenario: Developer opens the console
- **WHEN** a developer enters `/app`
- **THEN** the shell SHALL prioritize technical health, versions, builds, forms, risk and technical events while withholding forbidden commercial mutations

#### Scenario: Console opens on a narrow viewport
- **WHEN** the sidebar cannot remain visible beside the content
- **THEN** navigation SHALL become an accessible off-canvas surface and required page actions SHALL remain reachable

### Requirement: Data surfaces communicate every state
The system SHALL provide consistent loading, empty, error, retry, refreshing and success feedback for queries and mutations.

#### Scenario: A query is loading
- **WHEN** a migrated data surface has no resolved data yet
- **THEN** it SHALL render a layout-appropriate skeleton or loading state without presenting zero as real data

#### Scenario: A query fails
- **WHEN** a query returns an authorization, validation, connectivity or server error
- **THEN** the surface SHALL preserve safe context, explain the failure and expose retry when retry is valid

#### Scenario: A mutation fails
- **WHEN** an administrative mutation fails
- **THEN** the system SHALL preserve the prior visible state and SHALL NOT show a success toast or optimistic value as final

### Requirement: Tables remain domain-specific and scalable
The system SHALL compose domain-specific TanStack tables from shared shadcn primitives, with server-side pagination and filtering where required.

#### Scenario: Customer table contains more records than one page
- **WHEN** staff navigates or filters the customer table
- **THEN** the table SHALL request the corresponding server page and communicate total, active filters and navigation state

#### Scenario: A table is opened on a narrow screen
- **WHEN** required columns cannot fit the viewport
- **THEN** the system SHALL provide controlled horizontal scrolling or an equivalent compact representation without hiding the primary row action

### Requirement: High-risk actions communicate impact and assurance
The system SHALL use a shared high-assurance confirmation pattern for sensitive actions while preserving existing server-side authorization.

#### Scenario: Staff initiates a high-risk action
- **WHEN** staff attempts plan publication, subscription cancellation, user blocking, remote session termination or production build
- **THEN** the interface SHALL identify the target, expected impact, required reason and assurance before submission

#### Scenario: Server rejects assurance or permission
- **WHEN** the server rejects the high-risk action
- **THEN** the dialog SHALL remain recoverable, display the returned reason and SHALL NOT imply that the operation completed

### Requirement: Public plans reflect approved real offerings
The system SHALL present public plan audiences, names, prices and capabilities from approved product configuration and SHALL NOT invent production offerings.

#### Scenario: Visitor compares individual plans
- **WHEN** the visitor selects the Individual audience
- **THEN** the page SHALL show only approved individual offerings and their public limits or calls to action

#### Scenario: Public plan data is unavailable
- **WHEN** a configured public plan source cannot be loaded
- **THEN** the page SHALL show a neutral contact action and SHALL NOT substitute demonstration plans as production data

### Requirement: Migration preserves functional contracts
The system SHALL preserve existing hooks, query keys, mutation payloads, route permissions and server-side authorization unless a separate approved change explicitly modifies them.

#### Scenario: A page is migrated to shadcn
- **WHEN** its old visual composition is replaced
- **THEN** existing successful, loading, empty, error, permission and mutation tests SHALL continue to pass or be updated only for intentional accessible markup changes

#### Scenario: A visual migration reveals a functional defect
- **WHEN** implementation discovers a business-logic or backend issue outside this change
- **THEN** the issue SHALL be recorded separately and SHALL NOT be silently bundled into the visual refactor

### Requirement: Migrated pages meet accessibility and responsive quality gates
The system SHALL validate critical pages for keyboard operation, visible focus, labels, contrast, zoom, reduced motion and supported viewport widths.

#### Scenario: User operates without a pointing device
- **WHEN** the user traverses navigation, filters, dialogs, tabs and tables by keyboard
- **THEN** focus order SHALL be logical, focus SHALL remain visible and dialogs SHALL restore focus on close

#### Scenario: User prefers reduced motion
- **WHEN** the operating system requests reduced motion
- **THEN** decorative continuous animation SHALL stop and required feedback SHALL remain understandable without motion

### Requirement: Penpot is the visual source of truth
The system SHALL implement every designed route from the approved `TCS — Web Dashboard` Penpot file without unapproved substitutions of palette, typography, branding, copy, composition, dimensions or component hierarchy.

#### Scenario: A designed route is implemented
- **WHEN** a route has an approved Penpot board
- **THEN** its implementation SHALL reproduce the approved tokens, structure, content hierarchy and visual components, with deviations limited to documented accessibility, responsive or real-data constraints

#### Scenario: Implementation conflicts with the approved board
- **WHEN** visual regression identifies an undocumented difference in color, typography, spacing, layout, content or component composition
- **THEN** the route SHALL remain incomplete until the implementation or the approved design is corrected

### Requirement: Every current route has design coverage
The system SHALL maintain a route design manifest covering every public and protected route with its Penpot board or approved template, role and permission context, required states, supported viewports and visual approval status.

#### Scenario: Existing routes are audited
- **WHEN** the route inventory is compared with the Penpot page inventory
- **THEN** every route SHALL be classified as designed, derived from an approved template or blocked awaiting a new board

#### Scenario: A route has no approved design
- **WHEN** implementation work reaches a route without a board or approved template derivation
- **THEN** visual migration SHALL pause for that route until design coverage is created and approved

### Requirement: Future routes inherit the TCS design system
The system SHALL require future routes to use semantic tokens, shared layout primitives, approved page templates and the route design manifest before they can be considered complete.

#### Scenario: A developer adds a future route
- **WHEN** a new route is introduced
- **THEN** it SHALL declare its layout template, Penpot reference, permission context, asynchronous states and responsive behavior in the route design manifest

#### Scenario: A future route bypasses the design system
- **WHEN** a new route introduces unapproved literal colors, parallel primitives or a layout without an approved template
- **THEN** automated quality gates SHALL fail or the route SHALL be rejected during review

### Requirement: Visual fidelity is a release gate
The system SHALL require visual comparison for each migrated route at 1440 px and responsive validation at 1024 px, 768 px and 390 px before enabling the route by default.

#### Scenario: A route completes its migration wave
- **WHEN** implementation, authenticated behavior and accessibility tests pass
- **THEN** the route SHALL also pass side-by-side visual review against its approved Penpot board before its migration task is marked complete

#### Scenario: Penpot has no narrow-screen board
- **WHEN** a route requires 1024 px, 768 px or 390 px behavior not represented in Penpot
- **THEN** responsive rules or variants SHALL be added to the design contract before final approval

### Requirement: Brand tokens match the approved foundation
The system SHALL expose the approved Penpot foundation through semantic tokens, including `#FAF8F5`, `#FFFFFF`, `#1C1917`, `#F3EFE9`, `#E7E0D8`, `#6F513A`, `#D7C3AA`, `#EAF4FB` and `#2F6F96`, Inter typography, the 4/8/12/16/24/32 px spacing scale and 6/10/14/24 px radii.

#### Scenario: Shared components render brand styling
- **WHEN** a shared component renders a brand surface, action, border, informational state or heading
- **THEN** it SHALL resolve its styling from the approved semantic token rather than a page-local literal value

#### Scenario: A brand token changes in Penpot
- **WHEN** the approved Foundation board changes
- **THEN** the code token source, component reference page and visual baselines SHALL be updated together
