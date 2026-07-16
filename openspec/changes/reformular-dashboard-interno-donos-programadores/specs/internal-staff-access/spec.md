## ADDED Requirements

### Requirement: Internal access requires an explicit active staff identity
The system MUST grant access to the internal console only when the authenticated user has an explicit active internal staff record.

#### Scenario: Municipal administrator requests the console
- **WHEN** an authenticated municipal administrator without an internal staff record requests an internal route
- **THEN** the system SHALL deny access even if the user has an application role named `admin` or `master_admin`

#### Scenario: Inactive staff member requests the console
- **WHEN** an authenticated user has an inactive internal staff record
- **THEN** the system SHALL deny access and record the denied attempt when appropriate

### Requirement: Owner permissions cover business administration
The system SHALL allow an owner to manage customers, plans, subscriptions, commercial configuration, support, internal staff and audited overrides.

#### Scenario: Owner changes a subscription
- **WHEN** an owner submits a valid plan or subscription change with required justification
- **THEN** the system SHALL apply the change atomically and create an audit event containing the actor and before-and-after context

### Requirement: Developer permissions are technically scoped
The system SHALL allow a developer to operate approved technical functions and inspect the minimum customer data required for diagnosis, while denying commercial mutations and internal staff administration.

#### Scenario: Developer starts an allowed build
- **WHEN** a developer requests a build in an environment allowed by policy
- **THEN** the system SHALL validate the role and environment server-side, start the build and audit the action

#### Scenario: Developer attempts to change pricing
- **WHEN** a developer submits a pricing, plan assignment or subscription mutation
- **THEN** the system SHALL reject the request regardless of whether the frontend route or control was manually invoked

### Requirement: Sensitive authorization is enforced server-side
The system MUST enforce internal role and action permissions in RLS policies, RPCs or Edge Functions and SHALL NOT rely on hidden navigation controls.

#### Scenario: Unauthorized API call bypasses the interface
- **WHEN** an authenticated user calls an internal mutation directly without the required role
- **THEN** the server SHALL reject the operation and SHALL NOT modify protected data

### Requirement: Customer data access is purpose-limited
The system SHALL restrict developer access to personal and operational customer data to fields required for technical diagnosis and SHALL audit access to sensitive detail when configured.

#### Scenario: Developer opens a customer summary
- **WHEN** a developer views a customer without entering a sensitive support context
- **THEN** the system SHALL return operational metadata and sanitized diagnostics without unnecessary personal inspection content

#### Scenario: Developer enters sensitive support context
- **WHEN** policy permits a developer to open sensitive customer detail for an active support case
- **THEN** the system SHALL require the support context and record the actor, customer, reason and timestamp

### Requirement: High-risk actions require fresh assurance
The system MUST require the configured strong authentication assurance and explicit confirmation before high-risk internal actions.

#### Scenario: Staff member lacks required assurance
- **WHEN** an internal user attempts to change a plan, revoke another session, publish a version or trigger a production build without the required authentication assurance
- **THEN** the system SHALL require reauthentication or a stronger factor before accepting the action

### Requirement: Internal access changes are auditable
The system SHALL record activation, role change, suspension and removal of internal staff access.

#### Scenario: Owner changes a developer's access
- **WHEN** an owner changes an internal staff role or active status
- **THEN** the system SHALL preserve the previous and new values with the acting owner and timestamp
