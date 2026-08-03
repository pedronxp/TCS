## ADDED Requirements

### Requirement: Critical operations record authorship server-side
Every critical identity, organization, membership, invitation, subscription, recovery, and authorization change SHALL record its authenticated actor and scope on the server.

#### Scenario: First administrator is created
- **WHEN** municipal bootstrap commits the first administrator membership
- **THEN** the same transaction SHALL append an event identifying actor, organization, membership, operation, result, server time, and request id

### Requirement: Authoritative audit failure prevents critical mutation
The system SHALL NOT commit a critical mutation when its required authoritative audit event cannot be persisted.

#### Scenario: Audit insert fails
- **WHEN** persistence of the required audit event fails during a role change
- **THEN** the role change SHALL roll back instead of succeeding without evidence

### Requirement: Authoritative events are append-only
Customer and municipal roles SHALL NOT update or delete authoritative audit events.

#### Scenario: Administrator attempts to alter history
- **WHEN** a municipal administrator submits update or delete against an authoritative event
- **THEN** RLS and grants SHALL deny the mutation

### Requirement: Audit payload minimizes personal data
Audit events SHALL contain only the minimum identifiers, result, reason, timestamps, request metadata, and safe hashes needed for accountability.

#### Scenario: Google account is linked
- **WHEN** an identity link succeeds
- **THEN** the event SHALL identify the user and provider without storing provider tokens, secrets, or unnecessary profile data

### Requirement: Client logs are not authoritative evidence
Telemetry sent by mobile or Web clients MAY assist diagnosis but SHALL NOT be the only evidence for a critical operation.

#### Scenario: Client goes offline after a server mutation
- **WHEN** the client cannot submit its local telemetry after a successful critical mutation
- **THEN** the server-side authorship event SHALL still exist and remain queryable by authorized staff

### Requirement: Audit reads respect organization and internal scope
Audit timelines SHALL expose only events the requester is authorized to view, with sensitive fields sanitized.

#### Scenario: Administrator queries another municipality
- **WHEN** a municipal administrator requests audit events for another organization
- **THEN** the system SHALL return no cross-organization data and SHALL record the denied access when appropriate

