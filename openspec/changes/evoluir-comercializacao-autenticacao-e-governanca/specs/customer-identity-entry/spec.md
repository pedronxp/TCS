## ADDED Requirements

### Requirement: Customer identity supports email and Google
The system SHALL allow a customer to authenticate with verified email/password or Google on mobile and web through approved callbacks per environment.

#### Scenario: New customer enters with Google
- **WHEN** a verified Google identity returns successfully
- **THEN** the system SHALL create or resume a neutral customer entry context and SHALL NOT grant role, plan, organization or internal access from client metadata

### Requirement: Existing identity is not duplicated
The system SHALL require explicit authentication, recovery, or approved identity linking when the verified email already belongs to an existing account.

#### Scenario: Existing password account chooses Google
- **WHEN** the Google email matches a current password account
- **THEN** the system SHALL not silently create a second customer account

### Requirement: Tokens are restricted to controlled entry
The system SHALL use tokens only for legacy migration or organization invite, storing only a verifiable hash and enforcing expiry, single use, intended recipient and audit trail.

#### Scenario: Expired invite token is presented
- **WHEN** a person presents an expired or already consumed token
- **THEN** the system SHALL deny the invitation without creating a privileged membership

