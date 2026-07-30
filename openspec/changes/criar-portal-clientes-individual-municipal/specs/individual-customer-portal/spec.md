## ADDED Requirements

### Requirement: Individual portal provides a complete account workspace
The system SHALL provide an individual customer with dashboard, inspections, map, appointments, documents, reports, subscription, support, and profile destinations.

#### Scenario: Individual customer signs in
- **WHEN** an authenticated user has an active individual portal context
- **THEN** the system SHALL open the individual dashboard and show only destinations allowed by the effective plan and permissions

### Requirement: Individual data is self-scoped
The individual portal SHALL return only records owned by the authenticated individual subject.

#### Scenario: Individual requests another user's inspection
- **WHEN** an individual customer requests an inspection owned by another user
- **THEN** the server SHALL deny access without revealing whether that inspection exists

### Requirement: Individual dashboard is actionable
The individual dashboard SHALL summarize permitted activity, upcoming appointments, document status, usage, subscription status, and relevant next actions using real server data.

#### Scenario: Account has no inspections
- **WHEN** an individual customer with permission to create opens an account with no inspections
- **THEN** the dashboard SHALL show an empty state with a permitted creation or mobile-app action

### Requirement: Existing individual records remain available when creation is blocked
The portal SHALL preserve authorized read and export access to existing records when the plan limit or subscription policy blocks new operations.

#### Scenario: Individual reaches the inspection limit
- **WHEN** the inspection quota is exhausted
- **THEN** the portal SHALL block new inspection creation, retain permitted history and documents, and show the applicable upgrade or billing action

### Requirement: Individual billing actions require account ownership
Only the authenticated individual account owner SHALL initiate checkout, open the billing portal, change plan, or request cancellation.

#### Scenario: Non-owner attempts to open billing
- **WHEN** a session without ownership of the individual subscription requests a billing operation
- **THEN** the server SHALL deny the request and record the denied action
