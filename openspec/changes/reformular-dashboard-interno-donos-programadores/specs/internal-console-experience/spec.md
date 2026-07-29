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

### Requirement: Customer users open a dedicated agent detail
The system SHALL make each permitted user in a customer navigable to `/clientes/:customerId/usuarios/:userId/:userSection?` and SHALL preserve the selected customer as the authorization boundary.

#### Scenario: Staff selects an organization agent
- **WHEN** authorized staff activates the user row or the “Ver agente” action inside a customer's Users section
- **THEN** the system SHALL open that agent's summary with identity, membership, effective access, inherited plan, last login and last known activity

#### Scenario: Requested user is outside the customer
- **WHEN** staff changes `userId` to a user that does not belong to `customerId`
- **THEN** the server SHALL return not found or access denied without revealing the other user's activity or existence

### Requirement: Agent detail contains only relevant operational modules
The system SHALL organize agent detail into Visão geral, Vistorias, Mapa, Agendamentos, Documentos and Acesso/atividade.

#### Scenario: Staff navigates between agent modules
- **WHEN** staff changes the agent section
- **THEN** the route SHALL remain inside the same customer and agent and each module SHALL provide loading, empty, error and retry states

#### Scenario: Staff opens an invalid agent section
- **WHEN** `userSection` is absent or unsupported
- **THEN** the system SHALL show the agent summary without losing customer or user context

### Requirement: Agent overview uses a consistent reporting period
The system SHALL show inspections, previous-period change, R1–R4 distribution, active days, last inspection, geolocated percentage and document completeness for one shared reporting period.

#### Scenario: Staff changes the period
- **WHEN** staff selects 7 days, 30 days, 90 days or a valid custom period
- **THEN** KPIs, charts, inspection totals and map totals SHALL refresh from the same server filters and SHALL identify the comparison period

#### Scenario: A metric has no source data
- **WHEN** an agent has no persisted source for a metric such as app version or technical activity
- **THEN** the system SHALL display “Não informado” or “Desconhecido” and SHALL NOT infer a healthy or successful value

### Requirement: Agent inspection history is complete and paginated
The system SHALL make the agent's complete authorized inspection history queryable through server-side pagination, filtering and stable newest-first ordering.

#### Scenario: Agent has more than fifty inspections
- **WHEN** staff opens an agent whose history exceeds the current customer-detail limit
- **THEN** the first page SHALL report the full filtered total and navigation SHALL reach older inspections without a silent global cap

#### Scenario: Staff filters inspections
- **WHEN** staff filters by period, risk, status, form or permitted protocol/address text
- **THEN** the list, total, KPIs and map SHALL describe the same filtered inspection set

### Requirement: Agent map represents all filtered geolocated inspections
The system SHALL render filtered agent inspections through viewport-aware points or clusters and SHALL communicate records that lack valid coordinates.

#### Scenario: Map contains a large history
- **WHEN** the filtered result contains more points than the browser point threshold
- **THEN** the server SHALL return clusters or viewport-bounded points whose counts represent the full filtered geolocated set

#### Scenario: Inspection lacks coordinates
- **WHEN** a filtered inspection has no valid latitude or longitude
- **THEN** it SHALL remain in list and KPIs, be excluded from map markers and contribute to the visible “sem localização” count

### Requirement: Agent detail remains responsive and accessible
The system SHALL keep agent modules usable on desktop, tablet and narrow screens with keyboard-accessible user rows, filters, tabs, tables and map alternatives.

#### Scenario: Map cannot be operated visually
- **WHEN** a user relies on keyboard navigation or a screen reader
- **THEN** the system SHALL offer an equivalent textual list of mapped inspections and SHALL NOT make the map the only path to inspection detail
