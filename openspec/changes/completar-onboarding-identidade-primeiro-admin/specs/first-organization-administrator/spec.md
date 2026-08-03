## ADDED Requirements

### Requirement: Bootstrap creates exactly one first organization administrator
The municipal bootstrap SHALL create exactly one initial owner/coordinator membership for the authenticated requester when the policy allows organization creation.

#### Scenario: Two first-admin requests race
- **WHEN** concurrent requests attempt to establish the first administrator of the same bootstrap organization
- **THEN** exactly one initial membership SHALL be created and both calls SHALL resolve to the same organization state

### Requirement: First administrator authority comes from membership
The first administrator SHALL receive authority from a persisted organization membership, not from a standalone public profile role or typed municipality.

#### Scenario: User changes local role or municipality
- **WHEN** the first administrator changes client-side profile values
- **THEN** effective organization authority SHALL remain derived from the server-side membership

### Requirement: Public bootstrap cannot create TCS owners
No public or customer bootstrap operation SHALL create or activate `master_admin`, `owner_admins`, `internal_staff`, or internal permissions.

#### Scenario: Bootstrap payload requests internal owner
- **WHEN** a client submits any internal owner or staff value
- **THEN** the system SHALL reject or ignore the value and SHALL create no internal authorization

### Requirement: Later administrators join by invitation
After the first owner/coordinator exists, additional organization administrators SHALL be added only through an authorized invitation or internal recovery process.

#### Scenario: Existing organization requests another first admin
- **WHEN** an organization with an active initial owner calls the first-admin bootstrap again for another user
- **THEN** the system SHALL deny first-admin creation and direct the authorized flow to invitations

### Requirement: Existing mobile administration remains available
An authorized initial owner/coordinator SHALL be able to reach the applicable administrative functions in the mobile app without receiving access to internal TCS functions.

#### Scenario: Initial owner completes onboarding
- **WHEN** the server returns an active municipal owner context
- **THEN** the app SHALL expose organization administration, team, invitations, reports, maps, and logs allowed by effective permissions

