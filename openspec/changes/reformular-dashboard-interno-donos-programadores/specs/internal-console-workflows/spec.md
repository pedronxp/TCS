## ADDED Requirements

### Requirement: Internal staff can manage a unified customer record
The system SHALL let authorized staff create, inspect and update a unified customer record representing either an organization or an individual account.

#### Scenario: Owner creates a municipal customer
- **WHEN** an owner submits valid municipal, contact and implementation information
- **THEN** the system SHALL create the organization and customer context without granting access through a client-provided municipality string

#### Scenario: Staff opens customer health
- **WHEN** authorized staff opens a customer summary
- **THEN** the system SHALL show subscription status, limits, usage warnings, active users, last activity, sessions, support status and relevant technical health

### Requirement: Subscription lifecycle is fully manageable
The system SHALL allow owners to assign plans and manage trial, active, grace, past-due, canceled and expired subscription states through validated and audited operations.

#### Scenario: Owner assigns a plan
- **WHEN** an owner selects a compatible plan, start date, period and approved overrides for a customer
- **THEN** the system SHALL create or update the subscription atomically and refresh the customer's entitlements

#### Scenario: Owner cancels a subscription
- **WHEN** an owner confirms cancellation and supplies a required reason
- **THEN** the system SHALL apply the configured cancellation timing, preserve authorized historical access and record the change

### Requirement: Commercial plans retain versioned configuration
The system SHALL allow owners to edit plan identity, pricing proposal, trial, grace, features, limits and support targets while preserving version history.

#### Scenario: Owner publishes a plan configuration
- **WHEN** an owner submits a valid active configuration
- **THEN** the system SHALL create a new version, make it the current version and audit the published commercial settings

#### Scenario: Developer opens a plan
- **WHEN** a developer views plan configuration
- **THEN** the system SHALL provide read-only technical entitlements without exposing mutation controls or accepting mutations

### Requirement: Support workflow includes ownership and history
The system SHALL provide a support queue with customer, plan, priority, SLA, assignee, status, messages, notes and event history.

#### Scenario: Staff updates a ticket
- **WHEN** authorized staff changes priority, assignee or status or adds a message
- **THEN** the system SHALL persist the update, append a support event and recalculate applicable SLA indicators

#### Scenario: Ticket is overdue
- **WHEN** an open ticket passes a configured response or escalation deadline
- **THEN** the system SHALL mark the deadline as breached and surface it in the internal dashboard and queue

### Requirement: Session operations are safe and traceable
The system SHALL list customer and internal sessions with device, platform, status and heartbeat and SHALL allow permitted remote termination.

#### Scenario: Authorized staff terminates a session
- **WHEN** authorized staff confirms remote termination with a reason
- **THEN** the system SHALL revoke the session through a protected server operation, refresh the list and create an audit event

#### Scenario: Session termination fails
- **WHEN** the server rejects or cannot complete termination
- **THEN** the system SHALL keep the session visible in its prior state and show the failure

### Requirement: Developer operations expose real platform state
The system SHALL provide developers with persisted status and permitted actions for app versions, builds, forms, risk configuration, synchronization, storage and technical events.

#### Scenario: Developer investigates synchronization failures
- **WHEN** a developer filters synchronization diagnostics by customer, version, platform, time or severity
- **THEN** the system SHALL return sanitized persisted events matching the filters and provide correlation identifiers for investigation

#### Scenario: Developer publishes a form version
- **WHEN** an authorized developer submits a validated form version under the configured approval policy
- **THEN** the system SHALL publish or queue the version, preserve the previous version for rollback and audit the action

### Requirement: Audit timeline covers sensitive internal actions
The system SHALL provide a filterable audit timeline for customer, subscription, plan, support, session, staff, build, version and configuration events.

#### Scenario: Owner reviews customer history
- **WHEN** an owner filters the audit timeline by a customer
- **THEN** the system SHALL show chronological events with actor, action, target, timestamp, result and sanitized metadata

### Requirement: Administrative mutations are typed and recoverable
The system SHALL execute administrative mutations through typed domain operations that return explicit success or failure and support safe retries when applicable.

#### Scenario: Network is interrupted during an idempotent operation
- **WHEN** the client cannot determine whether an idempotent administrative request completed
- **THEN** the system SHALL use an operation identifier to retrieve or safely retry the result without duplicating the action

### Requirement: Production console does not present simulated business data
The system MUST distinguish demonstration data from production and SHALL NOT render mock customers, metrics, events or successful actions in production.

#### Scenario: Production data source is unavailable
- **WHEN** a required production query fails
- **THEN** the system SHALL show an error state and SHALL NOT substitute demonstration values

### Requirement: Agent operational queries are scoped and scalable
The system SHALL resolve agent summary, inspection pages, map clusters, appointments, documents and activity server-side using persisted customer and user identifiers.

#### Scenario: Organization agent data is requested
- **WHEN** the server receives a valid organization customer and member user
- **THEN** it SHALL validate active or historical membership as permitted and query records by persisted `organization_id` and user identifier rather than agent name or municipality text

#### Scenario: Pagination is repeated
- **WHEN** staff requests the next inspection page with an unchanged filter and cursor
- **THEN** the system SHALL return a stable, non-duplicated continuation ordered by inspection date and identifier

### Requirement: Agent documents use protected download access
The system SHALL list generated laudo, relatório and termo states for the agent and SHALL create time-limited download access only after authorization.

#### Scenario: Staff opens an agent document
- **WHEN** authorized staff requests a private document from the agent detail
- **THEN** the server SHALL verify customer, user and sensitive-data permission before returning a short-lived signed URL

### Requirement: Agent access actions use protected operations
The system SHALL execute approval, blocking, session termination and password reset through protected server operations with explicit permission, confirmation and audit.

#### Scenario: Owner blocks an agent
- **WHEN** an owner confirms blocking and provides the required reason
- **THEN** the server SHALL update effective access, revoke applicable active sessions and record the before-and-after state

#### Scenario: Developer attempts an owner-only access mutation
- **WHEN** a developer invokes the mutation directly
- **THEN** the server SHALL reject it even if the frontend control is hidden

### Requirement: Legacy inspection ownership is reconciled explicitly
The system SHALL report and reconcile inspections with missing organization or invalid agent identifiers before relying on the agent detail for complete history.

#### Scenario: Legacy inspection cannot be matched safely
- **WHEN** no persistent identifier proves the inspection's customer and agent ownership
- **THEN** the system SHALL keep it unassigned for administrative review and SHALL NOT authorize or attribute it using name similarity
