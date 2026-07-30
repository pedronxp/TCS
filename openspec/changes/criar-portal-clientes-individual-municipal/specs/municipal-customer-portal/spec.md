## ADDED Requirements

### Requirement: Municipal portal adapts to the persisted role
The system SHALL provide distinct dashboard, navigation, actions, and data scope for coordinator, supervisor, and agent roles derived from an active organization membership.

#### Scenario: Coordinator opens the portal
- **WHEN** an active coordinator signs in
- **THEN** the portal SHALL provide organization-wide operational, team, invitation, consumption, subscription, billing, support, and settings destinations

#### Scenario: Agent opens the portal
- **WHEN** an active agent signs in
- **THEN** the portal SHALL provide only self or assigned operational destinations and SHALL omit organization administration and billing

### Requirement: Coordinator manages the municipal account
An authorized coordinator SHALL manage organization settings, members, permitted role invitations, consumption, subscription, and billing subject to plan and subscription policy.

#### Scenario: Coordinator invites a supervisor
- **WHEN** a coordinator with available seats submits a valid supervisor invitation
- **THEN** the system SHALL create an organization-scoped invitation and record the action

### Requirement: Supervisor operates within a server-defined scope
A supervisor SHALL view and manage operations only within the organization scope assigned by the server and SHALL invite only agents.

#### Scenario: Supervisor requests data outside the assigned scope
- **WHEN** a supervisor requests inspections outside the server-defined scope
- **THEN** the system SHALL exclude or deny those records regardless of the client-side filters

### Requirement: Agent access is limited to own or assigned work
An agent SHALL access only the agent's own or explicitly assigned inspections, appointments, documents, support requests, and permitted personal indicators.

#### Scenario: Agent opens organization consumption
- **WHEN** an agent requests organization-wide consumption or billing
- **THEN** the system SHALL return a no-permission result and SHALL NOT expose aggregate commercial data

### Requirement: Membership status controls portal access
Suspended, removed, or conflicting municipal memberships SHALL prevent the corresponding organization portal context.

#### Scenario: Suspended member signs in
- **WHEN** a suspended municipal member authenticates successfully
- **THEN** the portal SHALL show an access-suspended state with a safe support path and SHALL NOT return organization data
