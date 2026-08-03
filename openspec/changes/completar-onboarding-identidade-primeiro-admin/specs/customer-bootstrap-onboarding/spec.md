## ADDED Requirements

### Requirement: Customer bootstrap is atomic and idempotent
The system SHALL create or reconcile the customer profile, subject, onboarding state, initial subscription, and related records as one idempotent server-authorized operation.

#### Scenario: Completed bootstrap is retried
- **WHEN** the same user repeats a completed bootstrap with the same idempotency key
- **THEN** the system SHALL return the original customer context and SHALL NOT create duplicate organizations, memberships, or subscriptions

### Requirement: Individual and municipal onboarding are distinct
The system SHALL maintain separate onboarding rules for individual customers and municipal organizations.

#### Scenario: Individual starts onboarding
- **WHEN** a new user chooses an individual account
- **THEN** the system SHALL NOT request or create a municipal organization or municipal administrator membership

### Requirement: Onboarding state follows the account
The system SHALL persist functional onboarding state server-side so it can resume across authorized devices.

#### Scenario: User changes devices mid-onboarding
- **WHEN** an authenticated user opens the TCS on another device
- **THEN** the system SHALL resume the last valid server-side step instead of relying on the device presentation flag

### Requirement: Presentation completion is not customer activation
The local first-installation marker SHALL control only the presentation experience and SHALL NOT grant access, create a trial, approve an account, or complete customer onboarding.

#### Scenario: Presentation flag is changed locally
- **WHEN** a user modifies or clears `@onboarding_done`
- **THEN** the customer's authorization and activation state SHALL remain unchanged

### Requirement: Municipal trial is distinct from contractual activation
The system SHALL represent provisional municipal access separately from final commercial activation.

#### Scenario: Municipality finishes self-service onboarding
- **WHEN** a municipal requester completes all eligible self-service steps
- **THEN** the organization SHALL enter the approved provisional/trial state and SHALL NOT be represented as contractually active without an authoritative commercial event

### Requirement: Incomplete bootstrap is recoverable
The system SHALL preserve a safe resumable state after transient failures and SHALL expose no partially privileged customer context.

#### Scenario: Network fails after the bootstrap request
- **WHEN** the client loses connectivity before receiving the result
- **THEN** retry SHALL reconcile the original transaction by idempotency key rather than starting another customer

