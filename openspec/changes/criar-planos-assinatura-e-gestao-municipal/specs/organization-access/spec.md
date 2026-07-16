## ADDED Requirements

### Requirement: Organization owns municipal data
The system SHALL associate every municipal user, invitation, inspection, usage record, and support context with exactly one organization in the first release.

#### Scenario: Agent reads inspections
- **WHEN** an agent requests inspections
- **THEN** the system SHALL return only inspections belonging to the agent's persisted organization

### Requirement: Invitation is organization-scoped
The system SHALL create each agent invitation with an immutable organization identifier, role, expiration, single-use state, and audit data.

#### Scenario: Cataguases invitation is used for Ubá
- **WHEN** an invitation issued by Cataguases is presented in an attempt to join Ubá
- **THEN** the system SHALL reject the operation and SHALL NOT create a Ubá membership

### Requirement: Membership determines municipality
The system SHALL derive an agent's organization from the validated membership and SHALL NOT authorize access using a municipality selected or typed by the client.

#### Scenario: Client changes displayed municipality
- **WHEN** a client modifies a local municipality value
- **THEN** authorization SHALL continue to use the persisted organization membership

### Requirement: Organization roles are enforced
The system SHALL support at least owner/coordinator, supervisor, and agent roles with distinct administrative permissions.

#### Scenario: Agent attempts to add another agent
- **WHEN** an agent submits an agent invitation request
- **THEN** the system SHALL deny it unless the agent has an authorized role and the organization has an available seat
