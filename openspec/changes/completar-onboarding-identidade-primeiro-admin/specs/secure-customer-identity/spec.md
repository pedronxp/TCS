## ADDED Requirements

### Requirement: User-controlled metadata cannot grant authority
The system SHALL NOT derive role, organization, municipality, approval, plan, internal staff status, or permissions from user-editable metadata or client-supplied authorization fields.

#### Scenario: Public signup requests administrator role
- **WHEN** a public client signs up with `role=admin` or any privileged role in metadata
- **THEN** the system SHALL create no privileged membership or approval and SHALL record the denied attempt when appropriate

### Requirement: New identities start without customer authority
A new identity SHALL remain neutral until a server-authorized bootstrap or invitation establishes its customer context.

#### Scenario: First Google login has no membership
- **WHEN** a verified Google identity signs in for the first time without an invitation or bootstrap
- **THEN** the system SHALL direct the user to onboarding and SHALL NOT sign the user into internal or municipal administration

### Requirement: Google authentication is cross-platform
The system SHALL support Google authentication for the customer Web portal, Android, and iOS with environment-specific approved redirects and secure callback exchange.

#### Scenario: OAuth callback is replayed
- **WHEN** an already exchanged or expired callback code is submitted again
- **THEN** the system SHALL reject the replay without creating a second account, profile, or organization

### Requirement: Existing identities can be linked without duplicating customers
The system SHALL reconcile a verified Google identity with an eligible existing password identity through a secure linking flow.

#### Scenario: Password account signs in with the same verified Google email
- **WHEN** the provider returns an email already associated with an eligible customer identity
- **THEN** the system SHALL link or require verified account linking and SHALL NOT create a duplicate organization or subscription

### Requirement: Password recovery is distinct from passwordless sign-in
The “forgot password” journey SHALL use a password recovery session and SHALL NOT represent a generic OTP sign-in as password reset.

#### Scenario: Valid recovery link sets a new password
- **WHEN** a user opens a valid recovery link and submits an acceptable new password
- **THEN** the system SHALL update the password, record a security event, and offer revocation of other sessions

### Requirement: Internal console remains a separate trust domain
Customer authentication SHALL never grant access to internal TCS routes or permissions without an active `internal_staff` authorization.

#### Scenario: Municipal owner opens the internal console
- **WHEN** a municipal owner with a valid customer session requests `/app/*`
- **THEN** the system SHALL deny access even if the user authenticated with Google

