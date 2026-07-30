## ADDED Requirements

### Requirement: Municipal invitations are organization-scoped and hashed
Every invitation SHALL contain an immutable organization, normalized recipient email, role, expiration, issuer, status, and cryptographic token hash; plaintext tokens SHALL NOT be persisted.

#### Scenario: Invitation link is inspected in the database
- **WHEN** an authorized operator reads the invitation record
- **THEN** the record SHALL contain only the token hash and SHALL NOT reveal a reusable plaintext token

### Requirement: Invitation role follows municipal authority
A coordinator SHALL invite coordinator, supervisor, or agent roles, a supervisor SHALL invite only agents, and an agent SHALL NOT create invitations.

#### Scenario: Supervisor invites a coordinator
- **WHEN** a supervisor requests a coordinator invitation
- **THEN** the server SHALL deny the operation and record the denied role assignment

### Requirement: Invitations respect subscription and seat limits
Invitation creation and acceptance SHALL evaluate the organization subscription, municipal feature entitlement, and available user seats atomically.

#### Scenario: Last seat is consumed concurrently
- **WHEN** two invitation acceptances compete for one remaining seat
- **THEN** exactly one membership SHALL become active and the other SHALL receive a seat-limit result

### Requirement: Invitation acceptance binds the authenticated email
An invitation SHALL be accepted only by an authenticated user whose verified email matches the invitation recipient.

#### Scenario: Forwarded invitation is opened by another account
- **WHEN** a signed-in user with a different verified email presents a valid token
- **THEN** the system SHALL reject acceptance without revealing organization-private data

### Requirement: Invitation tokens are single-use and revocable
Accepted, expired, replaced, or revoked invitation tokens SHALL not create or modify membership.

#### Scenario: Accepted token is reused
- **WHEN** an accepted token is submitted again
- **THEN** the system SHALL return a non-sensitive already-used result and SHALL NOT create a second membership

#### Scenario: Coordinator resends an invitation
- **WHEN** a coordinator requests resend
- **THEN** the system SHALL revoke the previous token, create a new expiration and token hash, and audit both transitions

### Requirement: Invitation cannot transfer organization
The acceptance operation SHALL derive the organization exclusively from the stored invitation.

#### Scenario: Client supplies another municipality
- **WHEN** an invitation for organization A is accepted with a client parameter for organization B
- **THEN** the system SHALL ignore or reject organization B and SHALL NOT create any membership in B
