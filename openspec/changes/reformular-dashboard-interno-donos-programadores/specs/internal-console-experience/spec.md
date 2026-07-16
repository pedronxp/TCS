## ADDED Requirements

### Requirement: Console presents an internal task-oriented shell
The system SHALL present authenticated internal staff with a responsive shell whose navigation is grouped into Principal, Negócio, Desenvolvimento and Governança according to the staff member's permissions.

#### Scenario: Owner opens the console
- **WHEN** an active owner completes authentication
- **THEN** the system SHALL show the executive navigation and SHALL omit developer-only actions that the owner cannot execute

#### Scenario: Developer opens the console
- **WHEN** an active developer completes authentication
- **THEN** the system SHALL show the technical navigation and SHALL omit commercial mutation actions

### Requirement: Dashboard is adapted to the internal role
The system SHALL provide an executive dashboard for owners and a technical dashboard for developers using persisted production data.

#### Scenario: Owner views the dashboard
- **WHEN** an owner opens the home page
- **THEN** the system SHALL show actionable customer, subscription, renewal, support and implementation indicators

#### Scenario: Developer views the dashboard
- **WHEN** a developer opens the home page
- **THEN** the system SHALL show actionable version, build, synchronization, storage and error indicators

### Requirement: Customer context organizes operational information
The system SHALL make Cliente the central navigation context for organization and individual account information.

#### Scenario: Internal user opens a municipal customer
- **WHEN** an authorized internal user opens a customer
- **THEN** the system SHALL present summary, subscription, usage, users, sessions, inspections, support, implementation and audit information scoped to that customer

#### Scenario: Internal user opens an individual customer
- **WHEN** an authorized internal user opens an individual account
- **THEN** the system SHALL present the applicable customer sections without requiring a synthetic municipality

### Requirement: Operational modules are scoped before display
The system SHALL require a selected customer before displaying inspections, map, appointments, municipal users or reports used for internal support.

#### Scenario: User investigates customer inspections
- **WHEN** an internal user opens inspections from a customer detail page
- **THEN** the system SHALL query and display only records belonging to that customer's persisted scope

#### Scenario: User attempts a global operational route
- **WHEN** an internal user opens a legacy global operational route
- **THEN** the system SHALL redirect to customer selection or a clearly identified compatibility view without silently combining customers

### Requirement: Every data surface communicates state
The system SHALL provide loading, empty, success and error states for every query and administrative mutation.

#### Scenario: Query returns no customers
- **WHEN** a customer query succeeds with no rows
- **THEN** the system SHALL show an actionable empty state and SHALL NOT display a blank table

#### Scenario: Administrative mutation fails
- **WHEN** a mutation is rejected by validation, authorization or connectivity
- **THEN** the system SHALL preserve the previous visible state and show the returned error without reporting success

### Requirement: Console remains usable across supported sizes
The system SHALL support desktop, tablet and narrow screens with keyboard-accessible navigation, controls and dialogs.

#### Scenario: Console is opened on a narrow screen
- **WHEN** the available width cannot fit the desktop sidebar and content grid
- **THEN** the system SHALL provide a collapsible navigation and reflow content without hiding required actions or causing horizontal page overflow

#### Scenario: User navigates by keyboard
- **WHEN** a user operates the console without a pointing device
- **THEN** all interactive controls SHALL be reachable in logical order and SHALL expose visible focus and accessible labels

### Requirement: Global customer search preserves context
The system SHALL provide a global search for customers by display name, legal name, municipality, contact or identifier.

#### Scenario: User selects a search result
- **WHEN** an internal user selects a permitted customer result
- **THEN** the system SHALL navigate to that customer's summary and preserve the selected customer across its tabs
