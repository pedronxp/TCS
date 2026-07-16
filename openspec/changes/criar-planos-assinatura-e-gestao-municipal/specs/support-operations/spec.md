## ADDED Requirements

### Requirement: Customers can open support requests
The app or approved support channel SHALL create a ticket associated with the individual account or organization and SHALL preserve requester and context information.

#### Scenario: Agent reports an invitation problem
- **WHEN** an agent submits a support request
- **THEN** the ticket SHALL include the organization, user, category, priority, status, and creation time

### Requirement: Support priority follows plan
The system SHALL assign a default support priority and response target based on the active plan, with explicit override and audit by an owner.

#### Scenario: Complete municipal customer opens critical ticket
- **WHEN** a Complete customer reports a critical outage
- **THEN** the ticket SHALL enter the specialized queue with the configured target and escalation path

### Requirement: Implementation support is tracked
The console SHALL track municipal onboarding, coordinator training, pilot status, and the 30-day review.

#### Scenario: Municipality completes pilot
- **WHEN** the pilot checklist is completed
- **THEN** the organization SHALL move to the configured operational status and retain the onboarding history
